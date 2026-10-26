// Temporary browser persistence until sales creation is connected to the backend.
export function readLocalSales(key) {
  try {
    const rows = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(rows)) return [];
    return rows.filter(row => row && ['id', 'code', 'date', 'customer', 'flock'].every(field => typeof row[field] === 'string')
      && ['quantity', 'totalWeight', 'unitPrice', 'totalAmount', 'paidAmount'].every(field => Number.isFinite(row[field])));
  } catch {
    return [];
  }
}

export function saveLocalSales(key, sales) {
  localStorage.setItem(key, JSON.stringify(sales));
}
