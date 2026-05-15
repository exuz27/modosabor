import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, ImagePlus, Megaphone, MonitorSmartphone, Plus, Trash2 } from 'lucide-react';
import api from '../../lib/api.js';
import { SectionCard, InputField, SelectField, TextareaField, ToggleSwitch } from './ConfigComponents.jsx';

const ACTION_OPTIONS = [
  { value: 'none', label: 'Sin accion' },
  { value: 'categoria', label: 'Ir a categoria' },
  { value: 'producto', label: 'Abrir producto' },
  { value: 'whatsapp', label: 'Abrir WhatsApp' },
  { value: 'url', label: 'Abrir link' },
  { value: 'cart', label: 'Abrir carrito' },
];

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toDateTimeLocal(value) {
  if (!value) return '';
  return String(value).slice(0, 16);
}

function normalizePromo(promo = {}) {
  return {
    id: promo.id || `promo_${Date.now()}`,
    titulo: promo.titulo || '',
    descripcion: promo.descripcion || '',
    imagen: promo.imagen || '',
    etiqueta: promo.etiqueta || 'PROMO',
    precio_texto: promo.precio_texto || '',
    desde: toDateTimeLocal(promo.desde),
    hasta: toDateTimeLocal(promo.hasta),
    activa: promo.activa !== false,
    mostrar_banner: promo.mostrar_banner !== false,
    mostrar_popup: promo.mostrar_popup === true,
    accion_tipo: promo.accion_tipo || 'categoria',
    accion_valor: promo.accion_valor || '',
    boton_texto: promo.boton_texto || 'Pedir ahora',
  };
}

function isActive(value) {
  return String(value || '0') === '1' || value === true;
}

