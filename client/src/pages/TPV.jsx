import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import {
  buildPedidoPayload,
  calculatePedidoSummary,
  createDeliveryQuoteState,
  createEmptyCustomer,
  getTpvSubmitError,
  normalizeText,
  safeParseArray,
} from '../lib/pedidoForm.js';
import TpvCatalog from '../components/TPV/TpvCatalog.jsx';
import TpvClientPickerModal from '../components/TPV/TpvClientPickerModal.jsx';
import TpvHeader from '../components/TPV/TpvHeader.jsx';
import TpvSidebar from '../components/TPV/TpvSidebar.jsx';
import TpvVariantModal from '../components/TPV/TpvVariantModal.jsx';

const PAGOS = ['efectivo', 'mercadopago', 'transferencia', 'modo', 'uala'];

function normalizeVariantSelection(variantes) {
  return Object.entries(variantes || {})
    .map(([groupName, option]) => ({
      groupName,
      optionName: option?.nombre || option || '',
      precio_extra: Number(option?.precio_extra || 0),
    }))
    .filter((entry) => entry.groupName && entry.optionName)
    .sort((a, b) => normalizeText(a.groupName).localeCompare(normalizeText(b.groupName)));
}

function normalizeExtraSelection(extras) {
  return [...(extras || [])]
    .map((extra) => ({
      nombre: extra?.nombre || '',
      precio: Number(extra?.precio || 0),
    }))
    .filter((extra) => extra.nombre)
    .sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)));
}

function buildCartKey(variantes, extras) {
  return JSON.stringify({
    variants: normalizeVariantSelection(variantes),
    extras: normalizeExtraSelection(extras),
  });
}

function buildVariantDescription(variantes, variantGroups = []) {
  const orderedEntries = variantGroups.length > 0
    ? variantGroups
      .map((group) => [group.nombre, variantes?.[group.nombre]])
      .filter(([, value]) => Boolean(value))
    : normalizeVariantSelection(variantes).map((entry) => [entry.groupName, { nombre: entry.optionName }]);

  return orderedEntries
    .map(([groupName, value]) => `${groupName}: ${value?.nombre || value}`)
    .join(', ');
}

function isEditableTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
}

