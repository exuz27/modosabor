import React from 'react';
import { Database, RotateCcw, Download, RefreshCcw, Shield, FileText, AlertCircle, Settings } from 'lucide-react';
import { SectionCard, InputField } from './ConfigComponents.jsx';

export default function SeccionAvanzado({
  f,
  exportarBackup,
  importarBackup,
  resetOperativo,
  auditLogs = []
}) {
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-8">
      <div className="sticky top-[84px] z-10 mb-8 flex items-center justify-between rounded-[28px] border border-gray-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Settings className="text-gray-600" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Mantenimiento y Seguridad</h2>
            <p className="text-sm text-gray-500">Backups, reinicio de sistema y auditoria</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <SectionCard icon={Shield} tone="blue" title="Conectividad y Sincronizacion" subtitle="Configura el acceso remoto para repartidores y clientes">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField
                label="URL publica de la API"
                {...f('public_api_url')}
                placeholder="Ej: https://silent-horses-tell.loca.lt"
                helper="Direccion del tunel o servidor backend, necesaria para el GPS del rider."
              />
              <InputField
                label="URL publica de la APP"
                {...f('public_app_url')}
                placeholder="Ej: https://silent-horses-tell.loca.lt"
                helper="Direccion de la interfaz web, usada en links publicos del sistema."
              />
            </div>
            <div className="rounded-2xl bg-blue-50 p-4 border border-blue-100">
              <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">Nota para modo local</p>
              <p className="text-xs text-blue-600 leading-relaxed">
                Si usas <strong>Localtunnel</strong> o <strong>ngrok</strong>, pega la direccion HTTPS que te da la terminal en ambos campos para que el seguimiento por mapa y la carta online funcionen correctamente desde el celular.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={Database} tone="gray" title="Copias de seguridad" subtitle="Protege tus datos exportando la base de datos">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-gray-200 p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 text-gray-900">
                <Download size={20} className="text-indigo-600" />
                <span className="font-bold">Exportar datos</span>
              </div>
              <p className="text-xs text-gray-500">Descarga un archivo .sqlite con toda la informacion actual del sistema.</p>
              <button
                onClick={exportarBackup}
                className="mt-2 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700 shadow-sm"
              >
                Descargar backup
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 text-gray-900">
                <RefreshCcw size={20} className="text-amber-600" />
                <span className="font-bold">Importar datos</span>
              </div>
              <p className="text-xs text-gray-500">Sobrescribe la base de datos actual con un archivo de respaldo previo.</p>
              <label className="mt-2 flex w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-3 text-sm font-semibold text-amber-700 transition-all hover:bg-amber-100">
                Subir archivo
                <input type="file" className="hidden" accept=".sqlite" onChange={importarBackup} />
              </label>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={RotateCcw} tone="rose" title="Zona de peligro" subtitle="Acciones irreversibles de limpieza">
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-rose-100 p-2 text-rose-600">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-rose-900">Reinicio operativo</h4>
                <p className="mt-1 text-xs text-rose-700 leading-relaxed">
                  Esta accion eliminara todos los pedidos, movimientos de caja, registros de inventario e impresiones.
                  <strong> Los productos, categorias y usuarios no se borraran.</strong>
                </p>
                <button
                  onClick={resetOperativo}
                  className="mt-4 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-rose-700"
                >
                  Reiniciar sistema para nueva jornada
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={FileText} tone="gray" title="Registro de auditoria" subtitle="Ultimos eventos de seguridad realizados">
          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Accion</th>
                  <th className="px-4 py-3">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLogs.length > 0 ? auditLogs.map((log, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{new Date(log.creado_en).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{log.actor_nombre}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">{log.accion}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]">{JSON.stringify(log.detalle)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-gray-400">No hay registros recientes</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
