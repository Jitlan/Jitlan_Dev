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

/**
 * The game's courses. Both end at the same finish line and the same café; the
 * sprint is simply the last three-quarters of a mile of the long way, which a
 * tidy driver covers in about a minute (it starts on a straight). Beyond the
 * line there's a short run-off to the café's gravel lot, where the car is
 * parked for you. Around the café the road runs dead straight and level, with
 * the mountain on the café's side and the view on the other.
 */
const MILE = 1609.344;
const FINISH_S = 14 + 3 * MILE;
export const COURSES = {
  sprint: { id: 'sprint', START_S: FINISH_S - 0.75 * MILE, LENGTH: 0.75 * MILE },
  full: { id: 'full', START_S: 14, LENGTH: 3 * MILE },
};
export const DEFAULT_COURSE = 'sprint';

/** The course in play. START_S and LENGTH follow setCourse(); everything about the café is fixed. */
export const COURSE = {
  id: DEFAULT_COURSE,
  START_S: COURSES[DEFAULT_COURSE].START_S,
  LENGTH: COURSES[DEFAULT_COURSE].LENGTH,
  FINISH_S,
  STOP_S: FINISH_S + 190, // where the car comes to rest
  LOT_FROM: FINISH_S + 190 - 52, // extent of the gravel lot along the road
  LOT_TO: FINISH_S + 190 + 62,
  LOT_DEPTH: 30, // metres of flat ground beyond the asphalt edge
  STRAIGHT_FROM: FINISH_S - 110,
  STRAIGHT_TO: FINISH_S + 430,
  PARK_OFFSET: 8.6, // final position, metres right of the lane centre
  PARK_RUN: 46, // distance over which the car swings in
  PARK_CURVE: 2.6, // exponent of the swing-in path
};

/** Choose which course the game runs: 'sprint' or 'full'. Returns the id actually in play. */
export function setCourse(id) {
  const c = COURSES[id] || COURSES[DEFAULT_COURSE];
  COURSE.id = c.id;
  COURSE.START_S = c.START_S;
  COURSE.LENGTH = c.LENGTH;
  return c.id;
}

const DS = ROAD.DS;
const SMOOTH = 7; // box-filter half width (samples) — turns arcs into eased transitions
const HEADING_LIMIT = 1.15; // keeps the road from doubling back onto its own scenery
const STRAIGHT_FROM_I = Math.round(COURSE.STRAIGHT_FROM / DS);
const STRAIGHT_TO_I = Math.round(COURSE.STRAIGHT_TO / DS);

function boxAvg(arr, i) {
  const a = Math.max(0, i - SMOOTH);
  const b = i + SMOOTH;
  let sum = 0;
  for (let j = a; j <= b; j++) sum += arr[j];
  return sum / (b - a + 1);
}

/** 1 around the café, 0 elsewhere, with soft shoulders. */
function cafeZone(s, before, after, edge) {
  return smoothstep(COURSE.FINISH_S - before - edge, COURSE.FINISH_S - before, s) * (1 - smoothstep(COURSE.FINISH_S + after, COURSE.FINISH_S + after + edge, s));
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
    this._push(Math.round(90 / DS), 0); // a short launch straight, then it starts to wind
    this.ensure(400);
  }

  _push(n, k) {
    for (let i = 0; i < n; i++) this.kRaw.push(k);
    this.planHeading += n * DS * k;
  }

  /**
   * A winding road: bend follows bend, usually the other way, joined by
   * short links or nothing at all. Every so often there's a real straight.
   */
  _plan(untilIndex) {
    while (this.kRaw.length <= untilIndex) {
      const at = this.kRaw.length;
      if (at >= STRAIGHT_FROM_I && at < STRAIGHT_TO_I) {
        this._push(STRAIGHT_TO_I - at, 0);
        this.wantStraight = false;
        continue;
      }
      const room = at < STRAIGHT_FROM_I ? STRAIGHT_FROM_I - at : Infinity;
      const diff = Math.min(1, (at * DS) / 2600); // bends tighten with distance
      if (this.wantStraight) {
        const r = this.rand();
        const len = r < 0.34 ? 0 : r < 0.9 ? 14 + this.rand() * lerp(72, 46, diff) : 110 + this.rand() * 90;
        this._push(Math.min(Math.round(len / DS), room), 0);
        this.wantStraight = false;
        continue;
      }
      const rMin = lerp(46, 27, diff);
      const rMax = lerp(170, 130, diff);
      const radius = rMin * Math.pow(rMax / rMin, Math.pow(this.rand(), 1.15));
      let angle = clamp(0.5 + this.rand() * 1.45, 34 / radius, 150 / radius);
      let dir = this.rand() < 0.72 ? -this.lastDir : this.lastDir;
      if (Math.abs(this.planHeading + dir * angle) > HEADING_LIMIT) dir = -dir;
      if (Math.abs(this.planHeading + dir * angle) > HEADING_LIMIT) {
        dir = this.planHeading > 0 ? -1 : 1;
        angle = Math.min(angle, HEADING_LIMIT + Math.abs(this.planHeading));
      }
      const n = Math.min(Math.max(1, Math.round((radius * angle) / DS)), room);
      // a bend cut short by the café straight becomes part of the straight
      this._push(n, n < 5 ? 0 : dir / radius);
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

  /** Slope (rise over run). The hills are a few detuned sine waves; the café sits on a level stretch. */
  grade(s) {
    return (
      smoothstep(20, 240, s) *
      (1 - cafeZone(s, 40, 330, 150)) *
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
      (1 - cafeZone(s, 40, 330, 150)) *
      (((0.05 * TAU) / 760) * Math.cos((s * TAU) / 760 + 1.3) +
        ((0.032 * TAU) / 330) * Math.cos((s * TAU) / 330 + 4.1) +
        ((0.016 * TAU) / 170) * Math.cos((s * TAU) / 170 + 0.7) +
        ((0.02 * TAU) / 2300) * Math.cos((s * TAU) / 2300 + 2.2))
    );
  }

  /** Which side the mountain is on: +1 = rock on the right / drop on the left, -1 = mirrored, ~0 = forest. */
  hill(s) {
    const h = clamp(1.3 * Math.sin((s * TAU) / 1700 + 0.9) + 0.3 * Math.sin((s * TAU) / 530 + 2.1), -1, 1);
    // the café is cut into the mountainside on the right, looking out over the valley
    return lerp(h, 1, cafeZone(s, -20, 300, 160));
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
