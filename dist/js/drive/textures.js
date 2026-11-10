/* ==========================================================================
   Drive — detail textures
   --------------------------------------------------------------------------
   Nothing here is downloaded. Each texture is drawn once on the GPU at
   start-up (a fragment shader into a render target), tiles seamlessly and
   carries mipmaps, so it is crisp up close and melts into the flat low-poly
   colour with distance. The models and their colours stay as they are; these
   only say what the surface is made of.

     world    R rock: bedding planes and fractures     G foliage: clumps of leaves
              B bark (on its side: the grain of a board)   A gravel and soil
     litter   R leaf coverage   G which colour   B shading within the leaf
     asphalt  RG surface normal   B aggregate tone   A cracks (sampled much larger)
     cabin    RG leather normal   B leather mottle   A suede nap / brushed metal

   Every channel averages about 0.5, so "× 2 × value" leaves a surface's overall
   colour where it was.
   ========================================================================== */

import {
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
} from '../vendor/three.module.min.js';

/* Noise that repeats: every lattice lookup wraps at `per` cells, so anything
   built from these tiles without a seam. Integer hashing keeps the patterns
   identical from one GPU to the next. */
const LIB = /* glsl */ `
precision highp float;
precision highp int;
varying vec2 vUv;
uniform float uTexel;

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
uint cellHash(ivec2 c, ivec2 per, int seed) {
  ivec2 w = ivec2(mod(vec2(c), vec2(per)));
  return pcg(uint(w.x) + pcg(uint(w.y) + pcg(uint(seed))));
}
float h1(ivec2 c, ivec2 per, int seed) {
  return float(cellHash(c, per, seed)) * (1.0 / 4294967295.0);
}
vec2 h2(ivec2 c, ivec2 per, int seed) {
  uint a = cellHash(c, per, seed);
  return vec2(float(a), float(pcg(a))) * (1.0 / 4294967295.0);
}
float vnoise(vec2 uv, ivec2 per, int seed) {
  vec2 p = uv * vec2(per);
  vec2 f = fract(p);
  ivec2 c = ivec2(floor(p));
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(c, per, seed), h1(c + ivec2(1, 0), per, seed), f.x),
             mix(h1(c + ivec2(0, 1), per, seed), h1(c + ivec2(1, 1), per, seed), f.x), f.y);
}
float fbm(vec2 uv, ivec2 per, int octaves, int seed) {
  float a = 0.5, s = 0.0, n = 0.0;
  for (int k = 0; k < octaves; k++) {
    s += a * vnoise(uv, per, seed + k * 17);
    n += a;
    a *= 0.5;
    per *= 2;
  }
  return s / n;
}
// Cellular noise: distance to the nearest and second-nearest feature point, and the nearest one's hash.
struct Cell { float f1; float f2; vec2 id; };
Cell worley(vec2 uv, ivec2 per, int seed) {
  vec2 p = uv * vec2(per);
  ivec2 c = ivec2(floor(p));
  vec2 f = fract(p);
  Cell w = Cell(9.0, 9.0, vec2(0.0));
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      ivec2 o = ivec2(i, j);
      vec2 r = h2(c + o, per, seed);
      float dist = length(vec2(o) + r - f);
      if (dist < w.f1) { w.f2 = w.f1; w.f1 = dist; w.id = r; }
      else if (dist < w.f2) { w.f2 = dist; }
    }
  }
  return w;
}
// Turn a height field into the xy of a surface normal, packed into 0..1.
#define NORMAL_FROM(H, uv, strength) (normalize(vec3(vec2(H(uv) - H(uv + vec2(uTexel, 0.0)), H(uv) - H(uv + vec2(0.0, uTexel))) / uTexel * (strength), 1.0)).xy * 0.5 + 0.5)
`;

