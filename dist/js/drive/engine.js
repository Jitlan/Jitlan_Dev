/* ==========================================================================
   Drive — renderer and frame loop
   --------------------------------------------------------------------------
   Three passes per frame:
     1. the world, into an off-screen target (with mipmaps, for cheap blur)
     2. the wet windshield, refracting that target onto the screen
     3. the cabin, drawn crisp on top
   Whoever is "driving" (scroll cruise or the game) just moves `car`.
   ========================================================================== */

import {
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Object3D,
  PMREMGenerator,
  PerspectiveCamera,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from '../vendor/three.module.min.js';
import { ROAD, Road } from './road.js';
import { World, makeEnvScene } from './world.js';
import { CAR_CENTER_X, Interior, START_BUTTON_POS, buildExterior } from './interior.js';
import { GlassPass, WiperClock } from './glass.js';
import { clamp, damp, fmtSpeed, lerp, roundRect, smoothstep } from './util.js';

const EYE_HEIGHT = 1.12;
// headlamp position relative to the driver's eye: out at the nose, one per front corner
const LAMP_X = 0.66;
const LAMP_Y = -0.5;
const LAMP_Z = -3.3;
const GEAR_TOP = [0, 17, 30, 44, 58, 72, 88, 112]; // m/s at the redline, gears 1-7
const REDLINE = 7400;

const QUALITY = {
  desktop: { trees: 84, rain: 2200, leaves: 150, view: 470, dprCap: 2, maxPixels: 2.8e6, rtScale: 1, msaa: 0 },
  mobile: { trees: 46, rain: 1000, leaves: 70, view: 400, dprCap: 2, maxPixels: 1.5e6, rtScale: 0.8, msaa: 0 },
};

/**
 * Camera framing for a given aspect ratio. Tall screens sit further back so
 * the whole wheel shows. While reading (cruise) the view is nearly level to
 * leave the glass free for the HUD; in the game it tips down to the gauges.
 */
function rigFor(aspect) {
  const t = smoothstep(0.62, 1.5, aspect);
  return {
    fov: lerp(76, 54, t),
    back: lerp(0.4, 0, t),
    up: lerp(0.1, 0.012, t),
    pitchCruise: lerp(0.03, -0.022, t),
    pitchGame: lerp(-0.03, -0.105, t),
  };
}

/** Default driver: an easy cruise that scrolling pushes along. */
export class Cruise {
  constructor() {
    this.boost = 0;
  }

  /** @param {number} px signed scroll delta in CSS pixels */
  feed(px) {
    this.boost = clamp(this.boost + px * 0.024, -6.5, 30);
  }

  update(dt, engine) {
    const car = engine.car;
    const target = 9 + this.boost;
    const a = clamp((target - car.v) * 0.9, -6, 4.6);
    car.v = Math.max(0, car.v + a * dt);
    car.s += car.v * dt;
    car.accel = a;
    car.throttle = clamp(a / 4.6, 0, 1);
    car.brake = clamp(-a / 6, 0, 1);
    // wherever the game left the car (the café's lot, say), ease it back into its lane
    car.steer = damp(car.steer, clamp(-car.off * 0.12, -0.9, 0.9), 4, dt);
    car.off = damp(car.off, 0, car.v > 1 ? 1.1 : 0, dt);
    car.yaw = damp(car.yaw, 0, 1.6, dt);
    car.shake = damp(car.shake, 0, 6, dt);
    car.free = null;
    this.boost = damp(this.boost, 0, 0.9, dt);
  }
}

export class Engine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{mobile: boolean}} opts
   */
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.mobile = !!opts.mobile;
    this.quality = Object.assign({}, this.mobile ? QUALITY.mobile : QUALITY.desktop);
    this.scale = 1; // adaptive resolution multiplier
    this.time = 0;
    this.last = 0;
    this.running = false;
    this.night = 0;
    this.nightTarget = 0;
    this.frames = 0;

    const renderer = (this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    }));
    renderer.autoClear = false;
    renderer.setClearColor(0x0b0e11, 1);

    this.road = new Road(911);
    this.world = new World(this.road, this.quality);
    this.interior = new Interior();
    this.exterior = buildExterior();
    this.glass = new GlassPass();
    this.wiper = new WiperClock();

    this.carObj = new Object3D();
    this.carObj.rotation.order = 'YXZ';
    this.world.scene.add(this.carObj);
    this.carObj.add(this.exterior.group);
    this.camWorld = new PerspectiveCamera(50, 1, 0.5, 1600);
    this.camWorld.rotation.order = 'YXZ';
    this.carObj.add(this.camWorld);
    this.camInt = new PerspectiveCamera(50, 1, 0.03, 12);
    this.camInt.rotation.order = 'YXZ';
    this.camProbe = new PerspectiveCamera(50, 1, 0.03, 12);
    this.camProbe.rotation.order = 'YXZ';

    // one reflection environment baked from the sky, shared by paint, leather and metal
    const pmrem = new PMREMGenerator(renderer);
    this.env = pmrem.fromScene(makeEnvScene(this.world), 0, 0.1, 100);
    pmrem.dispose();
    this.interior.setEnvironment(this.env.texture);
    this.exterior.paint.envMap = this.env.texture;

    const gl = renderer.getContext();
    const half = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    this.rt = new WebGLRenderTarget(4, 4, {
      type: half ? HalfFloatType : UnsignedByteType,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: true,
      depthBuffer: true,
      samples: this.quality.msaa,
    });
    if (!half) this.rt.texture.colorSpace = SRGBColorSpace;

    // s: distance along the road; off: metres right of the lane centre; yaw: heading relative to the road;
    // steer: extra turn on the wheel beyond what the road asks for; free: a pose override while crashing
    this.car = { s: 30, v: 9, accel: 0, throttle: 0, brake: 0, off: 0, shake: 0, yaw: 0, steer: 0, free: null };
    this.gear = 2;
    this.rpm = 1400;
    this.cruise = new Cruise();
    this.controller = this.cruise;
    this.fastWipers = false;
    this.gameView = 0; // 0 = reading view, 1 = driving view
    this.gameViewTarget = 0;
    this.rpmOverride = null;
    this.lookGain = 0.3;
    this.startPulse = 0;
    this.startPressed = 0;

    this.look = { yaw: 0, pitch: 0, cornerYaw: 0, px: 0, py: 0 };
    this.hudShift = { x: 0, y: 0 };
    this.startScreen = { x: 0, y: 0, r: 20, visible: false };
    this.screenState = { title: '', footer: '', temp: '' }; // what the dash display shows; the HUD and game write to it
    this._screenAt = 0;
    this._slow = 0;

    this._p = {};
    this._fwd = new Vector3();
    this._v = new Vector3();
    this.lamps = { left: new Vector3(), right: new Vector3(), f: new Vector3(), r: new Vector3(), u: new Vector3() };
    this.beamYaw = 0;
    this.rig = rigFor(1.6);

    this.onLayout = null;
    this.onFrame = null;

    this._frame = this._frame.bind(this);
    this.resize();
    this.setNight(this.nightTarget, true);
    this.world.stream(this.car.s, true);
  }

  /* -------------------------------------------------------------- sizing */
  resize() {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.width = w;
    this.height = h;
    let dpr = Math.min(window.devicePixelRatio || 1, this.quality.dprCap);
    if (w * h * dpr * dpr > this.quality.maxPixels) dpr = Math.sqrt(this.quality.maxPixels / (w * h));
    dpr *= this.scale;
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const rw = Math.max(2, Math.round(w * dpr * this.quality.rtScale));
    const rh = Math.max(2, Math.round(h * dpr * this.quality.rtScale));
    this.rt.setSize(rw, rh);
    this.glass.uniforms.uMaxLod.value = Math.log2(Math.max(rw, rh)) - 3;

    const aspect = w / h;
    this.rig = rigFor(aspect);
    for (const cam of [this.camWorld, this.camInt, this.camProbe]) {
      cam.fov = this.rig.fov;
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }
    this.focalPx = h / 2 / Math.tan((this.rig.fov * Math.PI) / 360);
    // from the pulled-back portrait seat the mirror would hang in the middle of the view
    this.interior.mirror.visible = this.rig.back < 0.15;
    if (this.onLayout) this.onLayout(this.layout());
  }

  /** Project an eye-space point to CSS pixels using the resting camera (no look offsets). */
  projectRest(x, y, z, game = false) {
    const cam = this.camProbe;
    cam.position.set(0, this.rig.up, this.rig.back);
    cam.rotation.set(game ? this.rig.pitchGame : this.rig.pitchCruise, 0, 0);
    cam.updateMatrixWorld();
    const v = this._v.set(x, y, z).project(cam);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height };
  }

  /** Where the cabin sits on screen, so the DOM HUD can stay inside the glass. */
  layout(game = false) {
    const hood = this.projectRest(0, -0.118, -0.7, game); // top of the instrument cowl
    const rim = this.projectRest(0, -0.052, -0.538, game); // top of the wheel rim
    const dashR = this.projectRest(0.75, -0.211, -0.71, game); // dash top, passenger side
    const pillar = this.projectRest(-0.46, -0.1, -1.06, game); // driver's A-pillar, low
    const cowlR = this.projectRest(0.26, -0.238, -0.7, game); // right foot of the cowl
    const mirror = this.projectRest(CAR_CENTER_X, 0.165, -0.6, game);
    const horizon = this.projectRest(0, this.rig.up, -100, game);
    return {
      width: this.width,
      height: this.height,
      cowlTop: Math.min(hood.y, rim.y),
      dashRight: dashR.y,
      cowlRight: cowlR.x,
      pillarX: pillar.x,
      mirrorBottom: mirror.y,
      mirrorX: mirror.x,
      horizon: horizon.y,
    };
  }

  /** Tip the camera between the reading view and the driving view. */
  setGameView(on) {
    this.gameViewTarget = on ? 1 : 0;
    this.lookGain = on ? 1 : 0.3;
  }

  /* --------------------------------------------------------------- theme */
  setNight(on, instant = false) {
    this.nightTarget = on ? 1 : 0;
    if (instant) {
      this.night = this.nightTarget;
      this._applyNight();
    }
  }

  _applyNight() {
    const t = this.night;
    this.world.setNight(t);
    this.interior.setNight(t);
    this.exterior.paint.envMapIntensity = lerp(0.24, 0.05, t);
    const mf = lerp(1, 0.12, t);
    this.exterior.mirrorFace.color.setRGB(0.1 * mf, 0.125 * mf, 0.145 * mf);
    this.glass.uniforms.uNight.value = t;
  }

  /* ---------------------------------------------------------------- loop */
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setPointer(nx, ny) {
    this.look.px = nx;
    this.look.py = ny;
  }

  _frame(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this._frame);
    const raw = (now - this.last) / 1000;
    this.last = now;
    if (document.hidden) return;
    const dt = clamp(raw, 0.001, 0.05);
    this.step(dt);
    this.render();
    this.frames++;
    this._adapt(raw);
    if (this.onFrame) this.onFrame(dt);
  }

  /** Advance everything by dt seconds (no drawing). */
  step(dt) {
    this.time += dt;

    if (this.night !== this.nightTarget) {
      const d = Math.sign(this.nightTarget - this.night) * dt * 0.9;
      this.night = clamp(this.night + d, 0, 1);
      if (Math.abs(this.nightTarget - this.night) < 0.01) this.night = this.nightTarget;
      this._applyNight();
    }

    this.controller.update(dt, this);
    this._drivetrain(dt);
    this._pose(dt);

    const car = this.car;
    this.world.stream(car.s);
    this._aimLamps(dt);
    this.camWorld.getWorldPosition(this._v);
    this.world.update(dt, this._v, this._fwd, car.v, this.lamps);

    this.wiper.setPeriod(this.fastWipers || car.v > 24 ? 1.5 : 3.3);
    this.wiper.step(dt);
    const p = this._p;
    this.startPulse = damp(this.startPulse, 0, 2.5, dt);
    this.startPressed = damp(this.startPressed, 0, 9, dt);
    this.interior.update({
      steer: clamp(Math.atan(2.45 * p.k) * 13.5 + car.steer, -2.4, 2.4) + (Math.sin(this.time * 31) * 0.05 + Math.sin(this.time * 47) * 0.03) * car.shake,
      rpm: this.rpm,
      speed: car.v,
      wiper: this.wiper.angle(),
      time: this.time,
      pulse: this.startPulse,
      pressed: this.startPressed,
    });
    this.interior.setDigital(fmtSpeed(car.v), car.v < 0.3 && car.throttle < 0.05 ? 'P' : this.gear);

    if (this.time - this._screenAt > 0.125) {
      this._screenAt = this.time;
      this._drawScreen();
    }
  }

  /** Two headlamps at the front corners; the beams swivel a few degrees into the bend ahead. */
  _aimLamps(dt) {
    const m = this.carObj.matrixWorld.elements;
    const L = this.lamps;
    L.left.set(CAR_CENTER_X - LAMP_X, LAMP_Y, LAMP_Z).applyMatrix4(this.carObj.matrixWorld);
    L.right.set(CAR_CENTER_X + LAMP_X, LAMP_Y, LAMP_Z).applyMatrix4(this.carObj.matrixWorld);
    const ahead = this.car.free ? 0 : this.road.curvature(this.car.s + 30);
    this.beamYaw = damp(this.beamYaw, clamp(ahead * 9, -0.2, 0.2), 4, dt);
    const c = Math.cos(this.beamYaw);
    const s = Math.sin(this.beamYaw);
    // car axes in world space: +X right, +Y up, -Z forward
    L.u.set(m[4], m[5], m[6]).normalize();
    L.f.set(-m[8] * c + m[0] * s, -m[9] * c + m[1] * s, -m[10] * c + m[2] * s).normalize();
    L.r.crossVectors(L.f, L.u).normalize();
  }

  /** Seven-speed auto: just enough of a gearbox to make the tach dance. */
  _drivetrain(dt) {
    const car = this.car;
    let g = this.gear;
    const calc = (gear) => (car.v / GEAR_TOP[gear]) * REDLINE;
    let target = calc(g);
    const upAt = car.throttle > 0.7 ? 7000 : 2600 + 3200 * car.throttle;
    const downAt = car.throttle > 0.7 ? 3800 : 1500;
    if (target > upAt && g < 7) g++;
    else if (g > 1 && calc(g - 1) < (car.throttle > 0.7 ? 6200 : downAt * 1.9) && target < downAt) g--;
    this.gear = g;
    target = Math.max(calc(g), 850 + car.throttle * 500);
    if (this.rpmOverride != null) target = this.rpmOverride;
    this.rpm = damp(this.rpm, clamp(target, 0, 8200), this.rpmOverride != null ? 7 : 9, dt);
  }

  _pose(dt) {
    const car = this.car;
    const p = this.road.at(car.s, this._p);
    const rx = Math.cos(p.th);
    const rz = Math.sin(p.th);
    const bank = this.road.bank(p.k);
    const fwd = this._fwd;

    if (car.free) {
      this.carObj.position.copy(car.free.pos);
      this.carObj.quaternion.copy(car.free.quat);
      fwd.set(0, 0, -1).applyQuaternion(this.carObj.quaternion);
    } else {
      const lat = ROAD.LANE + car.off - CAR_CENTER_X;
      const latAcc = clamp(car.v * car.v * p.k, -12, 12);
      this.carObj.position.set(p.x + rx * lat, p.y - lat * bank + EYE_HEIGHT, p.z + rz * lat);
      this.carObj.rotation.set(Math.atan(p.g) + clamp(car.accel, -11, 7) * 0.0032, -p.th - car.yaw, -bank + latAcc * 0.0032);
      fwd.set(Math.sin(p.th), p.g, -Math.cos(p.th)).normalize();
    }

    // eyes lead into the corner a little; the mouse nudges the view
    const ahead = this.road.curvature(car.s + 24);
    const look = this.look;
    look.cornerYaw = damp(look.cornerYaw, clamp(-(p.k * 0.4 + ahead * 0.6) * 4.6, -0.15, 0.15) * this.lookGain, 3, dt);
    look.yaw = damp(look.yaw, -look.px * 0.045, 4, dt);
    look.pitch = damp(look.pitch, -look.py * 0.022, 4, dt);
    const speedK = smoothstep(2, 45, car.v);
    const t = this.time;
    const bobY = (Math.sin(t * 9.1) * 0.0012 + Math.sin(t * 23.7) * 0.0006) * speedK + (Math.sin(t * 37) * 0.006 + Math.sin(t * 53) * 0.004) * car.shake;
    const bobX = Math.sin(t * 41) * 0.005 * car.shake;
    const rig = this.rig;
    const yaw = look.cornerYaw + look.yaw;
    this.gameView = damp(this.gameView, this.gameViewTarget, 3.2, dt);
    const restPitch = lerp(rig.pitchCruise, rig.pitchGame, this.gameView);
    const pitch = restPitch + look.pitch - clamp(car.accel, -11, 7) * 0.0011;
    for (const cam of [this.camInt, this.camWorld]) {
      cam.position.set(bobX, rig.up + bobY, rig.back);
      cam.rotation.set(pitch, yaw, Math.sin(t * 29) * 0.004 * car.shake);
    }
    this.camInt.updateMatrixWorld();
    this.carObj.updateMatrixWorld(true);

    // the DOM HUD is "painted on the glass": it moves with the cabin, not the head
    this.hudShift.x = yaw * this.focalPx;
    this.hudShift.y = (pitch - restPitch) * this.focalPx;

    const v = this._v.copy(START_BUTTON_POS).project(this.camInt);
    const ss = this.startScreen;
    ss.x = (v.x * 0.5 + 0.5) * this.width;
    ss.y = (-v.y * 0.5 + 0.5) * this.height;
    ss.r = (0.027 / Math.max(0.2, START_BUTTON_POS.distanceTo(this.camInt.position))) * this.focalPx;
    ss.visible = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
  }

  render() {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(this.world.scene, this.camWorld);
    r.setRenderTarget(null);

    const g = this.glass;
    g.setView(this.camInt);
    g.uniforms.uTime.value = this.time;
    g.uniforms.uSpeed.value = smoothstep(7, 30, this.car.v);
    this.wiper.write(g.uniforms.uCycle.value);
    g.render(r, this.rt.texture, this.rt.width, this.rt.height);

    r.clearDepth();
    r.render(this.interior.scene, this.camInt);
  }

  /** Drop resolution a notch if the device can't hold a steady frame rate. */
  _adapt(rawDt) {
    if (this.frames < 40 || rawDt > 0.25) return; // warm-up, or a pause (tab switch) rather than a slow frame
    this._slow = damp(this._slow, rawDt, 1.5, rawDt);
    // sustained sub-25fps: 30fps-capped devices (low power mode) are left alone
    if (this._slow > 0.04 && this.scale > 0.6 && this.frames % 90 === 0) {
      this.scale = Math.max(0.6, this.scale * 0.85);
      this.resize();
    }
  }

  /* ---------------------------------------------------- the dash display */
  _drawScreen() {
    const g = this.interior.screenCtx;
    const W = 640;
    const H = 224;
    const st = this.screenState;
    g.fillStyle = '#07090b';
    g.fillRect(0, 0, W, H);

    // left: clock + weather
    const d = new Date();
    const hh = d.getHours();
    const mm = d.getMinutes();
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = '#f2efe8';
    g.font = '600 54px Inter, Helvetica, Arial, sans-serif';
    const clock = ((hh + 11) % 12) + 1 + ':' + (mm < 10 ? '0' : '') + mm;
    g.fillText(clock, 26, 78);
    const clockW = g.measureText(clock).width;
    g.font = '500 20px Inter, Helvetica, Arial, sans-serif';
    g.fillStyle = '#8fa3ad';
    g.fillText(hh < 12 ? 'AM' : 'PM', 34 + clockW, 78);
    g.fillStyle = '#7fe3ff';
    g.font = '600 22px "JetBrains Mono", ui-monospace, monospace';
    g.fillText('RAIN  ' + (st.temp || '52°F'), 26, 118);
    g.fillStyle = '#8fa3ad';
    g.font = '500 19px Inter, Helvetica, Arial, sans-serif';
    g.fillText('Wet roads · leaves down', 26, 148);
    g.fillStyle = '#ffb454';
    g.font = '600 19px "JetBrains Mono", ui-monospace, monospace';
    g.fillText(st.footer || '', 26, 192);

    // right: heading-up map of the road ahead
    const mx = 470;
    const my = 178;
    g.save();
    g.beginPath();
    roundRect(g, 326, 14, 300, 196, 14);
    g.fillStyle = '#0e1418';
    g.fill();
    g.clip();
    const car = this.car;
    const p = this.road.at(car.s, this._p);
    const cs = Math.cos(p.th);
    const sn = Math.sin(p.th);
    const ox = p.x;
    const oz = p.z;
    const q = {};
    g.lineJoin = 'round';
    g.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      for (let ds = -30; ds <= 420; ds += 10) {
        this.road.at(Math.max(0, car.s + ds), q);
        const dx = q.x - ox;
        const dz = q.z - oz;
        const lx = dx * cs + dz * sn; // right of the car
        const ly = dx * sn - dz * cs; // ahead of the car
        const X = mx + lx * 0.42;
        const Y = my - ly * 0.42;
        if (ds === -30) g.moveTo(X, Y);
        else g.lineTo(X, Y);
      }
      g.strokeStyle = pass === 0 ? '#243038' : '#d7e3ea';
      g.lineWidth = pass === 0 ? 15 : 4;
      g.stroke();
    }
    g.fillStyle = '#ff7a2f';
    g.beginPath();
    g.moveTo(mx, my - 11);
    g.lineTo(mx + 8, my + 8);
    g.lineTo(mx, my + 3);
    g.lineTo(mx - 8, my + 8);
    g.closePath();
    g.fill();
    g.restore();
    g.fillStyle = '#8fa3ad';
    g.font = '600 15px "JetBrains Mono", ui-monospace, monospace';
    g.textAlign = 'right';
    g.fillText(st.title || '', 614, 38);
    this.interior.screenTex.needsUpdate = true;
  }

  dispose() {
    this.stop();
    this.rt.dispose();
    this.env.dispose();
    this.renderer.dispose();
  }
}
