import { useEffect, useMemo, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowDownCircle,
  Banknote,
  CreditCard,
  PackageMinus,
  Plus,
  Pencil,
  Receipt,
  Trash2,
  UserCog,
  Wallet,
  X,
  History,
  TrendingUp,
  MapPin,
  Smartphone,
  ShieldCheck,
  Briefcase,
  Users,
  CheckCircle2,
  LayoutGrid,
  ChevronRight,
  Camera,
  Calendar,
  Check,
  User,
  MoreVertical,
  Mail,
  SmartphoneIcon,
  Clock,
  ArrowRight,
  RefreshCw,
  Star,
  Trophy,
} from 'lucide-react';
import api from '../lib/api.js';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatAmountForInput, formatAmountPreview, parseLocalizedAmount } from '../lib/amountInput.js';

// Importación de Avatars para selección rápida
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

const AVATARS = [user1, user2, user3, user4, user5, user6, user7, user8, user9, user10, user11, user12];

const ROLES = [
  { value: 'cocina', label: 'Cocina' },
  { value: 'cajero', label: 'Cajero' },
  { value: 'mozo', label: 'Mozo' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'ayudante', label: 'Ayudante' },
  { value: 'encargado', label: 'Encargado' },
];

const TURNOS = [
  { value: 'manana', label: 'Mañana' },
  { value: 'noche', label: 'Noche' },
  { value: 'doble', label: 'Doble turno' },
];

const FREQUENCY_OPTIONS = [
  { value: 'diario', label: 'Diario' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
];

const PAYMENT_OPTIONS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'modo', label: 'Modo' },
  { value: 'uala', label: 'Uala' },
];

const EMPTY_FORM = {
  nombre: '',
  rol_operativo: 'cocina',
  telefono: '',
  email: '',
  turno_preferido: 'manana',
  frecuencia_pago: 'mensual',
  monto_base: '',
  medio_pago_preferido: 'efectivo',
  activo: 1,
  notas: '',
  avatar_url: '',
  fecha_nacimiento: '',
  fecha_ingreso: new Date().toISOString().split('T')[0],
  direccion: '',
  categoria_id: 1,
};

const EMPTY_MOVEMENT = {
  tipo: 'adelanto',
  descripcion: '',
  monto: '',
  insumo_id: '',
  cantidad_insumo: '',
  impacta_caja: 1,
};

const EMPTY_SETTLEMENT = {
  unidades: '1',
  metodo_pago: 'efectivo',
  periodo_desde: '',
  periodo_hasta: '',
  notas: '',
  impacta_caja: 1,
};

const CONTROL = 'h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 outline-none transition-all focus:border-[#5D87FF] focus:ring-4 focus:ring-[#5D87FF]/10 hover:border-gray-300';
const fmt = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;