const WORLD = /* glsl */ `
void main() {
  vec2 uv = vUv;
  vec2 jit = 0.03 * (vec2(fbm(uv, ivec2(8), 3, 35), fbm(uv, ivec2(8), 3, 37)) - 0.5);

  // R — rock: bedding planes stacked up the face, broken into blocks by fractures
  float warp = fbm(uv, ivec2(4), 4, 11);
  float beds = fbm(uv + vec2(0.0, 0.05 * (warp - 0.5)), ivec2(3, 16), 3, 21);
  float mass = fbm(uv, ivec2(6), 5, 31);
  // blocks are wider than they are tall, and the joints between them only open up in places
  Cell blk = worley(uv + jit, ivec2(5, 11), 41);
  float open = smoothstep(0.38, 0.62, fbm(uv, ivec2(3), 3, 45));
  float crack = (1.0 - smoothstep(0.0, 0.05, blk.f2 - blk.f1)) * (0.25 + 0.75 * open);
  float speck = vnoise(uv, ivec2(220), 51);
  float rock = 0.53 + 0.62 * (beds - 0.5) + 0.42 * (mass - 0.5) + 0.2 * (blk.id.x - 0.5) + 0.1 * (speck - 0.5) - 0.42 * crack;

  // G — foliage: clumps of leaves, each leaf catching the light a little differently
  Cell clump = worley(uv + jit * 1.5, ivec2(9), 61);
  Cell lf = worley(uv, ivec2(36), 71);
  float gap = smoothstep(0.0, 0.2, lf.f2 - lf.f1);
  float heart = 1.0 - smoothstep(0.15, 0.8, clump.f1);
  float foliage = (0.2 + 0.52 * lf.id.x + 0.3 * heart + 0.16 * (clump.id.y - 0.5)) * mix(0.42, 1.0, gap);

  // B — bark: long furrows between plates
  float bw = fbm(uv, ivec2(5, 3), 3, 81);
  float ridge = abs(fract(uv.x * 13.0 + 1.7 * bw) - 0.5) * 2.0;
  float plates = fbm(uv, ivec2(26, 4), 3, 91);
  float bark = 0.5 * smoothstep(0.0, 0.55, ridge) + 0.42 * plates - 0.08;

  // A — gravel and soil: stones bedded in grit
  Cell st = worley(uv, ivec2(88), 101);
  float dome = 1.0 - smoothstep(0.0, 0.6, st.f1);
  float grit = fbm(uv, ivec2(14), 4, 111);
  float gravel = 0.16 + dome * (0.22 + 0.42 * st.id.x) + 0.36 * grit;

  gl_FragColor = clamp(vec4(rock, foliage, bark, gravel), 0.0, 1.0);
}
`;

const LITTER = /* glsl */ `
// One layer of fallen leaves: a jittered grid of pointed ovals at random angles.
// Later leaves lie on top of earlier ones.
vec4 scatter(vec4 acc, vec2 uv, int n, int seed, float density) {
  ivec2 per = ivec2(n);
  vec2 p = uv * float(n);
  ivec2 c = ivec2(floor(p));
  vec2 f = fract(p);
  float aa = uTexel * float(n);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      ivec2 o = ivec2(i, j);
      vec2 r = h2(c + o, per, seed);
      vec2 q = h2(c + o, per, seed + 5);
      if (q.x > density) continue;
      vec2 d = f - (vec2(o) + 0.1 + 0.8 * r);
      float ang = q.y * 6.2832;
      float cs = cos(ang), sn = sin(ang);
      vec2 l = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y);
      float len = 0.3 + 0.18 * r.y;
      float t = l.x / len;
      float halfW = len * (0.4 + 0.25 * r.x) * (1.0 - t * t);
      float m = smoothstep(-aa, aa, halfW - abs(l.y)) * step(abs(t), 1.0);
      float vein = 1.0 - smoothstep(0.0, 0.02 + aa, abs(l.y));
      float curl = abs(l.y) / max(halfW, 1e-3);
      float shade = 0.5 + 0.34 * fract(q.y * 7.3) - 0.28 * vein + 0.16 * curl;
      acc = mix(acc, vec4(1.0, fract(q.y * 5.3 + r.x), shade, 1.0), m);
    }
  }
  return acc;
}
void main() {
  vec4 acc = vec4(0.0, 0.5, 0.5, 1.0);
  acc = scatter(acc, vUv, 11, 301, 0.5);
  acc = scatter(acc, vUv, 15, 311, 0.55);
  acc = scatter(acc, vUv, 19, 321, 0.5);
  gl_FragColor = clamp(acc, 0.0, 1.0);
}
`;

