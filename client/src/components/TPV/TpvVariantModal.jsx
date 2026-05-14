import { X } from 'lucide-react';

const fmt = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;

export default function TpvVariantModal({
  onAddToCart,
  onClose,
  onToggleExtra,
  onSelectVariant,
  selectedVariantTotal,
  variantesCompletas,
  variantModal,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900">{variantModal.producto.nombre}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 transition hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {variantModal.variantes.map((group) => (
          <div key={group.nombre} className="mb-5">
            <p className="mb-2 text-sm font-black text-gray-800">{group.nombre}</p>
            <div className="grid grid-cols-2 gap-2">
              {(group.opciones || []).map((option) => {
                const optionName = option.nombre || option;
                const selected = variantModal.sel[group.nombre]?.nombre === optionName;
                return (
                  <button
                    key={optionName}
                    type="button"
                    onClick={() => onSelectVariant(group.nombre, option)}
                    className={`rounded-2xl border-2 p-3 text-left text-sm transition-colors ${selected ? 'border-primary-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <span className="font-bold">{optionName}</span>
                    <span className="mt-1 block text-xs font-semibold text-primary-600">
                      {fmt(Number(variantModal.producto.precio || 0) + Number(option.precio_extra || 0))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {variantModal.extras.length > 0 ? (
          <div className="mb-5">
            <p className="mb-2 text-sm font-black text-gray-800">Extras</p>
            <div className="space-y-2">
              {variantModal.extras.map((extra) => {
                const selected = variantModal.extrasSel.some((item) => item.nombre === extra.nombre);
                return (
                  <button
                    key={extra.nombre}
                    type="button"
                    onClick={() => onToggleExtra(extra)}
                    className={`flex w-full items-center justify-between rounded-2xl border-2 p-3 transition-colors ${selected ? 'border-primary-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <span className="text-sm font-bold">{extra.nombre}</span>
                    <span className="text-sm font-bold text-primary-600">+{fmt(extra.precio)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {!variantesCompletas ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
            Completa todas las variantes obligatorias.
          </div>
        ) : null}

        <div className="mb-4 flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Total seleccionado</span>
          <span className="text-base font-black text-primary-600">{fmt(selectedVariantTotal || variantModal.producto.precio)}</span>
        </div>

        <button
          type="button"
          onClick={onAddToCart}
          disabled={!variantesCompletas}
          className="w-full rounded-2xl bg-primary-500 py-3.5 font-black text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Agregar al pedido
        </button>
      </div>
    </div>
  );
}
