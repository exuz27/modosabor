import { useEffect, useMemo, useState, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Cake,
  Download,
  Eye,
  Gift,
  LayoutGrid,
  List,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  Trash2,
  UserRound,
  X,
  TrendingUp,
  MessageCircle,
  Mail,
  History,
  CreditCard,
  CheckCircle2,
  Ticket,
  Camera,
  User,
  Settings,
  QrCode,
  Copy,
  ExternalLink
} from 'lucide-react';
import api from '../lib/api.js';
import { useAppConfig } from '../context/AppConfigContext.jsx';
import { ToggleSwitch } from '../components/Configuracion/ConfigComponents.jsx';
import ClientesCampaignsSection from '../components/Clientes/ClientesCampaignsSection.jsx';
import ClientesGrid from '../components/Clientes/ClientesGrid.jsx';

// Importación de Avatars Locales
import user1 from '../image/profile/user-1.jpg';
import user2 from '../image/profile/user-2.jpg';
import user3 from '../image/profile/user-3.jpg';
import user4 from '../image/profile/user-4.jpg';
import user5 from '../image/profile/user-5.jpg';
import user6 from '../image/profile/user-6.jpg';
import user7 from '../image/profile/user-7.jpg';
import user8 from '../image/profile/user-8.jpg';
import user9 from '../image/profile/user-9.jpg';
import user10 from '../image/profile/user-10.jpg';
import user11 from '../image/profile/user-11.jpg';
import user12 from '../image/profile/user-12.jpg';

const LOCAL_AVATARS = [user1, user2, user3, user4, user5, user6, user7, user8, user9, user10, user11, user12];

const CONTROL = 'h-12 w-full rounded-2xl border-none bg-gray-50 px-4 text-sm font-bold text-gray-700 outline-none transition focus:ring-2 focus:ring-[#5D87FF]/20';

const LEVEL_COLORS = {
  Bronce: '#b45309',
  Plata: '#94a3b8',
  Oro: '#FFAE1F',
  Platino: '#5D87FF'
};

const DEFAULT_CAMPAIGN_DASHBOARD = {
  campanas: 0,
  clientes: 0,
  enviados_ok: 0,
  convertidos: 0,
  ingreso: 0,
  tasa_conversion: 0,
  tasa_envio: 0,
};

const CAMPAIGN_HISTORY_FILTERS = [
  { value: 'Todos', label: 'Todos' },
  { value: 'Convertidas', label: 'Convertidas' },
  { value: 'Sin convertir', label: 'Sin convertir' },
  { value: 'Con error', label: 'Con error' },
];

const SEGMENT_CAMPAIGN_COPY = {
  'premio-listo': {
    filter: 'Premio listo',
    title: 'Premio listo',
    message: (negocio) => `Hola, tienes un premio listo para canjear en ${negocio}. Cuando quieras, te ayudamos a aprovecharlo.`,
  },
  vip: {
    filter: 'VIP',
    title: 'VIP',
    message: (negocio) => `Hola, queremos agradecerte por ser cliente VIP de ${negocio}. Tenemos un beneficio especial preparado para ti.`,
  },
  riesgo: {
    filter: 'En riesgo',
    title: 'En riesgo',
    message: (negocio) => `Hola, te extrañamos en ${negocio}. Queremos invitarte a volver con una propuesta especial.`,
  },
  nuevo: {
    filter: 'Nuevo',
    title: 'Nuevos',
    message: (negocio) => `Hola, gracias por sumarte a ${negocio}. Queremos darte la bienvenida con un beneficio especial.`,
  },
};

const fmtMoney = (v) => `$${Number(v || 0).toLocaleString('es-AR')}`;

const summarizeCampaignMetrics = (results = [], totalClientes = 0) => {
  const safeResults = Array.isArray(results) ? results : [];
  const enviadosOk = safeResults.filter((item) => item?.ok).length;
  const enviadosError = safeResults.length - enviadosOk;
  const enviadosManual = safeResults.filter((item) => item?.mode === 'manual').length;
  const enviadosApi = safeResults.filter((item) => item?.mode === 'api').length;
  const enviadosLocal = safeResults.filter((item) => item?.mode === 'local').length;
  const total = Number(totalClientes || safeResults.length || 0);
  const cobertura = total > 0 ? Number(((safeResults.length / total) * 100).toFixed(1)) : 0;
  const tasaEnvio = safeResults.length > 0 ? Number(((enviadosOk / safeResults.length) * 100).toFixed(1)) : 0;

  return {
    total_clientes: total,
    procesados: safeResults.length,
    enviados_ok: enviadosOk,
    enviados_error: enviadosError,
    enviados_manual: enviadosManual,
    enviados_api: enviadosApi,
    enviados_local: enviadosLocal,
    cobertura,
    tasa_envio: tasaEnvio,
    clientes_convertidos: 0,
    pedidos_generados: 0,
    ingreso_generado: 0,
    tasa_conversion: 0,
    ventana_dias: 30,
  };
};

const aggregateCampaignDashboard = (history = [], fallback = DEFAULT_CAMPAIGN_DASHBOARD) => {
  if (!history.length) return fallback;

  const summary = history.reduce((acc, item) => {
    acc.campanas += 1;
    acc.clientes += Number(item.metricas?.total_clientes || item.total_clientes || 0);
    acc.enviados_ok += Number(item.metricas?.enviados_ok || item.enviados_ok || 0);
    acc.convertidos += Number(item.metricas?.clientes_convertidos || 0);
    acc.ingreso += Number(item.metricas?.ingreso_generado || 0);
    return acc;
  }, { ...DEFAULT_CAMPAIGN_DASHBOARD });

  return {
    ...summary,
    tasa_conversion: summary.clientes > 0 ? Number(((summary.convertidos / summary.clientes) * 100).toFixed(1)) : 0,
    tasa_envio: summary.clientes > 0 ? Number(((summary.enviados_ok / summary.clientes) * 100).toFixed(1)) : 0,
  };
};

const matchesHistoryFilter = (item, filter) => {
  if (filter === 'Convertidas') return Number(item.metricas?.clientes_convertidos || 0) > 0;
  if (filter === 'Sin convertir') return Number(item.metricas?.clientes_convertidos || 0) === 0;
  if (filter === 'Con error') return Number(item.metricas?.enviados_error || item.enviados_error || 0) > 0;
  return true;
};

