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
  normalizeText,
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
  ShoppingBag,
  LocateFixed
} from 'lucide-react';

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const DEFAULT_HERO = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1400&q=85';

function parseConfigArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isEnabled(value) {
  return String(value || '0') === '1' || value === true;
}

function isActiveByDate(item) {
  if (!item?.activa && item?.activa !== undefined) return false;
  const now = Date.now();
  const desde = item?.desde ? new Date(item.desde).getTime() : null;
  const hasta = item?.hasta ? new Date(item.hasta).getTime() : null;
  if (desde && Number.isFinite(desde) && now < desde) return false;
  if (hasta && Number.isFinite(hasta) && now > hasta) return false;
  return true;
}

function buildWhatsAppUrl(config, message = '') {
  const phone = String(config?.negocio_telefono || '3815988735').replace(/\D/g, '');
  const finalPhone = phone.startsWith('54') ? phone : `54${phone}`;
  const text = encodeURIComponent(message || 'Hola Modo Sabor, quiero hacer un pedido.');
  return `https://wa.me/${finalPhone}?text=${text}`;
}

function buildTrackingLink(pedido) {
  if (!pedido?.id) return '/';
  return pedido?.tracking_token
    ? `/seguimiento/${pedido.id}?token=${encodeURIComponent(pedido.tracking_token)}`
    : `/seguimiento/${pedido.id}`;
}

