// backend/services/cache.service.js
// Simple in-memory TTL cache for frequently-read, rarely-changed data
// (categories, plans). Deliberately not Redis/external — this app runs as
// a single Node process, so an in-memory Map is the right amount of
// complexity. If this ever moves to multiple instances behind a load
// balancer, this would need to become Redis instead (each instance would
// otherwise cache independently and could serve stale data after an edit
// on a different instance).
const store = new Map(); // key -> { value, expiresAt }

const get = (key) => {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { store.delete(key); return undefined; }
  return entry.value;
};

const set = (key, value, ttlMs) => {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const invalidate = (key) => store.delete(key);

// Fetch-through helper: returns the cached value, or calls fetchFn, caches
// the result, and returns it.
const wrap = async (key, ttlMs, fetchFn) => {
  const cached = get(key);
  if (cached !== undefined) return cached;
  const value = await fetchFn();
  set(key, value, ttlMs);
  return value;
};

module.exports = { get, set, invalidate, wrap };
