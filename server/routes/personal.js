const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../utils/permissions');
const { getCurrentShiftInfo, matchesPreferredShift } = require('../utils/shifts');
const { actorFromRequest, logAudit } = require('../utils/audit');
const { insertInventoryMovement, roundStock } = require('../utils/inventory');
const { parseLocalizedNumber, roundLocalizedNumber } = require('../utils/numberInput');

// Importar el nuevo servicio de personal
const personalService = require('../services/personalService');

const PAYMENT_FREQUENCIES = ['diario', 'semanal', 'quincenal', 'mensual'];
const PAYMENT_METHODS = ['efectivo', 'transferencia', 'mercadopago', 'modo', 'uala'];
const MOVEMENT_TYPES = ['adelanto', 'descuento', 'consumo'];

function getConfigMap() {
  return db.prepare('SELECT clave, valor FROM configuracion').all().reduce((acc, row) => {
    acc[row.clave] = row.valor;
    return acc;
  }, {});
}

function getActiveCaja() {
  return db.prepare("SELECT * FROM cierres_caja WHERE estado = 'abierta' ORDER BY abierta_en DESC LIMIT 1").get();
}

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeFrequency(value) {
  const frequency = cleanText(value).toLowerCase();
  return PAYMENT_FREQUENCIES.includes(frequency) ? frequency : 'mensual';
}

function normalizePaymentMethod(value) {
  const method = cleanText(value).toLowerCase();
  return PAYMENT_METHODS.includes(method) ? method : 'efectivo';
}

function serializeMovement(row) {
  return {
    ...row,
    monto: roundStock(row.monto || 0),
    saldo_pendiente: roundStock(row.saldo_pendiente || 0),
    cantidad_insumo: roundStock(row.cantidad_insumo || 0),
  };
}

function serializeLiquidacion(row) {
  return {
    ...row,
    unidades: roundStock(row.unidades || 0),
    monto_base: roundStock(row.monto_base || 0),
    monto_bruto: roundStock(row.monto_bruto || 0),
    total_adelantos: roundStock(row.total_adelantos || 0),
    total_descuentos: roundStock(row.total_descuentos || 0),
    total_consumos: roundStock(row.total_consumos || 0),
    monto_neto: roundStock(row.monto_neto || 0),
  };
}

function buildPendingMap() {
  const rows = db.prepare(`
    SELECT
      personal_id,
      COALESCE(SUM(CASE WHEN estado = 'pendiente' AND tipo = 'adelanto' THEN saldo_pendiente ELSE 0 END), 0) AS adelantos,
      COALESCE(SUM(CASE WHEN estado = 'pendiente' AND tipo = 'descuento' THEN saldo_pendiente ELSE 0 END), 0) AS descuentos,
      COALESCE(SUM(CASE WHEN estado = 'pendiente' AND tipo = 'consumo' THEN saldo_pendiente ELSE 0 END), 0) AS consumos
    FROM personal_movimientos
    GROUP BY personal_id
  `).all();

  return new Map(rows.map((row) => [Number(row.personal_id), {
    adelantos: roundStock(row.adelantos || 0),
    descuentos: roundStock(row.descuentos || 0),
    consumos: roundStock(row.consumos || 0),
  }]));
}

