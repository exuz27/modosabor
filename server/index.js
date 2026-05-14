require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const db = require('./db');
const { startAutomaticBackups } = require('./utils/backupManager');
const { getConfigMap } = require('./utils/mercadoPago');
const { mergeRuntimeConfig, isPrivateNetworkUrl, isPublicHttpsUrl } = require('./utils/runtimeConfig');
const { uploadsDir, ensureStoragePaths } = require('./utils/storagePaths');
const { initSocketSecurity } = require('./utils/socketRooms');
const { isUploadValidationError, formatUploadValidationError } = require('./utils/uploadValidation');

const app = express();
const server = http.createServer(app);

function uniqueOrigins(...values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function buildAllowedOrigins() {
  const configuredOrigins = String(
    process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.92:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const railwayDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
  const railwayUrl = railwayDomain ? `https://${railwayDomain}` : '';

  return uniqueOrigins(
    ...configuredOrigins,
    process.env.PUBLIC_APP_URL,
    process.env.PUBLIC_API_URL,
    process.env.FRONTEND_URL,
    process.env.BACKEND_URL,
    process.env.APP_URL,
    process.env.API_URL,
    railwayUrl,
  );
}

function isMercadoPagoConfigured(tokenValue) {
  const token = String(tokenValue || '').trim();
  if (!token) return false;

  const normalized = token.toLowerCase();
  const placeholders = new Set([
    'admin123',
    'cambia-esta-clave',
    'cambia-esta-clave-inicial',
    'tu-token',
    'token',
  ]);

  if (placeholders.has(normalized)) return false;
  return token.length >= 20;
}

const allowedOrigins = buildAllowedOrigins();
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST', 'PUT', 'DELETE'] },
});

initSocketSecurity(io);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

ensureStoragePaths();
app.use('/uploads', express.static(uploadsDir));

const clientDistDir = path.join(__dirname, '..', 'client', 'dist');
const clientIndexFile = path.join(clientDistDir, 'index.html');

try {
  const productsCount = db.prepare('SELECT COUNT(*) AS total FROM productos').get()?.total || 0;
  if (productsCount === 0) {
    console.log('Base vacia detectada. Cargando menu inicial de Modo Sabor...');
    require('./scripts/seedMenuModoSabor');
  }
} catch (error) {
  console.error('No se pudo cargar el menu inicial automaticamente:', error.message);
}

app.set('io', io);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/pedidos', require('./routes/pedidos'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/configuracion', require('./routes/configuracion'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/repartidores', require('./routes/repartidores'));
app.use('/api/personal', require('./routes/personal'));
app.use('/api/caja', require('./routes/caja'));
app.use('/api/cupones', require('./routes/cupones'));
app.use('/api/marketing', require('./routes/marketing'));
app.use('/api/compras', require('./routes/compras'));
app.use('/api/fidelizacion', require('./routes/fidelizacion'));

if (process.env.NODE_ENV === 'production' && fs.existsSync(clientIndexFile)) {
  app.use(express.static(clientDistDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }

    return res.sendFile(clientIndexFile);
  });
}

app.get('/api/health', (_req, res) => {
  try {
    const config = mergeRuntimeConfig(getConfigMap(db));
    const dbCheck = db.prepare('SELECT 1 AS ok').get();

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      checks: {
        db: dbCheck?.ok === 1,
        publicAppUrl: Boolean(config.public_app_url),
        publicApiUrl: Boolean(config.public_api_url),
        lanAppUrl: Boolean(config.public_app_url) && isPrivateNetworkUrl(config.public_app_url),
        lanApiUrl: Boolean(config.public_api_url) && isPrivateNetworkUrl(config.public_api_url),
        publicHttpsAppUrl: isPublicHttpsUrl(config.public_app_url),
        publicHttpsApiUrl: isPublicHttpsUrl(config.public_api_url),
        mercadoPagoConfigured: isMercadoPagoConfigured(config.mercadopago_token),
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.use((error, _req, res, next) => {
  if (!error) return next();
  if (isUploadValidationError(error)) {
    return res.status(400).json({ error: formatUploadValidationError(error) });
  }
  return next(error);
});

io.on('connection', () => {});

startAutomaticBackups(db);

const PORT = Number(process.env.PORT || 3001);
server.listen(PORT, () => console.log(`Modo Sabor API corriendo en http://localhost:${PORT}`));
