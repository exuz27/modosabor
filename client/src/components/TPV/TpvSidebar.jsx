import { Armchair, Bike, MapPin, Minus, Plus, Receipt, ShoppingCart, Store, Trash2, UserSearch, X } from 'lucide-react';

const fmt = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;

const PAYMENT_LABELS = {
  efectivo: 'Efvo',
  mercadopago: 'MP',
  transferencia: 'Transf',
  modo: 'Modo',
  uala: 'Uala',
};

const DELIVERY_MODES = [
  { value: 'retiro', label: 'Retira', icon: Store },
  { value: 'delivery', label: 'Delivery', icon: Bike },
  { value: 'mesa', label: 'Mesa', icon: Armchair },
];

function SectionLabel({ children }) {
  return <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">{children}</p>;
}

export default function TpvSidebar({
  cartItemsRef,
  cartMobileOpen,
  cliente,
  confirmDisabled,
  deliveryQuote,
  descuento,
  descuentoAplicado,
  descuentoTipo,
  efectivoRecibido,
  envio,
  items,
  lastAddedId,
  loading,
  mesa,
  metodoPago,
  onAbrirSelectorClientes,
  onCambiarCantidad,
  onCerrarCartMobile,
  onClearCliente,
  onClearOrder,
  onConfirm,
  onConfirmPrint,
  onDescuentoChange,
  onDescuentoTipoChange,
  onEfectivoRecibidoChange,
  onImprimirMesa,
  onMetodoPagoChange,
  onQuitarItem,
  onSeleccionarRider,
  onSetCliente,
  onSetMesa,
  onTipoEntregaChange,
  onUbicacionCliente,
  pagos,
  printingMesa,
  repartidoresDisponibles,
  selectedRiderId,
  sharingLocation,
  subtotal,
  tipoEntrega,
  total,
  totalItems,
  vuelto,
  config,
}) {
  return (
    <aside className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-gray-100 bg-white shadow-[0_0_40px_rgba(0,0,0,0.02)] transition-transform duration-300 lg:static lg:z-auto lg:w-[380px] lg:translate-x-0 xl:w-[440px] ${cartMobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4 lg:hidden">
        <h2 className="text-lg font-black uppercase tracking-tight text-gray-900">Tu Pedido</h2>
        <button type="button" onClick={onCerrarCartMobile} className="rounded-xl bg-gray-100 p-2 text-gray-500">
          <X size={20} />
        </button>
      </div>

      <div ref={cartItemsRef} className="no-scrollbar flex-1 overflow-y-auto scroll-smooth">
        <div className="p-4">
          <div className="flex gap-1 rounded-2xl bg-gray-100 p-1.5">
            {DELIVERY_MODES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onTipoEntregaChange(value)}
                className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all ${tipoEntrega === value ? 'bg-white text-[#5D87FF] shadow-md shadow-blue-100/50' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon size={14} className={tipoEntrega === value ? 'text-[#5D87FF]' : 'text-gray-400'} />
                  {label.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-4">
          <div className="mb-6 rounded-[24px] border border-blue-50 bg-[#F2F6FA] p-5">
            <div className="mb-4 flex items-center justify-between">
              <SectionLabel>{tipoEntrega === 'mesa' ? 'Asignar Mesa' : 'Datos del Cliente'}</SectionLabel>
              {tipoEntrega !== 'mesa' && (cliente.nombre || cliente.telefono) ? (
                <button
                  type="button"
                  onClick={onClearCliente}
                  className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-600"
                >
                  Limpiar
                </button>
              ) : null}
            </div>

            {tipoEntrega === 'mesa' ? (
              <div className="flex gap-2">
                <input
                  value={mesa}
                  onChange={(event) => onSetMesa(event.target.value)}
                  placeholder="N Mesa"
                  className="h-12 flex-1 rounded-xl border-none bg-white px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[#5D87FF]/20"
                />
                <button
                  type="button"
                  onClick={onImprimirMesa}
                  disabled={printingMesa || !String(mesa || '').trim()}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  <Receipt size={20} />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <input
                    value={cliente.telefono}
                    onChange={(event) => onSetCliente({ ...cliente, telefono: event.target.value })}
                    placeholder="Telefono"
                    className="h-12 w-full rounded-xl border-none bg-white px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[#5D87FF]/20"
                  />
                  <button
                    type="button"
                    onClick={onAbrirSelectorClientes}
                    className="absolute right-3 top-1/2 rounded-lg p-1.5 text-[#5D87FF] transition-colors hover:bg-blue-50"
                  >
                    <UserSearch size={18} />
                  </button>
                </div>
                <input
                  value={cliente.nombre}
                  onChange={(event) => onSetCliente({ ...cliente, nombre: event.target.value })}
                  placeholder="Nombre completo"
                  className="h-12 w-full rounded-xl border-none bg-white px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[#5D87FF]/20"
                />

                {tipoEntrega === 'delivery' ? (
                  <div className="space-y-4 border-t border-gray-200/50 pt-2">
                    <input
                      value={cliente.direccion}
                      onChange={(event) => onSetCliente({ ...cliente, direccion: event.target.value, latitud: null, longitud: null })}
                      placeholder="Direccion de entrega"
                      className="h-12 w-full rounded-xl border-none bg-white px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[#5D87FF]/20"
                    />

                    <div className="rounded-2xl border border-gray-50 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <SectionLabel>Asignar Rider</SectionLabel>
                        {config.delivery_autoasignar_activo === '1' && !selectedRiderId && repartidoresDisponibles.length === 1 ? (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-600">Auto</span>
                        ) : null}
                      </div>
                      <div className="mb-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onSeleccionarRider('')}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all ${!selectedRiderId ? 'bg-[#5D87FF] text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}
                        >
                          Sistema
                        </button>
                        {repartidoresDisponibles.map((repartidor) => (
                          <button
                            key={`chip-${repartidor.id}`}
                            type="button"
                            onClick={() => onSeleccionarRider(String(repartidor.id))}
                            className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all ${String(selectedRiderId) === String(repartidor.id) ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}
                          >
                            {repartidor.nombre}
                          </button>
                        ))}
                      </div>
                      <select
                        value={selectedRiderId}
                        onChange={(event) => onSeleccionarRider(event.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#5D87FF]/20"
                      >
                        <option value="">Sin fijar / autoasignar</option>
                        {repartidoresDisponibles.map((repartidor) => (
                          <option key={repartidor.id} value={repartidor.id}>{repartidor.nombre}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={onUbicacionCliente}
                      disabled={sharingLocation}
                      className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${cliente.latitud ? 'bg-emerald-500 text-white' : 'bg-blue-100 text-blue-700'}`}
                    >
                      <MapPin size={14} />
                      {sharingLocation ? 'Tomando GPS...' : cliente.latitud ? 'GPS Vinculado' : 'Guardar Ubicacion GPS'}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="px-4">
          <div className="mb-4 flex items-center justify-between px-1">
            <SectionLabel>Mi Pedido</SectionLabel>
            <span className="rounded-lg bg-[#5D87FF] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">{totalItems} items</span>
          </div>

          <div className="mb-8 space-y-3">
            {items.length === 0 ? (
              <div className="rounded-[32px] border-2 border-dashed border-gray-100 bg-[#F2F6FA]/50 px-4 py-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <ShoppingCart size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-400">El pedido esta vacio</p>
              </div>
            ) : items.map((item) => (
              <div
                key={item.id}
                className={`group relative rounded-[24px] border bg-white p-4 shadow-sm transition-all duration-500 ${lastAddedId === item.id ? 'scale-[1.02] border-[#5D87FF] bg-blue-50/50 shadow-md ring-2 ring-[#5D87FF]/20' : 'border-gray-100 hover:border-blue-100'}`}
              >
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight text-gray-800">{item.nombre}</p>
                    {item.descripcion ? (
                      <p className="mt-1 line-clamp-1 text-[10px] font-medium italic text-gray-400">{item.descripcion}</p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-sm font-black text-[#5D87FF]">{fmt(item.precio_unitario * item.cantidad)}</p>
                      <span className="text-[10px] font-bold text-gray-300">{fmt(item.precio_unitario)} c/u</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onQuitarItem(item.id)}
                      className="p-1.5 text-rose-400 opacity-0 transition-all group-hover:opacity-100 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 p-1">
                      <button
                        type="button"
                        onClick={() => onCambiarCantidad(item.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-gray-500 shadow-sm transition-colors hover:text-rose-500"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="min-w-[16px] text-center text-xs font-black text-gray-800">{item.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => onCambiarCantidad(item.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-gray-500 shadow-sm transition-colors hover:text-emerald-500"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-t-[32px] border-t border-gray-100 bg-white p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
          <div className="mb-4 rounded-[24px] bg-[#F2F6FA] p-4">
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-gray-200/50 pb-4">
              <div className="flex-1">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Descuento Especial</p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onDescuentoTipoChange('monto')}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-black transition-all ${descuentoTipo === 'monto' ? 'bg-[#5D87FF] text-white shadow-md' : 'border border-gray-200 bg-white text-gray-500'}`}
                  >
                    $
                  </button>
                  <button
                    type="button"
                    onClick={() => onDescuentoTipoChange('porcentaje')}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-black transition-all ${descuentoTipo === 'porcentaje' ? 'bg-[#5D87FF] text-white shadow-md' : 'border border-gray-200 bg-white text-gray-500'}`}
                  >
                    %
                  </button>
                  <input
                    type="number"
                    value={descuento}
                    onChange={(event) => onDescuentoChange(event.target.value)}
                    placeholder="0"
                    className="ml-2 h-8 flex-1 rounded-lg border-none bg-white px-3 text-right text-xs font-black text-gray-700 shadow-sm focus:ring-2 focus:ring-[#5D87FF]/20"
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Total a Pagar</p>
                <p className="text-2xl font-black leading-tight text-[#5D87FF]">{fmt(total)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-gray-400">Subtotal ({totalItems})</span>
                <span className="text-gray-700">{fmt(subtotal)}</span>
              </div>
              {envio > 0 ? (
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-400">Envio ({deliveryQuote.zone_name})</span>
                  <span className="text-gray-700">+{fmt(envio)}</span>
                </div>
              ) : null}
              {descuentoAplicado > 0 ? (
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-emerald-500">Descuento</span>
                  <span className="text-emerald-500">-{fmt(descuentoAplicado)}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
            {pagos.map((pago) => (
              <button
                key={pago}
                type="button"
                onClick={() => onMetodoPagoChange(pago)}
                className={`h-10 shrink-0 rounded-xl px-4 text-[10px] font-black transition-all ${metodoPago === pago ? 'bg-[#5D87FF] text-white shadow-lg' : 'border border-gray-100 bg-white text-gray-500'}`}
              >
                {PAYMENT_LABELS[pago].toUpperCase()}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {metodoPago === 'efectivo' ? (
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-[#5D87FF]">$</span>
                  <input
                    type="number"
                    value={efectivoRecibido}
                    onChange={(event) => onEfectivoRecibidoChange(event.target.value)}
                    placeholder="Efectivo recibido"
                    className="h-12 w-full rounded-2xl border-none bg-[#F2F6FA] pl-8 pr-4 text-sm font-black text-gray-800 focus:ring-2 focus:ring-[#5D87FF]/20"
                  />
                </div>
                {vuelto > 0 ? (
                  <div className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-white shadow-lg">
                    <p className="text-[9px] font-black uppercase opacity-80">Vuelto</p>
                    <p className="text-sm font-black">{fmt(vuelto)}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClearOrder}
                disabled={items.length === 0}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 text-gray-400 transition-all hover:text-rose-500 disabled:opacity-30"
              >
                <Trash2 size={20} />
              </button>
              <button
                type="button"
                onClick={onConfirmPrint}
                disabled={confirmDisabled}
                className="h-14 flex-1 rounded-2xl border-2 border-gray-100 bg-white text-sm font-black text-gray-700 transition-all disabled:opacity-30"
              >
                TICKET
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirmDisabled || loading}
                className="h-14 flex-[2] rounded-2xl bg-[#5D87FF] text-sm font-black text-white shadow-[0_10px_25px_rgba(93,135,255,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30"
              >
                VENDER
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
