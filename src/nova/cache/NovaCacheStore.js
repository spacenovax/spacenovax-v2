const PREFIX = 'spnx:nova:cache:v1';

export function normalizeNOVAQuestion(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export class NovaCacheStore {
  constructor(namespace = 'default') {
    this.namespace = namespace;
    this.memory = new Map();
  }

  key(kind, key) {
    return `${PREFIX}:${this.namespace}:${kind}:${normalizeNOVAQuestion(key)}`;
  }

  get(kind, key) {
    const cacheKey = this.key(kind, key);
    const memory = this.memory.get(cacheKey);
    if (memory) return memory;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      this.memory.set(cacheKey, parsed.value);
      return parsed.value;
    } catch { return null; }
  }

  set(kind, key, value, ttlMs = 7 * 24 * 60 * 60 * 1000) {
    const cacheKey = this.key(kind, key);
    this.memory.set(cacheKey, value);
    try { localStorage.setItem(cacheKey, JSON.stringify({ value, expiresAt: Date.now() + ttlMs })); } catch {}
    return value;
  }
}
