import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CircleDollarSign,
  Eye,
  ImagePlus,
  LayoutGrid,
  List,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  TimerReset,
  Trash2,
  X,
} from 'lucide-react';

const EMPTY_FORM = {
  nombre: '',
  descripcion: '',
  precio: '',
  costo: '',
  categoria_id: '',
  tiempo_preparacion: 15,
  activo: 1,
  destacado: 0,
  imagen: '',
  stock: 0,
};

const CONTROL =
  'h-11 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-medium text-gray-700 outline-none transition focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100';

function fmtMoney(value) {
  return `$${Number(value || 0).toLocaleString('es-AR')}`;
}

function rgba(hex, alpha) {
  const clean = (hex || '#f97316').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return `rgba(249,115,22,${alpha})`;
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

function codeFor(id, index) {
  return `PROD-${String(id ?? index + 1).padStart(3, '0')}`;
}

function parseJsonList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeVariantGroups(groups) {
  return (groups || [])
    .map((group) => ({
      nombre: String(group?.nombre || '').trim(),
      opciones: (group?.opciones || [])
        .map((option) => ({
          nombre: String(option?.nombre || '').trim(),
          precio_extra: Number(option?.precio_extra || 0),
        }))
        .filter((option) => option.nombre),
    }))
    .filter((group) => group.nombre && group.opciones.length > 0);
}

function normalizeExtras(extras) {
  return (extras || [])
    .map((extra) => ({
      nombre: String(extra?.nombre || '').trim(),
      precio: Number(extra?.precio || 0),
    }))
    .filter((extra) => extra.nombre);
}

function getStructuredPricingConfig(categoryName) {
  const name = normalizeText(categoryName);

  if (name.includes('pizza')) {
    return {
      groupName: 'Presentacion',
      baseOption: 'Entera',
      options: [
        { nombre: 'Entera', label: 'Precio entera' },
        { nombre: 'Mitad', label: 'Precio mitad' },
      ],
      helper: 'El precio principal visible sera la entera. La mitad se carga como presentacion con precio final propio. Para stock real usa inventario por receta e insumos compartidos.',
    };
  }

  if (name.includes('empanada')) {
    return {
      groupName: 'Presentacion',
      baseOption: 'Docena',
      options: [
        { nombre: 'Docena', label: 'Precio docena' },
        { nombre: 'Media docena', label: 'Precio media docena' },
      ],
      helper: 'El precio principal visible sera la docena. La media docena se carga como presentacion con precio final propio. Para stock real usa inventario por receta e insumos compartidos.',
    };
  }

  if (name.includes('milanesa')) {
    return {
      groupName: 'Tipo',
      baseOption: 'Ternera',
      options: [
        { nombre: 'Ternera', label: 'Precio carne' },
        { nombre: 'Pollo', label: 'Precio pollo' },
      ],
      helper: 'El precio principal visible sera el de carne. Pollo se carga como tipo con precio final propio. Para stock real usa inventario por receta e insumos compartidos.',
    };
  }

  return null;
}

function ensureStructuredPricingGroups(categoryName, groups) {
  const config = getStructuredPricingConfig(categoryName);
  const normalized = normalizeVariantGroups(groups);
  if (!config) return normalized;

  const otherGroups = normalized.filter((group) => normalizeText(group.nombre) !== normalizeText(config.groupName));
  const currentGroup = normalized.find((group) => normalizeText(group.nombre) === normalizeText(config.groupName));
  const optionMap = new Map(
    (currentGroup?.opciones || []).map((option) => [
      normalizeText(option.nombre),
      {
        nombre: String(option?.nombre || '').trim(),
        precio_extra: Number(option?.precio_extra || 0),
      },
    ])
  );

  return [
    {
      nombre: config.groupName,
      opciones: config.options.map((option) => ({
        nombre: option.nombre,
        precio_extra: option.nombre === config.baseOption ? 0 : Number(optionMap.get(normalizeText(option.nombre))?.precio_extra || 0),
      })),
    },
    ...otherGroups,
  ];
}

function normalizeStructuredPricingState(categoryName, basePrice, groups) {
  const config = getStructuredPricingConfig(categoryName);
  const normalizedGroups = normalizeVariantGroups(groups);
  const parsedBase = Number(basePrice || 0);

  if (!config) {
    return {
      basePrice: parsedBase,
      groups: normalizedGroups,
    };
  }

  const pricingGroup = normalizedGroups.find((group) => normalizeText(group.nombre) === normalizeText(config.groupName));
  const currentFinals = new Map();

  (pricingGroup?.opciones || []).forEach((option) => {
    currentFinals.set(normalizeText(option.nombre), parsedBase + Number(option.precio_extra || 0));
  });

  const nextBasePrice = Number(currentFinals.get(normalizeText(config.baseOption)) ?? parsedBase);
  const otherGroups = normalizedGroups.filter((group) => normalizeText(group.nombre) !== normalizeText(config.groupName));

  return {
    basePrice: nextBasePrice,
    groups: [
      {
        nombre: config.groupName,
        opciones: config.options.map((option) => {
          const optionKey = normalizeText(option.nombre);
          const targetFinal = Number(currentFinals.get(optionKey) ?? (optionKey === normalizeText(config.baseOption) ? nextBasePrice : nextBasePrice));
          return {
            nombre: option.nombre,
            precio_extra: targetFinal - nextBasePrice,
          };
        }),
      },
      ...otherGroups,
    ],
  };
}

function getPricingOptionTotals(categoryName, basePrice, groups) {
  const config = getStructuredPricingConfig(categoryName);
  const normalizedState = normalizeStructuredPricingState(categoryName, basePrice, groups);
  const base = Number(normalizedState.basePrice || 0);
  if (!config) return [{ nombre: 'Precio', label: 'Precio', finalPrice: base }];

  const pricingGroup = normalizedState.groups.find(
    (group) => normalizeText(group.nombre) === normalizeText(config.groupName)
  );
  const optionMap = new Map(
    (pricingGroup?.opciones || []).map((option) => [normalizeText(option.nombre), Number(option?.precio_extra || 0)])
  );

  return config.options.map((option) => ({
    nombre: option.nombre,
    label: option.label,
    finalPrice: base + (option.nombre === config.baseOption ? 0 : Number(optionMap.get(normalizeText(option.nombre)) || 0)),
  }));
}

function updateStructuredPricing(categoryName, groups, basePrice, optionName, nextFinalPrice) {
  const config = getStructuredPricingConfig(categoryName);
  const normalizedState = normalizeStructuredPricingState(categoryName, basePrice, groups);
  if (!config) return { basePrice: Number(nextFinalPrice || basePrice || 0), groups: normalizeVariantGroups(groups) };

  const currentTotals = getPricingOptionTotals(categoryName, normalizedState.basePrice, normalizedState.groups);
  const currentTotalsMap = new Map(currentTotals.map((option) => [normalizeText(option.nombre), Number(option.finalPrice || 0)]));
  const nextValue = Math.max(0, Number(nextFinalPrice || 0));
  const baseOptionKey = normalizeText(config.baseOption);
  const changedKey = normalizeText(optionName);
  const nextBasePrice = changedKey === baseOptionKey ? nextValue : Math.max(0, Number(normalizedState.basePrice || 0));
  const otherGroups = normalizeVariantGroups(normalizedState.groups).filter((group) => normalizeText(group.nombre) !== normalizeText(config.groupName));

  return {
    basePrice: nextBasePrice,
    groups: [
      {
        nombre: config.groupName,
        opciones: config.options.map((option) => {
          const optionKey = normalizeText(option.nombre);
          if (optionKey === baseOptionKey) {
            return { nombre: option.nombre, precio_extra: 0 };
          }

          const targetFinal = optionKey === changedKey
            ? nextValue
            : Number(currentTotalsMap.get(optionKey) ?? nextBasePrice);

          return {
            nombre: option.nombre,
            precio_extra: targetFinal - nextBasePrice,
          };
        }),
      },
      ...otherGroups,
    ],
  };
}

function getVariantTemplate(categoryName) {
  const config = getStructuredPricingConfig(categoryName);
  if (config) {
    return ensureStructuredPricingGroups(categoryName, []);
  }

  const name = normalizeText(categoryName);

  return [];
}

function getTemplateHint(categoryName) {
  const name = normalizeText(categoryName);

  if (name.includes('pizza')) {
    return 'Plantilla sugerida: un producto por gusto. Precio principal = entera. La mitad se elige al vender.';
  }

  if (name.includes('empanada')) {
    return 'Plantilla sugerida: un producto por gusto. Precio principal = docena. La media docena se elige al vender.';
  }

  if (name.includes('milanesa')) {
    return 'Plantilla sugerida: un producto por gusto. Precio principal = carne. Pollo se elige al vender.';
  }

  return 'Usa la plantilla sugerida para arrancar rapido y despues ajusta nombres o precios si hace falta.';
}

function StatCard({ label, value, icon: Icon, tone, helper }) {
  return (
    <div
      className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-100 hover:shadow-xl"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-black tracking-tight text-gray-900">{value}</p>
          {helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: rgba(tone, 0.14), color: tone }}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function PriceSummary({ options, basePrice, singleClassName, multiClassName, itemClassName }) {
  if (options.length === 1) {
    return <p className={singleClassName}>{fmtMoney(basePrice)}</p>;
  }

  return (
    <div className={multiClassName}>
      {options.map((option) => (
        <p key={option.nombre} className={itemClassName}>
          {option.nombre}: {fmtMoney(option.finalPrice)}
        </p>
      ))}
    </div>
  );
}

function ProductCard({ producto, categoriaInfo, onView, onEdit, onToggle, onDelete }) {
  const active = Number(producto.activo) === 1;
  const stockLow = Number(producto.stock || 0) < 10;
  const priceOptions = getPricingOptionTotals(categoriaInfo?.nombre, producto.precio, producto.variantGroups);

  return (
    <article className="group flex h-full flex-col rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-100 hover:shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white shadow-sm" style={{ backgroundColor: rgba(categoriaInfo?.color, 0.14) }}>
            {producto.imagen ? (
              <img src={producto.imagen} alt={producto.nombre} className="h-full w-full object-cover" />
            ) : (
              <span className="text-[28px]">{categoriaInfo?.icono || '🍽️'}</span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">{producto.codigo}</p>
            <h3 className="truncate text-lg font-black tracking-tight text-gray-900">{producto.nombre}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                {active ? 'Activo' : 'Inactivo'}
              </span>
              {producto.destacado === 1 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                  <Star size={12} />
                  Destacado
                </span>
              )}
              {stockLow && (
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">Stock bajo</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
          <button type="button" onClick={() => onView(producto)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
            <Eye size={15} />
          </button>
          <button type="button" onClick={() => onEdit(producto)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
            <Pencil size={15} />
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="line-clamp-2 text-sm leading-6 text-gray-500">{producto.descripcion || 'Sin descripcion cargada por ahora.'}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Precio</p>
          <PriceSummary
            options={priceOptions}
            basePrice={producto.precio}
            singleClassName="mt-1 text-xl font-black tracking-tight text-[#5D87FF]"
            multiClassName="mt-1 space-y-1"
            itemClassName="text-sm font-black tracking-tight text-[#5D87FF]"
          />
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Stock</p>
          <p className={`mt-1 text-xl font-black tracking-tight ${stockLow ? 'text-rose-600' : 'text-gray-900'}`}>{producto.stock || 0}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: rgba(categoriaInfo?.color, 0.12), color: categoriaInfo?.color || '#f97316' }}>
          {categoriaInfo?.icono || '🍽️'} {categoriaInfo?.nombre || 'Sin categoria'}
        </span>
        <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
          {producto.variantGroups.length} grupo{producto.variantGroups.length === 1 ? '' : 's'} de variantes
        </span>
        <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
          {producto.extrasList.length} extra{producto.extrasList.length === 1 ? '' : 's'}
        </span>
        <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
          {producto.stock_mode === 'recipe' ? 'Stock por receta' : 'Stock directo'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onToggle(producto)} className={`h-10 rounded-2xl text-sm font-bold transition ${active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
          {active ? 'Desactivar' : 'Activar'}
        </button>
        <button type="button" onClick={() => onDelete(producto)} className="h-10 rounded-2xl border border-rose-200 text-sm font-bold text-rose-600 transition hover:bg-rose-50">
          Eliminar
        </button>
      </div>
    </article>
  );
}

function ProductRow({ producto, categoriaInfo, onView, onEdit, onToggle, onDelete }) {
  const active = Number(producto.activo) === 1;
  const stockLow = Number(producto.stock || 0) < 10;
  const priceOptions = getPricingOptionTotals(categoriaInfo?.nombre, producto.precio, producto.variantGroups);

  return (
    <tr className="border-b border-slate-100 transition hover:bg-slate-50">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white text-2xl" style={{ backgroundColor: rgba(categoriaInfo?.color, 0.14) }}>
            {producto.imagen ? <img src={producto.imagen} alt={producto.nombre} className="h-full w-full object-cover" /> : categoriaInfo?.icono || '🍽️'}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-gray-900">{producto.nombre}</p>
            <p className="text-xs text-gray-400">{producto.codigo}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: rgba(categoriaInfo?.color, 0.12), color: categoriaInfo?.color || '#f97316' }}>
          {categoriaInfo?.icono || '🍽️'} {categoriaInfo?.nombre || 'Sin categoria'}
        </span>
      </td>
      <td className="px-5 py-4 text-right font-black text-gray-900">
        <PriceSummary
          options={priceOptions}
          basePrice={producto.precio}
          singleClassName=""
          multiClassName="space-y-1 text-xs font-bold text-[#5D87FF]"
          itemClassName=""
        />
      </td>
      <td className="px-5 py-4 text-center">
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${stockLow ? 'bg-rose-50 text-rose-700' : 'bg-gray-100 text-gray-600'}`}>
          {producto.stock || 0} uds
        </span>
      </td>
      <td className="px-5 py-4 text-center">
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
          {active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="px-5 py-4 text-center text-sm font-semibold text-gray-600">{producto.variantGroups.length}/{producto.extrasList.length}</td>
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <button type="button" onClick={() => onView(producto)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
            <Eye size={15} />
          </button>
          <button type="button" onClick={() => onEdit(producto)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
            <Pencil size={15} />
          </button>
          <button type="button" onClick={() => onToggle(producto)} className={`flex h-9 items-center justify-center rounded-xl px-3 text-xs font-bold transition ${active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
            {active ? 'Off' : 'On'}
          </button>
          <button type="button" onClick={() => onDelete(producto)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50">
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Productos() {
  const fileInputRef = useRef(null);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [sortBy, setSortBy] = useState('nombre');
  const [viewMode, setViewMode] = useState('grid');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const [variantesEditor, setVariantesEditor] = useState([]);
  const [extrasEditor, setExtrasEditor] = useState([]);

  const cargar = async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([api.get('/productos'), api.get('/categorias')]);
      setProductos(prods);
      setCategorias(cats);
    } catch (error) {
      toast.error(error?.error || 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const categoriasMap = useMemo(() => {
    return new Map(categorias.map((categoria) => [categoria.id, categoria]));
  }, [categorias]);

  const productosUi = useMemo(() => {
    return productos.map((producto, index) => {
      const categoriaInfo = categoriasMap.get(producto.categoria_id);
      return {
        ...producto,
        codigo: codeFor(producto.id, index),
        categoriaInfo,
        variantGroups: parseJsonList(producto.variantes),
        extrasList: parseJsonList(producto.extras),
      };
    });
  }, [productos, categoriasMap]);

  const filtered = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const list = productosUi.filter((producto) => {
      const matchesSearch =
        !term ||
        producto.nombre.toLowerCase().includes(term) ||
        producto.codigo.toLowerCase().includes(term) ||
        String(producto.descripcion || '').toLowerCase().includes(term) ||
        String(producto.categoriaInfo?.nombre || '').toLowerCase().includes(term);

      const matchesCategory = filtroCategoria === 'todas' || String(producto.categoria_id || '') === filtroCategoria;
      const matchesState =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activos' && Number(producto.activo) === 1) ||
        (filtroEstado === 'inactivos' && Number(producto.activo) !== 1);

      return matchesSearch && matchesCategory && matchesState;
    });

    if (sortBy === 'precio') return [...list].sort((a, b) => Number(b.precio || 0) - Number(a.precio || 0));
    if (sortBy === 'stock') return [...list].sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
    if (sortBy === 'categoria') return [...list].sort((a, b) => String(a.categoriaInfo?.nombre || '').localeCompare(String(b.categoriaInfo?.nombre || '')));
    return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [busqueda, filtroCategoria, filtroEstado, sortBy, productosUi]);

  const stats = useMemo(() => {
    const activos = productosUi.filter((producto) => Number(producto.activo) === 1).length;
    const destacados = productosUi.filter((producto) => Number(producto.destacado) === 1).length;
    const stockBajo = productosUi.filter((producto) => Number(producto.stock || 0) < 10).length;
    const inventario = productosUi.reduce((acc, producto) => acc + Number(producto.costo || 0) * Number(producto.stock || 0), 0);

    return {
      total: productosUi.length,
      activos,
      destacados,
      stockBajo,
      inventario,
    };
  }, [productosUi]);

  const selectedCategoryInfo = useMemo(() => {
    return categoriasMap.get(Number(form.categoria_id)) || null;
  }, [categoriasMap, form.categoria_id]);
  const structuredPricingConfig = useMemo(() => getStructuredPricingConfig(selectedCategoryInfo?.nombre), [selectedCategoryInfo]);
  const formPriceOptions = useMemo(
    () => getPricingOptionTotals(selectedCategoryInfo?.nombre, form.precio, variantesEditor),
    [selectedCategoryInfo, form.precio, variantesEditor]
  );
  const editingProduct = modal && modal !== 'nuevo' ? modal : null;
  const recipeManagedStock = editingProduct?.stock_mode === 'recipe';

  const abrirNuevo = () => {
    const defaultCategory = categorias[0] || null;
    setForm({
      ...EMPTY_FORM,
      categoria_id: defaultCategory?.id || '',
    });
    setVariantesEditor(ensureStructuredPricingGroups(defaultCategory?.nombre, getVariantTemplate(defaultCategory?.nombre)));
    setExtrasEditor([]);
    setImageFile(null);
    setImagePreview('');
    setRemoveImage(false);
    setModal('nuevo');
  };

  const abrirEditar = (producto) => {
    const normalizedPricing = normalizeStructuredPricingState(
      categoriasMap.get(producto.categoria_id)?.nombre,
      producto.precio,
      parseJsonList(producto.variantes)
    );

    setForm({
      nombre: producto.nombre || '',
      descripcion: producto.descripcion || '',
      precio: normalizedPricing.basePrice || '',
      costo: producto.costo || '',
      categoria_id: producto.categoria_id || '',
      tiempo_preparacion: producto.tiempo_preparacion || 15,
      activo: Number(producto.activo) === 1 ? 1 : 0,
      destacado: Number(producto.destacado) === 1 ? 1 : 0,
      imagen: producto.imagen || '',
      stock: producto.stock_directo ?? producto.stock ?? 0,
    });
    setVariantesEditor(normalizedPricing.groups);
    setExtrasEditor(parseJsonList(producto.extras));
    setImageFile(null);
    setImagePreview(producto.imagen || '');
    setRemoveImage(false);
    setModal(producto);
  };

  const cerrarModal = () => {
    setModal(null);
    setForm(EMPTY_FORM);
    setVariantesEditor([]);
    setExtrasEditor([]);
    setImageFile(null);
    setImagePreview('');
    setRemoveImage(false);
  };

  const changeCategory = (nextId) => {
    const nextCategory = categoriasMap.get(Number(nextId));
    const hasCustomVariants = normalizeVariantGroups(variantesEditor).length > 0;

    if (hasCustomVariants && !window.confirm('Cambiar la categoria puede reemplazar las variantes sugeridas. Queres continuar?')) {
      return;
    }

    setForm((prev) => ({ ...prev, categoria_id: nextId }));
    setVariantesEditor(ensureStructuredPricingGroups(nextCategory?.nombre, getVariantTemplate(nextCategory?.nombre)));
  };

  const handleImageChange = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen valida');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen supera 5MB');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    setRemoveImage(true);
    setForm((prev) => ({ ...prev, imagen: '' }));
  };

  const applySuggestedTemplate = () => {
    if (!selectedCategoryInfo?.nombre) {
      toast.error('Selecciona una categoria antes de usar la plantilla');
      return;
    }

    setVariantesEditor(ensureStructuredPricingGroups(selectedCategoryInfo.nombre, getVariantTemplate(selectedCategoryInfo.nombre)));

    const categoryName = normalizeText(selectedCategoryInfo.nombre);
    if (categoryName.includes('milanesa')) {
      toast.success('Plantilla aplicada: Tipo con Pollo y Ternera');
      return;
    }
    if (categoryName.includes('pizza')) {
      toast.success('Plantilla aplicada: Presentacion Mitad y Entera');
      return;
    }
    if (categoryName.includes('empanada')) {
      toast.success('Plantilla aplicada: Presentacion Media docena y Docena');
      return;
    }

    toast.success('Plantilla aplicada');
  };

  const addVariantGroup = () => {
    setVariantesEditor((prev) => [...prev, { nombre: '', opciones: [{ nombre: '', precio_extra: 0 }] }]);
  };

  const updateVariantGroup = (groupIndex, value) => {
    setVariantesEditor((prev) => prev.map((group, index) => (index === groupIndex ? { ...group, nombre: value } : group)));
  };

  const removeVariantGroup = (groupIndex) => {
    setVariantesEditor((prev) => prev.filter((_, index) => index !== groupIndex));
  };

  const addVariantOption = (groupIndex) => {
    setVariantesEditor((prev) =>
      prev.map((group, index) =>
        index === groupIndex ? { ...group, opciones: [...(group.opciones || []), { nombre: '', precio_extra: 0 }] } : group
      )
    );
  };

  const updateVariantOption = (groupIndex, optionIndex, field, value) => {
    setVariantesEditor((prev) =>
      prev.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              opciones: group.opciones.map((option, currentOptionIndex) =>
                currentOptionIndex === optionIndex
                  ? { ...option, [field]: field === 'precio_extra' ? Number(value || 0) : value }
                  : option
              ),
            }
          : group
      )
    );
  };

  const removeVariantOption = (groupIndex, optionIndex) => {
    setVariantesEditor((prev) =>
      prev.map((group, index) =>
        index === groupIndex ? { ...group, opciones: group.opciones.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex) } : group
      )
    );
  };

  const addExtra = () => {
    setExtrasEditor((prev) => [...prev, { nombre: '', precio: 0 }]);
  };

  const updateExtra = (index, field, value) => {
    setExtrasEditor((prev) =>
      prev.map((extra, currentIndex) =>
        currentIndex === index ? { ...extra, [field]: field === 'precio' ? Number(value || 0) : value } : extra
      )
    );
  };

  const removeExtra = (index) => {
    setExtrasEditor((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const validateForm = () => {
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return false;
    }

    if (!form.categoria_id) {
      toast.error('Selecciona una categoria');
      return false;
    }

    if (!form.precio || Number(form.precio) <= 0) {
      toast.error('El precio debe ser mayor a 0');
      return false;
    }

    if (Number(form.costo || 0) < 0 || Number(form.tiempo_preparacion || 0) < 0) {
      toast.error('Costo y tiempo deben ser validos');
      return false;
    }

    if (!recipeManagedStock && Number(form.stock || 0) < 0) {
      toast.error('El stock no puede ser negativo');
      return false;
    }

    const groups = normalizeVariantGroups(variantesEditor);
    const extras = normalizeExtras(extrasEditor);

    if ((variantesEditor || []).length > 0 && groups.length === 0) {
      toast.error('Completa al menos una variante valida o elimina los grupos vacios');
      return false;
    }

    if ((extrasEditor || []).length > 0 && extras.length === 0) {
      toast.error('Completa al menos un extra valido o elimina las filas vacias');
      return false;
    }

    if (extras.some((extra) => Number(extra.precio || 0) < 0)) {
      toast.error('Los extras no pueden tener precios negativos');
      return false;
    }

    return true;
  };

  const guardar = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = new FormData();
      payload.append('nombre', form.nombre);
      payload.append('descripcion', form.descripcion || '');
      payload.append('precio', String(form.precio));
      payload.append('costo', String(form.costo || 0));
      payload.append('categoria_id', String(form.categoria_id || ''));
      payload.append('tiempo_preparacion', String(form.tiempo_preparacion || 15));
      payload.append('activo', String(form.activo));
      payload.append('destacado', String(form.destacado));
      payload.append('variantes', JSON.stringify(normalizeVariantGroups(variantesEditor)));
      payload.append('extras', JSON.stringify(normalizeExtras(extrasEditor)));
      if (!recipeManagedStock) payload.append('stock', String(form.stock || 0));
      if (imageFile) payload.append('imagen', imageFile);
      if (removeImage) payload.append('remove_imagen', '1');

      if (modal === 'nuevo') {
        await api.post('/productos', payload);
        toast.success('Producto creado');
      } else {
        await api.put(`/productos/${modal.id}`, payload);
        toast.success('Producto actualizado');
      }

      cerrarModal();
      await cargar();
    } catch (error) {
      toast.error(error?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (producto) => {
    if (!window.confirm(`Eliminar "${producto.nombre}"?`)) return;
    try {
      await api.delete(`/productos/${producto.id}`);
      toast.success('Producto eliminado');
      if (detalle?.id === producto.id) setDetalle(null);
      await cargar();
    } catch (error) {
      toast.error(error?.error || 'Error al eliminar');
    }
  };

  const toggleActivo = async (producto) => {
    try {
      const payload = new FormData();
      payload.append('nombre', producto.nombre);
      payload.append('descripcion', producto.descripcion || '');
      payload.append('precio', String(producto.precio || 0));
      payload.append('costo', String(producto.costo || 0));
      payload.append('categoria_id', String(producto.categoria_id || ''));
      payload.append('tiempo_preparacion', String(producto.tiempo_preparacion || 15));
      payload.append('activo', String(Number(producto.activo) === 1 ? 0 : 1));
      payload.append('destacado', String(producto.destacado || 0));
      payload.append('variantes', producto.variantes || '[]');
      payload.append('extras', producto.extras || '[]');

      await api.put(`/productos/${producto.id}`, payload);
      toast.success(Number(producto.activo) === 1 ? 'Producto desactivado' : 'Producto activado');
      await cargar();
    } catch (error) {
      toast.error(error?.error || 'Error al cambiar estado');
    }
  };

  return (
    <div className="mx-auto max-w-7xl animate-fade-in space-y-6 px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden h-14 w-14 items-center justify-center rounded-2xl bg-[#ECF2FF] text-[#5D87FF] shadow-sm sm:flex">
              <Package size={28} />
            </div>
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#5D87FF]">Catalogo de productos</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-800 sm:text-4xl">Productos</h1>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Catalogo operativo con foco en imagen, precio, stock y estructura de variantes para mantener coherencia con TPV, dashboard y web publica.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={cargar} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              Recargar
            </button>

            <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1">
              <button type="button" onClick={() => setViewMode('grid')} className={`inline-flex h-9 items-center gap-2 rounded-[14px] px-4 text-sm font-semibold transition ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-700'}`}>
                <LayoutGrid size={14} />
                Grid
              </button>
              <button type="button" onClick={() => setViewMode('list')} className={`inline-flex h-9 items-center gap-2 rounded-[14px] px-4 text-sm font-semibold transition ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-700'}`}>
                <List size={14} />
                Lista
              </button>
            </div>

            <button type="button" onClick={abrirNuevo} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5D87FF] px-5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(93,135,255,0.26)] transition hover:-translate-y-0.5 hover:bg-[#4a74ef]">
              <Plus size={15} />
              Nuevo producto
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total" value={stats.total} icon={Package} tone="#5D87FF" />
        <StatCard label="Activos" value={stats.activos} icon={Sparkles} tone="#13DEB9" />
        <StatCard label="Destacados" value={stats.destacados} icon={Star} tone="#FFAE1F" />
        <StatCard label="Stock bajo" value={stats.stockBajo} icon={AlertTriangle} tone="#FA896B" />
        <StatCard label="Inventario" value={fmtMoney(stats.inventario)} icon={CircleDollarSign} tone="#49BEFF" helper="Costo x stock" />
      </section>

      <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar productos..." className={`${CONTROL} w-full pl-11`} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select value={filtroCategoria} onChange={(event) => setFiltroCategoria(event.target.value)} className={`${CONTROL} min-w-[180px]`}>
              <option value="todas">Todas las categorias</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={String(categoria.id)}>
                  {categoria.nombre}
                </option>
              ))}
            </select>
            <select value={filtroEstado} onChange={(event) => setFiltroEstado(event.target.value)} className={`${CONTROL} min-w-[140px]`}>
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className={`${CONTROL} min-w-[150px]`}>
              <option value="nombre">Nombre</option>
              <option value="precio">Precio</option>
              <option value="stock">Stock</option>
              <option value="categoria">Categoria</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">{filtered.length} visibles</span>
          <span className="rounded-full bg-[#ECF2FF] px-3 py-1.5 font-semibold text-[#5D87FF]">{viewMode === 'grid' ? 'Vista tarjetas' : 'Vista tabla'}</span>
          <span className="rounded-full bg-[#E8F7FF] px-3 py-1.5 font-semibold text-[#49BEFF]">Variantes y extras integrados</span>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className={`grid gap-4 ${viewMode === 'grid' ? 'md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
              {Array.from({ length: viewMode === 'grid' ? 6 : 3 }).map((_, index) => (
                <div key={index} className="h-52 animate-pulse rounded-[24px] bg-slate-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-gray-200 bg-slate-50 px-6 py-16 text-center">
              <h3 className="text-lg font-black tracking-tight text-gray-900">No hay resultados</h3>
              <p className="mt-2 text-sm text-gray-500">Proba otro filtro o crea un producto nuevo.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((producto) => (
                <ProductCard
                  key={producto.id}
                  producto={producto}
                  categoriaInfo={producto.categoriaInfo}
                  onView={setDetalle}
                  onEdit={abrirEditar}
                  onToggle={toggleActivo}
                  onDelete={eliminar}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-gray-100 shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead className="bg-slate-50">
                    <tr className="text-left">
                      <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Producto</th>
                      <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Categoria</th>
                      <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Precio</th>
                      <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Stock</th>
                      <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Estado</th>
                      <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Var/Ext</th>
                      <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((producto) => (
                      <ProductRow
                        key={producto.id}
                        producto={producto}
                        categoriaInfo={producto.categoriaInfo}
                        onView={setDetalle}
                        onEdit={abrirEditar}
                        onToggle={toggleActivo}
                        onDelete={eliminar}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
      

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 p-4 backdrop-blur-sm" onClick={cerrarModal}>
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.26)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">{modal === 'nuevo' ? 'Nuevo producto' : 'Editar producto'}</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-gray-950">{modal === 'nuevo' ? 'Crear producto' : 'Ajustar producto'}</h2>
              </div>
              <button type="button" onClick={cerrarModal} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 text-gray-500 transition hover:bg-gray-50">
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid gap-0 lg:grid-cols-[1fr_0.95fr]">
                <div className="space-y-4 p-5">
                  <section className="rounded-[24px] border border-gray-200 bg-gray-50/70 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Informacion base</p>
                        <input value={form.nombre} onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))} placeholder="Nombre del producto" className={`${CONTROL} w-full`} />
                      </div>

                      <textarea
                        value={form.descripcion}
                        onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                        rows={3}
                        placeholder="Descripcion breve para el admin, TPV y web"
                        className="min-h-[112px] rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 outline-none transition focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100 sm:col-span-2"
                      />

                      <select value={String(form.categoria_id || '')} onChange={(event) => changeCategory(event.target.value)} className={`${CONTROL} w-full`}>
                        <option value="">Selecciona una categoria</option>
                        {categorias.map((categoria) => (
                          <option key={categoria.id} value={categoria.id}>
                            {categoria.nombre}
                          </option>
                        ))}
                      </select>

                      <input type="number" value={form.tiempo_preparacion} onChange={(event) => setForm((prev) => ({ ...prev, tiempo_preparacion: Number(event.target.value || 0) }))} placeholder="Tiempo de preparacion" className={`${CONTROL} w-full`} />
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-gray-200 bg-gray-50/70 p-4">
                    <div className={`grid gap-3 ${structuredPricingConfig ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
                      {structuredPricingConfig ? (
                        formPriceOptions.map((option) => (
                          <input
                            key={`price-${option.nombre}`}
                            type="number"
                            value={option.finalPrice}
                            onChange={(event) => {
                              const next = updateStructuredPricing(selectedCategoryInfo?.nombre, variantesEditor, form.precio, option.nombre, event.target.value);
                              setForm((prev) => ({ ...prev, precio: next.basePrice }));
                              setVariantesEditor(next.groups);
                            }}
                            placeholder={option.label}
                            className={`${CONTROL} w-full`}
                          />
                        ))
                      ) : (
                        <input type="number" value={form.precio} onChange={(event) => setForm((prev) => ({ ...prev, precio: event.target.value }))} placeholder="Precio de venta" className={`${CONTROL} w-full`} />
                      )}
                      <input type="number" value={form.costo} onChange={(event) => setForm((prev) => ({ ...prev, costo: event.target.value }))} placeholder="Costo" className={`${CONTROL} w-full`} />
                      <input
                        type="number"
                        value={form.stock || 0}
                        onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))}
                        placeholder="Stock"
                        disabled={recipeManagedStock}
                        className={`${CONTROL} w-full disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400`}
                      />
                    </div>
                    {structuredPricingConfig && <p className="mt-3 text-xs font-semibold text-gray-500">{structuredPricingConfig.helper}</p>}
                    {recipeManagedStock && <p className="mt-3 text-xs font-semibold text-gray-500">Este producto usa stock por receta. El ajuste de stock se hace desde Inventario.</p>}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" onClick={() => setForm((prev) => ({ ...prev, activo: prev.activo === 1 ? 0 : 1 }))} className={`inline-flex h-11 items-center rounded-2xl px-4 text-sm font-bold transition ${form.activo === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                        {form.activo === 1 ? 'Activo' : 'Inactivo'}
                      </button>
                      <button type="button" onClick={() => setForm((prev) => ({ ...prev, destacado: prev.destacado === 1 ? 0 : 1 }))} className={`inline-flex h-11 items-center rounded-2xl px-4 text-sm font-bold transition ${form.destacado === 1 ? 'bg-amber-50 text-amber-700' : 'bg-gray-200 text-gray-600'}`}>
                        {form.destacado === 1 ? 'Destacado' : 'Normal'}
                      </button>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-gray-200 bg-gray-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Variantes</p>
                        <p className="mt-1 text-sm text-gray-500">
                          {structuredPricingConfig
                            ? 'Las presentaciones y sus precios finales se manejan arriba. Aca solo ajusta variantes avanzadas si realmente las necesitas.'
                            : 'Se usan en TPV y en la web publica con grupos y opciones.'}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-gray-400">{getTemplateHint(selectedCategoryInfo?.nombre)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={applySuggestedTemplate} className="inline-flex h-10 items-center rounded-2xl border border-gray-200 bg-white px-4 text-xs font-bold text-gray-600 transition hover:bg-gray-50">
                          Usar plantilla
                        </button>
                        <button type="button" onClick={addVariantGroup} className="inline-flex h-10 items-center rounded-2xl bg-gray-950 px-4 text-xs font-bold text-white transition hover:bg-gray-800">
                          <Plus size={14} className="mr-1.5" />
                          Agregar grupo
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {variantesEditor.length === 0 ? (
                        <div className="rounded-[20px] border border-dashed border-gray-200 bg-white px-4 py-5 text-sm text-gray-400">
                          Este producto no tiene variantes cargadas todavia.
                        </div>
                      ) : (
                        variantesEditor.map((group, groupIndex) => (
                          <div key={`group-${groupIndex}`} className="rounded-[22px] border border-white bg-white p-3 shadow-sm">
                            <div className="flex items-center gap-2">
                              <input value={group.nombre} onChange={(event) => updateVariantGroup(groupIndex, event.target.value)} placeholder={`Grupo ${groupIndex + 1} - ej: Tamano`} className={`${CONTROL} h-10 flex-1 border-0 bg-gray-50 px-3 focus:bg-white`} />
                              <button type="button" onClick={() => removeVariantGroup(groupIndex)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200 text-rose-600 transition hover:bg-rose-50">
                                <Trash2 size={14} />
                              </button>
                            </div>

                            <div className="mt-3 space-y-2">
                              {(group.opciones || []).map((option, optionIndex) => (
                                <div key={`option-${groupIndex}-${optionIndex}`} className="grid gap-2 sm:grid-cols-[1fr_140px_40px]">
                                  <input value={option.nombre} onChange={(event) => updateVariantOption(groupIndex, optionIndex, 'nombre', event.target.value)} placeholder="Nombre de opcion" className={`${CONTROL} h-10 border-0 bg-gray-50 px-3 focus:bg-white`} />
                                  <input type="number" value={option.precio_extra} onChange={(event) => updateVariantOption(groupIndex, optionIndex, 'precio_extra', event.target.value)} placeholder="0" className={`${CONTROL} h-10 border-0 bg-gray-50 px-3 focus:bg-white`} />
                                  <button type="button" onClick={() => removeVariantOption(groupIndex, optionIndex)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200 text-rose-600 transition hover:bg-rose-50">
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>

                            <button type="button" onClick={() => addVariantOption(groupIndex)} className="mt-3 inline-flex h-9 items-center rounded-2xl border border-gray-200 px-3 text-xs font-bold text-gray-600 transition hover:bg-gray-50">
                              <Plus size={13} className="mr-1.5" />
                              Agregar opcion
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-gray-200 bg-gray-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Extras</p>
                        <p className="mt-1 text-sm text-gray-500">Opcionales como borde relleno, salsas o agregados.</p>
                      </div>
                      <button type="button" onClick={addExtra} className="inline-flex h-10 items-center rounded-2xl bg-gray-950 px-4 text-xs font-bold text-white transition hover:bg-gray-800">
                        <Plus size={14} className="mr-1.5" />
                        Agregar extra
                      </button>
                    </div>

                    <div className="mt-4 space-y-2.5">
                      {extrasEditor.length === 0 ? (
                        <div className="rounded-[20px] border border-dashed border-gray-200 bg-white px-4 py-5 text-sm text-gray-400">
                          No hay extras cargados para este producto.
                        </div>
                      ) : (
                        extrasEditor.map((extra, index) => (
                          <div key={`extra-${index}`} className="grid gap-2 rounded-[20px] border border-white bg-white p-2 shadow-sm sm:grid-cols-[1fr_140px_40px]">
                            <input value={extra.nombre} onChange={(event) => updateExtra(index, 'nombre', event.target.value)} placeholder={`Extra ${index + 1}`} className={`${CONTROL} h-10 border-0 bg-gray-50 px-3 focus:bg-white`} />
                            <input type="number" value={extra.precio} onChange={(event) => updateExtra(index, 'precio', event.target.value)} placeholder="0" className={`${CONTROL} h-10 border-0 bg-gray-50 px-3 focus:bg-white`} />
                            <button type="button" onClick={() => removeExtra(index)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200 text-rose-600 transition hover:bg-rose-50">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>

                <div className="border-t border-gray-100 bg-gray-50/80 p-5 lg:border-l lg:border-t-0">
                  <section className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Imagen</p>
                        <p className="mt-1 text-sm text-gray-500">Carga una foto real para tarjetas, TPV y web publica.</p>
                      </div>
                      {imagePreview && (
                        <button type="button" onClick={clearImage} className="inline-flex h-9 items-center justify-center rounded-2xl border border-rose-200 px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50">
                          Quitar
                        </button>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[132px_1fr]">
                      <div className="flex h-32 items-center justify-center overflow-hidden rounded-[22px] border border-white bg-gray-50 shadow-sm">
                        {imagePreview ? (
                          <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
                        ) : (
                          <div className="text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: rgba(selectedCategoryInfo?.color, 0.14), color: selectedCategoryInfo?.color || '#f97316' }}>
                              <ImagePlus size={20} />
                            </div>
                            <p className="mt-2 text-xs font-semibold text-gray-500">Sin imagen</p>
                          </div>
                        )}
                      </div>

                      <label className="flex min-h-[128px] cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed border-gray-300 bg-gray-50 px-5 text-center transition hover:border-indigo-200 hover:bg-indigo-50/70">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECF2FF] text-[#5D87FF]">
                          <ImagePlus size={20} />
                        </div>
                        <span className="mt-3 text-sm font-bold text-gray-800">{imagePreview ? 'Reemplazar imagen' : 'Subir imagen real'}</span>
                        <span className="mt-1 max-w-[240px] text-xs leading-5 text-gray-500">JPG, PNG o WebP. Ideal para que el catalogo se vea mas rico y profesional.</span>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleImageChange(event.target.files?.[0])} />
                      </label>
                    </div>
                  </section>

                  <section className="mt-4 rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Preview</p>
                        <p className="mt-1 text-sm text-gray-500">Asi se va a ver dentro del panel.</p>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-500">
                        <TimerReset size={13} />
                        {form.tiempo_preparacion || 0} min
                      </div>
                    </div>

                    <div className="mt-3 rounded-[24px] border border-white bg-white shadow-sm">
                      <div className="h-28 rounded-t-[24px] px-4 py-4" style={{ background: `linear-gradient(135deg, ${rgba(selectedCategoryInfo?.color, 0.28)}, ${rgba(selectedCategoryInfo?.color, 0.06)})` }}>
                        <div className="inline-flex rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500 backdrop-blur">
                          {codeFor(modal?.id, productos.length)}
                        </div>
                      </div>
                      <div className="-mt-8 px-4 pb-4">
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] border border-white text-3xl shadow-sm" style={{ backgroundColor: rgba(selectedCategoryInfo?.color, 0.14) }}>
                          {imagePreview ? <img src={imagePreview} alt="preview" className="h-full w-full object-cover" /> : selectedCategoryInfo?.icono || '🍽️'}
                        </div>
                        <h3 className="mt-3 text-lg font-black tracking-tight text-gray-950">{form.nombre || 'Nombre del producto'}</h3>
                        <p className="mt-1 text-sm text-gray-500">{form.descripcion || 'Sin descripcion cargada.'}</p>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Precio</p>
                            <PriceSummary
                              options={formPriceOptions}
                              basePrice={form.precio || 0}
                              singleClassName="mt-1 font-semibold text-[#5D87FF]"
                              multiClassName="mt-1 space-y-1 text-xs font-semibold text-[#5D87FF]"
                              itemClassName=""
                            />
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Stock</p>
                            <p className="mt-1 font-semibold text-gray-900">{recipeManagedStock ? 'Se calcula en inventario' : `${form.stock || 0} uds`}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: rgba(selectedCategoryInfo?.color, 0.12), color: selectedCategoryInfo?.color || '#f97316' }}>
                            {selectedCategoryInfo?.icono || '🍽️'} {selectedCategoryInfo?.nombre || 'Sin categoria'}
                          </span>
                          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${form.activo === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                            {form.activo === 1 ? 'Activo' : 'Inactivo'}
                          </span>
                          {form.destacado === 1 && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">Destacado</span>}
                        </div>

                        {normalizeExtras(extrasEditor).length > 0 && (
                          <div className="mt-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Extras visibles</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {normalizeExtras(extrasEditor).map((extra, index) => (
                                <span key={`preview-extra-${index}`} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                                  {extra.nombre} +{fmtMoney(extra.precio)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 rounded-[20px] border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                      Consejo: si este producto va a la web publica, intenta que la foto sea final y que las variantes queden bien nombradas para el selector del cliente.
                    </div>
                  </section>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-100 bg-white px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={cerrarModal} className="h-11 rounded-2xl border border-gray-200 px-5 text-sm font-bold text-gray-600 transition hover:bg-gray-50">
                Cancelar
              </button>
              <button type="button" onClick={guardar} disabled={saving} className="h-11 rounded-2xl bg-[#5D87FF] px-5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(93,135,255,0.26)] transition hover:-translate-y-0.5 hover:bg-[#4a74ef] disabled:opacity-60">
                {saving ? 'Guardando...' : modal === 'nuevo' ? 'Crear producto' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 p-4 backdrop-blur-sm" onClick={() => setDetalle(null)}>
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.26)]" onClick={(event) => event.stopPropagation()}>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="h-56" style={{ background: `linear-gradient(135deg, ${rgba(detalle.categoriaInfo?.color, 0.28)}, ${rgba(detalle.categoriaInfo?.color, 0.06)})` }} />
              <div className="-mt-10 px-5 pb-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24px] border border-white text-4xl shadow-sm" style={{ backgroundColor: rgba(detalle.categoriaInfo?.color, 0.14) }}>
                    {detalle.imagen ? <img src={detalle.imagen} alt={detalle.nombre} className="h-full w-full object-cover" /> : detalle.categoriaInfo?.icono || '🍽️'}
                  </div>
                  <button type="button" onClick={() => setDetalle(null)} className="mt-2 flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50">
                    <X size={16} />
                  </button>
                </div>

                <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">{detalle.codigo}</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-gray-950">{detalle.nombre}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">{detalle.descripcion || 'Sin descripcion cargada.'}</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Precio</p>
                    <PriceSummary
                      options={getPricingOptionTotals(detalle.categoriaInfo?.nombre, detalle.precio, detalle.variantGroups)}
                      basePrice={detalle.precio}
                      singleClassName="mt-1 font-semibold text-[#5D87FF]"
                      multiClassName="mt-1 space-y-1 text-xs font-semibold text-[#5D87FF]"
                      itemClassName=""
                    />
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Costo</p>
                    <p className="mt-1 font-semibold text-gray-900">{fmtMoney(detalle.costo)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Stock</p>
                    <p className="mt-1 font-semibold text-gray-900">{detalle.stock || 0} uds</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Tiempo</p>
                    <p className="mt-1 font-semibold text-gray-900">{detalle.tiempo_preparacion || 0} min</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: rgba(detalle.categoriaInfo?.color, 0.12), color: detalle.categoriaInfo?.color || '#f97316' }}>
                    {detalle.categoriaInfo?.icono || '🍽️'} {detalle.categoriaInfo?.nombre || 'Sin categoria'}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                    {detalle.stock_mode === 'recipe' ? 'Stock por receta' : 'Stock directo'}
                  </span>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${Number(detalle.activo) === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                    {Number(detalle.activo) === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                  {Number(detalle.destacado) === 1 && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">Destacado</span>}
                </div>

                {detalle.variantGroups.length > 0 && (
                  <div className="mt-5 rounded-[24px] border border-gray-200 bg-gray-50/80 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Variantes</p>
                    <div className="mt-3 space-y-3">
                      {detalle.variantGroups.map((group, index) => (
                        <div key={`detail-group-${index}`} className="rounded-2xl bg-white p-3 shadow-sm">
                          <p className="font-bold text-gray-900">{group.nombre}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(group.opciones || []).map((option, optionIndex) => (
                              <span key={`detail-option-${index}-${optionIndex}`} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                                {option.nombre} {getStructuredPricingConfig(detalle.categoriaInfo?.nombre) ? `- ${fmtMoney(detalle.precio + Number(option.precio_extra || 0))}` : Number(option.precio_extra) > 0 ? `+${fmtMoney(option.precio_extra)}` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detalle.extrasList.length > 0 && (
                  <div className="mt-5 rounded-[24px] border border-gray-200 bg-gray-50/80 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Extras</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detalle.extrasList.map((extra, index) => (
                        <span key={`detail-extra-${index}`} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm">
                          {extra.nombre} +{fmtMoney(extra.precio)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-100 bg-white px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDetalle(null)} className="h-11 rounded-2xl border border-gray-200 px-5 text-sm font-bold text-gray-600 transition hover:bg-gray-50">
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const current = detalle;
                  setDetalle(null);
                  abrirEditar(current);
                }}
                className="h-11 rounded-2xl bg-gray-950 px-5 text-sm font-bold text-white transition hover:bg-gray-800"
              >
                Editar producto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