function AvatarDisplay({ url, nombre, size = 'h-20 w-20' }) {
  if (url) {
    return <img src={url} className={`${size} rounded-full object-cover shadow-sm border-2 border-white`} alt={nombre} />;
  }
  return (
    <div className={`${size} rounded-full flex items-center justify-center font-bold text-xl text-white shadow-sm bg-[#5D87FF]`}>
      {nombre?.[0]?.toUpperCase() || <User size={24} />}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tint = 'blue' }) {
  const tints = {
    blue: { bg: 'bg-[#ECF2FF]', text: 'text-[#5D87FF]' },
    amber: { bg: 'bg-[#FEF5E5]', text: 'text-[#FFAE1F]' },
    rose: { bg: 'bg-[#FDF3F3]', text: 'text-[#FA896B]' },
    emerald: { bg: 'bg-[#E6FFFA]', text: 'text-[#13DEB9]' },
  };
  return (
    <div className="rounded-xl border-0 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
      <div className="flex items-center gap-4">
        <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${tints[tint].bg} ${tints[tint].text}`}>
          <Icon size={24} strokeWidth={2} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function Personal() {
  const [personal, setPersonal] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [activeTab, setActiveTab] = useState('resumen');
  const [turnoActual, setTurnoActual] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [movementModal, setMovementModal] = useState(false);
  const [settlementModal, setSettlementModal] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT);
  const [settlementForm, setSettlementForm] = useState(EMPTY_SETTLEMENT);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const cargar = async (preferredSelectedId = null) => {
    try {
      const data = await api.get('/personal');
      const items = data.items || [];
      setPersonal(items);
      setCategorias(data.categorias || []);
      setTurnoActual(data.turno_actual || '');
      const nextSelectedId = preferredSelectedId || selectedId;
      if (nextSelectedId && items.some((item) => String(item.id) === String(nextSelectedId))) {
        setSelectedId(String(nextSelectedId));
      } else if (items[0]) {
        setSelectedId(String(items[0].id));
      }
    } catch {
      toast.error('No se pudo cargar el personal');
    }
  };

  useEffect(() => { cargar(); }, []);

  const cargarDetalle = async (id) => {
    if (!id) return;
    setDetailLoading(true);
    try {
      const data = await api.get(`/personal/${id}/detalle`);
      setDetail(data);
    } catch (error) {
      toast.error(error?.error || 'No se pudo cargar el detalle');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { cargarDetalle(selectedId); }, [selectedId]);

  const selectedPerson = useMemo(
    () => personal.find((item) => String(item.id) === String(selectedId)) || null,
    [personal, selectedId]
  );
  const sueldoPreview = useMemo(() => formatAmountPreview(form.monto_base || 0), [form.monto_base]);
  const movimientoPreview = useMemo(() => formatAmountPreview(movementForm.monto || 0), [movementForm.monto]);
  const liquidacionPreview = useMemo(() => {
    const unidades = Math.max(0, parseLocalizedAmount(settlementForm.unidades || 1, 1));
    const bruto = Number(selectedPerson?.monto_base || 0) * unidades;
    const pendiente = Number(selectedPerson?.pendiente_total || 0);
    return fmt(bruto - pendiente);
  }, [selectedPerson?.monto_base, selectedPerson?.pendiente_total, settlementForm.unidades]);

  const stats = useMemo(() => ({
    total: personal.length,
    activos: personal.filter((item) => item.activo).length,
    manana: personal.filter((item) => item.activo && item.turno_preferido === 'manana').length,
    pendiente: personal.reduce((acc, item) => acc + Number(item.pendiente_total || 0), 0),
  }), [personal]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('imagen', file);
    try {
      const res = await api.post('/productos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm({ ...form, avatar_url: res.url });
      toast.success('Imagen cargada');
    } catch {
      toast.error('Error al subir imagen');
    }
  };

  const abrirNuevo = () => { setForm(EMPTY_FORM); setModal('nuevo'); };
  const abrirEditar = (item) => {
    setForm({
      ...EMPTY_FORM,
      ...item,
      monto_base: item?.monto_base ? formatAmountForInput(item.monto_base) : '',
      activo: item.activo ? 1 : 0,
    });
    setModal(item);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio');
    setSaving(true);
    try {
      if (modal === 'nuevo') {
        const created = await api.post('/personal', form);
        toast.success('Personal agregado');
        await cargar(created.id);
      } else {
        await api.put(`/personal/${modal.id}`, form);
        toast.success('Personal actualizado');
        await cargar(modal.id);
      }
      setModal(null);
    } catch (error) { toast.error('No se pudo guardar'); } finally { setSaving(false); }
  };

  const registrarMovimiento = async () => {
    if (!movementForm.monto && movementForm.tipo !== 'consumo') return toast.error('Ingresa un monto');
    setSaving(true);
    try {
      await api.post(`/personal/${selectedId}/movimientos`, movementForm);
      toast.success('Movimiento registrado');
      setMovementModal(false);
      setMovementForm(EMPTY_MOVEMENT);
      await cargarDetalle(selectedId);
      await cargar(selectedId);
    } catch (error) { toast.error(error?.error || 'Error'); } finally { setSaving(false); }
  };

  const confirmarLiquidacion = async () => {
    setSaving(true);
    try {
      await api.post(`/personal/${selectedId}/liquidaciones`, settlementForm);
      toast.success('Liquidación exitosa');
      setSettlementModal(false);
      await cargarDetalle(selectedId);
      await cargar(selectedId);
    } catch (error) { toast.error(error?.error || 'Error'); } finally { setSaving(false); }
  };

  const eliminar = async (item) => {
    if (!window.confirm(`¿Eliminar a ${item.nombre}?`)) return;
    try {
      await api.delete(`/personal/${item.id}`);
      toast.success('Eliminado');
      await cargar();
    } catch { toast.error('Error'); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Seccion */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-6 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestión de Personal</h1>
          <p className="text-sm font-medium text-gray-500">Administra los roles, pagos y actividad de tu equipo.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => cargar()} className="h-11 w-11 flex items-center justify-center rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition-all">
            <RefreshCw size={18} />
          </button>
          <button onClick={abrirNuevo} className="flex h-11 items-center gap-2 rounded-xl bg-[#5D87FF] text-white px-5 text-sm font-bold shadow-lg shadow-[#5D87FF]/20 hover:bg-[#4570EA] transition-all">
            <Plus size={18} strokeWidth={2.5} />
            Nuevo Miembro
          </button>
        </div>
      </div>

      {/* Metricas Principales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Equipo" value={stats.total} icon={Users} tint="blue" />
        <StatCard label="Miembros Activos" value={stats.activos} icon={CheckCircle2} tint="emerald" />
        <StatCard label="Turno Actual" value={turnoActual || 'Cerrado'} icon={Clock} tint="amber" />
        <StatCard label="Pendiente de Pago" value={fmt(stats.pendiente)} icon={Wallet} tint="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Listado Izquierdo */}
        <div className="lg:col-span-4">
          <div className="rounded-xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-col h-full max-h-[750px] overflow-hidden">
            <div className="p-6 border-b border-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Personal</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
              {personal.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => setSelectedId(String(item.id))}
                  className={`group cursor-pointer rounded-xl p-3 transition-all duration-200 flex items-center gap-3 ${String(selectedId) === String(item.id) ? 'bg-[#ECF2FF] text-[#5D87FF]' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                >
                  <div className="relative shrink-0">
                    <div className="h-11 w-11 rounded-full overflow-hidden border-2 border-white shadow-sm">
                      <AvatarDisplay url={item.avatar_url} nombre={item.nombre} size="w-full h-full" />
                    </div>
                    {!item.activo && <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-rose-500 border-2 border-white"></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm truncate">{item.nombre}</h4>
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${String(selectedId) === String(item.id) ? 'text-[#5D87FF]/80' : 'text-gray-400'}`}>{item.rol_operativo}</p>
                  </div>
                  <ChevronRight size={16} className={String(selectedId) === String(item.id) ? 'text-[#5D87FF]' : 'text-gray-300 group-hover:translate-x-1 transition-all'} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ficha Detallada Derecha */}
        <div className="lg:col-span-8 space-y-6">
          {detailLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
              <RefreshCw className="animate-spin text-[#5D87FF] mb-4" size={32} />
              <p className="text-sm font-bold text-gray-500">Cargando ficha...</p>
            </div>
          ) : detail ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              
              {/* Header Ficha Estilo Modernize Profile */}
              <div className="rounded-xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                <div className="h-24 bg-[#5D87FF]/10 flex items-center px-8">
                   {detail.item.categoria_nombre && (
                     <span className="px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm text-[10px] font-bold text-[#5D87FF] border border-[#5D87FF]/20 flex items-center gap-1.5 shadow-sm">
                       {detail.item.categoria_icono} {detail.item.categoria_nombre.toUpperCase()}
                     </span>
                   )}
                </div>
                <div className="px-8 pb-4">
                  <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end -mt-10 gap-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
                      <div className="h-28 w-28 rounded-full border-4 border-white bg-gray-100 shadow-lg overflow-hidden shrink-0">
                        <AvatarDisplay url={detail.item.avatar_url} nombre={detail.item.nombre} size="w-full h-full" />
                      </div>
                      <div className="text-center sm:text-left pb-1">
                        <h2 className="text-2xl font-bold text-gray-900 leading-tight">{detail.item.nombre}</h2>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-1">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider"><Briefcase size={14} className="text-[#5D87FF]" /> {detail.item.rol_operativo}</span>
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider"><Clock size={14} className="text-[#FFAE1F]" /> {detail.item.turno_preferido}</span>
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider"><Star size={14} className="text-amber-400" /> {detail.item.puntos_reconocimiento} pts</span>
                          {detail.item.rol_operativo === 'delivery' ? (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 uppercase tracking-wider"><Bike size={14} className="text-emerald-500" /> Rider sincronizado</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pb-1">
                      <button onClick={() => abrirEditar(detail.item)} className="h-10 px-4 rounded-lg bg-gray-50 text-gray-700 text-xs font-bold hover:bg-gray-100 transition-all">Editar Perfil</button>
                      <button onClick={() => setSettlementModal(true)} className="h-10 px-4 rounded-lg bg-[#5D87FF] text-white text-xs font-bold shadow-lg shadow-[#5D87FF]/20 hover:bg-[#4570EA] transition-all">Liquidar Pago</button>
                    </div>
                  </div>

                  {/* Tabs Navegacion Ficha */}
                  <div className="flex gap-6 mt-8 border-b border-gray-100">
                    {[
                      { id: 'resumen', label: 'Resumen' },
                      { id: 'movimientos', label: 'Movimientos' },
                      { id: 'trayectoria', label: 'Trayectoria' },
                      { id: 'puntos', label: 'Puntos y Premios' },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`pb-4 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === t.id ? 'text-[#5D87FF]' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        {t.label}
                        {activeTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5D87FF] rounded-full"></div>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Contenido Dinamico por Tab */}
              <div className="animate-in fade-in duration-300">
                {activeTab === 'resumen' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Saldos */}
                    <div className="rounded-xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-base font-bold text-gray-900">Resumen Financiero</h4>
                        <button onClick={() => setMovementModal(true)} className="h-8 px-3 rounded-lg bg-[#ECF2FF] text-[#5D87FF] text-[11px] font-bold hover:bg-[#5D87FF] hover:text-white transition-all">Nuevo Movimiento</button>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between p-4 rounded-xl bg-gray-50/50 border border-gray-100">
                          <span className="text-xs font-semibold text-gray-500">Sueldo Base</span>
                          <span className="text-sm font-bold text-gray-900">{fmt(detail.item.monto_base)}</span>
                        </div>
                        <div className="flex justify-between p-4 rounded-xl bg-rose-50 border border-rose-100">
                          <span className="text-xs font-semibold text-rose-600">Pendiente Acumulado</span>
                          <span className="text-sm font-bold text-rose-700">{fmt(detail.item.pendiente_total)}</span>
                        </div>
                        <div className="flex justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                          <span className="text-xs font-semibold text-emerald-600">Neto a Liquidar</span>
                          <span className="text-sm font-bold text-emerald-700">{fmt(detail.item.neto_sugerido_base)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Info Contacto */}
                    <div className="rounded-xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
                      <h4 className="text-base font-bold text-gray-900 mb-6">Ficha del Empleado</h4>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-[#ECF2FF] flex items-center justify-center text-[#5D87FF]"><Smartphone size={20} /></div>
                          <div>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Teléfono</p>
                            <p className="text-sm font-bold text-gray-700">{detail.item.telefono || 'Sin especificar'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-[#FEF5E5] flex items-center justify-center text-[#FFAE1F]"><Calendar size={20} /></div>
                          <div>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Antigüedad</p>
                            <p className="text-sm font-bold text-gray-700">{detail.item.antiguedad_texto} (Ingreso: {detail.item.fecha_ingreso ? format(parseISO(detail.item.fecha_ingreso), 'dd/MM/yy') : 'N/A'})</p>
                          </div>
                        </div>
                        {detail.item.fecha_nacimiento && (
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500"><Star size={20} /></div>
                            <div>
                              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cumpleaños</p>
                              <p className="text-sm font-bold text-gray-700">{format(parseISO(detail.item.fecha_nacimiento), 'dd MMMM', { locale: es })} {detail.item.es_cumpleanos_hoy && '🎂 HOY!'}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400"><MapPin size={20} /></div>
                          <div>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Dirección</p>
                            <p className="text-xs font-bold text-gray-700 truncate max-w-[200px]">{detail.item.direccion || 'Sin domicilio registrado'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'movimientos' && (
                  <div className="space-y-6">
                    <div className="rounded-xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                      <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                        <h4 className="text-base font-bold text-gray-900">Historial de Liquidaciones</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-gray-50/50">
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Periodo</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Método</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Neto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {detail.liquidaciones.map(liq => (
                              <tr key={liq.id} className="hover:bg-gray-50/50 transition-all">
                                <td className="px-6 py-4">
                                  <p className="text-sm font-bold text-gray-700">{format(parseISO(liq.creado_en), 'dd/MM/yyyy')}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                    {liq.periodo_desde ? `${liq.periodo_desde} - ${liq.periodo_hasta}` : liq.frecuencia_pago}
                                  </p>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-[10px] font-bold text-gray-600 uppercase tracking-wider">{liq.metodo_pago}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <p className="text-sm font-bold text-emerald-600">{fmt(liq.monto_neto)}</p>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                       <div className="p-6 border-b border-gray-50">
                        <h4 className="text-base font-bold text-gray-900">Últimos Movimientos de Caja</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-gray-50/50">
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Descripción</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Monto</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {detail.movimientos.map(m => (
                              <tr key={m.id} className="hover:bg-gray-50/50 transition-all">
                                <td className="px-6 py-4">
                                  <p className="text-sm font-bold text-gray-700">{format(parseISO(m.creado_en), 'dd/MM/yyyy HH:mm')}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                    m.tipo === 'adelanto' ? 'bg-rose-50 text-rose-600' : 
                                    m.tipo === 'descuento' ? 'bg-amber-50 text-amber-600' : 'bg-[#ECF2FF] text-[#5D87FF]'
                                  }`}>
                                    {m.tipo}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-sm font-semibold text-gray-600">{m.descripcion}</p>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <p className="text-sm font-bold text-gray-900">{fmt(m.monto)}</p>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${m.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {m.estado}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'trayectoria' && (
                  <div className="rounded-xl bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
                    <h4 className="text-base font-bold text-gray-900 mb-8">Línea de Tiempo Laboral</h4>
                    <div className="space-y-8 relative before:absolute before:inset-0 before:left-4 before:h-full before:w-0.5 before:bg-gray-100 before:content-['']">
                       {/* Entrada Inicial */}
                       <div className="relative pl-12">
                        <div className="absolute left-1.5 top-1.5 h-5 w-5 rounded-full border-4 border-white bg-[#13DEB9] shadow-sm"></div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{detail.item.fecha_ingreso ? format(parseISO(detail.item.fecha_ingreso), 'MMMM yyyy', { locale: es }) : 'N/A'}</p>
                          <h5 className="text-sm font-bold text-gray-900 mt-1">Ingreso al Equipo</h5>
                          <p className="text-xs font-semibold text-gray-500 mt-1">Comenzó como {detail.item.rol_operativo} en el turno {detail.item.turno_preferido}.</p>
                        </div>
                      </div>

                      {detail.carrera.map((c, idx) => (
                        <div key={idx} className="relative pl-12">
                          <div className="absolute left-1.5 top-1.5 h-5 w-5 rounded-full border-4 border-white bg-[#5D87FF] shadow-sm"></div>
                          <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{format(parseISO(c.fecha_cambio), 'MMMM yyyy', { locale: es })}</p>
                            <h5 className="text-sm font-bold text-gray-900 mt-1">Ascenso / Cambio de Categoría</h5>
                            <div className="mt-2 p-3 rounded-lg bg-gray-50 border border-gray-100 inline-block">
                               <p className="text-xs font-bold text-gray-700">
                                 {c.categoria_anterior_nombre} <ArrowRight size={12} className="inline mx-1" /> {c.categoria_nueva_nombre}
                               </p>
                               <p className="text-[10px] font-bold text-[#5D87FF] mt-1">Ajuste salarial: {fmt(c.sueldo_nuevo)}</p>
                            </div>
                            {c.motivo && <p className="text-xs italic text-gray-500 mt-2">"{c.motivo}"</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'puntos' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-4 space-y-6">
                      <div className="rounded-xl bg-gradient-to-br from-[#5D87FF] to-[#49BEFF] p-6 text-white shadow-lg">
                        <h4 className="text-sm font-bold uppercase tracking-widest opacity-80">Puntos Acumulados</h4>
                        <div className="flex items-center gap-3 mt-4">
                          <Star size={32} className="fill-white" />
                          <span className="text-5xl font-black">{detail.item.puntos_reconocimiento}</span>
                        </div>
                        <p className="text-xs font-bold mt-6 opacity-90 uppercase leading-relaxed tracking-tight">
                          Gana puntos por puntualidad, feedback positivo de clientes y desempeño destacado.
                        </p>
                        <button className="w-full mt-6 h-10 rounded-lg bg-white/20 backdrop-blur-md text-xs font-bold uppercase hover:bg-white/30 transition-all">Ver Premios</button>
                      </div>
                    </div>
                    
                    <div className="md:col-span-8 rounded-xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-base font-bold text-gray-900">Historial de Reconocimientos</h4>
                        <button className="h-8 px-3 rounded-lg bg-[#E6FFFA] text-[#13DEB9] text-[11px] font-bold hover:bg-[#13DEB9] hover:text-white transition-all">Dar Reconocimiento</button>
                      </div>
                      <div className="space-y-4">
                        {detail.reconocimientos.map((r, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-gray-50 bg-gray-50/30">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-amber-400 shadow-sm border border-amber-100">
                                <Trophy size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-800">{r.tipo === 'canje' ? 'Canje de puntos' : r.tipo}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{format(parseISO(r.fecha), 'dd MMM yyyy')}</p>
                              </div>
                            </div>
                            <span className={`font-black text-sm ${r.puntos > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {r.puntos > 0 ? `+${r.puntos}` : r.puntos} pts
                            </span>
                          </div>
                        ))}
                        {detail.reconocimientos.length === 0 && (
                          <div className="py-12 text-center text-gray-400 italic text-sm">No hay reconocimientos registrados.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-xl border border-dashed border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
              <Users size={48} strokeWidth={1} className="text-gray-200 mb-4" />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Selecciona un miembro para ver su ficha</p>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL FICHA MIEMBRO (NUEVO/EDITAR) ── STYLE MODERNIZE ── */}
      {modal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#2A3547]/40 p-4 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">{modal === 'nuevo' ? 'Agregar Nuevo Miembro' : 'Editar Datos del Personal'}</h3>
              <button onClick={() => setModal(null)} className="rounded-full p-2 hover:bg-gray-100 text-gray-400 transition-all"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              <div className="flex flex-col items-center">
                <div className="relative group cursor-pointer">
                  <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-[#ECF2FF] shadow-md group-hover:border-[#5D87FF] transition-all">
                    <AvatarDisplay url={form.avatar_url} nombre={form.nombre} size="w-full h-full" />
                  </div>
                  <button onClick={() => setAvatarPickerOpen(true)} className="absolute bottom-0 right-0 h-9 w-9 bg-[#5D87FF] text-white rounded-full border-4 border-white shadow-lg flex items-center justify-center hover:bg-[#4570EA] transition-all"><Camera size={16} /></button>
                </div>
                <p className="mt-3 text-xs font-bold text-[#5D87FF] uppercase tracking-wider">Foto de Perfil</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Nombre Completo</label>
                  <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className={CONTROL} placeholder="Ej: Roberto Gomez" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Rol Operativo</label>
                  <select value={form.rol_operativo} onChange={e => setForm({...form, rol_operativo: e.target.value})} className={CONTROL}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  {form.rol_operativo === 'delivery' ? (
                    <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-emerald-600">
                      Se crea o actualiza también en Delivery automáticamente
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Categoría Laboral</label>
                  <select value={form.categoria_id} onChange={e => setForm({...form, categoria_id: Number(e.target.value)})} className={CONTROL}>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Turno</label>
                  <select value={form.turno_preferido} onChange={e => setForm({...form, turno_preferido: e.target.value})} className={CONTROL}>
                    {TURNOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Frecuencia de Pago</label>
                  <select value={form.frecuencia_pago} onChange={e => setForm({...form, frecuencia_pago: e.target.value})} className={CONTROL}>
                    {FREQUENCY_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Sueldo Base ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.monto_base}
                    onChange={e => setForm({...form, monto_base: e.target.value})}
                    onBlur={() => setForm((prev) => ({ ...prev, monto_base: prev.monto_base === '' ? '' : formatAmountForInput(prev.monto_base) }))}
                    className={CONTROL + " font-mono"}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Teléfono / WhatsApp</label>
                  <input value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className={CONTROL} placeholder="Ej: 3811234567" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={CONTROL} placeholder="usuario@modosabor.com" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Fecha de Nacimiento</label>
                  <input type="date" value={form.fecha_nacimiento} onChange={e => setForm({...form, fecha_nacimiento: e.target.value})} className={CONTROL} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Fecha de Ingreso</label>
                  <input type="date" value={form.fecha_ingreso} onChange={e => setForm({...form, fecha_ingreso: e.target.value})} className={CONTROL} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Dirección Principal</label>
                  <input value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} className={CONTROL} placeholder="Ej: Av. Siempre Viva 123" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Notas Internas</label>
                  <textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className={CONTROL + " h-20 py-3 resize-none"} placeholder="Anotaciones importantes..." />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button onClick={() => setModal(null)} className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="flex-1 h-11 rounded-xl bg-[#5D87FF] text-white text-sm font-bold shadow-lg shadow-[#5D87FF]/20 hover:bg-[#4570EA] active:scale-95 transition-all disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL MOVIMIENTO (ADELANTO) ── STYLE MODERNIZE ── */}
      {movementModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#2A3547]/40 p-4 backdrop-blur-sm" onClick={() => setMovementModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Registrar Adelanto</h3>
                <p className="text-sm font-semibold text-[#5D87FF] mt-1">{selectedPerson?.nombre}</p>
              </div>
              <button onClick={() => setMovementModal(false)} className="rounded-full p-2 hover:bg-gray-100 text-gray-400 transition-all"><X size={20} /></button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">Monto a Entregar ($)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={movementForm.monto}
                  onChange={e => setMovementForm({...movementForm, monto: e.target.value})}
                  onBlur={() => setMovementForm((prev) => ({ ...prev, monto: prev.monto === '' ? '' : formatAmountForInput(prev.monto) }))}
                  className={CONTROL + " text-lg font-bold text-[#5D87FF]"}
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">Descripción / Motivo</label>
                <input value={movementForm.descripcion} onChange={e => setMovementForm({...movementForm, descripcion: e.target.value})} className={CONTROL} placeholder="Ej: Adelanto de quincena" />
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <ToggleSwitch 
                  checked={movementForm.impacta_caja === 1} 
                  onChange={v => setMovementForm({...movementForm, impacta_caja: v ? 1 : 0})}
                  label="Impactar en Caja"
                  description="Descuenta el dinero del efectivo actual."
                  color="blue"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => setMovementModal(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all">Cancelar</button>
              <button onClick={registrarMovimiento} disabled={saving} className="flex-1 h-11 rounded-xl bg-[#5D87FF] text-white text-sm font-bold shadow-lg shadow-[#5D87FF]/20 active:scale-95 transition-all disabled:opacity-50">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL LIQUIDACIÓN ── STYLE MODERNIZE ── */}
      {settlementModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#2A3547]/40 p-4 backdrop-blur-sm" onClick={() => setSettlementModal(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Liquidar Haberes</h3>
                <p className="text-sm font-semibold text-[#13DEB9] mt-1">{selectedPerson?.nombre}</p>
              </div>
              <button onClick={() => setSettlementModal(false)} className="rounded-full p-2 hover:bg-gray-100 text-gray-400 transition-all"><X size={20} /></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Unidades ({selectedPerson?.frecuencia_pago})</label>
                  <input type="number" value={settlementForm.unidades} onChange={e => setSettlementForm({...settlementForm, unidades: e.target.value})} className={CONTROL} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Método de Pago</label>
                  <select value={settlementForm.metodo_pago} onChange={e => setSettlementForm({...settlementForm, metodo_pago: e.target.value})} className={CONTROL}>
                    {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-[#E6FFFA] border border-[#13DEB9]/20 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#13DEB9] uppercase tracking-wider mb-1">Monto Neto Final</p>
                  <p className="text-3xl font-bold text-gray-900">{liquidacionPreview}</p>
                </div>
                <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center text-[#13DEB9] shadow-sm"><Banknote size={32} /></div>
              </div>

              <textarea value={settlementForm.notas} onChange={e => setSettlementForm({...settlementForm, notas: e.target.value})} className={CONTROL + " h-20 py-3 resize-none"} placeholder="Añadir nota al recibo..." />
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => setSettlementModal(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all">Cancelar</button>
              <button onClick={confirmarLiquidacion} disabled={saving} className="flex-1 h-11 rounded-xl bg-[#13DEB9] text-white text-sm font-bold shadow-lg shadow-[#13DEB9]/20 active:scale-95 transition-all">Confirmar Pago</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SELECTOR DE AVATAR ── */}
      {avatarPickerOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[#2A3547]/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900">Seleccionar Avatar</h3>
              <button onClick={() => setAvatarPickerOpen(false)} className="rounded-full p-2 hover:bg-gray-100 transition-all text-gray-400"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 overflow-y-auto p-2 custom-scrollbar">
              <button 
                onClick={() => fileInputRef.current.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 hover:border-[#5D87FF] hover:bg-[#ECF2FF] transition-all group"
              >
                <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-[#5D87FF] transition-all">
                  <Camera size={20} />
                </div>
                <span className="text-[10px] font-bold uppercase text-gray-400 group-hover:text-[#5D87FF]">Subir Propia</span>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
              </button>

              {AVATARS.map((av, idx) => (
                <button 
                  key={idx}
                  onClick={() => { setForm({ ...form, avatar_url: av }); setAvatarPickerOpen(false); }}
                  className={`relative aspect-square rounded-xl overflow-hidden border-4 transition-all hover:scale-[1.02] ${form.avatar_url === av ? 'border-[#5D87FF]' : 'border-transparent'}`}
                >
                  <img src={av} className="w-full h-full object-cover" alt={`avatar-${idx}`} />
                  {form.avatar_url === av && (
                    <div className="absolute inset-0 bg-[#5D87FF]/20 flex items-center justify-center">
                      <div className="bg-white rounded-full p-1 text-[#5D87FF] shadow-sm"><Check size={16} strokeWidth={4} /></div>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-8 flex justify-end pt-4 border-t border-gray-100">
              <button 
                onClick={() => setAvatarPickerOpen(false)}
                className="h-11 px-6 rounded-xl bg-gray-50 text-sm font-bold text-gray-500 hover:bg-gray-100 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label, description, color = 'blue' }) {
  const colors = {
    blue: 'bg-[#5D87FF]',
    emerald: 'bg-[#13DEB9]',
    rose: 'bg-[#FA896B]',
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-bold text-gray-900">{label}</p>
        {description && <p className="text-[11px] font-semibold text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? colors[color] : 'bg-gray-200'}`}
      >
        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
