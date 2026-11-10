/* ==========================================================================
   Drive — the café at the end of the road
   --------------------------------------------------------------------------
   Five quick stations, one verb ("hold, then let go at the right moment"),
   and a free-pour finale:

     grind 18 g → tamp 30 lb → pull 36 g in ~27 s → steam to 140°F → pour

   Mistakes carry forward the way they do on a real bar: an under-dosed or
   lightly tamped puck runs fast. The last station is a small fluid toy —
   milk pushed into crema on a grid — so the latte art on the cortado is
   whatever you actually poured.
   ========================================================================== */

import { IMPERIAL, TAU, clamp, fbm, lerp, roundRect, smoothstep } from './util.js';

const W = 720;
const H = 405;
const SHOT_RATE = 4.4; // shot-seconds per real second: a 27 s pull takes about six

const TARGET = { dose: 18, tamp: 30, yield: 36, time: 27.5, milk: 60 };

const C = {
  steel: '#cfd4d8',
  steelMid: '#99a1a7',
  steelDark: '#565e64',
  black: '#14171a',
  wood: '#5c3b22',
  woodDark: '#3a2414',
  coffee: '#2c180c',
  grounds: '#3b2212',
  crema: '#c08a4a',
  milk: '#f5ecdc',
  amber: '#ffb454',
  cyan: '#7fe3ff',
  green: '#6fdc8c',
};

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

const fmtTemp = (c) => (IMPERIAL ? Math.round(c * 1.8 + 32) + '°F' : Math.round(c) + '°C');
const fmtTamp = (lb) => (IMPERIAL ? Math.round(lb) + ' lb' : (lb * 0.4536).toFixed(1) + ' kg');

function grade(score) {
  return score >= 0.9 ? 'spot on' : score >= 0.7 ? 'close' : score >= 0.4 ? 'drinkable' : 'rough';
}

/* ==========================================================================
   Latte-art surface
   ========================================================================== */
class Pour {
  constructor(n) {
    this.n = n;
    this.foam = new Float32Array(n * n); // 0 crema … 1 microfoam
    this.crema = new Float32Array(n * n); // crema tone, for the marbling
    this.f2 = new Float32Array(n * n);
    this.c2 = new Float32Array(n * n);
    this.wall = new Float32Array(n * n); // how freely the surface moves; 0 at the glass
    this.inside = new Uint8Array(n * n);
    this.rg = n / 2 - 2;
    this.px = n * 2; // drawn at twice the simulation resolution so the milk's edge is a smooth contour
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.px;
    this.ctx = this.canvas.getContext('2d');
    this.image = this.ctx.createImageData(this.px, this.px);
    this.reset();
  }

