/* ==========================================================================
   Drive — the push-to-start game
   --------------------------------------------------------------------------
   Press the start button on the dash and the HUD clears, the clock starts,
   and you get two controls: go and stop. See sim.js for the physics.
   Results are kept in localStorage as a personal leaderboard.
   ========================================================================== */

import { Quaternion, Vector3 } from '../vendor/three.module.min.js';
import { Sim } from './sim.js';
import { UNITS, clamp, fmtDist, fmtSpeed, fmtTime } from './util.js';

const BOARD_KEY = 'jl-drive-board-v1';
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
  'Retry strategy: try the left pedal this time.',
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
];
const TIME_QUOTES = [
  'Out of time. The storm doesn’t wait for a careful driver.',
  'Request timed out. Try carrying more speed between the bends.',
  'Deadline missed — scope was fine, velocity wasn’t.',
  'Sprint over. The mountain is still in the backlog.',
  'Safe, tidy, and too slow. Ship it faster next time.',
  'The clock won. It usually does on a Friday.',
];

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

/** A shuffled deck per quote list, so a line never repeats until all have been seen. */
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

export class Game {
  /**
   * @param {import('./engine.js').Engine} engine
   * @param {import('./hud.js').Hud} hud
   */
  constructor(engine, hud) {
    this.engine = engine;
    this.hud = hud;
    this.sim = new Sim(engine.road);
    this.state = 'idle'; // idle → intro → boot → ready → run → crash → over
    this.t = 0;
    this.acc = 0;
    this.gas = false;
    this.brake = false;
    this.keys = new Set();
    this.onExit = null;
    this._textAt = 0;
    this._note = '';
    this._reason = 'fell';

    this.cpos = new Vector3();
    this.cvel = new Vector3();
    this.cquat = new Quaternion();
    this._q = new Quaternion();
    this._side = 1;
    this._fall = true;

    this._build();
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = () => this._release();
  }

  get active() {
    return this.state !== 'idle';
  }

  board() {
    const list = load(BOARD_KEY, []);
    return Array.isArray(list) ? list.filter((r) => r && typeof r.d === 'number') : [];
  }

