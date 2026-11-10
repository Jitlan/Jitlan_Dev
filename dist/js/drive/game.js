/* ==========================================================================
   Drive — the push-to-start game
   --------------------------------------------------------------------------
   Press the start button on the dash and the HUD clears. A stretch of
   winding road against the stopwatch, with two controls: go and stop
   (on a touch screen, one: hold to go, let go to stop). Run wide and the run
   is over, with a quote. Make it and the car parks itself at the café, where
   there's a cortado to make (see cafe.js).

   Results are kept in localStorage as a personal leaderboard.
   ========================================================================== */

import { Quaternion, Vector3 } from '../vendor/three.module.min.js';
import { Cafe } from './cafe.js';
import { COURSE, COURSES, setCourse } from './road.js';
import { Sim } from './sim.js';
import { IMPERIAL, UNITS, clamp, damp, fmtDist, fmtSpeed, fmtTime } from './util.js';

const BOARD_KEY = 'jl-drive-board-v1';
const COURSE_KEY = 'jl-drive-course';
const DECK_KEY = 'jl-drive-quotes-v1';
const BOARD_SIZE = 5;
const H = 1 / 120;

const FALL_QUOTES = [
  'Pushed to prod on a Friday. The mountain rejected your PR.',
  'Unhandled exception: gravity.',
  'That corner shipped a breaking change. Emphasis on braking.',
  'Even the best agents need guardrails. That one had one.',
  'git revert --hard. Back to the start line.',
  'Hallucinated a straightaway.',
  'Token budget exceeded: traction.',
  'Retry strategy: try letting go this time.',
  'Your context window didn’t include that corner.',
  'Deployed straight to the valley floor. Rolling back.',
  'Merge conflict: car vs. mountain. Mountain wins.',
  'No amount of RAG retrieves that corner.',
  'Rate limited by physics.',
  '404: asphalt not found.',
  'CI failed at the Corner Integration step.',
  'Great prompt. Shame about the completion.',
  'You can’t sudo your way through a bend.',
  'Latency: low. Altitude: also low, now.',
  'Stack overflow — of leaves, mostly.',
  'Autumn is for leaf-peeping, not leap-peeping.',
  'Smooth is fast. That was neither.',
  'Segfault at the guardrail.',
  'It worked on my machine. This is not my machine’s mountain.',
  'Move fast and break things. Not like that.',
  'The brake is a feature, not tech debt.',
  'Agentic workflow, zero supervision. Classic.',
  'The coffee was only a few bends away.',
  'Out of memory: forgot where the brake was.',
];

/** What the café thinks of the cortado, best first. */
const CUP_VERDICTS = [
  [90, 'Dialled in. That cortado ships to prod.'],
  [75, 'Approved, with one small nit about the foam.'],
  [55, 'Drinkable. Passes CI, needs a refactor.'],
  [35, 'It compiles. Barely. Still caffeine.'],
  [0, 'That’s not a cortado, that’s a stack trace in a glass.'],
];
const NO_CUP_VERDICT = 'Drove all the way to a café and skipped the coffee. Bold.';

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* private mode: the board just won't persist */
  }
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/** A shuffled deck, so a line never repeats until all have been seen. */
function nextQuote(kind, list) {
  const state = load(DECK_KEY, {});
  let deck = state[kind];
  if (!deck || !Array.isArray(deck.order) || deck.order.length !== list.length || deck.pos >= deck.order.length) {
    const order = list.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // don't open the new deck with the line we just showed
    if (deck && order.length > 1 && order[0] === deck.last) [order[0], order[1]] = [order[1], order[0]];
    deck = { order, pos: 0, last: deck ? deck.last : -1 };
  }
  const idx = deck.order[deck.pos++];
  deck.last = idx;
  state[kind] = deck;
  save(DECK_KEY, state);
  return list[idx];
}

/** "0.75 mi", "3 mi", "1.21 km": a course's length the way the HUD writes distances. */
const lengthText = (m) => `${parseFloat(fmtDist(m))} ${UNITS.dist}`;
/** Which course a saved run belongs to. Runs from before there was a choice were all the long way. */
const courseOf = (r) => r.c || 'full';

