const crypto = require('crypto');

function cleanText(value) {
  return String(value || '').trim();
}

function generateAccessCode() {
  return crypto.randomBytes(4).toString('hex');
}

function ensureUniqueAccessCode(db, currentCode = '', excludeId = null) {
  const normalized = cleanText(currentCode);
  if (normalized) {
    const existing = excludeId
      ? db.prepare('SELECT id FROM repartidores WHERE codigo_acceso = ? AND id != ?').get(normalized, excludeId)
      : db.prepare('SELECT id FROM repartidores WHERE codigo_acceso = ?').get(normalized);
    if (!existing) return normalized;
  }

  let nextCode = '';
  do {
    nextCode = generateAccessCode();
  } while (db.prepare('SELECT id FROM repartidores WHERE codigo_acceso = ?').get(nextCode));

  return nextCode;
}

function findLinkedRepartidor(db, personal) {
  if (!personal) return null;

  if (personal.id) {
    const linked = db.prepare('SELECT * FROM repartidores WHERE personal_id = ?').get(personal.id);
    if (linked) return linked;
  }

  const phone = cleanText(personal.telefono);
  if (phone) {
    const byPhone = db.prepare('SELECT * FROM repartidores WHERE telefono = ? ORDER BY id ASC').get(phone);
    if (byPhone) return byPhone;
  }

  const name = cleanText(personal.nombre);
  if (name) {
    return db.prepare('SELECT * FROM repartidores WHERE nombre = ? ORDER BY id ASC').get(name) || null;
  }

  return null;
}

function syncDeliveryRepartidor(db, personal) {
  if (!personal) return null;

  const isDelivery = cleanText(personal.rol_operativo).toLowerCase() === 'delivery';
  const linked = findLinkedRepartidor(db, personal);

  if (!isDelivery) {
    if (linked) {
      db.prepare(`
        UPDATE repartidores
        SET activo = 0,
            disponible = 0,
            personal_id = ?
        WHERE id = ?
      `).run(personal.id || null, linked.id);
      return db.prepare('SELECT * FROM repartidores WHERE id = ?').get(linked.id);
    }
    return null;
  }

  const payload = {
    nombre: cleanText(personal.nombre),
    telefono: cleanText(personal.telefono),
    direccion: cleanText(personal.direccion),
    avatar_url: cleanText(personal.avatar_url),
    notas: cleanText(personal.notas),
    fecha_ingreso: cleanText(personal.fecha_ingreso),
    activo: Number(personal.activo) === 0 ? 0 : 1,
  };

  if (linked) {
    const codigo = ensureUniqueAccessCode(db, linked.codigo_acceso, linked.id);
    db.prepare(`
      UPDATE repartidores
      SET personal_id = ?,
          nombre = ?,
          telefono = ?,
          direccion = ?,
          avatar_url = ?,
          notas = ?,
          fecha_ingreso = ?,
          codigo_acceso = ?,
          activo = ?,
          disponible = CASE WHEN ? = 1 THEN disponible ELSE 0 END
      WHERE id = ?
    `).run(
      personal.id,
      payload.nombre || linked.nombre,
      payload.telefono,
      payload.direccion,
      payload.avatar_url,
      payload.notas,
      payload.fecha_ingreso,
      codigo,
      payload.activo,
      payload.activo,
      linked.id
    );
    return db.prepare('SELECT * FROM repartidores WHERE id = ?').get(linked.id);
  }

  const codigo = ensureUniqueAccessCode(db);
  const result = db.prepare(`
    INSERT INTO repartidores (
      personal_id, nombre, telefono, vehiculo, activo, disponible,
      codigo_acceso, zona_preferida, direccion, avatar_url, notas, fecha_ingreso
    ) VALUES (?, ?, ?, '', ?, ?, ?, '', ?, ?, ?, ?)
  `).run(
    personal.id,
    payload.nombre || `Delivery ${personal.id}`,
    payload.telefono,
    payload.activo,
    payload.activo,
    codigo,
    payload.direccion,
    payload.avatar_url,
    payload.notas,
    payload.fecha_ingreso
  );

  return db.prepare('SELECT * FROM repartidores WHERE id = ?').get(result.lastInsertRowid);
}

function syncAllDeliveryPersonnel(db) {
  const personalRows = db.prepare('SELECT * FROM personal').all();
  personalRows.forEach((row) => syncDeliveryRepartidor(db, row));

  const orphanRows = db.prepare(`
    SELECT r.id
    FROM repartidores r
    LEFT JOIN personal p ON p.id = r.personal_id
    WHERE r.personal_id IS NOT NULL AND p.id IS NULL
  `).all();

  orphanRows.forEach((row) => {
    db.prepare('UPDATE repartidores SET activo = 0, disponible = 0 WHERE id = ?').run(row.id);
  });
}

module.exports = {
  syncDeliveryRepartidor,
  syncAllDeliveryPersonnel,
};
