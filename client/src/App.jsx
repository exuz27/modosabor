import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext.jsx';
import { AppConfigProvider } from './context/AppConfigContext.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';
import Layout from './components/Layout.jsx';

// Componente de carga
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-white">
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 border-4 border-[#5D87FF] border-t-transparent rounded-full animate-spin shadow-lg"></div>
      <p className="mt-6 text-gray-400 font-bold text-[10px] uppercase tracking-[0.2em] animate-pulse">Cargando Modo Sabor...</p>
    </div>
  </div>
);

import WebPublica from './pages/WebPublica.jsx';

// Lazy imports
const Login = lazy(() => import('./pages/Login.jsx'));
const Dashboard = lazy(() => import('./pages/DashboardModern.jsx'));
const TPV = lazy(() => import('./pages/TPV.jsx'));
const Pedidos = lazy(() => import('./pages/Pedidos.jsx'));
const Productos = lazy(() => import('./pages/Productos.jsx'));
const Inventario = lazy(() => import('./pages/Inventario.jsx'));
const Categorias = lazy(() => import('./pages/Categorias.jsx'));
const Clientes = lazy(() => import('./pages/Clientes.jsx'));
const Delivery = lazy(() => import('./pages/Delivery.jsx'));
const KDS = lazy(() => import('./pages/KDS.jsx'));
const Mesas = lazy(() => import('./pages/Mesas.jsx'));
const Caja = lazy(() => import('./pages/Caja.jsx'));
const Usuarios = lazy(() => import('./pages/Usuarios.jsx'));
const Reportes = lazy(() => import('./pages/Reportes.jsx'));
const MarketingDigital = lazy(() => import('./pages/MarketingDigital.jsx'));
const Configuracion = lazy(() => import('./pages/Configuracion.jsx'));
const Cupones = lazy(() => import('./pages/Cupones.jsx'));
const Cuenta = lazy(() => import('./pages/Cuenta.jsx'));
const Personal = lazy(() => import('./pages/Personal.jsx'));
const SeguimientoPedido = lazy(() => import('./pages/SeguimientoPedido.jsx'));
const RiderPanel = lazy(() => import('./pages/RiderPanel.jsx'));

export default function App() {
  return (
    <AuthProvider>
      <AppConfigProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<WebPublica />} />
              <Route path="/seguimiento/:id" element={<SeguimientoPedido />} />
              <Route path="/rider" element={<RiderPanel />} />
              <Route path="/rider/:id/:codigo" element={<RiderPanel />} />
              <Route path="/admin" element={<Login />} />
              <Route element={<PrivateRoute />}>
                <Route element={<Layout />}>
                  <Route element={<PrivateRoute permission="dashboard.view" />}>
                    <Route path="/admin/dashboard" element={<Dashboard />} />
                  </Route>
                  <Route element={<PrivateRoute permission="tpv.use" moduleKey="tpv" />}>
                    <Route path="/admin/tpv" element={<TPV />} />
                  </Route>
                  <Route element={<PrivateRoute permission="pedidos.view" />}>
                    <Route path="/admin/pedidos" element={<Pedidos />} />
                  </Route>
                  <Route element={<PrivateRoute permission="caja.view" moduleKey="caja" />}>
                    <Route path="/admin/caja" element={<Caja />} />
                  </Route>
                  <Route element={<PrivateRoute permission="kds.view" moduleKey="kds" />}>
                    <Route path="/admin/kds" element={<KDS />} />
                  </Route>
                  <Route element={<PrivateRoute permission="mesas.view" moduleKey="mesas" />}>
                    <Route path="/admin/mesas" element={<Mesas />} />
                  </Route>
                  <Route element={<PrivateRoute permission="delivery.view" moduleKey="delivery" />}>
                    <Route path="/admin/delivery" element={<Delivery />} />
                  </Route>
                  <Route element={<PrivateRoute permission="productos.edit" />}>
                    <Route path="/admin/productos" element={<Productos />} />
                    <Route path="/admin/categorias" element={<Categorias />} />
                  </Route>
                  <Route element={<PrivateRoute permission="productos.edit" moduleKey="inventario" />}>
                    <Route path="/admin/inventario" element={<Inventario />} />
                  </Route>
                  <Route element={<PrivateRoute permission="clientes.view" moduleKey="clientes" />}>
                    <Route path="/admin/clientes" element={<Clientes />} />
                  </Route>
                  <Route element={<PrivateRoute permission="reportes.view" moduleKey="marketing" />}>
                    <Route path="/admin/marketing" element={<MarketingDigital />} />
                  </Route>
                  <Route path="/admin/cuenta" element={<Cuenta />} />
                  <Route element={<PrivateRoute permission="reportes.view" moduleKey="reportes" />}>
                    <Route path="/admin/reportes" element={<Reportes />} />
                  </Route>
                  <Route element={<PrivateRoute permission="config.manage" />}>
                    <Route path="/admin/configuracion" element={<Configuracion />} />
                    <Route path="/admin/usuarios" element={<Usuarios />} />
                  </Route>
                  <Route element={<PrivateRoute permission="config.manage" moduleKey="personal" />}>
                    <Route path="/admin/personal" element={<Personal />} />
                  </Route>
                  <Route element={<PrivateRoute permission="config.manage" moduleKey="cupones" />}>
                    <Route path="/admin/cupones" element={<Cupones />} />
                  </Route>
                  <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AppConfigProvider>
    </AuthProvider>
  );
}
