import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  CheckCircle2, 
  ChefHat, 
  Clock3, 
  Maximize, 
  Minimize, 
  PackageCheck, 
  RefreshCw, 
  UtensilsCrossed, 
  Volume2, 
  VolumeX,
  AlertCircle,
  Timer,
  ChevronRight,
  Flame
} from 'lucide-react';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAppConfig } from '../context/AppConfigContext.jsx';
import { socketManager } from '../lib/socket.js';
import { normalizePedidoItems } from '../lib/pedidoItems.js';
import { claimAlertKey, runOrderAlert, useOrderAlertPlayback } from '../lib/orderAlerts.js';

const COLS = [
  { estado: 'confirmado', label: 'Por Preparar', icon: Clock3, bg: 'bg-[#ECF2FF]', text: 'text-[#5D87FF]', border: 'border-[#5D87FF]/20' },
  { estado: 'preparando', label: 'En Cocina', icon: ChefHat, bg: 'bg-[#FEF5E5]', text: 'text-[#FFAE1F]', border: 'border-[#FFAE1F]/20' },
  { estado: 'listo', label: 'Despachado', icon: PackageCheck, bg: 'bg-[#E6FFFA]', text: 'text-[#13DEB9]', border: 'border-[#13DEB9]/20' },
];

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

function minutesElapsed(fecha) {
  if (!fecha) return 0;
  try {
    return Math.max(0, Math.floor((Date.now() - parseISO(fecha).getTime()) / 60000));
  } catch {
    return 0;
  }
}

function urgencyStyle(pedido) {
  const mins = minutesElapsed(pedido.creado_en);
  if (pedido.estado === 'listo') return 'border-emerald-100 bg-white';
  if (mins >= 35) return 'border-rose-200 bg-rose-50/30 ring-4 ring-rose-50';
  if (mins >= 20) return 'border-amber-200 bg-amber-50/30';
  return 'border-gray-100 bg-white';
}

