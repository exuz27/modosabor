const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbFile = path.join(__dirname, 'server', 'data', 'modosabor.db');
const db = new DatabaseSync(dbFile);

try {
  const users = db.prepare('SELECT id, nombre, email, rol, activo FROM usuarios').all();
  console.log('Users in DB:', JSON.stringify(users, null, 2));
} catch (error) {
  console.error('Error reading usuarios table:', error.message);
}
