import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Archive,
  Bike,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  PackageCheck,
  Printer,
  RefreshCw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Users,
  WalletCards,
} from 'lucide-react';
import api from '../lib/api.js';

const fmt = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;
const STOCK_DIRECT_CATEGORIES = ['Empanadas', 'Papas', 'Bebidas'];

function Stat({ label, value, helper, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-[#5D87FF]',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
          {helper ? <p className="mt-1 text-xs font-bold text-gray-400">{helper}</p> : null}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone] || tones.blue}`}>
          <Icon size={20} strokeWidth={2.6} />
        </div>
      </div>
    </div>
  );
}

function PointCard({ point, index }) {
  return (
    <div className="flex items-start gap-3 rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${point.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
        {point.ok ? <CheckCircle2 size={18} /> : index + 1}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black uppercase tracking-tight text-gray-900">{point.title}</p>
        <p className="mt-1 text-xs font-semibold text-gray-500">{point.detail}</p>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children, action }) {
  return (
    <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight text-gray-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm font-medium text-gray-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Operacion() {
  const [data, setData] = useState(null);
  const [stock, setStock] = useState({ insumos: [], productos: [] });
  const [loading, setLoading] = useState(true);
  const [savingStock, setSavingStock] = useState(false);
  const [working, setWorking] = useState('');

  const cargar = async () => {
    setLoading(true);
    try {
      const response = await api.get('/operacion/resumen');
      setData(response);
      setStock({
        insumos: response?.stockDiario?.insumos || [],
        productos: response?.stockDiario?.productosDirectos || [],
      });
    } catch {
      toast.error('No se pudo cargar operación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const cierre = data?.cierreDiario || {};
  const points = data?.puntos || [];

  const groupedProducts = useMemo(() => {
    const map = new Map(STOCK_DIRECT_CATEGORIES.map((category) => [category, []]));
    (stock.productos || []).forEach((product) => {
      const key = product.categoria || 'Otros';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(product);
    });
    return Array.from(map.entries()).filter(([, products]) => products.length > 0);
  }, [stock.productos]);

  const updateInsumo = (id, value) => {
    setStock((prev) => ({
      ...prev,
      insumos: prev.insumos.map((item) => (item.id === id ? { ...item, stock_actual: value } : item)),
    }));
  };

  const updateProducto = (id, value) => {
    setStock((prev) => ({
      ...prev,
      productos: prev.productos.map((item) => (item.id === id ? { ...item, stock_directo: value } : item)),
    }));
  };

  const guardarStock = async () => {
    setSavingStock(true);
    try {
      const response = await api.post('/operacion/stock-diario', {
        insumos: stock.insumos,
        productos: stock.productos,
      });
      setStock({
        insumos: response?.stockDiario?.insumos || [],
        productos: response?.stockDiario?.productosDirectos || [],
      });
      toast.success('Stock diario actualizado');
      await cargar();
    } catch (error) {
      toast.error(error?.error || 'No se pudo guardar stock');
    } finally {
      setSavingStock(false);
    }
  };

  const crearBackup = async () => {
    setWorking('backup');
    try {
      await api.post('/operacion/backup', {});
      toast.success('Backup creado');
      await cargar();
    } catch (error) {
      toast.error(error?.error || 'No se pudo crear backup');
    } finally {
      setWorking('');
    }
  };

  const sincronizarClientes = async () => {
    setWorking('clientes');
    try {
      const response = await api.post('/operacion/clientes/sincronizar', {});
      toast.success(`Clientes recalculados: ${response.total}`);
      await cargar();
    } catch (error) {
      toast.error(error?.error || 'No se pudieron sincronizar clientes');
    } finally {
      setWorking('');
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <RefreshCw className="animate-spin text-[#5D87FF]" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5D87FF] text-white shadow-lg shadow-blue-100">
                <ClipboardCheck size={20} />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#5D87FF]">Modo operación</p>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">Control diario del local</h1>
            <p className="mt-1 text-sm font-medium text-gray-500">Los 8 puntos importantes para que el sistema trabaje ordenado todos los días.</p>
          </div>
          <button
            onClick={cargar}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-xs font-black uppercase tracking-widest text-gray-600 shadow-sm transition hover:bg-blue-50 hover:text-[#5D87FF]"
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Ventas hoy" value={fmt(cierre.totalVentas)} helper={`${cierre.pedidos || 0} pedidos`} icon={ShoppingBag} />
          <Stat label="Efectivo" value={fmt(cierre.efectivo)} helper="Cobrado en caja" icon={WalletCards} tone="emerald" />
          <Stat label="Pendiente" value={fmt(cierre.pendiente)} helper="A cobrar o revisar" icon={AlertTriangle} tone={Number(cierre.pendiente || 0) > 0 ? 'amber' : 'slate'} />
          <Stat label="Operativo" value={fmt(cierre.gananciaOperativa)} helper="Ventas menos gastos y delivery" icon={PackageCheck} tone="blue" />
        </div>

        <Section title="Checklist de 8 puntos" subtitle="Vista rápida de lo que ya está cubierto y lo que conviene revisar.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {points.map((point, index) => <PointCard key={point.id} point={point} index={index} />)}
          </div>
        </Section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <Section
            title="Stock diario rápido"
            subtitle="Cargá acá lo que hay al empezar el día. Pizzas, hamburguesas y milanesas comparten estos insumos."
            action={(
              <button
                onClick={guardarStock}
                disabled={savingStock}
                className="flex h-11 items-center gap-2 rounded-2xl bg-[#5D87FF] px-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                <Save size={16} /> Guardar stock
              </button>
            )}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(stock.insumos || []).map((item) => (
                <label key={item.id} className="rounded-[18px] border border-gray-100 bg-[#F8FAFF] p-4">
                  <span className="block text-xs font-black uppercase text-gray-800">{item.nombre}</span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">{item.rubro} · {item.unidad}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={item.stock_actual}
                    onChange={(event) => updateInsumo(item.id, event.target.value)}
                    className="mt-3 h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm font-black text-gray-900 outline-none focus:border-[#5D87FF] focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {groupedProducts.map(([category, products]) => (
                <div key={category}>
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">{category} con stock directo</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {products.map((product) => (
                      <label key={product.id} className="rounded-[18px] border border-gray-100 bg-white p-4">
                        <span className="block text-xs font-black uppercase text-gray-800">{product.nombre}</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={product.stock_directo}
                          onChange={(event) => updateProducto(product.id, event.target.value)}
                          className="mt-3 h-10 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-black text-gray-900 outline-none focus:border-[#5D87FF] focus:ring-4 focus:ring-blue-100"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <div className="space-y-6">
            <Section title="Cierre diario" subtitle="Resumen operativo de hoy.">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="font-bold text-gray-500">Digitales</span><strong>{fmt(cierre.digitales)}</strong></div>
                <div className="flex justify-between"><span className="font-bold text-gray-500">Gastos</span><strong>{fmt(cierre.gastos)}</strong></div>
                <div className="flex justify-between"><span className="font-bold text-gray-500">Pago delivery diario</span><strong>{fmt(cierre.deliveryDiario)}</strong></div>
                <div className="flex justify-between border-t border-gray-100 pt-3"><span className="font-black text-gray-900">Ticket promedio</span><strong>{fmt(cierre.ticketPromedio)}</strong></div>
              </div>
              <Link to="/admin/reportes" className="mt-5 flex h-11 items-center justify-center gap-2 rounded-2xl bg-gray-900 text-xs font-black uppercase tracking-widest text-white">
                <FileText size={16} /> Ver reportes
              </Link>
            </Section>

            <Section title="Acciones rápidas" subtitle="Herramientas para mantenimiento diario.">
              <div className="grid gap-3">
                <button onClick={crearBackup} disabled={working === 'backup'} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ECF2FF] text-xs font-black uppercase tracking-widest text-[#5D87FF] disabled:opacity-50">
                  <Archive size={16} /> Crear backup ahora
                </button>
                <button onClick={sincronizarClientes} disabled={working === 'clientes'} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-50 text-xs font-black uppercase tracking-widest text-emerald-700 disabled:opacity-50">
                  <Users size={16} /> Sincronizar clientes
                </button>
                <Link to="/admin/delivery" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-50 text-xs font-black uppercase tracking-widest text-orange-700">
                  <Bike size={16} /> Revisar delivery
                </Link>
                <Link to="/admin/configuracion" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-100 text-xs font-black uppercase tracking-widest text-slate-700">
                  <Printer size={16} /> Ajustar impresión
                </Link>
              </div>
            </Section>

            <Section title="Backups" subtitle="Últimas copias de seguridad.">
              <div className="space-y-2">
                {(data?.backups || []).length ? data.backups.map((backup) => (
                  <div key={backup.file} className="rounded-2xl bg-[#F8FAFF] px-4 py-3">
                    <p className="truncate text-xs font-black text-gray-800">{backup.file}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{new Date(backup.created_at).toLocaleString('es-AR')}</p>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-xs font-bold text-gray-400">Sin backups todavía</div>
                )}
              </div>
            </Section>
          </div>
        </div>

        <Section title="Guía de uso" subtitle="Qué cubre cada punto en el día a día.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['Inventario fino', 'Las recetas descuentan insumos compartidos en cada pedido.'],
              ['Stock diario', 'Cargás cantidades reales antes de vender.'],
              ['Cierre', 'Ves ventas, pagos, gastos y delivery diario.'],
              ['Online', 'El menú público respeta productos sin stock.'],
              ['Delivery', 'Cristian trabaja con clave rider y pedidos asignados.'],
              ['Clientes', 'Se recalculan compras, puntos e historial.'],
              ['Backups', 'Hay copia automática y backup manual.'],
              ['Impresión', 'Comanda, ticket y delivery se ajustan desde configuración.'],
            ].map(([title, text]) => (
              <div key={title} className="rounded-[18px] bg-[#F8FAFF] p-4">
                <div className="mb-2 flex items-center gap-2 text-[#5D87FF]">
                  <ShieldCheck size={16} />
                  <p className="text-xs font-black uppercase">{title}</p>
                </div>
                <p className="text-xs font-semibold leading-relaxed text-gray-500">{text}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