function PedidoKitchenCard({ pedido, onEstado, updatingId, canAct }) {
  const items = useMemo(() => normalizePedidoItems(pedido.items), [pedido.items]);

  const mins = minutesElapsed(pedido.creado_en);
  const isDelayed = mins >= 20;
  const isUrgent = mins >= 35;

  const nextAction = pedido.estado === 'confirmado'
    ? { estado: 'preparando', label: 'COMENZAR', icon: Flame, color: 'bg-[#5D87FF]' }
    : pedido.estado === 'preparando'
      ? { estado: 'listo', label: 'MARCAR LISTO', icon: CheckCircle2, color: 'bg-[#13DEB9]' }
      : null;

  return (
    <article className={`relative flex flex-col rounded-[32px] border p-5 shadow-sm transition-all duration-300 hover:shadow-xl ${urgencyStyle(pedido)}`}>
      
      {/* Header de la Tarjeta */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${isUrgent ? 'bg-rose-500 text-white shadow-rose-200' : 'bg-gray-900 text-white'}`}>
            #{pedido.numero}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Entrega</p>
            <p className="text-xs font-bold text-gray-700 uppercase">{pedido.tipo_entrega} {pedido.mesa ? ` - MESA ${pedido.mesa}` : ''}</p>
          </div>
        </div>
        
        <div className={`flex flex-col items-end ${isUrgent ? 'text-rose-600' : isDelayed ? 'text-amber-600' : 'text-gray-400'}`}>
          <div className="flex items-center gap-1">
            <Timer size={14} strokeWidth={3} />
            <span className="text-sm font-black">{mins}m</span>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-tighter">Transcurrido</p>
        </div>
      </div>

      {/* Info Cliente/Notas */}
      <div className="mb-4 rounded-2xl bg-gray-50/50 p-3 border border-gray-100/50">
        <p className="text-xs font-black text-gray-800 uppercase truncate">{pedido.cliente_nombre || 'Pedido Mostrador'}</p>
        {pedido.notas && (
          <div className="mt-2 flex items-start gap-2 text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-100">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold leading-tight uppercase italic">{pedido.notas}</p>
          </div>
        )}
      </div>

      {/* Lista de Items - MAXIMA VISIBILIDAD */}
      <div className="flex-1 space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-[20px] bg-white border border-gray-100 p-3 shadow-sm flex gap-4 items-center">
            <div className="h-10 w-10 rounded-xl bg-gray-900 text-white flex items-center justify-center font-black text-lg shrink-0">
              {item.cantidad}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-gray-900 leading-tight uppercase tracking-tight">
                {item.nombre}
              </p>
              {Object.keys(item.variantes || {}).length > 0 && (
                <p className="mt-1 text-[10px] font-bold text-[#5D87FF] uppercase">
                  {Object.entries(item.variantes).map(([k, v]) => `${v?.nombre || v}`).join(' - ')}
                </p>
              )}
              {item.extras?.length > 0 && (
                <p className="mt-0.5 text-[9px] font-black text-emerald-600 uppercase italic">
                  + {item.extras.map(e => e.nombre).join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Botones de Accion Tactiles */}
      <div className="mt-6 flex gap-2">
        {nextAction && canAct && (
          <button
            onClick={() => onEstado(pedido.id, nextAction.estado)}
            disabled={updatingId === pedido.id}
            className={`flex flex-[3] items-center justify-center gap-3 h-14 rounded-2xl text-sm font-black text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 ${nextAction.color} ${nextAction.estado === 'listo' ? 'shadow-emerald-100' : 'shadow-blue-100'}`}
          >
            <nextAction.icon size={20} strokeWidth={3} />
            {updatingId === pedido.id ? '...' : nextAction.label}
          </button>
        )}
        
        {pedido.estado === 'listo' && canAct && (
          <button
            onClick={() => onEstado(pedido.id, pedido.tipo_entrega === 'delivery' ? 'en_camino' : 'entregado')}
            disabled={updatingId === pedido.id}
            className="flex flex-[3] items-center justify-center gap-3 h-14 rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <ChevronRight size={20} strokeWidth={3} />
            {pedido.tipo_entrega === 'delivery' ? 'A REPARTO' : 'ENTREGAR'}
          </button>
        )}

        {canAct && (
          <button
            onClick={() => {/* Popup mas opciones */}}
            className="flex flex-1 items-center justify-center h-14 rounded-2xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-all active:scale-95"
          >
            <UtensilsCrossed size={20} />
          </button>
        )}
      </div>
    </article>
  );
}

export default function KDS() {
  const { hasPermission } = useAuth();
  const { config } = useAppConfig();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filtroEntrega, setFiltroEntrega] = useState('todos');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [, forceTick] = useState(0);
  const { audioContextRef, voiceRef, fallbackAudioRef } = useOrderAlertPlayback();
  const canAct = hasPermission('pedidos.kitchen') || hasPermission('pedidos.edit');

  const cargar = async () => {
    try {
      setLoading(true);
      const data = await api.get('/pedidos/activos');
      setPedidos(data.filter((pedido) => ['confirmado', 'preparando', 'listo'].includes(pedido.estado)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);

    cargar();
    const timer = setInterval(() => forceTick((n) => n + 1), 15000); // Actualizar cada 15s para el reloj
    
    socketManager.connect();
    const unsubscribeNuevo = socketManager.on('nuevo_pedido', (pedido) => {
      if (['confirmado', 'preparando', 'listo'].includes(pedido.estado)) {
        setPedidos((prev) => [pedido, ...prev.filter((item) => item.id !== pedido.id)]);
        toast.success(`Pedido #${pedido.numero} en Cocina`, { icon: '🍳' });
        if (soundEnabled && claimAlertKey(`nuevo:${pedido.id}`)) {
          runOrderAlert({
            pedido,
            config,
            audioContextRef,
            voiceRef,
            fallbackAudioRef,
          }).catch(() => {});
        }
      }
    });
    const unsubscribeUpdate = socketManager.on('pedido_actualizado', (pedido) => {
      setPedidos((prev) => {
        const next = prev.filter((item) => item.id !== pedido.id);
        if (['confirmado', 'preparando', 'listo'].includes(pedido.estado)) {
          return [...next, pedido].sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
        }
        return next;
      });
    });
    
    return () => {
      clearInterval(timer);
      unsubscribeNuevo();
      unsubscribeUpdate();
      socketManager.disconnect();
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [audioContextRef, config, fallbackAudioRef, soundEnabled, voiceRef]);

  const cambiarEstado = async (id, estado) => {
    setUpdatingId(id);
    try {
      const updated = await api.put(`/pedidos/${id}/estado`, { estado });
      setPedidos((prev) => {
        const next = prev.filter((item) => item.id !== id);
        if (['confirmado', 'preparando', 'listo'].includes(updated.estado)) return [...next, updated];
        return next;
      });
    } catch {
      toast.error('Fallo la actualizacion');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] px-4 py-6 sm:px-6 lg:px-8">
      
      {/* Toolbar Superior Moderna */}
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#5D87FF] flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <ChefHat size={24} strokeWidth={3} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Monitor de Cocina</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">En línea · Tiempo real</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-white rounded-2xl shadow-sm border border-gray-100">
            {['todos', 'delivery', 'retiro', 'mesa'].map((f) => (
              <button
                key={f}
                onClick={() => setFiltroEntrega(f)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filtroEntrega === f ? 'bg-[#5D87FF] text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className={`h-11 w-11 flex items-center justify-center rounded-2xl bg-white border border-gray-100 transition-all ${soundEnabled ? 'text-emerald-500' : 'text-rose-400'}`}>
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button onClick={toggleFullscreen} className="h-11 w-11 flex items-center justify-center rounded-2xl bg-white border border-gray-100 text-gray-400">
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button onClick={cargar} className="h-11 px-5 flex items-center gap-2 rounded-2xl bg-gray-900 text-white text-xs font-black shadow-lg shadow-gray-200 active:scale-95 transition-all">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            ACTUALIZAR
          </button>
        </div>
      </div>

      {/* Grid de Columnas Kanban */}
      <div className="grid gap-6 xl:grid-cols-3">
        {COLS.map((col) => {
          const Icon = col.icon;
          const rows = pedidos
            .filter((p) => p.estado === col.estado)
            .filter((p) => filtroEntrega === 'todos' || p.tipo_entrega === filtroEntrega)
            .sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));

          return (
            <section key={col.estado} className="flex flex-col min-h-[70vh]">
              {/* Header Columna */}
              <div className={`mb-6 flex items-center gap-3 rounded-[24px] px-5 py-4 ${col.bg} border ${col.border} shadow-sm`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ${col.text}`}>
                  <Icon size={20} strokeWidth={3} />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400 block leading-none mb-1">Status</span>
                  <span className={`text-sm font-black uppercase tracking-tight ${col.text}`}>{col.label}</span>
                </div>
                <div className={`ml-auto h-8 w-8 rounded-full bg-white flex items-center justify-center text-xs font-black shadow-sm ${col.text}`}>
                  {rows.length}
                </div>
              </div>

              {/* Lista de Pedidos */}
              <div className="space-y-6">
                {rows.length === 0 ? (
                  <div className="rounded-[32px] border-2 border-dashed border-gray-200 py-20 text-center bg-white/50">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <UtensilsCrossed size={24} className="text-gray-200" />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sin tareas pendientes</p>
                  </div>
                ) : (
                  rows.map((p) => (
                    <PedidoKitchenCard
                      key={p.id}
                      pedido={p}
                      onEstado={cambiarEstado}
                      updatingId={updatingId}
                      canAct={canAct}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}