function StatCard({ label, value, icon: Icon, tint = 'blue' }) {
  const tints = {
    blue: 'bg-blue-50 text-[#5D87FF]',
    amber: 'bg-amber-50 text-[#FFAE1F]',
    rose: 'bg-rose-50 text-[#FA896B]',
    emerald: 'bg-emerald-50 text-[#13DEB9]',
    sky: 'bg-sky-50 text-[#49BEFF]'
  };
  return (
    <div className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-black text-gray-900">{value}</p>
        </div>
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${tints[tint]}`}>
          <Icon size={22} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM = { 
  nombre: '', 
  telefono: '', 
  direccion: '', 
  fecha_nacimiento: '', 
  notas: '', 
  avatar_url: '',
  fidelizacion_activa: true 
};

export default function Clientes() {
  const { config: branding } = useAppConfig();
  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('Todos');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [filtroBeneficio, setFiltroBeneficio] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [modal, setModal] = useState(null); 
  const [configModal, setConfigModal] = useState(false);
  const [campaignModal, setCampaignModal] = useState(null);
  const [campaignMessage, setCampaignMessage] = useState('');
  const [campaignTemplates, setCampaignTemplates] = useState({});
  const [campaignHistory, setCampaignHistory] = useState([]);
  const [campaignDashboard, setCampaignDashboard] = useState(null);
  const [campaignSegmentStats, setCampaignSegmentStats] = useState([]);
  const [campaignTopCampaign, setCampaignTopCampaign] = useState(null);
  const [campaignHistoryFilter, setCampaignHistoryFilter] = useState('Todos');
  const [campaignVariables, setCampaignVariables] = useState([]);
  const [campaignSending, setCampaignSending] = useState(false);
  const [canManageFidelidadConfig, setCanManageFidelidadConfig] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fidelidadConfig, setFidelidadConfig] = useState({
    monto_minimo_sello: 10000,
    sellos_para_premio: 6,
    premio_descripcion: '1 Pizza Muzzarella',
    activo: true
  });
  const fileInputRef = useRef(null);
  const sellosParaPremio = Math.max(1, Number(fidelidadConfig.sellos_para_premio) || 1);

  const formatPedidoDate = (value) => {
    if (!value) return 'Fecha sin registrar';
    try {
      return format(parseISO(value), 'dd MMM yyyy');
    } catch {
      return 'Fecha invalida';
    }
  };

  const getDaysSince = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  };

  const getClienteEstado = (cliente) => {
    if (cliente?.estado_segmento) return cliente.estado_segmento;
    const dias = getDaysSince(cliente.ultima_compra);
    if (dias == null) return 'nuevo';
    if (dias >= 30) return 'en-riesgo';
    if (dias >= 15) return 'por-reactivar';
    return 'activo';
  };

  const getEstadoBadge = (cliente) => {
    const estado = getClienteEstado(cliente);
    if (estado === 'premio-listo') {
      return { label: 'Premio listo', className: 'bg-emerald-50 text-emerald-600' };
    }
    if (estado === 'vip') {
      return { label: 'VIP', className: 'bg-amber-50 text-amber-500' };
    }
    if (estado === 'recurrente') {
      return { label: 'Recurrente', className: 'bg-blue-50 text-[#5D87FF]' };
    }
    if (estado === 'perdido') {
      return { label: 'Perdido', className: 'bg-gray-100 text-gray-500' };
    }
    if (estado === 'riesgo') {
      return { label: 'En riesgo', className: 'bg-rose-50 text-rose-500' };
    }
    if (estado === 'perdido' || estado === 'riesgo' || estado === 'en-riesgo') {
      return { label: 'En riesgo', className: 'bg-rose-50 text-rose-500' };
    }
    if (estado === 'por-reactivar') {
      return { label: 'Por reactivar', className: 'bg-amber-50 text-amber-500' };
    }
    if (estado === 'nuevo') {
      return { label: 'Nuevo', className: 'bg-sky-50 text-sky-500' };
    }
    return { label: 'Activo', className: 'bg-emerald-50 text-emerald-600' };
  };

  const getPrimaryPhoneLink = (telefono) => `tel:${String(telefono || '').replace(/\D/g, '')}`;

  const buildActivityTimeline = (cliente) => {
    const items = [];

    if (cliente.recompensas_pendientes > 0) {
      items.push({
        id: 'reward-ready',
        title: 'Premio disponible',
        subtitle: `${cliente.recompensas_pendientes} recompensa${cliente.recompensas_pendientes > 1 ? 's' : ''} lista${cliente.recompensas_pendientes > 1 ? 's' : ''} para canjear`,
        tone: 'emerald',
      });
    }

    if (cliente.ultima_compra) {
      const dias = getDaysSince(cliente.ultima_compra);
      items.push({
        id: 'last-order',
        title: 'Ultima compra',
        subtitle: `${formatPedidoDate(cliente.ultima_compra)}${dias != null ? ` · hace ${dias} día${dias === 1 ? '' : 's'}` : ''}`,
        tone: 'blue',
      });
    }

    if (cliente.fecha_nacimiento) {
      const birthMonthDay = String(cliente.fecha_nacimiento).slice(5, 10);
      const todayMonthDay = new Date().toISOString().slice(5, 10);
      items.push({
        id: 'birthday',
        title: birthMonthDay === todayMonthDay ? 'Cumple hoy' : 'Cumple registrado',
        subtitle: cliente.fecha_nacimiento,
        tone: birthMonthDay === todayMonthDay ? 'amber' : 'sky',
      });
    }

    if (!cliente.fidelizacion_activa) {
      items.push({
        id: 'loyalty-off',
        title: 'Fidelizacion desactivada',
        subtitle: 'Este cliente no esta acumulando beneficios en este momento',
        tone: 'rose',
      });
    }

    return items;
  };

  const getTimelineTone = (tone) => {
    if (tone === 'emerald') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (tone === 'amber') return 'bg-amber-50 text-amber-500 border-amber-100';
    if (tone === 'rose') return 'bg-rose-50 text-rose-500 border-rose-100';
    if (tone === 'sky') return 'bg-sky-50 text-sky-500 border-sky-100';
    return 'bg-blue-50 text-[#5D87FF] border-blue-100';
  };

  const getRecoveryMessage = (cliente) => {
    if (!cliente) return '';
    const estado = getClienteEstado(cliente);
    if (estado === 'en-riesgo') {
      return `Hola ${cliente.nombre || ''}, te extrañamos en ${branding.negocio_nombre || 'Modo Sabor'}. Queremos invitarte a volver con un beneficio especial.`;
    }
    if (estado === 'por-reactivar') {
      return `Hola ${cliente.nombre || ''}, hace unos dias que no te vemos por ${branding.negocio_nombre || 'Modo Sabor'}. Si quieres, te reservamos tu promo favorita.`;
    }
    if (estado === 'premio-listo') {
      return `Hola ${cliente.nombre || ''}, ya tienes un premio listo para canjear en ${branding.negocio_nombre || 'Modo Sabor'}. Cuando quieras, te ayudamos a aprovecharlo.`;
    }
    if (estado === 'vip') {
      return `Hola ${cliente.nombre || ''}, gracias por ser parte de nuestros clientes VIP en ${branding.negocio_nombre || 'Modo Sabor'}. Tenemos un beneficio especial preparado para ti.`;
    }
    return `Hola ${cliente.nombre || ''}, gracias por seguir eligiendo ${branding.negocio_nombre || 'Modo Sabor'}. Tenemos novedades y beneficios para ti.`;
  };

  const getClienteCardCode = (cliente) => {
    if (!cliente) return '';
    return cliente.codigo_tarjeta || `MS-${String(cliente.id).padStart(6, '0')}-${Number(cliente.canjes_premio || 0) + 1}`;
  };

  const insertCampaignVariable = (key) => {
    setCampaignMessage((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}{{${key}}}`);
  };

  const cargar = async (query = '') => {
    setLoading(true);
    try {
      const [resClientes, resConfig] = await Promise.allSettled([
        api.get(`/clientes${query ? `?search=${encodeURIComponent(query)}` : ''}`),
        api.get('/fidelizacion/config')
      ]);

      if (resClientes.status !== 'fulfilled') {
        throw resClientes.reason;
      }

      setClientes(resClientes.value);

      if (resConfig.status === 'fulfilled') {
        setFidelidadConfig(resConfig.value);
        setCanManageFidelidadConfig(true);
      } else {
        setCanManageFidelidadConfig(false);
      }
    } catch {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    const cargarCampanas = async () => {
      try {
        const res = await api.get('/clientes/campanas/personalizadas/config');
        setCampaignTemplates(res.templates || {});
        setCampaignHistory(res.history || []);
        setCampaignDashboard(res.dashboard || null);
        setCampaignSegmentStats(res.segmentos || []);
        setCampaignTopCampaign(res.top_campaign || null);
        setCampaignVariables(res.variables || []);
      } catch {
        // Mantener funcional el modulo aunque falle la carga secundaria.
      }
    };
    cargarCampanas();
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return clientes.filter(c => {
      const estado = getClienteEstado(c);
      const hasReward = Number(c.recompensas_pendientes || 0) > 0;
      const fidelidadActiva = Boolean(c.fidelizacion_activa);

      const matchesTerm =
        c.nombre.toLowerCase().includes(term) ||
        c.telefono.includes(term) ||
        (c.codigo_tarjeta && c.codigo_tarjeta.toLowerCase().includes(term));

      const matchesNivel = filtroNivel === 'Todos' || c.nivel === filtroNivel;
      const matchesEstado =
        filtroEstado === 'Todos' ||
        (filtroEstado === 'VIP' && estado === 'vip') ||
        (filtroEstado === 'Premio listo' && estado === 'premio-listo') ||
        (filtroEstado === 'Recurrente' && estado === 'recurrente') ||
        (filtroEstado === 'Activo' && estado === 'activo') ||
        (filtroEstado === 'Por reactivar' && estado === 'por-reactivar') ||
        (filtroEstado === 'En riesgo' && ['en-riesgo', 'riesgo'].includes(estado)) ||
        (filtroEstado === 'Perdido' && estado === 'perdido') ||
        (filtroEstado === 'Nuevo' && estado === 'nuevo');
      const matchesBeneficio =
        filtroBeneficio === 'Todos' ||
        (filtroBeneficio === 'Con premio' && hasReward) ||
        (filtroBeneficio === 'Fidelizacion activa' && fidelidadActiva) ||
        (filtroBeneficio === 'Fidelizacion pausada' && !fidelidadActiva);

      return matchesTerm && matchesNivel && matchesEstado && matchesBeneficio;
    });
  }, [clientes, search, filtroNivel, filtroEstado, filtroBeneficio]);

  const stats = useMemo(() => ({
    total: clientes.length,
    vip: clientes.filter(c => getClienteEstado(c) === 'vip').length,
    ltv: clientes.reduce((acc, c) => acc + Number(c.total_gastado || 0), 0)
  }), [clientes]);

  const segmentHighlights = useMemo(() => ([
    {
      key: 'premio-listo',
      label: 'Premio listo',
      count: clientes.filter(c => getClienteEstado(c) === 'premio-listo').length,
      filter: 'Premio listo',
      tone: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      icon: Gift,
      cta: 'Canjear y avisar'
    },
    {
      key: 'vip',
      label: 'VIP',
      count: clientes.filter(c => getClienteEstado(c) === 'vip').length,
      filter: 'VIP',
      tone: 'bg-amber-50 text-amber-500 border-amber-100',
      icon: Star,
      cta: 'Beneficio premium'
    },
    {
      key: 'riesgo',
      label: 'En riesgo',
      count: clientes.filter(c => ['riesgo', 'en-riesgo'].includes(getClienteEstado(c))).length,
      filter: 'En riesgo',
      tone: 'bg-rose-50 text-rose-500 border-rose-100',
      icon: AlertTriangle,
      cta: 'Recuperar'
    },
    {
      key: 'nuevo',
      label: 'Nuevos',
      count: clientes.filter(c => getClienteEstado(c) === 'nuevo').length,
      filter: 'Nuevo',
      tone: 'bg-sky-50 text-sky-500 border-sky-100',
      icon: UserRound,
      cta: 'Dar bienvenida'
    }
  ]), [clientes]);

  const getSegmentMessage = (segmento) => {
    if (campaignTemplates?.[segmento]) return campaignTemplates[segmento];
    return SEGMENT_CAMPAIGN_COPY[segmento]?.message(branding.negocio_nombre || 'Modo Sabor') || '';
  };

  const getSegmentCandidates = (segmento) => clientes.filter((cliente) => {
    const estado = getClienteEstado(cliente);
    if (segmento === 'riesgo') return ['riesgo', 'en-riesgo'].includes(estado);
    return estado === segmento;
  }).filter((cliente) => cliente.telefono);

  const launchSegmentCampaign = (segmento) => {
    const candidates = getSegmentCandidates(segmento);

    if (!candidates.length) {
      toast.error('No hay clientes con telefono para ese segmento');
      return;
    }

    setFiltroEstado(SEGMENT_CAMPAIGN_COPY[segmento]?.filter || 'Todos');
    setCampaignMessage(getSegmentMessage(segmento));
    setCampaignModal({
      segment: segmento,
      title: SEGMENT_CAMPAIGN_COPY[segmento]?.title || segmentHighlights.find((item) => item.key === segmento)?.label || 'Campana',
      clients: candidates,
      selectedIds: candidates.map((cliente) => cliente.id),
      metrics: null,
    });
  };

  const saveCampaignTemplate = async () => {
    if (!campaignModal?.segment) return;
    try {
      await api.put(`/clientes/campanas/personalizadas/template/${campaignModal.segment}`, {
        mensaje: campaignMessage,
      });
      setCampaignTemplates((prev) => ({ ...prev, [campaignModal.segment]: campaignMessage }));
      toast.success('Plantilla guardada');
    } catch (err) {
      toast.error(err?.error || 'No se pudo guardar la plantilla');
    }
  };

  const registerCampaignHistory = async () => {
    if (!campaignModal?.segment) return;
    const selectedIds = campaignModal.selectedIds || [];
    if (!selectedIds.length) {
      toast.error('Selecciona al menos un cliente');
      return;
    }

    try {
      const item = await api.post('/clientes/campanas/personalizadas/historial', {
        segmento: campaignModal.segment,
        titulo: campaignModal.title,
        mensaje: campaignMessage,
        cliente_ids: selectedIds,
        total_clientes: selectedIds.length,
      });
      setCampaignHistory((prev) => [item, ...prev].slice(0, 12));
      setCampaignModal((prev) => prev ? { ...prev, historyId: item.id, lastResult: item.ultimo_resultado || [], metrics: item.metricas || summarizeCampaignMetrics(item.ultimo_resultado, item.total_clientes) } : prev);
      toast.success('Campaña registrada en historial');
    } catch (err) {
      toast.error(err?.error || 'No se pudo registrar la campaña');
    }
  };

  const reopenCampaignFromHistory = (item) => {
    const historyClientIds = Array.isArray(item.cliente_ids) ? item.cliente_ids.map((id) => Number(id)) : [];
    const historyClients = clientes.filter((cliente) => historyClientIds.includes(Number(cliente.id)));
    if (!historyClients.length) {
      toast.error('No se encontraron clientes vigentes para esta campaña');
      return;
    }

    setCampaignMessage(item.mensaje || getSegmentMessage(item.segmento));
    setCampaignModal({
      historyId: item.id,
      segment: item.segmento,
      title: item.titulo || item.segmento,
      clients: historyClients,
      selectedIds: historyClients.map((cliente) => cliente.id),
      lastResult: item.ultimo_resultado || [],
      metrics: item.metricas || summarizeCampaignMetrics(item.ultimo_resultado, item.total_clientes),
    });
  };

  const sendCampaign = async () => {
    if (!campaignModal?.selectedIds?.length) {
      toast.error('Selecciona al menos un cliente');
      return;
    }

    setCampaignSending(true);
    try {
      let historyId = campaignModal.historyId || null;

      if (!historyId) {
        const historyItem = await api.post('/clientes/campanas/personalizadas/historial', {
          segmento: campaignModal.segment,
          titulo: campaignModal.title,
          mensaje: campaignMessage,
          cliente_ids: campaignModal.selectedIds,
          total_clientes: campaignModal.selectedIds.length,
        });
        historyId = historyItem.id;
        setCampaignHistory((prev) => [historyItem, ...prev].slice(0, 12));
        setCampaignModal((prev) => prev ? { ...prev, historyId, metrics: historyItem.metricas || summarizeCampaignMetrics(historyItem.ultimo_resultado, historyItem.total_clientes) } : prev);
      }

      const res = await api.post('/clientes/campanas/personalizadas/enviar', {
        segmento: campaignModal.segment,
        mensaje: campaignMessage,
        cliente_ids: campaignModal.selectedIds,
        history_id: historyId,
      });

      if (historyId) {
        setCampaignHistory((prev) => prev.map((item) => item.id === historyId ? {
          ...item,
          enviados_ok: res.enviados_ok,
          enviados_error: res.enviados_error,
          ultimo_resultado: res.results,
          metricas: res.metricas,
        } : item));
      }

      setCampaignModal((prev) => prev ? { ...prev, historyId, lastResult: res.results, metrics: res.metricas } : prev);
      toast.success(`Campaña procesada: ${res.enviados_ok} ok, ${res.enviados_error} con error`);
    } catch (err) {
      toast.error(err?.error || 'No se pudo procesar la campaña');
    } finally {
      setCampaignSending(false);
    }
  };

  const getCardQuickAction = (cliente) => {
    const estado = getClienteEstado(cliente);
    if (estado === 'premio-listo') return { label: 'Avisar premio', href: `${getPrimaryPhoneLink(cliente.telefono)}?text=${encodeURIComponent(getRecoveryMessage(cliente))}`, icon: Gift };
    if (estado === 'vip') return { label: 'Enviar VIP', href: `${getPrimaryPhoneLink(cliente.telefono)}?text=${encodeURIComponent(getRecoveryMessage(cliente))}`, icon: Star };
    if (['riesgo', 'en-riesgo', 'perdido'].includes(estado)) return { label: 'Recuperar', href: `${getPrimaryPhoneLink(cliente.telefono)}?text=${encodeURIComponent(getRecoveryMessage(cliente))}`, icon: MessageCircle };
    if (estado === 'nuevo') return { label: 'Bienvenida', href: `${getPrimaryPhoneLink(cliente.telefono)}?text=${encodeURIComponent(getRecoveryMessage(cliente))}`, icon: UserRound };
    return { label: 'Contactar', href: `${getPrimaryPhoneLink(cliente.telefono)}?text=${encodeURIComponent(getRecoveryMessage(cliente))}`, icon: Phone };
  };

  const openCampaignPreview = () => {
    if (!campaignModal?.clients?.length) {
      toast.error('No hay clientes disponibles para esta campaña');
      return;
    }
    const firstClient = campaignModal.clients.find((cliente) => campaignModal.selectedIds?.includes(cliente.id));
    if (!firstClient) {
      toast.error('Selecciona al menos un cliente');
      return;
    }
    window.open(`${getPrimaryPhoneLink(firstClient.telefono)}?text=${encodeURIComponent(campaignMessage)}`, '_blank');
  };

  const abrirDetalle = async (c) => {
    try {
      const res = await api.get(`/clientes/${c.id}`);
      setDetalle(res);
    } catch { toast.error('Error'); }
  };

  const handleEdit = (c) => {
    setForm({
      id: c.id,
      nombre: c.nombre || '',
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      fecha_nacimiento: c.fecha_nacimiento || '',
      notas: c.notas || '',
      avatar_url: c.avatar_url || '',
      fidelizacion_activa: c.fidelizacion_activa
    });
    setModal('editar');
    setDetalle(null);
  };

  const save = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio');
    setSaving(true);
    try {
      if (modal === 'nuevo') {
        await api.post('/clientes', form);
        toast.success('Cliente creado correctamente');
      } else {
        await api.put(`/clientes/${form.id}`, form);
        toast.success('Cliente actualizado');
      }
      setModal(null);
      setForm(EMPTY_FORM);
      cargar();
    } catch (err) {
      toast.error(err?.error || 'Error al guardar cliente');
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    if (!canManageFidelidadConfig) {
      toast.error('No tienes permisos para editar la configuracion de fidelidad');
      return;
    }
    setSaving(true);
    try {
      await api.put('/fidelizacion/config', fidelidadConfig);
      toast.success('Configuración de fidelidad actualizada');
      setConfigModal(false);
    } catch (err) {
      toast.error(err?.error || 'Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const deleteCliente = async (id) => {
    if (!window.confirm('¿Seguro deseas eliminar este cliente?')) return;
    try {
      await api.delete(`/clientes/${id}`);
      toast.success('Eliminado');
      setDetalle(null);
      cargar();
    } catch { toast.error('Error al eliminar'); }
  };

  const canjearPremio = async (id) => {
    if (!window.confirm('¿Confirmas el canje de la recompensa por sellos?')) return;
    try {
      const updated = await api.post(`/clientes/${id}/canjear-regalo`);
      toast.success('¡Recompensa canjeada correctamente!');
      setDetalle(updated);
      cargar();
    } catch (err) {
      toast.error(err?.error || 'No se pudo canjear');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('imagen', file);
    
    try {
      const res = await api.post('/productos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm((prev) => ({ ...prev, avatar_url: res.url }));
      toast.success('Imagen cargada');
    } catch (err) {
      toast.error('Error al subir imagen');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const AvatarDisplay = ({ url, nombre, size = 'h-24 w-24' }) => {
    if (url) {
      return <img src={url} className={`${size} rounded-2xl object-cover shadow-lg`} alt={nombre} />;
    }
    return (
      <div className={`${size} rounded-2xl flex items-center justify-center font-black text-3xl text-white shadow-lg bg-gray-400`}>
        {nombre?.[0]?.toUpperCase() || <User />}
      </div>
    );
  };

  const detalleTimeline = detalle?.timeline?.length ? detalle.timeline : (detalle ? buildActivityTimeline(detalle) : []);
  const detalleDirecciones = detalle?.direcciones || [];
  const detalleDireccionPrincipal = detalleDirecciones.find((direccion) => direccion.principal) || detalleDirecciones[0] || null;
  const detalleEstado = detalle ? getEstadoBadge(detalle) : null;
  const detalleCardCode = detalle ? getClienteCardCode(detalle) : '';
  const campaignMetrics = campaignModal?.metrics || summarizeCampaignMetrics(campaignModal?.lastResult, campaignModal?.selectedIds?.length || campaignModal?.clients?.length || 0);
  const campaignDashboardStats = useMemo(
    () => aggregateCampaignDashboard(campaignHistory, campaignDashboard || DEFAULT_CAMPAIGN_DASHBOARD),
    [campaignDashboard, campaignHistory]
  );
  const filteredCampaignHistory = useMemo(
    () => campaignHistory.filter((item) => matchesHistoryFilter(item, campaignHistoryFilter)),
    [campaignHistory, campaignHistoryFilter]
  );

  return (
    <div className="min-h-screen bg-[#F4F7FB] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Header Seccion */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-1 bg-[#5D87FF] rounded-full"></div>
              <p className="text-sm font-black text-[#5D87FF] uppercase tracking-[0.3em]">CRM & Fidelización</p>
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Comunidad Modo Sabor</h1>
            <p className="mt-1 text-gray-500 font-medium">Gestiona tu base de clientes y premia su lealtad.</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => {
                if (!canManageFidelidadConfig) {
                  toast.error('No tienes permisos para ver la configuracion de fidelidad');
                  return;
                }
                setConfigModal(true);
              }} 
              className={`h-12 w-12 flex items-center justify-center rounded-2xl bg-white border border-gray-100 text-gray-400 shadow-sm transition-all ${canManageFidelidadConfig ? 'hover:text-[#5D87FF]' : 'cursor-not-allowed opacity-60'}`}
              title="Configuración de Fidelidad"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={() => { setForm(EMPTY_FORM); setModal('nuevo'); }} 
              className="flex h-12 items-center gap-2 rounded-2xl bg-[#5D87FF] text-white px-6 text-sm font-black shadow-lg shadow-blue-100 active:scale-95 transition-all"
            >
              <Plus size={18} strokeWidth={3} />
              NUEVO CLIENTE
            </button>
            <button onClick={() => cargar()} className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white border border-gray-100 text-gray-400 shadow-sm">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Metricas VIP */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
          <StatCard label="Clientes Totales" value={stats.total} icon={UserRound} tint="blue" />
          <StatCard label="Miembros VIP" value={stats.vip} icon={Star} tint="amber" />
          <StatCard label="Ventas Acumuladas" value={fmtMoney(stats.ltv)} icon={TrendingUp} tint="emerald" />
        </div>

        {/* Buscador y Filtros */}
        <div className="rounded-[32px] bg-white p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono o código MS..." 
              className={CONTROL + " pl-12 bg-[#F4F7FB]"}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <select 
              value={filtroNivel} 
              onChange={e => setFiltroNivel(e.target.value)}
              className="h-12 px-6 rounded-2xl bg-[#F4F7FB] border-none text-sm font-bold text-gray-600 outline-none focus:ring-2 focus:ring-[#5D87FF]/20"
            >
              <option value="Todos">Todos los niveles</option>
              {Object.keys(LEVEL_COLORS).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="h-12 px-6 rounded-2xl bg-[#F4F7FB] border-none text-sm font-bold text-gray-600 outline-none focus:ring-2 focus:ring-[#5D87FF]/20"
            >
              <option value="Todos">Todos los estados</option>
              <option value="VIP">Solo VIP</option>
              <option value="Premio listo">Premio listo</option>
              <option value="Recurrente">Recurrentes</option>
              <option value="Activo">Activos</option>
              <option value="Por reactivar">Por reactivar</option>
              <option value="En riesgo">En riesgo</option>
              <option value="Perdido">Perdidos</option>
              <option value="Nuevo">Nuevos</option>
            </select>
            <select
              value={filtroBeneficio}
              onChange={e => setFiltroBeneficio(e.target.value)}
              className="h-12 px-6 rounded-2xl bg-[#F4F7FB] border-none text-sm font-bold text-gray-600 outline-none focus:ring-2 focus:ring-[#5D87FF]/20"
            >
              <option value="Todos">Todos los beneficios</option>
              <option value="Con premio">Con premio listo</option>
              <option value="Fidelizacion activa">Fidelizacion activa</option>
              <option value="Fidelizacion pausada">Fidelizacion pausada</option>
            </select>
          </div>
        </div>

        <ClientesCampaignsSection
          segmentHighlights={segmentHighlights}
          setFiltroEstado={setFiltroEstado}
          launchSegmentCampaign={launchSegmentCampaign}
          campaignDashboardStats={campaignDashboardStats}
          campaignSegmentStats={campaignSegmentStats}
          campaignTopCampaign={campaignTopCampaign}
          formatPedidoDate={formatPedidoDate}
          fmtMoney={fmtMoney}
          campaignModal={campaignModal}
          getSegmentMessage={getSegmentMessage}
          setCampaignMessage={setCampaignMessage}
          sendCampaign={sendCampaign}
          campaignSending={campaignSending}
          setCampaignModal={setCampaignModal}
          campaignVariables={campaignVariables}
          insertCampaignVariable={insertCampaignVariable}
          campaignMessage={campaignMessage}
          copyToClipboard={copyToClipboard}
          openCampaignPreview={openCampaignPreview}
          saveCampaignTemplate={saveCampaignTemplate}
          registerCampaignHistory={registerCampaignHistory}
          getPrimaryPhoneLink={getPrimaryPhoneLink}
          campaignMetrics={campaignMetrics}
          campaignHistoryFilter={campaignHistoryFilter}
          setCampaignHistoryFilter={setCampaignHistoryFilter}
          campaignHistoryFilters={CAMPAIGN_HISTORY_FILTERS}
          filteredCampaignHistory={filteredCampaignHistory}
          reopenCampaignFromHistory={reopenCampaignFromHistory}
        />

        <ClientesGrid
          filtered={filtered}
          abrirDetalle={abrirDetalle}
          AvatarDisplay={AvatarDisplay}
          getEstadoBadge={getEstadoBadge}
          fmtMoney={fmtMoney}
          sellosParaPremio={sellosParaPremio}
          getCardQuickAction={getCardQuickAction}
          toast={toast}
        />
      </div>

      {/* Modal Configuración Fidelidad */}
      {configModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-md" onClick={() => setConfigModal(false)}>
           <div className="w-full max-w-lg rounded-[40px] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Configuración de Lealtad</h3>
                <button onClick={() => setConfigModal(false)} className="rounded-full p-2 hover:bg-gray-100"><X size={24} className="text-gray-400" /></button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                  <div>
                    <p className="text-sm font-black text-gray-900 uppercase">Sistema Activo</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Habilitar sellos y puntos globalmente</p>
                  </div>
                  <ToggleSwitch checked={fidelidadConfig.activo} onChange={v => setFidelidadConfig({...fidelidadConfig, activo: v})} color="blue" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Monto Mín. Sello ($)</label>
                    <input type="number" value={fidelidadConfig.monto_minimo_sello} onChange={e => setFidelidadConfig({...fidelidadConfig, monto_minimo_sello: Number(e.target.value)})} className={CONTROL + " mt-1"} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sellos p/ Premio</label>
                    <input type="number" value={fidelidadConfig.sellos_para_premio} onChange={e => setFidelidadConfig({...fidelidadConfig, sellos_para_premio: Number(e.target.value)})} className={CONTROL + " mt-1"} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Descripción del Premio (Bases)</label>
                  <textarea value={fidelidadConfig.premio_descripcion} onChange={e => setFidelidadConfig({...fidelidadConfig, premio_descripcion: e.target.value})} className={CONTROL + " mt-1 h-24 py-3 resize-none"} placeholder="Ej: 1 Pizza Muzzarella gratis" />
                </div>

                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-black text-[#5D87FF] uppercase tracking-widest mb-1">Regla de Negocio</p>
                  <p className="text-xs font-bold text-gray-600 leading-relaxed italic">
                    "Los clientes sumarán 1 sello por cada compra mayor a {fmtMoney(fidelidadConfig.monto_minimo_sello)}. Al completar {fidelidadConfig.sellos_para_premio} sellos, ganarán: {fidelidadConfig.premio_descripcion}."
                  </p>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setConfigModal(false)} className="flex-1 h-12 rounded-2xl border border-gray-200 text-xs font-black text-gray-500 uppercase">Cancelar</button>
                <button onClick={saveConfig} disabled={saving} className="flex-[2] h-12 rounded-2xl bg-[#5D87FF] text-white text-xs font-black uppercase shadow-lg shadow-blue-100">
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Modal Alta/Edición Cliente - CORREGIDO CON SCROLL Y Z-INDEX */}
      {modal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-md" onClick={() => setModal(null)}>
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-[40px] bg-white shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            {/* Header del Modal */}
            <div className="shrink-0 p-8 pb-4 flex items-center justify-between border-b border-gray-50">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-1 bg-[#5D87FF] rounded-full"></div>
                  <p className="text-xs font-black text-[#5D87FF] uppercase tracking-[0.2em]">{modal === 'nuevo' ? 'Nuevo Registro' : 'Editar Ficha'}</p>
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Datos del Cliente</h3>
              </div>
              <button onClick={() => setModal(null)} className="rounded-full p-2 hover:bg-gray-100 transition-colors">
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            {/* Contenido Scrollable */}
            <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-6 no-scrollbar">
              {/* Selector de Avatar */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <AvatarDisplay url={form.avatar_url} nombre={form.nombre} size="h-28 w-24" />
                  <button 
                    onClick={() => fileInputRef.current.click()}
                    className="absolute -bottom-2 -right-2 h-10 w-10 bg-[#5D87FF] text-white rounded-xl border-4 border-white shadow-lg flex items-center justify-center hover:bg-[#4570EA] transition-all active:scale-90"
                  >
                    <Camera size={18} />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
                
                <div className="space-y-2 w-full text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">O selecciona uno predeterminado</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {LOCAL_AVATARS.map((av, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setForm({ ...form, avatar_url: av })}
                        className={`h-10 w-10 rounded-xl overflow-hidden border-2 transition-all ${form.avatar_url === av ? 'border-[#5D87FF] scale-110 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      >
                        <img src={av} className="h-full w-full object-cover" alt="avatar" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                  <input 
                    value={form.nombre} 
                    onChange={e => setForm({ ...form, nombre: e.target.value })} 
                    placeholder="Ej: Juan Perez" 
                    className={CONTROL + " mt-1"} 
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Teléfono</label>
                    <input 
                      value={form.telefono} 
                      onChange={e => setForm({ ...form, telefono: e.target.value })} 
                      placeholder="Ej: 1122334455" 
                      className={CONTROL + " mt-1"} 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cumpleaños</label>
                    <input 
                      type="date"
                      value={form.fecha_nacimiento} 
                      onChange={e => setForm({ ...form, fecha_nacimiento: e.target.value })} 
                      className={CONTROL + " mt-1"} 
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Dirección Principal</label>
                  <input 
                    value={form.direccion} 
                    onChange={e => setForm({ ...form, direccion: e.target.value })} 
                    placeholder="Ej: Calle Falsa 123" 
                    className={CONTROL + " mt-1"} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Notas Internas</label>
                  <textarea 
                    value={form.notas} 
                    onChange={e => setForm({ ...form, notas: e.target.value })} 
                    placeholder="Gustos, preferencias, referencias..." 
                    className={CONTROL + " mt-1 h-24 py-3 resize-none"} 
                  />
                </div>
              </div>
            </div>

            {/* Footer del Modal (Fijo) */}
            <div className="shrink-0 p-8 pt-4 border-t border-gray-50 flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 h-14 rounded-2xl border border-gray-200 text-sm font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 transition-all">
                CANCELAR
              </button>
              <button 
                onClick={save} 
                disabled={saving} 
                className="flex-[2] h-14 rounded-2xl bg-[#5D87FF] text-sm font-black text-white uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-[#4570EA] active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Cliente + TARJETA DIGITAL DE FIDELIDAD */}
      {detalle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={() => setDetalle(null)}>
          <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-[40px] bg-white shadow-2xl animate-in zoom-in-95 duration-200 no-scrollbar" onClick={e => e.stopPropagation()}>
            <div className="h-32 bg-gradient-to-r from-[#5D87FF] to-[#49BEFF]" />
            <div className="px-8 pb-8">
              <div className="flex justify-between items-end -mt-12 mb-6">
                <div className="h-24 w-24 rounded-[32px] border-4 border-white bg-gray-100 shadow-lg overflow-hidden">
                  <AvatarDisplay url={detalle.avatar_url} nombre={detalle.nombre} size="w-full h-full" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.open(getPrimaryPhoneLink(detalle.telefono), '_blank')} className="h-11 w-11 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-[#13DEB9] shadow-sm hover:bg-emerald-50"><MessageCircle size={20} /></button>
                  <button onClick={() => copyToClipboard(detalle.telefono || '')} className="h-11 w-11 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-[#5D87FF] shadow-sm hover:bg-blue-50"><Copy size={18} /></button>
                  <button onClick={() => handleEdit(detalle)} className="h-11 px-6 rounded-2xl bg-gray-900 text-white text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all">EDITAR</button>
                  <button onClick={() => deleteCliente(detalle.id)} className="h-11 w-11 rounded-2xl bg-rose-50 text-rose-500 border border-rose-100 flex items-center justify-center hover:bg-rose-100 transition-all"><Trash2 size={18} /></button>
                </div>
              </div>

              <div className="mb-8 relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#5D87FF] to-[#49BEFF] rounded-[32px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white border border-gray-100 rounded-[32px] p-6 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      {branding.negocio_logo ? (
                        <img src={branding.negocio_logo} className="h-10 w-10 object-contain" alt="logo" />
                      ) : (
                        <div className="h-10 w-10 bg-[#5D87FF] rounded-xl flex items-center justify-center text-white font-black italic">MS</div>
                      )}
                      <div>
                        <p className="text-[10px] font-black text-[#5D87FF] uppercase tracking-[0.2em] leading-none">Tarjeta de Lealtad</p>
                        <p className="text-lg font-black text-gray-900 tracking-tight leading-none mt-1 uppercase">{branding.negocio_nombre || 'Modo Sabor'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">N° Tarjeta</p>
                      <p className="text-sm font-mono font-bold text-gray-800 leading-none mt-1">MS-{String(detalle.id).padStart(6, '0')}-{detalle.canjes_premio + 1}</p>
                    </div>
                  </div>

                  <div
                    className="grid gap-3 mb-6"
                    style={{ gridTemplateColumns: `repeat(${sellosParaPremio + 1}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: sellosParaPremio }, (_, index) => index + 1).map((num) => {
                      const isStamped = (detalle.sellos_actuales || 0) >= num;
                      return (
                        <div key={num} className="flex flex-col items-center gap-2">
                          <div className={`h-12 w-12 rounded-full border-2 border-dashed flex items-center justify-center transition-all duration-500 ${isStamped ? 'border-[#5D87FF] bg-blue-50 text-[#5D87FF] scale-110 shadow-lg' : 'border-gray-200 text-gray-200'}`}>
                            {isStamped ? <CheckCircle2 size={24} strokeWidth={3} /> : <div className="h-2 w-2 rounded-full bg-gray-100" />}
                          </div>
                          <span className={`text-[8px] font-black uppercase ${isStamped ? 'text-[#5D87FF]' : 'text-gray-300'}`}>{num}</span>
                        </div>
                      );
                    })}
                    <div className="flex flex-col items-center gap-2">
                      <div className={`h-12 w-12 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${detalle.recompensas_pendientes > 0 ? 'bg-[#13DEB9] border-emerald-100 text-white animate-bounce shadow-xl' : 'border-[#13DEB9]/20 text-[#13DEB9]/20 bg-[#13DEB9]/5'}`}>
                        <Gift size={24} strokeWidth={3} />
                      </div>
                      <span className="text-[8px] font-black uppercase text-[#13DEB9]">GRATIS</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-gray-800 truncate uppercase tracking-tight">{detalle.nombre}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{detalle.telefono}</p>
                    </div>
                    {detalle.recompensas_pendientes > 0 && (
                      <button 
                        onClick={() => canjearPremio(detalle.id)}
                        className="h-10 px-6 rounded-xl bg-[#13DEB9] text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-100 hover:bg-[#0EB795] active:scale-95 transition-all"
                      >
                        CANJEAR AHORA
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
                <div className="rounded-[24px] bg-[#F4F7FB] p-5 text-center">
                  <Star className="mx-auto text-amber-500 mb-2" size={24} fill="#FFAE1F" />
                  <p className="text-[10px] font-black text-gray-400 uppercase">Puntos</p>
                  <p className="text-lg font-black text-gray-800">{detalle.puntos || 0} pts</p>
                </div>
                <div className="rounded-[24px] bg-[#F4F7FB] p-5 text-center">
                  <CreditCard className="mx-auto text-[#5D87FF] mb-2" size={24} />
                  <p className="text-[10px] font-black text-gray-400 uppercase">Total Canjes</p>
                  <p className="text-lg font-black text-gray-800">{detalle.canjes_premio || 0}</p>
                </div>
                <div className="rounded-[24px] bg-[#F4F7FB] p-5 text-center">
                  <History className="mx-auto text-rose-500 mb-2" size={24} />
                  <p className="text-[10px] font-black text-gray-400 uppercase">Frecuencia</p>
                  <p className="text-lg font-black text-gray-800">~{detalle.frecuencia_dias || 7} días</p>
                </div>
                <div className="rounded-[24px] bg-[#F4F7FB] p-5 text-center">
                  <AlertTriangle className="mx-auto text-[#5D87FF] mb-2" size={24} />
                  <p className="text-[10px] font-black text-gray-400 uppercase">Estado CRM</p>
                  <p className="text-lg font-black text-gray-800">{getEstadoBadge(detalle).label}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Ficha 360</h4>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${detalleEstado.className}`}>
                        {detalleEstado.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-[24px] bg-[#F4F7FB] p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Contacto principal</p>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-white flex items-center justify-center text-[#13DEB9] shadow-sm">
                            <Phone size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-gray-900 truncate">{detalle.telefono || 'Sin telefono'}</p>
                            <button onClick={() => window.open(getPrimaryPhoneLink(detalle.telefono), '_blank')} className="text-[10px] font-black uppercase tracking-widest text-[#5D87FF] hover:underline">
                              Llamar
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-[24px] bg-[#F4F7FB] p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cumpleanos</p>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-white flex items-center justify-center text-amber-500 shadow-sm">
                            <Cake size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-gray-900 truncate">{detalle.fecha_nacimiento || 'No registrado'}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Dato para campanas y beneficios</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-[24px] bg-[#F4F7FB] p-4 sm:col-span-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Direccion principal</p>
                        <div className="mt-3 flex items-start gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-white flex items-center justify-center text-[#5D87FF] shadow-sm shrink-0">
                            <MapPin size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-gray-900">{detalleDireccionPrincipal?.direccion || detalle.direccion || 'Sin direccion cargada'}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                              {detalleDireccionPrincipal?.etiqueta || 'Principal'}
                              {detalleDireccionPrincipal?.referencia ? ` · ${detalleDireccionPrincipal.referencia}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {detalle.notas ? (
                      <div className="mt-4 rounded-[24px] border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Notas internas</p>
                        <p className="mt-2 text-sm font-medium text-gray-700">{detalle.notas}</p>
                      </div>
                    ) : null}
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <button onClick={() => copyToClipboard(detalleCardCode)} className="flex items-center justify-center gap-2 rounded-[20px] border border-gray-100 bg-[#F4F7FB] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-700 transition-all hover:border-blue-100 hover:text-[#5D87FF]">
                        <QrCode size={16} />
                        Copiar tarjeta
                      </button>
                      <button onClick={() => copyToClipboard(getRecoveryMessage(detalle))} className="flex items-center justify-center gap-2 rounded-[20px] border border-gray-100 bg-[#F4F7FB] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-700 transition-all hover:border-emerald-100 hover:text-[#13DEB9]">
                        <Copy size={16} />
                        Copiar mensaje
                      </button>
                      <button onClick={() => copyToClipboard(getRecoveryMessage(detalle))} className="flex items-center justify-center gap-2 rounded-[20px] border border-gray-100 bg-[#F4F7FB] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-700 transition-all hover:border-emerald-100 hover:text-[#13DEB9]">
                        <ExternalLink size={16} />
                        Copiar mensaje CRM
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4">Actividad y Retencion</h4>
                    <div className="space-y-3">
                      {detalleTimeline.length > 0 ? detalleTimeline.map((item) => (
                        <div key={item.id} className={`rounded-[24px] border px-4 py-4 ${getTimelineTone(item.tone)}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-widest">{item.title}</p>
                              <p className="mt-1 text-sm font-bold leading-relaxed">{item.subtitle}</p>
                            </div>
                            {item.fecha ? (
                              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest opacity-70">
                                {formatPedidoDate(item.fecha)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-[24px] border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
                          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Sin actividad destacada</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Direcciones</h4>
                      <span className="text-[9px] font-black text-[#5D87FF] uppercase tracking-widest">{detalleDirecciones.length || 0} cargadas</span>
                    </div>
                    <div className="space-y-3">
                      {detalleDirecciones.length > 0 ? detalleDirecciones.map((direccion) => (
                        <div key={direccion.id} className="rounded-[24px] bg-[#F4F7FB] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-black uppercase tracking-widest text-gray-800">{direccion.etiqueta || 'Direccion'}</p>
                            {direccion.principal ? (
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-[#5D87FF]">Principal</span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm font-bold text-gray-700">{direccion.direccion}</p>
                          {direccion.referencia ? <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{direccion.referencia}</p> : null}
                        </div>
                      )) : (
                        <p className="text-center py-4 text-xs font-bold text-gray-400 uppercase bg-gray-50 rounded-2xl border border-dashed border-gray-200">Sin direcciones registradas</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Últimos Pedidos</h4>
                  <button className="text-[9px] font-black text-[#5D87FF] uppercase tracking-widest hover:underline">Ver Historial</button>
                </div>
                {detalle.pedidos?.length > 0 ? detalle.pedidos.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 bg-gray-50/50 hover:bg-white hover:border-gray-100 transition-all cursor-default">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-xs font-black shadow-sm border border-gray-50">#{p.numero}</div>
                      <div>
                        <p className="text-xs font-black text-gray-800">{formatPedidoDate(p.creado_en)}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">{p.estado}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-gray-900">{fmtMoney(p.total)}</p>
                      <p className="text-[9px] font-bold text-[#5D87FF] uppercase tracking-tighter leading-none">+{(p.total * 0.05).toFixed(0)} pts</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-center py-4 text-xs font-bold text-gray-400 uppercase bg-gray-50 rounded-2xl border border-dashed border-gray-200">Sin pedidos registrados</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


