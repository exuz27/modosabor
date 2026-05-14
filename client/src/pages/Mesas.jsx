import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { socketManager } from '../lib/socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Armchair,
  ArrowRightLeft,
  ChevronRight,
  ClipboardList,
  CookingPot,
  DoorOpen,
  Minus,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Scissors,
  X,
  Users,
  CalendarDays,
  Utensils
} from 'lucide-react';

import tableImg from '../image/table/table.jpg';

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

const STATE_META = {
  nuevo: { label: 'NUEVO', classes: 'bg-blue-50 text-[#5D87FF]', next: 'confirmado', nextLabel: 'CONFIRMAR' },
  confirmado: { label: 'CONFIRMADO', classes: 'bg-emerald-50 text-[#13DEB9]', next: 'preparando', nextLabel: 'PREPARAR' },
  preparando: { label: 'COCINA', classes: 'bg-amber-50 text-[#FFAE1F]', next: 'listo', nextLabel: 'LISTO' },
  listo: { label: 'LISTO', classes: 'bg-emerald-50 text-[#13DEB9]', next: 'entregado', nextLabel: 'CERRAR' },
};

function parseMesaNames(config) {
  const cantidad = Math.max(1, Number(config.mesas_cantidad) || 12);
  const custom = String(config.mesas_nombres || '').split(/[\n,]+/).map(i => i.trim()).filter(Boolean);
  return custom.length > 0 ? custom : Array.from({ length: cantidad }, (_, i) => String(i + 1));
}