  reset() {
    const n = this.n;
    const c = (n - 1) / 2;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const q = j * n + i;
        const dx = i - c;
        const dy = j - c;
        const r = Math.hypot(dx, dy) / this.rg;
        this.inside[q] = r <= 1 ? 1 : 0;
        this.wall[q] = Math.max(0, 1 - Math.pow(r, 6));
        this.foam[q] = 0;
        // tiger-striped crema, darker toward the rim
        const swirl = fbm(i * 0.035 + dy * 0.02, j * 0.06 - dx * 0.02, 4);
        this.crema[q] = clamp(0.25 + 0.7 * swirl - 0.18 * r * r, 0, 1);
      }
    }
    this.fill = 0;
    this.dirty = true;
  }

  /**
   * Pour for dt seconds at (px, py) in grid cells, the spout moving at (vx, vy) cells/s.
   * `art` is false while the milk is still diving under the crema.
   */
  step(dt, px, py, vx, vy, art) {
    const n = this.n;
    const { foam, crema, f2, c2, wall, inside } = this;
    const k1 = n / 168; // the constants below were tuned on a 168-cell grid
    const k2 = k1 * k1;
    const A = 430 * k2 * dt; // source strength: how hard new milk shoves the surface outward
    const R0 = 40 * k2;
    const drag = 0.9 * dt; // the stream also drags the surface along with it
    const DRAG_R2 = 2 * 13 * 13 * k2;
    const max = n - 1.001;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const q = j * n + i;
        if (!inside[q]) continue;
        const dx = i - px;
        const dy = j - py;
        const r2 = dx * dx + dy * dy;
        const k = A / (r2 + R0);
        const g = drag * Math.exp(-r2 / DRAG_R2);
        const w = wall[q];
        // trace back to where this bit of surface came from
        let sx = i - (dx * k + vx * g) * w;
        let sy = j - (dy * k + vy * g) * w;
        sx = sx < 0 ? 0 : sx > max ? max : sx;
        sy = sy < 0 ? 0 : sy > max ? max : sy;
        const x0 = sx | 0;
        const y0 = sy | 0;
        const tx = sx - x0;
        const ty = sy - y0;
        const a = y0 * n + x0;
        const b = a + n;
        const w00 = (1 - tx) * (1 - ty);
        const w10 = tx * (1 - ty);
        const w01 = (1 - tx) * ty;
        const w11 = tx * ty;
        let f = foam[a] * w00 + foam[a + 1] * w10 + foam[b] * w01 + foam[b + 1] * w11;
        c2[q] = crema[a] * w00 + crema[a + 1] * w10 + crema[b] * w01 + crema[b + 1] * w11;
        // keep the milk/crema boundary crisp instead of letting resampling smear it
        f += 3.2 * dt * (f - 0.45) * f * (1 - f) * 4;
        f2[q] = f < 0 ? 0 : f > 1 ? 1 : f;
      }
    }
    this.foam = f2;
    this.f2 = foam;
    this.crema = c2;
    this.c2 = crema;

    // new milk arriving at the spout: under the crema at first, on top of it once the glass is filling.
    // It goes down like a fine brush: a steady hand leaves a line, a quick flick a fainter one.
    const speed = Math.hypot(vx, vy) / k1;
    const lay = art ? 8 * dt * (1 - 0.5 * smoothstep(90, 330, speed)) : 0.3 * dt;
    const R = Math.ceil(9 * k1);
    const SIG2 = 2 * 3.1 * 3.1 * k2;
    const x0 = Math.max(0, Math.floor(px - R));
    const x1 = Math.min(n - 1, Math.ceil(px + R));
    const y0 = Math.max(0, Math.floor(py - R));
    const y1 = Math.min(n - 1, Math.ceil(py + R));
    for (let j = y0; j <= y1; j++) {
      for (let i = x0; i <= x1; i++) {
        const q = j * n + i;
        if (!inside[q]) continue;
        const d2 = (i - px) * (i - px) + (j - py) * (j - py);
        const gss = Math.exp(-d2 / SIG2);
        this.foam[q] = Math.min(1, this.foam[q] + lay * gss);
        if (!art) this.crema[q] = Math.min(1, this.crema[q] + 1.3 * dt * gss);
      }
    }
    this.dirty = true;
  }

  /** Paint the surface into the off-screen canvas. */
  render() {
    if (!this.dirty) return this.canvas;
    this.dirty = false;
    const n = this.n;
    const m = this.px;
    const d = this.image.data;
    const { foam, crema } = this;
    const c = (m - 1) / 2;
    const r2max = (this.rg * 2 + 1) * (this.rg * 2 + 1);
    const lim = n - 1.001;
    for (let y = 0, o = 0; y < m; y++) {
      const sy = Math.min(lim, Math.max(0, (y - 0.5) / 2));
      const y0 = sy | 0;
      const ty = sy - y0;
      for (let x = 0; x < m; x++, o += 4) {
        const dx = x - c;
        const dy = y - c;
        if (dx * dx + dy * dy > r2max) {
          d[o + 3] = 0;
          continue;
        }
        const sx = Math.min(lim, Math.max(0, (x - 0.5) / 2));
        const x0 = sx | 0;
        const tx = sx - x0;
        const a = y0 * n + x0;
        const b = a + n;
        const w00 = (1 - tx) * (1 - ty);
        const w10 = tx * (1 - ty);
        const w01 = (1 - tx) * ty;
        const w11 = tx * ty;
        const F = foam[a] * w00 + foam[a + 1] * w10 + foam[b] * w01 + foam[b + 1] * w11;
        const cr = crema[a] * w00 + crema[a + 1] * w10 + crema[b] * w01 + crema[b + 1] * w11;
        const f = smoothstep(0.4, 0.6, F);
        // the thin dark line crema leaves where it's been pushed up against the milk
        const rim = 1 - 0.26 * Math.exp(-((F - 0.36) * (F - 0.36)) / 0.008);
        d[o] = lerp(lerp(98, 196, cr), 248, f) * rim;
        d[o + 1] = lerp(lerp(54, 140, cr), 238, f) * rim;
        d[o + 2] = lerp(lerp(22, 72, cr), 222, f) * rim;
        d[o + 3] = 255;
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
    return this.canvas;
  }

  /** 0…1: is this something a barista would send out? Rewards symmetry, sensible coverage, crisp edges. */
  score() {
    const n = this.n;
    const { foam, inside } = this;
    const c = (n - 1) / 2;
    let cells = 0;
    let white = 0;
    let crisp = 0;
    let mx = 0;
    let my = 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const q = j * n + i;
        if (!inside[q]) continue;
        cells++;
        const f = foam[q];
        if (f > 0.5) {
          white++;
          mx += i - c;
          my += j - c;
        }
        if (f < 0.15 || f > 0.85) crisp++;
      }
    }
    if (white < cells * 0.02) return 0.05;
    const coverage = white / cells;
    mx /= white;
    my /= white;
    // best mirror symmetry over a handful of axes through the pattern's centre of mass
    let best = 0;
    for (let a = 0; a < 6; a++) {
      const th = (a * Math.PI) / 6;
      const ax = Math.cos(th);
      const ay = Math.sin(th);
      let diff = 0;
      let sum = 0;
      for (let j = 0; j < n; j += 2) {
        for (let i = 0; i < n; i += 2) {
          const q = j * n + i;
          if (!inside[q]) continue;
          const x = i - c - mx;
          const y = j - c - my;
          const dotp = x * ax + y * ay;
          const rx = Math.round(2 * dotp * ax - x + c + mx);
          const ry = Math.round(2 * dotp * ay - y + c + my);
          const m = rx >= 0 && ry >= 0 && rx < n && ry < n && inside[ry * n + rx] ? foam[ry * n + rx] : 0;
          diff += Math.abs(foam[q] - m);
          sum += foam[q] + m;
        }
      }
      best = Math.max(best, 1 - diff / Math.max(1, sum));
    }
    const cover = 1 - clamp(Math.abs(coverage - 0.36) / 0.3, 0, 1);
    const centred = 1 - clamp(Math.hypot(mx, my) / (this.rg * 0.6), 0, 1);
    return clamp(0.46 * best + 0.24 * cover + 0.16 * (crisp / cells) + 0.14 * centred, 0, 1);
  }
}

