/* ==========================================================================
   jordanliebling.dev — The journey driver
   --------------------------------------------------------------------------
   Turns scroll position into time of day. Owns:
     - scroll -> progress (damped), theme -> day/night blend (eased 1.4 s)
     - the CSS custom properties every painted surface reads
     - the `jl:state` event the WebGL scene listens to
     - the WebGL gate (loads js/scene.js only when it makes sense)
     - 3-D pointer tilt, chip tumble-in, CSS fallback leaves
   main.js is untouched: it still owns the ticker, typing and theme toggle.
   ========================================================================== */
(function () {
  'use strict';

  var JL = window.JL || (window.JL = {});
  var timeline = JL.timeline;
  if (!timeline) return;

  var root = document.documentElement;
  function mq(q) { return !!(window.matchMedia && window.matchMedia(q).matches); }
  var reduceMotion = mq('(prefers-reduced-motion: reduce)');
  var coarse = mq('(pointer: coarse)');
  var saveData = !!(navigator.connection && navigator.connection.saveData);

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function hash(i) { var s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  root.classList.add('js-ready');

  /* ------------------------------------------------------------------
   * State
   * ------------------------------------------------------------------ */
  var maxScroll = 1;
  var targetProgress = 0;
  var progress = 0;
  var blendTarget = root.getAttribute('data-theme') === 'dark' ? 1 : 0;
  var blend = blendTarget;
  var blendFrom = blend;
  var blendStart = 0;              // performance.now() when the last toggle happened
  var BLEND_MS = 1400;
  var wind = 0;
  var simTime = 0;
  var lastFrame = 0;
  var running = false;
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var lastVars = {};

  var VAR_MAP = {
    skyTop: '--sky-top', skyMid: '--sky-mid', horizon: '--horizon', sun: '--sun', sunGlow: '--sun-glow', fog: '--fog',
    ink: '--ink', inkMuted: '--ink-muted', panel: '--panel', panelEdge: '--panel-edge', card: '--card',
    accent: '--accent-j', accentHover: '--accent-hover-j',
    tickerBg: '--ticker-bg', tickerText: '--ticker-text', tickerIcon: '--ticker-icon'
  };

  function measure() {
    maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
  }

  function readScroll() {
    var y = window.scrollY || window.pageYOffset || 0;
    targetProgress = clamp01(y / maxScroll);
  }

  function setVar(name, value) {
    if (lastVars[name] === value) return;
    lastVars[name] = value;
    root.style.setProperty(name, value);
  }

  function currentPalette() {
    if (blend <= 0.001) return timeline.sample(progress, 'light');
    if (blend >= 0.999) return timeline.sample(progress, 'dark');
    return timeline.blend(timeline.sample(progress, 'light'), timeline.sample(progress, 'dark'), blend);
  }

  function apply(pal) {
    var k;
    for (k in VAR_MAP) setVar(VAR_MAP[k], pal.hex[k]);
    setVar('--panel-rgb', pal.rgb.panel.map(Math.round).join(', '));
    setVar('--card-rgb', pal.rgb.card.map(Math.round).join(', '));
    setVar('--sun-x', pal.sunX.toFixed(3));
    setVar('--sun-y', pal.sunY.toFixed(3));
    setVar('--journey', progress.toFixed(4));
    setVar('--stars', pal.stars.toFixed(3));
    setVar('--moon', pal.moon.toFixed(3));
    setVar('--night', blend.toFixed(3));
    if (themeMeta) themeMeta.setAttribute('content', pal.hex.panel);
    JL.state = { progress: progress, theme: blend >= 0.5 ? 'night' : 'day', blend: blend, wind: wind, palette: pal };
    try {
      window.dispatchEvent(new CustomEvent('jl:state', { detail: JL.state }));
    } catch (err) { /* very old browsers: the DOM still gets its colours */ }
  }

  /* ------------------------------------------------------------------
   * Frame loop: runs only while something is still settling
   * ------------------------------------------------------------------ */
  function frame(now) {
    var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0.016;
    lastFrame = now;
    simTime += dt;

    if (reduceMotion) {
      progress = targetProgress;
      blend = blendTarget;
    } else {
      progress += (targetProgress - progress) * (1 - Math.exp(-dt * 6));
      if (Math.abs(targetProgress - progress) < 0.0002) progress = targetProgress;
      // The sky blend is clocked, not damped, so the sun sets in the same 1.4 s on any device.
      var bt = blendStart ? Math.min((now - blendStart) / BLEND_MS, 1) : 1;
      bt = bt * bt * (3 - 2 * bt);
      blend = blendFrom + (blendTarget - blendFrom) * bt;
      if (bt >= 1) blend = blendTarget;
    }

    apply(currentPalette());

    var settled = progress === targetProgress && blend === blendTarget;
    if (settled) { running = false; lastFrame = 0; return; }
    requestAnimationFrame(frame);
  }

  function kick() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------
   * Inputs
   * ------------------------------------------------------------------ */
  window.addEventListener('scroll', function () { readScroll(); kick(); }, { passive: true });
  window.addEventListener('resize', function () { measure(); readScroll(); kick(); });
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { measure(); readScroll(); kick(); }).observe(document.body);
  }
  if ('MutationObserver' in window) {
    new MutationObserver(function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 1 : 0;
      if (next === blendTarget) return;
      blendFrom = blend;
      blendTarget = next;
      blendStart = performance.now();
      kick();
    }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* A slow, shared breeze: the chips' hover wobble and the 3-D leaves lean the same way. */
  var windTimer = null;
  function tickWind() {
    var t = Date.now() / 1000;
    wind = Math.sin(t * 0.22) * 0.7 + Math.sin(t * 0.61 + 1.3) * 0.3;
    setVar('--wind-x', wind.toFixed(3));
    if (JL.state) JL.state.wind = wind;
  }
  if (!reduceMotion) {
    tickWind();
    windTimer = setInterval(function () { if (!document.hidden) tickWind(); }, 400);
  } else {
    setVar('--wind-x', '0');
  }

  measure();
  readScroll();
  progress = targetProgress;
  apply(currentPalette());

  /* ------------------------------------------------------------------
   * 3-D pointer tilt (fine pointers only; reading surfaces stay still)
   * ------------------------------------------------------------------ */
  if (!coarse && !reduceMotion) {
    var tiltEls = document.querySelectorAll('.hero__photo, .about__card, .project-card');
    Array.prototype.forEach.call(tiltEls, function (el) {
      var maxX = el.classList.contains('hero__photo') ? 4 : 5;
      var maxY = el.classList.contains('hero__photo') ? 6 : 6;
      var raf = null, px = 0, py = 0;
      function write() {
        raf = null;
        el.style.setProperty('--rx', (-py * maxX).toFixed(2) + 'deg');
        el.style.setProperty('--ry', (px * maxY).toFixed(2) + 'deg');
        el.style.setProperty('--mx', ((px + 1) * 50).toFixed(1) + '%');
        el.style.setProperty('--my', ((py + 1) * 50).toFixed(1) + '%');
      }
      el.addEventListener('pointerenter', function () { el.classList.add('is-tilting'); });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        px = ((e.clientX - r.left) / r.width) * 2 - 1;
        py = ((e.clientY - r.top) / r.height) * 2 - 1;
        if (!raf) raf = requestAnimationFrame(write);
      });
      el.addEventListener('pointerleave', function () {
        el.classList.remove('is-tilting');
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ------------------------------------------------------------------
   * Tech-stack chips tumble in like leaves (own observer; main.js's is untouched)
   * ------------------------------------------------------------------ */
  var stackItems = document.querySelector('.stack__items');
  if (stackItems) {
    var chips = stackItems.querySelectorAll('.stack__item');
    Array.prototype.forEach.call(chips, function (chip, i) {
      chip.style.setProperty('--i', String(i));
      chip.style.setProperty('--r', ((hash(i) - 0.5) * 28).toFixed(1) + 'deg');
    });
    if ('IntersectionObserver' in window && !reduceMotion) {
      var chipObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            stackItems.classList.add('stack__items--in');
            chipObserver.disconnect();
          }
        });
      }, { threshold: 0.15 });
      chipObserver.observe(stackItems);
    } else {
      stackItems.classList.add('stack__items--in');
    }
  }

  /* ------------------------------------------------------------------
   * WebGL gate -> painted landscape, or the CSS/SVG fallback
   * ------------------------------------------------------------------ */
  function webglAvailable() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2');          // three r180 requires WebGL2
      if (!gl) return false;
      var ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();              // free the probe context
      return true;
    } catch (err) { return false; }
  }

  function fallback() {
    root.classList.remove('has-webgl');
    root.classList.add('no-webgl');
    root.setAttribute('data-scene', 'css');
    var holder = document.querySelector('.leaves');
    if (!holder || reduceMotion) return;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 10; i++) {
      var leaf = document.createElement('span');
      leaf.className = 'leaf';
      leaf.style.setProperty('--x', (hash(i + 50) * 100).toFixed(1) + '%');
      leaf.style.setProperty('--s', (12 + hash(i + 60) * 12).toFixed(0) + 'px');
      leaf.style.setProperty('--d', (14 + hash(i + 70) * 8).toFixed(1) + 's');
      leaf.style.setProperty('--delay', (-hash(i + 80) * 20).toFixed(1) + 's');
      leaf.style.setProperty('--c', timeline.FOLIAGE[Math.floor(hash(i + 90) * timeline.FOLIAGE.length)]);
      frag.appendChild(leaf);
    }
    holder.appendChild(frag);
    holder.classList.add('leaves--on');
  }

  var canvas = document.getElementById('scene-canvas');
  // The inline <script type="module"> in index.html imports js/scene.js when this is true;
  // browsers without module support never run it and simply keep the CSS painting.
  JL.wantsWebGL = !!canvas && !reduceMotion && !saveData && webglAvailable() &&
    ('noModule' in HTMLScriptElement.prototype) && location.protocol !== 'file:';
  if (!JL.wantsWebGL) fallback();

  JL.journey = {
    get progress() { return progress; },
    get blend() { return blend; },
    get wind() { return wind; },
    refresh: function () { measure(); readScroll(); kick(); },
    fallback: fallback
  };
})();
