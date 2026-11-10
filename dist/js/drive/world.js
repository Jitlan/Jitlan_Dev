/* ==========================================================================
   Drive — the world outside the windshield
   --------------------------------------------------------------------------
   Streams the mountain road in 80 m chunks: asphalt, verge, rock cut on the
   uphill side, a drop on the other, guardrail, signs and a few hundred
   autumn trees. Plus sky, far ridgelines, rain and drifting leaves.
   ========================================================================== */

import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  FogExp2,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NormalBlending,
  Object3D,
  PointLight,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from '../vendor/three.module.min.js';
import { COURSE, ROAD } from './road.js';
import { clamp, fbm, hash2, lerp, mulberry32, roundRect, smoothstep, softMin, vnoise } from './util.js';

const DS = ROAD.DS;
const W = ROAD.HALF_WIDTH;
const CH = 40; // samples per chunk
export const CHUNK_LEN = CH * DS;

// Distance beyond the asphalt edge for each terrain column.
const COLS = [0, 1.1, 2.1, 2.9, 3.7, 4.6, 6.2, 8.6, 12.5, 18.5, 27, 40, 58, 86];
const NC = COLS.length;

/* --------------------------------------------------------------------------
   Palettes — index 0 is the overcast afternoon, 1 the same road after dark.
   -------------------------------------------------------------------------- */
const PALETTE = {
  fog: ['#a7b1b6', '#0e151c'],
  zenith: ['#737f89', '#04070b'],
  mtnFar: ['#74828d', '#0a1017'],
  mtnMid: ['#59646a', '#080c11'],
  mtnNear: ['#4b4a3c', '#06090c'],
  mtnLeaf: ['#a8581f', '#0c0b0a'],
  hemiSky: ['#d3dbe0', '#3b5068'],
  hemiGround: ['#7a6652', '#0c0e12'],
  sun: ['#fff0d9', '#7d9cc4'],
  roadAmbient: ['#c2cad0', '#0b1016'],
  roadSky: ['#b9c3c8', '#131c25'],
  rain: ['#dfe7ec', '#c9d6e2'],
};
const LEVELS = {
  hemi: [2.7, 0.55],
  sun: [0.85, 0.1],
  head: [0.08, 1.0], // daytime running lights vs. full beam
  rainAlpha: [0.3, 0.16],
  reflector: [0.75, 1.0],
  signGlow: [0.18, 0.12], // at night the boards live off the headlamps, like real retroreflective sheeting
  cafeGlow: [0.72, 1.0], // windows and bulbs
  cafeLamp: [0, 24], // warm light spilling off the porch
  cafeSign: [0.3, 0.75],
};

const _c0 = new Color();
const _c1 = new Color();
function mixColor(target, pair, t) {
  _c0.set(pair[0]);
  _c1.set(pair[1]);
  return target.copy(_c0).lerp(_c1, t);
}
function lin(hex) {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
}

/* --------------------------------------------------------------------------
   GLSL shared bits
   -------------------------------------------------------------------------- */
