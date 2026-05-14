export const MODULE_CONFIG_MAP = {
  tpv: 'modulo_tpv_activo',
  caja: 'modulo_caja_activo',
  kds: 'modulo_kds_activo',
  mesas: 'modulo_mesas_activo',
  delivery: 'modulo_delivery_activo',
  inventario: 'modulo_inventario_activo',
  clientes: 'modulo_clientes_activo',
  reportes: 'modulo_reportes_activo',
  personal: 'modulo_personal_activo',
  cupones: 'modulo_cupones_activo',
  marketing: 'modulo_marketing_activo',
};

export function getModuleConfigKey(moduleKey) {
  return MODULE_CONFIG_MAP[moduleKey] || '';
}

export function isModuleEnabled(config = {}, moduleKey) {
  if (!moduleKey) return true;
  const configKey = getModuleConfigKey(moduleKey);
  if (!configKey) return true;
  const value = config?.[configKey];
  return value === undefined || value === null || String(value) !== '0';
}