function FileButton({ label, onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('asset', file);
    setUploading(true);
    try {
      const response = await api.post('/configuracion/web-publica/upload', formData);
      onUploaded(response.url);
      toast.success('Imagen cargada');
    } catch (error) {
      toast.error(error?.error || 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={uploadFile} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-bold text-white transition hover:bg-black disabled:opacity-50"
      >
        <ImagePlus size={16} />
        {uploading ? 'Subiendo...' : label}
      </button>
    </>
  );
}

function ActionFields({ prefix = '', value, onChange, categorias, productos }) {
  const tipoKey = prefix ? `${prefix}_accion_tipo` : 'accion_tipo';
  const valorKey = prefix ? `${prefix}_accion_valor` : 'accion_valor';
  const tipo = value[tipoKey] || 'none';
  const isReference = tipo === 'categoria' || tipo === 'producto';

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <SelectField
        label="Accion del boton"
        value={tipo}
        onChange={(event) => onChange(tipoKey, event.target.value)}
        options={ACTION_OPTIONS}
      />
      {isReference ? (
        <SelectField
          label={tipo === 'categoria' ? 'Categoria destino' : 'Producto destino'}
          value={value[valorKey] || ''}
          onChange={(event) => onChange(valorKey, event.target.value)}
          options={[
            { value: '', label: tipo === 'categoria' ? 'Primera categoria disponible' : 'Elegir producto' },
            ...(tipo === 'categoria' ? categorias : productos).map((item) => ({
              value: String(item.id),
              label: item.nombre,
            })),
          ]}
        />
      ) : (
        <InputField
          label={tipo === 'url' ? 'Link destino' : tipo === 'whatsapp' ? 'Mensaje o telefono' : 'Valor'}
          value={value[valorKey] || ''}
          onChange={(event) => onChange(valorKey, event.target.value)}
          disabled={!['url', 'whatsapp'].includes(tipo)}
          placeholder={tipo === 'url' ? 'https://...' : tipo === 'whatsapp' ? 'Promo del dia' : 'No requerido'}
        />
      )}
    </div>
  );
}

export default function SeccionWebPublica({ config, setConfig }) {
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/categorias').catch(() => []),
      api.get('/productos').catch(() => []),
    ]).then(([cats, prods]) => {
      setCategorias(Array.isArray(cats) ? cats.filter((item) => item.activo) : []);
      setProductos(Array.isArray(prods) ? prods.filter((item) => item.activo) : []);
    });
  }, []);

  const promos = useMemo(
    () => parseJsonArray(config.web_promos_json).map(normalizePromo),
    [config.web_promos_json]
  );

  const setField = (key, value) => setConfig((prev) => ({ ...prev, [key]: value }));
  const setPromos = (nextPromos) => setField('web_promos_json', JSON.stringify(nextPromos.map(normalizePromo)));
  const updatePromo = (index, key, value) => {
    setPromos(promos.map((promo, current) => current === index ? { ...promo, [key]: value } : promo));
  };
  const addPromo = () => {
    setPromos([
      ...promos,
      normalizePromo({
        id: `promo_${Date.now()}`,
        titulo: 'Promo especial',
        descripcion: 'Cargá una descripcion corta y tentadora.',
      }),
    ]);
  };
  const removePromo = (index) => setPromos(promos.filter((_, current) => current !== index));

  const previewImage = config.web_hero_imagen || config.negocio_logo || '';
  const activePromos = promos.filter((promo) => promo.activa);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-8">
      <div className="sticky top-[84px] z-10 mb-8 flex items-center justify-between rounded-[28px] border border-gray-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-100 flex items-center justify-center">
            <MonitorSmartphone className="text-rose-600" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Web publica</h2>
            <p className="text-sm text-gray-500">Vidriera, promos, popup y destacados del menu online.</p>
          </div>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-100 md:inline-flex"
        >
          <Eye size={16} />
          Ver como cliente
        </a>
      </div>

      <SectionCard icon={Megaphone} tone="rose" title="Hero principal" subtitle="La primera pantalla que ve el cliente al entrar">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <InputField label="Titulo" value={config.web_hero_titulo || ''} onChange={(event) => setField('web_hero_titulo', event.target.value)} />
          <InputField label="Texto del boton" value={config.web_hero_boton_texto || ''} onChange={(event) => setField('web_hero_boton_texto', event.target.value)} />
          <div className="md:col-span-2">
            <TextareaField rows={3} label="Subtitulo" value={config.web_hero_subtitulo || ''} onChange={(event) => setField('web_hero_subtitulo', event.target.value)} />
          </div>
          <div className="space-y-3">
            <InputField label="Imagen del hero" value={config.web_hero_imagen || ''} onChange={(event) => setField('web_hero_imagen', event.target.value)} placeholder="/uploads/promo.jpg" />
            <FileButton label="Subir imagen hero" onUploaded={(url) => setField('web_hero_imagen', url)} />
          </div>
          <ActionFields
            prefix="web_hero"
            value={config}
            onChange={setField}
            categorias={categorias}
            productos={productos}
          />
        </div>
      </SectionCard>

      <SectionCard icon={Megaphone} tone="amber" title="Popup al entrar" subtitle="Anuncio grande para promo del dia o semana">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ToggleSwitch
            label="Mostrar popup"
            description="Se muestra al entrar, respetando la frecuencia configurada."
            checked={isActive(config.web_popup_activo)}
            onChange={(checked) => setField('web_popup_activo', checked ? '1' : '0')}
            color="amber"
          />
          <InputField label="Frecuencia en horas" type="number" value={config.web_popup_frecuencia_horas || '12'} onChange={(event) => setField('web_popup_frecuencia_horas', event.target.value)} />
          <InputField label="Titulo" value={config.web_popup_titulo || ''} onChange={(event) => setField('web_popup_titulo', event.target.value)} />
          <InputField label="Texto del boton" value={config.web_popup_boton_texto || ''} onChange={(event) => setField('web_popup_boton_texto', event.target.value)} />
          <div className="md:col-span-2">
            <TextareaField rows={3} label="Descripcion" value={config.web_popup_descripcion || ''} onChange={(event) => setField('web_popup_descripcion', event.target.value)} />
          </div>
          <InputField label="Desde" type="datetime-local" value={toDateTimeLocal(config.web_popup_desde)} onChange={(event) => setField('web_popup_desde', event.target.value)} />
          <InputField label="Hasta" type="datetime-local" value={toDateTimeLocal(config.web_popup_hasta)} onChange={(event) => setField('web_popup_hasta', event.target.value)} />
          <div className="space-y-3">
            <InputField label="Imagen popup" value={config.web_popup_imagen || ''} onChange={(event) => setField('web_popup_imagen', event.target.value)} />
            <FileButton label="Subir imagen popup" onUploaded={(url) => setField('web_popup_imagen', url)} />
          </div>
          <ActionFields
            prefix="web_popup"
            value={config}
            onChange={setField}
            categorias={categorias}
            productos={productos}
          />
        </div>
      </SectionCard>

      <SectionCard icon={Plus} tone="rose" title="Promos de la vidriera" subtitle="Banners con fecha, imagen y accion propia">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ToggleSwitch
            label="Mostrar productos destacados"
            description="Usa los productos marcados como destacados en la carta."
            checked={isActive(config.web_mostrar_destacados)}
            onChange={(checked) => setField('web_mostrar_destacados', checked ? '1' : '0')}
            color="rose"
          />
          <button
            type="button"
            onClick={addPromo}
            className="inline-flex h-full min-h-[76px] items-center justify-center gap-2 rounded-2xl border border-dashed border-rose-300 bg-rose-50 px-4 text-sm font-black uppercase tracking-widest text-rose-700 transition hover:bg-rose-100"
          >
            <Plus size={18} />
            Nueva promo
          </button>
        </div>

        <div className="space-y-5">
          {promos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-400">
              Todavia no cargaste promos para la web publica.
            </div>
          ) : promos.map((promo, index) => (
            <div key={promo.id || index} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-gray-900">{promo.titulo || `Promo ${index + 1}`}</p>
                  <p className="text-xs text-gray-500">{promo.activa ? 'Activa' : 'Pausada'} · {promo.mostrar_banner ? 'Banner' : 'Oculta en banner'}</p>
                </div>
                <button type="button" onClick={() => removePromo(index)} className="h-10 rounded-xl border border-rose-200 bg-white px-3 text-sm font-bold text-rose-600">
                  <span className="inline-flex items-center gap-2"><Trash2 size={14} /> Quitar</span>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField label="Titulo" value={promo.titulo} onChange={(event) => updatePromo(index, 'titulo', event.target.value)} />
                <InputField label="Etiqueta" value={promo.etiqueta} onChange={(event) => updatePromo(index, 'etiqueta', event.target.value)} />
                <InputField label="Precio / oferta visible" value={promo.precio_texto} onChange={(event) => updatePromo(index, 'precio_texto', event.target.value)} placeholder="$10.000 / 2x1 / Solo hoy" />
                <InputField label="Boton" value={promo.boton_texto} onChange={(event) => updatePromo(index, 'boton_texto', event.target.value)} />
                <div className="md:col-span-2">
                  <TextareaField rows={3} label="Descripcion" value={promo.descripcion} onChange={(event) => updatePromo(index, 'descripcion', event.target.value)} />
                </div>
                <InputField label="Desde" type="datetime-local" value={promo.desde} onChange={(event) => updatePromo(index, 'desde', event.target.value)} />
                <InputField label="Hasta" type="datetime-local" value={promo.hasta} onChange={(event) => updatePromo(index, 'hasta', event.target.value)} />
                <div className="space-y-3">
                  <InputField label="Imagen" value={promo.imagen} onChange={(event) => updatePromo(index, 'imagen', event.target.value)} />
                  <FileButton label="Subir imagen promo" onUploaded={(url) => updatePromo(index, 'imagen', url)} />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <ToggleSwitch label="Activa" checked={promo.activa} onChange={(checked) => updatePromo(index, 'activa', checked)} color="emerald" />
                  <ToggleSwitch label="Mostrar en banner" checked={promo.mostrar_banner} onChange={(checked) => updatePromo(index, 'mostrar_banner', checked)} color="rose" />
                </div>
                <ActionFields
                  value={promo}
                  onChange={(key, value) => updatePromo(index, key, value)}
                  categorias={categorias}
                  productos={productos}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={Eye} tone="violet" title="Vista previa rapida" subtitle="Chequeo visual antes de guardar y publicar">
        <div className="overflow-hidden rounded-3xl bg-[#090909] text-white">
          <div className="grid min-h-[260px] grid-cols-1 md:grid-cols-[1.15fr,0.85fr]">
            <div className="flex flex-col justify-center p-8">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-red-400">Modo Sabor online</p>
              <h3 className="text-4xl font-black uppercase leading-none">{config.web_hero_titulo || config.negocio_nombre || 'Modo Sabor'}</h3>
              <p className="mt-4 max-w-md text-sm font-medium leading-6 text-white/70">{config.web_hero_subtitulo || config.negocio_descripcion}</p>
              <div className="mt-6 inline-flex w-fit rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest">
                {config.web_hero_boton_texto || 'Pedir ahora'}
              </div>
            </div>
            <div className="relative min-h-[220px] bg-white/5">
              {previewImage ? (
                <img src={previewImage} alt="Hero preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl font-black text-white/20">MS</div>
              )}
            </div>
          </div>
          {activePromos.length > 0 ? (
            <div className="grid gap-3 border-t border-white/10 p-4 md:grid-cols-3">
              {activePromos.slice(0, 3).map((promo) => (
                <div key={promo.id} className="rounded-2xl bg-white/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-300">{promo.etiqueta}</p>
                  <p className="mt-1 text-sm font-black">{promo.titulo}</p>
                  {promo.precio_texto ? <p className="mt-2 text-lg font-black text-white">{promo.precio_texto}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
