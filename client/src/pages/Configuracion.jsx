import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import {
  Building2,
  CreditCard,
  Truck,
  Printer,
  Settings,
  Save,
  LayoutGrid,
  Smartphone,
  MonitorSmartphone,
} from 'lucide-react';
import { applyBranding } from '../lib/branding.js';
import { useAppConfig } from '../context/AppConfigContext.jsx';
import SeccionGeneral from '../components/Configuracion/SeccionGeneral.jsx';
import SeccionModulos from '../components/Configuracion/SeccionModulos.jsx';
import SeccionPagos from '../components/Configuracion/SeccionPagos.jsx';
import SeccionDelivery from '../components/Configuracion/SeccionDelivery.jsx';
import SeccionRider from '../components/Configuracion/SeccionRider.jsx';
import SeccionImpresion from '../components/Configuracion/SeccionImpresion.jsx';
import SeccionAvanzado from '../components/Configuracion/SeccionAvanzado.jsx';
import SeccionWebPublica from '../components/Configuracion/SeccionWebPublica.jsx';

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildDefaultTurno(index) {
  return {
    id: `turno_${index + 1}`,
    nombre: `Turno ${index + 1}`,
    desde: index === 0 ? '11:00' : '19:00',
    hasta: index === 0 ? '14:00' : '23:30',
    activo: true,
  };
}

