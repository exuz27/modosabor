import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { isPagoPagado } from '../lib/paymentStatus.js';
import {
  buildPedidoPayload,
  calculatePedidoSummary,
  createDeliveryQuoteState,
  getPrimaryDisplayPrice,
  getStructuredDisplayPrices,
  safeParseArray,
} from '../lib/pedidoForm.js';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  X, 
  MapPin, 
  Phone, 
  Bike, 
  Store, 
  ChevronRight, 
  CheckCircle, 
  AlertTriangle, 
  Ticket, 
  Tag,
  Star,
  Clock,
  ArrowRight,
  Info,
  ChevronDown,
  ShoppingBag
} from 'lucide-react';

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

function buildTrackingLink(pedido) {
  if (!pedido?.id) return '/';
  return pedido?.tracking_token
    ? `/seguimiento/${pedido.id}?token=${encodeURIComponent(pedido.tracking_token)}`
    : `/seguimiento/${pedido.id}`;
}

function ProductoCard({ producto, onAgregar, colorPrimario }) {
  const primaryPrice = getPrimaryDisplayPrice(producto);
  const structuredPrices = getStructuredDisplayPrices(producto);

  return (
    <div className={`group relative flex flex-col rounded-[32px] bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:-translate-y-1 border border-gray-100 ${producto.disponible_para_venta === false ? 'opacity-60 grayscale' : ''}`}>
      <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-[24px] bg-[#F2F6FA]">
        {producto.imagen ? (
          <img src={producto.imagen} alt={producto.nombre} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl opacity-20">MS</div>
        )}
        {producto.destacado === 1 && (
          <div className="absolute top-3 left-3 rounded-xl bg-white/90 backdrop-blur-sm px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#5D87FF] shadow-sm">
            Popular
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-2">
        <h3 className="text-base font-black leading-tight text-gray-900 uppercase tracking-tight line-clamp-2 mb-1">{producto.nombre}</h3>
        
        {producto.descripcion && (
          <p className="mb-4 text-xs font-medium leading-relaxed text-gray-400 line-clamp-2 italic">
            {producto.descripcion}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-gray-50 pt-4">
          <div className="flex flex-col gap-1.5">
            {structuredPrices.items.length >= 2 ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {structuredPrices.items.map((item) => (
                  <div key={item.label} className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-300 uppercase leading-none mb-1">{item.label}</span>
                    <span className="text-xl font-black text-gray-900 leading-none">{fmt(item.price)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {primaryPrice.label ? (
                  <span className="text-[10px] font-black text-gray-300 uppercase leading-none mb-1">{primaryPrice.label}</span>
                ) : null}
                <span className="text-xl font-black text-gray-900 leading-none">{fmt(primaryPrice.price)}</span>
              </>
            )}
          </div>
          
          <button
            onClick={() => onAgregar(producto)}
            disabled={producto.disponible_para_venta === false}
            className="flex h-11 w-11 items-center justify-center rounded-2xl transition-all active:scale-90 shadow-md"
            style={{ backgroundColor: colorPrimario || '#5D87FF', color: 'white' }}
          >
            <Plus size={20} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WebPublica() {
  const [config, setConfig] = useState({});
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [catActiva, setCatActiva] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [carritoOpen, setCarritoOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [confirmado, setConfirmado] = useState(null);
  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    tipo_entrega: 'delivery',
    metodo_pago: 'efectivo',
    notas: '',
  });
  const [variantModal, setVariantModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deliveryQuote, setDeliveryQuote] = useState(() => createDeliveryQuoteState({
    tipoEntrega: 'delivery',
    overrides: { available: true, message: '' },
  }));
  const [cupon, setCupon] = useState({ codigo: '', aplicado: null });

  useEffect(() => {
    Promise.all([
      api.get('/configuracion').catch(() => ({})),
      api.get('/categorias').catch(() => []),
      api.get('/productos').catch(() => [])
    ])
      .then(([conf, cats, prods]) => {
        setConfig(conf || {});
        setCategorias(Array.isArray(cats) ? cats.filter((c) => c.activo) : []);
        setProductos(Array.isArray(prods) ? prods.filter(p => p.activo) : []);
      })
      .catch(err => console.error('Error loading data:', err));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pedidoId = params.get('pedido_id');
    const mpStatus = params.get('mp');
    if (!pedidoId || !mpStatus) return;
    
    api.get(`/pedidos/${pedidoId}/pago/mercadopago`)
      .then((pedido) => {
        setConfirmado(pedido);
        if (isPagoPagado(pedido.pago_estado)) toast.success('Pago confirmado');
      })
      .catch(() => toast.error('No se pudo verificar el pago'))
      .finally(() => {
        window.history.replaceState({}, '', '/');
      });
  }, []);

  useEffect(() => {
    if (form.tipo_entrega !== 'delivery') {
      setDeliveryQuote(createDeliveryQuoteState({
        tipoEntrega: form.tipo_entrega,
        config,
        overrides: { available: true, message: '' },
      }));
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const quote = await api.post('/configuracion/delivery/cotizar', { direccion: form.direccion || '' });
        setDeliveryQuote({
          ...createDeliveryQuoteState({
            tipoEntrega: 'delivery',
            config,
            overrides: { available: true, message: '' },
          }),
          ...(quote || {}),
        });
      } catch {
        setDeliveryQuote(createDeliveryQuoteState({
          tipoEntrega: 'delivery',
          config,
          overrides: { available: true, message: '' },
        }));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.direccion, form.tipo_entrega, config]);

  const productosFiltrados = useMemo(() => {
    if (!Array.isArray(productos)) return [];
    return productos.filter((p) => !catActiva || p.categoria_id === catActiva);
  }, [productos, catActiva]);

  const summary = useMemo(() => calculatePedidoSummary({
    items: carrito,
    tipoEntrega: form.tipo_entrega,
    deliveryQuote,
    descuentoFijo: cupon.aplicado?.monto_descuento || 0,
  }), [carrito, form.tipo_entrega, deliveryQuote, cupon.aplicado?.monto_descuento]);
  const { totalItems, subtotal, envio, total } = summary;
  const colorPrimario = config?.negocio_color_primario || '#5D87FF';

  const speakAdded = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      const utterance = new SpeechSynthesisUtterance('Producto agregado');
      utterance.lang = 'es-AR';
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  const agregarAlCarrito = (producto) => {
    const variantes = safeParseArray(producto.variantes);
    const extras = safeParseArray(producto.extras);
    if (variantes.length > 0 || extras.length > 0) {
      setVariantModal({ producto, variantes, extras, sel: {}, extrasSel: [] });
      return;
    }
    addToCart(producto, {}, []);
  };

  const addToCart = (producto, sel, extrasSel) => {
    const varKey = JSON.stringify(sel || {});
    const precioExtra = Object.values(sel || {}).reduce((acc, o) => acc + Number(o?.precio_extra || 0), 0) +
                        (extrasSel || []).reduce((acc, e) => acc + Number(e.precio || 0), 0);

    const existing = carrito.find((i) => i.producto_id === producto.id && i.varKey === varKey);
    if (existing) {
      setCarrito(prev => prev.map(i => i.id === existing.id ? { ...i, cantidad: i.cantidad + 1 } : i));
    } else {
      setCarrito(prev => [...prev, {
        id: Date.now(),
        producto_id: producto.id,
        nombre: producto.nombre,
        precio_unitario: Number(producto.precio) + precioExtra,
        cantidad: 1,
        varKey,
        variantes: sel || {},
        extras: extrasSel || [],
        descripcion: [...Object.values(sel || {}).map(o => o.nombre || o), ...(extrasSel || []).map(e => e.nombre)].join(', ')
      }]);
    }
    setVariantModal(null);
    speakAdded();
    toast.success('Producto agregado');
  };

  const hacerPedido = async () => {
    if (!form.nombre || !form.telefono) return toast.error('Completa tus datos');
    setLoading(true);
    try {
      const payload = buildPedidoPayload({
        customer: {
          nombre: form.nombre,
          telefono: form.telefono,
          direccion: form.direccion,
        },
        items: carrito,
        summary,
        tipoEntrega: form.tipo_entrega,
        metodoPago: form.metodo_pago,
        notas: form.notas,
        origen: 'web',
      });
      const res = await api.post('/pedidos', payload);
      setConfirmado(res);
      setCarrito([]);
      setCheckout(false);
    } catch (e) {
      toast.error(e?.error || 'Error al procesar');
    } finally {
      setLoading(false);
    }
  };

  if (confirmado) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center p-6 text-center font-sans">
        <div className="w-full max-w-lg bg-white rounded-[40px] p-10 shadow-xl border border-gray-100">
          <div className="h-24 w-24 rounded-[32px] bg-emerald-50 flex items-center justify-center text-emerald-500 mx-auto mb-8">
            <CheckCircle size={48} strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">¡Pedido recibido!</h2>
          <p className="text-lg font-bold text-gray-400 mt-2 uppercase tracking-widest">Orden #{confirmado.numero}</p>
          <div className="my-10 p-6 rounded-[32px] bg-gray-50 text-left space-y-3">
             <div className="flex justify-between text-sm text-gray-500 uppercase font-bold tracking-widest"><span>Subtotal</span><span className="font-black text-gray-900">{fmt(confirmado.subtotal)}</span></div>
             {confirmado.costo_envio > 0 && <div className="flex justify-between text-sm text-gray-500 uppercase font-bold tracking-widest"><span>Envío</span><span className="font-black text-gray-900">+{fmt(confirmado.costo_envio)}</span></div>}
             <div className="flex justify-between border-t border-gray-200 pt-3 text-xl font-black text-[#5D87FF] uppercase"><span>Total</span><span>{fmt(confirmado.total)}</span></div>
          </div>
          <Link to={buildTrackingLink(confirmado)} className="block w-full py-4 rounded-2xl bg-gray-900 text-white font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all mb-4 text-center">Seguir mi pedido</Link>
          <button onClick={() => setConfirmado(null)} className="text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600">Volver al menú</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-sans selection:bg-[#5D87FF]/20">
      <header className="sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-gray-100/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {config?.negocio_logo ? (
              <img src={config.negocio_logo} className="h-12 w-12 object-contain rounded-2xl bg-white p-1.5 shadow-sm border border-gray-100" alt="logo" />
            ) : (
              <div className="h-12 w-12 rounded-2xl bg-[#5D87FF] text-white flex items-center justify-center font-black text-xl shadow-lg">MS</div>
            )}
            <div>
              <h1 className="text-lg font-black text-gray-900 uppercase tracking-tight">{config?.negocio_nombre || 'Modo Sabor'}</h1>
              <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                Abierto Ahora
              </div>
            </div>
          </div>
          <button onClick={() => setCarritoOpen(true)} className="relative h-12 px-6 rounded-2xl bg-gray-900 text-white flex items-center gap-3 shadow-xl active:scale-95 transition-all">
            <ShoppingCart size={20} />
            <span className="text-sm font-black uppercase tracking-widest">{fmt(total)}</span>
            {totalItems > 0 && <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-[#5D87FF] text-white text-[10px] font-black flex items-center justify-center border-2 border-white">{totalItems}</div>}
          </button>
        </div>
      </header>

      <section className="relative h-[280px] bg-gray-900 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <img src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80" className="w-full h-full object-cover" alt="hero" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#F4F7FB] via-transparent to-transparent"></div>
        <div className="relative z-10 text-center px-6">
          <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter shadow-sm">¿Qué vas a pedir hoy?</h2>
          <p className="text-white/80 font-black text-xs uppercase tracking-[0.3em] mt-4">Los mejores sabores de Monteros a tu puerta</p>
        </div>
      </section>

      <div className="sticky top-[81px] z-[90] bg-[#F4F7FB]/95 backdrop-blur-sm px-6 py-6 -mt-10">
        <div className="max-w-6xl mx-auto flex gap-3 overflow-x-auto no-scrollbar pb-2">
          <button onClick={() => setCatActiva(null)} className={`shrink-0 h-12 px-8 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${!catActiva ? 'bg-[#5D87FF] text-white shadow-xl shadow-blue-100' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100 shadow-sm'}`}>Todo el menú</button>
          {Array.isArray(categorias) && categorias.map((c) => (
            <button key={c.id} onClick={() => setCatActiva(c.id)} className={`shrink-0 h-12 px-8 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 ${catActiva === c.id ? 'bg-[#5D87FF] text-white shadow-xl shadow-blue-100' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100 shadow-sm'}`}>
              <span>{c.icono}</span>{c.nombre}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 gap-8 mt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.isArray(productosFiltrados) && productosFiltrados.map((p) => <ProductoCard key={p.id} producto={p} onAgregar={agregarAlCarrito} colorPrimario={colorPrimario} />)}
        </div>
        {(!Array.isArray(productosFiltrados) || productosFiltrados.length === 0) && (
          <div className="py-24 text-center">
            <div className="h-20 w-24 bg-gray-100 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-gray-300"><ShoppingBag size={40} strokeWidth={1.5} /></div>
            <p className="text-lg font-black text-gray-400 uppercase tracking-widest">Sin productos en esta categoría</p>
          </div>
        )}
      </main>

      {carritoOpen && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setCarritoOpen(false)} />
          <div className="flex w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-500 rounded-l-[40px] overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <div><h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Tu Pedido</h2><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{totalItems} productos</p></div>
              <button onClick={() => setCarritoOpen(false)} className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-900"><X size={24} /></button>
            </div>
            {!checkout ? (
              <>
                <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-4">
                  {carrito.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-center"><ShoppingCart size={64} strokeWidth={1} className="mb-4" /><p className="text-sm font-black uppercase tracking-widest">El carrito está vacío</p></div>
                  ) : carrito.map((item) => (
                    <div key={item.id} className="group flex items-center gap-4 p-4 rounded-[28px] border border-gray-50 bg-gray-50/50 hover:bg-white transition-all">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight truncate">{item.nombre}</p>
                        {item.descripcion && <p className="text-[10px] font-bold text-gray-400 truncate mt-0.5">{item.descripcion}</p>}
                        <p className="text-sm font-black text-[#5D87FF] mt-2">{fmt(item.precio_unitario * item.cantidad)}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm">
                        <button onClick={() => setCarrito(prev => prev.map(i => i.id === item.id ? { ...i, cantidad: Math.max(0, i.cantidad - 1) } : i).filter(i => i.cantidad > 0))} className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-rose-50 hover:text-rose-500"><Minus size={14} /></button>
                        <span className="text-sm font-black text-gray-900 w-4 text-center">{item.cantidad}</span>
                        <button onClick={() => setCarrito(prev => prev.map(i => i.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i))} className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-emerald-50 hover:text-emerald-500"><Plus size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                {carrito.length > 0 && (
                  <div className="p-8 border-t border-gray-50 bg-gray-50/30">
                    <div className="space-y-2 mb-6 text-sm font-bold text-gray-400 uppercase tracking-widest flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                    <button onClick={() => setCheckout(true)} className="w-full h-16 rounded-2xl bg-gray-900 text-white font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3">Completar Pedido <ArrowRight size={20} /></button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-6">
                <button onClick={() => setCheckout(false)} className="flex items-center gap-2 text-[10px] font-black text-[#5D87FF] uppercase mb-4 font-bold tracking-widest hover:underline"><X size={14} /> Editar carrito</button>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tu Nombre</label>
                  <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="h-12 w-full rounded-2xl bg-gray-50 border-none px-4 text-sm font-bold focus:ring-2 focus:ring-[#5D87FF]/20 outline-none" placeholder="Ej: Juan Perez" />
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Telefono</label>
                  <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className="h-12 w-full rounded-2xl bg-gray-50 border-none px-4 text-sm font-bold focus:ring-2 focus:ring-[#5D87FF]/20 outline-none" placeholder="Ej: 3811234567" />
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setForm({ ...form, tipo_entrega: 'delivery' })} className={`h-14 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase border-2 transition-all ${form.tipo_entrega === 'delivery' ? 'border-[#5D87FF] bg-blue-50 text-[#5D87FF]' : 'border-gray-100 text-gray-400'}`}><Bike size={18} /> Delivery</button>
                    <button onClick={() => setForm({ ...form, tipo_entrega: 'retiro' })} className={`h-14 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase border-2 transition-all ${form.tipo_entrega === 'retiro' ? 'border-[#5D87FF] bg-blue-50 text-[#5D87FF]' : 'border-gray-100 text-gray-400'}`}><Store size={18} /> Retiro</button>
                  </div>
                  {form.tipo_entrega === 'delivery' && (
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Dirección</label>
                      <input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} className="h-12 w-full rounded-2xl bg-gray-50 border-none px-4 text-sm font-bold focus:ring-2 focus:ring-[#5D87FF]/20 outline-none" placeholder="Calle 123" />
                    </div>
                  )}
                  <button onClick={hacerPedido} disabled={loading} className="w-full h-16 rounded-2xl bg-[#5D87FF] text-white font-black uppercase tracking-[0.2em] shadow-xl mt-6 active:scale-95 transition-all">{loading ? 'Procesando...' : 'Confirmar mi Pedido'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {variantModal && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setVariantModal(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-8 shrink-0">
              <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{variantModal.producto.nombre}</h3>
              <button onClick={() => setVariantModal(null)} className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto no-scrollbar space-y-8 pr-2 pb-4">
              {variantModal.variantes.map(v => (
                <div key={v.nombre} className="space-y-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{v.nombre}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {v.opciones.map(o => {
                      const oNombre = o.nombre || o;
                      const selected = variantModal.sel[v.nombre]?.nombre === oNombre;
                      const finalPrice = Number(variantModal.producto?.precio || 0) + Number(o?.precio_extra || 0);
                      return (
                        <button
                          key={oNombre}
                          onClick={() => setVariantModal(prev => ({ ...prev, sel: { ...prev.sel, [v.nombre]: typeof o === 'string' ? { nombre: o } : o } }))}
                          className={`min-h-[76px] rounded-2xl flex flex-col items-center justify-center gap-1 border-2 px-3 py-3 transition-all ${
                            selected
                              ? 'border-[#5D87FF] bg-blue-50 text-[#5D87FF] shadow-md shadow-blue-100'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-xs font-black uppercase leading-none">{oNombre}</span>
                          <span className={`text-sm font-black leading-none ${selected ? 'text-[#5D87FF]' : 'text-gray-900'}`}>{fmt(finalPrice)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => addToCart(variantModal.producto, variantModal.sel, variantModal.extrasSel)} className="mt-6 shrink-0 w-full h-16 rounded-2xl bg-[#5D87FF] text-white font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Agregar al pedido</button>
          </div>
        </div>
      )}
    </div>
  );
}


