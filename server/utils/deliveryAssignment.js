function listAvailableRepartidores(db) {
  return db.prepare(`
    SELECT
      r.*,
      COALESCE(active.active_orders, 0) AS active_orders,
      history.last_assigned_at
    FROM repartidores r
    LEFT JOIN (
      SELECT repartidor_id, COUNT(*) AS active_orders
      FROM pedidos
      WHERE estado = 'en_camino'
      GROUP BY repartidor_id
    ) active ON active.repartidor_id = r.id
    LEFT JOIN (
      SELECT repartidor_id, MAX(actualizado_en) AS last_assigned_at
      FROM pedidos
      WHERE tipo_entrega = 'delivery' AND repartidor_id IS NOT NULL
      GROUP BY repartidor_id
    ) history ON history.repartidor_id = r.id
    WHERE r.activo = 1 AND r.disponible = 1
    ORDER BY
      COALESCE(active.active_orders, 0) ASC,
      CASE WHEN history.last_assigned_at IS NULL THEN 0 ELSE 1 END ASC,
      datetime(history.last_assigned_at) ASC,
      datetime(r.creado_en) ASC,
      r.id ASC
  `).all();
}

function normalizeZone(value) {
  return String(value || '').trim().toLowerCase();
}

function getPedidoById(db, pedidoId) {
  return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
}

function getRepartidorById(db, repartidorId) {
  return repartidorId ? db.prepare('SELECT * FROM repartidores WHERE id = ?').get(repartidorId) : null;
}

function pickBestAvailableRepartidor(db, pedido = null) {
  const targetZone = normalizeZone(pedido?.delivery_zona);
  const disponibles = listAvailableRepartidores(db)
    .map((repartidor) => {
      const preferredZone = normalizeZone(repartidor.zona_preferida);
      const lastPingAt = repartidor.ultima_ubicacion_en ? new Date(repartidor.ultima_ubicacion_en).getTime() : 0;
      return {
        ...repartidor,
        _score: [
          targetZone && preferredZone && targetZone === preferredZone ? 0 : 1,
          Number(repartidor.active_orders || 0),
          lastPingAt ? -lastPingAt : Number.MAX_SAFE_INTEGER,
        ],
      };
    })
    .sort((a, b) => {
      for (let index = 0; index < a._score.length; index += 1) {
        if (a._score[index] !== b._score[index]) return a._score[index] - b._score[index];
      }
      return Number(a.id) - Number(b.id);
    });
  return disponibles[0] || null;
}

function assignPedidoToRepartidor(db, pedidoId, repartidorId, options = {}) {
  const pedido = getPedidoById(db, pedidoId);
  if (!pedido) throw new Error('Pedido no encontrado');
  if (pedido.tipo_entrega !== 'delivery') throw new Error('Solo se puede asignar repartidor a pedidos delivery');
  if (['entregado', 'cancelado'].includes(pedido.estado)) throw new Error('El pedido ya no admite asignacion');

  const repartidor = getRepartidorById(db, repartidorId);
  if (!repartidor || !repartidor.activo) throw new Error('Repartidor no encontrado');
  if (!repartidor.disponible && Number(pedido.repartidor_id || 0) !== Number(repartidor.id)) {
    throw new Error('Ese repartidor no esta disponible');
  }

  const previousRepartidorId = Number(pedido.repartidor_id || 0);
  const previousRepartidor = previousRepartidorId && previousRepartidorId !== Number(repartidor.id)
    ? getRepartidorById(db, previousRepartidorId)
    : null;
  if (previousRepartidorId && previousRepartidorId !== Number(repartidor.id)) {
    db.prepare('UPDATE repartidores SET disponible = 1 WHERE id = ?').run(previousRepartidorId);
  }

  const nextState = options.markEnCamino ? 'en_camino' : pedido.estado;

  db.prepare(`
    UPDATE pedidos
    SET repartidor_id = ?, repartidor_nombre = ?, estado = ?, actualizado_en = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(repartidor.id, repartidor.nombre, nextState, pedido.id);

  db.prepare('UPDATE repartidores SET disponible = 0 WHERE id = ?').run(repartidor.id);

  return {
    pedido: getPedidoById(db, pedido.id),
    repartidor: getRepartidorById(db, repartidor.id),
    previousRepartidor,
    previousRepartidorId: previousRepartidorId || null,
  };
}

function autoAssignPedido(db, pedidoId, options = {}) {
  const pedido = getPedidoById(db, pedidoId);
  const disponibles = listAvailableRepartidores(db);
  if (options.onlyIfSingleAvailable && disponibles.length !== 1) {
    return {
      ok: false,
      reason: disponibles.length === 0 ? 'no_available_repartidor' : 'multiple_available_repartidores',
      repartidor: null,
      pedido,
    };
  }

  const repartidor = options.onlyIfSingleAvailable
    ? (disponibles[0] || null)
    : pickBestAvailableRepartidor(db, pedido);
  if (!repartidor) {
    return {
      ok: false,
      reason: 'no_available_repartidor',
      repartidor: null,
      pedido,
    };
  }

  const result = assignPedidoToRepartidor(db, pedidoId, repartidor.id, options);
  return {
    ok: true,
    ...result,
    autoAssigned: true,
  };
}

module.exports = {
  listAvailableRepartidores,
  pickBestAvailableRepartidor,
  getPedidoById,
  getRepartidorById,
  assignPedidoToRepartidor,
  autoAssignPedido,
};
