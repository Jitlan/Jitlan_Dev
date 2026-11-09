/* ==========================================================================
   Drive — the cabin
   --------------------------------------------------------------------------
   Everything is modelled in "eye space": the origin is the driver's resting
   eye point, +X right, +Y up, -Z out through the windshield. The car is
   left-hand drive, so its centreline sits at x = +0.36.
   ========================================================================== */

import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  TorusGeometry,
  Vector3,
} from '../vendor/three.module.min.js';
import { IMPERIAL, TAU, UNITS, clamp, lerp, mulberry32 } from './util.js';

export const CAR_CENTER_X = 0.36;

/* The windshield as a plane: origin at the base, U across, V up the glass. */
export const GLASS = (() => {
  const origin = new Vector3(CAR_CENTER_X, -0.262, -1.36);
  const u = new Vector3(1, 0, 0);
  const v = new Vector3(0, 0.532, 0.84).normalize();
  const n = new Vector3().crossVectors(u, v);
  return { origin, u, v, n };
})();

/* Two tandem wipers, parked pointing at the passenger side. */
export const WIPERS = [
  { pivot: [-0.8, 0.03], r0: 0.13, r1: 0.71 },
  { pivot: [-0.07, 0.03], r0: 0.12, r1: 0.6 },
];
export const WIPER_SWEEP = [0.06, 1.5]; // radians, parked → top of stroke

export const START_BUTTON_POS = new Vector3(-0.335, -0.284, -0.626);

/* --------------------------------------------------------------------------
   Canvas textures
   -------------------------------------------------------------------------- */
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function leatherGrain() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  const rand = mulberry32(42);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 1.5 + rand() * 3.5;
    const v = Math.floor(96 + rand() * 80);
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.6 + rand() * 0.6), rand() * 3.14, 0, TAU);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

function stitchTexture() {
  const c = canvas(64, 8);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 8);
  g.fillStyle = '#ffffff';
  g.fillRect(6, 1, 40, 6);
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  return t;
}

const DIAL_START = 135; // canvas degrees (clockwise, 0 = +x)
const DIAL_SWEEP = 270;

