import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { addMinutes, differenceInMinutes, format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '../lib/api.js';
import { socketManager } from '../lib/socket.js';
import {
  Bike,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  CookingPot,
  ExternalLink,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Store,
  XCircle,
} from 'lucide-react';
import { paymentStatusLabel } from '../lib/paymentStatus.js';
import { normalizePedidoItems } from '../lib/pedidoItems.js';

const ESTADOS = [
  { key: 'nuevo', label: 'Recibido', hint: 'Lo acabamos de tomar', icon: CircleDashed },
  { key: 'confirmado', label: 'Confirmado', hint: 'Tu pedido ya entro en cola', icon: CheckCircle2 },
  { key: 'preparando', label: 'Preparando', hint: 'Lo estamos cocinando ahora', icon: CookingPot },
  { key: 'listo', label: 'Listo', hint: 'Ya esta preparado', icon: PackageCheck },
  { key: 'en_camino', label: 'En camino', hint: 'Va rumbo a tu direccion', icon: Bike },
  { key: 'entregado', label: 'Entregado', hint: 'Pedido finalizado', icon: CheckCircle2 },
];

const cardClass = 'rounded-2xl border border-gray-200 bg-white shadow-lg';

function money(value) {
  return `$${Number(value || 0).toLocaleString('es-AR')}`;
}

function tipoEntregaLabel(tipo) {
  if (tipo === 'delivery') return 'Delivery';
  if (tipo === 'retiro') return 'Retiro en local';
  if (tipo === 'mesa') return 'Mesa';
  return 'Pedido';
}

function estimateLabel(pedido) {
  if (!pedido?.creado_en) return 'Sin estimacion';

  const created = parseISO(pedido.creado_en);
  const nowLabel = formatDistanceToNowStrict(created, { addSuffix: true, locale: es });

  if (pedido.estado === 'cancelado') return 'Pedido cancelado';
  if (pedido.estado === 'entregado') return 'Pedido entregado';
  if (pedido.estado === 'en_camino') return 'Tu pedido ya esta saliendo';
  if (pedido.estado === 'listo') return 'Ya esta listo para entregar';

  return `Pedido creado ${nowLabel}`;
}

function baseMinutes(pedido, config) {
  if (pedido?.tipo_entrega === 'delivery') return Number(pedido.tiempo_estimado_min || config.tiempo_delivery || 30);
  if (pedido?.tipo_entrega === 'retiro') return Number(config.tiempo_retiro || 20);
  return Number(config.tiempo_delivery || 30);
}

function estimateMinutesRemaining(pedido, config) {
  if (pedido?.eta_min_dinamico !== undefined && pedido?.eta_min_dinamico !== null) {
    return Number(pedido.eta_min_dinamico || 0);
  }
  if (!pedido?.creado_en) return null;
  if (pedido.estado === 'cancelado' || pedido.estado === 'entregado') return 0;

  const created = parseISO(pedido.creado_en);
  const elapsed = Math.max(0, differenceInMinutes(new Date(), created));
  const base = baseMinutes(pedido, config);

  if (pedido.estado === 'nuevo') return Math.max(base, 10);
  if (pedido.estado === 'confirmado') return Math.max(base - 2, 8);
  if (pedido.estado === 'preparando') return Math.max(base - elapsed, 6);
  if (pedido.estado === 'listo') return pedido.tipo_entrega === 'delivery' ? 10 : 5;
  if (pedido.estado === 'en_camino') return pedido.tipo_entrega === 'delivery' ? 8 : 2;

  return Math.max(base - elapsed, 5);
}

function riderMapUrl(repartidor) {
  if (!repartidor?.latitud || !repartidor?.longitud) return '';
  const lat = Number(repartidor.latitud);
  const lng = Number(repartidor.longitud);
  const delta = 0.008;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`;
}

export default function SeguimientoPedido() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [pedido, setPedido] = useState(null);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        if (mounted) setLoading(true);
        
        // Cargar pedido con token si está disponible
        const pedidoUrl = token 
          ? `/pedidos/${id}?token=${encodeURIComponent(token)}`
          : `/pedidos/${id}`;
          
        const [pedidoData, configData] = await Promise.all([
          api.get(pedidoUrl),
          api.get('/configuracion'),
        ]);
        
        if (!mounted) return;
        setPedido(pedidoData);
        setConfig(configData);
        setError('');
      } catch (err) {
        if (!mounted) return;
        setError('No encontramos ese pedido. Verifica el link o escribinos por WhatsApp.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 15000);

    // Conectar socket y unirse a room de tracking si tenemos token
    let cleanupSocket = null;
    
    if (token) {
      socketManager.connect();
      socketManager.joinTracking(id, token).catch(() => {
        // Silenciar errores de tracking, el polling sigue funcionando
      });
      
      cleanupSocket = socketManager.on('pedido_actualizado', (updated) => {
        if (String(updated.id) === String(id)) {
          setPedido(updated);
        }
      });
      
      socketManager.on('repartidor_ubicacion', (repartidor) => {
        setPedido((prev) => {
          if (!prev?.repartidor_id || String(prev.repartidor_id) !== String(repartidor.id)) {
            return prev;
          }
          return {
            ...prev,
            repartidor,
          };
        });
      });
    }

    return () => {
      mounted = false;
      clearInterval(interval);
      if (cleanupSocket) cleanupSocket();
      socketManager.disconnect();
    };
  }, [id, token]);

  const currentStep = useMemo(() => {
    if (!pedido) return -1;
    return ESTADOS.findIndex((estado) => estado.key === pedido.estado);
  }, [pedido]);

  const tiempoEstimado = useMemo(() => {
    if (!pedido) return '';
    if (pedido.estado === 'cancelado') return 'Este pedido fue cancelado';
    if (pedido.estado === 'entregado') return 'Tu pedido ya fue entregado';
    const minutes = estimateMinutesRemaining(pedido, config);
    if (minutes === null) return 'Sin estimacion';
    if (pedido.estado === 'en_camino') return `Llega aprox en ${minutes} min`;
    if (pedido.tipo_entrega === 'delivery') return `${minutes} min estimados`;
    if (pedido.tipo_entrega === 'retiro') return `${minutes} min estimados`;
    return 'Preparacion en curso';
  }, [pedido, config]);

  const llegadaEstimada = useMemo(() => {
    if (!pedido || pedido.estado === 'cancelado' || pedido.estado === 'entregado') return '';
    const minutes = estimateMinutesRemaining(pedido, config);
    if (minutes === null) return '';
    return format(addMinutes(new Date(), minutes), 'HH:mm');
  }, [pedido, config]);

  const progressPercent = useMemo(() => {
    if (!pedido || pedido.estado === 'cancelado' || currentStep < 0) return 0;
    return Math.round((currentStep / (ESTADOS.length - 1)) * 100);
  }, [pedido, currentStep]);

  const items = useMemo(() => {
    return normalizePedidoItems(pedido?.items);
  }, [pedido]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-600">Seguimiento en vivo</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Tu pedido</h1>
            <p className="mt-2 text-sm text-gray-500">Revisa el estado del pedido y el avance de la entrega.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <RefreshCw size={15} />
              Actualizar
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Volver al menu
            </Link>
          </div>
        </div>

        {loading ? (
          <div className={`${cardClass} p-10 text-center text-gray-400`}>
            Cargando seguimiento...
          </div>
        ) : error ? (
          <div className={`${cardClass} p-10 text-center`}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <XCircle size={28} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">No pudimos abrir el pedido</h2>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.45fr,0.95fr]">
            <section className={`${cardClass} overflow-hidden`}>
              <div className="border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white px-6 py-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Pedido #{pedido.numero}</p>
                    <h2 className="mt-2 text-2xl font-bold text-gray-900">{tipoEntregaLabel(pedido.tipo_entrega)}</h2>
                    <p className="mt-2 text-sm text-gray-500">{estimateLabel(pedido)}</p>
                  </div>
                  <div className={`rounded-full px-4 py-2 text-sm font-bold ${
                    pedido.estado === 'cancelado'
                      ? 'bg-rose-100 text-rose-700'
                      : pedido.estado === 'entregado'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-orange-100 text-orange-700'
                  }`}>
                    {pedido.estado.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
                <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Clock3 size={16} className="text-orange-500" />
                    Tiempo estimado
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{tiempoEstimado}</p>
                  {pedido.tipo_entrega === 'delivery' && pedido.delivery_zona ? (
                    <p className="mt-2 text-sm text-gray-500">Zona detectada: {pedido.delivery_zona}</p>
                  ) : null}
                  {pedido.tipo_entrega === 'delivery' && pedido.distancia_repartidor_km ? (
                    <p className="mt-1 text-sm text-gray-500">Repartidor a {pedido.distancia_repartidor_km} km aprox</p>
                  ) : null}
                  {pedido.tipo_entrega === 'delivery' && pedido.ubicacion_repartidor_atrasada ? (
                    <p className="mt-1 text-xs font-semibold text-amber-700">La ultima ubicacion del repartidor ya tiene varios minutos; el ETA puede variar.</p>
                  ) : null}
                  {llegadaEstimada ? (
                    <p className="mt-2 text-sm text-gray-500">Llegada aproximada a las {llegadaEstimada}</p>
                  ) : null}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                      <span>Progreso</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {ESTADOS.map((estado, index) => {
                    const active = currentStep >= index && pedido.estado !== 'cancelado';
                    const current = pedido.estado === estado.key;
                    const Icon = estado.icon;

                    return (
                      <div key={estado.key} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${
                            active ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-300 bg-white text-gray-400'
                          }`}>
                            <Icon size={18} />
                          </div>
                          {index < ESTADOS.length - 1 ? (
                            <div className={`mt-2 h-10 w-0.5 ${active && currentStep > index ? 'bg-orange-400' : 'bg-slate-200'}`} />
                          ) : null}
                        </div>
                        <div className={`flex-1 rounded-xl border px-4 py-3 ${
                          current ? 'border-orange-200 bg-orange-50/70' : 'border-gray-200 bg-white'
                        }`}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-bold text-gray-900">{estado.label}</p>
                              <p className="mt-1 text-sm text-gray-500">{estado.hint}</p>
                            </div>
                            {current ? (
                              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">Actual</span>
                            ) : active ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Hecho</span>
                            ) : (
                              <ChevronRight size={18} className="text-slate-300" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {pedido.estado === 'cancelado' ? (
                  <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                    El pedido fue cancelado. Si necesitas ayuda, escribinos y lo revisamos juntos.
                  </div>
                ) : null}
              </div>
            </section>

            <aside className="space-y-6">
              <section className={`${cardClass} p-6`}>
                <h3 className="text-lg font-bold text-gray-900">Resumen</h3>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <span className="text-sm text-gray-500">Total</span>
                    <span className="font-bold text-gray-900">{money(pedido.total)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <span className="text-sm text-gray-500">Pago</span>
                    <span className="font-semibold capitalize text-gray-800">{pedido.metodo_pago === 'mercadopago' ? 'MercadoPago' : pedido.metodo_pago}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <span className="text-sm text-gray-500">Cobro</span>
                    <span className="font-semibold text-gray-800">{paymentStatusLabel(pedido.pago_estado)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <span className="text-sm text-gray-500">Entrega</span>
                    <span className="font-semibold text-gray-800">{tipoEntregaLabel(pedido.tipo_entrega)}</span>
                  </div>
                  {pedido.turno_operativo ? (
                    <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                      <span className="text-sm text-gray-500">Turno</span>
                      <span className="font-semibold text-gray-800">{pedido.turno_operativo}</span>
                    </div>
                  ) : null}
                  {pedido.tipo_entrega === 'delivery' && pedido.entrega_pin ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Codigo de entrega</p>
                      <p className="mt-1 text-2xl font-bold tracking-[0.2em] text-gray-900">{pedido.entrega_pin}</p>
                      <p className="mt-1 text-xs text-amber-800">Compartilo solo al recibir el pedido para validar la entrega.</p>
                    </div>
                  ) : null}
                  {pedido.estado === 'entregado' && pedido.entrega_foto ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Entrega validada</p>
                      <p className="mt-1 text-sm text-emerald-900">La entrega quedo registrada con comprobante de rider.</p>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className={`${cardClass} p-6`}>
                <h3 className="text-lg font-bold text-gray-900">Detalle</h3>
                <div className="mt-4 space-y-3">
                  {items.map((item, index) => (
                    <div key={`${item.nombre}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-gray-900">{item.cantidad}x {item.nombre}</p>
                          {item.descripcion ? <p className="mt-1 text-sm text-gray-500">{item.descripcion}</p> : null}
                        </div>
                        <span className="font-bold text-gray-900">{money(Number(item.precio_unitario || 0) * Number(item.cantidad || 0))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={`${cardClass} p-6`}>
                <h3 className="text-lg font-bold text-gray-900">Contacto</h3>
                <div className="mt-4 space-y-3 text-sm text-gray-600">
                  {pedido.cliente_nombre ? <p><strong>Cliente:</strong> {pedido.cliente_nombre}</p> : null}
                  {pedido.cliente_telefono ? <p><strong>Telefono:</strong> {pedido.cliente_telefono}</p> : null}
                  {pedido.cliente_direccion ? (
                    <div className="flex items-start gap-2">
                      <MapPin size={15} className="mt-0.5 text-orange-500" />
                      <span>{pedido.cliente_direccion}</span>
                    </div>
                  ) : null}
                  {config.negocio_telefono ? (
                    <div className="flex items-start gap-2">
                      <Store size={15} className="mt-0.5 text-orange-500" />
                      <span>{config.negocio_nombre || 'Modo Sabor'} - {config.negocio_telefono}</span>
                    </div>
                  ) : null}
                </div>
                {pedido.repartidor ? (
                  <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Delivery</p>
                    <p className="mt-2 font-bold text-gray-900">{pedido.repartidor.nombre}</p>
                    {pedido.repartidor.telefono ? <p className="mt-1 text-sm text-gray-600">Tel: {pedido.repartidor.telefono}</p> : null}
                    {pedido.repartidor.vehiculo ? <p className="mt-1 text-sm text-gray-600">Vehiculo: {pedido.repartidor.vehiculo}</p> : null}
                    {pedido.entrega_pin ? <p className="mt-2 text-sm font-semibold text-blue-900">PIN de validacion: {pedido.entrega_pin}</p> : null}
                    {pedido.repartidor.ultima_ubicacion_en ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Ultima ubicacion: {formatDistanceToNowStrict(parseISO(pedido.repartidor.ultima_ubicacion_en), { addSuffix: true, locale: es })}
                      </p>
                    ) : null}
                    {pedido.distancia_repartidor_km ? (
                      <p className="mt-1 text-xs text-gray-500">Distancia estimada: {pedido.distancia_repartidor_km} km</p>
                    ) : null}
                    {pedido.repartidor.latitud && pedido.repartidor.longitud ? (
                      <div className="mt-4 overflow-hidden rounded-xl border border-blue-100 bg-white">
                        <iframe
                          title="Mapa del delivery"
                          src={riderMapUrl(pedido.repartidor)}
                          className="h-48 w-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                        <div className="flex flex-wrap gap-2 px-3 py-3">
                          <a
                            href={`https://www.google.com/maps?q=${pedido.repartidor.latitud},${pedido.repartidor.longitud}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                          >
                            <MapPin size={15} />
                            Ver delivery
                          </a>
                          {pedido.cliente_direccion ? (
                            <a
                              href={pedido.cliente_latitud && pedido.cliente_longitud
                                ? `https://www.google.com/maps?q=${pedido.cliente_latitud},${pedido.cliente_longitud}`
                                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.cliente_direccion)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-gray-50"
                            >
                              <ExternalLink size={15} />
                              Abrir destino
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