export default function Configuracion() {
  const { refreshConfig } = useAppConfig();
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [auditLogs, setAuditLogs] = useState([]);
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [turnos, setTurnos] = useState([]);

  const hydrateState = (data) => {
    setConfig(data);
    setDeliveryZones(parseJsonArray(data.delivery_zonas));
    const parsedTurnos = parseJsonArray(data.turnos_negocio || data.negocio_horarios);
    setTurnos(parsedTurnos.length > 0 ? parsedTurnos : [buildDefaultTurno(0), buildDefaultTurno(1)]);
  };

  const fetchConfig = async () => {
    try {
      const data = await api.get('/configuracion/map');
      hydrateState(data);
    } catch {
      toast.error('Error al cargar configuracion');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const logs = await api.get('/configuracion/audit?limit=10');
      setAuditLogs(logs);
    } catch {}
  };

  useEffect(() => {
    fetchConfig();
    fetchAuditLogs();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const finalConfig = {
        ...config,
        delivery_zonas: JSON.stringify(deliveryZones),
        turnos_negocio: JSON.stringify(turnos),
      };

      const updated = await api.post('/configuracion/bulk', { config: finalConfig });
      hydrateState(updated);
      applyBranding(updated);
      await refreshConfig(updated);
      await fetchAuditLogs();
      toast.success('Configuracion guardada correctamente');
    } catch {
      toast.error('Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  const setToggle = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value ? '1' : '0' }));
  };

  const f = (key) => ({
    value: config[key] || '',
    onChange: (event) => setConfig((prev) => ({ ...prev, [key]: event.target.value })),
  });

  const addZone = () => {
    setDeliveryZones((prev) => [
      ...prev,
      { id: `zona_${Date.now()}`, nombre: '', costo_envio: 0, tiempo_estimado_min: 30, keywords: [], activa: true },
    ]);
  };

  const removeZone = (index) => {
    setDeliveryZones((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateZone = (index, key, value) => {
    setDeliveryZones((prev) => prev.map((zone, currentIndex) => (
      currentIndex === index ? { ...zone, [key]: value } : zone
    )));
  };

  const applyMonterosPreset = () => {
    setDeliveryZones([
      { id: 'monteros', nombre: 'Monteros', costo_envio: 0, tiempo_estimado_min: 25, keywords: ['monteros', 'centro', 'plaza'], activa: true },
      { id: 'cercana', nombre: 'Barrios cercanos', costo_envio: 1200, tiempo_estimado_min: 35, keywords: ['villa quinteros', 'santa lucia'], activa: true },
    ]);
  };

  const addTurno = () => {
    setTurnos((prev) => [...prev, buildDefaultTurno(prev.length)]);
  };

  const updateTurno = (index, key, value) => {
    setTurnos((prev) => prev.map((turno, currentIndex) => (
      currentIndex === index ? { ...turno, [key]: value } : turno
    )));
  };

  const removeTurno = (index) => {
    setTurnos((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const exportarBackup = async () => {
    try {
      const token = localStorage.getItem('ms_token');
      const response = await fetch(`${api.defaults.baseURL}/configuracion/backup/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') || '';
      const match = contentDisposition.match(/filename="?([^"]+)"?/i);
      const downloadName = match?.[1] || 'modosabor-backup.sqlite';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Backup exportado');
    } catch {
      toast.error('Error al exportar backup');
    }
  };

  const importarBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('backup', file);

    try {
      await api.post('/configuracion/backup/import', formData);
      toast.success('Backup restaurado. Recargando panel...');
      window.location.reload();
    } catch {
      toast.error('Error al importar backup');
    } finally {
      event.target.value = '';
    }
  };

  const resetOperativo = async () => {
    if (!window.confirm('Estas seguro? Se borraran pedidos, caja, auditoria y mensajeria operativa.')) return;
    try {
      await api.post('/configuracion/reset-operativo');
      toast.success('Sistema reiniciado');
      await fetchAuditLogs();
    } catch {
      toast.error('Error al reiniciar');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'web', label: 'Web publica', icon: MonitorSmartphone, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'modulos', label: 'Modulos', icon: LayoutGrid, color: 'text-sky-600', bg: 'bg-sky-50' },
    { id: 'pagos', label: 'Pagos', icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'delivery', label: 'Delivery', icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50' },
    { id: 'rider', label: 'Rider App', icon: Smartphone, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'impresion', label: 'Impresion', icon: Printer, color: 'text-violet-600', bg: 'bg-violet-50' },
    { id: 'avanzado', label: 'Avanzado', icon: Settings, color: 'text-gray-600', bg: 'bg-gray-50' },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 px-4 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar">
          <div className="flex gap-1 py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                    isActive ? `${tab.bg} ${tab.color} ring-1 ring-inset ring-current/20` : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={saveConfig}
            disabled={saving}
            className="ml-4 flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition-all hover:bg-orange-700 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div className="mt-4">
        {activeTab === 'general' && (
          <SeccionGeneral
            config={config}
            f={f}
            setToggle={setToggle}
            turnos={turnos}
            addTurno={addTurno}
            updateTurno={updateTurno}
            removeTurno={removeTurno}
          />
        )}
        {activeTab === 'modulos' && (
          <SeccionModulos config={config} setToggle={setToggle} setConfig={setConfig} />
        )}
        {activeTab === 'web' && (
          <SeccionWebPublica config={config} setConfig={setConfig} />
        )}
        {activeTab === 'pagos' && (
          <SeccionPagos config={config} setConfig={setConfig} f={f} setToggle={setToggle} />
        )}
        {activeTab === 'delivery' && (
          <SeccionDelivery
            config={config}
            f={f}
            setToggle={setToggle}
            deliveryZones={deliveryZones}
            addZone={addZone}
            removeZone={removeZone}
            updateZone={updateZone}
            applyMonterosPreset={applyMonterosPreset}
          />
        )}
        {activeTab === 'rider' && (
          <SeccionRider config={config} f={f} setConfig={setConfig} />
        )}
        {activeTab === 'impresion' && (
          <SeccionImpresion config={config} f={f} setToggle={setToggle} setConfig={setConfig} />
        )}
        {activeTab === 'avanzado' && (
          <SeccionAvanzado
            config={config}
            f={f}
            setToggle={setToggle}
            exportarBackup={exportarBackup}
            importarBackup={importarBackup}
            resetOperativo={resetOperativo}
            auditLogs={auditLogs}
          />
        )}
      </div>
    </div>
  );
}
