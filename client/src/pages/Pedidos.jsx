import { useState, useEffect, useRef } from 'react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { 
  Bike, 
  Store, 
  Armchair, 
  X, 
  RefreshCw, 
  ChevronRight, 
  Printer, 
  History, 
  Clock, 
  Package, 
  CheckCircle2, 
  Truck, 
  MapPin, 
  DollarSign,
  AlertCircle,
  MoreVertical
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { socketManager } from '../lib/socket.js';
import {
  isPagoPagado,
  normalizeMetodoPago,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
} from '../lib/paymentStatus.js';
import { normalizePedidoItems } from '../lib/pedidoItems.js';
import { claimAlertKey, runDeliveredAlert, runOrderAlert, useOrderAlertPlayback } from '../lib/orderAlerts.js';

const COLS = [
  { estado: 'nuevo', label: 'Nuevos', icon: AlertCircle, color: '#5D87FF', bg: 'bg-[#ECF2FF]', text: 'text-[#5D87FF]' },
  { estado: 'confirmado', label: 'Confirmados', icon: CheckCircle2, color: '#13DEB9', bg: 'bg-[#E8F7FF]', text: 'text-[#49BEFF]' },
  { estado: 'preparando', label: 'Preparando', icon: Package, color: '#FFAE1F', bg: 'bg-[#FEF5E5]', text: 'text-[#FFAE1F]' },
  { estado: 'listo', icon: Package, label: 'Listos', color: '#13DEB9', bg: 'bg-[#E6FFFA]', text: 'text-[#13DEB9]' },
  { estado: 'en_camino', label: 'En camino', icon: Truck, color: '#5D87FF', bg: 'bg-[#ECF2FF]', text: 'text-[#5D87FF]' },
];

const SIMPLE_COLS = [
  { estado: 'nuevo', label: 'Nuevos', icon: AlertCircle, color: '#5D87FF', bg: 'bg-[#ECF2FF]', text: 'text-[#5D87FF]' },
  { estado: 'preparando', label: 'Preparando', icon: Package, color: '#FFAE1F', bg: 'bg-[#FEF5E5]', text: 'text-[#FFAE1F]' },
  { estado: 'en_camino', label: 'Enviados', icon: Truck, color: '#5D87FF', bg: 'bg-[#ECF2FF]', text: 'text-[#5D87FF]' },
];

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const iconoTipo = { 
  delivery: <Bike size={14} />, 
  retiro: <Store size={14} />, 
  mesa: <Armchair size={14} /> 
};
const PRINT_LABELS = {
  comanda_cocina: 'Comanda cocina',
  ticket_cliente: 'Ticket cliente',
  delivery_ticket: 'Hoja delivery',
};