const GLSL_NOISE = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float ramp(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
float fbm2(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * noise2(p); p = p * 2.02 + 7.3; a *= 0.5; }
  return s / 0.9375;
}
`;

/* --------------------------------------------------------------------------
   Headlamps
   --------------------------------------------------------------------------
   Two separate LED units, one per front corner, in a crisp cool white. Each
   throws a dipped beam with a hard horizontal cut-off (kicking up toward the
   verge); at night the main beams are on as well, flooding the road far
   ahead and the trees above it. The pair swivels a little into bends. Everything that can be lit
   by them (road, terrain, trees, signs, rain, leaves) shares these uniforms.
   -------------------------------------------------------------------------- */
function makeHeadUniforms() {
  return {
    uLampL: { value: new Vector3() },
    uLampR: { value: new Vector3() },
    uLampLRel: { value: new Vector3() }, // relative to the camera, for the weather particles
    uLampRRel: { value: new Vector3() },
    uBeamF: { value: new Vector3(0, 0, -1) },
    uBeamR: { value: new Vector3(1, 0, 0) },
    uBeamU: { value: new Vector3(0, 1, 0) },
    uHeadColor: { value: new Color().setRGB(0.86 * 1.7, 0.93 * 1.7, 1.0 * 1.7) },
    uHead: { value: 0 },
    uHigh: { value: 0 },
  };
}

const GLSL_HEAD = /* glsl */ `
uniform vec3 uBeamF, uBeamR, uBeamU, uHeadColor;
uniform float uHead, uHigh;
// One lamp. L runs from the lamp to the point being lit.
float lampBeam(vec3 L) {
  float z = dot(L, uBeamF);
  if (z < 0.4) return 0.0;
  float ax = dot(L, uBeamR) / z;
  float ay = dot(L, uBeamU) / z;
  float d2 = dot(L, L);
  // dipped beam: flat cut-off just below the horizon, rising toward the nearside verge
  float cutY = -0.012 + clamp(ax, 0.0, 0.16) * 0.27;
  float below = 1.0 - smoothstep(cutY - 0.005, cutY + 0.005, ay);
  float wash = exp(-ax * ax / 0.5);
  float gap = max(cutY - ay, 0.0) / 0.06;
  float hot = exp(-ax * ax / 0.045) * exp(-gap * gap);
  float low = below * (0.55 * wash + 1.25 * hot) / (1.0 + d2 / 520.0);
  // main beam: a broad, tall flood on top of that, reaching well down the road and up into the trees
  float rise = (ay - 0.01) / 0.17;
  float high = exp(-ax * ax / 0.17) * exp(-rise * rise) / (1.0 + d2 / 5200.0);
  return low + uHigh * 1.3 * high;
}
`;

function shareHead(uniforms, head) {
  for (const k of Object.keys(head)) uniforms[k] = head[k];
}

/* --------------------------------------------------------------------------
   Surface detail
   --------------------------------------------------------------------------
   The models are flat-shaded facets with one colour each. These snippets lay
   the generated detail textures (textures.js) over that colour, in world
   space, so the facets keep their shape and tone but read as rock, leaf
   litter, foliage, bark or timber. Each facet faces one way, so the texture is
   simply projected along the facet's dominant axis: one lookup, no blending.
   -------------------------------------------------------------------------- */
const LEAF_LITTER = ['#8f2a16', '#b5501a', '#c88a1c'].map((h) => `vec3(${lin(h).map((v) => v.toFixed(4)).join(', ')})`);

const GLSL_DETAIL = {
  // shared: which way the facet faces, the projected coordinate and its screen-space gradient
  // (taken from the view-space position, which stays precise miles from the origin)
  project: /* glsl */ `
    mat3 dToWorld = transpose(mat3(viewMatrix));
    vec3 dN = abs(dToWorld * normal);
    vec3 dPx = dToWorld * dFdx(vViewPosition);
    vec3 dPy = dToWorld * dFdy(vViewPosition);
    vec2 dUv, dGx, dGy;
    if (dN.y >= dN.x && dN.y >= dN.z) { dUv = vHeadWorld.xz; dGx = dPx.xz; dGy = dPy.xz; }
    else if (dN.x >= dN.z) { dUv = vHeadWorld.zy; dGx = dPx.zy; dGy = dPy.zy; }
    else { dUv = vHeadWorld.xy; dGx = dPx.xy; dGy = dPy.xy; }
  `,
  // hillside: bedded, fractured rock where it is steep; soil, stones and fallen leaves where it is not
  ground: /* glsl */ `
    {
      float rockK = 1.0 - smoothstep(0.58, 0.8, dN.y);
      vec4 dA = textureGrad(tDetail, dUv / 3.2, dGx / 3.2, dGy / 3.2);
      vec3 base = diffuseColor.rgb;
      vec3 rockCol = base;
      vec3 soilCol = base;
      if (rockK > 0.0) {
        // a second, much larger lookup keeps a big face from showing the repeat
        float far = textureGrad(tDetail, dUv / 13.0 + 0.31, dGx / 13.0, dGy / 13.0).r;
        rockCol *= 0.44 + 1.12 * (dA.r * 0.72 + far * 0.28);
      }
      if (rockK < 1.0) {
        vec4 dL = textureGrad(tLitter, dUv / 1.8, dGx / 1.8, dGy / 1.8);
        soilCol *= 0.5 + dA.a;
        float mx = max(base.r, max(base.g, base.b));
        float mn = min(base.r, min(base.g, base.b));
        float earthy = smoothstep(0.1, 0.35, (mx - mn) / max(mx, 1e-4)); // fewer leaves settle on gravel
        vec3 leaf = dL.g < 0.5 ? mix(${LEAF_LITTER[0]}, ${LEAF_LITTER[1]}, dL.g * 2.0) : mix(${LEAF_LITTER[1]}, ${LEAF_LITTER[2]}, dL.g * 2.0 - 1.0);
        soilCol = mix(soilCol, leaf * (0.5 + dL.b), dL.r * mix(0.2, 0.9, earthy));
      }
      diffuseColor.rgb = mix(soilCol, rockCol, rockK);
    }
  `,
  // trees: furrowed bark on the trunk, clumps of leaves on the canopy
  tree: /* glsl */ `
    if (vBark > 0.5) {
      vec2 bs = vec2(0.55, 1.7);
      diffuseColor.rgb *= 0.4 + 1.2 * textureGrad(tDetail, dUv / bs, dGx / bs, dGy / bs).b;
    } else {
      float leafy = textureGrad(tDetail, dUv / 2.6, dGx / 2.6, dGy / 2.6).g;
      diffuseColor.rgb *= 0.5 + leafy;
      // leaves that catch the light go a shade more golden, the ones in shadow a shade redder
      diffuseColor.rgb *= mix(vec3(0.94, 0.86, 1.0), vec3(1.1, 1.06, 0.7), smoothstep(0.25, 0.8, leafy));
    }
  `,
  // rails, posts and the café: boards with grain and joints wherever the colour is timber,
  // weathering streaks on steel, stone and the roof
  prop: /* glsl */ `
    {
      vec3 base = diffuseColor.rgb;
      float mx = max(base.r, max(base.g, base.b));
      float wood = smoothstep(0.22, 0.4, (base.r - base.b) / max(mx, 1e-4));
      bool flatTop = dN.y >= dN.x && dN.y >= dN.z;
      // boards lie flat along a wall and run the length of the deck; the grain's fast axis crosses them
      vec2 bu = flatTop ? dUv : dUv.yx;
      vec2 bgx = flatTop ? dGx : dGx.yx;
      vec2 bgy = flatTop ? dGy : dGy.yx;
      vec2 bs = vec2(0.42, 2.2);
      float grain = textureGrad(tDetail, bu / bs, bgx / bs, bgy / bs).b;
      float across = bu.x / 0.21;
      float aw = (abs(bgx.x) + abs(bgy.x)) / 0.21;
      float joint = smoothstep(0.45 - aw, 0.45 + aw, abs(fract(across) - 0.5)) * (1.0 - smoothstep(0.15, 0.45, aw));
      float tone = 0.86 + 0.28 * fract(sin(floor(across) * 91.7 + 3.1) * 43758.5);
      vec3 timber = base * (0.5 + grain) * tone * (1.0 - 0.55 * joint);
      vec3 other = base * (0.74 + 0.52 * textureGrad(tDetail, dUv / 2.1, dGx / 2.1, dGy / 2.1).r);
      diffuseColor.rgb = mix(other, timber, wood);
    }
  `,
};

/**
 * Teach a built-in Lambert material about the headlamps and, optionally, what its surface is made of.
 * @param {{kind: 'ground'|'tree'|'prop', world: object, litter: object}} [detail]
 */
function lightByHeadlamps(material, head, detail = null) {
  const kind = detail ? detail.kind : '';
  material.onBeforeCompile = (shader) => {
    shareHead(shader.uniforms, head);
    if (detail) {
      shader.uniforms.tDetail = { value: detail.world };
      shader.uniforms.tLitter = { value: detail.litter };
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vHeadWorld;${kind === 'tree' ? '\nattribute float aBark;\nvarying float vBark;' : ''}`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 headWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          headWorld = instanceMatrix * headWorld;
        #endif
        vHeadWorld = (modelMatrix * headWorld).xyz;${kind === 'tree' ? '\nvBark = aBark;' : ''}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vHeadWorld;\nuniform vec3 uLampL, uLampR;\n${detail ? 'uniform sampler2D tDetail, tLitter;\n' : ''}${kind === 'tree' ? 'varying float vBark;\n' : ''}${GLSL_HEAD}`,
      )
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${detail ? GLSL_DETAIL.project + GLSL_DETAIL[kind] : ''}`)
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        {
          vec3 la = vHeadWorld - uLampL;
          vec3 lb = vHeadWorld - uLampR;
          mat3 toView = mat3(viewMatrix);
          float fa = lampBeam(la) * clamp(dot(normal, -normalize(toView * la)) * 0.6 + 0.4, 0.0, 1.0);
          float fb = lampBeam(lb) * clamp(dot(normal, -normalize(toView * lb)) * 0.6 + 0.4, 0.0, 1.0);
          reflectedLight.directDiffuse += diffuseColor.rgb * uHeadColor * (uHead * (fa + fb));
        }`,
      );
  };
  material.customProgramCacheKey = () => `headlamps:${kind}`;
  return material;
}

/* --------------------------------------------------------------------------
   Sky dome: cloud deck, three ridgelines, valley haze
   -------------------------------------------------------------------------- */
function makeSkyMaterial() {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uZenith: { value: new Color() },
      uHorizon: { value: new Color() },
      uMtnFar: { value: new Color() },
      uMtnMid: { value: new Color() },
      uMtnNear: { value: new Color() },
      uLeaf: { value: new Color() },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * vec4(mat3(modelViewMatrix) * position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uZenith, uHorizon, uMtnFar, uMtnMid, uMtnNear, uLeaf;
      uniform float uTime;
      varying vec3 vDir;
      ${GLSL_NOISE}
      float ridge(float az, float freq, float seed) {
        vec2 c = vec2(cos(az), sin(az)) * freq + seed;
        float n = fbm2(c);
        float r = 1.0 - abs(2.0 * fbm2(c * 1.7 + 3.1) - 1.0);
        return mix(n, r, 0.45);
      }
      void main() {
        vec3 d = normalize(vDir);
        float el = d.y;
        float az = atan(d.x, -d.z);
        vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.75, el), 0.55));

        vec2 cuv = d.xz / (max(el, 0.0) + 0.22);
        float c = fbm2(cuv * 1.3 + vec2(uTime * 0.012, uTime * 0.004));
        float c2 = fbm2(cuv * 3.1 - vec2(uTime * 0.02, 0.0));
        col *= mix(0.78, 1.16, smoothstep(0.25, 0.8, c * 0.7 + c2 * 0.3));
        col = mix(col, uHorizon, ramp(0.18, 0.0, el) * 0.85);

        float aa = fwidth(el) * 1.5 + 0.0015;
        float h1 = 0.085 + 0.13 * ridge(az, 2.2, 1.7);
        col = mix(col, mix(uHorizon, uMtnFar, 0.4), ramp(h1 + aa, h1 - aa, el));
        col = mix(col, uHorizon, ramp(0.12, 0.03, el) * 0.4 * step(el, h1));
        float h2 = 0.035 + 0.11 * ridge(az, 3.7, 9.2);
        col = mix(col, mix(uHorizon, uMtnMid, 0.62), ramp(h2 + aa, h2 - aa, el));
        col = mix(col, uHorizon, ramp(0.07, 0.0, el) * 0.3 * step(el, h2));
        float h3 = -0.012 + 0.085 * ridge(az, 6.1, 4.4);
        float patches = noise2(vec2(az * 60.0, el * 220.0));
        vec3 nearCol = mix(uMtnNear, uLeaf, smoothstep(0.42, 0.8, patches) * 0.6);
        col = mix(col, mix(uHorizon, nearCol, 0.8), ramp(h3 + aa, h3 - aa, el));
        col = mix(col, uHorizon, ramp(0.035, -0.05, el));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/* --------------------------------------------------------------------------
   Wet asphalt
   -------------------------------------------------------------------------- */
function makeRoadMaterial(head, asphalt) {
  const mat = new ShaderMaterial({
    fog: true,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uAsphalt: { value: new Color('#34363a') },
        uAsphalt2: { value: new Color('#47484a') },
        uYellow: { value: new Color('#c99a1e') },
        uWhite: { value: new Color('#c9c9c2') },
        uLeafA: { value: new Color('#b5501a') },
        uLeafB: { value: new Color('#c88a1c') },
        uLeafC: { value: new Color('#8f2a16') },
        uSky: { value: new Color() },
        uAmbient: { value: new Color() },
        uHalfWidth: { value: W },
        uFinish: { value: -1e6 },
        uTime: { value: 0 },
        tAsphalt: { value: null },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vRel;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vRel = wp.xyz - cameraPosition; // small numbers: clean screen-space gradients for the texture lookups
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uAsphalt, uAsphalt2, uYellow, uWhite, uLeafA, uLeafB, uLeafC, uSky, uAmbient;
      uniform vec3 uLampL, uLampR;
      uniform float uHalfWidth, uTime, uFinish;
      uniform sampler2D tAsphalt;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vRel;
      #include <fog_pars_fragment>
      ${GLSL_NOISE}
      ${GLSL_HEAD}
      void main() {
        float x = (vUv.x - 0.5) * 2.0 * uHalfWidth;
        float ax = abs(x);
        float fw = fwidth(x) * 1.2 + 0.004;
        vec2 wp = vWorld.xz;

        // chippings in binder up close, hairline cracks here and there, slow patchiness over it all
        vec2 gx = dFdx(vRel.xz);
        vec2 gy = dFdy(vRel.xz);
        vec4 chip = textureGrad(tAsphalt, wp / 1.7, gx / 1.7, gy / 1.7);
        float crack = textureGrad(tAsphalt, wp / 7.3 + 0.21, gx / 7.3, gy / 7.3).a;
        vec3 alb = mix(uAsphalt, uAsphalt2, chip.b * 1.05 + fbm2(wp * 0.35) * 0.5 - 0.16);
        alb *= 1.0 - 0.7 * crack;
        float track = ramp(0.55, 0.15, abs(abs(ax - 1.85) - 0.78));
        alb *= 1.0 - 0.12 * track;

        // paint: double yellow centre, white edge lines, worn by weather
        float wear = 0.5 + 0.5 * smoothstep(0.3, 0.7, noise2(wp * 3.0) * 0.55 + noise2(wp * 0.6) * 0.5);
        float yl = ramp(0.06 + fw, 0.06 - fw, abs(ax - 0.14));
        float wl = ramp(0.065 + fw, 0.065 - fw, abs(ax - (uHalfWidth - 0.34)));
        float tooth = 0.72 + 0.56 * chip.b; // paint takes the texture of what it's laid on
        alb = mix(alb, uYellow * tooth, yl * wear);
        alb = mix(alb, uWhite * tooth, wl * wear);

        // chequered finish line across the road at the end of the course
        float fs = vUv.y - uFinish;
        float fin = step(abs(fs), 1.2) * step(ax, uHalfWidth - 0.45);
        float chk = mod(floor(x / 0.6) + floor((fs + 1.2) / 0.6), 2.0);
        alb = mix(alb, mix(vec3(0.02), uWhite, chk), fin * 0.92);
        wl = max(wl, fin * chk);

        // fallen leaves, drifting up against the verges
        vec2 lc = wp * 5.5;
        vec2 li = floor(lc);
        vec2 lf = fract(lc) - 0.5;
        float lh = hash21(li);
        float density = mix(0.03, 0.5, smoothstep(uHalfWidth - 1.7, uHalfWidth, ax)) + 0.04 * ramp(0.6, 0.0, ax);
        vec2 lo = (vec2(hash21(li + 3.1), hash21(li + 7.7)) - 0.5) * 0.5;
        float ang = lh * 6.2832;
        vec2 lp = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (lf - lo);
        float leaf = ramp(0.2, 0.13, length(lp * vec2(1.0, 1.9))) * step(lh, density);
        leaf *= ramp(140.0, 60.0, vFogDepth);
        vec3 leafCol = mix(mix(uLeafA, uLeafB, hash21(li + 1.3)), uLeafC, step(0.72, hash21(li + 5.9)));
        alb = mix(alb, leafCol, leaf);

        // standing water mirrors the sky at grazing angles
        vec3 V = normalize(cameraPosition - vWorld);
        float puddle = smoothstep(0.5, 0.7, fbm2(wp * 0.16 + 3.7)) * (0.45 + 0.55 * smoothstep(1.4, uHalfWidth, ax) + 0.4 * track);
        puddle = clamp(puddle, 0.0, 1.0);
        float rip = 0.1 * (1.0 - puddle * 0.7);
        // wet chippings scatter the sky's reflection; a puddle fills them in and lies flat
        vec2 rough = (chip.rg - 0.5) * 0.9 * (1.0 - puddle) * (1.0 - leaf);
        vec3 N = normalize(vec3((noise2(wp * 5.0 + uTime * 0.7) - 0.5) * rip + rough.x, 1.0, (noise2(wp * 5.0 + 31.0 - uTime * 0.5) - 0.5) * rip + rough.y));
        float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0);
        float shine = (0.3 + 0.62 * puddle) * (1.0 - leaf * 0.85);
        vec3 col = alb * uAmbient * (1.0 - 0.3 * puddle);
        col = mix(col, uSky, clamp(fres * shine, 0.0, 1.0));

        // headlamps: two pools that merge down the road; paint throws the light straight back
        float lit = (lampBeam(vWorld - uLampL) + lampBeam(vWorld - uLampR)) * uHead;
        col += alb * uHeadColor * lit * (1.0 - 0.45 * puddle);
        col += (uYellow * yl + uWhite * wl) * wear * uHeadColor * lit * 0.85;

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
  });
  shareHead(mat.uniforms, head);
  mat.uniforms.tAsphalt.value = asphalt;
  return mat;
}

/* --------------------------------------------------------------------------
   Rain streaks and tumbling leaves: wrap-around boxes that follow the camera
   -------------------------------------------------------------------------- */
function makeParticleGeometry(count, seed) {
  const rand = mulberry32(seed);
  const base = new Float32Array(count * 4 * 3);
  const corner = new Float32Array(count * 4 * 2);
  const rnd = new Float32Array(count * 4 * 2);
  const index = [];
  const corners = [
    [-1, 0],
    [1, 0],
    [1, 1],
    [-1, 1],
  ];
  for (let i = 0; i < count; i++) {
    const bx = rand();
    const by = rand();
    const bz = rand();
    const r1 = rand();
    const r2 = rand();
    for (let v = 0; v < 4; v++) {
      const o = i * 4 + v;
      base[o * 3] = bx;
      base[o * 3 + 1] = by;
      base[o * 3 + 2] = bz;
      corner[o * 2] = corners[v][0];
      corner[o * 2 + 1] = corners[v][1];
      rnd[o * 2] = r1;
      rnd[o * 2 + 1] = r2;
    }
    const b = i * 4;
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(base, 3));
  geo.setAttribute('aCorner', new Float32BufferAttribute(corner, 2));
  geo.setAttribute('aRand', new Float32BufferAttribute(rnd, 2));
  geo.setIndex(index);
  return geo;
}

function makeRainMaterial(head) {
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: NormalBlending,
    uniforms: {
      uCamMod: { value: new Vector3() },
      uBox: { value: new Vector3(40, 16, 40) },
      uTime: { value: 0 },
      uVel: { value: new Vector3(1.5, -9.5, 0.6) },
      uStreak: { value: new Vector3(0, -0.3, 0) },
      uColor: { value: new Color() },
      uAlpha: { value: 0.3 },
    },
    vertexShader: /* glsl */ `
      uniform vec3 uCamMod, uBox, uVel, uStreak, uLampLRel, uLampRRel;
      uniform float uTime;
      ${GLSL_HEAD}
      attribute vec2 aCorner, aRand;
      varying float vAlpha;
      varying float vSide;
      void main() {
        vec3 p = position * uBox + uVel * uTime * (0.8 + 0.4 * aRand.x);
        p = mod(p - uCamMod, uBox) - 0.5 * uBox;
        vec3 rel = p + uStreak * aCorner.y * (0.7 + 0.6 * aRand.y);
        vec4 mv = vec4(mat3(viewMatrix) * rel, 1.0);
        vec3 sv = mat3(viewMatrix) * uStreak;
        vec2 perp = normalize(vec2(-sv.y, sv.x) + vec2(1e-5, 0.0));
        float dist = length(p);
        mv.xy += perp * aCorner.x * (0.006 + 0.0009 * dist);
        gl_Position = projectionMatrix * mv;
        // drops crossing either beam light up
        float beam = min(lampBeam(p - uLampLRel) + lampBeam(p - uLampRRel), 2.5) * uHead;
        vAlpha = smoothstep(1.0, 3.5, dist) * (1.0 - smoothstep(12.0, 20.0, dist)) * (0.55 + 0.45 * aRand.y) * (1.0 + 2.2 * beam);
        vSide = aCorner.x;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      uniform float uAlpha;
      varying float vAlpha;
      varying float vSide;
      void main() {
        float a = vAlpha * uAlpha * (1.0 - vSide * vSide);
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
  shareHead(mat.uniforms, head);
  return mat;
}

function makeLeafMaterial(head) {
  const mat = new ShaderMaterial({
    transparent: false,
    side: DoubleSide,
    fog: true,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uCamMod: { value: new Vector3() },
        uBox: { value: new Vector3(44, 14, 44) },
        uTime: { value: 0 },
        uLight: { value: new Color() },
      },
    ]),
    vertexShader: /* glsl */ `
      uniform vec3 uCamMod, uBox, uLight, uLampLRel, uLampRRel;
      uniform float uTime;
      ${GLSL_HEAD}
      attribute vec2 aCorner, aRand;
      varying vec3 vCol;
      #include <fog_pars_vertex>
      void main() {
        float t = uTime * (0.6 + 0.6 * aRand.x);
        vec3 vel = vec3(1.4 + sin(t * 0.7 + aRand.y * 9.0), -1.1 - 0.5 * aRand.x, 0.5 * cos(t * 0.5 + aRand.x * 7.0));
        vec3 p = position * uBox + vel * uTime;
        p.x += sin(uTime * 1.3 + aRand.y * 40.0) * 0.6;
        p = mod(p - uCamMod, uBox) - 0.5 * uBox;
        vec4 mvPosition = vec4(mat3(viewMatrix) * p, 1.0);
        float a = uTime * (2.0 + 3.0 * aRand.y) + aRand.x * 50.0;
        float flip = cos(uTime * (2.5 + 2.0 * aRand.x) + aRand.y * 30.0);
        vec2 q = vec2(aCorner.x * 0.5, aCorner.y - 0.5) * vec2(0.07, 0.11) * (0.8 + 0.6 * aRand.x);
        q.x *= flip;
        mvPosition.xy += mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
        gl_Position = projectionMatrix * mvPosition;
        vec3 c1 = vec3(0.60, 0.18, 0.03);
        vec3 c2 = vec3(0.72, 0.42, 0.04);
        vec3 c3 = vec3(0.42, 0.06, 0.02);
        float beam = min(lampBeam(p - uLampLRel) + lampBeam(p - uLampRRel), 2.0) * uHead;
        vCol = mix(mix(c1, c2, aRand.y), c3, step(0.75, aRand.x)) * (0.75 + 0.25 * abs(flip)) * (uLight + uHeadColor * beam * 0.6);
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vCol;
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(vCol, 1.0);
        #include <fog_fragment>
      }
    `,
  });
  shareHead(mat.uniforms, head);
  return mat;
}

