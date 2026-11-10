/* ==========================================================================
   Drive — shared math / noise helpers
   ========================================================================== */

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential approach of `cur` toward `target`. */
export function damp(cur, target, rate, dt) {
  return target + (cur - target) * Math.exp(-rate * dt);
}

/** Small, fast seeded PRNG — the road and scenery must be identical every run. */
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer lattice hash → [0, 1). */
export function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Value noise in [0, 1]. */
export function vnoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal value noise in roughly [0, 1]. */
export function fbm(x, y, octaves = 4) {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x, y);
    norm += amp;
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 9.7;
    amp *= 0.5;
  }
  return sum / norm;
}

/** Smooth minimum that never exceeds either input (a, b > 0). */
export function softMin(a, b) {
  if (b > a * 40) return a;
  const p = 3;
  return (a * b) / Math.pow(Math.pow(a, p) + Math.pow(b, p), 1 / p);
}

/** Rounded-rectangle path (ctx.roundRect isn't in every browser that can run the scene). */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Speeds are simulated in m/s; the UI follows the visitor's locale. */
export const IMPERIAL = (() => {
  try {
    const lang = (navigator.language || 'en-US').toUpperCase();
    return /-(US|GB|LR|MM)\b/.test(lang) || lang === 'EN';
  } catch (e) {
    return true;
  }
})();

export const UNITS = IMPERIAL
  ? { speed: 'mph', dist: 'mi', perMs: 2.2369363, perM: 1 / 1609.344, shortDist: 'ft', shortPerM: 3.28084 }
  : { speed: 'km/h', dist: 'km', perMs: 3.6, perM: 1 / 1000, shortDist: 'm', shortPerM: 1 };

export function fmtSpeed(ms) {
  return Math.round(ms * UNITS.perMs);
}

export function fmtDist(m, digits = 2) {
  return (m * UNITS.perM).toFixed(digits);
}

export function fmtTime(sec) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
}
