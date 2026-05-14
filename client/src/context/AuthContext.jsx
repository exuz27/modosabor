import { createContext, useContext, useState, useEffect } from 'react';
import { getPermissionsForRole, hasPermission as canUser } from '../lib/permissions.js';
import api from '../lib/api.js';
const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const fresh = await api.get('/auth/me');
    const normalized = { ...fresh, permissions: fresh.permissions || getPermissionsForRole(fresh.rol) };
    localStorage.setItem('ms_user', JSON.stringify(normalized));
    setUser(normalized);
    return normalized;
  };

  useEffect(() => {
    const t = localStorage.getItem('ms_token');
    const u = localStorage.getItem('ms_user');
    if (!t || !u) {
      setLoading(false);
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(u);
    } catch {
      localStorage.removeItem('ms_token');
      localStorage.removeItem('ms_user');
      setLoading(false);
      return;
    }
    if (!parsed.permissions) parsed.permissions = getPermissionsForRole(parsed.rol);
    setToken(t);
    setUser(parsed);

    refreshUser()
      .catch(() => {
        localStorage.removeItem('ms_token');
        localStorage.removeItem('ms_user');
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = (t, u) => {
    const normalized = { ...u, permissions: u.permissions || getPermissionsForRole(u.rol) };
    localStorage.setItem('ms_token', t);
    localStorage.setItem('ms_user', JSON.stringify(normalized));
    setToken(t); setUser(normalized);
  };

  const logout = () => {
    localStorage.removeItem('ms_token');
    localStorage.removeItem('ms_user');
    setToken(null); setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, token, loading, login, logout, refreshUser, isAuth: !!token, hasPermission: (permission) => canUser(user, permission) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
