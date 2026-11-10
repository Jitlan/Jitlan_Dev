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
import { IMPERIAL, TAU, UNITS, clamp, lerp, mulberry32, roundRect } from './util.js';

export const CAR_CENTER_X = 0.36;

/* The windshield as a plane: origin at the base, U across, V up the glass. */
export const GLASS = (() => {
  const origin = new Vector3(CAR_CENTER_X, -0.262, -1.36);
  const u = new Vector3(1, 0, 0);
  const v = new Vector3(0, 0.532, 0.84).normalize();
  const n = new Vector3().crossVectors(u, v);
  return { origin, u, v, n };
})();

/*
 * Two tandem wipers, parked pointing at the passenger side. Pivot and blade
 * reach are in glass coordinates (metres); each sweeps its own arc, in step.
 * The driver's blade is the long one: it parks above the passenger's, swings
 * up to stand alongside the A-pillar and clears nearly the full height of the
 * glass in front of the driver. The passenger's swings past vertical so the
 * two fans overlap. The rain shader clears exactly these two fans.
 */
export const WIPERS = [
  { pivot: [-0.74, 0.03], r0: 0.12, r1: 1.36, sweep: [0.06, 1.57] },
  { pivot: [-0.02, 0.03], r0: 0.12, r1: 0.8, sweep: [0.03, 1.92] },
];

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

/**
 * The wheel-hub badge: a cursive "JL" in gold on dark green enamel.
 * The script face is Italianno, shipped as a two-glyph subset; until it has
 * loaded (or if it can't) the badge falls back to an italic serif.
 */
