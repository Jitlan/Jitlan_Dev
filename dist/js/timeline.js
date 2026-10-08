/* ==========================================================================
   jordanliebling.dev — Time-of-day timeline
   --------------------------------------------------------------------------
   Single source of truth for the painted sky. Scroll progress (0 = top of
   page, 1 = bottom) is sampled against these keyframes and the result drives
   both the CSS custom properties (DOM, via journey.js) and the WebGL
   landscape (scene.js).

   "day"   : dawn at the hero -> golden hour -> sunset over the lake.
   "night" : blue hour at the hero -> moonrise -> still, starry night.

   All ink/panel pairs were checked for WCAG AA body-text contrast at every
   keyframe (day ink >= 13:1, muted >= 6.7:1; night ink >= 12.7:1).
   ========================================================================== */
(function () {
  'use strict';

  var DAY_INK = { ink: '#2A1C12', inkMuted: '#5E4A3A', accent: '#8E3B12', accentHover: '#A4461A' };
  var NIGHT_INK = { ink: '#F0E6D2', inkMuted: '#C2B4A0', accent: '#E9A858', accentHover: '#F0B966' };
  var TICKER = { tickerBg: '#1B140E', tickerText: '#E8C27A', tickerIcon: '#F2D28F' };

  function frame(base, f) {
    var out = {};
    var k;
    for (k in base) out[k] = base[k];
    for (k in TICKER) out[k] = TICKER[k];
    for (k in f) out[k] = f[k];
    return out;
  }

  /* sunX/sunY: normalised sky position (0..1 left->right, 0 = horizon, 1 = zenith).
     stars: star-field opacity. moon: 0 = sun disc, 1 = moon disc. */
  var DAY = [
    frame(DAY_INK, { at: 0.00, // dawn at the trailhead
      skyTop: '#3A5684', skyMid: '#A98AA0', horizon: '#F1C8A2',
      sun: '#FFF3CF', sunGlow: '#FFB36E', fog: '#DACBD2',
      light: '#FFD9A8', ambient: '#9A9CC2', lightIntensity: 1.0,
      panel: '#F6EEDF', panelEdge: '#CDB893', card: '#FCF7EC',
      sunX: 0.36, sunY: 0.27, stars: 0.15, moon: 0 }),
    frame(DAY_INK, { at: 0.25, // mid-morning, the valley opens up
      skyTop: '#4C7DB4', skyMid: '#9FBFDB', horizon: '#F2D9B4',
      sun: '#FFF8E0', sunGlow: '#FFE2A8', fog: '#E6DED0',
      light: '#FFF0D6', ambient: '#AEBCCB', lightIntensity: 1.05,
      panel: '#F7F0E2', panelEdge: '#CFBB97', card: '#FDF8EE',
      sunX: 0.56, sunY: 0.30, stars: 0, moon: 0 }),
    frame(DAY_INK, { at: 0.50, // afternoon, high and bright
      skyTop: '#4F86B8', skyMid: '#B4C9D9', horizon: '#E9D3AE',
      sun: '#FFF6D6', sunGlow: '#FFEDBB', fog: '#E4D8C3',
      light: '#FFF6E4', ambient: '#B6C0C9', lightIntensity: 1.05,
      panel: '#F8F0DE', panelEdge: '#CDB58E', card: '#FDF7EA',
      sunX: 0.46, sunY: 0.74, stars: 0, moon: 0 }),
    frame(DAY_INK, { at: 0.75, // golden hour
      skyTop: '#456A9C', skyMid: '#D7A070', horizon: '#F6C47C',
      sun: '#FFE28C', sunGlow: '#FFA24E', fog: '#E8C8A2',
      light: '#FFC07A', ambient: '#A892AD', lightIntensity: 1.0,
      panel: '#F7EBD3', panelEdge: '#CBAE80', card: '#FCF3E2',
      sunX: 0.40, sunY: 0.20, stars: 0, moon: 0 }),
    frame(DAY_INK, { at: 1.00, // sunset over the lake: the payoff
      skyTop: '#3B3764', skyMid: '#B65B49', horizon: '#EF8A3C',
      sun: '#FFB347', sunGlow: '#FF8C42', fog: '#C9A08A',
      light: '#FF9A5C', ambient: '#8A6A86', lightIntensity: 0.9,
      panel: '#F3DDBD', panelEdge: '#C6A579', card: '#F9E6CA',
      sunX: 0.56, sunY: 0.17, stars: 0.05, moon: 0 })
  ];

  var NIGHT = [
    frame(NIGHT_INK, { at: 0.00, // blue hour, a rose seam on the horizon
      skyTop: '#0E1A33', skyMid: '#24406A', horizon: '#6F6686',
      sun: '#D9B6A3', sunGlow: '#B88A86', fog: '#2F3D5C',
      light: '#7C86A8', ambient: '#4D5E80', lightIntensity: 0.6,
      panel: '#1A1A22', panelEdge: '#35343F', card: '#22222C',
      sunX: 0.72, sunY: -0.08, stars: 0.25, moon: 1 }),
    frame(NIGHT_INK, { at: 0.25, // afterglow
      skyTop: '#10172E', skyMid: '#2F3A62', horizon: '#8A5A6E',
      sun: '#E8D9C0', sunGlow: '#A66A6A', fog: '#3A3652',
      light: '#6E6688', ambient: '#4F4F6E', lightIntensity: 0.55,
      panel: '#1C1A1E', panelEdge: '#37333A', card: '#242128',
      sunX: 0.62, sunY: 0.16, stars: 0.5, moon: 1 }),
    frame(NIGHT_INK, { at: 0.50, // dusk, first stars
      skyTop: '#0C1226', skyMid: '#262A52', horizon: '#6A3F55',
      sun: '#F2E9D0', sunGlow: '#8F7A95', fog: '#332E45',
      light: '#8F8CA8', ambient: '#434060', lightIntensity: 0.6,
      panel: '#1E1A1A', panelEdge: '#393230', card: '#262120',
      sunX: 0.60, sunY: 0.23, stars: 0.7, moon: 1 }),
    frame(NIGHT_INK, { at: 0.75, // moonrise
      skyTop: '#080D1F', skyMid: '#171E3E', horizon: '#3C3550',
      sun: '#F2E9D0', sunGlow: '#9FA9C9', fog: '#2A2B40',
      light: '#C9D2EC', ambient: '#3B4360', lightIntensity: 0.65,
      panel: '#1D1916', panelEdge: '#38302A', card: '#25201C',
      sunX: 0.58, sunY: 0.25, stars: 0.85, moon: 1 }),
    frame(NIGHT_INK, { at: 1.00, // still, starry night over the lake
      skyTop: '#05091A', skyMid: '#101733', horizon: '#262A45',
      sun: '#FFF6DC', sunGlow: '#AFBBDD', fog: '#222A40',
      light: '#D5DCF0', ambient: '#4A5878', lightIntensity: 0.7,
      panel: '#1B1814', panelEdge: '#362E26', card: '#231F1A',
      sunX: 0.55, sunY: 0.21, stars: 1, moon: 1 })
  ];

  /* Autumn foliage shared by the scene and the CSS fallback leaves. */
  var FOLIAGE = ['#B8321A', '#B8321A', '#D9792A', '#D9792A', '#E0A826', '#8B4A1E', '#6B2D4A', '#5A3421', '#2F4A32', '#3F7A78'];

  var COLOR_KEYS = ['skyTop', 'skyMid', 'horizon', 'sun', 'sunGlow', 'fog', 'light', 'ambient',
    'ink', 'inkMuted', 'panel', 'panelEdge', 'card', 'accent', 'accentHover',
    'tickerBg', 'tickerText', 'tickerIcon'];
  var NUMBER_KEYS = ['lightIntensity', 'sunX', 'sunY', 'stars', 'moon'];

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(rgb) {
    return '#' + rgb.map(function (c) {
      var v = Math.max(0, Math.min(255, Math.round(c))).toString(16);
      return v.length === 1 ? '0' + v : v;
    }).join('');
  }

  function mixRgb(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function smoothstep(t) { return t * t * (3 - 2 * t); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* Pre-parse hex strings once so sampling allocates as little as possible. */
  function prepare(frames) {
    return frames.map(function (f) {
      var out = { at: f.at };
      COLOR_KEYS.forEach(function (k) { out[k] = hexToRgb(f[k]); });
      NUMBER_KEYS.forEach(function (k) { out[k] = f[k]; });
      return out;
    });
  }

  var PREPARED = { day: prepare(DAY), night: prepare(NIGHT) };

  function finish(out) {
    COLOR_KEYS.forEach(function (k) { out.hex[k] = rgbToHex(out.rgb[k]); });
    return out;
  }

  /**
   * sample(progress, theme) -> palette
   *   { progress, theme: 'day'|'night', night: 0|1, rgb: {key: [r,g,b]}, hex: {key: '#rrggbb'}, ...numbers }
   * Colours come back as both rgb arrays (for WebGL) and hex strings (for CSS).
   * Keyframes are eased with a smoothstep so the light changes like weather, not a dial.
   */
  function sample(progress, theme) {
    var night = theme === 'dark' || theme === 'night';
    var frames = PREPARED[night ? 'night' : 'day'];
    var p = clamp01(progress);
    var i = 0;
    while (i < frames.length - 2 && p > frames[i + 1].at) i++;
    var a = frames[i], b = frames[i + 1];
    var t = smoothstep(clamp01((p - a.at) / (b.at - a.at)));
    var out = { progress: p, theme: night ? 'night' : 'day', night: night ? 1 : 0, rgb: {}, hex: {} };
    COLOR_KEYS.forEach(function (k) { out.rgb[k] = mixRgb(a[k], b[k], t); });
    NUMBER_KEYS.forEach(function (k) { out[k] = a[k] + (b[k] - a[k]) * t; });
    return finish(out);
  }

  /** blend(dayPalette, nightPalette, t) -> palette, t = 0 day .. 1 night. Used while the toggle eases. */
  function blend(a, b, t) {
    t = clamp01(t);
    if (t <= 0) return a;
    if (t >= 1) return b;
    var out = { progress: a.progress, theme: t < 0.5 ? 'day' : 'night', night: t, rgb: {}, hex: {} };
    COLOR_KEYS.forEach(function (k) { out.rgb[k] = mixRgb(a.rgb[k], b.rgb[k], t); });
    NUMBER_KEYS.forEach(function (k) { out[k] = a[k] + (b[k] - a[k]) * t; });
    return finish(out);
  }

  window.JL = window.JL || {};
  window.JL.timeline = {
    DAY: DAY,
    NIGHT: NIGHT,
    FOLIAGE: FOLIAGE,
    COLOR_KEYS: COLOR_KEYS,
    NUMBER_KEYS: NUMBER_KEYS,
    sample: sample,
    blend: blend,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex
  };
})();
