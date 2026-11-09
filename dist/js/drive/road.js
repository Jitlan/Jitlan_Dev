/* ==========================================================================
   Drive — procedural mountain road
   --------------------------------------------------------------------------
   An endless, fully deterministic road described by curvature and grade as
   functions of distance. Scenery and game physics both read from this, so
   the corner you see is exactly the corner the car has to survive.
   ========================================================================== */

import { TAU, clamp, lerp, smoothstep, mulberry32 } from './util.js';

export const ROAD = {
  DS: 2, // metres between samples
  HALF_WIDTH: 3.7, // asphalt half width
  LANE: 1.85, // lane centre, right of the centreline
  SHOULDER: 1.1,
};

const DS = ROAD.DS;
const SMOOTH = 7; // box-filter half width (samples) — turns arcs into eased transitions
const HEADING_LIMIT = 1.15; // keeps the road from doubling back onto its own scenery

function boxAvg(arr, i) {
  const a = Math.max(0, i - SMOOTH);
  const b = i + SMOOTH;
  let sum = 0;
  for (let j = a; j <= b; j++) sum += arr[j];
  return sum / (b - a + 1);
}

export class Road {
  constructor(seed = 911) {
    this.rand = mulberry32(seed);
    this.kRaw = []; // planned curvature per sample (piecewise constant)
    this.k1 = []; // once-smoothed
    this.k = []; // twice-smoothed curvature (1/m), + = right-hander
    this.th = []; // heading (rad), 0 = -Z, + = clockwise from above
    this.x = [];
    this.y = [];
    this.z = [];
    this.n = 0;
    this.planHeading = 0;
    this.lastDir = 1;
    this.wantStraight = false;
    this._pushRaw(150, 0); // a calm launch straight
    this.ensure(400);
  }

  _pushRaw(len, k) {
    const n = Math.max(0, Math.round(len / DS));
    for (let i = 0; i < n; i++) this.kRaw.push(k);
    this.planHeading += n * DS * k;
  }

  _plan(untilIndex) {
    while (this.kRaw.length <= untilIndex) {
      const s = this.kRaw.length * DS;
      const diff = Math.min(1, s / 3600); // corners tighten with distance
      if (this.wantStraight) {
        const len = this.rand() < 0.28 ? 0 : 30 + this.rand() * lerp(240, 100, diff);
        this._pushRaw(len, 0);
        this.wantStraight = false;
        continue;
      }
      const rMin = lerp(60, 26, diff);
      const rMax = lerp(300, 190, diff);
      const radius = rMin * Math.pow(rMax / rMin, Math.pow(this.rand(), 1.25));
      let angle = clamp(0.35 + this.rand() * 1.5, 36 / radius, 230 / radius);
      let dir = this.rand() < 0.6 ? -this.lastDir : this.lastDir;
      if (Math.abs(this.planHeading + dir * angle) > HEADING_LIMIT) dir = -dir;
      if (Math.abs(this.planHeading + dir * angle) > HEADING_LIMIT) {
        dir = this.planHeading > 0 ? -1 : 1;
        angle = Math.min(angle, HEADING_LIMIT + Math.abs(this.planHeading));
      }
      this._pushRaw(radius * angle, dir / radius);
      this.lastDir = dir;
      this.wantStraight = true;
    }
  }

  /** Make sure samples exist up to distance `sMax` (metres). */
  ensure(sMax) {
    const need = Math.ceil(sMax / DS) + 2;
    if (need < this.n) return;
    const target = need + 96;
    this._plan(target + 2 * SMOOTH + 1);
    for (let i = this.k1.length; i <= target + SMOOTH; i++) this.k1.push(boxAvg(this.kRaw, i));
    for (let i = this.n; i <= target; i++) {
      const k = boxAvg(this.k1, i);
      this.k.push(k);
      if (i === 0) {
        this.th.push(0);
        this.x.push(0);
        this.y.push(0);
        this.z.push(0);
        continue;
      }
      const th = this.th[i - 1] + 0.5 * (this.k[i - 1] + k) * DS;
      const thMid = 0.5 * (this.th[i - 1] + th);
      this.th.push(th);
      this.x.push(this.x[i - 1] + Math.sin(thMid) * DS);
      this.z.push(this.z[i - 1] - Math.cos(thMid) * DS);
      this.y.push(this.y[i - 1] + this.grade((i - 0.5) * DS) * DS);
    }
    this.n = target + 1;
  }

  /** Slope (rise over run). The hills are a few detuned sine waves. */
  grade(s) {
    return (
      smoothstep(20, 240, s) *
      (0.05 * Math.sin((s * TAU) / 760 + 1.3) +
        0.032 * Math.sin((s * TAU) / 330 + 4.1) +
        0.016 * Math.sin((s * TAU) / 170 + 0.7) +
        0.02 * Math.sin((s * TAU) / 2300 + 2.2))
    );
  }

  /** d(grade)/ds — vertical curvature. Negative over a crest (the car goes light). */
  gradeRate(s) {
    return (
      smoothstep(20, 240, s) *
      (((0.05 * TAU) / 760) * Math.cos((s * TAU) / 760 + 1.3) +
        ((0.032 * TAU) / 330) * Math.cos((s * TAU) / 330 + 4.1) +
        ((0.016 * TAU) / 170) * Math.cos((s * TAU) / 170 + 0.7) +
        ((0.02 * TAU) / 2300) * Math.cos((s * TAU) / 2300 + 2.2))
    );
  }

  /** Which side the mountain is on: +1 = rock on the right / drop on the left, -1 = mirrored, ~0 = forest. */
  hill(s) {
    return clamp(1.3 * Math.sin((s * TAU) / 1700 + 0.9) + 0.3 * Math.sin((s * TAU) / 530 + 2.1), -1, 1);
  }

  curvature(s) {
    if (s <= 0) return 0;
    this.ensure(s + DS);
    const f = s / DS;
    const i = Math.floor(f);
    return lerp(this.k[i], this.k[i + 1], f - i);
  }

  /** Road-surface bank angle (rad); positive leans into a right-hander. */
  bank(k) {
    return clamp(k * 3.0, -0.07, 0.07);
  }

  /** Sample the centreline at distance `s`, writing into `out`. */
  at(s, out) {
    if (s < 0) s = 0;
    this.ensure(s + DS);
    const f = s / DS;
    const i = Math.floor(f);
    const t = f - i;
    out.x = lerp(this.x[i], this.x[i + 1], t);
    out.y = lerp(this.y[i], this.y[i + 1], t);
    out.z = lerp(this.z[i], this.z[i + 1], t);
    out.th = lerp(this.th[i], this.th[i + 1], t);
    out.k = lerp(this.k[i], this.k[i + 1], t);
    out.g = this.grade(s);
    out.hill = this.hill(s);
    return out;
  }
}
