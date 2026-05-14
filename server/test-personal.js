const db = require('./db');

console.log('=== MÓDULO DE PERSONAL MEJORADO ===\n');

// 1. Ver campos de tabla personal
console.log('1. Campos en tabla personal:');
const cols = db.prepare("PRAGMA table_info(personal)").all();
cols.forEach(c => console.log('   - ' + c.name + ' (' + c.type + ')'));

console.log('\n2. Categorías disponibles:');
const cats = db.prepare('SELECT nombre, icono, color, sueldo_base_minimo, beneficio_vacaciones_dias FROM personal_categorias ORDER BY orden').all();
cats.forEach(c => {
  console.log(`   ${c.icono} ${c.nombre}`);
  console.log(`      Sueldo mínimo: $${c.sueldo_base_minimo.toLocaleString()}`);
  console.log(`      Vacaciones: ${c.beneficio_vacaciones_dias} días`);
});

console.log('\n3. Personal actual en sistema:');
const pers = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN activo=1 THEN 1 ELSE 0 END) as activos FROM personal').get();
console.log(`   Total empleados: ${pers.total}`);
console.log(`   Activos: ${pers.activos}`);

console.log('\n4. Configuración de reconocimientos:');
const config = db.prepare('SELECT * FROM personal_reconocimientos_config WHERE id=1').get();
if (config) {
  console.log(`   Puntos por puntualidad: ${config.puntos_por_puntualidad}`);
  console.log(`   Puntos por venta destacada: ${config.puntos_por_venta_destacada}`);
  console.log(`   Umbral canje: ${config.umbral_canje_puntos} puntos = $${config.recompensa_canje_pesos}`);
  console.log(`   Activo: ${config.activo ? 'Sí' : 'No'}`);
} else {
  console.log('   (Configuración por defecto)');
}

console.log('\n5. Tablas creadas:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'personal%'").all();
tables.forEach(t => console.log('   ✓ ' + t.name));

console.log('\n=== FIN ===');