  /* ---------------------------------------------------------------- DOM */
  _build() {
    const root = (this.root = el('div', 'game'));
    root.hidden = true;
    root.innerHTML = `
      <div class="game__top" aria-hidden="true">
        <div class="game__stat game__stat--time"><span>TIME</span><b>0.0</b></div>
        <div class="game__stat game__stat--dist"><span>DISTANCE &middot; ${UNITS.dist}</span><b>0.00</b></div>
        <div class="game__stat game__stat--best"><span>BEST &middot; ${UNITS.dist}</span><b>&mdash;</b></div>
      </div>
      <div class="game__hud" aria-hidden="true">
        <div class="game__speed"><b>0</b><span>${UNITS.speed}</span></div>
        <div class="game__note" data-state="ok"><span class="game__arrow"></span><b></b><em></em></div>
      </div>
      <div class="game__toast" role="status" aria-live="polite"></div>
      <div class="game__pedals">
        <button type="button" class="game__pedal game__pedal--brake" aria-label="Brake"><span>BRAKE</span><kbd>S / &darr;</kbd></button>
        <button type="button" class="game__pedal game__pedal--gas" aria-label="Accelerate"><span>GAS</span><kbd>W / &uarr; / Space</kbd></button>
      </div>
      <button type="button" class="game__exit">Exit <kbd>Esc</kbd></button>
      <div class="game__fade"></div>
      <div class="game__over" role="dialog" aria-modal="true" aria-labelledby="game-over-quote" hidden>
        <p class="game__kicker"></p>
        <h2 class="game__quote" id="game-over-quote"></h2>
        <p class="game__summary"></p>
        <dl class="game__result"></dl>
        <div class="game__board-wrap">
          <h3>Your leaderboard</h3>
          <table class="game__board">
            <thead><tr><th scope="col">#</th><th scope="col">Distance</th><th scope="col">Time</th><th scope="col">Avg</th><th scope="col">Top</th><th scope="col">When</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="game__actions">
          <button type="button" class="game__again">Drive again <kbd>Enter</kbd></button>
          <button type="button" class="game__back">Back to the site <kbd>Esc</kbd></button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const q = (s) => root.querySelector(s);
    this.$hud = q('.game__hud');
    this.$top = q('.game__top');
    this.$time = q('.game__stat--time b');
    this.$timeBox = q('.game__stat--time');
    this.$speed = q('.game__speed b');
    this.$dist = q('.game__stat--dist b');
    this.$note = q('.game__note');
    this.$arrow = q('.game__arrow');
    this.$noteMain = q('.game__note b');
    this.$noteSub = q('.game__note em');
    this.$best = q('.game__stat--best b');
    this.$toast = q('.game__toast');
    this.$fade = q('.game__fade');
    this.$over = q('.game__over');
    this.$again = q('.game__again');
    this.$back = q('.game__back');

    const pedal = (node, prop) => {
      const down = (e) => {
        e.preventDefault();
        this[prop] = true;
        node.classList.add('is-down');
        if (node.setPointerCapture && e.pointerId != null) {
          try {
            node.setPointerCapture(e.pointerId);
          } catch (err) {
            /* not capturable: fine */
          }
        }
      };
      const up = () => {
        this[prop] = false;
        node.classList.remove('is-down');
      };
      node.addEventListener('pointerdown', down);
      node.addEventListener('pointerup', up);
      node.addEventListener('pointercancel', up);
      node.addEventListener('lostpointercapture', up);
      node.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    this.$gas = q('.game__pedal--gas');
    this.$brake = q('.game__pedal--brake');
    pedal(this.$gas, '_pGas');
    pedal(this.$brake, '_pBrake');
    q('.game__exit').addEventListener('click', () => this.exit());
    this.$again.addEventListener('click', () => this.restart());
    this.$back.addEventListener('click', () => this.exit());
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
    if (this.state === 'over') {
      if (k === 'Tab') {
        // two buttons, one dialog: keep focus between them
        e.preventDefault();
        (document.activeElement === this.$again ? this.$back : this.$again).focus();
      } else if ((k === 'Enter' || k === ' ') && document.activeElement !== this.$back) {
        e.preventDefault();
        this.restart();
      }
      return;
    }
    const code = e.code;
    const isGas = code === 'ArrowUp' || code === 'KeyW' || code === 'Space';
    const isBrake = code === 'ArrowDown' || code === 'KeyS' || code === 'ShiftLeft' || code === 'ShiftRight';
    if (isGas || isBrake) {
      e.preventDefault();
      this.keys.add(isGas ? 'gas' : 'brake');
    }
  }

  _onKeyUp(e) {
    const code = e.code;
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') this.keys.delete('gas');
    if (code === 'ArrowDown' || code === 'KeyS' || code === 'ShiftLeft' || code === 'ShiftRight') this.keys.delete('brake');
  }

  _release() {
    this.keys.clear();
    this._pGas = this._pBrake = false;
    this.$gas.classList.remove('is-down');
    this.$brake.classList.remove('is-down');
  }

  /* ---------------------------------------------------------- lifecycle */
  toggle() {
    if (this.state === 'idle') this.start();
    else this.exit();
  }

  start() {
    if (this.state !== 'idle') return;
    const e = this.engine;
    this.state = 'intro';
    this.t = 0;
    this.root.hidden = false;
    this.$over.hidden = true;
    this._live(false);
    this.hud.setEnabled(false);
    e.controller = this;
    e.setGameView(true);
    e.fastWipers = true;
    e.startPulse = 1;
    e.startPressed = 1;
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
    this.state = 'intro';
    this.t = 0.2; // the screen is already dark; skip most of the fade
    this.$fade.style.opacity = '1';
  }

  exit() {
    if (this.state === 'idle') return;
    const e = this.engine;
    this.state = 'idle';
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this._release();
    // hand the car back to the scroll cruise, on the road, wherever the run ended
    const car = e.car;
    car.free = null;
    car.s = Math.max(30, this.sim.s);
    car.v = 9;
    car.off = 0;
    car.yaw = 0;
    car.shake = 0;
    e.world.stream(car.s, true);
    e.controller = e.cruise;
    e.rpmOverride = null;
    e.setGameView(false);
    e.fastWipers = false;
    this.$fade.style.opacity = '0';
    this.$over.hidden = true;
    this.root.hidden = true;
    this.hud.setEnabled(true);
    this.hud.active = -1; // re-announce the current waypoint on the dash screen
    this.hud.measure();
    if (this.onExit) this.onExit();
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
    car.accel = 0;
    car.shake = 0;
    car.throttle = 0;
    car.brake = 0;
    e.gear = 1;
    e.world.stream(car.s, true);
    const best = this.board()[0];
    this.$best.textContent = best ? fmtDist(best.d) : '—';
    const st = e.screenState;
    st.title = 'SPORT';
    st.footer = best ? `BEST ${fmtDist(best.d)} ${UNITS.dist}` : 'NO RECORD YET';
    this._hudText(true);
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
          this.state = 'boot';
          this.t = 0;
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
          this.state = 'ready';
          this._toast(this._coarse() ? 'Hold GAS to go. Brake before the bends.' : 'Hold W, ↑ or Space to go. S or ↓ brakes. Slow down before the bends.');
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
      default:
        car.shake = 0;
    }
  }

  _live(on) {
    this.$hud.classList.toggle('is-live', on);
    this.$top.classList.toggle('is-live', on);
  }

  _coarse() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }

  _drive(dt, engine) {
    const sim = this.sim;
    const car = engine.car;
    const gas = this.keys.has('gas') || !!this._pGas;
    const brake = this.keys.has('brake') || !!this._pBrake;
    if (this.state === 'ready' && gas) {
      this.state = 'run';
      this._toast('');
    }
    this.acc += dt;
    while (this.acc >= H) {
      this.acc -= H;
      const ev = sim.step(H, gas, brake);
      if (!ev) continue;
      if (ev.type === 'checkpoint') {
        this._toast(`CHECKPOINT ${ev.n}  +${ev.bonus.toFixed(1)}s`, 1800);
      } else if (ev.type === 'off') {
        this._beginCrash(ev.side, engine);
        return;
      } else if (ev.type === 'timeout') {
        this._finish('time');
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
    car.free = null;
    this._hudText(false);
  }

  _hudText(force) {
    const e = this.engine;
    if (!force && e.time - this._textAt < 0.07) return;
    this._textAt = e.time;
    const sim = this.sim;
    this.$speed.textContent = String(fmtSpeed(sim.v));
    this.$dist.textContent = fmtDist(sim.distance);
    this.$time.textContent = sim.left.toFixed(1);
    this.$timeBox.classList.toggle('is-low', sim.started && sim.left < 8);

    let state = 'ok';
    let main = 'CLEAR';
    let sub = '';
    let arrow = '';
    if (sim.expired) {
      state = 'brake';
      main = 'OUT OF TIME';
    } else {
      const la = sim.lookahead();
      const ratio = sim.v / Math.max(1, la.allow);
      if (la.corner) {
        arrow = la.corner.dir > 0 ? '↱' : '↰';
        main = (la.corner.dir > 0 ? 'RIGHT ' : 'LEFT ') + fmtSpeed(la.corner.speed);
        sub = Math.round((la.corner.dist * UNITS.shortPerM) / 10) * 10 + ' ' + UNITS.shortDist;
      }
      if (sim.slip > 0.3) {
        state = 'brake';
        main = 'TRACTION';
      } else if (ratio > 0.985) {
        state = 'brake';
        main = 'BRAKE';
      } else if (ratio > 0.9) {
        state = 'lift';
      }
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
    this.state = 'crash';
    this.t = 0;
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
    this._reason = 'fell';
    engine.car.free = { pos: this.cpos, quat: this.cquat };
    this._toast('');
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
    if (t >= dur) this._finish('fell');
  }

  /* --------------------------------------------------------------- over */
  _finish(reason) {
    const sim = this.sim;
    this.state = 'over';
    this._release();
    this.engine.car.shake = 0;
    this.$fade.style.opacity = '0.82';
    this._live(false);
    this._toast('');

    const run = { d: Math.round(sim.distance * 10) / 10, t: Math.round(sim.time * 10) / 10, top: Math.round(sim.top * 100) / 100, at: Date.now(), why: reason };
    const board = this.board();
    const prevBest = board[0] ? board[0].d : 0;
    let rank = -1;
    if (run.d >= 5) {
      board.push(run);
      board.sort((a, b) => b.d - a.d || a.t - b.t);
      board.length = Math.min(board.length, BOARD_SIZE);
      rank = board.indexOf(run);
      save(BOARD_KEY, board);
    }

    const q = (s) => this.$over.querySelector(s);
    const fell = reason === 'fell';
    q('.game__kicker').textContent = fell ? 'OFF THE ROAD' : 'OUT OF TIME';
    q('.game__quote').textContent = nextQuote(fell ? 'fall' : 'time', fell ? FALL_QUOTES : TIME_QUOTES);
    const avg = run.t > 0.5 ? run.d / run.t : 0;
    const record = rank === 0 && run.d > prevBest;
    q('.game__summary').innerHTML =
      `You made it <b>${fmtDist(run.d)} ${UNITS.dist}</b> in <b>${fmtTime(run.t)}</b>.` +
      (record ? ' <span class="game__record">New personal best</span>' : rank > 0 ? ` <span class="game__record game__record--minor">#${rank + 1} on your board</span>` : '');
    q('.game__result').innerHTML =
      `<div><dt>Distance</dt><dd>${fmtDist(run.d)}<i>${UNITS.dist}</i></dd></div>` +
      `<div><dt>Time</dt><dd>${fmtTime(run.t)}</dd></div>` +
      `<div><dt>Average</dt><dd>${fmtSpeed(avg)}<i>${UNITS.speed}</i></dd></div>` +
      `<div><dt>Top speed</dt><dd>${fmtSpeed(run.top)}<i>${UNITS.speed}</i></dd></div>`;
    const body = q('.game__board tbody');
    body.innerHTML = board.length
      ? board
          .map((r, i) => {
            const when = new Date(r.at);
            const date = isNaN(when) ? '' : when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return `<tr class="${i === rank ? 'is-current' : ''}"><td>${i + 1}</td><td>${fmtDist(r.d)} ${UNITS.dist}</td><td>${fmtTime(r.t)}</td><td>${fmtSpeed(r.t > 0.5 ? r.d / r.t : 0)} ${UNITS.speed}</td><td>${fmtSpeed(r.top || 0)} ${UNITS.speed}</td><td>${date}</td></tr>`;
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
