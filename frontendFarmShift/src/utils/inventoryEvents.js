export const INVENTORY_CHANGED = 'farmshift:inventory-changed';
export const notifyInventoryChanged = () => {
  window.dispatchEvent(new Event(INVENTORY_CHANGED));
  try { localStorage.setItem(INVENTORY_CHANGED, `${Date.now()}-${Math.random()}`); } catch { /* Same-tab refresh remains available. */ }
};

