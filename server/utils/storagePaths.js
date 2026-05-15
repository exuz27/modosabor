const fs = require('fs');
const path = require('path');

const serverRoot = path.join(__dirname, '..');
const defaultDataDir = path.join(serverRoot, 'data');
const defaultUploadsDir = path.join(serverRoot, 'uploads');

function resolvePath(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return path.isAbsolute(raw) ? raw : path.resolve(serverRoot, raw);
}

const dataDir = resolvePath(process.env.DATA_DIR, defaultDataDir);
const uploadsDir = resolvePath(process.env.UPLOADS_DIR, defaultUploadsDir);
const backupsDir = resolvePath(process.env.BACKUPS_DIR, path.join(dataDir, 'backups'));
const dbFile = resolvePath(process.env.DB_FILE, path.join(dataDir, 'modosabor.db'));

function ensureDir(target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
}

function ensureStoragePaths() {
  ensureDir(dataDir);
  ensureDir(path.dirname(dbFile));
  ensureDir(uploadsDir);
  ensureDir(backupsDir);
}

function isDirectoryEmpty(target) {
  try {
    return fs.readdirSync(target).length === 0;
  } catch {
    return true;
  }
}

function bootstrapUploadsFromBundle() {
  if (path.resolve(defaultUploadsDir) === path.resolve(uploadsDir)) return false;
  if (!fs.existsSync(defaultUploadsDir)) return false;
  if (!isDirectoryEmpty(uploadsDir)) return false;

  fs.cpSync(defaultUploadsDir, uploadsDir, { recursive: true });
  return true;
}

function uploadPathFromFilename(filename = '') {
  return filename ? `/uploads/${filename}` : '';
}

function uploadPublicPathToFile(publicPath = '') {
  if (!publicPath) return null;
  const normalized = String(publicPath).replace(/\\/g, '/').trim();
  const relative = normalized.startsWith('/uploads/')
    ? normalized.slice('/uploads/'.length)
    : path.basename(normalized);
  return path.join(uploadsDir, relative);
}

module.exports = {
  dataDir,
  uploadsDir,
  backupsDir,
  dbFile,
  ensureDir,
  ensureStoragePaths,
  bootstrapUploadsFromBundle,
  uploadPathFromFilename,
  uploadPublicPathToFile,
};