/* --------------------------------------------------------------------------
   Low-poly trees (merged trunk + canopy, tinted per instance)
   -------------------------------------------------------------------------- */
function mergeColored(parts) {
  const pos = [];
  const col = [];
  const bark = [];
  for (const { geo, shade, isBark } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < p.count; i++) {
      lo = Math.min(lo, p.getY(i));
      hi = Math.max(hi, p.getY(i));
    }
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      pos.push(x, y, z);
      const c = shade((y - lo) / Math.max(1e-4, hi - lo), x, y, z);
      col.push(c[0], c[1], c[2]);
      bark.push(isBark ? 1 : 0);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new Float32BufferAttribute(col, 3));
  out.setAttribute('aBark', new Float32BufferAttribute(bark, 1)); // tells the shader trunk from canopy
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

function lumpy(geo, amount) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const h = hash2(Math.round(x * 97 + z * 131), Math.round(y * 89 + z * 53));
    const s = 1 + (h - 0.5) * amount;
    p.setXYZ(i, x * s, y * s, z * s);
  }
  return geo;
}

const TRUNK = [0.16, 0.12, 0.1];
const trunkShade = () => TRUNK;
// Canopies are near-white in the buffer: the instance colour does the autumn.
const canopyShade = (t, x, y, z) => {
  const v = lerp(0.5, 1.05, t) + (hash2(Math.round(x * 31), Math.round(z * 37 + y * 11)) - 0.5) * 0.14;
  return [v, v, v];
};

