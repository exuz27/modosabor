export function parseLocalizedAmount(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') return defaultValue;
  if (typeof value === 'number') return Number.isFinite(value) ? value : defaultValue;

  let raw = String(value || '').trim();
  if (!raw) return defaultValue;

  raw = raw.replace(/\s+/g, '').replace(/\$/g, '');

  const hasDot = raw.includes('.');
  const hasComma = raw.includes(',');

  if (hasDot && hasComma) {
    const lastDot = raw.lastIndexOf('.');
    const lastComma = raw.lastIndexOf(',');
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';

    raw = raw.split(thousandsSeparator).join('');
    if (decimalSeparator === ',') {
      raw = raw.replace(',', '.');
    }
  } else if (hasDot || hasComma) {
    const separator = hasDot ? '.' : ',';
    const parts = raw.split(separator).filter((part) => part !== '');

    if (parts.length > 2) {
      raw = parts.join('');
    } else if (parts.length === 2) {
      const [integerPart, decimalPart] = parts;
      if (decimalPart.length === 3) {
        raw = `${integerPart}${decimalPart}`;
      } else {
        raw = `${integerPart}.${decimalPart}`;
      }
    }
  }

  raw = raw.replace(/[^0-9.-]/g, '');

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function formatAmountForInput(value) {
  const parsed = parseLocalizedAmount(value, 0);
  if (!Number.isFinite(parsed) || parsed === 0) {
    return value === '' ? '' : '0';
  }

  const isWhole = Math.abs(parsed % 1) < 0.000001;
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(parsed);
}

export function formatAmountPreview(value) {
  return `$${formatAmountForInput(value || 0)}`;
}