/* ==========================================================================
   The mini-game
   ========================================================================== */
export class Cafe {
  /**
   * @param {HTMLElement} parent
   * @param {{onDone:(result:object)=>void, onSkip:()=>void}} hooks
   */
  constructor(parent, hooks) {
    this.hooks = hooks;
    this.active = false;
    this.hold = false;
    this.keyHold = false;
    this.arrow = { x: 0, y: 0 };
    this.t = 0;
    this._build(parent);
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.pour = new Pour(coarse ? 128 : 168);
    this.beans = Array.from({ length: 46 }, (_, i) => [0.5 + 0.5 * Math.sin(i * 12.9898) * Math.cos(i * 4.1), (i * 0.6180339) % 1, (i * 0.7548) % 1]);
  }

  _build(parent) {
    const root = (this.root = el('div', 'cafe'));
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'cafe-title');
    root.innerHTML = `
      <header class="cafe__head">
        <span class="cafe__kicker">CORTADO PASS CAFÉ</span>
        <span class="cafe__steps" aria-hidden="true">${'<i></i>'.repeat(5)}</span>
      </header>
      <h2 class="cafe__title" id="cafe-title"></h2>
      <p class="cafe__hint" aria-live="polite"></p>
      <div class="cafe__stage"><canvas class="cafe__canvas" width="${W}" height="${H}"></canvas></div>
      <div class="cafe__meter" aria-hidden="true"><i class="cafe__zone"></i><i class="cafe__fill"></i><b class="cafe__read"></b></div>
      <ul class="cafe__chips"></ul>
      <button type="button" class="cafe__skip">Skip the coffee</button>`;
    parent.appendChild(root);
    const q = (s) => root.querySelector(s);
    this.$title = q('.cafe__title');
    this.$hint = q('.cafe__hint');
    this.$stage = q('.cafe__stage');
    this.canvas = q('.cafe__canvas');
    this.ctx = this.canvas.getContext('2d');
    this.$meter = q('.cafe__meter');
    this.$zone = q('.cafe__zone');
    this.$fill = q('.cafe__fill');
    this.$read = q('.cafe__read');
    this.$chips = q('.cafe__chips');
    this.$steps = Array.from(root.querySelectorAll('.cafe__steps i'));
    q('.cafe__skip').addEventListener('click', () => {
      this.close();
      this.hooks.onSkip();
    });

