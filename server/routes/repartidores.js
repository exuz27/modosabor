const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const { requirePermission, hasPermission } = require('../utils/permissions');
const { assignPedidoToRepartidor, autoAssignPedido, getRepartidorById } = require('../utils/deliveryAssignment');
const { uploadsDir, uploadPathFromFilename } = require('../utils/storagePaths');
const { emitPedidoActualizado, emitDeliveryAssignment, emitRepartidorUbicacion, clearTrackingToken } = require('../utils/socketRooms');
const { createFileFilter, PHOTO_EXTENSIONS, PHOTO_MIME_TYPES } = require('../utils/uploadValidation');
const { getPedidoHydratedById } = require('../services/pedidoService');

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => cb(null, `entrega-${Date.now()}${String(path.extname(file.originalname) || '').toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: createFileFilter({
    allowedExtensions: PHOTO_EXTENSIONS,
    allowedMimeTypes: PHOTO_MIME_TYPES,
    message: 'La foto de entrega debe ser JPG, PNG, WEBP, GIF o HEIC',
  }),
});

function generateAccessCode() {
  return crypto.randomBytes(4).toString('hex');
}

function normalizeAccessCode(value) {
  return String(value || '').trim();
}

function ensureUniqueAccessCode(codigo, excludeId = null) {
  const normalized = normalizeAccessCode(codigo);
  if (!normalized) return null;
  const existing = excludeId
    ? db.prepare('SELECT id FROM repartidores WHERE codigo_acceso = ? AND id != ?').get(normalized, excludeId)
    : db.prepare('SELECT id FROM repartidores WHERE codigo_acceso = ?').get(normalized);
  if (existing) {
    throw new Error('Ese PIN de rider ya esta en uso');
  }
  return normalized;
}

function hydrateRepartidor(id) {
  const repartidor = db.prepare('SELECT * FROM repartidores WHERE id = ?').get(id);
  if (!repartidor) return null;
  if (repartidor.codigo_acceso) return repartidor;

  const codigo = generateAccessCode();
  db.prepare('UPDATE repartidores SET codigo_acceso = ? WHERE id = ?').run(codigo, id);
  return db.prepare('SELECT * FROM repartidores WHERE id = ?').get(id);
}

function validateRiderAccess(req, res) {
  const repartidor = hydrateRepartidor(req.params.id);
  if (!repartidor) {
    res.status(404).json({ error: 'Repartidor no encontrado' });
    return null;
  }

  if (req.params.codigo !== repartidor.codigo_acceso) {
    res.status(401).json({ error: 'Acceso invalido' });
    return null;
  }

  return repartidor;
}

router.get('/', auth, (req, res) => {
  if (!hasPermission(req.user, 'delivery.view') && !hasPermission(req.user, 'tpv.use')) {
    return res.status(403).json({ error: 'Sin permisos para ver repartidores' });
  }
  const rows = db.prepare('SELECT id FROM repartidores ORDER BY nombre ASC').all();
  res.json(rows.map((row) => hydrateRepartidor(row.id)));
});

router.post('/', auth, requirePermission('delivery.manage'), (req, res) => {
  const { 
    nombre, 
    telefono = '', 
    vehiculo = '', 
    zona_preferida = '',
    codigo_acceso = '',
    direccion = '',
    latitud_casa = null,
    longitud_casa = null,
    avatar_url = '',
    notas = '',
    fecha_ingreso = ''
  } = req.body;

  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  let codigoFinal = '';
  try {
    codigoFinal = ensureUniqueAccessCode(codigo_acceso) || generateAccessCode();
  } catch (error) {
    return res.status(400).json({ error: error.message || 'PIN de rider invalido' });
  }

  const r = db.prepare(`
    INSERT INTO repartidores (
      nombre, telefono, vehiculo, zona_preferida, codigo_acceso,
      direccion, latitud_casa, longitud_casa, avatar_url, notas, fecha_ingreso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nombre,
    telefono,
    vehiculo,
    zona_preferida,
    codigoFinal,
    direccion,
    latitud_casa,
    longitud_casa,
    avatar_url,
    notas,
    fecha_ingreso || new Date().toISOString().split('T')[0]
  );
  res.json(hydrateRepartidor(r.lastInsertRowid));
});