/** Anyone who reached the café outranks anyone who didn't; then fastest, or farthest. */
const made = (r) => r.why === 'cafe';
function byResult(a, b) {
  if (made(a) !== made(b)) return made(a) ? -1 : 1;
  return made(a) ? a.t - b.t : b.d - a.d || a.t - b.t;
}

export class Game {
  /**
   * @param {import('./engine.js').Engine} engine
   * @param {import('./hud.js').Hud} hud
   */
  constructor(engine, hud) {
    this.engine = engine;
    this.hud = hud;
    // the sprint unless the visitor chose the long way last time
    setCourse(load(COURSE_KEY, null));
    this.sim = new Sim(engine.road);
    // idle → intro → boot → ready → run → crash → over
    //                                  ↘ arrive → parked → cafe → over
    this.state = 'idle';
    this.t = 0;
    this.acc = 0;
    this.keys = new Set();
    this.touchMode = false; // one-touch control: hold to go, let go to brake
    this.onExit = null;
    this._textAt = 0;
    this._note = '';
    this._pedal = '';

    this.cpos = new Vector3();
    this.cvel = new Vector3();
    this.cquat = new Quaternion();
    this._q = new Quaternion();
    this._side = 1;
    this._fall = true;
    this.arr = null;

    this._build();
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = () => this._release();
  }

  get active() {
    return this.state !== 'idle';
  }

  /** Every saved run, whichever course it was on. */
  _runs() {
    const list = load(BOARD_KEY, []);
    return Array.isArray(list) ? list.filter((r) => r && typeof r.d === 'number' && typeof r.t === 'number') : [];
  }

  /** The leaderboard for the course in play: each course keeps its own. */
  board() {
    return this._runs()
      .filter((r) => courseOf(r) === COURSE.id)
      .sort(byResult);
  }

  get course() {
    return COURSE.id;
  }

  /** Swap between the sprint and the long way, and line up at the new start. Only between runs. */
  switchCourse() {
    if (this.state !== 'ready' && this.state !== 'over') return;
    const dark = this.state === 'over';
    save(COURSE_KEY, setCourse(COURSE.id === 'sprint' ? 'full' : 'sprint'));
    this._courseText();
    this.$over.hidden = true;
    this._release();
    this._live(false);
    this._toast('');
    this._setState('intro');
    if (dark) this.t = 0.2; // the screen is already dark; skip most of the fade
    this.$fade.style.opacity = '1';
    this.engine.setGameView(true);
    this.engine.fastWipers = true;
  }

  /** Label the two "other course" buttons for whichever course is in play. */
  _courseText() {
    const other = COURSES[COURSE.id === 'sprint' ? 'full' : 'sprint'];
    const label = other.id === 'full' ? `Take the long way · ${lengthText(other.LENGTH)}` : `Back to the sprint · ${lengthText(other.LENGTH)}`;
    this.$switch.firstChild.textContent = label + ' ';
    this.$chip.firstChild.textContent = label + ' ';
  }

