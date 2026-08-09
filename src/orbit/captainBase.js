// Orbit Module — Captain Base store (current / home / work + favorites), localStorage-backed.
const KEY = 'spnx_orbit_captain_base_v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { home: null, work: null, favorites: [] }; }
  catch { return { home: null, work: null, favorites: [] }; }
}

function write(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

export function getCaptainBase() { return read(); }

export function setBasePoint(slot, point) {
  const state = read();
  if (slot === 'home' || slot === 'work') state[slot] = point;
  return write(state);
}

export function addFavorite(point) {
  const state = read();
  state.favorites = [...(state.favorites || []), { ...point, id: `fav_${Date.now()}` }].slice(-20);
  return write(state);
}

export function removeFavorite(id) {
  const state = read();
  state.favorites = (state.favorites || []).filter((f) => f.id !== id);
  return write(state);
}