    const st = this.$stage;
    const at = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * this.w;
      this.pointer.y = ((e.clientY - r.top) / r.height) * this.h;
      this.pointer.seen = true;
    };
    this.w = W;
    this.h = H;
    this.pointer = { x: W / 2, y: H / 2, seen: false };
    st.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      at(e);
      this.hold = true;
      try {
        st.setPointerCapture(e.pointerId);
      } catch (err) {
        /* fine */
      }
    });
    st.addEventListener('pointermove', at);
    const up = () => {
      this.hold = false;
    };
    st.addEventListener('pointerup', up);
    st.addEventListener('pointercancel', up);
    st.addEventListener('lostpointercapture', up);
    st.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ----------------------------------------------------------- lifecycle */
  open() {
    this.active = true;
    this.root.hidden = false;
    this.hold = this.keyHold = false;
    this.t = 0;
    this.result = { dose: 0, tamp: 0, yield: 0, time: 0, milk: 0 };
    this.scores = { dose: 0, tamp: 0, shot: 0, milk: 0, art: 0 };
    this.$chips.innerHTML = '';
    this.pour.reset();
    this._enter(0);
  }

  close() {
    this.active = false;
    this.root.hidden = true;
    this.hold = this.keyHold = false;
  }

  /** Keyboard: Space/Enter hold, arrows steer the pitcher. */
  key(code, down) {
    if (code === 'Space' || code === 'Enter' || code === 'KeyW' || (code === 'ArrowUp' && this.stage !== 4)) {
      this.keyHold = down;
      return true;
    }
    const v = down ? 1 : 0;
    if (code === 'ArrowLeft') this.arrow.x = -v;
    else if (code === 'ArrowRight') this.arrow.x = v;
    else if (code === 'ArrowUp') this.arrow.y = -v;
    else if (code === 'ArrowDown') this.arrow.y = v;
    else return false;
    return true;
  }

  _enter(i) {
    this.stage = i;
    this.phase = 'play'; // play → shown (a beat to read the result) → next
    this.pt = 0;
    this.v = 0; // the stage's main quantity
    this.idle = 0;
    this.heldFor = 0;
    this.touched = false;
    this.heat = 0;
    this.shotT = 0;
    // on a narrow screen the pour gets a square canvas so the glass is big enough to draw in
    const square = i === 4 && this.root.clientWidth < 560;
    this.w = square ? 420 : W;
    this.h = square ? 420 : H;
    if (this.canvas.width !== this.w || this.canvas.height !== this.h) {
      this.canvas.width = this.w;
      this.canvas.height = this.h;
    }
    this.px = this.w / 2;
    this.py = this.h / 2 - 4;
    this.pointer.seen = false;
    this.pvx = this.pvy = 0;
    this.pouring = false;
    const flow = clamp(1 + (TARGET.dose - this.result.dose) * 0.07 + (TARGET.tamp - this.result.tamp) * 0.012, 0.65, 1.5);
    this.flow = flow;
    const S = [
      { title: 'Grind', hint: 'Hold to grind. Let go at 18 g.', max: 26, lo: 17.5, hi: 18.5 },
      { title: 'Tamp', hint: `Press and hold. Let go at ${fmtTamp(TARGET.tamp)}.`, max: 60, lo: 27, hi: 33 },
      { title: 'Pull the shot', hint: 'Hold to brew. Let go at 36 g — about 27 seconds.', max: 60, lo: 34, hi: 38 },
      { title: 'Steam the milk', hint: `Hold to steam. Let go just before ${fmtTemp(TARGET.milk)} — it keeps climbing.`, max: 85, lo: 57, hi: 63 },
      { title: 'Pour the cortado', hint: 'Hold and move to pour. Fill the base, then draw.', max: 1, lo: 0.4, hi: 1 },
    ][i];
    this.def = S;
    this.$title.textContent = S.title;
    this.$hint.textContent = S.hint;
    this.$zone.style.left = (S.lo / S.max) * 100 + '%';
    this.$zone.style.width = ((S.hi - S.lo) / S.max) * 100 + '%';
    this.$meter.classList.toggle('is-pour', i === 4);
    this.$steps.forEach((n, k) => (n.className = k < i ? 'is-done' : k === i ? 'is-on' : ''));
  }

  _chip(label, value, score) {
    const li = el('li', score >= 0.7 ? 'is-good' : score >= 0.4 ? 'is-ok' : 'is-bad');
    li.innerHTML = `<span>${label}</span><b>${value}</b><em>${grade(score)}</em>`;
    this.$chips.appendChild(li);
  }

  _finishStage() {
    const r = this.result;
    const s = this.scores;
    const i = this.stage;
    if (i === 0) {
      r.dose = this.v;
      s.dose = clamp(1 - Math.abs(this.v - TARGET.dose) / 3.2, 0, 1);
      this._chip('Dose', this.v.toFixed(1) + ' g', s.dose);
    } else if (i === 1) {
      r.tamp = this.v;
      s.tamp = clamp(1 - Math.abs(this.v - TARGET.tamp) / 14, 0, 1);
      this._chip('Tamp', fmtTamp(this.v), s.tamp);
    } else if (i === 2) {
      r.yield = this.v;
      r.time = this.shotT;
      s.shot = 0.7 * clamp(1 - Math.abs(this.v - TARGET.yield) / 9, 0, 1) + 0.3 * clamp(1 - Math.max(0, Math.abs(this.shotT - TARGET.time) - 2.5) / 8, 0, 1);
      this._chip('Shot', `${this.v.toFixed(1)} g · ${this.shotT.toFixed(0)} s`, s.shot);
    } else if (i === 3) {
      r.milk = this.v;
      s.milk = clamp(1 - Math.abs(this.v - TARGET.milk) / 14, 0, 1);
      this._chip('Milk', fmtTemp(this.v), s.milk);
    } else {
      s.art = this.pour.score();
      this._chip('Latte art', Math.round(s.art * 100) + '/100', s.art);
    }
    this.phase = 'shown';
    this.pt = 0;
  }

  _complete() {
    const s = this.scores;
    const total = Math.round((0.14 * s.dose + 0.1 * s.tamp + 0.26 * s.shot + 0.2 * s.milk + 0.3 * s.art) * 100);
    // a clean portrait of the finished drink for the result card
    const size = 320;
    const out = document.createElement('canvas');
    out.width = out.height = size;
    const g = out.getContext('2d');
    this._drawCup(g, size / 2, size / 2, size * 0.42, false);
    let image = '';
    try {
      image = out.toDataURL('image/png');
    } catch (e) {
      /* no image, the numbers still stand */
    }
    const result = { total, scores: { ...s }, values: { ...this.result }, image };
    this.close();
    this.hooks.onDone(result);
  }

  /* -------------------------------------------------------------- update */
  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const held = this.hold || this.keyHold;
    if (this.phase === 'shown') {
      this.pt += dt;
      if (this.pt > (this.stage === 4 ? 1.7 : 0.95)) {
        if (this.stage === 4) this._complete();
        else this._enter(this.stage + 1);
      }
    } else {
      this._play(dt, held);
    }
    if (this.active) this._draw(held && this.phase === 'play');
  }

  _play(dt, held) {
    const i = this.stage;
    if (held) {
      this.touched = true;
      this.heldFor += dt;
      this.idle = 0;
    } else if (this.touched) {
      this.idle += dt;
    }
    let read = '';
    let frac = 0;
    if (i === 0) {
      if (held) this.v = Math.min(26, this.v + 5.4 * dt);
      if ((this.touched && !held && this.idle > 0.85 && this.v > 1) || this.v >= 26) this._finishStage();
      read = this.v.toFixed(1) + ' g';
      frac = this.v / 26;
    } else if (i === 1) {
      if (held) this.v = Math.min(60, this.v + (16 + 34 * this.heldFor) * dt);
      if ((this.touched && !held && this.v > 2) || this.v >= 60) this._finishStage();
      read = fmtTamp(this.v);
      frac = this.v / 60;
    } else if (i === 2) {
      if (held) {
        this.shotT += SHOT_RATE * dt;
        if (this.shotT > 5) this.v = Math.min(60, this.v + this.flow * (0.7 + 1.15 * smoothstep(5, 15, this.shotT)) * SHOT_RATE * dt);
      }
      if ((this.touched && !held && this.shotT > 2) || this.v >= 60) this._finishStage();
      read = `${this.v.toFixed(1)} g · ${this.shotT.toFixed(0)} s`;
      frac = this.v / 60;
    } else if (i === 3) {
      if (this.v === 0) this.v = 5;
      this.heat = held ? 1 : this.heat * Math.exp(-dt / 0.35);
      this.v = Math.min(85, this.v + 12 * this.heat * dt);
      if ((this.touched && !held && this.heat < 0.05 && this.v > 12) || this.v >= 85) this._finishStage();
      read = fmtTemp(this.v);
      frac = this.v / 85;
    } else {
      this._playPour(dt, held);
      read = this.pour.fill < 0.4 ? 'base' : 'art';
      frac = this.pour.fill;
    }
    this.$fill.style.width = clamp(frac, 0, 1) * 100 + '%';
    this.$read.textContent = read;
  }

  _playPour(dt, held) {
    const cup = this._cup();
    // pointer if there is one, arrow keys otherwise
    let tx = this.px;
    let ty = this.py;
    if (this.arrow.x || this.arrow.y) {
      tx += this.arrow.x * 190 * dt;
      ty += this.arrow.y * 190 * dt;
      this.pointer.seen = false;
    } else if (this.pointer.seen) {
      tx = this.pointer.x;
      ty = this.pointer.y;
    }
    // keep the spout over the glass
    const dx = tx - cup.x;
    const dy = ty - cup.y;
    const d = Math.hypot(dx, dy);
    const lim = cup.r * 0.9;
    if (d > lim) {
      tx = cup.x + (dx / d) * lim;
      ty = cup.y + (dy / d) * lim;
    }
    const vx = (tx - this.px) / Math.max(dt, 1e-3);
    const vy = (ty - this.py) / Math.max(dt, 1e-3);
    this.pvx = lerp(this.pvx, vx, 0.35);
    this.pvy = lerp(this.pvy, vy, 0.35);
    this.px = tx;
    this.py = ty;
    this.pouring = held;
    if (!held) return;
    const p = this.pour;
    const k = p.rg / cup.r; // canvas pixels → grid cells
    const c = (p.n - 1) / 2;
    p.step(dt, c + (this.px - cup.x) * k, c + (this.py - cup.y) * k, this.pvx * k, this.pvy * k, p.fill >= 0.4);
    p.fill = Math.min(1, p.fill + dt / 5.2);
    if (p.fill >= 1) {
      this.pouring = false;
      this._finishStage();
    }
  }

  _cup() {
    return { x: this.w / 2, y: this.h / 2 + 2, r: Math.min(this.w, this.h) * 0.385 };
  }

  /* ---------------------------------------------------------------- draw */
  _draw(live) {
    const g = this.ctx;
    const W = this.w;
    const H = this.h;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    // wall and counter
    const wall = g.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#16222a');
    wall.addColorStop(1, '#0d151a');
    g.fillStyle = wall;
    g.fillRect(0, 0, W, H);
    if (this.stage !== 4) {
      const wood = g.createLinearGradient(0, 300, 0, H);
      wood.addColorStop(0, '#6a452a');
      wood.addColorStop(0.08, C.wood);
      wood.addColorStop(1, C.woodDark);
      g.fillStyle = wood;
      g.fillRect(0, 300, W, H - 300);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 30; x < W; x += 118) g.fillRect(x, 304, 1, H);
    }
    [this._drawGrind, this._drawTamp, this._drawPull, this._drawSteam, this._drawPourStage][this.stage].call(this, g, live);
  }

  _steel(g, x0, y0, x1, y1) {
    const s = g.createLinearGradient(x0, y0, x1, y1);
    s.addColorStop(0, '#e2e6e9');
    s.addColorStop(0.45, C.steelMid);
    s.addColorStop(1, C.steelDark);
    return s;
  }

  _lcd(g, x, y, w, text) {
    g.fillStyle = '#0a0f12';
    g.beginPath();
    roundRect(g, x, y, w, 40, 6);
    g.fill();
    g.strokeStyle = 'rgba(127,227,255,0.35)';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = C.cyan;
    g.font = '700 22px "JetBrains Mono", ui-monospace, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, x + w / 2, y + 21);
  }

  _dial(g, x, y, r, frac, lo, hi, label) {
    g.fillStyle = '#0b1013';
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = this._steel(g, x - r, y - r, x + r, y + r);
    g.stroke();
    const a0 = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    g.lineWidth = r * 0.14;
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.beginPath();
    g.arc(x, y, r * 0.74, a0, a0 + sweep);
    g.stroke();
    g.strokeStyle = C.green;
    g.beginPath();
    g.arc(x, y, r * 0.74, a0 + sweep * lo, a0 + sweep * hi);
    g.stroke();
    const a = a0 + sweep * clamp(frac, 0, 1);
    g.strokeStyle = '#ff6a3c';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - Math.cos(a) * r * 0.12, y - Math.sin(a) * r * 0.12);
    g.lineTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78);
    g.stroke();
    g.lineCap = 'butt';
    g.fillStyle = '#d7dde1';
    g.font = `600 ${Math.round(r * 0.26)}px Inter, Helvetica, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, x, y + r * 0.46);
  }

  _portafilter(g, x, y, w) {
    // basket with a wooden handle running off to the right
    g.fillStyle = '#4a2c18';
    g.beginPath();
    roundRect(g, x + w / 2 - 4, y + 5, 132, 18, 9);
    g.fill();
    g.fillStyle = this._steel(g, x - w / 2, y, x + w / 2, y + 30);
    g.beginPath();
    roundRect(g, x - w / 2, y, w, 30, 6);
    g.fill();
  }

  _drawGrind(g, live) {
    const shake = live ? Math.sin(this.t * 90) * 1.2 : 0;
    const dose = this.v;
    g.save();
    g.translate(shake, 0);
    // hopper full of beans
    g.fillStyle = 'rgba(210,225,235,0.14)';
    g.beginPath();
    g.moveTo(208, 58);
    g.lineTo(312, 58);
    g.lineTo(294, 150);
    g.lineTo(226, 150);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(220,235,245,0.45)';
    g.lineWidth = 2;
    g.stroke();
    g.save();
    g.clip();
    const level = 72 + (dose / 26) * 30;
    for (const [bx, by, br] of this.beans) {
      const y = level + by * (150 - level);
      g.fillStyle = br > 0.5 ? '#4b2a15' : '#3a2010';
      g.beginPath();
      g.ellipse(214 + bx * 92, y, 8, 5.5, br * 3, 0, TAU);
      g.fill();
    }
    g.restore();
    g.fillStyle = C.black;
    g.fillRect(204, 50, 112, 10);
    // body
    g.fillStyle = this._steel(g, 200, 150, 320, 300);
    g.beginPath();
    roundRect(g, 200, 150, 120, 150, 14);
    g.fill();
    g.fillStyle = C.black;
    g.beginPath();
    roundRect(g, 216, 172, 88, 44, 8);
    g.fill();
    g.fillStyle = live ? C.amber : '#5b4a2e';
    g.beginPath();
    g.arc(260, 252, 9, 0, TAU);
    g.fill();
    // chute
    g.fillStyle = C.steelDark;
    g.beginPath();
    g.moveTo(312, 206);
    g.lineTo(372, 236);
    g.lineTo(366, 250);
    g.lineTo(312, 232);
    g.closePath();
    g.fill();
    g.restore();

    // grounds piling up in the basket
    const h = Math.min(1.35, dose / TARGET.dose) * 24;
    g.fillStyle = C.grounds;
    g.beginPath();
    g.ellipse(412, 263, 44, h, 0, Math.PI, TAU);
    g.fill();
    if (dose > 20.5) {
      g.fillRect(360, 262, 6, 4);
      g.fillRect(458, 262, 7, 4);
      for (let k = 0; k < 9; k++) g.fillRect(352 + ((k * 37) % 124), 292 + ((k * 13) % 6), 3, 3);
    }
    this._portafilter(g, 412, 262, 100);
    if (live) {
      g.fillStyle = '#5a361d';
      for (let k = 0; k < 16; k++) {
        const u = (this.t * 3.1 + k * 0.137) % 1;
        g.fillRect(370 + u * 40 + Math.sin(k * 7 + this.t * 20) * 3, 246 + u * (16 - h) + k % 3, 2.5, 2.5);
      }
    }
    // scale
    g.fillStyle = C.black;
    g.beginPath();
    roundRect(g, 340, 292, 150, 12, 4);
    g.fill();
    this._lcd(g, 520, 236, 120, dose.toFixed(1) + ' g');
  }

  _drawTamp(g, live) {
    const p = this.v;
    const squash = clamp(p / 30, 0, 1.4) * 9;
    const top = 232 + squash;
    // basket, cut away
    g.fillStyle = this._steel(g, 236, 214, 484, 300);
    g.beginPath();
    roundRect(g, 236, 214, 248, 88, 12);
    g.fill();
    g.fillStyle = '#0c1114';
    g.beginPath();
    roundRect(g, 252, 206, 216, 84, 6);
    g.fill();
    g.fillStyle = C.grounds;
    g.fillRect(252, top, 216, 290 - top);
    g.fillStyle = '#4a2c18';
    for (let k = 0; k < 40; k++) g.fillRect(256 + ((k * 53) % 208), top + 3 + ((k * 29) % Math.max(4, 286 - top - 4)), 2, 2);
    // handle
    g.fillStyle = '#4a2c18';
    g.beginPath();
    roundRect(g, 480, 246, 150, 20, 10);
    g.fill();
    // tamper: hovers until pressed, then rides the puck down
    const hover = this.touched ? 0 : 26 + Math.sin(this.t * 3) * 3;
    const ty = top - hover;
    g.fillStyle = this._steel(g, 254, ty - 20, 466, ty);
    g.beginPath();
    roundRect(g, 254, ty - 20, 212, 20, 4);
    g.fill();
    g.fillStyle = C.steelMid;
    g.fillRect(346, ty - 62, 28, 44);
    g.fillStyle = '#6b4226';
    g.beginPath();
    roundRect(g, 318, ty - 112, 84, 56, 26);
    g.fill();
    if (live) {
      g.strokeStyle = 'rgba(255,180,84,0.8)';
      g.lineWidth = 3;
      for (const x of [300, 420]) {
        g.beginPath();
        g.moveTo(x, ty - 150);
        g.lineTo(x, ty - 126);
        g.lineTo(x - 7, ty - 134);
        g.moveTo(x, ty - 126);
        g.lineTo(x + 7, ty - 134);
        g.stroke();
      }
    }
    const wobble = live ? Math.sin(this.t * 37) * 0.012 : 0;
    this._dial(g, 606, 130, 62, p / 60 + wobble, 27 / 60, 33 / 60, fmtTamp(p));
  }

  _machine(g, pumping, group = true) {
    g.fillStyle = this._steel(g, 110, 14, 610, 140);
    g.beginPath();
    roundRect(g, 110, 14, 500, 126, 18);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(110, 122, 500, 18);
    this._dial(g, 190, 76, 38, pumping ? 0.6 + Math.sin(this.t * 30) * 0.01 : 0.02, 0.55, 0.66, 'bar');
    if (!group) return;
    g.fillStyle = C.steelDark;
    g.beginPath();
    roundRect(g, 304, 138, 112, 40, 8);
    g.fill();
  }

  _glass(g, x, yTop, yBot, wTop, wBot, liquid, crema) {
    const hw = (y) => lerp(wTop, wBot, (y - yTop) / (yBot - yTop)) / 2;
    if (liquid > 0) {
      const ly = yBot - liquid * (yBot - yTop);
      g.fillStyle = C.coffee;
      g.beginPath();
      g.moveTo(x - hw(ly), ly);
      g.lineTo(x + hw(ly), ly);
      g.lineTo(x + hw(yBot) - 2, yBot - 2);
      g.lineTo(x - hw(yBot) + 2, yBot - 2);
      g.closePath();
      g.fill();
      const ch = Math.min(crema, yBot - ly);
      g.fillStyle = C.crema;
      g.beginPath();
      g.moveTo(x - hw(ly), ly);
      g.lineTo(x + hw(ly), ly);
      g.lineTo(x + hw(ly + ch), ly + ch);
      g.lineTo(x - hw(ly + ch), ly + ch);
      g.closePath();
      g.fill();
    }
    // the glass itself: thick base, faceted lower half
    g.strokeStyle = 'rgba(235,245,250,0.6)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x - wTop / 2, yTop);
    g.lineTo(x - wBot / 2, yBot);
    g.lineTo(x + wBot / 2, yBot);
    g.lineTo(x + wTop / 2, yTop);
    g.stroke();
    g.strokeStyle = 'rgba(235,245,250,0.22)';
    g.lineWidth = 1.5;
    const mid = lerp(yTop, yBot, 0.45);
    for (let k = -2; k <= 2; k++) {
      g.beginPath();
      g.moveTo(x + k * hw(mid) * 0.42, mid);
      g.lineTo(x + k * hw(yBot) * 0.42, yBot);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(x - hw(mid), mid);
    g.lineTo(x + hw(mid), mid);
    g.stroke();
  }

  _drawPull(g, live) {
    const y = this.v;
    const flowing = live && this.shotT > 5;
    this._machine(g, live);
    this._lcd(g, 468, 56, 118, this.shotT.toFixed(1) + ' s');
    // portafilter locked in, spouts underneath
    this._portafilter(g, 360, 178, 124);
    g.fillStyle = C.steelDark;
    g.fillRect(340, 206, 10, 12);
    g.fillRect(370, 206, 10, 12);
    // drip tray
    g.fillStyle = C.black;
    g.beginPath();
    roundRect(g, 236, 296, 250, 12, 4);
    g.fill();
    const liquid = clamp(y / 40, 0, 1.45) * 0.42;
    const yTop = 232;
    const yBot = 296;
    if (flowing) {
      // the stream starts dark and syrupy and goes blond as the shot runs out
      const blond = smoothstep(18, 44, y);
      g.strokeStyle = `rgb(${Math.round(lerp(64, 205, blond))},${Math.round(lerp(34, 150, blond))},${Math.round(lerp(14, 78, blond))})`;
      g.lineWidth = 2.5 + this.flow;
      const end = yBot - liquid * (yBot - yTop);
      for (const sx of [345, 375]) {
        g.beginPath();
        g.moveTo(sx, 218);
        g.quadraticCurveTo(sx + Math.sin(this.t * 14 + sx) * 1.5, (218 + end) / 2, sx + (360 - sx) * 0.35, end);
        g.stroke();
      }
    }
    this._glass(g, 360, yTop, yBot, 92, 68, liquid, 4 + clamp(y / 36, 0, 1) * 7);
    this._lcd(g, 510, 250, 120, y.toFixed(1) + ' g');
    if (live && !flowing) {
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.font = '600 13px "JetBrains Mono", ui-monospace, monospace';
      g.textAlign = 'center';
      g.fillText('pre-infusion…', 360, 226);
    }
  }

  _drawSteam(g, live) {
    this._machine(g, false, false);
    const T = this.v || 5;
    const rise = smoothstep(5, 60, T) * 16;
    // pitcher
    g.fillStyle = this._steel(g, 290, 160, 440, 300);
    g.beginPath();
    g.moveTo(304, 166);
    g.lineTo(280, 150); // spout
    g.lineTo(312, 158);
    g.lineTo(418, 158);
    g.lineTo(428, 300);
    g.lineTo(294, 300);
    g.closePath();
    g.fill();
    g.strokeStyle = this._steel(g, 420, 180, 480, 270);
    g.lineWidth = 9;
    g.beginPath();
    g.arc(410, 228, 40, -1.1, 1.1);
    g.stroke();
    // milk, seen through the mouth: rising and spinning as it stretches
    const my = 176 - rise * 0.5;
    g.fillStyle = C.milk;
    g.beginPath();
    g.ellipse(364, my, 52, 13, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(190,170,140,0.75)';
    g.lineWidth = 1.5;
    const spin = live ? this.t * 9 : this.t * 0.6;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.ellipse(364, my, 40 - k * 12, 10 - k * 3, 0, spin + k * 2.1, spin + k * 2.1 + 2.2);
      g.stroke();
    }
    // steam wand
    g.strokeStyle = this._steel(g, 250, 120, 350, 190);
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(258, 132);
    g.lineTo(342, my + 2);
    g.stroke();
    g.lineCap = 'butt';
    if (live || this.heat > 0.1) {
      for (let k = 0; k < 7; k++) {
        const u = (this.t * 0.9 + k / 7) % 1;
        g.fillStyle = `rgba(255,255,255,${0.22 * (1 - u) * Math.max(this.heat, live ? 1 : 0)})`;
        g.beginPath();
        g.arc(364 + Math.sin(k * 3 + this.t * 2) * 26, my - 8 - u * 120, 10 + u * 22, 0, TAU);
        g.fill();
      }
    }
    const scald = T > 70;
    this._dial(g, 570, 226, 60, T / 85, 57 / 85, 63 / 85, fmtTemp(T));
    if (scald) {
      g.fillStyle = '#ff6a3c';
      g.font = '700 14px "JetBrains Mono", ui-monospace, monospace';
      g.textAlign = 'center';
      g.fillText('SCALDING', 570, 306);
    }
  }

  /** The cortado from above. `chrome` adds the fill ring and pitcher for the live stage. */
  _drawCup(g, x, y, r, chrome) {
    // saucerless, the way a cortado comes: a short, thick-walled glass on the counter
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(x + r * 0.06, y + r * 0.08, r * 1.06, r * 1.06, 0, 0, TAU);
    g.fill();
    const rim = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.2, x, y, r);
    rim.addColorStop(0, 'rgba(255,255,255,0.95)');
    rim.addColorStop(1, 'rgba(180,200,210,0.75)');
    g.fillStyle = rim;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    const inner = r * 0.875;
    g.save();
    g.beginPath();
    g.arc(x, y, inner, 0, TAU);
    g.clip();
    g.imageSmoothingEnabled = true;
    g.drawImage(this.pour.render(), x - inner, y - inner, inner * 2, inner * 2);
    // a little depth at the wall
    const shade = g.createRadialGradient(x, y, inner * 0.7, x, y, inner);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(30,14,4,0.38)');
    g.fillStyle = shade;
    g.fillRect(x - inner, y - inner, inner * 2, inner * 2);
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = Math.max(1.5, r * 0.012);
    g.beginPath();
    g.arc(x, y, r * 0.94, -2.4, -1.1);
    g.stroke();
    if (!chrome) return;
    // how full the glass is: brown while the base goes in, white once it's time to draw
    const fill = this.pour.fill;
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.arc(x, y, r + 12, 0, TAU);
    g.stroke();
    g.strokeStyle = '#a8703a';
    g.beginPath();
    g.arc(x, y, r + 12, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(fill, 0.4));
    g.stroke();
    if (fill > 0.4) {
      g.strokeStyle = C.milk;
      g.beginPath();
      g.arc(x, y, r + 12, -Math.PI / 2 + TAU * 0.4, -Math.PI / 2 + TAU * fill);
      g.stroke();
    }
  }

  _drawPourStage(g) {
    const W = this.w;
    const H = this.h;
    // counter top, seen from above
    const wood = g.createLinearGradient(0, 0, W, H);
    wood.addColorStop(0, '#5f3d24');
    wood.addColorStop(1, '#3d2616');
    g.fillStyle = wood;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 26; y < H; y += 74) g.fillRect(0, y, W, 1.5);
    const cup = this._cup();
    this._drawCup(g, cup.x, cup.y, cup.r, true);
    if (this.phase !== 'play') return;
    // the pitcher's spout, and the stream when pouring
    const x = this.px;
    const y = this.py;
    if (this.pouring) {
      g.fillStyle = 'rgba(255,250,240,0.95)';
      g.beginPath();
      g.arc(x, y, 5, 0, TAU);
      g.fill();
    }
    g.save();
    g.translate(x, y);
    g.rotate(-0.6);
    g.fillStyle = this._steel(g, 0, -30, 120, 30);
    g.globalAlpha = 0.92;
    g.beginPath();
    g.moveTo(4, 0);
    g.lineTo(34, -17);
    g.lineTo(150, -40);
    g.lineTo(150, 40);
    g.lineTo(34, 17);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(245,236,220,0.85)';
    g.beginPath();
    g.moveTo(22, 0);
    g.lineTo(44, -11);
    g.lineTo(150, -30);
    g.lineTo(150, 30);
    g.lineTo(44, 11);
    g.closePath();
    g.fill();
    g.restore();
    if (!this.touched) {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.font = '600 15px "JetBrains Mono", ui-monospace, monospace';
      g.textAlign = 'center';
      g.fillText('hold to pour', cup.x, cup.y + cup.r + 38);
    }
  }
}