function normalizePersonalRow(row, pendingMap) {
  const pending = pendingMap.get(Number(row.id)) || { adelantos: 0, descuentos: 0, consumos: 0 };
  const montoBase = roundStock(row.monto_base || 0);
  const totalPendiente = roundStock(pending.adelantos + pending.descuentos + pending.consumos);

  // Parsear tags
  let tags = [];
  try {
    const parsed = JSON.parse(row.tags || '[]');
    tags = Array.isArray(parsed) ? parsed : [];
  } catch {
    tags = [];
  }

  // Calcular antigüedad
  let antiguedad_anios = 0;
  let antiguedad_texto = '';
  if (row.fecha_ingreso) {
    const ingreso = new Date(row.fecha_ingreso);
    const hoy = new Date();
    const diffTime = Math.abs(hoy - ingreso);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    antiguedad_anios = Math.floor(diffDays / 365);
    const meses = Math.floor((diffDays % 365) / 30);
    
    if (antiguedad_anios > 0) {
      antiguedad_texto = `${antiguedad_anios}a ${meses}m`;
    } else if (meses > 0) {
      antiguedad_texto = `${meses}m`;
    } else {
      antiguedad_texto = `${diffDays}d`;
    }
  }

  // Calcular próximo cumpleaños
  let proximo_cumpleanos = null;
  let dias_para_cumpleanos = null;
  let es_cumpleanos_hoy = false;
  if (row.fecha_nacimiento) {
    const hoy = new Date();
    const nacimiento = new Date(row.fecha_nacimiento);
    const esteAnio = hoy.getFullYear();
    let proximo = new Date(esteAnio, nacimiento.getMonth(), nacimiento.getDate());
    
    if (proximo < hoy) {
      proximo = new Date(esteAnio + 1, nacimiento.getMonth(), nacimiento.getDate());
    }
    
    const diffTime = proximo - hoy;
    dias_para_cumpleanos = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    proximo_cumpleanos = proximo.toISOString().split('T')[0];
    es_cumpleanos_hoy = dias_para_cumpleanos === 0;
  }

  return {
    ...row,
    tags,
    frecuencia_pago: normalizeFrequency(row.frecuencia_pago),
    monto_base: montoBase,
    medio_pago_preferido: normalizePaymentMethod(row.medio_pago_preferido),
    pendiente_adelantos: pending.adelantos,
    pendiente_descuentos: pending.descuentos,
    pendiente_consumos: pending.consumos,
    pendiente_total: totalPendiente,
    neto_sugerido_base: roundStock(Math.max(0, montoBase - totalPendiente)),
    puntos_reconocimiento: Number(row.puntos_reconocimiento || 0),
    total_liquidaciones: Number(row.total_liquidaciones || 0),
    total_adelantos: Number(row.total_adelantos || 0),
    antiguedad_anios,
    antiguedad_texto,
    dias_para_cumpleanos,
    proximo_cumpleanos,
    es_cumpleanos_hoy,
    categoria_id: row.categoria_id,
    categoria_nombre: row.categoria_nombre,
    categoria_color: row.categoria_color,
    categoria_icono: row.categoria_icono,
  };
}

function loadRecentMovements(limit = 80) {
  return db.prepare(`
    SELECT
      pm.*,
      p.nombre AS personal_nombre,
      p.rol_operativo,
      i.nombre AS insumo_nombre,
      i.unidad AS insumo_unidad
    FROM personal_movimientos pm
    JOIN personal p ON p.id = pm.personal_id
    LEFT JOIN inventario_insumos i ON i.id = pm.insumo_id
    ORDER BY datetime(pm.creado_en) DESC, pm.id DESC
    LIMIT ?
  `).all(limit).map(serializeMovement);
}

function loadRecentLiquidaciones(limit = 50) {
  return db.prepare(`
    SELECT
      pl.*,
      p.nombre AS personal_nombre,
      p.rol_operativo
    FROM personal_liquidaciones pl
    JOIN personal p ON p.id = pl.personal_id
    ORDER BY datetime(pl.creado_en) DESC, pl.id DESC
    LIMIT ?
  `).all(limit).map(serializeLiquidacion);
}

function loadPersonalDetail(personalId) {
  const person = db.prepare(`
    SELECT p.*, u.nombre AS usuario_nombre, u.email AS usuario_email,
           pc.nombre as categoria_nombre, pc.color as categoria_color, pc.icono as categoria_icono
    FROM personal p
    LEFT JOIN usuarios u ON u.id = p.usuario_id
    LEFT JOIN personal_categorias pc ON pc.id = p.categoria_id
    WHERE p.id = ?
  `).get(personalId);

  if (!person) return null;

  const pendingMap = buildPendingMap();
  const normalized = normalizePersonalRow(person, pendingMap);
  const movimientos = db.prepare(`
    SELECT
      pm.*,
      i.nombre AS insumo_nombre,
      i.unidad AS insumo_unidad
    FROM personal_movimientos pm
    LEFT JOIN inventario_insumos i ON i.id = pm.insumo_id
    WHERE pm.personal_id = ?
    ORDER BY datetime(pm.creado_en) DESC, pm.id DESC
    LIMIT 80
  `).all(personalId).map(serializeMovement);

  const liquidaciones = db.prepare(`
    SELECT *
    FROM personal_liquidaciones
    WHERE personal_id = ?
    ORDER BY datetime(creado_en) DESC, id DESC
    LIMIT 40
  `).all(personalId).map(serializeLiquidacion);

  const liquidacionIds = liquidaciones.map((item) => item.id);
  let itemsByLiquidacion = new Map();
  if (liquidacionIds.length) {
    const placeholders = liquidacionIds.map(() => '?').join(', ');
    const items = db.prepare(`
      SELECT *
      FROM personal_liquidacion_items
      WHERE liquidacion_id IN (${placeholders})
      ORDER BY id ASC
    `).all(...liquidacionIds);
    itemsByLiquidacion = items.reduce((acc, item) => {
      const key = Number(item.liquidacion_id);
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key).push({
        ...item,
        monto_original: roundStock(item.monto_original || 0),
        monto_aplicado: roundStock(item.monto_aplicado || 0),
        saldo_restante: roundStock(item.saldo_restante || 0),
      });
      return acc;
    }, new Map());
  }

  // Nuevos datos del servicio mejorado
  const direcciones = personalService.getDirecciones(personalId);
  const carrera = personalService.getCarreraHistorial(personalId);
  const reconocimientos = personalService.getReconocimientos(personalId, 20);

  return {
    item: normalized,
    movimientos,
    liquidaciones: liquidaciones.map((item) => ({
      ...item,
      items: itemsByLiquidacion.get(Number(item.id)) || [],
    })),
    direcciones,
    carrera,
    reconocimientos,
  };
}

