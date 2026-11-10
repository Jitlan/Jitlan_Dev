/* ==========================================================================
   Drive — game physics
   --------------------------------------------------------------------------
   The car steers itself. All the player has is a throttle and a brake, so
   the whole game is corner speed: arrive too fast and the tyres let go, the
   car washes wide, and eventually there's no more road. Crests unload the
   tyres, dips press them in, downhill braking takes longer.

   The course is three miles of this, against the stopwatch, to a café.

   No DOM or rendering in here, so the model can be exercised headlessly.
   ========================================================================== */

import { COURSE } from './road.js';
import { clamp, damp } from './util.js';

export const TUNE = {
  GRIP: 9.2, // m/s² of lateral grip on a level, wet road
  BRAKE: 10.4, // m/s² peak braking
  LAUNCH: 6.8, // m/s² traction-limited acceleration
  POWER: 240, // W/kg
  DRAG: 0.00042,
  OFF_RIGHT: 2.9, // metres from lane centre to the end of the right shoulder
  OFF_LEFT: 6.5, // …and across the oncoming lane to the left one
};

const G = 9.81;
const STEP = 4; // metres between look-ahead samples
const HORIZON = 88; // look-ahead samples (≈350 m)

export class Sim {
  /** @param {import('./road.js').Road} road */
  constructor(road) {
    this.road = road;
    this._va = new Float64Array(HORIZON + 1);
    this.reset();
  }

  reset() {
    this.s = COURSE.START_S;
    this.v = 0;
    this.off = 0; // metres right of lane centre
    this.lv = 0; // lateral velocity
    this.thr = 0;
    this.brk = 0;
    this.accel = 0;
    this.slip = 0; // 0 gripping … 1 fully sliding
    this.load = 1;
    this.started = false;
    this.finished = false;
    this.time = 0; // stopwatch: seconds since the first throttle press
    this.top = 0;
  }

  get distance() {
    return Math.min(COURSE.LENGTH, this.s - COURSE.START_S);
  }

  /** Metres still to go to the finish line. */
  get remaining() {
    return Math.max(0, COURSE.FINISH_S - this.s);
  }

  /** Tyre load factor at speed v over the road's vertical curvature at s. */
  loadAt(s, v) {
    return clamp(1 + (v * v * this.road.gradeRate(s)) / G, 0.25, 1.7);
  }

  /**
   * Advance by h seconds.
   * @returns {null | {type:'off', side:number} | {type:'finish'}}
   */
  step(h, gas, brake) {
    const road = this.road;
    if (gas && !this.started) this.started = true;
    this.thr = damp(this.thr, gas ? 1 : 0, 16, h);
    this.brk = damp(this.brk, brake ? 1 : 0, 22, h);

    const v = this.v;
    const k = road.curvature(this.s);
    const load = (this.load = this.loadAt(this.s, v));
    const traction = Math.sqrt(Math.min(1, load));

    // longitudinal
    let a = this.thr * Math.min(TUNE.LAUNCH * traction, TUNE.POWER / Math.max(v, 4));
    a -= this.brk * TUNE.BRAKE * traction;
    if (v > 0.05) a -= TUNE.DRAG * v * v + 0.12 + (this.thr < 0.05 ? 0.7 : 0);
    a -= G * road.grade(this.s);

    // lateral: can the tyres hold this corner at this speed?
    const need = v * v * Math.abs(k);
    const grip = TUNE.GRIP * load * (1 - 0.2 * this.brk);
    const deficit = need - grip;
    if (deficit > 0) {
      this.lv += (k > 0 ? -1 : 1) * deficit * h; // washes toward the outside
      a -= Math.min(deficit, 4) * 0.8; // scrubbing speed
      this.slip = damp(this.slip, clamp(deficit / 2.5, 0.25, 1), 14, h);
    } else {
      const pull = clamp(-5.5 * this.off - 4.4 * this.lv, deficit, -deficit);
      this.lv += pull * h;
      this.slip = damp(this.slip, Math.abs(this.off) > 0.5 ? 0.18 : 0, 8, h);
    }
    this.off += this.lv * h;

    this.v = Math.max(0, v + a * h);
    if (this.v === 0 && !gas) a = 0;
    this.accel = a;
    this.s += this.v * h;
    if (this.v > this.top) this.top = this.v;

    if (this.off > TUNE.OFF_RIGHT) return { type: 'off', side: 1 };
    if (this.off < -TUNE.OFF_LEFT) return { type: 'off', side: -1 };

    if (this.started) this.time += h;
    if (this.s >= COURSE.FINISH_S) {
      // trim the overshoot of this last step off the clock
      if (this.v > 0.1) this.time -= (this.s - COURSE.FINISH_S) / this.v;
      this.finished = true;
      return { type: 'finish' };
    }
    return null;
  }

  /**
   * How fast is it safe to be going right now, given everything coming?
   * Walks the road backward from the horizon, asking at each point how much
   * speed could still be scrubbed off before the next thing that matters.
   */
  lookahead() {
    const road = this.road;
    const va = this._va;
    let corner = null;
    let prev = 120;
    for (let i = HORIZON; i >= 0; i--) {
      const sp = this.s + i * STEP;
      const k = road.curvature(sp);
      const ak = Math.abs(k);
      let limit = 120;
      if (ak > 2e-4) {
        // v²·|k| = GRIP·load(v), with load = 1 + v²·gr/g  →  solve for v
        const gr = road.gradeRate(sp);
        const denom = ak - (TUNE.GRIP * gr) / G;
        let v2 = denom > 1e-6 ? TUNE.GRIP / denom : 1e9;
        v2 = clamp(v2, (0.25 * TUNE.GRIP) / ak, (1.7 * TUNE.GRIP) / ak);
        limit = Math.sqrt(v2) * 0.955;
      }
      // braking available just before this point, at roughly the speed we'd be carrying
      const brake = (TUNE.BRAKE * Math.sqrt(Math.min(1, this.loadAt(sp, prev))) + G * road.grade(sp)) * 0.86;
      const reach = Math.sqrt(prev * prev + 2 * Math.max(2, brake) * STEP);
      prev = va[i] = Math.min(limit, reach);
    }
    // the next bend worth calling out: first clear dip in the corner-speed limit
    for (let i = 1; i < HORIZON; i++) {
      const sp = this.s + i * STEP;
      const k = road.curvature(sp);
      if (Math.abs(k) < 1 / 240) continue;
      const kn = Math.abs(road.curvature(sp + STEP));
      if (kn <= Math.abs(k) + 1e-6 || i === HORIZON - 1) {
        corner = { dist: i * STEP, dir: k > 0 ? 1 : -1, speed: Math.sqrt(TUNE.GRIP / Math.abs(k)) * 0.955, radius: 1 / Math.abs(k) };
        break;
      }
    }
    return { allow: va[0], corner };
  }
}