function PedidoCard({
  pedido,
  onEstado,
  onPrint,
  printingKey,
  onHistory,
  onSyncPayment,
  onUpdatePayment,
  syncingPaymentKey,
  canPrint,
  canChangeState,
  resolveNextState,
  resolveNextLabel,
  canCancel,
  canManagePayment,
  simpleFlow,
}) {
  const items = normalizePedidoItems(pedido.items);
  const activeCols = simpleFlow ? SIMPLE_COLS : COLS;
  const nextState = resolveNextState(pedido);
  const baseNext = activeCols.find((c) => c.estado === nextState);
  const next = nextState
    ? { ...(baseNext || { estado: nextState }), label: resolveNextLabel(pedido, nextState) }
    : null;
  const printingComanda = printingKey === `${pedido.id}:comanda_cocina`;
  const printingTicket = printingKey === `${pedido.id}:ticket_cliente`;
  const syncingPayment = syncingPaymentKey === pedido.id;
  const pagoMetodo = normalizeMetodoPago(pedido.metodo_pago);
  const pagoCobrado = isPagoPagado(pedido.pago_estado);
  const paymentTone = paymentStatusTone(pedido.pago_estado);
  const paymentLabel = paymentStatusLabel(pedido.pago_estado);

  return (
    <div className="group relative rounded-[32px] border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:-translate-y-1">
      
                {/* Header: Número y hora */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#5D87FF] flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <span className="font-black text-sm">#{pedido.numero}</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Recibido</p>
            <p className="text-xs font-bold text-gray-700">{format(parseISO(pedido.creado_en), 'HH:mm')}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <div className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${pedido.tipo_entrega === 'delivery' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
            {pedido.tipo_entrega}
          </div>
        </div>
      </div>

      {/* ── Cliente y Mesa ── */}
      <div className="mb-4">
        <h4 className="text-sm font-black text-gray-900 truncate uppercase tracking-tight">
          {pedido.cliente_nombre || 'Consumidor Final'}
        </h4>
        {pedido.mesa && (
          <div className="mt-1 flex items-center gap-1.5 text-[#5D87FF]">
            <Armchair size={12} className="stroke-[3]" />
            <span className="text-[11px] font-black uppercase">Mesa {pedido.mesa}</span>
          </div>
        )}
        {pedido.tipo_entrega === 'delivery' && pedido.cliente_direccion && (
          <div className="mt-1 flex items-center gap-1.5 text-gray-400">
            <MapPin size={12} />
            <span className="text-[10px] font-medium truncate">{pedido.cliente_direccion}</span>
          </div>
        )}
        {pedido.tipo_entrega === 'delivery' && pedido.entrega_pin ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#5D87FF]">
            <span>PIN delivery</span>
            <span className="font-mono text-xs tracking-[0.2em] text-gray-900">{pedido.entrega_pin}</span>
          </div>
        ) : null}
      </div>

      {/* ── Items: Estilo Checklist ── */}
      <div className="mb-5 space-y-2 rounded-2xl bg-[#F4F7FB] p-3 border border-blue-50/50">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-[#5D87FF] shrink-0" />
            <p className="text-[11px] font-bold text-gray-600 leading-tight">
              <span className="text-[#5D87FF] font-black mr-1">{item.cantidad}x</span> 
              {item.nombre}
              {item.descripcion && <span className="block text-[9px] font-medium text-gray-400 italic mt-0.5">{item.descripcion}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* ── Pagos y Notas ── */}
      <div className="mb-5 flex flex-wrap gap-2">
        <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${paymentTone}`}>
          <DollarSign size={10} className="stroke-[3]" />
          {paymentMethodLabel(pagoMetodo)} · {paymentLabel}
        </div>
        {pedido.notas && (
          <div className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase text-rose-600">
            <AlertCircle size={10} className="stroke-[3]" />
            Ver Notas
          </div>
        )}
      </div>

      {/* ── Footer: Total y Acciones ── */}
      <div className="mt-auto flex items-center justify-between gap-4 border-t border-gray-50 pt-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total</p>
          <p className="text-lg font-black text-gray-900">{fmt(pedido.total)}</p>
        </div>
        
        <div className="flex flex-wrap justify-end gap-2">
          {canManagePayment && !pagoCobrado && pagoMetodo !== 'mercadopago' ? (
            <button
              onClick={() => onUpdatePayment(pedido.id, 'pagado')}
              disabled={syncingPayment}
              className="flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-600 disabled:opacity-60"
            >
              <DollarSign size={14} className="stroke-[3]" />
              {syncingPayment ? 'Guardando...' : 'Marcar cobrado'}
            </button>
          ) : null}
          {pagoMetodo === 'mercadopago' && !pagoCobrado ? (
            <button
              onClick={() => onSyncPayment(pedido.id)}
              disabled={syncingPayment}
              className="flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-4 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-amber-100 transition-all hover:bg-amber-600 disabled:opacity-60"
            >
              <RefreshCw size={14} className={syncingPayment ? 'animate-spin' : 'stroke-[3]'} />
              {syncingPayment ? 'Revisando...' : 'Revisar pago'}
            </button>
          ) : null}
          {canPrint && (
            <button 
              onClick={() => onPrint(pedido.id, 'ticket_cliente')}
              className="h-10 w-10 rounded-xl border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#5D87FF] hover:bg-blue-50 transition-all shadow-sm"
            >
              <Printer size={18} />
            </button>
          )}
          {next && canChangeState(next.estado) && (
            <button
              onClick={() => onEstado(pedido.id, next.estado)}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#5D87FF] px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-blue-100 hover:bg-[#4570EA] active:scale-95 transition-all"
            >
              {next.label}
              <ChevronRight size={14} className="stroke-[3]" />
            </button>
          )}
          {simpleFlow && pedido.estado === 'en_camino' && canChangeState('entregado') && (
            <button
              onClick={() => onEstado(pedido.id, 'entregado')}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#13DEB9] px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-100 hover:bg-[#0EB795] active:scale-95 transition-all"
            >
              Entregado
            </button>
          )}
          {pedido.estado === 'listo' && canChangeState('entregado') && (
            <button
              onClick={() => onEstado(pedido.id, 'entregado')}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#13DEB9] px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-100 hover:bg-[#0EB795] active:scale-95 transition-all"
            >
              Entregar
            </button>
          )}
        </div>
      </div>

                            {/* Botón de cancelar flotante sutil */}
      {canCancel && (
        <button
          onClick={() => onEstado(pedido.id, 'cancelado')}
          className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center text-gray-200 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export default function Pedidos() {
  const { hasPermission, isAuth, token } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printingKey, setPrintingKey] = useState('');
  const [syncingPaymentKey, setSyncingPaymentKey] = useState(null);
  const [historyModal, setHistoryModal] = useState({ open: false, pedido: null, loading: false, rows: [] });
  const configRef = useRef({});
  const deliveredSeenRef = useRef(new Set());
  const deliveryPollSeenRef = useRef(new Set());
  const [configSnapshot, setConfigSnapshot] = useState({});
  const { audioContextRef, voiceRef, fallbackAudioRef } = useOrderAlertPlayback();
  const canEdit = hasPermission('pedidos.edit');
  const canKitchen = hasPermission('pedidos.kitchen');
  const canPrint = hasPermission('pedidos.print');
  const simpleFlow = String(configSnapshot?.modulo_kds_activo ?? '1') === '0';

  const getNextState = (pedido) => {
    if (simpleFlow) {
      if (pedido.estado === 'nuevo') return 'preparando';
      if (pedido.estado === 'preparando') return pedido.tipo_entrega === 'delivery' ? 'en_camino' : 'entregado';
      return null;
    }

    if (pedido.estado === 'nuevo') return 'confirmado';
    if (pedido.estado === 'confirmado') return 'preparando';
    if (pedido.estado === 'preparando') return 'listo';
    if (pedido.estado === 'listo') return pedido.tipo_entrega === 'delivery' ? 'en_camino' : 'entregado';
    if (pedido.estado === 'en_camino') return 'entregado';
    return null;
  };

  const getNextActionLabel = (pedido, nextState) => {
    if (!nextState) return '';
    if (simpleFlow) {
      if (pedido.estado === 'nuevo' && nextState === 'preparando') return 'Aceptar';
      if (pedido.estado === 'preparando' && nextState === 'en_camino') return 'Enviar';
      if (pedido.estado === 'preparando' && nextState === 'entregado') return 'Entregar';
    }
    return (nextState || '').replace('_', ' ');
  };

  const canChangeState = (pedido, nextState) => {
    if (canEdit) return true;
    if (simpleFlow) {
      if (canKitchen) {
        if (pedido.estado === 'nuevo' && nextState === 'preparando') return true;
        if (pedido.estado === 'preparando' && pedido.tipo_entrega === 'delivery' && nextState === 'en_camino') return true;
        if (pedido.estado === 'preparando' && pedido.tipo_entrega !== 'delivery' && nextState === 'entregado') return true;
        if (pedido.estado === 'en_camino' && nextState === 'entregado') return true;
      }
      if (hasPermission('delivery.manage')) {
        if (pedido.tipo_entrega !== 'delivery') return false;
        if (pedido.estado === 'preparando' && nextState === 'en_camino') return true;
        if (pedido.estado === 'en_camino' && nextState === 'entregado') return true;
      }
      return false;
    }

    if (canKitchen) {
      if (pedido.estado === 'confirmado' && nextState === 'preparando') return true;
      if (pedido.estado === 'preparando' && nextState === 'listo') return true;
      if (pedido.estado === 'listo' && pedido.tipo_entrega === 'delivery' && nextState === 'en_camino') return true;
      if (pedido.estado === 'listo' && pedido.tipo_entrega !== 'delivery' && nextState === 'entregado') return true;
    }
    if (hasPermission('delivery.manage')) {
      return pedido.tipo_entrega === 'delivery' && pedido.estado === 'en_camino' && nextState === 'entregado';
    }
    return false;
  };

  const cargar = () => {
    setLoading(true);
    api.get('/pedidos/activos').then((data) => {
      setPedidos(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const imprimirDocumentosPedidoWeb = async (pedido) => {
    await imprimir(pedido.id, 'comanda_cocina', { auto: true, silent: true });
    await imprimir(pedido.id, 'ticket_cliente', { auto: true, silent: true });
    if (pedido.tipo_entrega === 'delivery') {
      await imprimir(pedido.id, 'delivery_ticket', { auto: true, silent: true });
    }
  };

  const imprimirEnIframe = (html) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1200);
    }, 250);
  };

  useEffect(() => {
    api.get('/configuracion').then((data) => {
      configRef.current = data;
      setConfigSnapshot(data || {});
    }).catch(() => {});

    cargar();
    
    if (isAuth && token) {
      socketManager.retainAuthenticated(token).catch(() => {
        socketManager.connect();
      });
    } else {
      socketManager.connect();
    }
    const unsubscribeNuevo = socketManager.on('nuevo_pedido', (p) => {
      const remoteOrder = p.origen === 'web';
      setPedidos((prev) => [p, ...prev]);
      if (claimAlertKey(`nuevo:${p.id}`)) {
        runOrderAlert({
          pedido: p,
          config: configRef.current || {},
          audioContextRef,
          voiceRef,
          fallbackAudioRef,
        }).catch(() => {});
      }
      toast.success(`Nuevo pedido #${p.numero}`);
      if (remoteOrder && configRef.current.impresion_auto_web === '1' && canPrint) {
        imprimirDocumentosPedidoWeb(p).catch(() => {});
      }
    });
    const handlePedidoActualizado = async (p) => {
      if (p?.estado !== 'entregado') {
        deliveredSeenRef.current.delete(p.id);
      }
      if (p?.estado === 'entregado' && !deliveredSeenRef.current.has(p.id)) {
        if (!claimAlertKey(`entregado:${p.id}`)) {
          deliveredSeenRef.current.add(p.id);
          setPedidos((prev) => {
            const next = prev.filter((item) => item.id !== p.id);
            if (['nuevo', 'confirmado', 'preparando', 'listo', 'en_camino'].includes(p.estado)) return [...next, p];
            return next;
          });
          return;
        }
        deliveredSeenRef.current.add(p.id);
        try {
          await runDeliveredAlert({
            pedido: p,
            audioContextRef,
            voiceRef,
            fallbackAudioRef,
            scope: 'admin',
          });
        } catch {}
        toast.success(`Se entrego el pedido #${p.numero || p.id}`);
      }
      setPedidos((prev) => {
        const next = prev.filter((item) => item.id !== p.id);
        if (['nuevo', 'confirmado', 'preparando', 'listo', 'en_camino'].includes(p.estado)) return [...next, p];
        return next;
      });
    };
    const unsubscribeUpdate = socketManager.on('pedido_actualizado', handlePedidoActualizado);
    const unsubscribeAdminUpdate = socketManager.on('pedido_actualizado_admin', handlePedidoActualizado);
    
    return () => {
      unsubscribeNuevo();
      unsubscribeUpdate();
      unsubscribeAdminUpdate();
      if (isAuth && token) {
        socketManager.releaseAuthenticated();
      } else {
        socketManager.disconnect();
      }
    };
  }, [audioContextRef, canPrint, fallbackAudioRef, isAuth, token, voiceRef]);

  useEffect(() => {
    let cancelled = false;

    const revisarEntregadosRecientes = async () => {
      try {
        const rows = await api.get('/pedidos?limit=20');
        if (cancelled || !Array.isArray(rows)) return;

        const recentDelivered = rows.filter((pedido) => {
          if (String(pedido?.estado || '') !== 'entregado') return false;
          const updatedAt = new Date(pedido?.actualizado_en || pedido?.creado_en || 0).getTime();
          return Number.isFinite(updatedAt) && (Date.now() - updatedAt) <= 90 * 1000;
        });

        for (const pedido of recentDelivered) {
          if (deliveryPollSeenRef.current.has(pedido.id)) continue;
          if (!claimAlertKey(`entregado:${pedido.id}`)) continue;
          deliveryPollSeenRef.current.add(pedido.id);
          deliveredSeenRef.current.add(pedido.id);
          try {
            await runDeliveredAlert({
              pedido,
              audioContextRef,
              voiceRef,
              fallbackAudioRef,
              scope: 'admin',
            });
          } catch {}
          toast.success(`Se entrego el pedido #${pedido.numero || pedido.id}`);
        }

        if (deliveryPollSeenRef.current.size > 120) {
          const trimmed = [...deliveryPollSeenRef.current].slice(-80);
          deliveryPollSeenRef.current = new Set(trimmed);
        }
      } catch {}
    };

    revisarEntregadosRecientes();
    const timer = window.setInterval(revisarEntregadosRecientes, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [audioContextRef, fallbackAudioRef, voiceRef]);

  const cambiarEstado = async (id, estado) => {
    toast.dismiss();
    try {
      const updated = await api.put(`/pedidos/${id}/estado`, { estado });
      if (estado === 'entregado' || estado === 'cancelado') {
        setPedidos((prev) => prev.filter((p) => p.id !== id));
        toast.success(estado === 'entregado' ? 'Pedido entregado' : 'Pedido cancelado');
      } else {
        setPedidos((prev) => prev.map((p) => p.id === id ? updated : p));
        if (estado === 'preparando') toast.success('Pedido aceptado y en preparación');
        if (estado === 'en_camino') toast.success('Pedido marcado como enviado');
      }
    } catch (error) {
      toast.error(error?.error || 'Error al actualizar');
    }
  };

  const imprimir = async (id, tipo, options = {}) => {
    const { auto = false, silent = false } = options;
    let popup = null;
    if (!auto) {
      popup = window.open('', '_blank', 'width=900,height=700');
      if (!popup) {
        toast.error('Permiti las ventanas emergentes para imprimir');
        return;
      }
      popup.document.write('<p style="font-family: Arial, sans-serif; padding: 24px;">Preparando impresion...</p>');
      popup.document.close();
    }

    setPrintingKey(`${id}:${tipo}`);

    try {
      const response = await api.post(`/pedidos/${id}/imprimir`, { tipo });
      if (auto) {
        imprimirEnIframe(response.html);
      } else {
        popup.document.open();
        popup.document.write(response.html);
        popup.document.close();
      }
      if (!silent) {
        toast.success(`${PRINT_LABELS[tipo] || 'Documento'} listo`);
      }
    } catch {
      if (popup) popup.close();
      if (!silent) toast.error('No se pudo generar la impresion');
    } finally {
      setPrintingKey('');
    }
  };

  const sincronizarPago = async (pedidoId) => {
    setSyncingPaymentKey(pedidoId);
    try {
      const result = await api.post(`/pedidos/${pedidoId}/pago/mercadopago/sync`);
      if (result?.pedido) {
        setPedidos((prev) => prev.map((pedido) => (pedido.id === pedidoId ? result.pedido : pedido)));
      }
      toast.success(result?.message || 'Pago sincronizado');
    } catch (error) {
      toast.error(error?.error || 'No se pudo revisar el pago');
    } finally {
      setSyncingPaymentKey(null);
    }
  };

  const actualizarPago = async (pedidoId, pagoEstado) => {
    setSyncingPaymentKey(pedidoId);
    try {
      const result = await api.put(`/pedidos/${pedidoId}/pago`, { pago_estado: pagoEstado });
      setPedidos((prev) => prev.map((pedido) => (pedido.id === pedidoId ? result : pedido)));
      toast.success(pagoEstado === 'pagado' ? 'Cobro registrado' : 'Estado de pago actualizado');
    } catch (error) {
      toast.error(error?.error || 'No se pudo actualizar el cobro');
    } finally {
      setSyncingPaymentKey(null);
    }
  };

  const abrirHistorial = async (pedido) => {
    setHistoryModal({ open: true, pedido, loading: true, rows: [] });
    try {
      const rows = await api.get(`/pedidos/${pedido.id}/impresiones`);
      setHistoryModal({ open: true, pedido, loading: false, rows });
    } catch {
      setHistoryModal({ open: true, pedido, loading: false, rows: [] });
      toast.error('No se pudo cargar el historial');
    }
  };

  const cerrarHistorial = () => {
    setHistoryModal({ open: false, pedido: null, loading: false, rows: [] });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-[#F4F7FB] px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-shrink-0 items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-1 bg-[#5D87FF] rounded-full"></div>
            <p className="text-sm font-black text-[#5D87FF] uppercase tracking-[0.3em]">Logística de Ventas</p>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Gestión de Pedidos</h1>
          <p className="text-gray-500 mt-1 font-medium">{pedidos.length} pedidos activos en curso</p>
        </div>
        <button 
          onClick={cargar} 
          className="flex h-12 items-center gap-2 rounded-2xl bg-white border border-gray-100 px-6 text-sm font-black text-gray-700 shadow-sm hover:bg-gray-50 transition-all active:scale-95"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin text-[#5D87FF]' : 'text-[#5D87FF]'} strokeWidth={3} /> 
          Sincronizar
        </button>
      </div>

      {/* Columnas Kanban */}
      <div className="flex flex-1 gap-6 overflow-x-auto pb-4 no-scrollbar">
        {(simpleFlow ? SIMPLE_COLS : COLS).map((col) => {
          const colPedidos = pedidos.filter((p) => p.estado === col.estado);
          const IconCol = col.icon;
          return (
            <div key={col.estado} className="flex w-[340px] flex-shrink-0 flex-col">
              {/* Header de columna */}
              <div className={`mb-6 flex items-center gap-3 rounded-[24px] px-5 py-4 ${col.bg} border border-white/50 shadow-sm`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ${col.text}`}>
                  <IconCol size={20} strokeWidth={3} />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400 block leading-none mb-1">Estado</span>
                  <span className="text-sm font-black text-gray-800 uppercase tracking-tight">{col.label}</span>
                </div>
                <div className={`ml-auto h-8 w-8 rounded-full bg-white flex items-center justify-center text-xs font-black shadow-sm ${col.text}`}>
                  {colPedidos.length}
                </div>
              </div>
              
              {/* Cards */}
              <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-4 no-scrollbar">
                {colPedidos.length === 0 ? (
                  <div className="rounded-[32px] border-2 border-dashed border-gray-200 py-16 text-center bg-white/50">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <Package size={24} className="text-gray-200" />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Sin pedidos pendientes</p>
                  </div>
                ) : null}
                {colPedidos.map((p) => (
                  <PedidoCard
                    key={p.id}
                    pedido={p}
                    onEstado={cambiarEstado}
                    onPrint={imprimir}
                    printingKey={printingKey}
                    onHistory={abrirHistorial}
                    onSyncPayment={sincronizarPago}
                    onUpdatePayment={actualizarPago}
                    syncingPaymentKey={syncingPaymentKey}
                    canPrint={canPrint}
                    canChangeState={(nextState) => canChangeState(p, nextState)}
                    resolveNextState={getNextState}
                    resolveNextLabel={getNextActionLabel}
                    canCancel={canEdit}
                    canManagePayment={canEdit}
                    simpleFlow={simpleFlow}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Historial Moderno */}
      {historyModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={cerrarHistorial}>
          <div className="w-full max-w-xl rounded-[40px] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-1 bg-[#5D87FF] rounded-full"></div>
                  <p className="text-xs font-black text-[#5D87FF] uppercase tracking-[0.2em]">Log de Eventos</p>
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                  Pedido #{historyModal.pedido?.numero}
                </h3>
              </div>
              <button onClick={cerrarHistorial} className="rounded-full p-2 hover:bg-gray-100 transition-colors">
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto pr-2 no-scrollbar">
              {historyModal.loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#5D87FF] border-t-transparent" />
                </div>
              ) : historyModal.rows.length === 0 ? (
                <div className="text-center py-12">
                  <Printer size={48} className="mx-auto text-gray-100 mb-4" />
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Sin actividad registrada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyModal.rows.map((row) => (
                    <div key={row.id} className="flex items-center gap-4 rounded-[24px] bg-gray-50 p-4 border border-gray-100">
                      <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center text-[#5D87FF] shadow-sm">
                        <Printer size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-gray-800 uppercase tracking-tight">
                          {PRINT_LABELS[row.tipo] || 'Documento'}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {format(parseISO(row.creado_en), 'dd MMM · HH:mm')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest ${row.estado === 'impreso' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {row.estado}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={cerrarHistorial}
              className="mt-8 w-full rounded-2xl bg-gray-900 py-4 text-sm font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-gray-200 hover:bg-gray-800 transition-all active:scale-[0.98]"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
