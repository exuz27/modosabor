export function normalizePedidoItems(rawItems) {
  if (Array.isArray(rawItems)) {
    return rawItems;
  }

  if (!rawItems) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawItems);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