function blob(x, y, z, sx, sy, sz, detail) {
  const g = lumpy(new IcosahedronGeometry(1, detail), 0.3);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return { geo: g, shade: canopyShade };
}
function trunk(height, r0, r1) {
  const g = new CylinderGeometry(r1, r0, height, 6, 1, true);
  g.translate(0, height / 2, 0);
  return { geo: g, shade: trunkShade, isBark: true };
}

function makeTreeGeometries() {
  const round = mergeColored([
    trunk(4.2, 0.3, 0.18),
    blob(0, 6.4, 0, 3.2, 2.9, 3.1, 1),
    blob(1.9, 5.0, 0.7, 2.0, 1.7, 2.0, 0),
    blob(-1.7, 5.3, -0.9, 2.1, 1.8, 2.1, 0),
  ]);
  const tall = mergeColored([
    trunk(4.6, 0.26, 0.16),
    blob(0, 8.2, 0, 2.2, 4.6, 2.2, 1),
    blob(0.6, 5.2, 0.5, 1.7, 1.9, 1.7, 0),
  ]);
  const coniferParts = [trunk(3.0, 0.24, 0.16)];
  const tiers = [
    [2.4, 3.1, 4.4],
    [4.6, 2.5, 4.0],
    [6.8, 1.9, 3.6],
    [8.8, 1.2, 3.2],
  ];
  for (const [y, r, h] of tiers) {
    const g = new ConeGeometry(r, h, 7, 1, true);
    g.translate(0, y + h / 2 - 0.6, 0);
    coniferParts.push({ geo: g, shade: canopyShade });
  }
  const conifer = mergeColored(coniferParts);
  return [round, tall, conifer];
}

// sRGB canopy tints; conifers get their own.
const LEAF_TINTS = ['#c2551b', '#d67a1c', '#dd9a1e', '#e2b529', '#a82a17', '#86301a', '#a06d1e', '#7c8430', '#b14414', '#c98f2a'];
const CONIFER_TINTS = ['#1f3a2a', '#27452f', '#1a3324'];

/* --------------------------------------------------------------------------
   Tiny geometry builder for rails, posts and signs
   -------------------------------------------------------------------------- */
class Builder {
  constructor(withUv = false) {
    this.pos = [];
    this.col = [];
    this.uv = withUv ? [] : null;
    this.idx = [];
    this.count = 0;
  }

  quad(a, b, c, d, color, uvs) {
    const n = this.count;
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    for (let i = 0; i < 4; i++) this.col.push(color[0], color[1], color[2]);
    if (this.uv) this.uv.push(...(uvs || [0, 0, 1, 0, 1, 1, 0, 1]));
    this.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    this.count += 4;
  }

  /** Upright box whose long horizontal axis follows (rx, rz). */
  post(x, y, z, rx, rz, w, h, d, color) {
    const fx = -rz;
    const fz = rx;
    const hw = w / 2;
    const hd = d / 2;
    const p = (sr, sf, up) => [x + rx * sr * hw + fx * sf * hd, y + up * h, z + rz * sr * hw + fz * sf * hd];
    this.quad(p(-1, 1, 0), p(1, 1, 0), p(1, 1, 1), p(-1, 1, 1), color);
    this.quad(p(1, -1, 0), p(-1, -1, 0), p(-1, -1, 1), p(1, -1, 1), color);
    this.quad(p(1, 1, 0), p(1, -1, 0), p(1, -1, 1), p(1, 1, 1), color);
    this.quad(p(-1, -1, 0), p(-1, 1, 0), p(-1, 1, 1), p(-1, -1, 1), color);
  }

  /** Solid box sitting on y, `w` along (rx, rz) and `d` across it, with a lid. */
  block(x, y, z, rx, rz, w, h, d, color, lid = color) {
    this.post(x, y, z, rx, rz, w, h, d, color);
    const fx = -rz;
    const fz = rx;
    const p = (sr, sf) => [x + (rx * sr * w) / 2 + (fx * sf * d) / 2, y + h, z + (rz * sr * w) / 2 + (fz * sf * d) / 2];
    this.quad(p(-1, 1), p(1, 1), p(1, -1), p(-1, -1), lid);
  }

  tri(a, b, c, color) {
    this.quad(a, b, c, c, color);
  }

  build() {
    if (!this.count) return null;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    if (this.uv) g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

function makeChevronTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#f2c81e';
  g.fillRect(0, 0, 128, 160);
  g.strokeStyle = '#151515';
  g.lineWidth = 6;
  g.strokeRect(5, 5, 118, 150);
  g.fillStyle = '#151515';
  g.beginPath();
  g.moveTo(30, 22);
  g.lineTo(62, 22);
  g.lineTo(104, 80);
  g.lineTo(62, 138);
  g.lineTo(30, 138);
  g.lineTo(72, 80);
  g.closePath();
  g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* --------------------------------------------------------------------------
   The café at the end of the course
   -------------------------------------------------------------------------- */
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function drawCup(g, x, y, s, color) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-26, -14);
  g.lineTo(26, -14);
  g.quadraticCurveTo(24, 22, 0, 24);
  g.quadraticCurveTo(-24, 22, -26, -14);
  g.fill();
  g.beginPath();
  g.arc(30, 0, 11, -1.2, 1.4);
  g.stroke();
  for (const sx of [-10, 4]) {
    g.beginPath();
    g.moveTo(sx, -24);
    g.quadraticCurveTo(sx + 8, -32, sx, -40);
    g.quadraticCurveTo(sx - 8, -48, sx, -56);
    g.stroke();
  }
  g.restore();
}

function makeCafeSignTexture() {
  return canvasTexture(1024, 224, (g, w, h) => {
    g.fillStyle = '#10261b';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e9d9b4';
    g.lineWidth = 6;
    g.beginPath();
    roundRect(g, 12, 12, w - 24, h - 24, 18);
    g.stroke();
    drawCup(g, 118, 132, 1.5, '#e9d9b4');
    g.fillStyle = '#f1e6c8';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.font = '800 92px Inter, Helvetica, Arial, sans-serif';
    g.fillText('CORTADO PASS', 220, 92);
    g.font = '600 44px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = '#e0b866';
    g.fillText('CAF\u00c9  \u00b7  ESPRESSO  \u00b7  PIE', 224, 170);
  });
}

function makeCafeRoadSignTexture() {
  return canvasTexture(256, 320, (g, w, h) => {
    g.fillStyle = '#5a3a1e';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f3ead6';
    g.lineWidth = 8;
    g.strokeRect(10, 10, w - 20, h - 20);
    drawCup(g, 118, 132, 1.7, '#f3ead6');
    g.fillStyle = '#f3ead6';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '800 62px Inter, Helvetica, Arial, sans-serif';
    g.fillText('CAF\u00c9', w / 2, 236);
    g.beginPath();
    g.moveTo(84, 286);
    g.lineTo(160, 286);
    g.lineTo(160, 272);
    g.lineTo(190, 290);
    g.lineTo(160, 308);
    g.lineTo(160, 294);
    g.lineTo(84, 294);
    g.closePath();
    g.fill();
  });
}

