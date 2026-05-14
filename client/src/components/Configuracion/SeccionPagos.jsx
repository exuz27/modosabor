import React from 'react';
import { CreditCard, DollarSign, BadgeCheck, Shield, Zap, Info } from 'lucide-react';
import { SectionCard, InputField, ToggleSwitch } from './ConfigComponents.jsx';

const SECRET_PLACEHOLDER = '__CONFIGURED__';

export default function SeccionPagos({ config, setConfig, f, setToggle }) {
  let metodos = [];
  try {
    metodos = JSON.parse(config.metodos_pago || '[]');
  } catch {
    metodos = ['efectivo', 'mercadopago'];
  }

  const toggleMetodo = (m) => {
    const updated = metodos.includes(m) ? metodos.filter((x) => x !== m) : [...metodos, m];
    setConfig((p) => ({ ...p, metodos_pago: JSON.stringify(updated) }));
  };

  const clearProtectedValueOnFocus = (key) => (event) => {
    if (event.target.value === SECRET_PLACEHOLDER) {
      setConfig((prev) => ({ ...prev, [key]: '' }));
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-8">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 -mx-6 px-6 py-4 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-100 flex items-center justify-center">
            <CreditCard className="text-amber-600" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Pagos y Cobros</h2>
            <p className="text-sm text-gray-500">Configura como tus clientes pueden pagar</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Card: Metodos habilitados */}
        <SectionCard icon={DollarSign} tone="amber" title="Metodos habilitados" subtitle="Selecciona que opciones apareceran en el checkout">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {['efectivo', 'mercadopago', 'transferencia', 'debito', 'credito'].map((m) => (
              <label
                key={m}
                className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
                  metodos.includes(m) ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={metodos.includes(m)}
                    onChange={() => toggleMetodo(m)}
                  />
                  <div className={`flex h-5 w-5 items-center justify-center rounded border ${metodos.includes(m) ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-300 bg-white'}`}>
                    {metodos.includes(m) && <BadgeCheck size={14} />}
                  </div>
                  <span className="text-sm font-semibold capitalize text-gray-800">{m === 'mercadopago' ? 'Mercado Pago' : m}</span>
                </div>
              </label>
            ))}
          </div>
        </SectionCard>

        {/* Card: Mercado Pago */}
        <SectionCard icon={Zap} tone="amber" title="Mercado Pago" subtitle="Configuracion de la pasarela automatica">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <InputField
                label="Access Token (Produccion)"
                type="password"
                value={config.mercadopago_token || ''}
                onChange={(event) => setConfig((prev) => ({ ...prev, mercadopago_token: event.target.value }))}
                onFocus={clearProtectedValueOnFocus('mercadopago_token')}
                placeholder="APP_USR-..."
              />
              {config.mercadopago_token_configured && config.mercadopago_token === SECRET_PLACEHOLDER ? (
                <p className="mt-2 text-xs text-gray-500">Hay un token guardado. Si queres cambiarlo, hace foco en el campo y pega el nuevo valor.</p>
              ) : null}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ToggleSwitch
                checked={config.mercadopago_binary_mode === '1'}
                onChange={(v) => setToggle('mercadopago_binary_mode', v)}
                label="Modo Binario"
                description="Aprobacion inmediata o rechazo. Sin estados pendientes."
                color="amber"
              />
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 flex gap-3">
                <Info className="text-blue-600 shrink-0" size={20} />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Para que los pedidos se marquen como pagados automaticamente, asegúrate de configurar el Webhook en tu panel de Mercado Pago apuntando a la URL publica de tu API.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Card: Otros metodos */}
        <SectionCard icon={Shield} tone="amber" title="Seguridad y Control" subtitle="Validaciones de pagos">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ToggleSwitch
              checked={config.pagos_validar_transferencia === '1'}
              onChange={(v) => setToggle('pagos_validar_transferencia', v)}
              label="Validar comprobante"
              description="Pide al cliente que suba una foto del comprobante."
              color="amber"
            />
            <InputField label="CBU / CVU para transferencias" {...f('pagos_cbu_transferencia')} placeholder="000000..." />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
