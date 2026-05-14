const DEFAULT_JWT_SECRET = 'modosabor_jwt_2024';

function isProduction() {
  return String(process.env.NODE_ENV || '').trim() === 'production';
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();

  if (secret) {
    if (isProduction() && secret === DEFAULT_JWT_SECRET) {
      throw new Error('JWT_SECRET no puede usar el valor por defecto en produccion');
    }
    return secret;
  }

  if (isProduction()) {
    throw new Error('Falta JWT_SECRET en produccion');
  }

  return DEFAULT_JWT_SECRET;
}

module.exports = {
  DEFAULT_JWT_SECRET,
  getJwtSecret,
  isProduction,
};
