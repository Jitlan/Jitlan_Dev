/* ==========================================================================
   Drive — rain on the windshield
   --------------------------------------------------------------------------
   A full-screen pass over the rendered world. Every pixel is traced onto
   the windshield plane, so drops live in real glass coordinates (metres):
   they foreshorten properly, stay put when the view shifts, and the cleared
   fan matches the wiper blades exactly.
   ========================================================================== */

import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, Vector4 } from '../vendor/three.module.min.js';
import { GLASS, WIPERS, WIPER_SWEEP } from './interior.js';

const FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tScene;
uniform vec2 uTexel;
uniform vec2 uProj;
uniform vec3 uGO, uGU, uGV, uGN;
uniform vec2 uWipPivot[2];
uniform vec2 uWipR[2];
uniform vec2 uSweep;
uniform vec4 uCycle;      // x: time into cycle, y: period, z: up-stroke, w: down-stroke
uniform float uWipOn;
uniform float uTime;
uniform float uRain;
uniform float uSpeed;     // 0 parked … 1 fast: airflow starts pushing water up the glass
uniform float uMaxLod;
uniform float uNight;
varying vec2 vUv;

// smoothstep is undefined when edge0 >= edge1; this is the same curve, valid either way round
float ramp(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec3 hash3(vec2 p) {
  vec3 q = vec3(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)), dot(p, vec2(419.2, 371.9)));
  return fract(sin(q) * 43758.5453);
}

// Small beads that swell, sit a while and dry out.
// xy: position inside the bead (unit disc) scaled by coverage, z: coverage.
vec3 beads(vec2 g, float cells, float wet) {
  vec2 q = g * cells;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  vec3 h = hash3(id);
  float present = ramp(h.z, h.z + 0.12, wet);
  float life = fract(uTime * (0.04 + 0.08 * h.x) + h.y * 9.0);
  float swell = ramp(0.0, 0.1, life) * ramp(1.0, 0.72, life);
  float rad = (0.1 + 0.24 * h.y) * swell * present;
  if (rad < 0.004) return vec3(0.0);
  vec2 d = f - (h.xy - 0.5) * 0.5;
  float m = ramp(rad, rad * 0.5, length(d));
  return vec3(d / rad * m, m);
}

// Fat drops that stick, slip, and leave a beaded trail behind them.
// dir = 1 runs down the glass, dir = -1 is blown up it.
// xy: lens offset, z: coverage, w: how much mist the trail has cleared.
vec4 runners(vec2 g, float dir, float amount) {
  const vec2 CELL = vec2(0.052, 0.2);
  float along = -dir * g.y;                    // drops travel toward +along
  float colF = g.x / CELL.x;
  float col = floor(colF);
  float hc = hash1(col * 1.37 + dir * 11.0);
  float rate = (0.2 + 0.3 * hc) * (dir > 0.0 ? 1.0 : 2.4);
  float rowF = along / CELL.y - uTime * rate + hc * 31.0;
  float row = floor(rowF);
  vec3 h = hash3(vec2(col, row) + dir * 5.0);
  if (h.z > amount) return vec4(0.0);

  float fx = fract(colF) - 0.5;
  float ly = fract(rowF);
  float ph = uTime * rate * 1.6 + h.y * 6.2832;
  float yd = 0.5 + 0.3 * sin(ph + 0.9 * sin(ph));     // stick-slip inside the travelling cell
  float xd = (h.x - 0.5) * 0.45 + 0.09 * sin(along * 46.0 + h.y * 6.2832);
  float r0 = 0.0052 + 0.0038 * h.x;

  vec2 p = vec2((fx - xd) * CELL.x, (ly - yd) * CELL.y);
  vec2 ps = vec2(p.x, p.y * (p.y < 0.0 ? 0.62 : 1.0));  // stretched tail
  float m = ramp(r0, r0 * 0.5, length(ps));
  vec2 n = ps / r0 * m;
  n.y *= -dir;                                           // back to glass orientation

  // trail: beads left where the drop has already been
  float back = (yd - ly) * CELL.y;
  float fade = ramp(yd * CELL.y, 0.0, back) * step(r0 * 0.7, back);
  const float SP = 0.0078;
  float bi = floor(along / SP);
  float by = (fract(along / SP) - 0.5) * SP;
  float rb = r0 * 0.44 * fade * (0.55 + 0.45 * hash1(bi + col * 7.0));
  vec2 pb = vec2(p.x, by);
  float mb = rb > 2e-4 ? ramp(rb, rb * 0.5, length(pb)) : 0.0;
  n += vec2(pb.x, -dir * pb.y) / max(rb, 2e-4) * mb;
  float clearT = ramp(r0 * 1.5, r0 * 0.4, abs(p.x)) * fade;
  return vec4(n, max(m, mb), clearT);
}