  /* ---------------------------------------------------------------- DOM */
  _build() {
    const root = (this.root = el('div', 'game'));
    root.hidden = true;
    root.innerHTML = `
      <div class="game__touch"></div>
      <div class="game__top" aria-hidden="true">
        <div class="game__stat game__stat--time"><span>TIME</span><b>0:00.0</b></div>
        <div class="game__stat game__stat--dist"><span>CAFÉ IN &middot; ${UNITS.dist}</span><b>${fmtDist(COURSE.LENGTH)}</b></div>
        <div class="game__stat game__stat--best"><span>BEST</span><b>&mdash;</b></div>
      </div>
      <div class="game__hud" aria-hidden="true">
        <div class="game__speed"><b>0</b><span>${UNITS.speed}</span></div>
        <div class="game__note" data-state="ok"><span class="game__arrow"></span><b></b><em></em></div>
      </div>
      <div class="game__toast" role="status" aria-live="polite"></div>
      <div class="game__pedal" aria-hidden="true" data-state="idle"><b></b><span></span></div>
      <button type="button" class="game__exit">Exit <kbd>Esc</kbd></button>
      <button type="button" class="game__course">Course <kbd>C</kbd></button>
      <div class="game__fade"></div>
      <div class="game__over" role="dialog" aria-modal="true" aria-labelledby="game-over-quote" hidden>
        <p class="game__kicker"></p>
        <h2 class="game__quote" id="game-over-quote"></h2>
        <p class="game__summary"></p>
        <div class="game__cup" hidden>
          <img class="game__cup-img" alt="The cortado you poured" width="132" height="132">
          <div>
            <p class="game__cup-score"></p>
            <ul class="game__cup-scores"></ul>
          </div>
        </div>
        <dl class="game__result"></dl>
        <div class="game__board-wrap">
          <h3>Your leaderboard</h3>
          <table class="game__board">
            <thead><tr><th scope="col">#</th><th scope="col">Got to</th><th scope="col">Time</th><th scope="col">Avg</th><th scope="col">Cortado</th><th scope="col">When</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="game__actions">
          <button type="button" class="game__again">Drive again <kbd>Enter</kbd></button>
          <button type="button" class="game__switch">Course <kbd>C</kbd></button>
          <button type="button" class="game__back">Back to the site <kbd>Esc</kbd></button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const q = (s) => root.querySelector(s);
    this.$hud = q('.game__hud');
    this.$top = q('.game__top');
    this.$time = q('.game__stat--time b');
    this.$speed = q('.game__speed b');
    this.$dist = q('.game__stat--dist b');
    this.$note = q('.game__note');
    this.$arrow = q('.game__arrow');
    this.$noteMain = q('.game__note b');
    this.$noteSub = q('.game__note em');
    this.$best = q('.game__stat--best b');
    this.$bestLabel = q('.game__stat--best span');
    this.$toast = q('.game__toast');
    this.$pedal = q('.game__pedal');
    this.$pedalMain = q('.game__pedal b');
    this.$pedalSub = q('.game__pedal span');
    this.$fade = q('.game__fade');
    this.$over = q('.game__over');
    this.$again = q('.game__again');
    this.$back = q('.game__back');
    this.$switch = q('.game__switch');
    this.$chip = q('.game__course');
    this._courseText();

    // the whole screen is the pedal
    const touch = (this.$touch = q('.game__touch'));
    const down = (e) => {
      if (this.state !== 'ready' && this.state !== 'run') return;
      e.preventDefault();
      this.touchMode = true;
      this._pGas = true;
      try {
        touch.setPointerCapture(e.pointerId);
      } catch (err) {
        /* not capturable: fine */
      }
    };
    const up = () => {
      this._pGas = false;
    };
    touch.addEventListener('pointerdown', down);
    touch.addEventListener('pointerup', up);
    touch.addEventListener('pointercancel', up);
    touch.addEventListener('lostpointercapture', up);
    touch.addEventListener('contextmenu', (e) => e.preventDefault());

    q('.game__exit').addEventListener('click', () => this.exit());
    this.$again.addEventListener('click', () => this.restart());
    this.$back.addEventListener('click', () => this.exit());
    this.$switch.addEventListener('click', () => this.switchCourse());
    this.$chip.addEventListener('click', () => {
      this.switchCourse();
      this.$chip.blur(); // keys belong to the pedals
    });

    this.cafe = new Cafe(root, {
      onDone: (result) => this._finish('cafe', result),
      onSkip: () => this._finish('cafe', null),
    });
  }

  /** @param {ReturnType<import('./engine.js').Engine['layout']>} L game-view layout */
  layout(L) {
    const bottom = Math.min(L.cowlTop, window.innerHeight) - 10;
    this.root.style.setProperty('--game-bottom', Math.round(bottom) + 'px');
  }

  /* -------------------------------------------------------------- input */
  _onKeyDown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape') {
      e.preventDefault();
      this.exit();
      return;
    }
    if (e.code === 'KeyC' && (this.state === 'ready' || this.state === 'over')) {
      e.preventDefault();
      this.switchCourse();
      return;
    }
    if (this.state === 'over') {
      if (k === 'Tab') {
        // three buttons, one dialog: keep focus going round them
        e.preventDefault();
        const ring = [this.$again, this.$switch, this.$back];
        const at = ring.indexOf(document.activeElement);
        ring[(at + (e.shiftKey ? ring.length - 1 : 1) + ring.length) % ring.length].focus();
      } else if ((k === 'Enter' || k === ' ') && document.activeElement !== this.$back && document.activeElement !== this.$switch) {
        e.preventDefault();
        this.restart();
      }
      return;
    }
    if (this.state === 'cafe') {
      const focused = document.activeElement;
      if (focused && focused.classList.contains('cafe__skip') && (k === 'Enter' || k === ' ')) return;
      if (this.cafe.key(e.code, true)) e.preventDefault();
      return;
    }
    const code = e.code;
    const isGas = code === 'ArrowUp' || code === 'KeyW' || code === 'Space';
    const isBrake = code === 'ArrowDown' || code === 'KeyS' || code === 'ShiftLeft' || code === 'ShiftRight';
    if (isGas || isBrake) {
      e.preventDefault();
      this.touchMode = false;
      this.keys.add(isGas ? 'gas' : 'brake');
    }
  }

  _onKeyUp(e) {
    const code = e.code;
    if (this.state === 'cafe') {
      this.cafe.key(code, false);
      return;
    }
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') this.keys.delete('gas');
    if (code === 'ArrowDown' || code === 'KeyS' || code === 'ShiftLeft' || code === 'ShiftRight') this.keys.delete('brake');
  }

  _release() {
    this.keys.clear();
    this._pGas = false;
  }

  _coarse() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  /* ---------------------------------------------------------- lifecycle */
  toggle() {
    if (this.state === 'idle') this.start();
    else this.exit();
  }

  start() {
    if (this.state !== 'idle') return;
    const e = this.engine;
    this._setState('intro');
    this.root.hidden = false;
    this.$over.hidden = true;
    this._live(false);
    this.hud.setEnabled(false);
    e.controller = this;
    e.setGameView(true);
    e.fastWipers = true;
    e.startPulse = 1;
    e.startPressed = 1;
    this.touchMode = this._coarse();
    this._release();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.$fade.style.opacity = '1';
    this._toast('');
  }

  restart() {
    if (this.state !== 'over') return;
    this.$over.hidden = true;
    this._setState('intro');
    this.t = 0.2; // the screen is already dark; skip most of the fade
    this.$fade.style.opacity = '1';
    this.engine.setGameView(true);
    this.engine.fastWipers = true;
  }

  exit() {
    if (this.state === 'idle') return;
    const e = this.engine;
    this.state = 'idle';
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this._release();
    this.cafe.close();
    // hand the car back to the scroll cruise from wherever the run ended;
    // if that's the café's lot, the cruise simply pulls back out onto the road
    const car = e.car;
    if (car.free) {
      car.off = 0;
      car.yaw = 0;
      car.s = this.sim.s;
    }
    car.free = null;
    car.s = Math.max(30, car.s);
    car.v = Math.min(car.v, 9);
    car.steer = 0;
    car.shake = 0;
    e.world.stream(car.s, true);
    e.controller = e.cruise;
    e.rpmOverride = null;
    e.setGameView(false);
    e.fastWipers = false;
    this.$fade.style.opacity = '0';
    this.$over.hidden = true;
    this.root.hidden = true;
    this.root.removeAttribute('data-state');
    this.hud.setEnabled(true);
    this.hud.active = -1; // re-announce the current waypoint on the dash screen
    this.hud.measure();
    if (this.onExit) this.onExit();
  }

  _setState(s) {
    this.state = s;
    this.t = 0;
    this.root.setAttribute('data-state', s);
  }

  _toStart() {
    const e = this.engine;
    this.sim.reset();
    this.acc = 0;
    const car = e.car;
    car.free = null;
    car.s = this.sim.s;
    car.v = 0;
    car.off = 0;
    car.yaw = 0;
    car.steer = 0;
    car.accel = 0;
    car.shake = 0;
    car.throttle = 0;
    car.brake = 0;
    e.gear = 1;
    e.world.stream(car.s, true);
    const best = this.board()[0];
    if (best && made(best)) {
      this.$bestLabel.textContent = 'BEST TIME';
      this.$best.textContent = fmtTime(best.t);
    } else {
      this.$bestLabel.innerHTML = `BEST &middot; ${UNITS.dist}`;
      this.$best.textContent = best ? fmtDist(best.d) : '—';
    }
    const st = e.screenState;
    st.title = 'SPORT';
    st.footer = best ? (made(best) ? `BEST ${fmtTime(best.t)}` : `BEST ${fmtDist(best.d)} ${UNITS.dist}`) : 'NO RECORD YET';
    this._hudText(true);
    this._pedal = '';
    this._setPedal('idle');
  }

  _live(on) {
    this.$hud.classList.toggle('is-live', on);
    this.$top.classList.toggle('is-live', on);
    this.$pedal.classList.toggle('is-live', on);
  }

  /* -------------------------------------------------------------- frame */
  /** Driver interface, called by the engine once per frame. */
  update(dt, engine) {
    const car = engine.car;
    this.t += dt;
    switch (this.state) {
      case 'intro':
        // let the cruise roll on until the fade has covered the jump back to the start line
        engine.cruise.update(dt, engine);
        if (this.t > 0.36) {
          this._toStart();
          this._setState('boot');
          this.$fade.style.opacity = '0';
          this._live(true);
        }
        return;
      case 'boot': {
        // needle sweep, like every start-up self test
        const u = this.t / 1.5;
        engine.rpmOverride = u < 0.45 ? 8200 * (u / 0.45) : u < 0.9 ? 8200 * (1 - (u - 0.45) / 0.45) + 900 * ((u - 0.45) / 0.45) : 900;
        car.v = 0;
        car.accel = 0;
        if (this.t > 1.5) {
          engine.rpmOverride = null;
          this._setState('ready');
          this._toast(
            this.touchMode
              ? `Touch and hold anywhere to accelerate. Let go to brake. Café in ${lengthText(COURSE.LENGTH)}.`
              : `Hold W, ↑ or Space to go; S or ↓ brakes — or hold the mouse button and let go to brake. Café in ${lengthText(COURSE.LENGTH)}.`,
          );
        }
        return;
      }
      case 'ready':
      case 'run':
        this._drive(dt, engine);
        return;
      case 'crash':
        this._crashStep(dt, engine);
        return;
      case 'arrive':
        this._arriveStep(dt, engine);
        return;
      case 'parked':
        car.v = 0;
        car.accel = damp(car.accel, 0, 6, dt);
        car.steer = damp(car.steer, 0, 2.5, dt);
        if (this.t > 1.5) {
          this._setState('cafe');
          this.$fade.style.opacity = '0.6';
          this.cafe.open();
        }
        return;
      case 'cafe':
        car.steer = damp(car.steer, 0, 2.5, dt);
        this.cafe.update(dt);
        return;
      default:
        car.shake = 0;
    }
  }

  _drive(dt, engine) {
    const sim = this.sim;
    const car = engine.car;
    // one-touch: holding is the throttle, letting go is the brake
    const gas = this.touchMode ? !!this._pGas : this.keys.has('gas');
    const brake = this.touchMode ? !gas && this.state === 'run' : this.keys.has('brake');
    if (this.state === 'ready' && gas) {
      this._setState('run');
      this._toast('');
    }
    this.acc += dt;
    while (this.acc >= H) {
      this.acc -= H;
      const ev = sim.step(H, gas, brake);
      if (!ev) continue;
      if (ev.type === 'off') {
        this._beginCrash(ev.side, engine);
        return;
      }
      if (ev.type === 'finish') {
        this._beginArrive(engine);
        return;
      }
    }
    car.s = sim.s;
    car.v = sim.v;
    car.off = sim.off;
    car.accel = sim.accel;
    car.throttle = sim.thr;
    car.brake = sim.brk;
    car.shake = sim.slip;
    car.yaw = clamp(sim.lv * 0.03, -0.12, 0.12);
    car.steer = car.yaw * 2.2;
    car.free = null;
    this._setPedal(gas ? 'gas' : brake ? 'brake' : this.state === 'ready' ? 'idle' : 'coast');
    this._hudText(false);
  }

  _setPedal(state) {
    const key = state + (this.touchMode ? 't' : 'k');
    if (key === this._pedal) return;
    this._pedal = key;
    this.$pedal.setAttribute('data-state', state);
    const touch = this.touchMode;
    this.$pedalMain.textContent = state === 'gas' ? 'GAS' : state === 'brake' ? 'BRAKE' : state === 'coast' ? 'COAST' : touch ? 'HOLD TO GO' : 'READY';
    this.$pedalSub.textContent = touch ? 'hold to go · let go to brake' : 'W / ↑ go · S / ↓ brake';
  }

  _hudText(force) {
    const e = this.engine;
    if (!force && e.time - this._textAt < 0.07) return;
    this._textAt = e.time;
    const sim = this.sim;
    this.$speed.textContent = String(fmtSpeed(sim.v));
    this.$dist.textContent = fmtDist(sim.remaining);
    this.$time.textContent = fmtTime(sim.time);

    let state = 'ok';
    let main = 'CLEAR';
    let sub = '';
    let arrow = '';
    const la = sim.lookahead();
    const ratio = sim.v / Math.max(1, la.allow);
    if (la.corner) {
      arrow = la.corner.dir > 0 ? '↱' : '↰';
      main = (la.corner.dir > 0 ? 'RIGHT ' : 'LEFT ') + fmtSpeed(la.corner.speed);
      sub = Math.round((la.corner.dist * UNITS.shortPerM) / 10) * 10 + ' ' + UNITS.shortDist;
    } else if (sim.remaining < 330) {
      main = 'CAFÉ AHEAD';
    }
    // the warning comes early enough for a human: by the time a hand has moved, the car is several metres on
    if (sim.slip > 0.3) {
      state = 'brake';
      main = 'TRACTION';
    } else if (ratio > 0.92) {
      state = 'brake';
      main = 'BRAKE';
    } else if (ratio > 0.82) {
      state = 'lift';
    }
    const key = state + main + sub;
    if (key !== this._note) {
      this._note = key;
      this.$note.setAttribute('data-state', state);
      this.$arrow.textContent = arrow;
      this.$noteMain.textContent = main;
      this.$noteSub.textContent = sub;
    }
  }

  _toast(text, ms) {
    clearTimeout(this._toastTimer);
    this.$toast.textContent = text;
    this.$toast.classList.toggle('is-on', !!text);
    if (text && ms) this._toastTimer = setTimeout(() => this.$toast.classList.remove('is-on'), ms);
  }

  /* -------------------------------------------------------------- crash */
  _beginCrash(side, engine) {
    const sim = this.sim;
    this._setState('crash');
    this._side = side;
    const obj = engine.carObj;
    this.cpos.copy(obj.position);
    this.cquat.copy(obj.quaternion);
    const p = engine.road.at(sim.s, {});
    this.cvel
      .set(Math.sin(p.th), p.g, -Math.cos(p.th))
      .multiplyScalar(sim.v)
      .add(new Vector3(Math.cos(p.th), 0, Math.sin(p.th)).multiplyScalar(sim.lv + side * 1.5));
    // rock on that side stops you dead; anything else and you're airborne
    this._fall = p.hill * side < 0.2;
    engine.car.free = { pos: this.cpos, quat: this.cquat };
    this._toast('');
    this._live(false);
  }

  _crashStep(dt, engine) {
    const t = this.t;
    const car = engine.car;
    const q = this._q;
    let dur;
    if (this._fall) {
      dur = 1.75;
      if (t > 0.18) this.cvel.y -= 9.81 * 1.7 * dt;
      this.cvel.multiplyScalar(Math.exp(-0.3 * dt));
      this.cpos.addScaledVector(this.cvel, dt);
      const k = Math.min(1, t * 2.2);
      this.cquat.multiply(q.setFromAxisAngle(AXIS_X, -0.85 * k * dt));
      this.cquat.multiply(q.setFromAxisAngle(AXIS_Z, -this._side * 1.25 * k * dt));
      car.shake = 0.5;
    } else {
      dur = 1.15;
      const hit = Math.exp(-4 * t);
      this.cvel.multiplyScalar(Math.exp(-7.5 * dt));
      this.cpos.addScaledVector(this.cvel, dt);
      this.cpos.y += 1.4 * hit * dt;
      this.cquat.multiply(q.setFromAxisAngle(AXIS_Y, -this._side * 1.6 * hit * dt));
      this.cquat.multiply(q.setFromAxisAngle(AXIS_Z, this._side * 0.9 * hit * dt));
      car.shake = Math.max(0, 1 - t * 1.1);
    }
    car.v = this.cvel.length();
    car.accel = -6;
    car.throttle = 0;
    this.$fade.style.opacity = String(clamp((t - (dur - 0.5)) / 0.42, 0, 1));
    if (t >= dur) this._finish('fell', null);
  }

  /* ------------------------------------------------------------- arrive */
  /** Across the line: the clock has stopped, and the car brings itself into the café's lot. */
  _beginArrive(engine) {
    const sim = this.sim;
    this._setState('arrive');
    const room = COURSE.STOP_S - sim.s - 3;
    this.arr = {
      v: sim.v,
      cruise: Math.max(sim.v, 16),
      decel: Math.max(4.2, (sim.v * sim.v) / (2 * room)),
      off0: sim.off,
    };
    const car = engine.car;
    car.s = sim.s;
    this._release();
    this._live(false);
    this._toast(`Across the line in ${fmtTime(sim.time)}. Coffee’s on the right.`, 4200);
    engine.fastWipers = false;
    engine.screenState.title = 'CAFÉ';
    engine.screenState.footer = fmtTime(sim.time);
  }

  _arriveStep(dt, engine) {
    const car = engine.car;
    const a = this.arr;
    const remain = COURSE.STOP_S - car.s;
    if (remain <= 0.06) {
      car.v = 0;
      car.accel = -1.5; // the nose settles
      car.throttle = 0;
      this._setState('parked');
      engine.setGameView(false); // look up from the gauges: there's the café
      return;
    }
    // hold speed down the straight, then brake to roll to rest in the bay
    const target = Math.max(1.3, Math.min(a.cruise, Math.sqrt(2 * a.decel * remain)));
    const prev = a.v;
    a.v = a.v > target ? Math.max(target, a.v - 12 * dt) : Math.min(target, a.v + 3 * dt);
    // swing in: the path leaves the lane late and ends nose-in toward the building
    const u = clamp(1 - remain / COURSE.PARK_RUN, 0, 1);
    const slope = ((COURSE.PARK_CURVE * COURSE.PARK_OFFSET) / COURSE.PARK_RUN) * Math.pow(u, COURSE.PARK_CURVE - 1);
    const yaw = Math.atan(slope);
    car.s = Math.min(COURSE.STOP_S, car.s + a.v * Math.cos(yaw) * dt);
    car.v = a.v;
    car.off = COURSE.PARK_OFFSET * Math.pow(u, COURSE.PARK_CURVE) + a.off0 * Math.exp(-2.2 * this.t);
    car.yaw = yaw;
    const bend = u > 0 ? ((COURSE.PARK_CURVE * (COURSE.PARK_CURVE - 1) * COURSE.PARK_OFFSET) / (COURSE.PARK_RUN * COURSE.PARK_RUN)) * Math.pow(u, COURSE.PARK_CURVE - 2) : 0;
    car.steer = damp(car.steer, Math.atan(2.45 * bend) * 13.5, 6, dt);
    car.accel = (a.v - prev) / Math.max(dt, 1e-3);
    car.throttle = car.accel > 0.2 ? 0.3 : 0;
    car.brake = car.accel < -0.5 ? 0.6 : 0;
    car.shake = 0;
    car.free = null;
    this.$fade.style.opacity = '0';
  }

  /* --------------------------------------------------------------- over */
  /**
   * @param {'fell'|'cafe'} reason
   * @param {null | {total:number, scores:object, values:object, image:string}} cup
   */
  _finish(reason, cup) {
    const sim = this.sim;
    this._setState('over');
    this._release();
    this.engine.car.shake = 0;
    this.$fade.style.opacity = '0.82';
    this._live(false);
    this._toast('');

    const arrived = reason === 'cafe';
    const run = {
      d: Math.round(sim.distance * 10) / 10,
      t: Math.round(sim.time * 10) / 10,
      top: Math.round(sim.top * 100) / 100,
      at: Date.now(),
      why: reason,
      c: COURSE.id,
    };
    if (arrived && cup) run.cup = cup.total;
    const board = this.board();
    const prev = board[0];
    let rank = -1;
    if (run.d >= 5) {
      board.push(run);
      board.sort(byResult);
      board.length = Math.min(board.length, BOARD_SIZE);
      rank = board.indexOf(run);
      // each course keeps its own top five; leave the other course's alone
      save(BOARD_KEY, this._runs().filter((r) => courseOf(r) !== COURSE.id).concat(board));
    }
    const record = rank === 0 && (!prev || byResult(run, prev) < 0);

    const q = (s) => this.$over.querySelector(s);
    this.$over.classList.toggle('game__over--arrived', arrived);
    q('.game__kicker').textContent = arrived ? 'ARRIVED · CORTADO PASS CAFÉ' : 'OFF THE ROAD';
    q('.game__quote').textContent = arrived
      ? cup
        ? CUP_VERDICTS.find(([min]) => cup.total >= min)[1]
        : NO_CUP_VERDICT
      : nextQuote('fall', FALL_QUOTES);
    const avg = run.t > 0.5 ? run.d / run.t : 0;
    const badge = record ? ' <span class="game__record">New personal best</span>' : rank > 0 ? ` <span class="game__record game__record--minor">#${rank + 1} on your board</span>` : '';
    q('.game__summary').innerHTML = arrived
      ? `${lengthText(COURSE.LENGTH)} in <b>${fmtTime(run.t)}</b>, and the car is still green side up.${badge}`
      : `You made it <b>${fmtDist(run.d)} ${UNITS.dist}</b> in <b>${fmtTime(run.t)}</b>. The café was another ${fmtDist(sim.remaining)} ${UNITS.dist}.${badge}`;

    const $cup = q('.game__cup');
    $cup.hidden = !(arrived && cup);
    if (arrived && cup) {
      const img = q('.game__cup-img');
      if (cup.image) img.src = cup.image;
      img.hidden = !cup.image;
      q('.game__cup-score').innerHTML = `Cortado <b>${cup.total}</b><i>/100</i>`;
      const s = cup.scores;
      const v = cup.values;
      const chip = (label, value, score) => `<li class="${score >= 0.7 ? 'is-good' : score >= 0.4 ? 'is-ok' : 'is-bad'}"><span>${label}</span><b>${value}</b><em>${Math.round(score * 100)}</em></li>`;
      q('.game__cup-scores').innerHTML =
        chip('Dose', v.dose.toFixed(1) + ' g', s.dose) +
        chip('Tamp', IMPERIAL ? Math.round(v.tamp) + ' lb' : (v.tamp * 0.4536).toFixed(1) + ' kg', s.tamp) +
        chip('Shot', `${v.yield.toFixed(0)} g / ${v.time.toFixed(0)} s`, s.shot) +
        chip('Milk', IMPERIAL ? Math.round(v.milk * 1.8 + 32) + '°F' : Math.round(v.milk) + '°C', s.milk) +
        chip('Art', '', s.art);
    }

    q('.game__result').innerHTML =
      (arrived ? `<div><dt>Time</dt><dd>${fmtTime(run.t)}</dd></div>` : `<div><dt>Distance</dt><dd>${fmtDist(run.d)}<i>${UNITS.dist}</i></dd></div><div><dt>Time</dt><dd>${fmtTime(run.t)}</dd></div>`) +
      `<div><dt>Average</dt><dd>${fmtSpeed(avg)}<i>${UNITS.speed}</i></dd></div>` +
      `<div><dt>Top speed</dt><dd>${fmtSpeed(run.top)}<i>${UNITS.speed}</i></dd></div>` +
      (arrived ? `<div><dt>Cortado</dt><dd>${cup ? cup.total + '<i>/100</i>' : '—'}</dd></div>` : '');

    q('.game__board-wrap h3').textContent = `Your leaderboard · ${COURSE.id === 'sprint' ? 'sprint' : 'the long way'}, ${lengthText(COURSE.LENGTH)}`;
    const body = q('.game__board tbody');
    body.innerHTML = board.length
      ? board
          .map((r, i) => {
            const when = new Date(r.at);
            const date = isNaN(when) ? '' : when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const where = made(r) ? 'Café' : `${fmtDist(r.d)} ${UNITS.dist}`;
            const coffee = made(r) ? (typeof r.cup === 'number' ? r.cup : 'skipped') : '—';
            return `<tr class="${i === rank ? 'is-current' : ''}"><td>${i + 1}</td><td>${where}</td><td>${fmtTime(r.t)}</td><td>${fmtSpeed(r.t > 0.5 ? r.d / r.t : 0)} ${UNITS.speed}</td><td>${coffee}</td><td>${date}</td></tr>`;
          })
          .join('')
      : '<tr><td colspan="6">No runs on the board yet.</td></tr>';
    this.$over.hidden = false;
    this.$again.focus({ preventScroll: true });
  }
}

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
