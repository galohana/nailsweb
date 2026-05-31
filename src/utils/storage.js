const PFX = 'bolt_';

export const storage = {
  get: (key, fallback = null) => {
    try {
      const v = localStorage.getItem(PFX + key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set: (key, value) => {
    try { localStorage.setItem(PFX + key, JSON.stringify(value)); } catch {}
  },
  remove: (key) => { localStorage.removeItem(PFX + key); },
};