vec3 blurSample(vec2 uv, float lod) {
  lod = clamp(lod, 0.0, uMaxLod);
  vec2 px = uTexel * exp2(lod) * 0.8;
  vec3 c = textureLod(tScene, uv, lod).rgb * 0.36;
  c += textureLod(tScene, uv + px * vec2(0.8, 0.6), lod).rgb * 0.16;
  c += textureLod(tScene, uv + px * vec2(-0.6, 0.8), lod).rgb * 0.16;
  c += textureLod(tScene, uv + px * vec2(-0.8, -0.6), lod).rgb * 0.16;
  c += textureLod(tScene, uv + px * vec2(0.6, -0.8), lod).rgb * 0.16;
  return c;
}

void main() {
  vec2 uv = vUv;

  // where does this pixel's line of sight cross the glass?
  vec3 rd = normalize(vec3((uv * 2.0 - 1.0) * uProj, -1.0));
  float tHit = dot(uGO, uGN) / dot(rd, uGN);
  vec3 hit = rd * tHit - uGO;
  vec2 g = vec2(dot(hit, uGU), dot(hit, uGV));

  // wipers: how long since a blade last passed over this point?
  float swept = 0.0;
  float since = 1e3;
  for (int i = 0; i < 2; i++) {
    vec2 p = g - uWipPivot[i];
    float r = length(p);
    float a = atan(p.y, p.x);
    float inside = ramp(uWipR[i].x - 0.006, uWipR[i].x + 0.006, r)
                 * ramp(uWipR[i].y + 0.006, uWipR[i].y - 0.006, r)
                 * step(uSweep.x, a) * step(a, uSweep.y);
    float y = clamp((a - uSweep.x) / (uSweep.y - uSweep.x), 0.0, 1.0);
    float xe = acos(1.0 - 2.0 * y) / 3.14159265;
    float tUp = xe * uCycle.z;
    float tDn = uCycle.z + (1.0 - xe) * uCycle.w;
    float c = uCycle.x;
    float s = c >= tDn ? c - tDn : (c >= tUp ? c - tUp : c + uCycle.y - tDn);
    since = mix(since, min(since, s), step(0.5, inside));
    swept = max(swept, inside);
  }
  swept *= uWipOn;
  float regrow = mix(1.0, clamp(since / 4.6, 0.0, 1.0), swept);

  // water
  float wet = uRain * regrow;
  vec3 b1 = beads(g, 30.0, wet * 0.7);
  vec3 b2 = beads(g + 7.31, 62.0, wet * 0.8);
  float keep = 1.0 - 0.92 * swept;
  vec4 r1 = runners(g, 1.0, 0.55 * uRain * (1.0 - uSpeed) * keep);
  vec4 r2 = runners(g + 3.7, -1.0, 0.6 * uRain * uSpeed * keep);
  vec2 n = b1.xy + b2.xy + r1.xy + r2.xy;
  float cover = clamp(b1.z + b2.z + r1.z + r2.z, 0.0, 1.0);
  float cleared = max(r1.w, r2.w);

  // the thin film a blade leaves behind, and the haze where it never reaches
  float mist = mix(2.7, 0.2 + 0.75 * regrow, swept);
  mist = mix(mist, 0.5, cleared);
  mist = mix(mist, 0.0, cover);

  // each drop is a little lens: it shows the scene flipped and shrunk
  vec2 lens = n * vec2(uProj.y / uProj.x, 1.0) * 0.085;
  vec3 col = blurSample(uv - lens, mist);

  float rr = length(n);
  col *= 1.0 - 0.34 * cover * ramp(0.25, 0.62, rr);
  float glint = cover * ramp(0.38, 0.62, dot(n, normalize(vec2(-0.5, 0.86))));
  col += glint * mix(0.16, 0.05, uNight);

  // lens vignette
  vec2 vq = (uv - 0.5) * vec2(1.05, 1.15);
  col *= 1.0 - 0.42 * ramp(0.38, 0.95, length(vq));

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class GlassPass {
  constructor() {
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.uniforms = {
      tScene: { value: null },
      uTexel: { value: new Vector2(1, 1) },
      uProj: { value: new Vector2(1, 1) },
      uGO: { value: new Vector3() },
      uGU: { value: new Vector3() },
      uGV: { value: new Vector3() },
      uGN: { value: new Vector3() },
      uWipPivot: { value: WIPERS.map((w) => new Vector2(w.pivot[0], w.pivot[1])) },
      uWipR: { value: WIPERS.map((w) => new Vector2(w.r0, w.r1)) },
      uSweep: { value: new Vector2(WIPER_SWEEP[0], WIPER_SWEEP[1]) },
      uCycle: { value: new Vector4(0, 3, 0.6, 0.6) },
      uWipOn: { value: 1 },
      uTime: { value: 0 },
      uRain: { value: 1 },
      uSpeed: { value: 0 },
      uMaxLod: { value: 4 },
      uNight: { value: 0 },
    };
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: FRAG,
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  /** Express the windshield plane in the camera's view space. */
  setView(camera) {
    const u = this.uniforms;
    const view = camera.matrixWorldInverse;
    u.uGO.value.copy(GLASS.origin).applyMatrix4(view);
    u.uGU.value.copy(GLASS.u).transformDirection(view);
    u.uGV.value.copy(GLASS.v).transformDirection(view);
    u.uGN.value.copy(GLASS.n).transformDirection(view);
    const t = Math.tan((camera.fov * Math.PI) / 360);
    u.uProj.value.set(t * camera.aspect, t);
  }

  render(renderer, texture, width, height) {
    this.uniforms.tScene.value = texture;
    this.uniforms.uTexel.value.set(1 / width, 1 / height);
    renderer.render(this.scene, this.camera);
  }
}

/**
 * Wiper timing. The shader inverts this exact motion to know when a blade
 * last crossed any point on the glass.
 */
export class WiperClock {
  constructor() {
    this.c = 0.9;
    this.period = 3.4;
    this.up = 0.62;
    this.down = 0.62;
    this.nextPeriod = 3.4;
  }

  /** Changes take effect at the end of the current sweep so nothing jumps. */
  setPeriod(p) {
    this.nextPeriod = p;
  }

  step(dt) {
    this.c += dt;
    if (this.c >= this.period) {
      this.c -= this.period;
      this.period = this.nextPeriod;
      if (this.c >= this.period) this.c = 0;
    }
  }

  /** Blade angle (radians from parked). */
  angle() {
    const c = this.c;
    let y = 0;
    if (c < this.up) y = 0.5 - 0.5 * Math.cos((Math.PI * c) / this.up);
    else if (c < this.up + this.down) y = 0.5 - 0.5 * Math.cos(Math.PI * (1 - (c - this.up) / this.down));
    return WIPER_SWEEP[0] + (WIPER_SWEEP[1] - WIPER_SWEEP[0]) * y;
  }

  write(v4) {
    v4.set(this.c, this.period, this.up, this.down);
  }
}
