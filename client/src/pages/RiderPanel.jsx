import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import {
  Truck, 
  MapPin, 
  Phone, 
  Navigation, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  RefreshCw, 
  Package, 
  ChevronRight,
  User,
  ShoppingBag,
  ExternalLink,
  Smartphone,
  Check,
  X
} from 'lucide-react';
import { paymentMethodLabel, paymentStatusLabel, paymentStatusTone } from '../lib/paymentStatus.js';
import { normalizePedidoItems } from '../lib/pedidoItems.js';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { socketManager } from '../lib/socket.js';
import { runDeliveredAlert, useOrderAlertPlayback } from '../lib/orderAlerts.js';

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

export default function RiderPanel() {
  const params = useParams();
  const [riderAuth, setRiderAuth] = useState(() => {
    const id = localStorage.getItem('ms_rider_id');
    const code = localStorage.getItem('ms_rider_code');
    return id && code ? { id, code } : null;
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [loginForm, setLoginForm] = useState({ id: '', code: '' });
  const watchIdRef = useRef(null);
  const deliveredSeenRef = useRef(new Set());
  const { audioContextRef, voiceRef, fallbackAudioRef } = useOrderAlertPlayback();
  const selectedItems = normalizePedidoItems(selectedPedido?.items);

  useEffect(() => {
    const routeId = String(params?.id || '').trim();
    const routeCode = String(params?.codigo || '').trim();
    if (!routeId || !routeCode) return;

    const nextAuth = { id: routeId, code: routeCode };
    localStorage.setItem('ms_rider_id', routeId);
    localStorage.setItem('ms_rider_code', routeCode);
    setLoginForm(nextAuth);
    setRiderAuth((prev) => {
      if (prev?.id === routeId && prev?.code === routeCode) return prev;
      return nextAuth;
    });
  }, [params?.codigo, params?.id]);

  // Cargar datos (pedidos y settings)
  const fetchData = async () => {
    if (!riderAuth) return;
    setLoading(true);
    try {
      const res = await api.get(`/repartidores/${riderAuth.id}/rider/${riderAuth.code}`);
      setData(res);
      // Si habia un pedido seleccionado, actualizarlo
      if (selectedPedido) {
        const updated = res.pedidos.find(p => p.id === selectedPedido.id);
        setSelectedPedido(updated || null);
      }
    } catch (err) {
      toast.error('Error de acceso. Revisa tus credenciales.');
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Configurar Sockets
    if (riderAuth) {
      socketManager.connect();
      socketManager.joinRider(riderAuth.id, riderAuth.code).catch(() => {});
      
      const unsub = socketManager.on('pedido_actualizado', async (pedido) => {
        if (pedido?.estado === 'entregado' && !deliveredSeenRef.current.has(pedido.id)) {
          deliveredSeenRef.current.add(pedido.id);
          try {
            await runDeliveredAlert({
              pedido,
              audioContextRef,
              voiceRef,
              fallbackAudioRef,
              scope: 'rider',
            });
          } catch {}
          toast.success(`Pedido #${pedido.numero || pedido.id} entregado`);
        } else {
          toast('Actualizacion de pedido recibida', { icon: '🔔' });
        }
        fetchData(); // Recargar todo cuando hay cambios
      });

      return () => {
        unsub();
        socketManager.disconnect();
      };
    }
  }, [audioContextRef, fallbackAudioRef, riderAuth, voiceRef]);

  // Manejo de Ubicacion
  useEffect(() => {
    const activeOrder = data?.pedidos?.find(p => p.estado === 'en_camino');
    if (activeOrder && !watchIdRef.current) {
      startTracking(activeOrder.id);
    } else if (!activeOrder && watchIdRef.current) {
      stopTracking();
    }
  }, [data]);

  const startTracking = (pedidoId) => {
    if (!navigator.geolocation) return;
    setTrackingActive(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, speed } = pos.coords;
        api.put(`/repartidores/${riderAuth.id}/rider/${riderAuth.code}/ubicacion`, {
          latitud: latitude,
          longitud: longitude,
          precision: accuracy,
          velocidad: speed,
          pedidoId
        }).catch(() => {});
      },
      (err) => console.error('Geo error', err),
      { enableHighAccuracy: true, distanceFilter: 10 }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTrackingActive(false);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!loginForm.id || !loginForm.code) return toast.error('Completa los datos');
    localStorage.setItem('ms_rider_id', loginForm.id);
    localStorage.setItem('ms_rider_code', loginForm.code);
    setRiderAuth({ id: loginForm.id, code: loginForm.code });
  };

  const handleLogout = () => {
    stopTracking();
    localStorage.removeItem('ms_rider_id');
    localStorage.removeItem('ms_rider_code');
    setRiderAuth(null);
    setData(null);
    setSelectedPedido(null);
  };

  const updateEstado = async (pedidoId, nuevoEstado) => {
    try {
      await api.put(`/repartidores/${riderAuth.id}/rider/${riderAuth.code}/pedido/${pedidoId}/estado`, { estado: nuevoEstado });
      toast.success(`Pedido ${nuevoEstado}`);
      fetchData();
    } catch (err) {
      toast.error('No se pudo actualizar el estado');
    }
  };

  const finalizarEntrega = async (pedidoId) => {
    const pedidoActual = data?.pedidos?.find((item) => item.id === pedidoId) || selectedPedido;
    const validacionActiva = String(data?.settings?.delivery_validacion_activa || '0') === '1';
    const payload = {};

    if (validacionActiva && pedidoActual?.entrega_pin) {
      const pin = window.prompt(`Ingresa el PIN de entrega del pedido #${pedidoActual.numero || pedidoId}`);
      if (pin === null) return;
      if (!String(pin).trim()) {
        toast.error('Debes ingresar el PIN del pedido');
        return;
      }
      payload.pin = String(pin).trim();
    }

    // Aqui podriamos manejar la foto si esta activa, por ahora simple para el MVP
    try {
      await api.post(`/repartidores/${riderAuth.id}/rider/${riderAuth.code}/entregar/${pedidoId}`, payload);
      deliveredSeenRef.current.add(pedidoId);
      try {
        await runDeliveredAlert({
          pedido: {
            ...pedidoActual,
            estado: 'entregado',
          },
          audioContextRef,
          voiceRef,
          fallbackAudioRef,
          scope: 'rider',
        });
      } catch {}
      toast.success('¡Entregado!');
      setSelectedPedido(null);
      fetchData();
    } catch (err) {
      toast.error(err?.error || 'Error al finalizar entrega');
    }
  };

  const openNav = (pedido) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pedido.cliente_direccion)}`;
    window.open(url, '_blank');
  };

  if (!riderAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="mx-auto h-20 w-20 rounded-3xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-200">
            <Truck size={40} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">RIDER APP</h1>
            <p className="mt-2 text-gray-500 font-medium uppercase tracking-widest text-xs">Acceso exclusivo repartidores</p>
          </div>
          
          <form onSubmit={handleLogin} className="mt-10 space-y-4">
            <div className="text-left space-y-1.5">
              <label className="ml-4 text-[10px] font-black uppercase text-gray-400">ID de Repartidor</label>
              <input 
                type="text" 
                value={loginForm.id}
                onChange={e => setLoginForm({...loginForm, id: e.target.value})}
                className="h-14 w-full rounded-2xl border-none bg-white px-6 text-lg font-bold shadow-sm focus:ring-2 focus:ring-blue-500" 
                placeholder="Ej: 1"
              />
            </div>
            <div className="text-left space-y-1.5">
              <label className="ml-4 text-[10px] font-black uppercase text-gray-400">Código de Acceso</label>
              <input 
                type="text" 
                value={loginForm.code}
                onChange={e => setLoginForm({...loginForm, code: e.target.value})}
                className="h-14 w-full rounded-2xl border-none bg-white px-6 text-lg font-bold shadow-sm focus:ring-2 focus:ring-blue-500" 
                placeholder="Pin de 8 caracteres"
              />
            </div>
            <button className="h-16 w-full rounded-2xl bg-blue-600 text-white text-lg font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">
              INGRESAR
            </button>
          </form>
        </div>
      </div>
    );
  }

  const primaryColor = data?.settings?.rider_app_color_primario || '#5D87FF';
  const appName = data?.settings?.rider_app_nombre || 'Modo Sabor Delivery';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans overflow-x-hidden">
      
      {/* Header Dinamico */}
      <header className="sticky top-0 z-20 px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white shadow-sm" style={{ borderTop: `4px solid ${primaryColor}` }}>
        <div className="flex items-center gap-3">
          {data?.settings?.rider_app_logo ? (
            <img src={data.settings.rider_app_logo} className="h-8 w-8 object-contain" />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Truck size={20} />
            </div>
          )}
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-gray-900 leading-none">{appName}</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{data?.repartidor?.nombre || 'Repartidor'}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-rose-500">
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-6 space-y-6">
        
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-20 opacity-40 animate-pulse">
            <RefreshCw className="animate-spin mb-4" size={32} />
            <p className="text-sm font-black uppercase">Sincronizando...</p>
          </div>
        )}

        {!selectedPedido ? (
          <>
            {/* Bienvenida y Status */}
            <div className="rounded-[32px] bg-white p-6 shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-600 leading-relaxed">{data?.settings?.rider_app_bienvenida}</p>
              <div className="mt-4 flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${trackingActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{trackingActive ? 'Seguimiento Activo' : 'Esperando Pedidos'}</span>
              </div>
            </div>

            {/* Lista de Pedidos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black uppercase text-gray-400 tracking-[0.2em]">Asignados ({data?.pedidos?.length || 0})</h3>
                <button onClick={fetchData} className="text-blue-600">
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              {data?.pedidos?.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center opacity-30">
                  <Package size={48} strokeWidth={1} className="mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">Sin entregas por ahora</p>
                </div>
              ) : data?.pedidos?.map(pedido => (
                <button 
                  key={pedido.id}
                  onClick={() => setSelectedPedido(pedido)}
                  className="w-full text-left rounded-[32px] bg-white border border-gray-100 p-5 shadow-sm hover:shadow-lg transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-[20px] bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                      <ShoppingBag size={24} className="text-gray-400 group-hover:text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900 uppercase tracking-tight">#{pedido.numero} · {pedido.cliente_nombre}</p>
                      <p className="text-xs font-bold text-gray-400 truncate max-w-[200px]">{pedido.cliente_direccion}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${
                      pedido.estado === 'en_camino' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}>{pedido.estado.replace('_', ' ')}</span>
                    <ChevronRight size={18} className="text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          /* Detalle de Pedido */
          <div className="flex flex-col flex-1 animate-in slide-in-from-right duration-300">
            <button onClick={() => setSelectedPedido(null)} className="mb-4 flex items-center gap-2 text-gray-400 hover:text-gray-900 font-bold text-sm uppercase tracking-widest">
              <X size={18} /> Volver a la lista
            </button>

            <div className="flex-1 bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden flex flex-col">
              {/* Info Cliente */}
              <div className="p-8 border-b border-gray-50">
                <div className="flex items-center justify-between mb-6">
                  <div className="px-4 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest">
                    #{selectedPedido.numero}
                  </div>
                  <p className="text-xs font-bold text-gray-400">{format(parseISO(selectedPedido.creado_en), 'HH:mm')} HS</p>
                </div>
                
                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{selectedPedido.cliente_nombre}</h3>
                <div className="mt-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-8 w-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Dirección</p>
                      <p className="text-sm font-bold text-gray-700 leading-tight">{selectedPedido.cliente_direccion}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-8 w-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                        <Phone size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Teléfono</p>
                        <p className="text-sm font-bold text-gray-700 leading-tight">{selectedPedido.cliente_telefono || 'No disponible'}</p>
                      </div>
                    </div>
                    {selectedPedido.cliente_telefono && (
                      <a 
                        href={`tel:${selectedPedido.cliente_telefono}`}
                        className="h-12 w-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-100 active:scale-90 transition-all"
                      >
                        <Phone size={20} fill="currentColor" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Boton Navegacion */}
              <div className="p-4">
                <button 
                  onClick={() => openNav(selectedPedido)}
                  className="w-full h-16 rounded-2xl bg-gray-900 text-white flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest shadow-xl shadow-gray-200 hover:bg-black transition-all"
                >
                  <Navigation size={20} />
                  ABRIR MAPA (NAVEGAR)
                </button>
              </div>

              {/* Items y Pago */}
              <div className="p-8 bg-gray-50/50 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resumen del Pedido</span>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${paymentStatusTone(selectedPedido.pago_estado)}`}>
                    {paymentMethodLabel(selectedPedido.metodo_pago)} · {paymentStatusLabel(selectedPedido.pago_estado)}
                  </span>
                </div>
                <div className="space-y-2 mb-6">
                  {selectedItems.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <p className="font-bold text-gray-700">{it.cantidad}x {it.nombre}</p>
                      <p className="font-black text-gray-900">{fmt(it.precio_unitario * it.cantidad)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <p className="text-xs font-black text-gray-400 uppercase">Total a Cobrar</p>
                  <p className="text-2xl font-black text-gray-900">{fmt(selectedPedido.total)}</p>
                </div>
              </div>

              {/* Acciones de Estado */}
              <div className="p-6 bg-white border-t border-gray-50 flex flex-col gap-3">
                {selectedPedido.estado === 'confirmado' || selectedPedido.estado === 'listo' ? (
                  <button 
                    onClick={() => updateEstado(selectedPedido.id, 'en_camino')}
                    className="h-16 w-full rounded-2xl bg-blue-600 text-white flex items-center justify-center gap-3 text-lg font-black uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all"
                  >
                    <Truck size={24} /> COMENZAR REPARTO
                  </button>
                ) : selectedPedido.estado === 'en_camino' ? (
                  <button 
                    onClick={() => finalizarEntrega(selectedPedido.id)}
                    className="h-16 w-full rounded-2xl bg-emerald-500 text-white flex items-center justify-center gap-3 text-lg font-black uppercase tracking-widest shadow-xl shadow-emerald-100 active:scale-95 transition-all"
                  >
                    <CheckCircle2 size={24} /> MARCAR ENTREGADO
                  </button>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => updateEstado(selectedPedido.id, 'incidencia')}
                    className="h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
                  >
                    <AlertCircle size={16} /> INCIDENCIA
                  </button>
                  <button 
                    onClick={() => updateEstado(selectedPedido.id, 'cancelado')}
                    className="h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
                  >
                    <X size={16} /> RECHAZAR/CANCELAR
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer / Status Bar */}
      <footer className="px-6 py-3 bg-white border-t border-gray-100 flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
          Sincronizado {format(new Date(), 'HH:mm')}
        </div>
        <p>Modo Sabor v2.0</p>
      </footer>
    </div>
  );
}