function StatCard({ icon: Icon, label, value, tint = 'blue' }) {
  const tints = {
    blue: 'bg-blue-50 text-[#5D87FF]',
    emerald: 'bg-emerald-50 text-[#13DEB9]',
    amber: 'bg-amber-50 text-[#FFAE1F]',
    rose: 'bg-rose-50 text-[#FA896B]',
    slate: 'bg-gray-50 text-gray-600',
  };

  return (
    <div className="group rounded-[32px] border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">{label}</p>
          <p className="text-xl font-black text-gray-900 tracking-tight">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:rotate-6 ${tints[tint]}`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

export default function Mesas() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState({});
  const [pedidos, setPedidos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState('');
  const [printingMesa, setPrintingMesa] = useState('');
  
  // Estados para modales y flujos
  const [moveState, setMoveState] = useState(null);
  const [moveDestination, setMoveDestination] = useState('');
  const [reservationOpen, setReservationOpen] = useState(false);
  const [reservationForm, setReservationForm] = useState({ mesa: '', cliente_nombre: '', cliente_telefono: '', cantidad_personas: 2, horario_reserva: '', notas: '' });

  const canUseTpv = hasPermission('tpv.use');
  const canEdit = hasPermission('pedidos.edit');

  const cargar = async () => {
    setLoading(true);
    try {
      const [configData, pedidosData, reservasData] = await Promise.all([
        api.get('/configuracion'),
        api.get('/pedidos/activos'),
        api.get('/pedidos/mesas/reservas'),
      ]);
      setConfig(configData);
      setPedidos(pedidosData);
      setReservas(reservasData);
    } catch { toast.error('Error al cargar salón'); } finally { setLoading(false); }
  };

  useEffect(() => {
    cargar();
    socketManager.connect();
    const s1 = socketManager.on('nuevo_pedido', () => cargar());
    const s2 = socketManager.on('pedido_actualizado', () => cargar());
    return () => { s1(); s2(); socketManager.disconnect(); };
  }, []);

  const mesas = useMemo(() => {
    const configuradas = parseMesaNames(config);
    const activas = pedidos.filter(p => p.tipo_entrega === 'mesa' && p.mesa).map(p => String(p.mesa));
    const reservadas = reservas.filter(r => ['reservada', 'confirmada'].includes(r.estado)).map(r => String(r.mesa));
    return [...new Set([...configuradas, ...activas, ...reservadas])];
  }, [config, pedidos, reservas]);

  const ocupacion = useMemo(() => {
    const map = new Map();
    mesas.forEach(m => {
      const abiertos = pedidos.filter(p => p.tipo_entrega === 'mesa' && String(p.mesa) === m && p.estado !== 'entregado');
      const reserva = reservas.find(r => String(r.mesa) === m && ['reservada', 'confirmada'].includes(r.estado));
      map.set(m, { abiertos, reserva, total: abiertos.reduce((acc, p) => acc + Number(p.total), 0) });
    });
    return map;
  }, [mesas, pedidos, reservas]);

  const stats = useMemo(() => {
    const ocu = Array.from(ocupacion.values()).filter(v => v.abiertos.length > 0).length;
    return {
      total: mesas.length,
      libres: mesas.length - ocu,
      ocupadas: ocu,
      reservas: reservas.filter(r => ['reservada', 'confirmada'].includes(r.estado)).length,
      totalDinero: pedidos.filter(p => p.tipo_entrega === 'mesa' && p.estado !== 'entregado').reduce((acc, p) => acc + Number(p.total), 0)
    };
  }, [mesas, ocupacion, pedidos, reservas]);

  const abrirMesa = (mesa) => navigate(`/admin/tpv?tipo=mesa&mesa=${encodeURIComponent(mesa)}`);

  const handleEstado = async (pedido, estado) => {
    setUpdatingKey(`${pedido.id}:${estado}`);
    try {
      await api.put(`/pedidos/${pedido.id}/estado`, { estado });
      toast.success(estado === 'entregado' ? 'Mesa cerrada' : 'Actualizado');
      await cargar();
    } catch { toast.error('Error'); } finally { setUpdatingKey(''); }
  };

  const handleImprimir = async (mesa) => {
    setPrintingMesa(mesa);
    try {
      const res = await api.post(`/pedidos/mesa/${encodeURIComponent(mesa)}/precuenta`);
      const win = window.open('', '_blank');
      win.document.write(res.html);
      win.document.close();
      toast.success('Precuenta enviada a ticketera');
    } catch { toast.error('Error al imprimir'); } finally { setPrintingMesa(''); }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Header Modernize */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-1 bg-[#5D87FF] rounded-full"></div>
              <p className="text-sm font-black text-[#5D87FF] uppercase tracking-[0.3em]">Operación de Salón</p>
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Mesas y Comandas</h1>
            <p className="mt-1 text-gray-500 font-medium">Gestiona la ocupación y flujo de clientes en tiempo real.</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setReservationOpen(true)} className="flex h-12 items-center gap-2 rounded-2xl bg-white border border-gray-100 px-6 text-sm font-black text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all">
              <CalendarDays size={18} className="text-[#5D87FF]" strokeWidth={3} />
              NUEVA RESERVA
            </button>
            <button onClick={cargar} className="h-12 px-5 flex items-center justify-center rounded-2xl bg-gray-900 text-white shadow-lg shadow-gray-200 active:scale-95 transition-all">
              <RefreshCw size={18} strokeWidth={3} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Metricas de Salón */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
          <StatCard icon={Armchair} label="Mesas Totales" value={stats.total} tint="slate" />
          <StatCard icon={DoorOpen} label="Mesas Libres" value={stats.libres} tint="emerald" />
          <StatCard icon={CookingPot} label="En Servicio" value={stats.ocupadas} tint="blue" />
          <StatCard icon={Users} label="Reservas Hoy" value={stats.reservas} tint="amber" />
          <StatCard icon={Receipt} label="Total en Mesas" value={fmt(stats.totalDinero)} tint="blue" />
        </div>

        {/* Grid de Mesas Estilo Modernize */}
        <div className="rounded-[40px] bg-white p-8 shadow-sm border border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8">
            {mesas.map(mesa => {
              const info = ocupacion.get(mesa);
              const libre = info.abiertos.length === 0;
              const reservada = libre && info.reserva;
              
              return (
                <div key={mesa} className="flex flex-col items-center group">
                  <button
                    onClick={() => libre ? abrirMesa(mesa) : null}
                    className={`relative h-32 w-32 rounded-[40px] flex flex-col items-center justify-center transition-all duration-300 border-4 overflow-hidden group/btn ${
                      reservada 
                        ? 'bg-amber-50 border-amber-100 text-amber-600 shadow-lg shadow-amber-50' 
                        : libre 
                          ? 'bg-white border-gray-100 text-gray-300 hover:border-[#5D87FF] hover:text-[#5D87FF] hover:shadow-xl hover:-translate-y-1' 
                          : 'bg-[#5D87FF] border-[#5D87FF] text-white shadow-xl shadow-blue-100 scale-105'
                    }`}
                  >
                    {/* Imagen de fondo con overlay */}
                    <img 
                      src={tableImg} 
                      className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover/btn:scale-110 ${
                        libre && !reservada ? 'opacity-10 grayscale' : 'opacity-30'
                      }`} 
                      alt="" 
                    />
                    
                    <div className="relative z-10 flex flex-col items-center justify-center">
                      {!libre && (
                        <div className="absolute -top-10 -right-10 h-8 w-8 rounded-full bg-[#FA896B] text-white flex items-center justify-center font-black text-xs shadow-md border-2 border-white">
                          {info.abiertos.length}
                        </div>
                      )}
                      <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${libre && !reservada ? 'text-gray-400' : 'text-current opacity-80'}`}>Mesa</span>
                      <span className="text-3xl font-black">{mesa}</span>
                      {reservada && <CalendarDays size={16} className="mt-2 animate-bounce" />}
                      {!libre && <p className="mt-1 text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-lg backdrop-blur-sm">{fmt(info.total)}</p>}
                    </div>
                  </button>

                  <div className="mt-4 w-full space-y-3">
                    {/* Detalle de Pedidos si está ocupada */}
                    {info.abiertos.map(p => {
                      const meta = STATE_META[p.estado] || STATE_META.nuevo;
                      return (
                        <div key={p.id} className="rounded-2xl bg-gray-50 border border-gray-100 p-3 text-center">
                          <p className="text-[10px] font-black text-gray-400 mb-2">ORDEN #{p.numero}</p>
                          <div className={`inline-block px-3 py-1 rounded-lg text-[9px] font-black uppercase mb-3 ${meta.classes}`}>
                            {meta.label}
                          </div>
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => handleEstado(p, meta.next)} className="h-8 px-3 rounded-xl bg-white border border-gray-200 text-[9px] font-black hover:bg-[#5D87FF] hover:text-white transition-all">
                              {meta.nextLabel}
                            </button>
                            <button onClick={() => handleImprimir(mesa)} className="h-8 w-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#5D87FF]">
                              <Printer size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Botones para Reservas */}
                    {reservada && (
                      <div className="text-center">
                        <p className="text-[10px] font-black text-amber-600 uppercase mb-2 truncate px-2">{info.reserva.cliente_nombre}</p>
                        <button onClick={() => abrirMesa(mesa)} className="w-full py-2 rounded-xl bg-amber-500 text-white text-[10px] font-black shadow-lg shadow-amber-100 uppercase tracking-widest">
                          OCUPAR
                        </button>
                      </div>
                    )}

                    {libre && !reservada && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                        <span className="text-[10px] font-black text-[#5D87FF] uppercase tracking-widest">Libre</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Reserva (Modern) */}
      {reservationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={() => setReservationOpen(false)}>
          <div className="w-full max-w-xl rounded-[40px] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-1 bg-[#5D87FF] rounded-full"></div>
                  <p className="text-xs font-black text-[#5D87FF] uppercase tracking-[0.2em]">Agenda de Salón</p>
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Nueva Reserva</h3>
              </div>
              <button onClick={() => setReservationOpen(false)} className="rounded-full p-2 hover:bg-gray-100"><X size={24} /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mesa</label>
                <select value={reservationForm.mesa} onChange={e => setReservationForm({...reservationForm, mesa: e.target.value})} className="h-12 w-full rounded-2xl bg-gray-50 border-none px-4 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-[#5D87FF]/20">
                  <option value="">Elegir mesa...</option>
                  {mesas.map(m => <option key={m} value={m}>Mesa {m}</option>)}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Horario</label>
                <input type="datetime-local" value={reservationForm.horario_reserva} onChange={e => setReservationForm({...reservationForm, horario_reserva: e.target.value})} className="h-12 w-full rounded-2xl bg-gray-50 border-none px-4 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-[#5D87FF]/20" />
              </div>
              <input placeholder="Nombre del cliente" value={reservationForm.cliente_nombre} onChange={e => setReservationForm({...reservationForm, cliente_nombre: e.target.value})} className="h-12 w-full rounded-2xl bg-gray-50 border-none px-4 text-sm font-bold col-span-2 outline-none focus:ring-2 focus:ring-[#5D87FF]/20" />
              <input placeholder="Teléfono" value={reservationForm.cliente_telefono} onChange={e => setReservationForm({...reservationForm, cliente_telefono: e.target.value})} className="h-12 w-full rounded-2xl bg-gray-50 border-none px-4 text-sm font-bold col-span-2 sm:col-span-1 outline-none focus:ring-2 focus:ring-[#5D87FF]/20" />

              <input type="number" placeholder="Personas" value={reservationForm.cantidad_personas} onChange={e => setReservationForm({...reservationForm, cantidad_personas: e.target.value})} className="h-12 w-full rounded-2xl bg-gray-50 border-none px-4 text-sm font-bold col-span-2 sm:col-span-1 outline-none focus:ring-2 focus:ring-[#5D87FF]/20" />
              <textarea placeholder="Notas especiales..." value={reservationForm.notas} onChange={e => setReservationForm({...reservationForm, notas: e.target.value})} className="h-24 w-full rounded-2xl bg-gray-50 border-none px-4 py-3 text-sm font-bold col-span-2 resize-none outline-none focus:ring-2 focus:ring-[#5D87FF]/20" />
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => setReservationOpen(false)} className="flex-1 h-14 rounded-2xl border border-gray-200 text-xs font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 transition-all">CANCELAR</button>
              <button onClick={async () => { try { await api.post('/pedidos/mesas/reservas', reservationForm); toast.success('Reserva creada'); setReservationOpen(false); cargar(); } catch { toast.error('Error'); } }} className="flex-[2] h-14 rounded-2xl bg-gray-900 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-gray-200 active:scale-95 transition-all">CONFIRMAR RESERVA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