// ============================================
// ENDPOINTS PRINCIPALES
// ============================================

// GET /api/personal - Listado con filtros y estadísticas
router.get('/', auth, requirePermission('config.manage'), (req, res) => {
  const { search, rol_operativo, categoria_id, turno_preferido, activo, cumpleanos_mes } = req.query;
  
  // Usar el nuevo servicio si hay filtros avanzados
  if (search || categoria_id || cumpleanos_mes) {
    const items = personalService.getPersonalList(search || '', {
      rol_operativo,
      categoria_id: categoria_id ? parseInt(categoria_id) : null,
      turno_preferido,
      activo: activo !== undefined ? activo === 'true' : undefined,
      cumpleanos_mes: cumpleanos_mes === 'true'
    });
    
    const config = getConfigMap();
    const shiftInfo = getCurrentShiftInfo(config);
    const currentShiftId = shiftInfo.turno_actual?.id || '';
    const currentShiftLabel = shiftInfo.turno_actual?.nombre || '';
    
    const porRol = items.reduce((acc, item) => {
      const key = item.rol_operativo || 'sin_rol';
      const current = acc[key] || { rol: key, total: 0, activos: 0 };
      current.total += 1;
      if (item.activo) current.activos += 1;
      acc[key] = current;
      return acc;
    }, {});
    
    const porCategoria = items.reduce((acc, item) => {
      const key = item.categoria_nombre || 'Sin Categoría';
      const current = acc[key] || { categoria: key, color: item.categoria_color, icono: item.categoria_icono, total: 0, activos: 0 };
      current.total += 1;
      if (item.activo) current.activos += 1;
      acc[key] = current;
      return acc;
    }, {});
    
    const equipoTurnoActual = items.filter((item) => item.activo && matchesPreferredShift(item.turno_preferido, currentShiftId));
    
    return res.json({
      items,
      turno_actual: currentShiftLabel,
      turno_actual_id: currentShiftId,
      turnos: shiftInfo.turnos,
      por_rol: Object.values(porRol),
      por_categoria: Object.values(porCategoria),
      equipo_turno_actual: equipoTurnoActual,
      categorias: personalService.getCategorias(),
      frecuencias_pago: PAYMENT_FREQUENCIES,
      metodos_pago: PAYMENT_METHODS,
    });
  }
  
  // Listado tradicional
  const rows = db.prepare(`
    SELECT p.*, u.nombre AS usuario_nombre, u.email AS usuario_email,
           pc.nombre as categoria_nombre, pc.color as categoria_color, pc.icono as categoria_icono
    FROM personal p
    LEFT JOIN usuarios u ON u.id = p.usuario_id
    LEFT JOIN personal_categorias pc ON pc.id = p.categoria_id
    ORDER BY p.activo DESC, p.rol_operativo ASC, p.nombre ASC
  `).all();
  const pendingMap = buildPendingMap();
  const items = rows.map((row) => normalizePersonalRow(row, pendingMap));

  const config = getConfigMap();
  const shiftInfo = getCurrentShiftInfo(config);
  const currentShiftId = shiftInfo.turno_actual?.id || '';
  const currentShiftLabel = shiftInfo.turno_actual?.nombre || '';

  const resumenTurnos = items.reduce((acc, item) => {
    const key = item.turno_preferido || 'sin_turno';
    const current = acc[key] || { turno: key, total: 0, activos: 0 };
    current.total += 1;
    if (item.activo) current.activos += 1;
    acc[key] = current;
    return acc;
  }, {});

  const porRol = items.reduce((acc, item) => {
    const key = item.rol_operativo || 'sin_rol';
    const current = acc[key] || { rol: key, total: 0, activos: 0 };
    current.total += 1;
    if (item.activo) current.activos += 1;
    acc[key] = current;
    return acc;
  }, {});
  
  const porCategoria = items.reduce((acc, item) => {
    const key = item.categoria_nombre || 'Sin Categoría';
    const current = acc[key] || { categoria: key, color: item.categoria_color, icono: item.categoria_icono, total: 0, activos: 0 };
    current.total += 1;
    if (item.activo) current.activos += 1;
    acc[key] = current;
    return acc;
  }, {});

  const equipoTurnoActual = items.filter((item) => item.activo && matchesPreferredShift(item.turno_preferido, currentShiftId));
  const insumosCatalogo = db.prepare(`
    SELECT id, nombre, unidad, stock_actual, costo_unitario
    FROM inventario_insumos
    WHERE activo = 1
    ORDER BY nombre ASC, id ASC
  `).all().map((item) => ({
    ...item,
    stock_actual: roundStock(item.stock_actual || 0),
    costo_unitario: roundStock(item.costo_unitario || 0),
  }));

  res.json({
    items,
    turno_actual: currentShiftLabel,
    turno_actual_id: currentShiftId,
    turnos: shiftInfo.turnos,
    resumen_turnos: Object.values(resumenTurnos),
    por_rol: Object.values(porRol),
    por_categoria: Object.values(porCategoria),
    equipo_turno_actual: equipoTurnoActual,
    insumos_catalogo: insumosCatalogo,
    categorias: personalService.getCategorias(),
    frecuencias_pago: PAYMENT_FREQUENCIES,
    metodos_pago: PAYMENT_METHODS,
    movimientos_recientes: loadRecentMovements(),
    liquidaciones_recientes: loadRecentLiquidaciones(),
  });
});

