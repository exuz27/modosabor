import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api.js';
import { applyBranding } from '../lib/branding.js';
import { isModuleEnabled as resolveModuleState } from '../lib/modules.js';

const AppConfigContext = createContext(null);

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);

  const refreshConfig = async (nextConfig = null) => {
    if (nextConfig) {
      setConfig(nextConfig);
      applyBranding(nextConfig);
      return nextConfig;
    }

    const freshConfig = await api.get('/configuracion');
    setConfig(freshConfig);
    applyBranding(freshConfig);
    return freshConfig;
  };

  useEffect(() => {
    refreshConfig()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppConfigContext.Provider
      value={{
        config,
        loading,
        refreshConfig,
        isModuleEnabled: (moduleKey) => resolveModuleState(config, moduleKey),
      }}
    >
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}