router.put('/:id', auth, requirePermission('delivery.manage'), (req, res) => {
  const { 
    nombre, telefono, vehiculo, zona_preferida, activo, disponible,
    codigo_acceso,
    direccion, latitud_casa, longitud_casa, avatar_url, notas, fecha_ingreso
  } = req.body;

  const current = hydrateRepartidor(req.params.id);
  if (!current) return res.status(404).json({ error: 'Repartidor no encontrado' });

  let codigoFinal = current.codigo_acceso || generateAccessCode();
  try {
    codigoFinal = ensureUniqueAccessCode(codigo_acceso, req.params.id) || codigoFinal;
  } catch (error) {
    return res.status(400).json({ error: error.message || 'PIN de rider invalido' });
  }

  db.prepare(`
    UPDATE repartidores 
    SET nombre=?, telefono=?, vehiculo=?, zona_preferida=?, codigo_acceso=?, activo=?, disponible=?,
        direccion=?, latitud_casa=?, longitud_casa=?, avatar_url=?, notas=?, fecha_ingreso=?
    WHERE id=?
  `).run(
    nombre, telefono, vehiculo, zona_preferida || '', codigoFinal, activo, disponible,
    direccion || '', latitud_casa, longitud_casa, avatar_url || '', notas || '', fecha_ingreso || '',
    req.params.id
  );
  res.json(hydrateRepartidor(req.params.id));
});