// GET /api/personal/estadisticas - Dashboard de estadísticas
router.get('/estadisticas', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const stats = personalService.getEstadisticas();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/personal/categorias - Listar categorías laborales
router.get('/categorias', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const categorias = personalService.getCategorias();
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/personal/categorias - Crear categoría
router.post('/categorias', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const categoria = personalService.createCategoria(req.body);
    res.json(categoria);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/personal/categorias/:id - Actualizar categoría
router.put('/categorias/:id', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const categoria = personalService.updateCategoria(req.params.id, req.body);
    if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(categoria);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/personal/reconocimientos/config - Config de reconocimientos
router.get('/reconocimientos/config', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const config = personalService.getReconocimientosConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/personal/reconocimientos/config - Actualizar config
router.put('/reconocimientos/config', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const config = personalService.updateReconocimientosConfig(req.body);
    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/personal/:id/detalle - Ficha completa del empleado
router.get('/:id/detalle', auth, requirePermission('config.manage'), (req, res) => {
  const detail = loadPersonalDetail(req.params.id);
  if (!detail) {
    return res.status(404).json({ error: 'Personal no encontrado' });
  }
  res.json(detail);
});

// ============================================
// CRUD BÁSICO
// ============================================

router.post('/', auth, requirePermission('config.manage'), (req, res) => {
  const nombre = cleanText(req.body?.nombre);
  const rolOperativo = cleanText(req.body?.rol_operativo) || 'cocina';
  const telefono = cleanText(req.body?.telefono);
  const email = cleanText(req.body?.email);
  const turnoPreferido = cleanText(req.body?.turno_preferido);
  const usuarioId = req.body?.usuario_id || null;
  const frecuenciaPago = normalizeFrequency(req.body?.frecuencia_pago);
  const montoBase = roundLocalizedNumber(req.body?.monto_base || 0);
  const medioPagoPreferido = normalizePaymentMethod(req.body?.medio_pago_preferido);
  const activo = Number(req.body?.activo) === 0 ? 0 : 1;
  const notas = cleanText(req.body?.notas);
  const avatarUrl = cleanText(req.body?.avatar_url);
  const fechaNacimiento = cleanText(req.body?.fecha_nacimiento);
  const fechaIngreso = cleanText(req.body?.fecha_ingreso) || new Date().toISOString().split('T')[0];
  const direccion = cleanText(req.body?.direccion);
  const categoriaId = req.body?.categoria_id || 1;

  if (!nombre) {
    return res.status(400).json({ error: 'Nombre requerido' });
  }
  if (montoBase < 0) {
    return res.status(400).json({ error: 'El monto base debe ser 0 o mayor' });
  }

  const result = db.prepare(`
    INSERT INTO personal (
      nombre, rol_operativo, telefono, email, turno_preferido, usuario_id,
      frecuencia_pago, monto_base, medio_pago_preferido, activo, notas, avatar_url,
      fecha_nacimiento, fecha_ingreso, direccion, categoria_id, actualizado_en
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    nombre,
    rolOperativo,
    telefono,
    email,
    turnoPreferido,
    usuarioId,
    frecuenciaPago,
    montoBase,
    medioPagoPreferido,
    activo,
    notas,
    avatarUrl,
    fechaNacimiento,
    fechaIngreso,
    direccion,
    categoriaId
  );

  const detail = loadPersonalDetail(result.lastInsertRowid);
  res.json(detail.item);
});

router.put('/:id', auth, requirePermission('config.manage'), (req, res) => {
  const existing = db.prepare('SELECT * FROM personal WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Personal no encontrado' });
  }

  const nombre = cleanText(req.body?.nombre ?? existing.nombre);
  const rolOperativo = cleanText(req.body?.rol_operativo ?? existing.rol_operativo) || 'cocina';
  const telefono = cleanText(req.body?.telefono ?? existing.telefono);
  const email = cleanText(req.body?.email ?? existing.email);
  const turnoPreferido = cleanText(req.body?.turno_preferido ?? existing.turno_preferido);
  const usuarioId = req.body?.usuario_id ?? existing.usuario_id;
  const frecuenciaPago = normalizeFrequency(req.body?.frecuencia_pago ?? existing.frecuencia_pago);
  const montoBase = roundLocalizedNumber(req.body?.monto_base ?? existing.monto_base);
  const medioPagoPreferido = normalizePaymentMethod(req.body?.medio_pago_preferido ?? existing.medio_pago_preferido);
  const activo = req.body?.activo === undefined ? Number(existing.activo || 1) : (Number(req.body.activo) === 0 ? 0 : 1);
  const notas = cleanText(req.body?.notas ?? existing.notas);
  const avatarUrl = cleanText(req.body?.avatar_url ?? existing.avatar_url);
  const fechaNacimiento = cleanText(req.body?.fecha_nacimiento ?? existing.fecha_nacimiento);
  const fechaIngreso = cleanText(req.body?.fecha_ingreso ?? existing.fecha_ingreso);
  const direccion = cleanText(req.body?.direccion ?? existing.direccion);
  const categoriaId = req.body?.categoria_id ?? existing.categoria_id;
  const tags = req.body?.tags ? JSON.stringify(req.body.tags) : existing.tags;

  if (!nombre) {
    return res.status(400).json({ error: 'Nombre requerido' });
  }
  if (montoBase < 0) {
    return res.status(400).json({ error: 'El monto base debe ser 0 o mayor' });
  }

  db.prepare(`
    UPDATE personal
    SET nombre = ?, rol_operativo = ?, telefono = ?, email = ?, turno_preferido = ?, usuario_id = ?,
        frecuencia_pago = ?, monto_base = ?, medio_pago_preferido = ?, activo = ?, notas = ?,
        avatar_url = ?, fecha_nacimiento = ?, fecha_ingreso = ?, direccion = ?, categoria_id = ?,
        tags = ?, actualizado_en = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    nombre,
    rolOperativo,
    telefono,
    email,
    turnoPreferido,
    usuarioId || null,
    frecuenciaPago,
    montoBase,
    medioPagoPreferido,
    activo,
    notas,
    avatarUrl,
    fechaNacimiento,
    fechaIngreso,
    direccion,
    categoriaId,
    tags,
    req.params.id
  );

  const detail = loadPersonalDetail(req.params.id);
  res.json(detail.item);
});

router.delete('/:id', auth, requirePermission('config.manage'), (req, res) => {
  db.prepare('DELETE FROM personal WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================
// DIRECCIONES
// ============================================

// GET /api/personal/:id/direcciones
router.get('/:id/direcciones', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const direcciones = personalService.getDirecciones(req.params.id);
    res.json(direcciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/personal/:id/direcciones
router.post('/:id/direcciones', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const direccion = personalService.createDireccion(req.params.id, req.body);
    res.json(direccion);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/personal/:id/direcciones/:direccionId
router.put('/:id/direcciones/:direccionId', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const direccion = personalService.updateDireccion(req.params.id, req.params.direccionId, req.body);
    if (!direccion) return res.status(404).json({ error: 'Dirección no encontrada' });
    res.json(direccion);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/personal/:id/direcciones/:direccionId
router.delete('/:id/direcciones/:direccionId', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const result = personalService.deleteDireccion(req.params.id, req.params.direccionId);
    if (!result) return res.status(404).json({ error: 'Dirección no encontrada' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CARRERA / ASCENSOS
// ============================================

// GET /api/personal/:id/carrera - Historial de carrera
router.get('/:id/carrera', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const carrera = personalService.getCarreraHistorial(req.params.id);
    res.json(carrera);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/personal/:id/ascenso - Registrar ascenso
router.post('/:id/ascenso', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const resultado = personalService.registrarAscenso(req.params.id, req.body, actor.actor_id);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// RECONOCIMIENTOS / PUNTOS
// ============================================

// GET /api/personal/:id/reconocimientos
router.get('/:id/reconocimientos', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const reconocimientos = personalService.getReconocimientos(req.params.id, limit);
    res.json(reconocimientos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/personal/:id/reconocimientos - Agregar reconocimiento
router.post('/:id/reconocimientos', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const resultado = personalService.agregarReconocimiento(req.params.id, req.body, actor.actor_id);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/personal/:id/reconocimientos/canjear - Canjear puntos
router.post('/:id/reconocimientos/canjear', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const resultado = personalService.canjearReconocimientos(req.params.id, actor.actor_id);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// MOVIMIENTOS Y LIQUIDACIONES (ORIGINALES)
// ============================================

router.post('/:id/movimientos', auth, requirePermission('config.manage'), (req, res) => {
  const person = db.prepare('SELECT * FROM personal WHERE id = ?').get(req.params.id);
  if (!person) {
    return res.status(404).json({ error: 'Personal no encontrado' });
  }

  const tipo = cleanText(req.body?.tipo).toLowerCase();
  const descripcion = cleanText(req.body?.descripcion);
  let monto = roundLocalizedNumber(req.body?.monto || 0);
  const impactaCaja = Number(req.body?.impacta_caja) === 1 || (req.body?.impacta_caja === undefined && tipo === 'adelanto');
  const actor = actorFromRequest(req);

  if (!MOVEMENT_TYPES.includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de movimiento invalido' });
  }

  let insumo = null;
  let cantidadInsumo = 0;
  let cajaMovimientoId = null;
  let cajaRegistrada = false;
  let stockAjustado = false;

  try {
    db.exec('BEGIN');

    if (tipo === 'consumo') {
      const insumoId = Number(req.body?.insumo_id || 0);
      cantidadInsumo = roundStock(parseLocalizedNumber(req.body?.cantidad_insumo || 0));
      insumo = db.prepare('SELECT * FROM inventario_insumos WHERE id = ?').get(insumoId);

      if (!insumo) {
        throw new Error('Selecciona un insumo valido para registrar el consumo');
      }
      if (cantidadInsumo <= 0) {
        throw new Error('La cantidad consumida debe ser mayor a 0');
      }

      const nextStock = roundStock(Number(insumo.stock_actual || 0) - cantidadInsumo);
      if (nextStock < 0) {
        throw new Error(`No hay stock suficiente de ${insumo.nombre}`);
      }

      if (monto <= 0) {
        monto = roundStock(cantidadInsumo * Number(insumo.costo_unitario || 0));
      }
      if (monto <= 0) {
        throw new Error('Define un monto para descontar o carga costo al insumo');
      }

      db.prepare(`
        UPDATE inventario_insumos
        SET stock_actual = ?, actualizado_en = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(nextStock, insumo.id);

      insertInventoryMovement(db, {
        insumo_id: insumo.id,
        cantidad: -cantidadInsumo,
        tipo: 'salida_personal',
        motivo: `Salida a personal: ${person.nombre}`,
        detalle: {
          personal_id: person.id,
          personal_nombre: person.nombre,
          descripcion,
          anterior: roundStock(insumo.stock_actual || 0),
          nuevo: nextStock,
        },
      });
      stockAjustado = true;
    } else if (monto <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    if (tipo === 'adelanto' && impactaCaja) {
      const cajaActiva = getActiveCaja();
      if (cajaActiva) {
        const resultCaja = db.prepare(`
          INSERT INTO caja_movimientos (cierre_id, tipo, monto, motivo, actor_id, actor_nombre)
          VALUES (?, 'salida', ?, ?, ?, ?)
        `).run(
          cajaActiva.id,
          monto,
          `Adelanto a ${person.nombre}${descripcion ? ` - ${descripcion}` : ''}`,
          actor.actor_id,
          actor.actor_nombre
        );
        cajaMovimientoId = resultCaja.lastInsertRowid;
        cajaRegistrada = true;
      }
    }

    const result = db.prepare(`
      INSERT INTO personal_movimientos (
        personal_id, tipo, descripcion, monto, saldo_pendiente, estado,
        insumo_id, cantidad_insumo, caja_movimiento_id, actor_id, actor_nombre
      ) VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?)
    `).run(
      person.id,
      tipo,
      descripcion || `${tipo} de personal`,
      monto,
      monto,
      insumo?.id || null,
      cantidadInsumo || 0,
      cajaMovimientoId,
      actor.actor_id,
      actor.actor_nombre
    );
    
    // Actualizar total_adelantos en personal
    if (tipo === 'adelanto') {
      db.prepare('UPDATE personal SET total_adelantos = total_adelantos + ? WHERE id = ?').run(monto, person.id);
    }

    db.exec('COMMIT');

    logAudit(db, {
      modulo: 'personal',
      accion: `movimiento_${tipo}`,
      entidad: 'personal_movimiento',
      entidad_id: result.lastInsertRowid,
      actor_id: actor.actor_id,
      actor_nombre: actor.actor_nombre,
      detalle: {
        personal_id: person.id,
        personal_nombre: person.nombre,
        tipo,
        monto,
        descripcion,
        insumo_id: insumo?.id || null,
        cantidad_insumo: cantidadInsumo,
        caja_registrada: cajaRegistrada,
      },
    });

    const row = db.prepare(`
      SELECT
        pm.*,
        i.nombre AS insumo_nombre,
        i.unidad AS insumo_unidad
      FROM personal_movimientos pm
      LEFT JOIN inventario_insumos i ON i.id = pm.insumo_id
      WHERE pm.id = ?
    `).get(result.lastInsertRowid);

    res.json({
      ...serializeMovement(row),
      caja_registrada: cajaRegistrada,
      stock_ajustado: stockAjustado,
    });
  } catch (error) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: error.message || 'No se pudo registrar el movimiento' });
  }
});

router.post('/:id/liquidaciones', auth, requirePermission('config.manage'), (req, res) => {
  const person = db.prepare('SELECT * FROM personal WHERE id = ?').get(req.params.id);
  if (!person) {
    return res.status(404).json({ error: 'Personal no encontrado' });
  }

  const frecuenciaPago = normalizeFrequency(person.frecuencia_pago);
  const metodoPago = normalizePaymentMethod(req.body?.metodo_pago ?? person.medio_pago_preferido);
  const unidades = roundStock(parseLocalizedNumber(req.body?.unidades || 1));
  const montoBase = roundLocalizedNumber(req.body?.monto_base ?? person.monto_base);
  const periodoDesde = cleanText(req.body?.periodo_desde);
  const periodoHasta = cleanText(req.body?.periodo_hasta);
  const notas = cleanText(req.body?.notas);
  const impactaCaja = Number(req.body?.impacta_caja) === 1 || (req.body?.impacta_caja === undefined && metodoPago === 'efectivo');
  const actor = actorFromRequest(req);

  if (unidades <= 0) {
    return res.status(400).json({ error: 'Las unidades a liquidar deben ser mayores a 0' });
  }
  if (montoBase < 0) {
    return res.status(400).json({ error: 'El monto base debe ser 0 o mayor' });
  }

  const montoBruto = roundStock(montoBase * unidades);
  const pendientes = db.prepare(`
    SELECT *
    FROM personal_movimientos
    WHERE personal_id = ? AND estado = 'pendiente' AND saldo_pendiente > 0
    ORDER BY datetime(creado_en) ASC, id ASC
  `).all(person.id).map(serializeMovement);

  try {
    db.exec('BEGIN');

    const result = db.prepare(`
      INSERT INTO personal_liquidaciones (
        personal_id, periodo_desde, periodo_hasta, frecuencia_pago, unidades,
        monto_base, monto_bruto, total_adelantos, total_descuentos, total_consumos,
        monto_neto, metodo_pago, notas, actor_id, actor_nombre
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?, ?)
    `).run(
      person.id,
      periodoDesde,
      periodoHasta,
      frecuenciaPago,
      unidades,
      montoBase,
      montoBruto,
      metodoPago,
      notas,
      actor.actor_id,
      actor.actor_nombre
    );

    const liquidacionId = result.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO personal_liquidacion_items (
        liquidacion_id, movimiento_id, tipo, descripcion, monto_original, monto_aplicado, saldo_restante
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const totals = { adelantos: 0, descuentos: 0, consumos: 0 };
    let remainingGross = montoBruto;

    pendientes.forEach((movement) => {
      if (remainingGross <= 0) return;

      const pendiente = roundStock(movement.saldo_pendiente || 0);
      if (pendiente <= 0) return;

      const aplicado = roundStock(Math.min(remainingGross, pendiente));
      if (aplicado <= 0) return;

      remainingGross = roundStock(remainingGross - aplicado);
      const saldoRestante = roundStock(pendiente - aplicado);
      if (movement.tipo === 'adelanto') totals.adelantos = roundStock(totals.adelantos + aplicado);
      if (movement.tipo === 'descuento') totals.descuentos = roundStock(totals.descuentos + aplicado);
      if (movement.tipo === 'consumo') totals.consumos = roundStock(totals.consumos + aplicado);

      db.prepare(`
        UPDATE personal_movimientos
        SET saldo_pendiente = ?, estado = ?
        WHERE id = ?
      `).run(saldoRestante, saldoRestante > 0 ? 'pendiente' : 'aplicado', movement.id);

      insertItem.run(
        liquidacionId,
        movement.id,
        movement.tipo,
        movement.descripcion,
        movement.monto,
        aplicado,
        saldoRestante
      );
    });

    const montoNeto = roundStock(montoBruto - totals.adelantos - totals.descuentos - totals.consumos);
    let cajaMovimientoId = null;
    let cajaRegistrada = false;

    if (impactaCaja && metodoPago === 'efectivo' && montoNeto > 0) {
      const cajaActiva = getActiveCaja();
      if (cajaActiva) {
        const resultCaja = db.prepare(`
          INSERT INTO caja_movimientos (cierre_id, tipo, monto, motivo, actor_id, actor_nombre)
          VALUES (?, 'salida', ?, ?, ?, ?)
        `).run(
          cajaActiva.id,
          montoNeto,
          `Pago a ${person.nombre}${periodoHasta ? ` (${periodoHasta})` : ''}`,
          actor.actor_id,
          actor.actor_nombre
        );
        cajaMovimientoId = resultCaja.lastInsertRowid;
        cajaRegistrada = true;
      }
    }

    db.prepare(`
      UPDATE personal_liquidaciones
      SET total_adelantos = ?, total_descuentos = ?, total_consumos = ?, monto_neto = ?, caja_movimiento_id = ?
      WHERE id = ?
    `).run(totals.adelantos, totals.descuentos, totals.consumos, montoNeto, cajaMovimientoId, liquidacionId);
    
    // Actualizar contadores en personal
    db.prepare('UPDATE personal SET total_liquidaciones = total_liquidaciones + 1 WHERE id = ?').run(person.id);

    db.exec('COMMIT');

    logAudit(db, {
      modulo: 'personal',
      accion: 'liquidacion_pago',
      entidad: 'personal_liquidacion',
      entidad_id: liquidacionId,
      actor_id: actor.actor_id,
      actor_nombre: actor.actor_nombre,
      detalle: {
        personal_id: person.id,
        personal_nombre: person.nombre,
        frecuencia_pago: frecuenciaPago,
        unidades,
        monto_bruto: montoBruto,
        total_adelantos: totals.adelantos,
        total_descuentos: totals.descuentos,
        total_consumos: totals.consumos,
        monto_neto: montoNeto,
        metodo_pago: metodoPago,
        caja_registrada: cajaRegistrada,
      },
    });

    const liquidacion = db.prepare('SELECT * FROM personal_liquidaciones WHERE id = ?').get(liquidacionId);
    const items = db.prepare('SELECT * FROM personal_liquidacion_items WHERE liquidacion_id = ? ORDER BY id ASC').all(liquidacionId);

    res.json({
      ...serializeLiquidacion(liquidacion),
      items: items.map((item) => ({
        ...item,
        monto_original: roundStock(item.monto_original || 0),
        monto_aplicado: roundStock(item.monto_aplicado || 0),
        saldo_restante: roundStock(item.saldo_restante || 0),
      })),
      caja_registrada: cajaRegistrada,
    });
  } catch (error) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: error.message || 'No se pudo liquidar el pago' });
  }
});

module.exports = router;
