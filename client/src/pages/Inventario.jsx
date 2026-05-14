import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Boxes,
  CheckSquare,
  Copy,
  MessageCircle,
  MinusCircle,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Square,
  X,
  History,
  ShoppingCart,
  ChevronRight,
  TrendingUp,
  Search,
  LayoutGrid,
  Filter
} from 'lucide-react';

const EMPTY_INSUMO = { nombre: '', rubro: 'General', unidad: 'u', stock_actual: 0, stock_minimo: 0, costo_unitario: 0, activo: 1 };
const EMPTY_ROW = { insumo_id: '', cantidad: '', condicion_tipo: 'siempre', condicion_grupo: '', condicion_valor: '' };
const UNITS = ['u', 'kg', 'g', 'lts', 'ml', 'porcion', 'caja'];
const RUBROS = ['General', 'Verduleria', 'Fiambreria', 'Almacen', 'Carniceria', 'Envases', 'Limpieza', 'Bebidas', 'Panaderia'];
const CONTROL = 'h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-medium text-gray-700 outline-none transition focus:border-blue-200 focus:bg-white focus:ring-4 focus:ring-blue-100';

const fmtStock = (value, unit = 'u') => `${Number(value || 0).toLocaleString('es-AR')} ${unit}`;
const fmtMoney = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;
const normalizeText = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function Stat({ label, value, helper, icon: Icon, tint = 'blue' }) {
  const tints = {
    blue: 'bg-blue-50 text-[#5D87FF]',
    rose: 'bg-rose-50 text-[#FA896B]',
    amber: 'bg-amber-50 text-[#FFAE1F]',
    emerald: 'bg-emerald-50 text-[#13DEB9]',
  };

  return (
    <div className="group rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{label}</p>
          <p className="text-xl font-black text-gray-900 tracking-tight">{value}</p>
          {helper && <p className="mt-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{helper}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:rotate-3 ${tints[tint]}`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

export default function Inventario() {
  const [insumos, setInsumos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  
  // Modales
  const [insumoModal, setInsumoModal] = useState(null);
  const [insumoForm, setInsumoForm] = useState(EMPTY_INSUMO);
  const [movementModal, setMovementModal] = useState(null);
  const [movementForm, setMovementForm] = useState({ tipo: 'entrada', cantidad: '', motivo: '' });
  const [compraModal, setCompraModal] = useState(false);
  const [compraForm, setCompraForm] = useState({ proveedor: '', metodo_pago: 'efectivo', items: [] });

  // Recetas
  const [productConfig, setProductConfig] = useState({ stock_mode: 'direct', stock_directo: 0 });
  const [recipeRows, setRecipeRows] = useState([]);

  const cargar = async () => {
    setLoading(true);
    try {
      const [insumosData, productosData, movimientosData] = await Promise.all([
        api.get('/inventario/insumos'),
        api.get('/inventario/productos'),
        api.get('/inventario/movimientos?limit=20'),
      ]);
      setInsumos(insumosData);
      setProductos(productosData);
      setMovimientos(movimientosData);
      if (!selectedProductId && productosData[0]) setSelectedProductId(String(productosData[0].id));
    } catch (error) {
      toast.error('Error al cargar inventario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const selectedProduct = useMemo(
    () => productos.find((product) => String(product.id) === String(selectedProductId)) || null,
    [productos, selectedProductId]
  );

  useEffect(() => {
    if (!selectedProduct) return;
    setProductConfig({ stock_mode: selectedProduct.stock_mode || 'direct', stock_directo: selectedProduct.stock_directo || 0 });
    setRecipeRows((selectedProduct.receta_resumen || []).map((row) => ({
      insumo_id: row.insumo_id,
      cantidad: row.cantidad,
      condicion_tipo: row.condicion_tipo || 'siempre',
      condicion_grupo: row.condicion_grupo || '',
      condicion_valor: row.condicion_valor || '',
    })));
  }, [selectedProduct]);

  const stats = useMemo(() => ({
    total: insumos.length,
    bajos: insumos.filter((item) => item.stock_bajo).length,
    receta: productos.filter((item) => item.stock_mode === 'recipe').length,
    frenados: productos.filter((item) => !item.disponible_para_venta).length,
  }), [insumos, productos]);

  const filteredInsumos = useMemo(() => {
    const term = normalizeText(busqueda);
    return insumos.filter((item) => (
      normalizeText(item.nombre).includes(term)
      || normalizeText(item.rubro).includes(term)
    ));
  }, [insumos, busqueda]);

  const faltantes = useMemo(() => (
    insumos
      .map((item) => ({ ...item, faltante: Math.max(0, Number(item.stock_minimo || 0) - Number(item.stock_actual || 0)) }))
      .filter((item) => item.faltante > 0)
      .sort((a, b) => b.faltante - a.faltante)
  ), [insumos]);

  // Handlers para Insumos
  const openNewInsumo = () => { setInsumoModal('new'); setInsumoForm(EMPTY_INSUMO); };
  const openEditInsumo = (insumo) => { setInsumoModal(insumo); setInsumoForm({ ...EMPTY_INSUMO, ...insumo }); };
  const closeInsumoModal = () => { setInsumoModal(null); setInsumoForm(EMPTY_INSUMO); };

  const saveInsumo = async () => {
    setSaving(true);
    try {
      if (insumoModal === 'new') await api.post('/inventario/insumos', insumoForm);
      else await api.put(`/inventario/insumos/${insumoModal.id}`, insumoForm);
      toast.success('Insumo guardado');
      closeInsumoModal();
      await cargar();
    } catch (error) { toast.error('No se pudo guardar'); } finally { setSaving(false); }
  };

  // Handlers para Compras
  const openCompraModal = () => {
    setCompraForm({ proveedor: '', metodo_pago: 'efectivo', items: [{ insumo_id: '', cantidad: '', costo_unitario: '' }] });
    setCompraModal(true);
  };

  const addCompraItem = () => {
    setCompraForm(p => ({ ...p, items: [...p.items, { insumo_id: '', cantidad: '', costo_unitario: '' }] }));
  };

  const updateCompraItem = (idx, key, val) => {
    const next = [...compraForm.items];
    next[idx][key] = val;
    if (key === 'insumo_id') {
      const insumo = insumos.find(i => String(i.id) === String(val));
      if (insumo) next[idx].costo_unitario = insumo.costo_unitario || '';
    }
    setCompraForm(p => ({ ...p, items: next }));
  };

  const registrarCompra = async () => {
    if (!compraForm.items.some(i => i.insumo_id && i.cantidad)) return toast.error('Completa los datos de la compra');
    setSaving(true);
    try {
      const total = compraForm.items.reduce((acc, i) => acc + (Number(i.cantidad || 0) * Number(i.costo_unitario || 0)), 0);
      await api.post('/compras', { ...compraForm, total });
      toast.success('Compra registrada y stock actualizado');
      setCompraModal(false);
      await cargar();
    } catch (error) { toast.error('Error al registrar compra'); } finally { setSaving(false); }
  };

  // Handlers para Recetas
  const saveRecipe = async () => {
    if (!selectedProduct) return;
    setSaving(true);
    try {
      await api.put(`/inventario/productos/${selectedProduct.id}/receta`, { recipes: recipeRows });
      toast.success('Receta guardada');
      await cargar();
    } catch (error) { toast.error('No se pudo guardar la receta'); } finally { setSaving(false); }
  };

  const saveProductConfig = async () => {
    if (!selectedProduct) return;
    setSaving(true);
    try {
      await api.put(`/inventario/productos/${selectedProduct.id}/config`, productConfig);
      toast.success('Modo de stock actualizado');
      await cargar();
    } catch (error) { toast.error('Error al guardar config'); } finally { setSaving(false); }
  };

  const syncPizzasWithPrepizza = async () => {
    setSaving(true);
    try {
      const response = await api.post('/inventario/productos/sync/pizzas-prepizza');
      toast.success(`Pizzas sincronizadas con ${response?.insumo?.nombre || 'Prepizza'}`);
      await cargar();
    } catch (error) {
      toast.error(error?.error || 'No se pudo sincronizar el stock de pizzas');
    } finally {
      setSaving(false);
    }
  };

  const syncEmpanadasWithStock = async () => {
    setSaving(true);
    try {
      await api.post('/inventario/productos/sync/empanadas-insumos');
      toast.success('Empanadas sincronizadas con sus insumos');
      await cargar();
    } catch (error) {
      toast.error(error?.error || 'No se pudieron sincronizar las empanadas');
    } finally {
      setSaving(false);
    }
  };

  const syncMilanesasWithStock = async () => {
    setSaving(true);
    try {
      await api.post('/inventario/productos/sync/milanesas-base');
      toast.success('Milanesas sincronizadas con carne y pollo');
      await cargar();
    } catch (error) {
      toast.error(error?.error || 'No se pudieron sincronizar las milanesas');
    } finally {
      setSaving(false);
    }
  };

  const syncPapasWithStock = async () => {
    setSaving(true);
    try {
      await api.post('/inventario/productos/sync/papas-full-cheddar');
      toast.success('Papas Full Cheddar sincronizadas con sus insumos');
      await cargar();
    } catch (error) {
      toast.error(error?.error || 'No se pudieron sincronizar las papas');
    } finally {
      setSaving(false);
    }
  };

  const copyShoppingList = async () => {
    const msg = faltantes.map(i => `- ${i.nombre}: falta ${i.faltante} ${i.unidad}`).join('\n');
    if (!msg) return toast.error('No hay faltantes');
    navigator.clipboard.writeText(`Lista de Compras:\n${msg}`).then(() => toast.success('Copiado al portapapeles'));
  };

  const printFaltantes = () => {
    if (!faltantes.length) {
      toast.error('No hay faltantes para imprimir');
      return;
    }
    const html = `
      <html>
        <head>
          <title>Faltantes de Inventario</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border-bottom: 1px solid #ddd; padding: 10px; text-align: left; }
            th { font-size: 12px; text-transform: uppercase; color: #666; }
          </style>
        </head>
        <body>
          <h1>Faltantes de inventario</h1>
          <p>Generado: ${new Date().toLocaleString('es-AR')}</p>
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Faltante</th>
                <th>Stock actual</th>
                <th>Minimo</th>
              </tr>
            </thead>
            <tbody>
              ${faltantes.map((item) => `
                <tr>
                  <td>${item.nombre}</td>
                  <td>${item.faltante} ${item.unidad}</td>
                  <td>${item.stock_actual} ${item.unidad}</td>
                  <td>${item.stock_minimo} ${item.unidad}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) {
      toast.error('El navegador bloqueo la impresion');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const closeMovementModal = () => {
    setMovementModal(null);
    setMovementForm({ tipo: 'entrada', cantidad: '', motivo: '' });
  };

  const registrarMovimiento = async () => {
    if (!movementModal) return;
    if (!movementForm.cantidad) {
      toast.error('Ingresa una cantidad');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/inventario/insumos/${movementModal.id}/movimientos`, movementForm);
      toast.success('Movimiento registrado');
      closeMovementModal();
      await cargar();
    } catch (error) {
      toast.error(error?.error || 'No se pudo registrar el movimiento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Header Seccion */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-1 bg-[#5D87FF] rounded-full"></div>
              <p className="text-sm font-black text-[#5D87FF] uppercase tracking-[0.3em]">Gestión de Suministros</p>
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Inventario y Recetas</h1>
            <p className="mt-1 text-gray-500 font-medium">Controla el stock compartido de tus pizzas y milanesas.</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button onClick={openCompraModal} className="flex h-12 items-center gap-2 rounded-2xl bg-gray-900 text-white px-6 text-sm font-black shadow-lg shadow-gray-200 transition-all hover:bg-gray-800 active:scale-95">
              <ShoppingCart size={18} strokeWidth={3} />
              REGISTRAR COMPRA
            </button>
            <button onClick={openNewInsumo} className="flex h-12 items-center gap-2 rounded-2xl bg-[#5D87FF] text-white px-6 text-sm font-black shadow-lg shadow-blue-100 transition-all hover:bg-[#4570EA] active:scale-95">
              <Plus size={18} strokeWidth={3} />
              NUEVO INSUMO
            </button>
          </div>
        </div>

        {/* Metricas */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total Insumos" value={stats.total} icon={Boxes} tint="blue" />
          <Stat label="Stock Crítico" value={stats.bajos} icon={AlertTriangle} tint="rose" helper={`${faltantes.length} para reponer`} />
          <Stat label="Con Receta" value={stats.receta} icon={TrendingUp} tint="emerald" helper="Descuento compartido" />
          <Stat label="Venta Frenada" value={stats.frenados} icon={MinusCircle} tint="amber" helper="Sin ingredientes" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          
          {/* Panel Principal de Insumos */}
          <div className="space-y-6">
            <div className="rounded-[28px] bg-white p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Catálogo de Insumos</h3>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    value={busqueda} 
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar base o ingrediente..." 
                    className="h-11 w-full rounded-2xl bg-gray-50 pl-12 pr-4 text-sm font-bold border-none focus:ring-2 focus:ring-[#5D87FF]/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredInsumos.map(insumo => {
                  const pct = Math.min(100, Math.max(0, (Number(insumo.stock_actual) / (Number(insumo.stock_minimo) * 3)) * 100));
                  const isLow = insumo.stock_bajo;
                  return (
                    <div key={insumo.id} className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight line-clamp-2">{insumo.nombre}</h4>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{insumo.rubro}</p>
                        </div>
                        <button onClick={() => openEditInsumo(insumo)} className="p-2 text-gray-300 hover:text-[#5D87FF] transition-colors">
                          <Pencil size={16} />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-end gap-3">
                          <p className="text-lg font-black text-gray-900">{fmtStock(insumo.stock_actual, insumo.unidad)}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Mín: {fmtStock(insumo.stock_minimo, insumo.unidad)}</p>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-[#FA896B]' : 'bg-[#13DEB9]'}`} 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button onClick={() => openEditInsumo(insumo)} className="flex-1 h-9 rounded-xl bg-[#ECF2FF] text-[10px] font-black text-[#5D87FF] uppercase tracking-wider hover:bg-[#5D87FF] hover:text-white transition-all">
                          Ver Detalles
                        </button>
                        <button onClick={() => setMovementModal(insumo)} className="h-9 w-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-all">
                          <History size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Editor de Recetas */}
            <div className="rounded-[28px] bg-white p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="h-10 w-10 rounded-xl bg-[#FEF5E5] flex items-center justify-center text-[#FFAE1F]">
                  <TrendingUp size={20} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Vincular Productos a Stock Compartido</h3>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Elegir Producto</label>
                    <select 
                      value={selectedProductId} 
                      onChange={e => setSelectedProductId(e.target.value)}
                      className={CONTROL + " mt-1"}
                    >
                      {productos.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} ({p.stock_mode === 'recipe' ? 'Receta' : 'Stock Directo'})</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:w-48">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Modo Stock</label>
                    <select 
                      value={productConfig.stock_mode} 
                      onChange={e => setProductConfig(p => ({ ...p, stock_mode: e.target.value }))}
                      className={CONTROL + " mt-1"}
                    >
                      <option value="direct">Stock Directo</option>
                      <option value="recipe">Usa Receta</option>
                    </select>
                  </div>
                  <div className="md:w-48 md:self-end">
                    <button
                      onClick={saveProductConfig}
                      disabled={!selectedProduct || saving}
                      className="h-11 w-full rounded-2xl bg-[#5D87FF] text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-100 transition-all hover:bg-[#4570EA] disabled:opacity-50"
                    >
                      Guardar modo
                    </button>
                  </div>
                  <div className="md:w-72 md:self-end">
                    <button
                      onClick={syncPizzasWithPrepizza}
                      disabled={saving}
                      className="h-11 w-full rounded-2xl bg-gray-900 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-gray-200 transition-all hover:bg-gray-800 disabled:opacity-50"
                    >
                      Sincronizar pizzas con Prepizza
                    </button>
                  </div>
                  <div className="md:w-72 md:self-end">
                    <button
                      onClick={syncEmpanadasWithStock}
                      disabled={saving}
                      className="h-11 w-full rounded-2xl bg-gray-900 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-gray-200 transition-all hover:bg-gray-800 disabled:opacity-50"
                    >
                      Sincronizar empanadas
                    </button>
                  </div>
                  <div className="md:w-72 md:self-end">
                    <button
                      onClick={syncMilanesasWithStock}
                      disabled={saving}
                      className="h-11 w-full rounded-2xl bg-gray-900 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-gray-200 transition-all hover:bg-gray-800 disabled:opacity-50"
                    >
                      Sincronizar milanesas
                    </button>
                  </div>
                  <div className="md:w-72 md:self-end">
                    <button
                      onClick={syncPapasWithStock}
                      disabled={saving}
                      className="h-11 w-full rounded-2xl bg-gray-900 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-gray-200 transition-all hover:bg-gray-800 disabled:opacity-50"
                    >
                      Sincronizar papas
                    </button>
                  </div>
                </div>

                {productConfig.stock_mode === 'recipe' ? (
                  <div className="space-y-4 rounded-[24px] bg-[#F4F7FB] p-6 border border-blue-50">
                    <p className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-widest italic">Este producto descontará de los siguientes insumos:</p>
                    
                    {recipeRows.map((row, idx) => (
                      <div key={idx} className="flex flex-wrap gap-3 items-end bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex-1 min-w-[150px]">
                          <select 
                            value={row.insumo_id} 
                            onChange={e => {
                              const next = [...recipeRows];
                              next[idx].insumo_id = e.target.value;
                              setRecipeRows(next);
                            }}
                            className={CONTROL + " h-10 px-3 bg-white"}
                          >
                            <option value="">Elegir base...</option>
                            {insumos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                          </select>
                        </div>
                        <div className="w-24">
                          <input 
                            type="number" 
                            value={row.cantidad} 
                            onChange={e => {
                              const next = [...recipeRows];
                              next[idx].cantidad = e.target.value;
                              setRecipeRows(next);
                            }}
                            placeholder="Cant." 
                            className={CONTROL + " h-10 px-3 bg-white"} 
                          />
                        </div>
                        <button onClick={() => setRecipeRows(recipeRows.filter((_, i) => i !== idx))} className="h-10 w-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-all">
                          <X size={18} />
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setRecipeRows([...recipeRows, { ...EMPTY_ROW }])} className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-600 hover:bg-gray-50 transition-all">
                        <Plus size={16} /> AGREGAR INSUMO
                      </button>
                      <button onClick={saveRecipe} disabled={saving} className="flex h-11 items-center gap-2 rounded-xl bg-[#5D87FF] px-6 text-xs font-black text-white shadow-lg shadow-blue-100 hover:bg-[#4570EA] transition-all">
                        <Save size={16} /> GUARDAR RECETA
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[24px] bg-white p-8 border-2 border-dashed border-gray-100">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Este producto usa stock directo.</p>
                    <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr]">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Stock Directo</label>
                        <input
                          type="number"
                          value={productConfig.stock_directo}
                          onChange={e => setProductConfig(p => ({ ...p, stock_directo: e.target.value }))}
                          className={CONTROL + " mt-1"}
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={saveProductConfig}
                          disabled={!selectedProduct || saving}
                          className="h-11 rounded-2xl bg-gray-900 px-6 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-gray-200 transition-all hover:bg-gray-800 disabled:opacity-50"
                        >
                          Guardar stock directo
                        </button>
                      </div>
                    </div>
                    <button onClick={() => setProductConfig(p => ({ ...p, stock_mode: 'recipe' }))} className="mt-5 text-[#5D87FF] font-black text-xs uppercase hover:underline">Cambiar a modo receta</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar: Lista de Compras y Alertas */}
          <div className="space-y-6">
            <div className="rounded-[28px] bg-white p-6 shadow-sm border border-gray-100 h-fit">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Faltantes</h3>
                <div className="flex gap-2">
                  <button onClick={copyShoppingList} className="h-9 w-9 rounded-xl bg-[#ECF2FF] flex items-center justify-center text-[#5D87FF] hover:bg-[#DDE8FF]">
                    <Copy size={16} />
                  </button>
                  <button onClick={printFaltantes} className="h-9 w-9 rounded-xl bg-gray-900 flex items-center justify-center text-white hover:bg-gray-800">
                    <Printer size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {faltantes.length === 0 ? (
                  <div className="py-6 text-center bg-[#E6FFFA] rounded-[20px] border border-[#13DEB9]/20">
                    <p className="text-xs font-black text-[#13DEB9] uppercase tracking-widest">Todo bajo control</p>
                  </div>
                ) : faltantes.map(i => (
                  <div key={i.id} className="flex items-center gap-3 p-3 rounded-[18px] bg-rose-50 border border-rose-100">
                    <AlertTriangle size={16} className="text-rose-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-rose-900 truncate uppercase tracking-tight">{i.nombre}</p>
                      <p className="text-[10px] font-bold text-rose-600">FALTAN {i.faltante} {i.unidad}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] bg-white p-8 shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-6">Últimos Movimientos</h3>
              <div className="space-y-3">
                {movimientos.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-black text-[10px] ${Number(m.cantidad) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {Number(m.cantidad) > 0 ? '+' : ''}{m.cantidad}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-gray-800 uppercase tracking-tight truncate">{m.insumo_nombre || m.producto_nombre}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{m.motivo || m.tipo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL NUEVA COMPRA */}
      {compraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[40px] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-1 bg-[#5D87FF] rounded-full"></div>
                  <p className="text-xs font-black text-[#5D87FF] uppercase tracking-[0.2em]">Ingreso de Mercadería</p>
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Registrar Compra</h3>
              </div>
              <button onClick={() => setCompraModal(false)} className="rounded-full p-2 hover:bg-gray-100 transition-colors">
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-2 no-scrollbar space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Proveedor</label>
                  <input 
                    value={compraForm.proveedor} 
                    onChange={e => setCompraForm(p => ({ ...p, proveedor: e.target.value }))}
                    placeholder="Nombre del proveedor" 
                    className={CONTROL + " mt-1"}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Método de Pago</label>
                  <select 
                    value={compraForm.metodo_pago} 
                    onChange={e => setCompraForm(p => ({ ...p, metodo_pago: e.target.value }))}
                    className={CONTROL + " mt-1"}
                  >
                    <option value="efectivo">Efectivo de Caja</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="cuenta_corriente">Cuenta Corriente (Deuda)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Detalle de Productos</p>
                {compraForm.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_100px_140px_40px] gap-3 bg-gray-50 p-4 rounded-[24px] border border-gray-100">
                    <select 
                      value={item.insumo_id} 
                      onChange={e => updateCompraItem(idx, 'insumo_id', e.target.value)}
                      className={CONTROL + " h-10 px-3 bg-white"}
                    >
                      <option value="">Elegir Insumo...</option>
                      {insumos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                    </select>
                    <input 
                      type="number" 
                      value={item.cantidad} 
                      onChange={e => updateCompraItem(idx, 'cantidad', e.target.value)}
                      placeholder="Cant." 
                      className={CONTROL + " h-10 px-3 bg-white"} 
                    />
                    <input 
                      type="number" 
                      value={item.costo_unitario} 
                      onChange={e => updateCompraItem(idx, 'costo_unitario', e.target.value)}
                      placeholder="Costo u." 
                      className={CONTROL + " h-10 px-3 bg-white"} 
                    />
                    <button onClick={() => setCompraForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))} className="h-10 w-10 rounded-xl bg-white text-rose-400 flex items-center justify-center hover:bg-rose-50 transition-all border border-gray-100">
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button onClick={addCompraItem} className="w-full h-12 rounded-[24px] border-2 border-dashed border-gray-200 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 transition-all">
                  + AGREGAR OTRO ITEM
                </button>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => setCompraModal(false)} className="flex-1 h-14 rounded-2xl border border-gray-200 text-sm font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 transition-all">
                CANCELAR
              </button>
              <button onClick={registrarCompra} disabled={saving} className="flex-[2] h-14 rounded-2xl bg-[#5D87FF] text-sm font-black text-white uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-[#4570EA] active:scale-95 transition-all disabled:opacity-50">
                {saving ? 'REGISTRANDO...' : 'CONFIRMAR COMPRA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INSUMO */}
      {insumoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[40px] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-1 bg-[#5D87FF] rounded-full"></div>
                  <p className="text-xs font-black text-[#5D87FF] uppercase tracking-[0.2em]">{insumoModal === 'new' ? 'Crear' : 'Ajustar'}</p>
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Datos del Insumo</h3>
              </div>
              <button onClick={closeInsumoModal} className="rounded-full p-2 hover:bg-gray-100">
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <input value={insumoForm.nombre} onChange={e => setInsumoForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre (ej: Prepizza Grande)" className={CONTROL} />
              <div className="grid grid-cols-2 gap-4">
                <select value={insumoForm.rubro} onChange={e => setInsumoForm(p => ({ ...p, rubro: e.target.value }))} className={CONTROL}>
                  {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={insumoForm.unidad} onChange={e => setInsumoForm(p => ({ ...p, unidad: e.target.value }))} className={CONTROL}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Stock Actual</label>
                  <input type="number" value={insumoForm.stock_actual} onChange={e => setInsumoForm(p => ({ ...p, stock_actual: e.target.value }))} className={CONTROL + " mt-1"} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Stock Mínimo</label>
                  <input type="number" value={insumoForm.stock_minimo} onChange={e => setInsumoForm(p => ({ ...p, stock_minimo: e.target.value }))} className={CONTROL + " mt-1"} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Costo Unitario ($)</label>
                <input type="number" value={insumoForm.costo_unitario} onChange={e => setInsumoForm(p => ({ ...p, costo_unitario: e.target.value }))} className={CONTROL + " mt-1"} />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={closeInsumoModal} className="flex-1 h-14 rounded-2xl border border-gray-200 text-sm font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 transition-all">
                CANCELAR
              </button>
              <button onClick={saveInsumo} disabled={saving} className="flex-[2] h-14 rounded-2xl bg-gray-900 text-sm font-black text-white uppercase tracking-widest shadow-lg shadow-gray-200 hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50">
                {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {movementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[40px] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-1 bg-[#5D87FF] rounded-full"></div>
                  <p className="text-xs font-black text-[#5D87FF] uppercase tracking-[0.2em]">Movimiento manual</p>
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">{movementModal.nombre}</h3>
              </div>
              <button onClick={closeMovementModal} className="rounded-full p-2 hover:bg-gray-100 transition-colors">
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMovementForm((prev) => ({ ...prev, tipo: 'entrada' }))}
                  className={`flex h-14 items-center justify-center gap-2 rounded-2xl border-2 font-black text-xs uppercase tracking-widest ${movementForm.tipo === 'entrada' ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-gray-100 text-gray-400'}`}
                >
                  <Plus size={16} />
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setMovementForm((prev) => ({ ...prev, tipo: 'salida' }))}
                  className={`flex h-14 items-center justify-center gap-2 rounded-2xl border-2 font-black text-xs uppercase tracking-widest ${movementForm.tipo === 'salida' ? 'border-rose-200 bg-rose-50 text-rose-500' : 'border-gray-100 text-gray-400'}`}
                >
                  <MinusCircle size={16} />
                  Salida
                </button>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cantidad</label>
                <input
                  type="number"
                  value={movementForm.cantidad}
                  onChange={e => setMovementForm((prev) => ({ ...prev, cantidad: e.target.value }))}
                  className={CONTROL + " mt-1"}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Motivo</label>
                <input
                  value={movementForm.motivo}
                  onChange={e => setMovementForm((prev) => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Ej: rotura, reposicion, consumo interno"
                  className={CONTROL + " mt-1"}
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={closeMovementModal} className="flex-1 h-14 rounded-2xl border border-gray-200 text-sm font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 transition-all">
                Cancelar
              </button>
              <button onClick={registrarMovimiento} disabled={saving} className="flex-[2] h-14 rounded-2xl bg-[#5D87FF] text-sm font-black text-white uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-[#4570EA] transition-all disabled:opacity-50">
                {saving ? 'Guardando...' : 'Confirmar movimiento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