function ProductoCard({ producto, onAgregar, colorPrimario }) {
  const primaryPrice = getPrimaryDisplayPrice(producto);
  const structuredPrices = getStructuredDisplayPrices(producto);
  const isPizza = normalizeText(producto?.categoria_nombre || '').includes('pizza');

  return (
    <div id={`producto-${producto.id}`} className={`group relative flex flex-col overflow-hidden rounded-[28px] bg-white shadow-sm transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)] hover:-translate-y-1 border border-gray-100 ${producto.disponible_para_venta === false ? 'opacity-60 grayscale' : ''}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-[#111]">
        {producto.imagen ? (
          <img src={producto.imagen} alt={producto.nombre} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-black text-white/20">MS</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent" />
        {producto.destacado === 1 && (
          <div className="absolute top-3 left-3 rounded-xl bg-red-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
            Recomendado
          </div>
        )}
        {producto.disponible_para_venta === false && (
          <div className="absolute bottom-3 left-3 rounded-xl bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-900">
            Sin stock
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-black leading-tight text-gray-900 uppercase tracking-tight line-clamp-2 mb-1">{producto.nombre}</h3>
        
        {producto.descripcion && (
          <p className="mb-4 text-xs font-medium leading-relaxed text-gray-400 line-clamp-2 italic">
            {producto.descripcion}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="flex flex-col gap-1.5">
            {!isPizza && structuredPrices.items.length >= 2 ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {structuredPrices.items.map((item) => (
                  <div key={item.label} className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-300 uppercase leading-none mb-1">{item.label}</span>
                    <span className="text-xl font-black text-red-600 leading-none">{fmt(item.price)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {primaryPrice.label ? (
                  <span className="text-[10px] font-black text-gray-300 uppercase leading-none mb-1">{primaryPrice.label}</span>
                ) : null}
                <span className="text-xl font-black text-red-600 leading-none">{fmt(primaryPrice.price)}</span>
              </>
            )}
          </div>
          
          <button
            onClick={() => onAgregar(producto)}
            disabled={producto.disponible_para_venta === false}
            className="flex h-11 w-11 items-center justify-center rounded-2xl transition-all active:scale-90 shadow-md"
            style={{ backgroundColor: colorPrimario || '#dc2626', color: 'white' }}
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
  const [popupVisible, setPopupVisible] = useState(false);
  const [customerGeo, setCustomerGeo] = useState({ latitud: null, longitud: null, loading: false, ready: false });

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
  const colorPrimario = config?.negocio_color_primario || config?.color_primario || '#dc2626';
  const activePromos = useMemo(
    () => parseConfigArray(config.web_promos_json).filter(isActiveByDate),
    [config.web_promos_json]
  );
  const destacados = useMemo(
    () => productos.filter((producto) => Number(producto.destacado) === 1 && producto.disponible_para_venta !== false).slice(0, 8),
    [productos]
  );
  const popupContent = useMemo(() => {
    const configPopup = isEnabled(config.web_popup_activo) && isActiveByDate({
      activa: true,
      desde: config.web_popup_desde,
      hasta: config.web_popup_hasta,
    }) && (config.web_popup_titulo || config.web_popup_imagen)
      ? {
        id: 'config-popup',
        titulo: config.web_popup_titulo,
        descripcion: config.web_popup_descripcion,
        imagen: config.web_popup_imagen,
        boton_texto: config.web_popup_boton_texto || 'Ver promo',
        accion_tipo: config.web_popup_accion_tipo || 'none',
        accion_valor: config.web_popup_accion_valor || '',
      }
      : null;
    return configPopup || activePromos.find((promo) => promo.mostrar_popup);
  }, [activePromos, config]);

  useEffect(() => {
    if (!popupContent?.id) return;
    const frequencyHours = Math.max(1, Number(config.web_popup_frecuencia_horas || 12));
    const storageKey = `ms_public_popup_${popupContent.id}`;
    const lastShown = Number(localStorage.getItem(storageKey) || 0);
    if (Date.now() - lastShown < frequencyHours * 60 * 60 * 1000) return;
    setPopupVisible(true);
    localStorage.setItem(storageKey, String(Date.now()));
  }, [popupContent?.id, config.web_popup_frecuencia_horas]);

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

  const handleAction = (tipo = 'none', valor = '', fallback = {}) => {
    const actionType = tipo || 'none';
    const actionValue = valor || '';

    if (actionType === 'cart') {
      setCarritoOpen(true);
      return;
    }

    if (actionType === 'whatsapp') {
      window.open(buildWhatsAppUrl(config, actionValue), '_blank');
      return;
    }

    if (actionType === 'url' && actionValue) {
      window.open(actionValue, '_blank');
      return;
    }

    if (actionType === 'producto' && actionValue) {
      const product = productos.find((item) => String(item.id) === String(actionValue));
      if (product) {
        setCatActiva(product.categoria_id || null);
        setTimeout(() => {
          document.getElementById(`producto-${product.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
      }
      return;
    }

    if (actionType === 'categoria') {
      const categoryId = actionValue || fallback.categoria_id || categorias[0]?.id || null;
      setCatActiva(categoryId ? Number(categoryId) : null);
      setTimeout(() => document.getElementById('menu-publico')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      return;
    }

    document.getElementById('menu-publico')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const variantesCompletas = !variantModal || variantModal.variantes.every((group) => {
    const selected = variantModal.sel?.[group.nombre];
    return Boolean(selected?.nombre || selected);
  });

  const hacerPedido = async () => {
    if (!form.nombre || !form.telefono) return toast.error('Completa tus datos');
    setLoading(true);
    try {
      const payload = buildPedidoPayload({
        customer: {
          nombre: form.nombre,
          telefono: form.telefono,
          direccion: form.direccion,
          latitud: customerGeo.latitud,
          longitud: customerGeo.longitud,
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

  const captureCustomerLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Tu celular no permite compartir ubicación');
      return;
    }
    setCustomerGeo((prev) => ({ ...prev, loading: true }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerGeo({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
          loading: false,
          ready: true,
        });
        toast.success('Ubicación tomada');
      },
      () => {
        setCustomerGeo({ latitud: null, longitud: null, loading: false, ready: false });
        toast.error('No pudimos obtener tu ubicación');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
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
    <div className="min-h-screen bg-[#f6f2ea] font-sans selection:bg-red-600/20">
      <header className="sticky top-0 z-[100] border-b border-white/10 bg-[#090909]/90 px-4 py-3 text-white backdrop-blur-md md:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {config?.negocio_logo ? (
              <img src={config.negocio_logo} className="h-12 w-12 object-contain rounded-2xl bg-white p-1.5 shadow-sm" alt="logo" />
            ) : (
              <div className="h-12 w-12 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black text-xl shadow-lg">MS</div>
            )}
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight">{config?.negocio_nombre || 'Modo Sabor'}</h1>
              <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${config?.abierto_ahora ? 'text-emerald-400' : 'text-amber-300'}`}>
                <div className={`h-1.5 w-1.5 rounded-full ${config?.abierto_ahora ? 'bg-emerald-400 animate-pulse' : 'bg-amber-300'}`}></div>
                {config?.abierto_ahora ? `Abierto${config?.turno_actual?.hasta ? ` hasta ${config.turno_actual.hasta}` : ''}` : 'Cerrado ahora'}
              </div>
            </div>
          </div>
          <button onClick={() => setCarritoOpen(true)} className="relative h-12 px-4 md:px-6 rounded-2xl bg-red-600 text-white flex items-center gap-3 shadow-xl active:scale-95 transition-all">
            <ShoppingCart size={20} />
            <span className="text-sm font-black uppercase tracking-widest">{fmt(total)}</span>
            {totalItems > 0 && <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white text-red-600 text-[10px] font-black flex items-center justify-center border-2 border-[#090909]">{totalItems}</div>}
          </button>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#090909] text-white">
        <div className="absolute inset-0 opacity-55">
          <img src={config.web_hero_imagen || DEFAULT_HERO} className="w-full h-full object-cover" alt="Modo Sabor" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/10"></div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f6f2ea] to-transparent"></div>
        <div className="relative z-10 mx-auto grid min-h-[420px] max-w-6xl grid-cols-1 items-end gap-8 px-6 pb-16 pt-20 md:grid-cols-[1.1fr,0.9fr] md:items-center md:pb-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.26em] text-red-200 backdrop-blur">
              <Star size={14} fill="currentColor" />
              Vive el sabor
            </div>
            <h2 className="max-w-3xl text-5xl font-black uppercase leading-[0.9] tracking-tight md:text-7xl">
              {config.web_hero_titulo || config.negocio_nombre || 'Modo Sabor'}
            </h2>
            <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-white/78 md:text-lg">
              {config.web_hero_subtitulo || config.negocio_descripcion || 'Pedí directo desde nuestra carta online.'}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleAction(config.web_hero_accion_tipo || 'categoria', config.web_hero_accion_valor)}
                className="inline-flex h-14 items-center gap-3 rounded-2xl bg-red-600 px-6 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-red-950/40 transition hover:bg-red-700 active:scale-95"
              >
                {config.web_hero_boton_texto || 'Pedir ahora'}
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => window.open(buildWhatsAppUrl(config), '_blank')}
                className="inline-flex h-14 items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-6 text-xs font-black uppercase tracking-widest text-white backdrop-blur transition hover:bg-white/15"
              >
                <Phone size={18} />
                WhatsApp
              </button>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-auto max-w-sm rounded-[32px] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-red-200">Pedido rapido</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {categorias.slice(0, 4).map((cat) => (
                  <button key={cat.id} onClick={() => handleAction('categoria', cat.id)} className="rounded-2xl bg-black/35 px-4 py-4 text-left transition hover:bg-red-600">
                    <span className="text-2xl">{cat.icono}</span>
                    <span className="mt-2 block text-xs font-black uppercase tracking-widest">{cat.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {activePromos.filter((promo) => promo.mostrar_banner !== false).length > 0 && (
        <section className="relative z-20 -mt-10 px-6">
          <div className="mx-auto max-w-6xl overflow-x-auto no-scrollbar">
            <div className="flex gap-4 pb-2">
              {activePromos.filter((promo) => promo.mostrar_banner !== false).slice(0, 6).map((promo) => (
                <button
                  key={promo.id}
                  onClick={() => handleAction(promo.accion_tipo, promo.accion_valor)}
                  className="group grid min-w-[280px] max-w-[360px] flex-1 grid-cols-[86px,1fr] overflow-hidden rounded-3xl bg-white text-left shadow-xl shadow-black/10 ring-1 ring-black/5 transition hover:-translate-y-0.5"
                >
                  <div className="bg-[#141414]">
                    {promo.imagen ? <img src={promo.imagen} alt={promo.titulo} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xl font-black text-white/25">MS</div>}
                  </div>
                  <div className="p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-red-600">{promo.etiqueta || 'Promo'}</p>
                    <h3 className="mt-1 line-clamp-1 text-sm font-black uppercase text-gray-900">{promo.titulo}</h3>
                    {promo.precio_texto ? <p className="mt-1 text-lg font-black text-gray-950">{promo.precio_texto}</p> : null}
                    <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-gray-500">{promo.descripcion}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div id="menu-publico" className="sticky top-[73px] z-[90] bg-[#f6f2ea]/95 backdrop-blur-sm px-6 py-5">
        <div className="max-w-6xl mx-auto flex gap-3 overflow-x-auto no-scrollbar pb-2">
          <button onClick={() => setCatActiva(null)} className={`shrink-0 h-12 px-8 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${!catActiva ? 'bg-[#111] text-white shadow-xl shadow-black/10' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100 shadow-sm'}`}>Todo el menú</button>
          {Array.isArray(categorias) && categorias.map((c) => (
            <button key={c.id} onClick={() => setCatActiva(c.id)} className={`shrink-0 h-12 px-8 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 ${catActiva === c.id ? 'bg-red-600 text-white shadow-xl shadow-red-100' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100 shadow-sm'}`}>
              <span>{c.icono}</span>{c.nombre}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pb-24">
        {isEnabled(config.web_mostrar_destacados) && destacados.length > 0 && !catActiva && (
          <section className="mb-10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-600">Recomendados</p>
                <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-gray-950">Los mas pedidos</h2>
              </div>
              <button onClick={() => setCatActiva(null)} className="text-xs font-black uppercase tracking-widest text-gray-500">Ver carta</button>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {destacados.map((p) => <ProductoCard key={`dest-${p.id}`} producto={p} onAgregar={agregarAlCarrito} colorPrimario={colorPrimario} />)}
            </div>
          </section>
        )}
        <div className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-600">Carta online</p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-gray-950">{catActiva ? categorias.find((cat) => cat.id === catActiva)?.nombre || 'Menu' : 'Todo el menu'}</h2>
        </div>
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

      {totalItems > 0 && (
        <button
          onClick={() => setCarritoOpen(true)}
          className="fixed bottom-4 left-4 right-4 z-[120] flex h-16 items-center justify-between rounded-2xl bg-[#111] px-5 text-white shadow-2xl md:hidden"
        >
          <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest">
            <ShoppingCart size={18} />
            {totalItems} item{totalItems === 1 ? '' : 's'}
          </span>
          <span className="text-lg font-black">{fmt(total)}</span>
        </button>
      )}

      {popupVisible && popupContent && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPopupVisible(false)} />
          <div className="relative grid w-full max-w-3xl overflow-hidden rounded-[36px] bg-white shadow-2xl md:grid-cols-[0.95fr,1.05fr]">
            <button onClick={() => setPopupVisible(false)} className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 text-gray-900 shadow">
              <X size={20} />
            </button>
            <div className="min-h-[240px] bg-[#111]">
              {popupContent.imagen ? (
                <img src={popupContent.imagen} alt={popupContent.titulo} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-[240px] items-center justify-center text-5xl font-black text-white/20">MS</div>
              )}
            </div>
            <div className="flex flex-col justify-center p-8 md:p-10">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-red-600">Promo destacada</p>
              <h3 className="text-3xl font-black uppercase leading-none text-gray-950 md:text-4xl">{popupContent.titulo}</h3>
              {popupContent.descripcion ? <p className="mt-4 text-sm font-semibold leading-6 text-gray-500">{popupContent.descripcion}</p> : null}
              {popupContent.precio_texto ? <p className="mt-5 text-3xl font-black text-red-600">{popupContent.precio_texto}</p> : null}
              <button
                onClick={() => {
                  setPopupVisible(false);
                  handleAction(popupContent.accion_tipo, popupContent.accion_valor);
                }}
                className="mt-7 inline-flex h-14 w-fit items-center gap-3 rounded-2xl bg-red-600 px-6 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-red-100 transition hover:bg-red-700"
              >
                {popupContent.boton_texto || 'Ver promo'}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5D87FF]">Ubicación exacta</p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
                              Sirve para que el delivery navegue mejor y el seguimiento sea más preciso.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={captureCustomerLocation}
                            disabled={customerGeo.loading}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-[11px] font-black uppercase tracking-widest text-[#5D87FF] shadow-sm disabled:opacity-60"
                          >
                            <LocateFixed size={16} />
                            {customerGeo.loading ? 'Ubicando...' : customerGeo.ready ? 'Actualizar GPS' : 'Usar mi ubicación'}
                          </button>
                        </div>
                        {customerGeo.ready ? (
                          <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-emerald-600">
                            Ubicación cargada para el tracking
                          </p>
                        ) : null}
                      </div>
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
            {!variantesCompletas ? (
              <p className="mt-2 shrink-0 text-center text-[10px] font-black uppercase tracking-widest text-amber-500">
                Elegi una opcion para continuar
              </p>
            ) : null}
            <button
              onClick={() => addToCart(variantModal.producto, variantModal.sel, variantModal.extrasSel)}
              disabled={!variantesCompletas}
              className={`mt-4 shrink-0 w-full h-16 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all ${
                variantesCompletas
                  ? 'bg-[#5D87FF] text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              Agregar al pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


