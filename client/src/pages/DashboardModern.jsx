import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  ChefHat,
  ChevronRight,
  CreditCard,
  DollarSign,
  Flame,
  Package,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAppConfig } from '../context/AppConfigContext.jsx';
import { paymentStatusLabel } from '../lib/paymentStatus.js';

const fmtMoney = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;
const fmtNumber = (value) => Number(value || 0).toLocaleString('es-AR');

const PAYMENT_COLORS = {
  efectivo: '#13DEB9',
  mercadopago: '#49BEFF',
  transferencia: '#5D87FF',
  default: '#94a3b8',
};

function QuickAction({ icon: Icon, label, onClick, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-[#5D87FF] hover:bg-[#5D87FF] hover:text-white',
    orange: 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white',
    emerald: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white',
    violet: 'bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white',
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-3 rounded-[24px] p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-95 ${colors[color]}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/60 shadow-sm backdrop-blur-sm">
        <Icon size={24} />
      </div>
      <span className="text-xs font-black uppercase tracking-wider">{label}</span>
    </button>
  );
}

function ModernMetric({ icon: Icon, label, value, trend, trendUp, helper, tint = 'blue' }) {
  const tints = {
    blue: 'bg-blue-50 text-[#5D87FF]',
    rose: 'bg-rose-50 text-[#FA896B]',
    emerald: 'bg-emerald-50 text-[#13DEB9]',
    amber: 'bg-amber-50 text-[#FFAE1F]',
  };

  return (
    <div className="group rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{label}</p>
          <h3 className="text-2xl font-black text-gray-900">{value}</h3>
          {trend !== undefined && (
            <div className={`mt-2 flex items-center gap-1.5 text-xs font-bold ${trendUp ? 'text-emerald-500' : 'text-rose-500'}`}>
              <div className={`flex h-5 w-5 items-center justify-center rounded-full ${trendUp ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              </div>
              {trend}
              <span className="ml-1 font-medium text-gray-400">vs ayer</span>
            </div>
          )}
          {helper && <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">{helper}</p>}
        </div>
        <div className={`flex h-14 w-14 items-center justify-center rounded-[20px] shadow-sm transition-transform duration-300 group-hover:rotate-6 ${tints[tint]}`}>
          <Icon size={28} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

function StockAlert({ item, onClick }) {
  const hasMinimum = Number(item.stock_minimo || 0) > 0;
  const coverage = Number(item.cobertura_pct || 0);

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center justify-between rounded-[22px] border border-white/15 bg-white/10 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-white/15"
    >
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-white">{item.nombre}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/70">
          {fmtNumber(item.stock_actual)} {item.unidad}
          {hasMinimum ? ` - Min ${fmtNumber(item.stock_minimo)} ${item.unidad}` : ' - Sin minimo configurado'}
        </p>
      </div>
      <div className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
        {hasMinimum ? `${coverage}%` : 'REVISAR'}
      </div>
    </button>
  );
}

export default function DashboardModern() {
  const { user } = useAuth();
  const { isModuleEnabled } = useAppConfig();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await api.get('/reportes/dashboard');
        setData(response);
        setLastUpdate(format(new Date(), 'HH:mm'));
      } catch (error) {
        console.error(error);
      }
    };

    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const ticketPromedio = useMemo(() => {
    if (!data?.ventasHoy?.pedidos) return 0;
    return Math.round(Number(data.ventasHoy.total || 0) / Number(data.ventasHoy.pedidos || 0));
  }, [data]);

  const quickActions = [
    { key: 'tpv', icon: Plus, label: 'Nueva venta', onClick: () => navigate('/admin/tpv'), color: 'blue' },
    { key: 'kds', icon: ChefHat, label: 'Cocina', onClick: () => navigate('/admin/kds'), color: 'orange' },
    { key: 'caja', icon: Wallet, label: 'Caja', onClick: () => navigate('/admin/caja'), color: 'emerald' },
    { key: 'inventario', icon: Package, label: 'Stock', onClick: () => navigate('/admin/inventario'), color: 'violet' },
  ].filter((action) => isModuleEnabled(action.key));

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F7FB]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#5D87FF] border-t-transparent" />
          <p className="text-sm font-black uppercase tracking-widest text-gray-400">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8 pb-12">
        <div className="relative overflow-hidden rounded-[36px] border border-white/60 bg-gradient-to-br from-white via-[#F7F9FF] to-[#EEF4FF] px-6 py-7 shadow-sm sm:px-8">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#5D87FF]/10 blur-3xl" />
          <div className="absolute -bottom-12 left-16 h-32 w-32 rounded-full bg-[#13DEB9]/10 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-[#5D87FF] shadow-sm">
                  <Sparkles size={12} />
                  Resumen operativo
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#0F172A] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-sm">
                  <RefreshCw size={11} className={lastUpdate ? 'animate-spin-slow' : ''} />
                  Sync {lastUpdate || '--:--'}
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-gray-900">
                Hola, {user?.nombre?.split(' ')?.[0] || 'Admin'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-gray-500">
                Así va tu negocio hoy, {format(new Date(), "eeee d 'de' MMMM", { locale: es })}. Tenés una vista rápida de ventas,
                operación y clientes clave sin salir del panel.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:gap-4">
              {quickActions.map((action) => (
                <QuickAction key={action.key} icon={action.icon} label={action.label} onClick={action.onClick} color={action.color} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {!data.cajaEstado?.abierta && isModuleEnabled('caja') && (
            <div className="animate-in slide-in-from-left flex items-center justify-between rounded-[24px] bg-[#FA896B] p-5 text-white shadow-lg shadow-rose-100 duration-500">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-white/20 p-3">
                  <AlertTriangle size={24} className="animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider opacity-80">Atencion inmediata</p>
                  <p className="text-lg font-bold">La caja esta cerrada</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/admin/caja')}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-black text-[#FA896B] shadow-sm transition-transform hover:scale-105 active:scale-95"
              >
                ABRIR CAJA
              </button>
            </div>
          )}

          {data.stockCritico?.length > 0 && isModuleEnabled('inventario') && (
            <div className="animate-in slide-in-from-right rounded-[24px] bg-[#FFAE1F] p-5 text-white shadow-lg shadow-amber-100 duration-500">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-white/20 p-3">
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider opacity-80">Stock critico</p>
                    <p className="text-lg font-bold">Tienes {data.stockCritico.length} insumos para revisar</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/admin/inventario')}
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-black text-[#FFAE1F] shadow-sm transition-transform hover:scale-105 active:scale-95"
                >
                  REVISAR
                </button>
              </div>
              <div className="grid gap-3">
                {data.stockCritico.slice(0, 2).map((item) => (
                  <StockAlert key={item.id} item={item} onClick={() => navigate('/admin/inventario')} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <ModernMetric icon={DollarSign} label="Ventas del día" value={fmtMoney(data.ventasHoy?.total || 0)} trend={`${Math.abs(data.tendenciaVentas || 0)}%`} trendUp={(data.tendenciaVentas || 0) >= 0} tint="blue" />
          <ModernMetric icon={ShoppingBag} label="Pedidos de hoy" value={fmtNumber(data.ventasHoy?.pedidos || 0)} trend={`${Math.abs(data.tendenciaPedidos || 0)}%`} trendUp={(data.tendenciaPedidos || 0) >= 0} tint="emerald" />
          <ModernMetric icon={TrendingUp} label="Ticket promedio" value={fmtMoney(ticketPromedio)} helper="Promedio por orden" tint="amber" />
          <ModernMetric icon={Truck} label="Delivery activo" value={fmtNumber(data.pedidosEnDelivery || 0)} helper={`${data.pedidosActivos || 0} pedidos totales`} tint="rose" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-[32px] border border-gray-100 bg-white p-8 shadow-sm xl:col-span-2">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-900">Ventas recientes</h3>
                <p className="text-sm font-medium text-gray-400">Historial de los ultimos 7 dias</p>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5">
                  <div className="h-2 w-2 rounded-full bg-[#5D87FF]" />
                  <span className="text-[10px] font-black uppercase text-[#5D87FF]">Ingresos</span>
                </div>
              </div>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.ventas7dias}>
                  <defs>
                    <linearGradient id="colorVentasModern" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5D87FF" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#5D87FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} tickFormatter={(val) => format(parseISO(val), 'EEE', { locale: es }).toUpperCase()} dy={10} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }} formatter={(val) => [fmtMoney(val), 'Ventas']} />
                  <Area type="monotone" dataKey="total" stroke="#5D87FF" strokeWidth={4} fillOpacity={1} fill="url(#colorVentasModern)" animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-col rounded-[32px] border border-gray-100 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-black uppercase tracking-tight text-gray-900">Últimas órdenes</h3>
              <button onClick={() => navigate('/admin/pedidos')} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#5D87FF] hover:underline">
                VER TODO <ChevronRight size={14} />
              </button>
            </div>
            <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto pr-1">
              {data.ultimosPedidos?.length > 0 ? data.ultimosPedidos.map((order) => (
                <div key={order.id} className="group flex cursor-pointer items-center gap-4" onClick={() => navigate('/admin/pedidos')}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 transition-colors group-hover:bg-blue-50">
                    {order.tipo_entrega === 'delivery' ? <Bike size={18} className="text-gray-400 group-hover:text-[#5D87FF]" /> : order.tipo_entrega === 'mesa' ? <UtensilsCrossed size={18} className="text-gray-400 group-hover:text-[#5D87FF]" /> : <ShoppingBag size={18} className="text-gray-400 group-hover:text-[#5D87FF]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black uppercase tracking-tight text-gray-800">#{order.numero} · {order.cliente_nombre || 'Cliente'}</p>
                  <p className="text-[10px] font-bold uppercase text-gray-400">{format(parseISO(order.creado_en), 'HH:mm')} hs · {order.metodo_pago} · {paymentStatusLabel(order.pago_estado)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{fmtMoney(order.total)}</p>
                    <div className="flex justify-end">
                      <span className={`rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase ${order.estado === 'entregado' ? 'bg-emerald-50 text-emerald-600' : order.estado === 'cancelado' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-[#5D87FF]'}`}>{order.estado}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="flex h-full flex-col items-center justify-center opacity-40">
                  <ShoppingBag size={48} className="mb-2" />
                  <p className="text-xs font-bold uppercase">Sin pedidos aun</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="flex flex-col rounded-[32px] border border-gray-100 bg-white p-8 shadow-sm">
            <h3 className="mb-1 text-lg font-black uppercase tracking-tight text-gray-900">Cobros de hoy</h3>
            <p className="mb-8 text-xs font-bold uppercase tracking-widest text-gray-400">Solo pagos confirmados por canal</p>

            <div className="relative h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.porMetodoPago || []} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="total" nameKey="metodo_pago" stroke="none" cornerRadius={8}>
                    {(data.porMetodoPago || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[entry.metodo_pago] || PAYMENT_COLORS.default} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }} formatter={(val) => [fmtMoney(val), 'Total']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <CreditCard size={20} className="mb-1 text-gray-300" />
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Canales</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {(data.porMetodoPago || []).map((item) => (
                <div key={item.metodo_pago} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[item.metodo_pago] || PAYMENT_COLORS.default }} />
                    <span className="text-[11px] font-black uppercase tracking-tight text-gray-500">{item.metodo_pago}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-gray-900">{fmtMoney(item.total)}</p>
                    <p className="text-[9px] font-bold uppercase leading-none text-gray-400">{item.cantidad} pedidos</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-gray-100 bg-white p-8 shadow-sm xl:col-span-2">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-900">Productos estrella</h3>
                <p className="text-sm font-medium text-gray-400">Los mas pedidos del dia</p>
              </div>
              <Flame className="text-orange-500" size={24} />
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
              {data.productosEstrella?.map((prod, idx) => (
                <div key={idx} className="group flex items-center gap-4 rounded-2xl p-2 transition-all hover:bg-gray-50">
                  <div className="relative shrink-0">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] border border-gray-100 bg-[#F2F6FA] shadow-sm">
                      {prod.imagen ? <img src={prod.imagen} alt={prod.nombre} className="h-full w-full object-cover transition-transform group-hover:scale-110" /> : <span className="text-base font-black text-orange-400">MS</span>}
                    </div>
                    <div className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-900 text-[10px] font-black text-white shadow-md">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black uppercase tracking-tight text-gray-800 transition-colors group-hover:text-[#5D87FF]">{prod.nombre}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{prod.categoria}</p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-orange-400 transition-all duration-1000" style={{ width: `${(prod.cantidad / (data.productosEstrella[0]?.cantidad || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{prod.cantidad}u</p>
                    <p className="text-[10px] font-bold uppercase tracking-tighter text-[#5D87FF]">{fmtMoney(prod.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-[32px] border border-gray-100 bg-white p-8 shadow-sm">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-900">Más vendidos general</h3>
                <p className="text-sm font-medium text-gray-400">Lo que más se vende en general</p>
              </div>
              <TrendingUp className="text-[#5D87FF]" size={24} />
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
              {(data.productosMasVendidosGeneral || []).map((prod, idx) => (
                <button
                  key={`${prod.id || prod.nombre}-${idx}`}
                  onClick={() => navigate('/admin/productos')}
                  className="group flex w-full items-center gap-4 rounded-2xl p-2 text-left transition-all hover:bg-gray-50"
                >
                  <div className="relative shrink-0">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] border border-gray-100 bg-[#F2F6FA] shadow-sm">
                      {prod.imagen ? <img src={prod.imagen} alt={prod.nombre} className="h-full w-full object-cover transition-transform group-hover:scale-110" /> : <span className="text-base font-black text-[#5D87FF]">MS</span>}
                    </div>
                    <div className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#5D87FF] text-[10px] font-black text-white shadow-md">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black uppercase tracking-tight text-gray-800 transition-colors group-hover:text-[#5D87FF]">{prod.nombre}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{prod.categoria}</p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-[#5D87FF] transition-all duration-1000" style={{ width: `${(prod.cantidad / (data.productosMasVendidosGeneral?.[0]?.cantidad || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{prod.cantidad}u</p>
                    <p className="text-[10px] font-bold uppercase tracking-tighter text-[#5D87FF]">{fmtMoney(prod.total)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-gray-100 bg-white p-8 shadow-sm">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-900">Clientes que más compran</h3>
                <p className="text-sm font-medium text-gray-400">Tus mejores clientes en general</p>
              </div>
              <Star className="text-[#FFAE1F]" size={24} />
            </div>
            <div className="space-y-4">
              {(data.clientesMasCompran || []).map((cli, idx) => (
                <button
                  key={`${cli.id || cli.telefono || cli.nombre}-${idx}`}
                  onClick={() => navigate('/admin/clientes')}
                  className="flex w-full items-center gap-4 rounded-[24px] border border-gray-100 bg-[#F8FAFF] px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white text-sm font-black text-[#5D87FF] shadow-sm">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black uppercase tracking-tight text-gray-900">{cli.nombre}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {fmtNumber(cli.total_pedidos || 0)} pedidos{cli.nivel ? ` - ${cli.nivel}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{fmtMoney(cli.total_gastado)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#5D87FF]">
                      {cli.ultima_compra ? format(parseISO(String(cli.ultima_compra).replace(' ', 'T')), 'dd/MM') : 'Sin fecha'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[40px] bg-[#5D87FF] p-10 text-white shadow-2xl shadow-blue-200">
          <div className="absolute right-0 top-0 -mr-32 -mt-32 h-96 w-96 rounded-full bg-white/10 blur-[80px]" />
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-[#49BEFF]/20 blur-[60px]" />

          <div className="relative z-10">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
                  <Star size={12} />
                  Ranking premium
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Comunidad VIP</h3>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-100">Clientes de alto valor, frecuencia y nivel</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Lectura del panel</p>
                <p className="mt-1 text-sm font-bold text-white">El score combina gasto, pedidos, nivel y actividad reciente.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
              {data.clientesVIP?.map((cli, idx) => (
                <div key={idx} className="group/item flex flex-col rounded-[32px] border border-white/10 bg-white/10 p-5 text-center backdrop-blur-md transition-all hover:-translate-y-2 hover:bg-white hover:text-[#5D87FF]">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center self-center rounded-[24px] bg-white/20 text-2xl font-black shadow-lg transition-colors group-hover/item:bg-[#5D87FF] group-hover/item:text-white">
                    {cli.nombre?.[0]}
                  </div>
                  <p className="truncate text-sm font-black uppercase tracking-tight">{cli.nombre}</p>
                  <div className="mt-2 inline-flex self-center rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white group-hover/item:bg-[#ECF2FF] group-hover/item:text-[#5D87FF]">
                    Score {fmtNumber(cli.score || 0)}
                  </div>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-widest opacity-75 group-hover/item:text-gray-400">
                    {cli.nivel || 'Bronce'} - {cli.total_pedidos} pedidos
                  </p>
                  <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-left group-hover/item:border-[#5D87FF]/10">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                      <span className="opacity-70 group-hover/item:text-gray-400">Gastado</span>
                      <span>{fmtMoney(cli.total_gastado)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                      <span className="opacity-70 group-hover/item:text-gray-400">Actividad</span>
                      <span>{Number(cli.diasSinComprar || 0) <= 1 ? 'Hoy' : `${fmtNumber(cli.diasSinComprar || 0)} d`}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/50 bg-white/50 px-2 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(19,222,185,0.5)] animate-pulse" />
            Motor Modo Sabor en linea
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <RefreshCw size={12} className={lastUpdate ? 'animate-spin-slow' : ''} />
              Última sincronización: {lastUpdate}
            </div>
            <div className="hidden h-4 w-[1px] bg-gray-300 sm:block" />
            <p className="hidden sm:block">v2.0 PWA Premium</p>
          </div>
        </div>
      </div>
    </div>
  );
}