function crestTexture() {
  const S = 256;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;

  const gold = () => {
    const grad = g.createLinearGradient(40, 30, 216, 226);
    grad.addColorStop(0, '#f1d58a');
    grad.addColorStop(0.5, '#c9a044');
    grad.addColorStop(1, '#8f6a1f');
    return grad;
  };
  const draw = (font) => {
    g.clearRect(0, 0, S, S);
    g.fillStyle = gold();
    g.beginPath();
    g.arc(S / 2, S / 2, 126, 0, TAU);
    g.fill();
    const enamel = g.createRadialGradient(S / 2 - 30, S / 2 - 40, 10, S / 2, S / 2, 116);
    enamel.addColorStop(0, '#143524');
    enamel.addColorStop(1, '#06140d');
    g.fillStyle = enamel;
    g.beginPath();
    g.arc(S / 2, S / 2, 113, 0, TAU);
    g.fill();
    g.strokeStyle = gold();
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(S / 2, S / 2, 103, 0, TAU);
    g.stroke();

    g.font = font;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    const m = g.measureText('JL');
    // centre on the ink, not the advance box: script capitals swing well outside it
    const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    const x = S / 2 - w / 2 + m.actualBoundingBoxLeft;
    const y = S / 2 + h / 2 - m.actualBoundingBoxDescent;
    g.fillStyle = gold();
    g.strokeStyle = gold();
    g.lineWidth = 2.4; // a touch of weight so the hairlines survive at badge size
    g.lineJoin = 'round';
    g.strokeText('JL', x, y);
    g.fillText('JL', x, y);
    t.needsUpdate = true;
  };

  const fallback = () => draw('italic 118px Georgia, "Times New Roman", serif');
  fallback();
  try {
    const face = new FontFace('JL Script', 'url(assets/fonts/italianno-jl.woff2)');
    face
      .load()
      .then((f) => {
        document.fonts.add(f);
        draw('180px "JL Script"');
      })
      .catch(fallback);
  } catch (e) {
    /* no FontFace API: the serif stays */
  }
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
  roundRect(g, 52, 16, 152, 40, 10);
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
  roundRect(g, 70, 38, 34, 42, 8);
  roundRect(g, 152, 38, 34, 42, 8);
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

/**
 * Give a standard material a surface: pebbled hide, suede nap or a blasted metal finish, from the
 * generated cabin texture (textures.js). It is laid on in the part's own space with a triplanar
 * lookup: the cabin's parts have no useful UVs, and this way the grain turns with the steering wheel.
 * @param {{tile:number, channel?:'b'|'a', tone?:number, rough?:number, bump?:number}} o
 *   tile: metres per repeat · channel: which pattern drives tone and roughness · bump: relief (hide only)
 */
function grained(material, tex, o) {
  const f = (v) => Number(v || 0).toFixed(4);
  const ch = o.channel || 'b';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.tGrain = { value: tex };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainP;\nvarying vec3 vGrainN;\nvarying mat3 vGrainM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrainP = position;\nvGrainN = normal;\nvGrainM = normalMatrix;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainP;\nvarying vec3 vGrainN;\nvarying mat3 vGrainM;\nuniform sampler2D tGrain;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 gW = pow(abs(normalize(vGrainN)), vec3(6.0));
        gW /= gW.x + gW.y + gW.z;
        vec3 gP = vGrainP / ${f(o.tile)};
        vec3 gDx = dFdx(gP);
        vec3 gDy = dFdy(gP);
        // most of a surface faces one way: skip the projections that would barely count
        vec4 gX = gW.x > 0.02 ? textureGrad(tGrain, gP.zy, gDx.zy, gDy.zy) : vec4(0.5);
        vec4 gY = gW.y > 0.02 ? textureGrad(tGrain, gP.xz, gDx.xz, gDy.xz) : vec4(0.5);
        vec4 gZ = gW.z > 0.02 ? textureGrad(tGrain, gP.xy, gDx.xy, gDy.xy) : vec4(0.5);
        float gTone = gX.${ch} * gW.x + gY.${ch} * gW.y + gZ.${ch} * gW.z - 0.5;
        diffuseColor.rgb *= 1.0 + ${f(o.tone)} * gTone;`,
      )
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + ${f(o.rough)} * gTone, 0.05, 1.0);`);
    if (o.bump) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec2 nA = gX.rg * 2.0 - 1.0;
          vec2 nB = gY.rg * 2.0 - 1.0;
          vec2 nC = gZ.rg * 2.0 - 1.0;
          vec3 relief = gW.x * vec3(0.0, nA.y, nA.x) + gW.y * vec3(nB.x, 0.0, nB.y) + gW.z * vec3(nC.x, nC.y, 0.0);
          normal = normalize(normal + vGrainM * relief * ${f(o.bump)});
        }`,
      );
    }
  };
  material.customProgramCacheKey = () => `grain:${ch}:${f(o.tile)}:${f(o.tone)}:${f(o.rough)}:${f(o.bump)}`;
  return material;
}

/* ==========================================================================
   Interior
   ========================================================================== */
export class Interior {
  /** @param {object} cabinTex the generated cabin detail texture (textures.js) */
  constructor(cabinTex) {
    this.scene = new Scene();
    this.night = 0;
    this.textures = [];

    const stitchTex = stitchTexture();
    const hide = { tile: 0.28, tone: 0.34, rough: 0.08, bump: 0.55 };
    const nap = { tile: 0.2, channel: 'a', tone: 0.45 };
    const blasted = { tile: 0.11, channel: 'a', tone: 0.12, rough: 0.3 };

    const mat = (this.mat = {
      // leather is matt: high roughness and almost no pick-up from the sky
      leather: grained(new MeshStandardMaterial({ color: '#432414', roughness: 0.93, envMapIntensity: 0.1, side: DoubleSide }), cabinTex, hide),
      leatherDark: grained(new MeshStandardMaterial({ color: '#2d190e', roughness: 0.95, envMapIntensity: 0.08, side: DoubleSide }), cabinTex, hide),
      suede: grained(new MeshStandardMaterial({ color: '#21150e', roughness: 0.96, side: DoubleSide }), cabinTex, nap),
      satin: new MeshStandardMaterial({ color: '#17171a', roughness: 0.6, metalness: 0.3, envMapIntensity: 0.4 }),
      alu: grained(new MeshStandardMaterial({ color: '#aeb2b6', roughness: 0.44, metalness: 1, envMapIntensity: 0.65 }), cabinTex, blasted),
      aluDark: grained(new MeshStandardMaterial({ color: '#63676b', roughness: 0.52, metalness: 1, envMapIntensity: 0.6 }), cabinTex, blasted),
      black: new MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.55, side: DoubleSide }),
      gloss: new MeshStandardMaterial({ color: '#050506', roughness: 0.3, metalness: 0.2, envMapIntensity: 0.4 }),
      rubber: new MeshStandardMaterial({ color: '#060607', roughness: 0.8 }),
      stitch: new MeshStandardMaterial({ color: '#dcc79c', roughness: 0.8, map: stitchTex, alphaTest: 0.5, side: DoubleSide }),
      cream: new MeshStandardMaterial({ color: '#d9c7a0', roughness: 0.6 }),
      needle: new MeshBasicMaterial({ color: '#ff5a1f' }),
      ambientLine: new MeshBasicMaterial({ color: '#ff9a3c' }),
    });

    // There's a roof overhead, so the cabin is lit the way a closed car is: a dim bounce
    // everywhere, daylight coming in low through the windshield onto whatever faces it,
    // and a little from the side glass.
    this.hemi = new HemisphereLight('#aab4bb', '#1a110b', 0.5);
    this.scene.add(this.hemi);
    this.key = new DirectionalLight('#e8eef2', 1.4);
    this.key.position.set(0.05, 0.42, -1.0);
    this.scene.add(this.key);
    this.side = new DirectionalLight('#dfe6ea', 0.22);
    this.side.position.set(-1.0, 0.25, -0.2);
    this.scene.add(this.side);
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

    // main-beam tell-tale: the little blue lamp that's on whenever the high beams are
    this.beamLamp = new MeshBasicMaterial({ color: '#16304f' });
    const lamp = new Mesh(new CircleGeometry(0.0042, 20), this.beamLamp);
    lamp.position.set(-0.05, 0.047, 0.0052);
    cluster.add(lamp);

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
    roundRect(g, 4, 4, 248, 88, 14);
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
      new CircleGeometry(0.0235, 48),
      new MeshStandardMaterial({ map: crestTexture(), roughness: 0.5, metalness: 0.35, envMapIntensity: 0.5 }),
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
    // A-pillars, running up the edge of the glass to the header rail
    this.add(beam(new Vector3(-0.478, -0.3, -1.36), new Vector3(-0.428, 0.5, -0.09), 0.05, 0.085, m.suede));
    this.add(beam(new Vector3(1.198, -0.3, -1.36), new Vector3(1.148, 0.5, -0.09), 0.05, 0.085, m.suede));
    // dash end caps where it meets the doors
    this.add(box(0.012, 0.6, 0.76, m.leatherDark, -0.446, -0.52, -0.98));
    this.add(box(0.012, 0.6, 0.76, m.leatherDark, 1.166, -0.52, -0.98));

    // Header rail, roof lining, side rails and the driver's sun visor. From the normal seat
    // these sit just above the frame; from the pulled-back phone view the header shows as a
    // band across the top, which is what tells you there's a roof on the car.
    const ROOF_Y = 0.5;
    const ROOF_Z = -0.09; // where the glass meets the roof
    this.add(box(1.66, 0.07, 0.13, m.suede, CAR_CENTER_X, ROOF_Y, ROOF_Z));
    const lining = new Mesh(new PlaneGeometry(1.7, 1.7), m.suede);
    lining.rotation.x = Math.PI / 2;
    lining.position.set(CAR_CENTER_X, ROOF_Y + 0.03, ROOF_Z + 0.82);
    this.add(lining);
    for (const x of [-0.455, 1.175]) this.add(box(0.07, 0.08, 1.7, m.suede, x, ROOF_Y - 0.01, ROOF_Z + 0.82));
    const visor = box(0.42, 0.012, 0.16, m.leatherDark, -0.02, ROOF_Y - 0.035, ROOF_Z + 0.1);
    visor.rotation.x = 0.12;
    this.add(visor);

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
    // u × v = n, so this is a proper rotation: local X runs across the glass, local Y up it,
    // and a turn about local Z is an angle measured in the plane of the glass, which is how
    // the rain shader measures it too.
    const basis = new Matrix4().makeBasis(GLASS.u, GLASS.v, GLASS.n);
    const q = new Quaternion().setFromRotationMatrix(basis);
    this.wipers = [];
    for (const w of WIPERS) {
      const mount = new Group();
      mount.position.copy(GLASS.origin).addScaledVector(GLASS.u, w.pivot[0]).addScaledVector(GLASS.v, w.pivot[1]);
      mount.position.addScaledVector(GLASS.n, -0.012); // just outside the glass (n points into the cabin)
      mount.quaternion.copy(q);
      const arm = new Group();
      mount.add(arm);
      const mid = (w.r0 + w.r1) / 2;
      const shaft = box(mid, 0.012, 0.008, m.rubber, mid / 2, 0, -0.004);
      arm.add(shaft);
      const blade = box(w.r1 - w.r0, 0.016, 0.01, m.rubber, mid, 0, 0);
      arm.add(blade);
      const hubCap = new Mesh(new CylinderGeometry(0.014, 0.014, 0.012, 12), m.rubber);
      hubCap.rotation.x = Math.PI / 2;
      arm.add(hubCap);
      this.add(mount);
      arm.userData.sweep = w.sweep;
      this.wipers.push(arm);
    }
  }

  /* ------------------------------------------------------------- updates */
  setEnvironment(tex) {
    this.scene.environment = tex;
  }

  setNight(t) {
    this.night = t;
    this.hemi.intensity = lerp(0.5, 0.1, t);
    this.key.intensity = lerp(1.4, 0.05, t);
    this.side.intensity = lerp(0.22, 0.02, t);
    this.beamLamp.color.setRGB(0.12 + 0.5 * t, 0.2 + 0.6 * t, 0.35 + 0.65 * t).multiplyScalar(t > 0.5 ? 1 : 0.25);
    this.scene.environmentIntensity = lerp(0.5, 0.08, t);
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
    for (const w of this.wipers) w.rotation.z = lerp(w.userData.sweep[0], w.userData.sweep[1], s.wiper);

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
  // a deep, dark green; mostly a body colour with a soft sheen rather than a mirror
  const paint = new MeshStandardMaterial({ color: '#0c2f1d', roughness: 0.56, metalness: 0.25, envMapIntensity: 0.24 });
  // One skin for bonnet, wings and nose: the outer strips of the grid fold straight down
  // into the flanks and the front, so there's bodywork wherever you look, not a floating lid.
  const NX = 40;
  const NZ = 26;
  const FLANK = 0.07; // share of the grid's width used by each flank
  const NOSE = 0.08; // share of its length used by the nose
  const SILL = -1.03; // bottom edge of the body, just clear of the road
  const hood = surface(
    (u, v) => {
      const uu = clamp((u - FLANK) / (1 - 2 * FLANK), 0, 1);
      const vv = clamp(v / (1 - NOSE), 0, 1);
      const xc = lerp(-0.95, 0.95, uu); // car-centred
      const z = lerp(-1.1, -3.35, vv); // starts back under the base of the glass
      const t = clamp((-z - 1.3) / 2.05, 0, 1);
      const ax = Math.abs(xc);
      let y = lerp(-0.3, -0.54, Math.pow(t, 1.25));
      y += 0.165 * Math.exp(-Math.pow((ax - 0.69) / 0.17, 2)) * (1 - 0.3 * t);
      y += 0.02 * (1 - Math.pow(xc / 0.95, 2));
      y -= 3.2 * Math.pow(Math.max(0, ax - 0.83), 2);
      y -= 0.22 * Math.pow(Math.max(0, t - 0.82) / 0.18, 2);
      const flank = u < FLANK ? 1 - u / FLANK : u > 1 - FLANK ? (u - (1 - FLANK)) / FLANK : 0;
      const nose = v > 1 - NOSE ? (v - (1 - NOSE)) / NOSE : 0;
      const drop = Math.max(flank, nose);
      // a slight tuck-under as the panel drops
      const tuck = 0.03 * Math.sin(drop * Math.PI * 0.5);
      return [xc * (1 - (flank > 0 ? tuck / 0.95 : 0)) + CAR_CENTER_X, lerp(y, SILL, drop), z + (nose > 0 ? tuck : 0)];
    },
    NX,
    NZ,
  );
  const hoodMesh = new Mesh(hood, paint);
  paint.side = DoubleSide;
  group.add(hoodMesh);

  // the body carries on back past the doors, up to the window line
  for (const sx of [-1, 1]) {
    const door = new Mesh(new BoxGeometry(0.03, 0.82, 2.9), paint);
    door.position.set(CAR_CENTER_X + sx * 0.94, SILL + 0.41, 0.33);
    group.add(door);
  }
  // and a floor pan, so nothing shows from underneath
  const pan = new Mesh(new BoxGeometry(1.86, 0.02, 5.2), new MeshStandardMaterial({ color: '#070808', roughness: 0.9 }));
  pan.position.set(CAR_CENTER_X, SILL, -0.8);
  group.add(pan);

  // wiper trough between bonnet and glass
  const cowl = new Mesh(new BoxGeometry(1.9, 0.03, 0.2), new MeshStandardMaterial({ color: '#0b0b0c', roughness: 0.7 }));
  cowl.position.set(CAR_CENTER_X, -0.288, -1.38);
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