function dialTexture(opt) {
  const S = 512;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const R = S / 2;
  g.translate(R, R);
  const grad = g.createRadialGradient(0, -R * 0.2, R * 0.1, 0, 0, R);
  grad.addColorStop(0, opt.face[0]);
  grad.addColorStop(1, opt.face[1]);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.fill();
  const span = opt.max - opt.min;
  const ang = (v) => ((DIAL_START + (DIAL_SWEEP * (v - opt.min)) / span) * Math.PI) / 180;
  if (opt.redFrom != null) {
    g.strokeStyle = '#c8281e';
    g.lineWidth = R * 0.07;
    g.beginPath();
    g.arc(0, 0, R * 0.86, ang(opt.redFrom), ang(opt.max));
    g.stroke();
  }
  g.strokeStyle = opt.ink;
  g.fillStyle = opt.ink;
  g.lineCap = 'butt';
  for (let v = opt.min; v <= opt.max + 1e-6; v += opt.minor) {
    const major = Math.abs(v / opt.major - Math.round(v / opt.major)) < 1e-6;
    const a = ang(v);
    g.lineWidth = major ? R * 0.028 : R * 0.012;
    g.beginPath();
    g.moveTo(Math.cos(a) * R * (major ? 0.74 : 0.82), Math.sin(a) * R * (major ? 0.74 : 0.82));
    g.lineTo(Math.cos(a) * R * 0.91, Math.sin(a) * R * 0.91);
    g.stroke();
  }
  g.font = `600 ${Math.round(R * (opt.labelSize || 0.17))}px Inter, Helvetica, Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let v = opt.min; v <= opt.max + 1e-6; v += opt.labelEvery || opt.major) {
    const a = ang(v);
    g.fillText(String(Math.round(v / (opt.labelDiv || 1))), Math.cos(a) * R * 0.57, Math.sin(a) * R * 0.57);
  }
  if (opt.title) {
    g.font = `500 ${Math.round(R * 0.085)}px Inter, Helvetica, Arial, sans-serif`;
    g.globalAlpha = 0.75;
    g.fillText(opt.title, 0, -R * 0.3);
    g.globalAlpha = 1;
  }
  // hub
  g.fillStyle = '#0c0c0d';
  g.beginPath();
  g.arc(0, 0, R * 0.13, 0, TAU);
  g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function crestTexture() {
  const c = canvas(128, 160);
  const g = c.getContext('2d');
  const shield = () => {
    g.beginPath();
    g.moveTo(10, 10);
    g.lineTo(118, 10);
    g.lineTo(118, 86);
    g.quadraticCurveTo(118, 132, 64, 152);
    g.quadraticCurveTo(10, 132, 10, 86);
    g.closePath();
  };
  shield();
  const grad = g.createLinearGradient(0, 0, 128, 160);
  grad.addColorStop(0, '#e6c36a');
  grad.addColorStop(0.5, '#b88a2c');
  grad.addColorStop(1, '#8a6218');
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#2a1d0c';
  g.stroke();
  g.fillStyle = '#20160a';
  g.font = '800 62px Inter, Helvetica, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('JL', 64, 74);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function startButtonTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.translate(128, 128);
  const grad = g.createRadialGradient(-20, -30, 10, 0, 0, 128);
  grad.addColorStop(0, '#2b2b2e');
  grad.addColorStop(1, '#0c0c0e');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, 128, 0, TAU);
  g.fill();
  g.fillStyle = '#f3efe6';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 34px Inter, Helvetica, Arial, sans-serif';
  g.fillText('ENGINE', 0, -46);
  g.font = '800 50px Inter, Helvetica, Arial, sans-serif';
  g.fillText('START', 0, 2);
  g.font = '700 34px Inter, Helvetica, Arial, sans-serif';
  g.fillText('STOP', 0, 50);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function mirrorTexture() {
  const c = canvas(256, 80);
  const g = c.getContext('2d');
  g.fillStyle = '#17110d';
  g.fillRect(0, 0, 256, 80);
  // rear window: grey light, blurred autumn behind
  const grad = g.createLinearGradient(0, 14, 0, 62);
  grad.addColorStop(0, '#9aa4a9');
  grad.addColorStop(1, '#5d6468');
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(52, 16, 152, 40, 10);
  g.fill();
  const rand = mulberry32(7);
  const tints = ['#b4581d', '#c78a22', '#8b2e19', '#31482f'];
  g.save();
  g.clip();
  for (let i = 0; i < 40; i++) {
    g.fillStyle = tints[Math.floor(rand() * tints.length)];
    g.globalAlpha = 0.5;
    g.beginPath();
    g.arc(52 + rand() * 152, 34 + rand() * 26, 5 + rand() * 9, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 0.9;
  g.fillStyle = '#34373a';
  g.fillRect(52, 50, 152, 8);
  g.restore();
  // headrests
  g.fillStyle = '#231710';
  g.beginPath();
  g.roundRect(70, 38, 34, 42, 8);
  g.roundRect(152, 38, 34, 42, 8);
  g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/* --------------------------------------------------------------------------
   Geometry helpers
   -------------------------------------------------------------------------- */
const UV_SCALE = 9;

/** Sweep a (z, y) profile along X. */
function ribbon(profile, x0, x1, segs = 1) {
  const pos = [];
  const uv = [];
  const idx = [];
  const lens = [0];
  for (let i = 1; i < profile.length; i++) {
    lens.push(lens[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  }
  const row = segs + 1;
  for (let i = 0; i < profile.length; i++) {
    for (let j = 0; j <= segs; j++) {
      const x = lerp(x0, x1, j / segs);
      pos.push(x, profile[i][1], profile[i][0]);
      uv.push(x * UV_SCALE, lens[i] * UV_SCALE);
    }
  }
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Parametric surface from f(u, v) → [x, y, z]. */
function surface(f, nu, nv) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const p = f(i / nu, j / nv);
      pos.push(p[0], p[1], p[2]);
      uv.push((i / nu) * 6, (j / nv) * 3);
    }
  }
  const row = nv + 1;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * row + j;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const _up = new Vector3(0, 1, 0);
function beam(a, b, w, d, mat) {
  const dir = new Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new Mesh(new BoxGeometry(w, len, d), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(_up, dir.normalize());
  return m;
}

function box(w, h, d, mat, x, y, z) {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/* ==========================================================================
   Interior
   ========================================================================== */
export class Interior {
  constructor() {
    this.scene = new Scene();
    this.night = 0;
    this.textures = [];

    const grain = leatherGrain();
    grain.repeat.set(1, 1);
    const stitchTex = stitchTexture();

    const mat = (this.mat = {
      leather: new MeshStandardMaterial({ color: '#4b2a17', roughness: 0.56, bumpMap: grain, bumpScale: 0.9, side: DoubleSide }),
      leatherDark: new MeshStandardMaterial({ color: '#331c10', roughness: 0.64, bumpMap: grain, bumpScale: 0.9, side: DoubleSide }),
      suede: new MeshStandardMaterial({ color: '#21150e', roughness: 0.96, side: DoubleSide }),
      satin: new MeshStandardMaterial({ color: '#17171a', roughness: 0.42, metalness: 0.35 }),
      alu: new MeshStandardMaterial({ color: '#c3c6c9', roughness: 0.3, metalness: 1 }),
      aluDark: new MeshStandardMaterial({ color: '#6f7377', roughness: 0.38, metalness: 1 }),
      black: new MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.55, side: DoubleSide }),
      gloss: new MeshStandardMaterial({ color: '#050506', roughness: 0.12, metalness: 0.2 }),
      rubber: new MeshStandardMaterial({ color: '#060607', roughness: 0.8 }),
      stitch: new MeshStandardMaterial({ color: '#dcc79c', roughness: 0.8, map: stitchTex, alphaTest: 0.5, side: DoubleSide }),
      cream: new MeshStandardMaterial({ color: '#d9c7a0', roughness: 0.6 }),
      needle: new MeshBasicMaterial({ color: '#ff5a1f' }),
      ambientLine: new MeshBasicMaterial({ color: '#ff9a3c' }),
    });

    this.hemi = new HemisphereLight('#d5dde3', '#2a1c14', 1.15);
    this.scene.add(this.hemi);
    this.key = new DirectionalLight('#eef3f6', 2.7);
    this.key.position.set(0.15, 1.0, -1.25); // daylight pouring through the glass
    this.scene.add(this.key);
    this.glow = new PointLight('#ffb070', 0, 0.9, 2);
    this.glow.position.set(0, -0.2, -0.62);
    this.scene.add(this.glow);

    this._buildDash();
    this._buildBinnacle();
    this._buildGauges();
    this._buildWheel();
    this._buildCentreStack();
    this._buildStartButton();
    this._buildShell();
    this._buildWipers();
  }

  add(...objs) {
    for (const o of objs) this.scene.add(o);
  }

  /* ---------------------------------------------------------------- dash */
  _buildDash() {
    const m = this.mat;
    const X0 = -0.44;
    const X1 = 1.16;
    const top = [
      [-1.36, -0.262],
      [-1.05, -0.236],
      [-0.8, -0.214],
      [-0.71, -0.211],
      [-0.668, -0.217],
      [-0.642, -0.236],
      [-0.632, -0.262],
      [-0.63, -0.318],
    ];
    const trim = [
      [-0.63, -0.318],
      [-0.646, -0.322],
      [-0.646, -0.362],
      [-0.628, -0.366],
    ];
    const lower = [
      [-0.628, -0.366],
      [-0.612, -0.42],
      [-0.586, -0.52],
      [-0.6, -0.66],
      [-0.64, -0.9],
    ];
    this.add(new Mesh(ribbon(top, X0, X1, 2), m.leather));
    this.add(new Mesh(ribbon(trim, X0, X1), m.aluDark));
    this.add(new Mesh(ribbon(lower, X0, X1, 2), m.leatherDark));

    // ambient light line tucked into the trim recess
    const line = box(X1 - X0, 0.004, 0.004, m.ambientLine, (X0 + X1) / 2, -0.358, -0.643);
    this.ambientLine = line;
    this.add(line);

    // contrast stitching along the rolled edge
    const stitch = (z, y, len, x) => {
      const g = new PlaneGeometry(len, 0.0035);
      g.attributes.uv.array.forEach((v, i, arr) => {
        if (i % 2 === 0) arr[i] = v * len * 110;
      });
      const s = new Mesh(g, m.stitch);
      s.position.set(x, y, z);
      s.rotation.x = -Math.PI / 2 + 0.25;
      return s;
    };
    this.add(stitch(-0.705, -0.2098, X1 - X0, (X0 + X1) / 2));
    this.add(stitch(-0.735, -0.2104, X1 - X0, (X0 + X1) / 2));

    // defroster slot at the base of the glass
    this.add(box(1.1, 0.004, 0.035, m.black, CAR_CENTER_X, -0.249, -1.2));

    // clock pod on the dash centreline
    const pod = new Group();
    pod.position.set(CAR_CENTER_X, -0.176, -0.83);
    pod.rotation.x = -0.2;
    pod.rotation.y = -0.38; // turned toward the driver
    const shell = new Mesh(new CylinderGeometry(0.046, 0.05, 0.05, 32), m.leather);
    shell.rotation.x = Math.PI / 2;
    pod.add(shell);
    const bezel = new Mesh(new TorusGeometry(0.041, 0.0035, 8, 40), m.alu);
    bezel.position.z = 0.026;
    pod.add(bezel);
    const face = new Mesh(
      new CircleGeometry(0.04, 40),
      new MeshBasicMaterial({
        map: dialTexture({ min: 0, max: 60, major: 5, minor: 1, labelEvery: 10, labelSize: 0.16, face: ['#161617', '#070708'], ink: '#efece4' }),
      }),
    );
    face.position.z = 0.0262;
    pod.add(face);
    this.clockHands = [];
    for (const [len, w] of [
      [0.022, 0.0032],
      [0.031, 0.0022],
      [0.034, 0.001],
    ]) {
      const hand = new Mesh(new BoxGeometry(w, len, 0.001), len > 0.033 ? m.needle : m.cream);
      hand.geometry.translate(0, len / 2 - 0.004, 0);
      hand.position.z = 0.0275;
      pod.add(hand);
      this.clockHands.push(hand);
    }
    this.clockFace = face;
    this.add(pod);
  }

  /* ------------------------------------------------------------ binnacle */
  _buildBinnacle() {
    const m = this.mat;
    const CY = -0.238;
    const shape = (w) => ({ a: lerp(0.236, 0.252, w), b: lerp(0.088, 0.118, w), z: lerp(-0.92, -0.7, w) });
    // outer cowl
    this.add(
      new Mesh(
        surface((u, v) => {
          const s = shape(v);
          const t = u * Math.PI;
          return [s.a * Math.cos(t), CY + s.b * Math.sin(t), s.z];
        }, 36, 6),
        m.leather,
      ),
    );
    // rolled rear lip
    const lip = [
      [1.0, -0.7],
      [1.016, -0.692],
      [1.012, -0.684],
      [0.985, -0.681],
      [0.955, -0.686],
      [0.94, -0.7],
    ];
    this.add(
      new Mesh(
        surface((u, v) => {
          const f = v * (lip.length - 1);
          const i = Math.min(lip.length - 2, Math.floor(f));
          const k = f - i;
          const sc = lerp(lip[i][0], lip[i + 1][0], k);
          const z = lerp(lip[i][1], lip[i + 1][1], k);
          const t = u * Math.PI;
          return [0.252 * sc * Math.cos(t), CY + 0.118 * sc * Math.sin(t), z];
        }, 36, 10),
        m.leather,
      ),
    );
    // shadowed underside and back panel
    this.add(
      new Mesh(
        surface((u, v) => {
          const s = shape(1 - v * 0.75);
          const t = u * Math.PI;
          return [s.a * 0.94 * Math.cos(t), CY + s.b * 0.94 * Math.sin(t), s.z];
        }, 36, 3),
        m.black,
      ),
    );
    const back = new Mesh(new CircleGeometry(1, 40, 0, Math.PI), m.black);
    back.scale.set(0.232, 0.09, 1);
    back.position.set(0, CY, -0.875);
    this.add(back);
  }

  /* -------------------------------------------------------------- gauges */
  _buildGauges() {
    const m = this.mat;
    const cluster = new Group();
    cluster.position.set(0, -0.205, -0.822);
    cluster.rotation.x = -0.24;
    this.add(cluster);

    const speedMax = IMPERIAL ? 200 : 320;
    this.speedMax = speedMax;
    const dark = ['#1b1b1d', '#060607'];
    const defs = [
      { x: -0.176, y: -0.014, z: -0.008, r: 0.037, tex: { min: 0, max: 8, major: 2, minor: 1, title: 'OIL', face: dark, ink: '#efece4', labelSize: 0.2 }, fixed: 0.46 },
      { x: -0.097, y: -0.004, z: -0.004, r: 0.046, tex: { min: 0, max: speedMax, major: IMPERIAL ? 20 : 40, minor: IMPERIAL ? 10 : 20, labelEvery: IMPERIAL ? 40 : 80, title: UNITS.speed, face: dark, ink: '#efece4', labelSize: 0.15 }, key: 'speed' },
      { x: 0, y: 0.004, z: 0.004, r: 0.056, tex: { min: 0, max: 9, major: 1, minor: 0.5, redFrom: 7.4, title: '×1000', face: ['#efe6d0', '#cdbf9f'], ink: '#1a1512', labelSize: 0.17 }, key: 'rpm' },
      { x: 0.097, y: -0.004, z: -0.004, r: 0.046, tex: { min: 0, max: 4, major: 1, minor: 0.5, title: 'FUEL', face: dark, ink: '#efece4', labelSize: 0.18 }, fixed: 0.71 },
      { x: 0.176, y: -0.014, z: -0.008, r: 0.037, tex: { min: 0, max: 6, major: 2, minor: 1, title: 'TEMP', face: dark, ink: '#efece4', labelSize: 0.2 }, fixed: 0.52 },
    ];
    this.needles = {};
    this.gaugeFaces = [];
    for (const d of defs) {
      const g = new Group();
      g.position.set(d.x, d.y, d.z);
      const tex = dialTexture(d.tex);
      const faceMat = new MeshBasicMaterial({ map: tex });
      const face = new Mesh(new CircleGeometry(d.r, 56), faceMat);
      g.add(face);
      this.gaugeFaces.push(faceMat);
      const bezel = new Mesh(new TorusGeometry(d.r, 0.0042, 10, 56), m.alu);
      bezel.position.z = 0.002;
      g.add(bezel);
      const len = d.r * 0.86;
      const needle = new Mesh(new BoxGeometry(d.r * 0.045, len, 0.0012), m.needle);
      needle.geometry.translate(0, len / 2 - d.r * 0.16, 0);
      needle.position.z = 0.0035;
      g.add(needle);
      const cap = new Mesh(new CircleGeometry(d.r * 0.11, 20), m.black);
      cap.position.z = 0.0045;
      g.add(cap);
      const set = (frac) => {
        needle.rotation.z = -((225 + 270 * clamp(frac, 0, 1.04)) * Math.PI) / 180;
      };
      set(d.fixed != null ? d.fixed : 0);
      if (d.key) this.needles[d.key] = set;
      cluster.add(g);
    }

    // digital readout set into the tach
    const dc = canvas(256, 96);
    this.digitalCtx = dc.getContext('2d');
    this.digitalTex = new CanvasTexture(dc);
    this.digitalTex.colorSpace = SRGBColorSpace;
    const digital = new Mesh(new PlaneGeometry(0.05, 0.019), new MeshBasicMaterial({ map: this.digitalTex, transparent: true }));
    digital.position.set(0, 0.004 - 0.03, 0.0052);
    cluster.add(digital);
    this._digital = '';
    this.setDigital(0, 'P');
  }

  setDigital(speedDisplay, gear) {
    const key = speedDisplay + '|' + gear;
    if (key === this._digital) return;
    this._digital = key;
    const g = this.digitalCtx;
    g.clearRect(0, 0, 256, 96);
    g.fillStyle = 'rgba(14,12,10,0.92)';
    g.beginPath();
    g.roundRect(4, 4, 248, 88, 14);
    g.fill();
    g.fillStyle = '#f4efe4';
    g.textBaseline = 'middle';
    g.textAlign = 'right';
    g.font = '700 62px "JetBrains Mono", ui-monospace, monospace';
    g.fillText(String(speedDisplay), 168, 50);
    g.textAlign = 'left';
    g.fillStyle = '#ff9a3c';
    g.font = '700 46px "JetBrains Mono", ui-monospace, monospace';
    g.fillText(String(gear), 190, 52);
    this.digitalTex.needsUpdate = true;
  }

  /* --------------------------------------------------------------- wheel */
  _buildWheel() {
    const m = this.mat;
    const tilt = new Group();
    tilt.position.set(0, -0.245, -0.475);
    tilt.rotation.x = -0.35;
    this.add(tilt);

    // column and stalks stay put
    const column = new Mesh(new CylinderGeometry(0.046, 0.058, 0.26, 20), m.black);
    column.rotation.x = Math.PI / 2;
    column.position.z = -0.15;
    tilt.add(column);
    for (const sx of [-1, 1]) {
      const stalk = new Mesh(new CylinderGeometry(0.006, 0.008, 0.13, 8), m.black);
      stalk.rotation.z = Math.PI / 2 + sx * 0.2;
      stalk.position.set(sx * 0.11, 0.012, -0.075);
      tilt.add(stalk);
    }

    const wheel = new Group();
    tilt.add(wheel);
    this.wheel = wheel;

    const R = 0.185;
    const rim = new Mesh(new TorusGeometry(R, 0.0165, 18, 72), m.leather);
    wheel.add(rim);
    // twelve-o'clock marker
    const marker = new Mesh(new TorusGeometry(R, 0.0171, 14, 8, 0.11), m.cream);
    marker.rotation.z = Math.PI / 2 - 0.055;
    wheel.add(marker);

    // spokes
    for (const sx of [-1, 1]) {
      const spoke = box(0.125, 0.034, 0.014, m.satin, sx * 0.112, -0.006, -0.004);
      wheel.add(spoke);
      wheel.add(box(0.1, 0.0022, 0.004, m.alu, sx * 0.108, 0.0125, 0.003));
      wheel.add(box(0.1, 0.0022, 0.004, m.alu, sx * 0.108, -0.0245, 0.003));
      // thumb switches
      wheel.add(box(0.03, 0.014, 0.004, m.gloss, sx * 0.1, -0.006, 0.0045));
    }
    for (const sx of [-1, 1]) {
      wheel.add(box(0.012, 0.118, 0.012, m.satin, sx * 0.017, -0.115, -0.004));
    }

    // hub pad with a crest of its own
    const hub = new Mesh(new CylinderGeometry(0.058, 0.066, 0.034, 40), m.leatherDark);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.004;
    wheel.add(hub);
    const hubRing = new Mesh(new TorusGeometry(0.058, 0.002, 6, 40), m.alu);
    hubRing.position.z = 0.021;
    wheel.add(hubRing);
    const crest = new Mesh(
      new PlaneGeometry(0.03, 0.0375),
      new MeshStandardMaterial({ map: crestTexture(), transparent: true, roughness: 0.35, metalness: 0.6 }),
    );
    crest.position.z = 0.0215;
    wheel.add(crest);

    // drive-mode dial, lower right
    const dial = new Mesh(new CylinderGeometry(0.0165, 0.0165, 0.016, 24), m.alu);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(0.082, -0.07, 0.006);
    wheel.add(dial);
    const dot = new Mesh(new CircleGeometry(0.0075, 16), new MeshBasicMaterial({ color: '#c8281e' }));
    dot.position.set(0.082, -0.07, 0.0145);
    wheel.add(dot);
  }

  /* -------------------------------------------------------- centre stack */
  _buildCentreStack() {
    const m = this.mat;
    const X = CAR_CENTER_X;
    this.add(box(0.325, 0.122, 0.012, m.gloss, X, -0.29, -0.632));
    const sc = canvas(640, 224);
    this.screenCanvas = sc;
    this.screenCtx = sc.getContext('2d');
    this.screenTex = new CanvasTexture(sc);
    this.screenTex.colorSpace = SRGBColorSpace;
    this.screenTex.anisotropy = 8;
    this.screenMat = new MeshBasicMaterial({ map: this.screenTex });
    const screen = new Mesh(new PlaneGeometry(0.3, 0.105), this.screenMat);
    screen.position.set(X, -0.29, -0.6255);
    this.add(screen);

    // vents below the screen
    for (const sx of [-1, 1]) {
      const vx = X + sx * 0.085;
      this.add(box(0.13, 0.034, 0.006, m.black, vx, -0.342, -0.642));
      for (let i = 0; i < 4; i++) this.add(box(0.122, 0.0016, 0.008, m.aluDark, vx, -0.353 + i * 0.0075, -0.6405));
    }
    // outer vents, driver's door side and passenger side
    for (const vx of [-0.39, 0.86]) {
      this.add(box(0.07, 0.034, 0.006, m.black, vx, -0.342, -0.642));
      for (let i = 0; i < 4; i++) this.add(box(0.064, 0.0016, 0.008, m.aluDark, vx, -0.353 + i * 0.0075, -0.6405));
    }

    // centre console rising between the seats
    const cons = [
      [-0.6, -0.5],
      [-0.4, -0.53],
      [0.1, -0.55],
      [0.7, -0.56],
    ];
    const consTop = new Mesh(ribbon(cons, X - 0.13, X + 0.13), m.leatherDark);
    this.add(consTop);
    this.add(box(0.004, 0.5, 1.4, m.leatherDark, X - 0.13, -0.79, 0.05));
    this.add(box(0.004, 0.5, 1.4, m.leatherDark, X + 0.13, -0.79, 0.05));
    const selector = box(0.03, 0.035, 0.05, m.alu, X - 0.03, -0.515, -0.4);
    this.add(selector);
  }

  /* -------------------------------------------------------- start button */
  _buildStartButton() {
    const m = this.mat;
    const g = new Group();
    g.position.copy(START_BUTTON_POS);
    const bezel = new Mesh(new CylinderGeometry(0.0255, 0.0275, 0.012, 40), m.alu);
    bezel.rotation.x = Math.PI / 2;
    g.add(bezel);
    this.startRingMat = new MeshBasicMaterial({ color: '#ff3b1f' });
    const ring = new Mesh(new TorusGeometry(0.0215, 0.0016, 8, 48), this.startRingMat);
    ring.position.z = 0.0062;
    g.add(ring);
    this.startCap = new Mesh(new CircleGeometry(0.0198, 40), new MeshBasicMaterial({ map: startButtonTexture() }));
    this.startCap.position.z = 0.0066;
    g.add(this.startCap);
    this.startGroup = g;
    this.add(g);
  }

  /* --------------------------------------- pillars, doors, floor, mirror */
  _buildShell() {
    const m = this.mat;
    // A-pillars (no roof header: it sits above the frame in every layout)
    this.add(beam(new Vector3(-0.478, -0.3, -1.36), new Vector3(-0.432, 0.43, -0.2), 0.05, 0.085, m.suede));
    this.add(beam(new Vector3(1.198, -0.3, -1.36), new Vector3(1.152, 0.43, -0.2), 0.05, 0.085, m.suede));
    // dash end caps where it meets the doors
    this.add(box(0.012, 0.6, 0.76, m.leatherDark, -0.446, -0.52, -0.98));
    this.add(box(0.012, 0.6, 0.76, m.leatherDark, 1.166, -0.52, -0.98));

    // door cards
    for (const [x, sx] of [
      [-0.44, -1],
      [1.16, 1],
    ]) {
      const sill = [
        [-1.36, -0.25],
        [-0.9, -0.2],
        [0.1, -0.18],
        [0.9, -0.17],
      ];
      const top = new Mesh(ribbon(sill, x + sx * 0.09, x - sx * 0.012), m.leather);
      this.add(top);
      const inner = [
        [-1.36, -0.25],
        [-0.9, -0.2],
        [0.1, -0.18],
        [0.9, -0.17],
      ].map(([z, y]) => [z, y]);
      // inner face of the door, down to the floor
      const pos = [];
      const idx = [];
      inner.forEach(([z, y], i) => {
        pos.push(x - sx * 0.012, y, z, x - sx * 0.03, -0.9, z);
        if (i < inner.length - 1) {
          const a = i * 2;
          idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
        }
      });
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      this.add(new Mesh(g, m.leatherDark));
      // door pull
      this.add(box(0.012, 0.014, 0.2, m.alu, x - sx * 0.02, -0.3, -0.72));
    }

    // floor and firewall close the cabin off
    const floor = new Mesh(new PlaneGeometry(1.7, 2.6), m.black);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(CAR_CENTER_X, -0.9, -0.2);
    this.add(floor);
    const wall = new Mesh(new PlaneGeometry(1.7, 0.7), m.black);
    wall.position.set(CAR_CENTER_X, -0.6, -0.7);
    this.add(wall);

    // rear-view mirror on its stalk
    const mirror = new Group();
    mirror.position.set(CAR_CENTER_X, 0.2, -0.6);
    mirror.rotation.y = -0.42;
    mirror.rotation.x = 0.1;
    mirror.add(box(0.226, 0.066, 0.02, m.black, 0, 0, -0.011));
    const glass = new Mesh(new PlaneGeometry(0.214, 0.055), new MeshBasicMaterial({ map: mirrorTexture() }));
    mirror.add(glass);
    this.mirrorMat = glass.material;
    const stalk = beam(new Vector3(CAR_CENTER_X, 0.225, -0.62), new Vector3(CAR_CENTER_X, 0.34, -0.5), 0.018, 0.018, m.black);
    this.mirror = new Group();
    this.mirror.add(mirror, stalk);
    this.add(this.mirror);
  }

  /* -------------------------------------------------------------- wipers */
  _buildWipers() {
    const m = this.mat;
    const basis = new Matrix4().makeBasis(GLASS.u, GLASS.v, GLASS.n.clone().negate());
    const q = new Quaternion().setFromRotationMatrix(basis);
    this.wipers = [];
    for (const w of WIPERS) {
      const mount = new Group();
      mount.position.copy(GLASS.origin).addScaledVector(GLASS.u, w.pivot[0]).addScaledVector(GLASS.v, w.pivot[1]);
      mount.position.addScaledVector(GLASS.n, 0.012); // just outside the glass
      mount.quaternion.copy(q);
      const arm = new Group();
      mount.add(arm);
      const mid = (w.r0 + w.r1) / 2;
      const shaft = box(mid, 0.012, 0.008, m.rubber, mid / 2, 0, 0.004);
      arm.add(shaft);
      const blade = box(w.r1 - w.r0, 0.016, 0.01, m.rubber, mid, 0, 0);
      arm.add(blade);
      const hubCap = new Mesh(new CylinderGeometry(0.014, 0.014, 0.012, 12), m.rubber);
      hubCap.rotation.x = Math.PI / 2;
      arm.add(hubCap);
      this.add(mount);
      this.wipers.push(arm);
    }
  }

  /* ------------------------------------------------------------- updates */
  setEnvironment(tex) {
    this.scene.environment = tex;
  }

  setNight(t) {
    this.night = t;
    this.hemi.intensity = lerp(1.15, 0.12, t);
    this.key.intensity = lerp(2.7, 0.06, t);
    this.scene.environmentIntensity = lerp(1.0, 0.1, t);
    this.glow.intensity = lerp(0, 0.05, t);
    const face = lerp(0.82, 1.0, t);
    for (const f of this.gaugeFaces) f.color.setRGB(face, face, face);
    this.clockFace.material.color.setRGB(face, face, face);
    const scr = lerp(0.9, 0.8, t);
    this.screenMat.color.setRGB(scr, scr, scr);
    const al = lerp(0.25, 1.0, t);
    this.ambientLine.material.color.setRGB(1.0 * al, 0.56 * al, 0.2 * al);
    const mir = lerp(1.0, 0.12, t);
    this.mirrorMat.color.setRGB(mir, mir, mir);
  }

  /**
   * @param {{steer:number, rpm:number, speed:number, wiper:number, time:number, pulse:number, pressed:number}} s
   */
  update(s) {
    this.wheel.rotation.z = -s.steer;
    this.needles.rpm(s.rpm / 9000);
    this.needles.speed((s.speed * UNITS.perMs) / this.speedMax);
    for (const w of this.wipers) w.rotation.z = s.wiper;

    // the start button breathes until somebody presses it
    const breathe = 0.5 + 0.5 * Math.sin(s.time * 2.1);
    const k = lerp(0.35 + 0.65 * breathe, 1, s.pulse);
    this.startRingMat.color.setRGB(1.0 * k, lerp(0.18, 0.75, s.pulse) * k, lerp(0.08, 0.3, s.pulse) * k);
    this.startGroup.position.z = START_BUTTON_POS.z - 0.004 * s.pressed;

    const d = new Date();
    const sec = d.getSeconds() + d.getMilliseconds() / 1000;
    const min = d.getMinutes() + sec / 60;
    const hr = (d.getHours() % 12) + min / 60;
    this.clockHands[0].rotation.z = -(hr / 12) * TAU;
    this.clockHands[1].rotation.z = -(min / 60) * TAU;
    this.clockHands[2].rotation.z = -(sec / 60) * TAU;
  }
}

/* ==========================================================================
   Exterior bodywork seen over the dash: bonnet, the two wing tops, a mirror.
   Lives in the world scene so rain on the glass refracts it too.
   ========================================================================== */
export function buildExterior() {
  const group = new Group();
  const paint = new MeshStandardMaterial({ color: '#1b4a30', roughness: 0.3, metalness: 0.7 });
  const NX = 34;
  const NZ = 22;
  const hood = surface(
    (u, v) => {
      const xc = lerp(-0.95, 0.95, u); // car-centred
      const z = lerp(-1.3, -3.35, v);
      const ax = Math.abs(xc);
      let y = lerp(-0.3, -0.54, Math.pow(v, 1.25));
      y += 0.165 * Math.exp(-Math.pow((ax - 0.69) / 0.17, 2)) * (1 - 0.3 * v);
      y += 0.02 * (1 - Math.pow(xc / 0.95, 2));
      y -= 3.2 * Math.pow(Math.max(0, ax - 0.83), 2);
      y -= 0.22 * Math.pow(Math.max(0, v - 0.82) / 0.18, 2);
      return [xc + CAR_CENTER_X, y, z];
    },
    NX,
    NZ,
  );
  const hoodMesh = new Mesh(hood, paint);
  paint.side = DoubleSide;
  group.add(hoodMesh);

  // cowl panel between bonnet and glass
  const cowl = new Mesh(new BoxGeometry(1.9, 0.02, 0.14), new MeshStandardMaterial({ color: '#0b0b0c', roughness: 0.7 }));
  cowl.position.set(CAR_CENTER_X, -0.3, -1.36);
  group.add(cowl);

  // driver's door mirror
  const mirror = new Group();
  mirror.position.set(-0.66, -0.155, -0.98);
  const housing = new Mesh(new BoxGeometry(0.2, 0.12, 0.09), paint);
  housing.geometry.translate(0, 0, -0.03);
  mirror.add(housing);
  // the glass shows road and sky behind: a flat grey read is all it needs through wet side glass
  const face = new Mesh(new PlaneGeometry(0.17, 0.095), new MeshBasicMaterial({ color: '#59636a' }));
  face.position.z = 0.016;
  mirror.add(face);
  const bezel = new Mesh(new PlaneGeometry(0.19, 0.112), new MeshStandardMaterial({ color: '#0c0c0d', roughness: 0.6 }));
  bezel.position.z = 0.0155;
  mirror.add(bezel);
  const stalk = new Mesh(new BoxGeometry(0.16, 0.025, 0.05), paint);
  stalk.position.set(0.14, -0.06, -0.02);
  mirror.add(stalk);
  group.add(mirror);

  return { group, paint, mirrorFace: face.material };
}
