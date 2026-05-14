import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAppConfig } from '../context/AppConfigContext.jsx';
import { useNavigate } from 'react-router-dom';
import { paymentStatusLabel } from '../lib/paymentStatus.js';
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
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  ChefHat,
  DollarSign,
  Flame,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  Star,
  TrendingUp,
  Truck,
  UtensilsCrossed,
  AlertTriangle,
  Wallet,
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const fmtMoney = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;
const fmtNumber = (value) => Number(value || 0).toLocaleString('es-AR');

const PAYMENT_COLORS = {
  efectivo: '#13DEB9',
  mercadopago: '#49BEFF',
  transferencia: '#5D87FF',
  default: '#94a3b8'
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
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm">
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
    <div className="group rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:-translate-y-1">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">{label}</p>
          <h3 className="text-2xl font-black text-gray-900">{value}</h3>
          {trend !== undefined && (
            <div className={`mt-2 flex items-center gap-1.5 text-xs font-bold ${trendUp ? 'text-emerald-500' : 'text-rose-500'}`}>
              <div className={`flex h-5 w-5 items-center justify-center rounded-full ${trendUp ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              </div>
              {trend}
              <span className="text-gray-400 font-medium ml-1">vs ayer</span>
            </div>
          )}
          {helper && <p className="mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{helper}</p>}
        </div>
        <div className={`flex h-14 w-14 items-center justify-center rounded-[20px] shadow-sm transition-transform duration-300 group-hover:rotate-6 ${tints[tint]}`}>
          <Icon size={28} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { isModuleEnabled } = useAppConfig();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState('');

  const loadDashboard = async () => {
    try {
      const response = await api.get('/reportes/dashboard');
      setData(response);
      setLastUpdate(format(new Date(), 'HH:mm'));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const ticketPromedio = useMemo(() => {
    if (!data?.ventasHoy?.pedidos) return 0;
    return Math.round(Number(data.ventasHoy.total || 0) / Number(data.ventasHoy.pedidos || 0));
  }, [data]);

  const quickActions = [
    { key: 'tpv', icon: Plus, label: 'Nueva Venta', onClick: () => navigate('/admin/tpv'), color: 'blue' },
    { key: 'kds', icon: ChefHat, label: 'Cocina', onClick: () => navigate('/admin/kds'), color: 'orange' },
    { key: 'caja', icon: Wallet, label: 'Caja', onClick: () => navigate('/admin/caja'), color: 'emerald' },
    { key: 'inventario', icon: Package, label: 'Stock', onClick: () => navigate('/admin/inventario'), color: 'violet' },
  ].filter((action) => isModuleEnabled(action.key));

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F7FB]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#5D87FF] border-t-transparent" />
          <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Cargando Sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8 pb-12">
        
        {/* Header Seccion */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-1 bg-[#5D87FF] rounded-full"></div>
              <p className="text-sm font-black text-[#5D87FF] uppercase tracking-[0.3em]">Resumen Operativo</p>
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              ¡Hola, {user?.nombre?.split(' ')?.[0] || 'Admin'}! 👋
            </h1>
            <p className="mt-1 text-gray-500 font-medium">Así va tu negocio hoy, {format(new Date(), "eeee d 'de' MMMM", { locale: es })}</p>
          </div>
          
          {/* Botones de Accion Rapida */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:gap-4">
            {quickActions.map((action) => (
              <QuickAction
                key={action.key}
                icon={action.icon}
                label={action.label}
                onClick={action.onClick}
                color={action.color}
              />
            ))}
          </div>
        </div>

        {/* Alertas Inteligentes */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {!data.cajaEstado?.abierta && isModuleEnabled('caja') && (
            <div className="flex items-center justify-between rounded-[24px] bg-[#FA896B] p-5 text-white shadow-lg shadow-rose-100 animate-in slide-in-from-left duration-500">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-white/20 p-3">
                  <AlertTriangle size={24} className="animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider opacity-80">Atención inmediata</p>
                  <p className="text-lg font-bold">La caja está cerrada</p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/admin/caja')}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-black text-[#FA896B] transition-transform hover:scale-105 active:scale-95 shadow-sm"
              >
                ABRIR CAJA
              </button>
            </div>
          )}
          {data.stockCritico?.length > 0 && isModuleEnabled('inventario') && (
            <div className="flex items-center justify-between rounded-[24px] bg-[#FFAE1F] p-5 text-white shadow-lg shadow-amber-100 animate-in slide-in-from-right duration-500">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-white/20 p-3">
                  <Package size={24} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider opacity-80">Stock Crítico</p>
                  <p className="text-lg font-bold">Tienes {data.stockCritico.length} insumos bajos</p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/admin/inventario')}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-black text-[#FFAE1F] transition-transform hover:scale-105 active:scale-95 shadow-sm"
              >
                REVISAR
              </button>
            </div>
          )}
        </div>

        {/* Metricas Principales */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <ModernMetric
            icon={DollarSign}
            label="Ventas del día"
            value={fmtMoney(data.ventasHoy?.total || 0)}
            trend={`${Math.abs(data.tendenciaVentas || 0)}%`}
            trendUp={(data.tendenciaVentas || 0) >= 0}
            tint="blue"
          />
          <ModernMetric
            icon={ShoppingBag}
            label="Pedidos de hoy"
            value={fmtNumber(data.ventasHoy?.pedidos || 0)}
            trend={`${Math.abs(data.tendenciaPedidos || 0)}%`}
            trendUp={(data.tendenciaPedidos || 0) >= 0}
            tint="emerald"
          />
          <ModernMetric
            icon={TrendingUp}
            label="Ticket Promedio"
            value={fmtMoney(ticketPromedio)}
            helper="Promedio por orden"
            tint="amber"
          />
          <ModernMetric
            icon={Truck}
            label="Delivery Activo"
            value={fmtNumber(data.pedidosEnDelivery || 0)}
            helper={`${data.pedidosActivos || 0} pedidos totales`}
            tint="rose"
          />
        </div>

        {/* Graficos y Actividad Reciente */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          
          {/* Grafico de Ventas */}
          <div className="xl:col-span-2 rounded-[32px] bg-white p-8 shadow-sm border border-gray-100">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Ventas Recientes</h3>
                <p className="text-sm text-gray-400 font-medium">Historial de los últimos 7 días</p>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5">
                  <div className="h-2 w-2 rounded-full bg-[#5D87FF]"></div>
                  <span className="text-[10px] font-black text-[#5D87FF] uppercase">Ingresos</span>
                </div>
              </div>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.ventas7dias}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5D87FF" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#5D87FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="fecha" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                    tickFormatter={(val) => format(parseISO(val), 'EEE', { locale: es }).toUpperCase()}
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                    formatter={(val) => [fmtMoney(val), 'Ventas']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#5D87FF" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorVentas)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity Feed: Últimos Pedidos */}
          <div className="rounded-[32px] bg-white p-8 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Últimas Órdenes</h3>
              <button onClick={() => navigate('/admin/pedidos')} className="text-[#5D87FF] hover:underline flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">
                VER TODO <ChevronRight size={14} />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto no-scrollbar pr-1">
              {data.ultimosPedidos?.length > 0 ? data.ultimosPedidos.map((order) => (
                <div key={order.id} className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/admin/pedidos')}>
                  <div className="h-11 w-11 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                    {order.tipo_entrega === 'delivery' ? <Bike size={18} className="text-gray-400 group-hover:text-[#5D87FF]" /> : 
                     order.tipo_entrega === 'mesa' ? <UtensilsCrossed size={18} className="text-gray-400 group-hover:text-[#5D87FF]" /> :
                     <ShoppingBag size={18} className="text-gray-400 group-hover:text-[#5D87FF]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-800 truncate uppercase tracking-tight">#{order.numero} · {order.cliente_nombre || 'Cliente'}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{format(parseISO(order.creado_en), 'HH:mm')} hs · {order.metodo_pago} · {paymentStatusLabel(order.pago_estado)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{fmtMoney(order.total)}</p>
                    <div className="flex justify-end">
                       <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                         order.estado === 'entregado' ? 'bg-emerald-50 text-emerald-600' :
                         order.estado === 'cancelado' ? 'bg-rose-50 text-rose-600' :
                         'bg-blue-50 text-[#5D87FF]'
                       }`}>{order.estado}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center opacity-40">
                  <ShoppingBag size={48} className="mb-2" />
                  <p className="text-xs font-bold uppercase">Sin pedidos aún</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Distribución por Método de Pago y Productos Estrella */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          
          {/* Métodos de Pago */}
          <div className="rounded-[32px] bg-white p-8 shadow-sm border border-gray-100 flex flex-col">
            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-1">Cobros de Hoy</h3>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-8">Solo pagos confirmados por canal</p>
            
            <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.porMetodoPago || []}
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="total"
                    nameKey="metodo_pago"
                    stroke="none"
                    cornerRadius={8}
                  >
                    {(data.porMetodoPago || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[entry.metodo_pago] || PAYMENT_COLORS.default} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}
                    formatter={(val) => [fmtMoney(val), 'Total']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <CreditCard size={20} className="text-gray-300 mb-1" />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Canales</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {(data.porMetodoPago || []).map((item) => (
                <div key={item.metodo_pago} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[item.metodo_pago] || PAYMENT_COLORS.default }}></div>
                    <span className="text-[11px] font-black text-gray-500 uppercase tracking-tight">{item.metodo_pago}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-gray-900">{fmtMoney(item.total)}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase leading-none">{item.cantidad} pedidos</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Productos Estrella */}
          <div className="xl:col-span-2 rounded-[32px] bg-white p-8 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Productos Estrella</h3>
                <p className="text-sm text-gray-400 font-medium">Los más pedidos del día</p>
              </div>
              <Flame className="text-orange-500" size={24} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {data.productosEstrella?.map((prod, idx) => (
                <div key={idx} className="flex items-center gap-4 group hover:bg-gray-50 p-2 rounded-2xl transition-all">
                  <div className="relative shrink-0">
                    <div className="h-16 w-16 overflow-hidden rounded-[20px] bg-[#F2F6FA] border border-gray-100 flex items-center justify-center shadow-sm">
                      {prod.imagen ? <img src={prod.imagen} className="h-full w-full object-cover transition-transform group-hover:scale-110" /> : <span className="text-2xl">🍕</span>}
                    </div>
                    <div className="absolute -top-2 -left-2 h-7 w-7 rounded-full bg-gray-900 border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-md">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-800 truncate uppercase tracking-tight group-hover:text-[#5D87FF] transition-colors">{prod.nombre}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{prod.categoria}</p>
                    <div className="mt-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                       <div 
                        className="h-full bg-orange-400 rounded-full transition-all duration-1000" 
                        style={{ width: `${(prod.cantidad / (data.productosEstrella[0]?.cantidad || 1)) * 100}%` }}
                       />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{prod.cantidad}u</p>
                    <p className="text-[10px] font-bold text-[#5D87FF] uppercase tracking-tighter">{fmtMoney(prod.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-[32px] bg-white p-8 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Mas vendidos general</h3>
                <p className="text-sm text-gray-400 font-medium">Lo que mas se vende en general</p>
              </div>
              <TrendingUp className="text-[#5D87FF]" size={24} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {(data.productosMasVendidosGeneral || []).map((prod, idx) => (
                <button
                  key={`${prod.id || prod.nombre}-${idx}`}
                  onClick={() => navigate('/admin/productos')}
                  className="flex w-full items-center gap-4 group hover:bg-gray-50 p-2 rounded-2xl transition-all text-left"
                >
                  <div className="relative shrink-0">
                    <div className="h-16 w-16 overflow-hidden rounded-[20px] bg-[#F2F6FA] border border-gray-100 flex items-center justify-center shadow-sm">
                      {prod.imagen ? <img src={prod.imagen} className="h-full w-full object-cover transition-transform group-hover:scale-110" /> : <span className="text-base font-black text-[#5D87FF]">MS</span>}
                    </div>
                    <div className="absolute -top-2 -left-2 h-7 w-7 rounded-full bg-[#5D87FF] border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-md">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-800 truncate uppercase tracking-tight group-hover:text-[#5D87FF] transition-colors">{prod.nombre}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{prod.categoria}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{prod.cantidad}u</p>
                    <p className="text-[10px] font-bold text-[#5D87FF] uppercase tracking-tighter">{fmtMoney(prod.total)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] bg-white p-8 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Clientes que mas compran</h3>
                <p className="text-sm text-gray-400 font-medium">Tus mejores clientes en general</p>
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
                      {fmtNumber(cli.total_pedidos || 0)} pedidos{cli.nivel ? ` · ${cli.nivel}` : ''}
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

        {/* Clientes VIP Tarjeta Especial */}
        <div className="rounded-[40px] bg-[#5D87FF] p-10 shadow-2xl shadow-blue-200 text-white relative overflow-hidden group">
          {/* Decoración premium */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#49BEFF]/20 rounded-full blur-[60px] -ml-20 -mb-20"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Comunidad VIP</h3>
                <p className="text-blue-100 font-bold uppercase tracking-[0.2em] text-xs mt-1">Top clientes Modo Sabor</p>
              </div>
              <Star className="text-white fill-white animate-pulse" size={32} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {data.clientesVIP?.map((cli, idx) => (
                <div key={idx} className="bg-white/10 p-5 rounded-[32px] backdrop-blur-md border border-white/10 flex flex-col items-center text-center transition-all hover:bg-white hover:text-[#5D87FF] hover:-translate-y-2 group/item">
                  <div className="h-16 w-16 rounded-[24px] bg-white/20 flex items-center justify-center font-black text-2xl mb-4 group-hover/item:bg-[#5D87FF] group-hover/item:text-white shadow-lg transition-colors">
                    {cli.nombre?.[0]}
                  </div>
                  <p className="text-sm font-black truncate w-full uppercase tracking-tight mb-1">{cli.nombre}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 group-hover/item:text-gray-400 mb-4">{cli.total_pedidos} pedidos</p>
                  <div className="mt-auto pt-4 border-t border-white/10 group-hover/item:border-[#5D87FF]/10 w-full">
                    <p className="text-sm font-black">{fmtMoney(cli.total_gastado)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Estado del Sistema */}
        <div className="flex items-center justify-between px-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] bg-white/50 py-4 rounded-2xl backdrop-blur-sm border border-white/50 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(19,222,185,0.5)]"></div>
            Motor Modo Sabor en línea
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <RefreshCw size={12} className={lastUpdate ? 'animate-spin-slow' : ''} />
              Última sincronización: {lastUpdate}
            </div>
            <div className="h-4 w-[1px] bg-gray-300 hidden sm:block"></div>
            <p className="hidden sm:block">v2.0 PWA Premium</p>
          </div>
        </div>
      </div>
    </div>
  );
}