/** Where the car ends up, and the frame the café is built in. */
export function cafeSite(road) {
  road.ensure(COURSE.STOP_S + 300);
  const p = road.at(COURSE.STOP_S, {});
  const fx = Math.sin(p.th);
  const fz = -Math.cos(p.th);
  const rx = Math.cos(p.th);
  const rz = Math.sin(p.th);
  const yaw = Math.atan((COURSE.PARK_CURVE * COURSE.PARK_OFFSET) / COURSE.PARK_RUN); // nose-in angle at rest
  const lat = ROAD.LANE + COURSE.PARK_OFFSET;
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const hx = fx * c + rx * sn; // the parked car's heading: also "into the building"
  const hz = fz * c + rz * sn;
  const ux = -hz; // along the façade, to the driver's right
  const uz = hx;
  const carX = p.x + rx * lat;
  const carZ = p.z + rz * lat;
  const y = p.y - 0.05;
  const FRONT = 16; // metres from the driver to the porch steps
  return { yaw, hx, hz, ux, uz, y, x: carX + hx * FRONT, z: carZ + hz * FRONT };
}

/* --------------------------------------------------------------------------
   Terrain shape
   -------------------------------------------------------------------------- */
function terrainOffset(dd, a, x, z) {
  if (dd <= 1.1) return -0.04 * dd;
  const e = dd - 1.1;
  const up = Math.max(0, a);
  const dn = Math.max(0, -a);
  let h = -0.044;
  // drainage ditch at the foot of the bank
  h -= 0.3 * smoothstep(0, 1.0, e) * (1 - smoothstep(1.2, 2.8, e)) * (0.35 + 0.65 * up);
  // uphill: blasted rock cut, then the mountainside
  h += up * (3.9 * smoothstep(1.0, 3.2, e) + 44 * (1 - Math.exp(-Math.max(0, e - 3.6) / 52)));
  // downhill: a short verge, then the drop
  h -= dn * (0.1 * e + 62 * (1 - Math.exp(-Math.max(0, e - 1.3) / 46)));
  // rolling ground and rock roughness
  h += (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 8 * smoothstep(3, 30, e);
  h += (vnoise(x * 0.35, z * 0.35) - 0.5) * 0.9 * smoothstep(0.5, 3, e) * (0.4 + up);
  // forest floor where the road runs along flat ground
  h += (1 - up - dn) * 0.6 * smoothstep(1, 12, e) * (vnoise(x * 0.08, z * 0.08) - 0.3);
  return h;
}

const GROUND = {
  gravel: lin('#4d4a46'),
  soil: lin('#553a25'),
  rust: lin('#87501f'),
  ochre: lin('#9a7628'),
  moss: lin('#3e4a27'),
  rock: lin('#5a5b5f'),
  rockLight: lin('#77756f'),
};

function groundColor(dd, steep, x, z, out) {
  const n1 = vnoise(x * 0.11, z * 0.11);
  const n2 = vnoise(x * 0.5 + 40, z * 0.5);
  let r;
  let g;
  let b;
  // leaf litter: brown soil → rust → ochre, with mossy patches
  const t1 = smoothstep(0.3, 0.75, n1);
  r = lerp(GROUND.soil[0], GROUND.rust[0], t1);
  g = lerp(GROUND.soil[1], GROUND.rust[1], t1);
  b = lerp(GROUND.soil[2], GROUND.rust[2], t1);
  const t2 = smoothstep(0.62, 0.9, n2);
  r = lerp(r, GROUND.ochre[0], t2);
  g = lerp(g, GROUND.ochre[1], t2);
  b = lerp(b, GROUND.ochre[2], t2);
  const t3 = smoothstep(0.7, 0.9, vnoise(x * 0.06 + 9, z * 0.06 + 4)) * 0.8;
  r = lerp(r, GROUND.moss[0], t3);
  g = lerp(g, GROUND.moss[1], t3);
  b = lerp(b, GROUND.moss[2], t3);
  // bare rock where it's steep
  const rk = smoothstep(0.75, 1.35, steep);
  const rl = n2;
  r = lerp(r, lerp(GROUND.rock[0], GROUND.rockLight[0], rl), rk);
  g = lerp(g, lerp(GROUND.rock[1], GROUND.rockLight[1], rl), rk);
  b = lerp(b, lerp(GROUND.rock[2], GROUND.rockLight[2], rl), rk);
  // gravel shoulder
  const gv = 1 - smoothstep(1.0, 2.6, dd);
  r = lerp(r, GROUND.gravel[0], gv);
  g = lerp(g, GROUND.gravel[1], gv);
  b = lerp(b, GROUND.gravel[2], gv);
  const shade = 0.82 + 0.3 * n2;
  out[0] = r * shade;
  out[1] = g * shade;
  out[2] = b * shade;
}

/* ==========================================================================
   World
   ========================================================================== */
export class World {
  /**
   * @param {import('./road.js').Road} road
   * @param {{trees:number, rain:number, leaves:number, view:number}} quality
   * @param {{world: object, litter: object, asphalt: object}} detail generated detail textures (textures.js)
   */
  constructor(road, quality, detail) {
    this.road = road;
    this.quality = quality;
    this.scene = new Scene();
    this.night = 0;
    this.time = 0;
    this.chunks = new Map();

    this.scene.fog = new FogExp2(0xa7b1b6, 0.0047);

    // sky
    this.skyMat = makeSkyMaterial();
    this.sky = new Mesh(new SphereGeometry(900, 40, 20), this.skyMat);
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // light
    this.hemi = new HemisphereLight(0xffffff, 0x444444, 2.5);
    this.scene.add(this.hemi);
    this.sun = new DirectionalLight(0xffffff, 0.8);
    this.sun.position.set(-0.5, 1, -0.25);
    this.scene.add(this.sun);
    this.head = makeHeadUniforms();

    // materials shared by every chunk
    const lit = (m, kind) => lightByHeadlamps(m, this.head, kind ? { kind, world: detail.world, litter: detail.litter } : null);
    this.roadMat = makeRoadMaterial(this.head, detail.asphalt);
    this.groundMat = lit(new MeshLambertMaterial({ vertexColors: true, flatShading: true }), 'ground');
    this.treeMat = lit(new MeshLambertMaterial({ vertexColors: true, flatShading: true }), 'tree');
    this.propMat = lit(new MeshLambertMaterial({ vertexColors: true, flatShading: true, side: DoubleSide }), 'prop');
    this.reflectorMat = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
    this.chevronTex = makeChevronTexture();
    this.signMat = lit(
      new MeshLambertMaterial({
        map: this.chevronTex,
        emissive: 0xffffff,
        emissiveMap: this.chevronTex,
        emissiveIntensity: 0.2,
        side: DoubleSide,
      }),
    );
    this.glowMat = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
    this.cafeSignMat = lit(
      new MeshLambertMaterial({ map: makeCafeSignTexture(), emissive: 0xffffff, emissiveIntensity: 0.3, side: DoubleSide }),
    );
    this.cafeSignMat.emissiveMap = this.cafeSignMat.map;
    this.cafeRoadSignMat = lit(
      new MeshLambertMaterial({ map: makeCafeRoadSignTexture(), emissive: 0xffffff, emissiveIntensity: 0.18, side: DoubleSide }),
    );
    this.cafeRoadSignMat.emissiveMap = this.cafeRoadSignMat.map;
    this.cafeLamp = new PointLight(0xffb469, 0, 26, 1.8);
    this.scene.add(this.cafeLamp);
    this.roadMat.uniforms.uFinish.value = COURSE.FINISH_S;
    this.treeGeos = makeTreeGeometries();
    this.leafTints = LEAF_TINTS.map((h) => new Color(h));
    this.coniferTints = CONIFER_TINTS.map((h) => new Color(h));

    // weather
    this.rainMat = makeRainMaterial(this.head);
    this.rain = new Mesh(makeParticleGeometry(quality.rain, 77), this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 10;
    this.scene.add(this.rain);
    this.leafMat = makeLeafMaterial(this.head);
    this.leaves = new Mesh(makeParticleGeometry(quality.leaves, 1234), this.leafMat);
    this.leaves.frustumCulled = false;
    this.scene.add(this.leaves);

    this._dummy = new Object3D();
    this._col = new Color();

    this._buildCafe();
    this.setNight(0);
  }

  /** 0 = overcast day, 1 = night. */
  setNight(t) {
    this.night = t;
    const fog = mixColor(this.scene.fog.color, PALETTE.fog, t);
    const u = this.skyMat.uniforms;
    mixColor(u.uZenith.value, PALETTE.zenith, t);
    u.uHorizon.value.copy(fog);
    mixColor(u.uMtnFar.value, PALETTE.mtnFar, t);
    mixColor(u.uMtnMid.value, PALETTE.mtnMid, t);
    mixColor(u.uMtnNear.value, PALETTE.mtnNear, t);
    mixColor(u.uLeaf.value, PALETTE.mtnLeaf, t);
    mixColor(this.hemi.color, PALETTE.hemiSky, t);
    mixColor(this.hemi.groundColor, PALETTE.hemiGround, t);
    this.hemi.intensity = lerp(LEVELS.hemi[0], LEVELS.hemi[1], t);
    mixColor(this.sun.color, PALETTE.sun, t);
    this.sun.intensity = lerp(LEVELS.sun[0], LEVELS.sun[1], t);
    this.head.uHead.value = lerp(LEVELS.head[0], LEVELS.head[1], t);
    this.head.uHigh.value = smoothstep(0.35, 0.9, t); // main beam only once it's properly dark
    const r = this.roadMat.uniforms;
    mixColor(r.uAmbient.value, PALETTE.roadAmbient, t);
    mixColor(r.uSky.value, PALETTE.roadSky, t);
    mixColor(this.rainMat.uniforms.uColor.value, PALETTE.rain, t);
    this.rainMat.uniforms.uAlpha.value = lerp(LEVELS.rainAlpha[0], LEVELS.rainAlpha[1], t);
    mixColor(this.leafMat.uniforms.uLight.value, PALETTE.roadAmbient, t);
    const refl = lerp(LEVELS.reflector[0], LEVELS.reflector[1], t);
    this.reflectorMat.color.setRGB(refl, refl, refl);
    this.signMat.emissiveIntensity = lerp(LEVELS.signGlow[0], LEVELS.signGlow[1], t);
    const glow = lerp(LEVELS.cafeGlow[0], LEVELS.cafeGlow[1], t);
    this.glowMat.color.setRGB(glow, glow, glow);
    this.cafeLamp.intensity = lerp(LEVELS.cafeLamp[0], LEVELS.cafeLamp[1], t);
    this.cafeSignMat.emissiveIntensity = lerp(LEVELS.cafeSign[0], LEVELS.cafeSign[1], t);
  }

  /* ------------------------------------------------------------------ café */

  /** A timber lodge with a lit porch, facing wherever the car is going to park. */
  _buildCafe() {
    const site = (this.site = cafeSite(this.road));
    const group = (this.cafe = new Group());
    group.position.set(site.x, site.y, site.z);
    // local frame: a = along the façade (driver's right), b = into the building, y = up
    const P = (a, b, y) => [site.ux * a + site.hx * b, y, site.uz * a + site.hz * b];
    const body = new Builder();
    const glow = new Builder();
    const sign = new Builder(true);

    const TIMBER = lin('#5b3b24');
    const TIMBER_DARK = lin('#3a2516');
    const TIMBER_LIGHT = lin('#7a5433');
    const DECK = lin('#6d4b2f');
    const STONE = lin('#6c6964');
    const ROOF = lin('#1d3528');
    const ROOF_UNDER = lin('#2a1c12');
    const WINDOW = [1.0, 0.74, 0.38];
    const BULB = [1.0, 0.82, 0.5];
    const block = (a, b, y, w, h, d, color, lid) => {
      const c = P(a, b, y);
      body.block(c[0], c[1], c[2], site.ux, site.uz, w, h, d, color, lid);
    };
    // a wall-mounted panel facing the car park
    const panel = (builder, a0, a1, y0, y1, b, color, uvs) => builder.quad(P(a0, b, y0), P(a1, b, y0), P(a1, b, y1), P(a0, b, y1), color, uvs);

    // deck, steps, plinth, walls
    block(0, 1.5, 0, 12.6, 0.36, 3.2, DECK, lin('#7b5637'));
    block(0, -0.32, 0, 2.6, 0.18, 0.6, DECK);
    block(0, 6.75, 0, 11.9, 0.62, 7.5, STONE);
    block(0, 6.75, 0.62, 11.5, 3.15, 7.2, TIMBER, TIMBER_DARK);
    for (const a of [-5.75, 5.75]) block(a, 6.75, 0.62, 0.22, 3.15, 7.3, TIMBER_DARK); // corner boards
    // windows, door and their frames (drawn just proud of the wall)
    const WALL = 3.12;
    for (const [a0, a1] of [
      [-5.0, -1.5],
      [1.5, 5.0],
    ]) {
      panel(body, a0 - 0.12, a1 + 0.12, 1.42, 3.22, WALL - 0.02, TIMBER_DARK);
      panel(glow, a0, a1, 1.54, 3.1, WALL - 0.04, WINDOW);
      for (const m of [a0 + (a1 - a0) / 3, a0 + (2 * (a1 - a0)) / 3]) panel(body, m - 0.04, m + 0.04, 1.54, 3.1, WALL - 0.06, TIMBER_DARK);
      panel(body, a0, a1, 2.5, 2.57, WALL - 0.06, TIMBER_DARK);
    }
    panel(body, -0.72, 0.72, 0.62, 2.95, WALL - 0.02, TIMBER_DARK);
    panel(body, -0.6, 0.6, 0.66, 2.84, WALL - 0.04, TIMBER_LIGHT);
    panel(glow, -0.38, 0.38, 1.7, 2.6, WALL - 0.06, WINDOW);
    for (const a of [-5.9, 5.9]) {
      // side windows
      glow.quad(P(a * 1.0, 5.2, 1.6), P(a * 1.0, 8.2, 1.6), P(a * 1.0, 8.2, 3.0), P(a * 1.0, 5.2, 3.0), WINDOW);
    }
    // porch: posts, a lean-to roof and a fascia for the sign
    for (const a of [-6.1, -2.05, 2.05, 6.1]) block(a, 0.16, 0.36, 0.2, 2.95, 0.2, TIMBER_DARK);
    body.quad(P(-6.7, -0.5, 3.22), P(6.7, -0.5, 3.22), P(6.7, 3.2, 4.0), P(-6.7, 3.2, 4.0), ROOF);
    body.quad(P(-6.7, -0.5, 3.16), P(6.7, -0.5, 3.16), P(6.7, 3.2, 3.94), P(-6.7, 3.2, 3.94), ROOF_UNDER);
    panel(body, -6.7, 6.7, 3.02, 3.24, -0.5, TIMBER_DARK);
    // main roof: a steep gable in the same dark green as the car
    const EAVE = 3.72;
    const RIDGE = 7.05;
    body.quad(P(-6.6, 2.6, EAVE), P(6.6, 2.6, EAVE), P(6.6, 6.75, RIDGE), P(-6.6, 6.75, RIDGE), ROOF);
    body.quad(P(6.6, 10.9, EAVE), P(-6.6, 10.9, EAVE), P(-6.6, 6.75, RIDGE), P(6.6, 6.75, RIDGE), ROOF);
    for (const a of [-5.75, 5.75]) body.tri(P(a, 3.15, 3.77), P(a, 10.35, 3.77), P(a, 6.75, RIDGE - 0.12), TIMBER_LIGHT);
    block(3.9, 8.2, 5.0, 0.95, 3.0, 0.95, STONE, lin('#3b3936')); // chimney
    // string lights along the porch, sagging between the posts
    const posts = [-6.1, -2.05, 2.05, 6.1];
    for (let k = 0; k < posts.length - 1; k++) {
      for (let j = 1; j < 6; j++) {
        const t = j / 6;
        const a = lerp(posts[k], posts[k + 1], t);
        const y = 3.0 - 0.3 * Math.sin(t * Math.PI);
        const r = 0.075;
        glow.quad(P(a - r, -0.1, y - r), P(a + r, -0.1, y - r), P(a + r, -0.1, y + r), P(a - r, -0.1, y + r), BULB);
        glow.quad(P(a, -0.1 - r, y - r), P(a, -0.1 + r, y - r), P(a, -0.1 + r, y + r), P(a, -0.1 - r, y + r), BULB);
      }
    }
    // the name over the door
    panel(sign, -3.3, 3.3, 3.34, 4.78, -0.56, [1, 1, 1]);
    panel(body, -3.42, 3.42, 3.28, 4.84, -0.52, TIMBER_DARK);
    // a lamp at the edge of the lot
    block(-9.2, -4.5, 0, 0.14, 3.9, 0.14, lin('#2b2b2e'));
    {
      const c = P(-9.2, -4.5, 3.9);
      glow.block(c[0], c[1], c[2], site.ux, site.uz, 0.42, 0.34, 0.42, BULB);
    }

    for (const [builder, mat] of [
      [body, this.propMat],
      [glow, this.glowMat],
      [sign, this.cafeSignMat],
    ]) {
      const g = builder.build();
      if (g) group.add(new Mesh(g, mat));
    }
    this.scene.add(group);
    const lamp = P(0, -1.2, 2.9);
    this.cafeLamp.position.set(site.x + lamp[0], site.y + lamp[1], site.z + lamp[2]);

    // roadside boards: one well before the finish, one at the turn-in
    const boards = new Builder(true);
    const poles = new Builder();
    for (const s of [COURSE.FINISH_S - 260, COURSE.LOT_FROM - 6]) {
      const q = this.road.at(s, {});
      const rx = Math.cos(q.th);
      const rz = Math.sin(q.th);
      const bx = q.x + rx * (W + 2.2) - site.x;
      const bz = q.z + rz * (W + 2.2) - site.z;
      const y0 = q.y - site.y + 1.3;
      const hw = 0.62;
      boards.quad([bx - rx * hw, y0, bz - rz * hw], [bx + rx * hw, y0, bz + rz * hw], [bx + rx * hw, y0 + 1.55, bz + rz * hw], [bx - rx * hw, y0 + 1.55, bz - rz * hw], [1, 1, 1]);
      poles.post(bx + rz * 0.05, q.y - site.y - 0.4, bz - rx * 0.05, rx, rz, 0.08, 3.2, 0.06, lin('#5d6165'));
    }
    const far = new Group();
    far.position.copy(group.position);
    far.add(new Mesh(boards.build(), this.cafeRoadSignMat), new Mesh(poles.build(), this.propMat));
    this.scene.add(far);
    this.cafeFar = far;
  }

  /* ---------------------------------------------------------------- chunks */

  _buildChunk(ci) {
    const road = this.road;
    const i0 = ci * CH;
    road.ensure((i0 + CH + 120) * DS);
    const n = CH + 1;
    const ox = road.x[i0];
    const oy = road.y[i0];
    const oz = road.z[i0];
    const rand = mulberry32(9001 + ci * 7919);

    const group = new Group();
    group.position.set(ox, oy, oz);
    const chunk = { index: ci, group, geos: [], meshes: [] };

    // per-sample frames
    const cx = new Float32Array(n);
    const cy = new Float32Array(n);
    const cz = new Float32Array(n);
    const rx = new Float32Array(n);
    const rz = new Float32Array(n);
    const bank = new Float32Array(n);
    const hill = new Float32Array(n);
    const lim = [new Float32Array(n), new Float32Array(n)]; // [left, right] inside-of-corner limits
    const lot = new Float32Array(n); // 1 where the café's gravel lot pushes the hillside back
    for (let a = 0; a < n; a++) {
      const i = i0 + a;
      const th = road.th[i];
      cx[a] = road.x[i] - ox;
      cy[a] = road.y[i] - oy;
      cz[a] = road.z[i] - oz;
      rx[a] = Math.cos(th);
      rz[a] = Math.sin(th);
      bank[a] = road.bank(road.k[i]);
      hill[a] = road.hill(i * DS);
      // Keep terrain from folding through the centre of a tight corner.
      let ll = 1e4;
      let lr = 1e4;
      const j0 = Math.max(0, i - 110);
      const j1 = i + 110;
      for (let j = j0; j <= j1; j++) {
        const k = road.k[j];
        const ak = Math.abs(k);
        if (ak < 0.0025) continue;
        const l = 0.8 / ak + 0.25 * Math.abs(j - i) * DS;
        if (k > 0) {
          if (l < lr) lr = l;
        } else if (l < ll) ll = l;
      }
      lim[0][a] = ll;
      lim[1][a] = lr;
      const sAt = i * DS;
      lot[a] = smoothstep(COURSE.LOT_FROM, COURSE.LOT_FROM + 18, sAt) * (1 - smoothstep(COURSE.LOT_TO - 18, COURSE.LOT_TO, sAt));
    }

    const D0 = W + 2.4;
    const lateral = (D, limit) => (D <= D0 ? D : D0 + softMin(D - D0, Math.max(limit - D0, 1.5)));

    // --- asphalt ------------------------------------------------------------
    {
      const pos = new Float32Array(n * 2 * 3);
      const uv = new Float32Array(n * 2 * 2);
      const idx = [];
      for (let a = 0; a < n; a++) {
        for (let s = 0; s < 2; s++) {
          const sg = s === 0 ? -1 : 1;
          const o = (a * 2 + s) * 3;
          pos[o] = cx[a] + rx[a] * sg * W;
          pos[o + 1] = cy[a] - sg * W * bank[a];
          pos[o + 2] = cz[a] + rz[a] * sg * W;
          uv[(a * 2 + s) * 2] = s;
          uv[(a * 2 + s) * 2 + 1] = (i0 + a) * DS;
        }
        if (a < n - 1) {
          const b = a * 2;
          idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
        }
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeBoundingSphere();
      const m = new Mesh(g, this.roadMat);
      group.add(m);
      chunk.geos.push(g);
    }

    // --- terrain, both sides --------------------------------------------------
    // Built as a vertex grid first (trees are planted on it later), then
    // exploded into flat-coloured facets for the low-poly look.
    const grid = [null, null];
    for (let s = 0; s < 2; s++) {
      const sg = s === 0 ? -1 : 1;
      const pos = new Float32Array(n * NC * 3);
      const col = new Float32Array(n * NC * 3);
      const tmp = [0, 0, 0];
      for (let a = 0; a < n; a++) {
        const i = i0 + a;
        const edgeY = cy[a] - sg * W * bank[a];
        const side = sg * hill[a];
        let prevH = edgeY;
        let prevD = W;
        for (let j = 0; j < NC; j++) {
          let D = lateral(W + COLS[j], lim[s][a]);
          let along = 0;
          if (j > 1) {
            // knock vertices about so rock faces don't line up in neat rows
            const jit = Math.min(1, (j - 1) / 3);
            D += (hash2(i * 3 + s, j * 7 + 1) - 0.5) * 0.5 * jit * (COLS[j] - COLS[j - 1]);
            along = (hash2(i * 5 + s, j * 11 + 2) - 0.5) * 1.1 * jit;
          }
          const px = cx[a] + rx[a] * sg * D - rz[a] * along;
          const pz = cz[a] + rz[a] * sg * D + rx[a] * along;
          // on the café side the whole hillside profile starts further out, leaving flat gravel
          const dd = sg > 0 && lot[a] > 0 ? Math.max(Math.min(COLS[j], 1.1), COLS[j] - COURSE.LOT_DEPTH * lot[a]) : COLS[j];
          const h = j === 0 ? edgeY : edgeY + terrainOffset(dd, side, px + ox, pz + oz);
          const o = (a * NC + j) * 3;
          pos[o] = px;
          pos[o + 1] = h;
          pos[o + 2] = pz;
          const steep = j === 0 ? 0 : Math.abs(h - prevH) / Math.max(0.3, D - prevD);
          groundColor(dd, steep, px + ox, pz + oz, tmp);
          col[o] = tmp[0];
          col[o + 1] = tmp[1];
          col[o + 2] = tmp[2];
          prevH = h;
          prevD = D;
        }
      }
      const tris = (n - 1) * (NC - 1) * 2;
      const fp = new Float32Array(tris * 9);
      const fc = new Float32Array(tris * 9);
      let w = 0;
      const emit = (v0, v1, v2, tone) => {
        const r = ((col[v0 * 3] + col[v1 * 3] + col[v2 * 3]) / 3) * tone;
        const g = ((col[v0 * 3 + 1] + col[v1 * 3 + 1] + col[v2 * 3 + 1]) / 3) * tone;
        const b = ((col[v0 * 3 + 2] + col[v1 * 3 + 2] + col[v2 * 3 + 2]) / 3) * tone;
        for (const v of [v0, v1, v2]) {
          fp[w] = pos[v * 3];
          fp[w + 1] = pos[v * 3 + 1];
          fp[w + 2] = pos[v * 3 + 2];
          fc[w] = r;
          fc[w + 1] = g;
          fc[w + 2] = b;
          w += 3;
        }
      };
      for (let a = 0; a < n - 1; a++) {
        for (let j = 0; j < NC - 1; j++) {
          const v00 = a * NC + j;
          const v01 = v00 + 1;
          const v10 = v00 + NC;
          const v11 = v10 + 1;
          const t1 = 0.9 + 0.2 * hash2((i0 + a) * 2 + s, j * 2);
          const t2 = 0.9 + 0.2 * hash2((i0 + a) * 2 + s, j * 2 + 1);
          if (sg > 0) {
            emit(v00, v01, v11, t1);
            emit(v00, v11, v10, t2);
          } else {
            emit(v00, v11, v01, t1);
            emit(v00, v10, v11, t2);
          }
        }
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(fp, 3));
      g.setAttribute('color', new Float32BufferAttribute(fc, 3));
      g.computeVertexNormals();
      g.computeBoundingSphere();
      group.add(new Mesh(g, this.groundMat));
      chunk.geos.push(g);
      grid[s] = pos;
    }

    // --- rails, posts, reflectors, chevrons -----------------------------------
    const props = new Builder();
    const glints = new Builder();
    const signs = new Builder(true);
    const STEEL = lin('#8b9093');
    const STEEL_DARK = lin('#5d6165');
    const POST_WHITE = lin('#b9bab4');
    const AMBER = [1.0, 0.62, 0.12];
    const WHITE = [1.0, 0.98, 0.9];
    const at = (a, sg, D, up) => [cx[a] + rx[a] * sg * D, cy[a] - sg * W * bank[a] + up, cz[a] + rz[a] * sg * D];
    for (let s = 0; s < 2; s++) {
      const sg = s === 0 ? -1 : 1;
      for (let a = 0; a < n - 1; a++) {
        const i = i0 + a;
        const railed = sg * hill[a] < -0.26 && sg * hill[a + 1] < -0.26;
        if (railed) {
          const D = W + 0.85;
          props.quad(at(a, sg, D, 0.42), at(a + 1, sg, D, 0.42), at(a + 1, sg, D, 0.74), at(a, sg, D, 0.74), STEEL);
          props.quad(at(a, sg, D + 0.05, 0.5), at(a + 1, sg, D + 0.05, 0.5), at(a + 1, sg, D + 0.05, 0.66), at(a, sg, D + 0.05, 0.66), STEEL_DARK);
          if (i % 2 === 0) {
            const p = at(a, sg, D + 0.1, -0.1);
            props.post(p[0], p[1], p[2], rx[a], rz[a], 0.1, 0.84, 0.14, STEEL_DARK);
          }
          if (i % 6 === 0) {
            const p = at(a, sg, D - 0.03, 0.52);
            const c = sg > 0 ? WHITE : AMBER;
            glints.quad(
              [p[0] - rx[a] * 0.05, p[1], p[2] - rz[a] * 0.05],
              [p[0] + rx[a] * 0.05, p[1], p[2] + rz[a] * 0.05],
              [p[0] + rx[a] * 0.05, p[1] + 0.09, p[2] + rz[a] * 0.05],
              [p[0] - rx[a] * 0.05, p[1] + 0.09, p[2] - rz[a] * 0.05],
              c,
            );
          }
        } else if (i % 20 === 0 && i > 0 && !(sg > 0 && lot[a] > 0.02)) {
          // delineator posts mark the edge where there's no rail
          const p = at(a, sg, W + 0.7, -0.05);
          props.post(p[0], p[1], p[2], rx[a], rz[a], 0.085, 1.0, 0.035, POST_WHITE);
          const c = sg > 0 ? WHITE : AMBER;
          glints.quad(
            [p[0] - rx[a] * 0.035 + rz[a] * 0.03, p[1] + 0.78, p[2] - rz[a] * 0.035 - rx[a] * 0.03],
            [p[0] + rx[a] * 0.035 + rz[a] * 0.03, p[1] + 0.78, p[2] + rz[a] * 0.035 - rx[a] * 0.03],
            [p[0] + rx[a] * 0.035 + rz[a] * 0.03, p[1] + 0.94, p[2] + rz[a] * 0.035 - rx[a] * 0.03],
            [p[0] - rx[a] * 0.035 + rz[a] * 0.03, p[1] + 0.94, p[2] - rz[a] * 0.035 - rx[a] * 0.03],
            c,
          );
        }
        // chevron boards around the outside of anything tight
        const k = road.k[i];
        if (Math.abs(k) > 0.0118 && i % 5 === 0 && sg === (k > 0 ? -1 : 1)) {
          const D = W + 1.9;
          const base = at(a, sg, D, 0);
          // face the approaching driver, toed in toward the road
          const toe = -sg * 0.35;
          const wx = rx[a] * Math.cos(toe) - rz[a] * Math.sin(toe);
          const wz = rz[a] * Math.cos(toe) + rx[a] * Math.sin(toe);
          const hw = 0.42;
          const y0 = base[1] + 1.15;
          const y1 = y0 + 1.05;
          const flip = k > 0 ? [0, 0, 1, 0, 1, 1, 0, 1] : [1, 0, 0, 0, 0, 1, 1, 1];
          signs.quad(
            [base[0] - wx * hw, y0, base[2] - wz * hw],
            [base[0] + wx * hw, y0, base[2] + wz * hw],
            [base[0] + wx * hw, y1, base[2] + wz * hw],
            [base[0] - wx * hw, y1, base[2] - wz * hw],
            [1, 1, 1],
            flip,
          );
          props.post(base[0] - rz[a] * -0.04, base[1] - 0.6, base[2] + rx[a] * -0.04, rx[a], rz[a], 0.07, 2.7, 0.05, STEEL_DARK);
        }
      }
    }
    for (const [builder, mat] of [
      [props, this.propMat],
      [glints, this.reflectorMat],
      [signs, this.signMat],
    ]) {
      const g = builder.build();
      if (!g) continue;
      group.add(new Mesh(g, mat));
      chunk.geos.push(g);
    }

    // --- trees ----------------------------------------------------------------
    const want = this.quality.trees;
    const lists = [[], [], []];
    const dummy = this._dummy;
    for (let t = 0; t < want; t++) {
      const fa = rand() * (n - 1);
      const a = Math.min(n - 2, Math.floor(fa));
      const ta = fa - a;
      const s = rand() < 0.5 ? 0 : 1;
      const sg = s === 0 ? -1 : 1;
      const side = sg * lerp(hill[a], hill[a + 1], ta);
      const minD = side > 0.25 ? 7.5 : side < -0.25 ? 3.0 : 3.4;
      const dd = minD + (80 - minD) * Math.pow(rand(), 1.7);
      if (sg > 0 && lot[a] > 0.02 && dd < COURSE.LOT_DEPTH * lot[a] + 9) continue; // nothing grows in the car park
      let j = 0;
      while (j < NC - 2 && COLS[j + 1] < dd) j++;
      const tj = clamp((dd - COLS[j]) / (COLS[j + 1] - COLS[j]), 0, 1);
      const g = grid[s];
      const p00 = (a * NC + j) * 3;
      const p01 = p00 + 3;
      const p10 = p00 + NC * 3;
      const p11 = p10 + 3;
      const bil = (k) => lerp(lerp(g[p00 + k], g[p01 + k], tj), lerp(g[p10 + k], g[p11 + k], tj), ta);
      const type = rand();
      const kind = type < 0.5 ? 0 : type < 0.78 ? 1 : 2;
      const size = (kind === 2 ? 1.15 : 0.95) * (0.75 + rand() * 0.75);
      dummy.position.set(bil(0), bil(1) - 0.35, bil(2));
      dummy.rotation.set((rand() - 0.5) * 0.08, rand() * Math.PI * 2, (rand() - 0.5) * 0.08);
      dummy.scale.set(size * (0.85 + rand() * 0.3), size, size * (0.85 + rand() * 0.3));
      dummy.updateMatrix();
      const tint = this._col;
      if (kind === 2) {
        tint.copy(this.coniferTints[Math.floor(rand() * this.coniferTints.length)]);
      } else {
        // neighbouring trees lean toward the same hue so the hillside reads as drifts of colour
        const drift = vnoise((dummy.position.x + ox) * 0.02, (dummy.position.z + oz) * 0.02);
        const pick = clamp(Math.floor((drift * 0.7 + rand() * 0.45) * this.leafTints.length), 0, this.leafTints.length - 1);
        tint.copy(this.leafTints[pick]);
      }
      const v = 0.82 + rand() * 0.36;
      lists[kind].push({ m: dummy.matrix.clone(), r: tint.r * v, g: tint.g * v, b: tint.b * v });
    }
    for (let kind = 0; kind < 3; kind++) {
      const list = lists[kind];
      if (!list.length) continue;
      const inst = new InstancedMesh(this.treeGeos[kind], this.treeMat, list.length);
      inst.instanceMatrix.setUsage(DynamicDrawUsage);
      for (let q = 0; q < list.length; q++) {
        inst.setMatrixAt(q, list[q].m);
        inst.setColorAt(q, this._col.setRGB(list[q].r, list[q].g, list[q].b));
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();
      group.add(inst);
      chunk.meshes.push(inst);
    }

    this.scene.add(group);
    return chunk;
  }

  _disposeChunk(chunk) {
    this.scene.remove(chunk.group);
    for (const g of chunk.geos) g.dispose();
    for (const m of chunk.meshes) m.dispose();
  }

  /** Stream chunks around distance `s`. Builds one per call unless `all`. */
  stream(s, all = false) {
    const near = Math.abs(s - COURSE.STOP_S) < 700;
    this.cafe.visible = near;
    this.cafeFar.visible = near;
    const first = Math.max(0, Math.floor((s - 70) / CHUNK_LEN));
    const last = Math.floor((s + this.quality.view) / CHUNK_LEN);
    for (const [ci, chunk] of this.chunks) {
      if (ci < first || ci > last) {
        this._disposeChunk(chunk);
        this.chunks.delete(ci);
      }
    }
    for (let ci = first; ci <= last; ci++) {
      if (this.chunks.has(ci)) continue;
      this.chunks.set(ci, this._buildChunk(ci));
      if (!all) return;
    }
  }

  /**
   * @param {number} dt
   * @param {Vector3} cp          camera position (world)
   * @param {Vector3} forward     car forward (world)
   * @param {number} speed        m/s
   * @param {{left:Vector3, right:Vector3, f:Vector3, r:Vector3, u:Vector3}} lamps  headlamp positions and beam axes (world)
   */
  update(dt, cp, forward, speed, lamps) {
    this.time += dt;
    const t = this.time;
    this.sky.position.copy(cp);
    this.skyMat.uniforms.uTime.value = t;
    this.roadMat.uniforms.uTime.value = t;

    const h = this.head;
    h.uLampL.value.copy(lamps.left);
    h.uLampR.value.copy(lamps.right);
    h.uLampLRel.value.copy(lamps.left).sub(cp);
    h.uLampRRel.value.copy(lamps.right).sub(cp);
    h.uBeamF.value.copy(lamps.f);
    h.uBeamR.value.copy(lamps.r);
    h.uBeamU.value.copy(lamps.u);

    // rain: streak length follows the car, so at speed it comes straight at you
    const r = this.rainMat.uniforms;
    const box = r.uBox.value;
    r.uTime.value = t;
    r.uCamMod.value.set(((cp.x % box.x) + box.x) % box.x, ((cp.y % box.y) + box.y) % box.y, ((cp.z % box.z) + box.z) % box.z);
    r.uStreak.value.copy(r.uVel.value).addScaledVector(forward, -speed).multiplyScalar(0.03);

    const l = this.leafMat.uniforms;
    const lb = l.uBox.value;
    l.uTime.value = t;
    l.uCamMod.value.set(((cp.x % lb.x) + lb.x) % lb.x, ((cp.y % lb.y) + lb.y) % lb.y, ((cp.z % lb.z) + lb.z) % lb.z);
  }
}

/** Standalone sky for baking the reflection environment. */
export function makeEnvScene(world) {
  const scene = new Scene();
  const mesh = new Mesh(new SphereGeometry(20, 32, 16), world.skyMat);
  scene.add(mesh);
  return scene;
}