const ASPHALT = /* glsl */ `
// chippings standing a little proud of the binder
float surfaceH(vec2 uv) {
  Cell s = worley(uv, ivec2(96), 131);
  float dome = 1.0 - smoothstep(0.0, 0.62, s.f1);
  return dome * (0.55 + 0.45 * s.id.y) + 0.2 * fbm(uv, ivec2(150), 2, 141);
}
void main() {
  vec2 uv = vUv;
  Cell s = worley(uv, ivec2(96), 131);
  float stone = 1.0 - smoothstep(0.3, 0.62, s.f1);
  float fine = fbm(uv, ivec2(150), 2, 141);
  // most chippings are dark; a few pale ones catch the eye
  float tone = 0.3 + stone * (0.12 + 0.5 * s.id.x * s.id.x) + 0.34 * (fine - 0.5);

  // cracks follow the contour lines of slow noise, and only turn up in patches
  float n1 = fbm(uv, ivec2(3), 4, 151);
  float where = smoothstep(0.5, 0.64, fbm(uv, ivec2(2), 3, 161));
  float crack = (1.0 - smoothstep(0.0, 0.0055, abs(n1 - 0.5))) * where;

  gl_FragColor = clamp(vec4(NORMAL_FROM(surfaceH, uv, 0.0042), tone, crack), 0.0, 1.0);
}
`;

const CABIN = /* glsl */ `
// pebbled hide: low domes with creases between them, and pores
float hideH(vec2 uv) {
  vec2 j = 0.01 * (vec2(fbm(uv, ivec2(10), 3, 171), fbm(uv, ivec2(10), 3, 181)) - 0.5);
  Cell c = worley(uv + j, ivec2(60), 191);
  float crease = smoothstep(0.0, 0.22, c.f2 - c.f1);
  float dome = 1.0 - 0.45 * smoothstep(0.0, 0.75, c.f1);
  return crease * dome + 0.05 * vnoise(uv, ivec2(340), 201);
}
void main() {
  vec2 uv = vUv;
  Cell c = worley(uv, ivec2(60), 191);
  float mottle = 0.5 + 0.7 * (fbm(uv, ivec2(5), 4, 211) - 0.5) + 0.12 * (c.id.x - 0.5);
  // suede: a fine nap, brushed this way and that in soft patches
  float nap = 0.5 + 0.55 * (fbm(uv, ivec2(5), 3, 221) - 0.5) + 0.45 * (vnoise(uv, ivec2(300, 210), 231) - 0.5);
  gl_FragColor = clamp(vec4(NORMAL_FROM(hideH, uv, 0.0014), mottle, nap), 0.0, 1.0);
}
`;

/**
 * @param {import('../vendor/three.module.min.js').WebGLRenderer} renderer
 * @param {number} size texels per side (a power of two)
 * @param {number} aniso anisotropic filtering for the road, which is seen edge-on for its whole
 *   length; the other surfaces get half of it. Cheap on a desktop GPU, worth rationing on a phone.
 */
export function makeDetailTextures(renderer, size, aniso) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new Mesh(new PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);
  const targets = [];

  const bake = (body, anisotropy) => {
    const rt = new WebGLRenderTarget(size, size, {
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping,
      anisotropy: Math.max(1, Math.min(anisotropy, maxAniso)),
    });
    const material = new ShaderMaterial({
      uniforms: { uTexel: { value: 1 / size } },
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: LIB + body,
    });
    quad.material = material;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    material.dispose();
    targets.push(rt);
    return rt.texture;
  };

  const previous = renderer.getRenderTarget();
  const out = {
    world: bake(WORLD, aniso / 2),
    litter: bake(LITTER, aniso / 2),
    asphalt: bake(ASPHALT, aniso),
    cabin: bake(CABIN, Math.min(2, aniso)),
    dispose() {
      for (const rt of targets) rt.dispose();
    },
  };
  renderer.setRenderTarget(previous);
  quad.geometry.dispose();
  return out;
}