export default function TPV() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchInputRef = useRef(null);
  const cartItemsRef = useRef(null);
  const customerLocationRequestRef = useRef(0);
  const customerLocationBusyRef = useRef(false);

  const [config, setConfig] = useState({});
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cajaAbierta, setCajaAbierta] = useState(true);
  const [catActiva, setCatActiva] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [items, setItems] = useState([]);
  const [tipoEntrega, setTipoEntrega] = useState('retiro');
  const [mesa, setMesa] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [descuentoTipo, setDescuentoTipo] = useState('monto');
  const [cliente, setCliente] = useState(createEmptyCustomer);
  const [clientePickerOpen, setClientePickerOpen] = useState(false);
  const [clientePickerSearch, setClientePickerSearch] = useState('');
  const [clientesCatalogo, setClientesCatalogo] = useState([]);
  const [loadingClientesCatalogo, setLoadingClientesCatalogo] = useState(false);
  const [repartidores, setRepartidores] = useState([]);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [descuento, setDescuento] = useState(0);
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [notas, setNotas] = useState('');
  const [variantModal, setVariantModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [printingMesa, setPrintingMesa] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(Boolean(document.fullscreenElement));
  const [lastAddedId, setLastAddedId] = useState(null);
  const [cartMobileOpen, setCartMobileOpen] = useState(false);
  const [deliveryQuote, setDeliveryQuote] = useState(() => createDeliveryQuoteState({ tipoEntrega: 'retiro' }));

  const playBeep = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const audioCtx = new AudioContext();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); 
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.warn('No se pudo reproducir el sonido:', e);
    }
  };

  useEffect(() => {
    if (cartItemsRef.current && items.length > 0) {
      cartItemsRef.current.scrollTo({
        top: cartItemsRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [items.length]);

  useEffect(() => {
    Promise.all([
      api.get('/categorias'),
      api.get('/productos?activo=1'),
      api.get('/configuracion'),
      api.get('/repartidores').catch(() => []),
      api.get('/caja/estado').catch(() => null),
    ])
      .then(([cats, prods, conf, reps, caja]) => {
        setConfig(conf);
        setCategorias(cats.filter((item) => item.activo));
        setProductos(prods);
        setRepartidores(reps.filter((item) => item.activo));
        if (caja) setCajaAbierta(Boolean(caja.activa));
      })
      .catch((error) => toast.error(error?.error || 'No se pudo cargar el TPV'));
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const tipo = searchParams.get('tipo');
    const mesaParam = searchParams.get('mesa');
    if (tipo && ['delivery', 'retiro', 'mesa'].includes(tipo)) setTipoEntrega(tipo);
    if (mesaParam) {
      setTipoEntrega('mesa');
      setMesa(mesaParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (tipoEntrega !== 'delivery') {
      setSelectedRiderId('');
    }
  }, [tipoEntrega]);

  useEffect(() => {
    if (tipoEntrega !== 'delivery') {
      setDeliveryQuote(createDeliveryQuoteState({ tipoEntrega, config }));
      return undefined;
    }

    const direccion = String(cliente.direccion || '').trim();
    if (!direccion) {
      setDeliveryQuote(createDeliveryQuoteState({ tipoEntrega: 'delivery', config }));
      return undefined;
    }

    setDeliveryQuote((previous) => ({
      ...previous,
      pending: true,
      message: 'Calculando envio...',
    }));

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const quote = await Promise.race([
          api.post('/configuracion/delivery/cotizar', { direccion }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]);
        if (cancelled) return;
        setDeliveryQuote({
          ...createDeliveryQuoteState({ tipoEntrega: 'delivery', config }),
          ...quote,
          pending: false,
        });
      } catch {
        if (cancelled) return;
        setDeliveryQuote(createDeliveryQuoteState({
          tipoEntrega: 'delivery',
          config,
          overrides: {
            costo_envio: Number(config.costo_envio_base || 0),
            available: true,
            message: 'No se pudo calcular la zona ahora',
          },
        }));
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tipoEntrega, cliente.direccion, config.costo_envio_base, config.tiempo_delivery, config.tiempo_retiro]);

  useEffect(() => {
    if (tipoEntrega === 'mesa' && clientePickerOpen) {
      setClientePickerOpen(false);
    }
  }, [clientePickerOpen, tipoEntrega]);

  useEffect(() => {
    if (!clientePickerOpen || tipoEntrega === 'mesa') return undefined;

    const timer = setTimeout(async () => {
      setLoadingClientesCatalogo(true);
      try {
        const query = String(clientePickerSearch || '').trim();
        const response = await api.get(`/clientes${query ? `?search=${encodeURIComponent(query)}` : ''}`);
        setClientesCatalogo((response || []).slice(0, 24));
      } catch (error) {
        toast.error(error?.error || 'No se pudieron cargar los clientes');
        setClientesCatalogo([]);
      } finally {
        setLoadingClientesCatalogo(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [clientePickerOpen, clientePickerSearch, tipoEntrega]);

  const productosFiltrados = useMemo(() => (
    productos.filter((producto) => {
      const matchCat = !catActiva || producto.categoria_id === catActiva;
      const matchSearch = !busqueda || normalizeText(producto.nombre).includes(normalizeText(busqueda));
      return matchCat && matchSearch;
    })
  ), [productos, catActiva, busqueda]);
  const repartidoresDisponibles = useMemo(
    () => repartidores.filter((item) => item.activo && (item.disponible || String(item.id) === String(selectedRiderId))),
    [repartidores, selectedRiderId]
  );
  const cartQtyByProductId = useMemo(() => items.reduce((acc, item) => {
    acc[item.producto_id] = Number(acc[item.producto_id] || 0) + Number(item.cantidad || 0);
    return acc;
  }, {}), [items]);

  const summary = useMemo(() => calculatePedidoSummary({
    items,
    tipoEntrega,
    deliveryQuote,
    descuento,
    descuentoTipo,
    metodoPago,
    efectivoRecibido,
  }), [items, tipoEntrega, deliveryQuote, descuento, descuentoTipo, metodoPago, efectivoRecibido]);
  const {
    subtotal,
    envio,
    descuentoAplicado,
    total,
    totalItems,
    efectivoRecibidoNumero,
    vuelto,
  } = summary;
  const variantesCompletas = !variantModal || variantModal.variantes.every((group) => Boolean(variantModal.sel[group.nombre]));
  const selectedVariantTotal = !variantModal
    ? 0
    : Number(variantModal.producto.precio || 0)
      + Object.values(variantModal.sel).reduce((sum, option) => sum + Number(option?.precio_extra || 0), 0)
      + variantModal.extrasSel.reduce((sum, extra) => sum + Number(extra.precio || 0), 0);
  const confirmDisabled = loading || items.length === 0 || (tipoEntrega === 'delivery' && (deliveryQuote.pending || !deliveryQuote.available));

  const limpiar = () => {
    setItems([]);
    setCliente(createEmptyCustomer());
    setClientePickerOpen(false);
    setClientePickerSearch('');
    setClientesCatalogo([]);
    setDescuento(0);
    setEfectivoRecibido('');
    setNotas('');
    setMesa('');
    setSelectedRiderId('');
    setDeliveryQuote(createDeliveryQuoteState({ tipoEntrega, config }));
  };

  const aplicarCliente = (match) => {
    setCliente((previous) => ({
      ...previous,
      nombre: match.nombre || previous.nombre,
      telefono: match.telefono || previous.telefono,
      direccion: match.direccion || previous.direccion,
      latitud: null,
      longitud: null,
    }));
    setClientePickerOpen(false);
  };

  const abrirSelectorClientes = () => {
    const initialSearch = String(cliente.telefono || cliente.nombre || '').trim();
    setClientePickerSearch(initialSearch);
    setClientePickerOpen(true);
  };

  const toggleBrowserFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.error('El navegador no permitio cambiar la pantalla completa');
    }
  };

  const volverAlPanel = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {}
    }
    navigate('/admin/dashboard');
  };

  const addToCart = (producto, variantes, extras, variantGroups = []) => {
    playBeep();
    const cartKey = buildCartKey(variantes, extras);
    const precioExtra = Object.values(variantes).reduce((sum, option) => sum + Number(option?.precio_extra || 0), 0)
      + extras.reduce((sum, extra) => sum + Number(extra.precio || 0), 0);
    const existingIndex = items.findIndex((item) => item.producto_id === producto.id && item.cartKey === cartKey);

    if (existingIndex !== -1) {
      const updatedItems = [...items];
      const targetId = updatedItems[existingIndex].id;
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        cantidad: updatedItems[existingIndex].cantidad + 1,
      };
      setItems(updatedItems);
      setLastAddedId(targetId);
    } else {
      const descripcionVariantes = buildVariantDescription(variantes, variantGroups);
      const descripcionExtras = extras.map((extra) => extra.nombre).join(', ');
      const newId = `${producto.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setItems((previous) => [
        ...previous,
        {
          id: newId,
          producto_id: producto.id,
          nombre: producto.nombre,
          precio_unitario: Number(producto.precio) + precioExtra,
          cantidad: 1,
          variantes,
          extras,
          cartKey,
          descripcion: [descripcionVariantes, descripcionExtras].filter(Boolean).join(' | '),
        },
      ]);
      setLastAddedId(newId);
    }

    toast.success(`Agregado: ${producto.nombre}`, { 
      duration: 800, 
      position: 'bottom-center',
      style: { borderRadius: '16px', fontWeight: 'bold', fontSize: '13px' }
    });
    setVariantModal(null);
    setTimeout(() => setLastAddedId(null), 800);
  };

  const agregarItem = (producto) => {
    if (producto.disponible_para_venta === false) {
      toast.error('Ese producto no tiene stock disponible');
      return;
    }

    const variantes = safeParseArray(producto.variantes);
    const extras = safeParseArray(producto.extras);
    if (variantes.length > 0 || extras.length > 0) {
      setVariantModal({ producto, variantes, extras, sel: {}, extrasSel: [] });
      return;
    }

    addToCart(producto, {}, []);
  };

  const seleccionarVariante = (groupName, option) => {
    setVariantModal((previous) => ({
      ...previous,
      sel: {
        ...previous.sel,
        [groupName]: typeof option === 'string' ? { nombre: option } : option,
      },
    }));
  };

  const toggleExtraVariante = (extra) => {
    setVariantModal((previous) => {
      const selected = previous.extrasSel.some((item) => item.nombre === extra.nombre);
      return {
        ...previous,
        extrasSel: selected
          ? previous.extrasSel.filter((item) => item.nombre !== extra.nombre)
          : [...previous.extrasSel, extra],
      };
    });
  };

  const cambiarCantidad = (id, delta) => {
    setItems((previous) => previous
      .map((item) => (item.id === id ? { ...item, cantidad: item.cantidad + delta } : item))
      .filter((item) => item.cantidad > 0));
  };

  const quitarItem = (id) => setItems((previous) => previous.filter((item) => item.id !== id));

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

  const abrirImpresion = async (pedidoId, popup) => {
    try {
      const response = await api.post(`/pedidos/${pedidoId}/imprimir`, { tipo: 'tpv_pack' });
      if (popup) {
        popup.document.open();
        popup.document.write(response.html);
        popup.document.close();
      } else {
        imprimirEnIframe(response.html);
      }
      toast.success(tipoEntrega === 'delivery' ? 'Comanda, ticket y hoja de reparto listos' : 'Comanda y ticket listos para imprimir');
    } catch (error) {
      if (popup) popup.close();
      toast.error(error?.error || 'No se pudieron generar los documentos');
    }
  };

  const imprimirPrecuentaMesa = async () => {
    if (!String(mesa || '').trim()) {
      toast.error('Indica una mesa para imprimir la precuenta');
      return;
    }

    setPrintingMesa(true);
    try {
      const response = await api.post(`/pedidos/mesa/${encodeURIComponent(String(mesa).trim())}/precuenta`, {});
      imprimirEnIframe(response.html);
      toast.success(`Precuenta lista para mesa ${mesa}`);
    } catch (error) {
      toast.error(error?.error || 'No se pudo generar la precuenta');
    } finally {
      setPrintingMesa(false);
    }
  };

  const confirmar = async (imprimir = false) => {
    const submitError = getTpvSubmitError({
      items,
      tipoEntrega,
      cliente,
      deliveryQuote,
      mesa,
      metodoPago,
      efectivoRecibido,
      efectivoRecibidoNumero,
      total,
    });
    if (submitError) return toast.error(submitError);

    const shouldAutoPrint = imprimir || config.impresion_auto_tpv === '1';
    let popup = null;

    if (imprimir) {
      popup = window.open('', '_blank', 'width=900,height=700');
      if (!popup) return toast.error('Permiti las ventanas emergentes para imprimir');
      popup.document.write('<p style="font-family: Arial, sans-serif; padding: 24px;">Preparando impresion...</p>');
      popup.document.close();
    }

    setLoading(true);
    try {
      const pedido = await api.post('/pedidos/interno', buildPedidoPayload({
        customer: cliente,
        items,
        summary,
        tipoEntrega,
        mesa,
        metodoPago,
        notas,
        origen: 'tpv',
        repartidorId: tipoEntrega === 'delivery' && selectedRiderId ? Number(selectedRiderId) : undefined,
      }));

      if (shouldAutoPrint) await abrirImpresion(pedido.id, popup);
      toast.success(shouldAutoPrint ? 'Pedido creado e impreso' : 'Pedido creado');
      limpiar();
    } catch (error) {
      if (popup) popup.close();
      toast.error(error?.error || 'Error al crear pedido');
    } finally {
      setLoading(false);
    }
  };

  const compartirUbicacionCliente = () => {
    if (!navigator.geolocation) {
      toast.error('Este dispositivo no permite geolocalizacion');
      return;
    }

    if (customerLocationBusyRef.current) {
      return;
    }

    customerLocationBusyRef.current = true;
    const requestId = customerLocationRequestRef.current + 1;
    customerLocationRequestRef.current = requestId;
    setSharingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (customerLocationRequestRef.current !== requestId) return;
        setCliente((previous) => ({
          ...previous,
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
        }));
        customerLocationBusyRef.current = false;
        setSharingLocation(false);
        toast.success('Ubicacion guardada', { id: 'tpv-customer-location' });
      },
      (error) => {
        if (customerLocationRequestRef.current !== requestId) return;
        customerLocationBusyRef.current = false;
        setSharingLocation(false);
        const denied = error?.code === 1;
        toast.error(
          denied ? 'El navegador bloqueo la ubicacion' : 'No se pudo obtener la ubicacion',
          { id: 'tpv-customer-location' }
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();

      if (event.key === 'Escape') {
        if (variantModal) {
          event.preventDefault();
          setVariantModal(null);
          return;
        }
        if (clientePickerOpen) {
          event.preventDefault();
          setClientePickerOpen(false);
          return;
        }
        if (document.fullscreenElement) {
          event.preventDefault();
          document.exitFullscreen().catch(() => {});
        }
        return;
      }

      if (isEditableTarget(event.target)) return;

      if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === 'F9') {
        event.preventDefault();
        toggleBrowserFullscreen();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        confirmar(Boolean(event.shiftKey));
        return;
      }

      if (event.altKey && key === 'p') {
        event.preventDefault();
        volverAlPanel();
        return;
      }

      if (event.altKey && ['1', '2', '3'].includes(event.key)) {
        event.preventDefault();
        setTipoEntrega(event.key === '1' ? 'retiro' : event.key === '2' ? 'delivery' : 'mesa');
        return;
      }

      if (event.altKey) {
        const paymentMap = { e: 'efectivo', m: 'mercadopago', t: 'transferencia', o: 'modo', u: 'uala' };
        if (paymentMap[key]) {
          event.preventDefault();
          setMetodoPago(paymentMap[key]);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [variantModal, clientePickerOpen, cliente, config, deliveryQuote, efectivoRecibidoNumero, items, mesa, metodoPago, total]);

  return (
    <div className="flex h-[100dvh] min-h-0 bg-[#F4F7FB] text-gray-900 font-sans">
      <div className="flex min-h-0 flex-1 flex-col">

        {/* ── Header Estilo Modernize ── */}
        <TpvHeader
          cajaAbierta={cajaAbierta}
          isBrowserFullscreen={isBrowserFullscreen}
          onBack={volverAlPanel}
          onGoCaja={() => navigate('/admin/caja')}
          onToggleFullscreen={toggleBrowserFullscreen}
        />

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <TpvCatalog
            busqueda={busqueda}
            cartQtyByProductId={cartQtyByProductId}
            catActiva={catActiva}
            categorias={categorias}
            onAddItem={agregarItem}
            onBusquedaChange={setBusqueda}
            onCatActivaChange={setCatActiva}
            onOpenCart={() => setCartMobileOpen(true)}
            productosFiltrados={productosFiltrados}
            searchInputRef={searchInputRef}
            total={total}
            totalItems={totalItems}
          />
          <TpvSidebar
            cartItemsRef={cartItemsRef}
            cartMobileOpen={cartMobileOpen}
            cliente={cliente}
            confirmDisabled={confirmDisabled}
            config={config}
            deliveryQuote={deliveryQuote}
            descuento={descuento}
            descuentoAplicado={descuentoAplicado}
            descuentoTipo={descuentoTipo}
            efectivoRecibido={efectivoRecibido}
            envio={envio}
            items={items}
            lastAddedId={lastAddedId}
            loading={loading}
            mesa={mesa}
            metodoPago={metodoPago}
            onAbrirSelectorClientes={abrirSelectorClientes}
            onCambiarCantidad={cambiarCantidad}
            onCerrarCartMobile={() => setCartMobileOpen(false)}
            onClearCliente={() => setCliente(createEmptyCustomer())}
            onClearOrder={() => {
              limpiar();
              setCartMobileOpen(false);
            }}
            onConfirm={() => confirmar(false)}
            onConfirmPrint={() => confirmar(true)}
            onDescuentoChange={setDescuento}
            onDescuentoTipoChange={setDescuentoTipo}
            onEfectivoRecibidoChange={setEfectivoRecibido}
            onImprimirMesa={imprimirPrecuentaMesa}
            onMetodoPagoChange={setMetodoPago}
            onQuitarItem={quitarItem}
            onSeleccionarRider={setSelectedRiderId}
            onSetCliente={setCliente}
            onSetMesa={setMesa}
            onTipoEntregaChange={setTipoEntrega}
            onUbicacionCliente={compartirUbicacionCliente}
            pagos={PAGOS}
            printingMesa={printingMesa}
            repartidoresDisponibles={repartidoresDisponibles}
            selectedRiderId={selectedRiderId}
            sharingLocation={sharingLocation}
            subtotal={subtotal}
            tipoEntrega={tipoEntrega}
            total={total}
            totalItems={totalItems}
            vuelto={vuelto}
          />
        </div>
      </div>
      {clientePickerOpen ? (
        <TpvClientPickerModal
          clientesCatalogo={clientesCatalogo}
          loadingClientesCatalogo={loadingClientesCatalogo}
          onApplyCliente={aplicarCliente}
          onClose={() => setClientePickerOpen(false)}
          onSearchChange={setClientePickerSearch}
          search={clientePickerSearch}
        />
      ) : null}

      {/* ── Modal de variantes / extras ── */}
      {variantModal ? (
        <TpvVariantModal
          onAddToCart={() => addToCart(variantModal.producto, variantModal.sel, variantModal.extrasSel, variantModal.variantes)}
          onClose={() => setVariantModal(null)}
          onSelectVariant={seleccionarVariante}
          onToggleExtra={toggleExtraVariante}
          selectedVariantTotal={selectedVariantTotal}
          variantesCompletas={variantesCompletas}
          variantModal={variantModal}
        />
      ) : null}
    </div>
  );
}

