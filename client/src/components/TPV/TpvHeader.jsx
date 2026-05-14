import { AlertTriangle, ArrowLeft, Maximize, Minimize2, ShoppingCart, X } from 'lucide-react';

export default function TpvHeader({
  cajaAbierta,
  isBrowserFullscreen,
  onBack,
  onGoCaja,
  onToggleFullscreen,
}) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5D87FF] text-white shadow-lg shadow-blue-200">
              <ShoppingCart size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-gray-900">Punto de Venta</h1>
              {!cajaAbierta ? (
                <div className="flex items-center gap-1.5 text-rose-600 animate-pulse">
                  <X size={14} className="stroke-[3]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Caja Cerrada</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-11 items-center rounded-2xl border border-gray-200 bg-white px-5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 active:scale-95"
            >
              <ArrowLeft size={16} className="mr-2" />
              Panel
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="inline-flex h-11 items-center rounded-2xl bg-gray-900 px-5 text-sm font-bold text-white transition hover:bg-gray-800 active:scale-95"
            >
              {isBrowserFullscreen ? <Minimize2 size={16} className="mr-2" /> : <Maximize size={16} className="mr-2" />}
              {isBrowserFullscreen ? 'Salir' : 'Fullscreen'}
            </button>
          </div>
        </div>
      </header>

      {!cajaAbierta ? (
        <div className="flex items-center justify-between gap-4 border-b border-rose-100 bg-rose-50 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-rose-100 p-2 text-rose-600">
              <AlertTriangle size={18} />
            </div>
            <p className="text-sm font-bold text-rose-800">
              Debes abrir la caja para poder registrar ventas. Inicia el turno en el modulo de Caja.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoCaja}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white transition-all hover:bg-rose-700"
          >
            IR A CAJA
          </button>
        </div>
      ) : null}
    </>
  );
}