router.delete('/:id', auth, requirePermission('delivery.manage'), (req, res) => {
  db.prepare('DELETE FROM repartidores WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.put('/:id/ubicacion', auth, requirePermission('delivery.manage'), (req, res) => {
  const { latitud, longitud } = req.body;
  const rep = hydrateRepartidor(req.params.id);
  if (!rep) return res.status(404).json({ error: 'Repartidor no encontrado' });

  db.prepare(
    'UPDATE repartidores SET latitud = ?, longitud = ?, ultima_ubicacion_en = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(Number(latitud), Number(longitud), req.params.id);

  const updated = hydrateRepartidor(req.params.id);
  const io = req.app.get('io');
  if (io) {
    // Buscar si este repartidor tiene un pedido activo para emitir al cliente también
    const pedidoActivo = db.prepare("SELECT id FROM pedidos WHERE repartidor_id = ? AND estado = 'en_camino' LIMIT 1").get(rep.id);
    emitRepartidorUbicacion(io, updated, pedidoActivo?.id);
  }
  res.json(updated);
});

router.delete('/:id/ubicacion', auth, requirePermission('delivery.manage'), (req, res) => {
  const rep = hydrateRepartidor(req.params.id);
  if (!rep) return res.status(404).json({ error: 'Repartidor no encontrado' });

  db.prepare(
    'UPDATE repartidores SET latitud = NULL, longitud = NULL, ultima_ubicacion_en = NULL WHERE id = ?'
  ).run(req.params.id);

  const updated = hydrateRepartidor(req.params.id);
  const io = req.app.get('io');
  if (io) emitRepartidorUbicacion(io, updated);
  res.json(updated);
});

router.get('/:id/rider/:codigo', (req, res) => {
  const repartidor = validateRiderAccess(req, res);
  if (!repartidor) return;

  const pedidos = db.prepare(
    "SELECT * FROM pedidos WHERE repartidor_id = ? AND estado NOT IN ('entregado', 'cancelado') ORDER BY datetime(actualizado_en) DESC"
  ).all(repartidor.id);

  const configRows = db.prepare("SELECT clave, valor FROM configuracion WHERE clave LIKE 'rider_app_%' OR clave IN ('delivery_requiere_foto_entrega', 'delivery_validacion_activa')").all();
  const settings = Object.fromEntries(configRows.map(r => [r.clave, r.valor]));

  res.json({
    repartidor,
    pedidos: pedidos.map((p) => getPedidoHydratedById(p.id)).filter(Boolean),
    settings,
  });
});

router.put('/:id/rider/:codigo/ubicacion', (req, res) => {
  const repartidor = validateRiderAccess(req, res);
  if (!repartidor) return;

  const { latitud, longitud, precision, velocidad, pedidoId } = req.body;
  
  // Actualizar repartidor
  db.prepare(
    'UPDATE repartidores SET latitud = ?, longitud = ?, ultima_ubicacion_en = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(Number(latitud), Number(longitud), repartidor.id);

  // Si hay un pedido activo, actualizarlo también para el tracking del cliente
  if (pedidoId) {
    db.prepare(
      'UPDATE pedidos SET repartidor_latitud = ?, repartidor_longitud = ?, repartidor_ubicacion_en = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(Number(latitud), Number(longitud), pedidoId);
  }

  // Log historial
  db.prepare(
    'INSERT INTO repartidor_ubicaciones_log (repartidor_id, pedido_id, latitud, longitud, precision, velocidad) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(repartidor.id, pedidoId || null, Number(latitud), Number(longitud), precision || null, velocidad || null);

  const updatedRepartidor = hydrateRepartidor(repartidor.id);
  const io = req.app.get('io');
  if (io) {
    emitRepartidorUbicacion(io, updatedRepartidor, pedidoId);
    if (pedidoId) {
      const pedido = getPedidoHydratedById(pedidoId);
      if (pedido) emitPedidoActualizado(io, pedido);
    }
  }

  res.json({ success: true });
});

router.put('/:id/rider/:codigo/pedido/:pedidoId/estado', (req, res) => {
  const repartidor = validateRiderAccess(req, res);
  if (!repartidor) return;

  const { estado } = req.body;
  const validStates = ['aceptado', 'en_camino', 'incidencia', 'cancelado'];
  if (!validStates.includes(estado)) {
    return res.status(400).json({ error: 'Estado no valido' });
  }

  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ? AND repartidor_id = ?').get(req.params.pedidoId, repartidor.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

  // Si rechaza/cancela, liberar repartidor
  if (estado === 'cancelado') {
    db.prepare('UPDATE repartidores SET disponible = 1 WHERE id = ?').run(repartidor.id);
    db.prepare('UPDATE pedidos SET estado = ?, repartidor_id = NULL, repartidor_nombre = "" WHERE id = ?').run(estado, pedido.id);
  } else {
    db.prepare('UPDATE pedidos SET estado = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?').run(estado, pedido.id);
  }

  const updatedPedido = getPedidoHydratedById(pedido.id);
  const io = req.app.get('io');
  if (io) emitPedidoActualizado(io, updatedPedido);

  res.json(updatedPedido);
});

router.post('/:id/rider/:codigo/entregar/:pedidoId', upload.single('foto'), (req, res) => {
  const repartidor = validateRiderAccess(req, res);
  if (!repartidor) return;

  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ? AND repartidor_id = ?').get(req.params.pedidoId, repartidor.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado para este repartidor' });
  const validacionActiva = db.prepare("SELECT valor FROM configuracion WHERE clave = 'delivery_validacion_activa'").get()?.valor === '1';
  const requiereFoto = db.prepare("SELECT valor FROM configuracion WHERE clave = 'delivery_requiere_foto_entrega'").get()?.valor === '1';
  if (validacionActiva && pedido.entrega_pin && String(req.body?.pin || '').trim() !== String(pedido.entrega_pin)) {
    return res.status(400).json({ error: 'PIN de entrega invalido' });
  }
  if (requiereFoto && !req.file) {
    return res.status(400).json({ error: 'Debes adjuntar una foto de entrega' });
  }

  db.prepare(`
    UPDATE pedidos
    SET estado = 'entregado',
        entrega_foto = COALESCE(NULLIF(?, ''), entrega_foto),
        entrega_foto_en = CASE WHEN ? != '' THEN CURRENT_TIMESTAMP ELSE entrega_foto_en END,
        actualizado_en = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(uploadPathFromFilename(req.file?.filename), uploadPathFromFilename(req.file?.filename), pedido.id);
  db.prepare('UPDATE repartidores SET disponible = 1 WHERE id = ?').run(repartidor.id);

  const updatedPedido = getPedidoHydratedById(pedido.id);
  const updatedRepartidor = hydrateRepartidor(repartidor.id);
  const io = req.app.get('io');
  if (io) {
    emitPedidoActualizado(io, updatedPedido);
    emitRepartidorUbicacion(io, updatedRepartidor);
    clearTrackingToken(pedido.id);
  }

  res.json({
    repartidor: updatedRepartidor,
    pedido: updatedPedido,
  });
});

router.post('/:id/asignar/:pedidoId', auth, requirePermission('delivery.manage'), (req, res) => {
  try {
    const assigned = assignPedidoToRepartidor(db, req.params.pedidoId, req.params.id);
    const pedido = getPedidoHydratedById(assigned.pedido.id);
    const io = req.app.get('io');
    if (io) {
      emitDeliveryAssignment(io, {
        pedido,
        repartidor: getRepartidorById(db, assigned.repartidor.id),
        previousRepartidor: assigned.previousRepartidorId ? getRepartidorById(db, assigned.previousRepartidorId) : null,
      });
    }
    return res.json(pedido);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'No se pudo asignar el repartidor' });
  }
});

router.post('/auto-asignar/:pedidoId', auth, requirePermission('delivery.manage'), (req, res) => {
  try {
    const assigned = autoAssignPedido(db, req.params.pedidoId);
    if (!assigned.ok) {
      return res.status(400).json({ error: 'No hay repartidores disponibles en este momento' });
    }

    const pedido = getPedidoHydratedById(assigned.pedido.id);
    const io = req.app.get('io');
    if (io) {
      emitDeliveryAssignment(io, {
        pedido,
        repartidor: getRepartidorById(db, assigned.repartidor.id),
      });
    }
    return res.json({
      pedido,
      repartidor: hydrateRepartidor(assigned.repartidor.id),
      auto: true,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'No se pudo autoasignar el pedido' });
  }
});

module.exports = router;
