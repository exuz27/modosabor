const db = require('./db');
const personalService = require('./services/personalService');

console.log('=== EMPLEADO EN SISTEMA ===\n');

const personal = personalService.getPersonalList();
if (personal.length === 0) {
  console.log('No hay empleados registrados.');
  process.exit(0);
}

const emp = personal[0];
console.log(`Nombre: ${emp.nombre}`);
console.log(`Categoría: ${emp.categoria_icono} ${emp.categoria_nombre || 'Sin categoría'}`);
console.log(`Rol: ${emp.rol_operativo}`);
console.log(`Frecuencia de pago: ${emp.frecuencia_pago}`);
console.log(`Monto base: $${emp.monto_base.toLocaleString()}`);
console.log(`Fecha de ingreso: ${emp.fecha_ingreso} (${emp.antiguedad_texto})`);
console.log(`Cumpleaños: ${emp.fecha_nacimiento} (faltan ${emp.dias_para_cumpleanos} días)`);
console.log(`Puntos de reconocimiento: ${emp.puntos_reconocimiento}`);
console.log(`Total liquidaciones: ${emp.total_liquidaciones}`);
console.log(`Total adelantos acumulados: $${emp.total_adelantos.toLocaleString()}`);

console.log('\n--- CÁLCULO DE EJEMPLO: 6 DÍAS A $10.000 ---');
const unidades = 6;
const montoBase = 10000;
const bruto = unidades * montoBase;
console.log(`Unidades trabajadas: ${unidades}`);
console.log(`Monto base: $${montoBase.toLocaleString()}`);
console.log(`BRUTO: $${bruto.toLocaleString()}`);
console.log(`(Si tuviera adelantos pendientes, se descontarían aquí)`);
console.log(`NETO A PAGAR: $${bruto.toLocaleString()}`);

console.log('\n--- FRECUENCIAS DE PAGO SOPORTADAS ---');
const frecuencias = [
  { tipo: 'diario', desc: 'Por día trabajado', ejemplo: '$10.000 × 6 días = $60.000' },
  { tipo: 'semanal', desc: 'Por semana', ejemplo: '$70.000 × 1 semana = $70.000' },
  { tipo: 'quincenal', desc: 'Cada 15 días', ejemplo: '$150.000 × 1 quincena = $150.000' },
  { tipo: 'mensual', desc: 'Por mes', ejemplo: '$300.000 × 1 mes = $300.000' }
];
frecuencias.forEach(f => {
  console.log(`• ${f.tipo}: ${f.desc}`);
  console.log(`  Ejemplo: ${f.ejemplo}`);
});

console.log('\n=== FIN ===');
