const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../utils/permissions');
const { createDatabaseBackup, listBackups } = require('../utils/backupManager');
const { insertInventoryMovement, roundStock } = require('../utils/inventory');
const { summarizePaymentRows } = require('../utils/paymentStatus');
const { recalculateClienteStats } = require('../utils/loyalty');

router.use(auth);

const BASE_INSUMOS = [
  'Prepizza',
  'Queso cremoso 200g',
  'Muzzarella 200g',
  'Pan hamburguesa',
  'Medallon smash 90g',
  'Milanesa de pollo',
  'Milanesa de carne',
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(value) {
  return Math.round(Number(value || 0));
}

function loadBaseInsumos() {
  const placeholders = BASE_INSUMOS.map(() => '?').join(',');
  return db.prepare(`
    SELECT id, nombre, rubro, unidad, stock_actual, stock_minimo, nota_compra
    FROM inventario_insumos
    WHERE nombre IN (${placeholders})
    ORDER BY CASE nombre
      ${BASE_INSUMOS.map((name, index) => `WHEN '${name.replace(/'/g, "''")}' THEN ${index}`).join(' ')}
      ELSE 99
    END
  `).all(...BASE_INSUMOS).map((item) => ({
    ...item,
    stock_actual: roundStock(item.stock_actual || 0),
    stock_minimo: roundStock(item.stock_minimo || 0),
  }));
}

function loadDirectStockProducts() {
  return db.prepare(`
    SELECT p.id, p.nombre, p.stock_directo, c.nombre AS categoria
    FROM productos p
    JOIN categorias c ON c.id = p.categoria_id
    WHERE p.activo = 1
      AND p.stock_mode != 'recipe'
      AND c.nombre IN ('Empanadas', 'Papas', 'Bebidas')
    ORDER BY c.orden ASC, p.nombre ASC
  `).all().map((item) => ({
    ...item,
    stock_directo: roundStock(item.stock_directo || 0),
  }));
}

function buildDailyClose(fecha = today()) {
  const pedidos = db.prepare(`
    SELECT *
    FROM pedidos
    WHERE DATE(creado_en) = ?
    ORDER BY datetime(creado_en) DESC
  `).all(fecha);
  const validos = pedidos.filter((pedido) => pedido.estado !== 'cancelado');
  const payment = summarizePaymentRows(validos);
  const movimientos = db.prepare(`
    SELECT *
    FROM caja_movimientos
    WHERE DATE(creado_en) = ?
    ORDER BY datetime(creado_en) DESC
  `).all(fecha);
  const gastos = movimientos.filter((mov) => mov.tipo === 'salida').reduce((acc, mov) => acc + Number(mov.monto || 0), 0);
  const ingresosExtra = movimientos.filter((mov) => mov.tipo === 'entrada').reduce((acc, mov) => acc + Number(mov.monto || 0), 0);
  const deliveryDiario = db.prepare(`
    SELECT COALESCE(SUM(monto_base), 0) AS total, COUNT(*) AS cantidad
    FROM personal
    WHERE activo = 1
      AND lower(rol_operativo) = 'delivery'
      AND lower(frecuencia_pago) = 'diario'
  `).get();

  const topProductos = db.prepare(`
    SELECT pi.nombre, SUM(pi.cantidad) AS cantidad, SUM(pi.subtotal) AS total
    FROM pedido_items pi
    JOIN pedidos p ON p.id = pi.pedido_id
    WHERE DATE(p.creado_en) = ?
      AND p.estado != 'cancelado'
    GROUP BY pi.nombre
    ORDER BY cantidad DESC, total DESC
    LIMIT 8
  `).all(fecha);

  const totalVentas = validos.reduce((acc, pedido) => acc + Number(pedido.total || 0), 0);
  const gananciaOperativa = totalVentas - gastos - Number(deliveryDiario.total || 0);

  return {
    fecha,
    pedidos: validos.length,
    cancelados: pedidos.length - validos.length,
    totalVentas: money(totalVentas),
    ticketPromedio: validos.length ? money(totalVentas / validos.length) : 0,
    efectivo: money(payment.efectivoCobrado || 0),
    digitales: money(payment.digitalesCobrados || 0),
    pendiente: money(payment.totalPendiente || 0),
    gastos: money(gastos),
    ingresosExtra: money(ingresosExtra),
    deliveryDiario: money(deliveryDiario.total || 0),
    gananciaOperativa: money(gananciaOperativa),
    porMetodo: payment.byMethod,
    topProductos,
    movimientos,
  };
}

function buildPointStatus() {
  const activeProducts = db.prepare('SELECT COUNT(*) AS c FROM productos WHERE activo = 1').get().c;
  const recipeProducts = db.prepare("SELECT COUNT(*) AS c FROM productos WHERE activo = 1 AND stock_mode = 'recipe'").get().c;
  const missingStock = db.prepare(`
    SELECT COUNT(*) AS c
    FROM productos p
    WHERE p.activo = 1
      AND (
        (p.stock_mode = 'direct' AND COALESCE(p.stock_directo, 0) <= 0)
        OR (p.stock_mode = 'recipe' AND NOT EXISTS (SELECT 1 FROM inventario_recetas r WHERE r.producto_id = p.id))
      )
  `).get().c;
  const rider = db.prepare('SELECT id, nombre, telefono, codigo_acceso, direccion, activo FROM repartidores WHERE activo = 1 ORDER BY id LIMIT 1').get();
  const clientesConCompras = db.prepare('SELECT COUNT(*) AS c FROM clientes WHERE total_pedidos > 0').get().c;
  const backups = listBackups();
  const latestBackup = backups[0] || null;
  const config = Object.fromEntries(db.prepare('SELECT clave, valor FROM configuracion').all().map((row) => [row.clave, row.valor]));
  const close = buildDailyClose(today());

  return [
    {
      id: 'inventario-fino',
      title: 'Inventario fino',
      ok: recipeProducts >= 37,
      detail: `${recipeProducts}/${activeProducts} productos usan receta compartida`,
    },
    {
      id: 'stock-diario',
      title: 'Stock diario rápido',
      ok: loadBaseInsumos().length >= 7,
      detail: 'Bases principales listas para cargar al inicio del día',
    },
    {
      id: 'cierre-diario',
      title: 'Cierre diario',
      ok: true,
      detail: `${close.pedidos} pedidos hoy, ventas $${close.totalVentas.toLocaleString('es-AR')}`,
    },
    {
      id: 'online-blindado',
      title: 'Pedidos online blindados',
      ok: missingStock === 0,
      detail: missingStock ? `${missingStock} productos pueden frenarse por stock` : 'Menú online respeta disponibilidad',
    },
    {
      id: 'delivery',
      title: 'Delivery',
      ok: Boolean(rider?.codigo_acceso),
      detail: rider ? `${rider.nombre} activo con clave rider` : 'Sin repartidor activo',
    },
    {
      id: 'clientes',
      title: 'Clientes y fidelización',
      ok: clientesConCompras > 0,
      detail: `${clientesConCompras} clientes con historial de compra`,
    },
    {
      id: 'backups',
      title: 'Backups automáticos',
      ok: config.backup_automatico_activo === '1' && Boolean(latestBackup),
      detail: latestBackup ? `Último backup ${new Date(latestBackup.created_at).toLocaleString('es-AR')}` : 'Sin backups detectados',
    },
    {
      id: 'impresion',
      title: 'Impresión',
      ok: Boolean(config.impresion_formato),
      detail: `Formato ${config.impresion_formato || 'sin configurar'}, web auto ${config.impresion_auto_web === '1' ? 'sí' : 'no'}`,
    },
  ];
}

router.get('/resumen', requirePermission('dashboard.view'), (_req, res) => {
  res.json({
    puntos: buildPointStatus(),
    stockDiario: {
      insumos: loadBaseInsumos(),
      productosDirectos: loadDirectStockProducts(),
    },
    cierreDiario: buildDailyClose(today()),
    backups: listBackups().slice(0, 5),
  });
});

router.post('/stock-diario', requirePermission('productos.edit'), (req, res) => {
  const insumos = Array.isArray(req.body?.insumos) ? req.body.insumos : [];
  const productos = Array.isArray(req.body?.productos) ? req.body.productos : [];
  const updateInsumo = db.prepare('UPDATE inventario_insumos SET stock_actual = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?');
  const currentInsumo = db.prepare('SELECT id, nombre, stock_actual FROM inventario_insumos WHERE id = ?');
  const updateProduct = db.prepare("UPDATE productos SET stock_directo = ?, stock_mode = 'direct' WHERE id = ?");
  const currentProduct = db.prepare('SELECT id, nombre, stock_directo FROM productos WHERE id = ?');

  db.exec('BEGIN');
  try {
    insumos.forEach((item) => {
      const id = Number(item.id);
      const stock = roundStock(item.stock_actual);
      if (!Number.isFinite(id) || stock < 0) return;
      const previous = currentInsumo.get(id);
      if (!previous) return;
      const delta = roundStock(stock - Number(previous.stock_actual || 0));
      updateInsumo.run(stock, id);
      if (delta !== 0) {
        insertInventoryMovement(db, {
          insumo_id: id,
          cantidad: delta,
          tipo: 'ajuste',
          motivo: 'Carga de stock diario',
          detalle: { insumo_nombre: previous.nombre, anterior: previous.stock_actual, nuevo: stock },
        });
      }
    });

    productos.forEach((item) => {
      const id = Number(item.id);
      const stock = roundStock(item.stock_directo);
      if (!Number.isFinite(id) || stock < 0) return;
      const previous = currentProduct.get(id);
      if (!previous) return;
      const delta = roundStock(stock - Number(previous.stock_directo || 0));
      updateProduct.run(stock, id);
      if (delta !== 0) {
        insertInventoryMovement(db, {
          producto_id: id,
          cantidad: delta,
          tipo: 'ajuste',
          motivo: 'Carga de stock diario',
          detalle: { producto_nombre: previous.nombre, anterior: previous.stock_directo, nuevo: stock },
        });
      }
    });
    db.exec('COMMIT');
    res.json({ success: true, stockDiario: { insumos: loadBaseInsumos(), productosDirectos: loadDirectStockProducts() } });
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    res.status(400).json({ error: error.message || 'No se pudo guardar el stock diario' });
  }
});

router.get('/cierre-diario', requirePermission('reportes.view'), (req, res) => {
  res.json(buildDailyClose(req.query.fecha || today()));
});

router.post('/backup', requirePermission('config.manage'), (_req, res) => {
  const backup = createDatabaseBackup(db, { reason: 'operacion-manual' });
  res.json({ success: true, backup });
});

router.post('/clientes/sincronizar', requirePermission('clientes.edit'), (_req, res) => {
  const clientes = db.prepare('SELECT id FROM clientes').all();
  clientes.forEach((cliente) => recalculateClienteStats(db, cliente.id));
  res.json({ success: true, total: clientes.length });
});

module.exports = router;
