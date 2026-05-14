const http = require('http');
const bcrypt = require('bcryptjs');
const db = require('../db');

const PORT = Number(process.env.PORT || 3001);
const BASE_URL = `http://127.0.0.1:${PORT}/api`;
const TEST_EMAIL = 'system-check@modosabor.local';
const TEST_PASSWORD = 'SystemCheck123!';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null,
          });
        } catch {
          resolve({
            status: res.statusCode,
            body: data,
          });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function ensureSystemCheckUser() {
  const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(TEST_EMAIL);
  const hash = bcrypt.hashSync(TEST_PASSWORD, 10);

  if (existing) {
    db.prepare('UPDATE usuarios SET nombre = ?, password_hash = ?, rol = ?, activo = 1 WHERE id = ?')
      .run('System Check', hash, 'admin', existing.id);
    return existing.id;
  }

  const created = db.prepare(
    'INSERT INTO usuarios (nombre, email, password_hash, rol, activo) VALUES (?, ?, ?, ?, 1)'
  ).run('System Check', TEST_EMAIL, hash, 'admin');
  return created.lastInsertRowid;
}

function cleanupSystemCheckUser(userId) {
  if (!userId) return;
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(userId);
}

async function run() {
  console.log('Iniciando verificacion core...');
  const testUserId = ensureSystemCheckUser();

  try {
    const login = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    if (login.status !== 200 || !login.body?.token) {
      throw new Error(`Login admin de prueba fallo con status ${login.status}`);
    }

    const token = login.body.token;
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const checks = [
      ['auth/me', '/auth/me'],
      ['pedidos', '/pedidos?limit=5'],
      ['inventario', '/inventario/insumos'],
      ['repartidores', '/repartidores'],
      ['reportes dashboard', '/reportes/dashboard'],
    ];

    for (const [label, path] of checks) {
      const response = await request(path, { headers: authHeaders });
      if (response.status !== 200) {
        throw new Error(`Chequeo ${label} fallo con status ${response.status}`);
      }
      console.log(`OK: ${label}`);
    }

    console.log('Verificacion core completada.');
  } finally {
    cleanupSystemCheckUser(testUserId);
  }
}

run().catch((error) => {
  console.error('ERROR:', error.message || error);
  process.exitCode = 1;
});
