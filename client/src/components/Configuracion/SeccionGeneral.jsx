import React from 'react';
import { Building2, Clock, Palette, Plus, Store, Trash2 } from 'lucide-react';
import { SectionCard, InputField } from './ConfigComponents.jsx';

export default function SeccionGeneral({
  config,
  f,
  turnos,
  addTurno,
  updateTurno,
  removeTurno,
}) {
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-8">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 -mx-6 px-6 py-4 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <Building2 className="text-indigo-600" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Informacion del negocio</h2>
            <p className="text-sm text-gray-500">Datos generales, branding y turnos operativos reales.</p>
          </div>
        </div>
      </div>

      <SectionCard icon={Store} tone="indigo" title="Datos del negocio" subtitle="Informacion visible para clientes y equipo">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <InputField label="Nombre del negocio" {...f('negocio_nombre')} placeholder="Modo Sabor" />
          <InputField label="Descripcion corta" {...f('negocio_descripcion')} placeholder="Pizzas, empanadas y milanesas" />
          <InputField label="Telefono" {...f('negocio_telefono')} placeholder="+54..." />
          <InputField label="Email" {...f('negocio_email')} placeholder="hola@modosabor.com" />
          <div className="md:col-span-2">
            <InputField label="Direccion" {...f('negocio_direccion')} placeholder="Av. principal 123" />
          </div>
          <InputField label="Localidad" {...f('negocio_localidad')} placeholder="Monteros" />
          <InputField label="Provincia" {...f('negocio_provincia')} placeholder="Tucuman" />
          <InputField label="URL publica app" {...f('public_app_url')} placeholder="https://tuweb.com" />
          <InputField label="URL publica API" {...f('public_api_url')} placeholder="https://tuapi.com" />
        </div>
      </SectionCard>

      <SectionCard icon={Palette} tone="indigo" title="Identidad visual" subtitle="Logo y color principal del sistema">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <InputField label="Logo" {...f('negocio_logo')} placeholder="/uploads/logo.png o https://..." />
          <InputField label="Favicon" {...f('negocio_favicon')} placeholder="/uploads/favicon.ico o https://..." />
          <InputField label="Color principal" {...f('color_primario')} placeholder="#f97316" />
          <InputField label="Mensaje de confirmacion" {...f('mensaje_confirmacion')} placeholder="Gracias por tu pedido" />
        </div>
      </SectionCard>

      <SectionCard icon={Clock} tone="indigo" title="Turnos operativos" subtitle="Estos turnos son los que usa la logica del sistema para aceptar pedidos">
        <div className="space-y-4">
          {turnos.map((turno, index) => (
            <div key={turno.id || index} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.3fr,0.8fr,0.8fr,auto]">
                <InputField
                  label="Nombre del turno"
                  value={turno.nombre || ''}
                  onChange={(event) => updateTurno(index, 'nombre', event.target.value)}
                  placeholder="Turno noche"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                  <input
                    type="time"
                    value={turno.desde || '19:00'}
                    onChange={(event) => updateTurno(index, 'desde', event.target.value)}
                    className="w-full h-12 rounded-xl border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                  <input
                    type="time"
                    value={turno.hasta || '23:30'}
                    onChange={(event) => updateTurno(index, 'hasta', event.target.value)}
                    className="w-full h-12 rounded-xl border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  />
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => updateTurno(index, 'activo', turno.activo === false)}
                    className={`h-12 rounded-xl px-4 text-sm font-bold transition-all ${
                      turno.activo === false ? 'bg-gray-200 text-gray-700' : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {turno.activo === false ? 'Inactivo' : 'Activo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTurno(index)}
                    disabled={turnos.length <= 1}
                    className="h-10 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Trash2 size={14} />
                      Quitar
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addTurno}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <Plus size={16} />
          Agregar turno
        </button>
      </SectionCard>
    </div>
  );
}
