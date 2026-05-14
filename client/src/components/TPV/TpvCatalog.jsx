import { Plus, Search, ShoppingCart } from 'lucide-react';
import { getPrimaryDisplayPrice } from '../../lib/pedidoForm.js';

const fmt = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;

function stockLabel(producto) {
  const available = Number(producto.stock_disponible ?? producto.stock ?? producto.stock_directo ?? 0);
  if (producto.disponible_para_venta === false) return { text: 'Sin stock', tone: 'border-rose-200 bg-rose-50 text-rose-700' };
  if (available > 0 && available <= 2) return { text: 'Bajo', tone: 'border-amber-200 bg-amber-50 text-amber-700' };
  return null;
}

export default function TpvCatalog({
  busqueda,
  cartQtyByProductId,
  catActiva,
  categorias,
  onAddItem,
  onBusquedaChange,
  onCatActivaChange,
  onOpenCart,
  productosFiltrados,
  searchInputRef,
  total,
  totalItems,
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-100 bg-white px-6 py-4">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            value={busqueda}
            onChange={(event) => onBusquedaChange(event.target.value)}
            placeholder="Buscar producto... (/)"
            className="h-12 w-full rounded-2xl border-none bg-gray-100 py-2 pl-12 pr-4 text-sm font-medium transition-all focus:bg-white focus:ring-2 focus:ring-[#5D87FF]/20"
          />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => onCatActivaChange(null)}
            className={`flex-shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${!catActiva ? 'bg-[#5D87FF] text-white shadow-lg shadow-blue-100' : 'border border-gray-100 bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Todos
          </button>
          {categorias.map((categoria) => (
            <button
              key={categoria.id}
              type="button"
              onClick={() => onCatActivaChange(categoria.id)}
              className={`flex-shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${catActiva === categoria.id ? 'bg-[#5D87FF] text-white shadow-lg shadow-blue-100' : 'border border-gray-100 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <span className="mr-2">{categoria.icono}</span>
              {categoria.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {productosFiltrados.map((producto) => {
            const badge = stockLabel(producto);
            const primaryPrice = getPrimaryDisplayPrice(producto);
            const qtyInCart = Number(cartQtyByProductId[producto.id] || 0);

            return (
              <button
                key={producto.id}
                type="button"
                onClick={() => onAddItem(producto)}
                disabled={producto.disponible_para_venta === false}
                className={`group relative flex flex-col rounded-[24px] border border-transparent bg-white p-4 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] active:scale-[0.98] ${producto.disponible_para_venta === false ? 'cursor-not-allowed opacity-60 grayscale' : 'shadow-sm'} ${qtyInCart > 0 ? 'border-[#5D87FF]/20 ring-2 ring-[#5D87FF]/50' : ''}`}
              >
                <div className="relative mb-4 flex aspect-square items-center justify-center overflow-hidden rounded-[20px] bg-[#F2F6FA] transition-all group-hover:scale-105">
                  {producto.imagen ? (
                    <img src={producto.imagen} alt={producto.nombre} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl opacity-40 grayscale">{producto.categoria_icono || '[prod]'}</span>
                  )}

                  {qtyInCart > 0 ? (
                    <div className="absolute left-2 top-2 flex h-7 min-w-[28px] items-center justify-center rounded-lg bg-[#5D87FF] px-1.5 text-xs font-black text-white shadow-lg animate-in zoom-in duration-300">
                      {qtyInCart}
                    </div>
                  ) : null}

                  {badge ? (
                    <div className={`absolute right-2 top-2 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-wider shadow-sm ${badge.tone}`}>
                      {badge.text}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col">
                  <p className="mb-1 line-clamp-2 text-sm font-bold leading-tight text-gray-800 group-hover:text-[#5D87FF]">
                    {producto.nombre}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {producto.categoria_nombre || 'General'}
                  </p>

                  <div className="mt-auto flex items-center justify-between border-t border-gray-50 pt-3">
                    <div>
                      {primaryPrice.label ? (
                        <p className="text-[10px] font-bold uppercase tracking-tighter text-gray-400">{primaryPrice.label}</p>
                      ) : null}
                      <p className="text-base font-black text-[#5D87FF]">
                        {fmt(primaryPrice.price)}
                      </p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#5D87FF] transition-colors group-hover:bg-[#5D87FF] group-hover:text-white">
                      <Plus size={16} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {productosFiltrados.length === 0 ? (
          <div className="mt-10 rounded-[32px] border-2 border-dashed border-gray-200 bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <Search className="text-gray-300" size={32} />
            </div>
            <p className="text-base font-bold text-gray-500">No encontramos productos con ese filtro.</p>
            <button
              type="button"
              onClick={() => {
                onBusquedaChange('');
                onCatActivaChange(null);
              }}
              className="mt-4 text-sm font-bold text-[#5D87FF] hover:underline"
            >
              Limpiar filtros
            </button>
          </div>
        ) : null}
      </div>

      {totalItems > 0 ? (
        <button
          type="button"
          onClick={onOpenCart}
          className="fixed bottom-6 right-6 z-40 flex h-16 items-center gap-3 rounded-full bg-[#5D87FF] px-6 text-white shadow-2xl shadow-blue-300 transition hover:scale-105 active:scale-95 lg:hidden"
        >
          <div className="relative">
            <ShoppingCart size={24} />
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#5D87FF]">
              {totalItems}
            </span>
          </div>
          <span className="text-sm font-black">{fmt(total)}</span>
        </button>
      ) : null}
    </section>
  );
}
