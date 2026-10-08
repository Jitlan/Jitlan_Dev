/* ==========================================================================
   jordanliebling.dev — Painted landscape (WebGL)
   --------------------------------------------------------------------------
   A low-poly autumn valley rendered through a painterly post-process. Scroll
   progress moves the camera along a trail toward a lake while the sun (or the
   moon, in the night journey) arcs across the sky. All colours come from the
   shared timeline (js/timeline.js) via the `jl:state` event that main.js
   dispatches, so the DOM and the scene always agree on the time of day.

   Purely decorative. If WebGL is unavailable the CSS/SVG fallback in index.html
   stays visible and this module exits quietly.
   ========================================================================== */
import * as THREE from './vendor/three.module.min.js';

(function () {
  'use strict';

  var canvas = document.getElementById('scene-canvas');
  var JL = window.JL || (window.JL = {});
  if (!canvas || !JL.timeline) return;

  var root = document.documentElement;
  // journey.js only loads this module when motion is allowed, but keep the guard for direct loads.
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var small = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
  var lowPower = coarse || small;

  /* ------------------------------------------------------------------
   * Renderer (bail out gracefully when WebGL is missing)
   * ------------------------------------------------------------------ */
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false
    });
  } catch (err) {
    root.classList.add('no-webgl');
    return;
  }
  THREE.ColorManagement.enabled = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = true;
  root.classList.add('has-webgl');

  var DPR_CAP = lowPower ? 1.25 : 1.5;
  var RT_SCALE = lowPower ? 0.7 : 0.62;          // painterly pass runs at reduced resolution
  var KUWAHARA_RADIUS = lowPower ? 1 : 2;
  var STAR_COUNT = lowPower ? 420 : 900;
  var TREE_COUNT = lowPower ? 110 : 260;
  var LEAF_COUNT = lowPower ? 140 : 380;
  var TERRAIN_SEG = lowPower ? [90, 150] : [130, 210];

  /* ------------------------------------------------------------------
   * World layout
   * ------------------------------------------------------------------ */
  var TRAIL_LENGTH = 150;        // camera travels from z = 0 to z = -150
  var TERRAIN_W = 300, TERRAIN_D = 480, TERRAIN_CZ = -180;
  var LAKE_CENTER = { x: 4, z: -248 }, LAKE_RX = 118, LAKE_RZ = 92;
  var LAKE_LEVEL = -3.2;
  var EYE = 3.0;

  function trailX(z) { return 7 * Math.sin(z * 0.045) + 3 * Math.sin(z * 0.013 + 1.2); }

  /* --- small deterministic noise (value noise) for terrain and placement --- */
  function hash2(x, y) {
    var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise2(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = smooth(x - ix), fy = smooth(y - iy);
    var a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return a + (b - a) * t; }

  function basin(x, z) {
    var dx = (x - LAKE_CENTER.x) / LAKE_RX, dz = (z - LAKE_CENTER.z) / LAKE_RZ;
    return 1 - sstep(0.55, 1.05, Math.sqrt(dx * dx + dz * dz));
  }

  /* Height of the ground. The valley rises away from the trail, rolls with
     noise, descends gently toward the lake and sinks inside the basin. */
  function terrainHeight(x, z) {
    var d = Math.abs(x - trailX(z));
    var open = sstep(-95, -150, z);                   // the valley opens out toward the lake
    var valley = Math.pow(Math.max(0, d - 4) / 46, 1.55) * 24 * (1 - 0.75 * open);
    var roll = noise2(x * 0.035 + 3.1, z * 0.035) * 5.2 + noise2(x * 0.09, z * 0.09 + 7.7) * 1.4;
    var h = (valley + roll) * sstep(1.2, 7, d) + roll * 0.15;
    h += z * 0.022;                                   // long gentle descent
    h += 8.5 * sstep(-118, -146, z) * (1 - sstep(-152, -172, z)); // the overlook bluff at the end of the trail
    h -= basin(x, z) * 10;                            // the lake basin
    return h;
  }

  /* ------------------------------------------------------------------
   * Shared GLSL
   * ------------------------------------------------------------------ */
  var GLSL_NOISE = [
    'float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0)), c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }'
  ].join('\n');

  var GLSL_FOG = [
    'uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;',
    'vec3 applyFog(vec3 col, float dist){ float f = smoothstep(uFogNear, uFogFar, dist) * 0.86; return mix(col, uFogColor, f); }'
  ].join('\n');

  /* Posterised, slightly mottled lambert used by terrain, trees and mountains. */
  var paintVertex = [
    'attribute float aCanopy;',
    'uniform float uTime; uniform float uWind;',
    'varying vec3 vNormal; varying vec3 vWorld; varying vec3 vColor; varying float vDist;',
    'uniform vec3 uTrunk; uniform float uHasCanopy;',
    'void main(){',
    '  vec3 p = position;',
    '  vec3 n = normal;',
    '  vec3 base = vec3(1.0);',
    '  #ifdef USE_COLOR',
    '    base = color;',
    '  #endif',
    '  #ifdef USE_INSTANCING',
    '    vec3 inst = vec3(1.0);',
    '    #ifdef USE_INSTANCING_COLOR',
    '      inst = instanceColor;',
    '    #endif',
    '    base = mix(uTrunk, inst, aCanopy);',
    '    float phase = instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.23;',
    '    float sway = sin(uTime * 1.1 + phase) * uWind * aCanopy * max(p.y, 0.0) * 0.06;',
    '    p.x += sway; p.z += sway * 0.6;',
    '    vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);',
    '    n = normalize(mat3(modelMatrix * instanceMatrix) * n);',
    '  #else',
    '    vec4 w = modelMatrix * vec4(p, 1.0);',
    '    n = normalize(mat3(modelMatrix) * n);',
    '  #endif',
    '  vWorld = w.xyz; vNormal = n; vColor = base;',
    '  vDist = distance(cameraPosition, w.xyz);',
    '  gl_Position = projectionMatrix * viewMatrix * w;',
    '}'
  ].join('\n');

  var paintFragment = [
    'precision highp float;',
    GLSL_NOISE, GLSL_FOG,
    'uniform vec3 uLightDir; uniform vec3 uLightColor; uniform vec3 uAmbient; uniform float uLightIntensity;',
    'varying vec3 vNormal; varying vec3 vWorld; varying vec3 vColor; varying float vDist;',
    'void main(){',
    '  vec3 n = normalize(vNormal);',
    '  float ndl = max(dot(n, uLightDir), 0.0);',
    '  float band = floor(ndl * 4.0 + 0.5) / 4.0;',
    '  ndl = mix(ndl, band, 0.55);',
    '  float rim = pow(1.0 - max(dot(n, normalize(cameraPosition - vWorld)), 0.0), 3.0) * 0.14;',
    '  vec3 col = vColor * (uAmbient * 0.85 + 0.12 + uLightColor * uLightIntensity * ndl * 0.62) + uLightColor * rim * 0.45;',
    '  float mottle = 0.93 + 0.14 * vnoise(vWorld.xz * 1.6 + vWorld.y * 0.7);',
    '  col *= mottle;',
    '  col = mix(col, 1.0 - exp(-col * 1.25), 0.45);',
    '  col = applyFog(col, vDist);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var skyVertex = [
    'varying vec3 vDir;',
    'void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
  ].join('\n');

  var skyFragment = [
    'precision highp float;',
    GLSL_NOISE,
    'uniform vec3 uSkyTop; uniform vec3 uSkyMid; uniform vec3 uHorizon; uniform vec3 uSunGlow;',
    'uniform vec3 uSunDir; uniform float uStars; uniform float uTime; uniform float uGlowStrength;',
    'varying vec3 vDir;',
    'void main(){',
    '  vec3 d = normalize(vDir);',
    '  float h = d.y;',
    '  vec3 col = mix(uHorizon, uSkyMid, smoothstep(-0.02, 0.28, h));',
    '  col = mix(col, uSkyTop, smoothstep(0.18, 0.8, h));',
    '  col = mix(col, uHorizon * 0.92, smoothstep(0.0, -0.25, h));',
    '  float sd = max(dot(d, uSunDir), 0.0);',
    '  col += uSunGlow * (pow(sd, 22.0) * 0.6 + pow(sd, 4.0) * 0.16) * uGlowStrength;',
    '  float cloud = vnoise(vec2(atan(d.x, d.z) * 3.0 + uTime * 0.01, h * 9.0)) * 0.5 + vnoise(vec2(atan(d.x, d.z) * 9.0 - uTime * 0.02, h * 24.0)) * 0.5;',
    '  col *= 0.95 + 0.1 * cloud;',
    '  if (uStars > 0.001 && h > 0.0) {',
    '    vec2 sc = vec2(atan(d.x, d.z) * 70.0, asin(clamp(h, -1.0, 1.0)) * 90.0);',
    '    vec2 cell = floor(sc); vec2 f = fract(sc);',
    '    float r = hash21(cell);',
    '    if (r > 0.975) {',
    '      vec2 c = vec2(hash21(cell + 1.7), hash21(cell + 3.1));',
    '      float dist = length(f - c);',
    '      float tw = 0.65 + 0.35 * sin(uTime * 1.7 + r * 90.0);',
    '      float s = smoothstep(0.09, 0.0, dist) * tw * (0.5 + 0.5 * hash21(cell + 9.3));',
    '      col += vec3(0.92, 0.94, 1.0) * s * uStars * smoothstep(0.0, 0.12, h);',
    '    }',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var orbVertex = [
    'varying vec2 vUv;',
    'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
  ].join('\n');

  var orbFragment = [
    'precision highp float;',
    GLSL_NOISE,
    'uniform vec3 uColor; uniform vec3 uGlow; uniform float uMoon; uniform float uGlowStrength;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec2 p = (vUv - 0.5) * 2.0;',
    '  float r = length(p);',
    '  float disc = 1.0 - smoothstep(0.2, 0.235, r);',
    '  float glow = (exp(-r * 4.0) * 0.9 + exp(-r * 1.6) * 0.16) * uGlowStrength;',
    '  float edge = 1.0 - smoothstep(0.55, 0.96, r);',
    '  float craters = smoothstep(0.52, 0.72, vnoise(p * 7.0 + 3.0)) * 0.35 + smoothstep(0.6, 0.8, vnoise(p * 13.0)) * 0.15;',
    '  vec3 discCol = uColor * (1.0 - uMoon * craters);',
    '  vec3 col = (discCol * disc + uGlow * glow * (1.0 - disc * 0.6)) * edge;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var lakeVertex = [
    'varying vec3 vWorld; varying float vDist;',
    'void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vDist = distance(cameraPosition, w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }'
  ].join('\n');

  var lakeFragment = [
    'precision highp float;',
    GLSL_NOISE, GLSL_FOG,
    'uniform vec3 uSkyMid; uniform vec3 uHorizon; uniform vec3 uSunGlow; uniform vec3 uSunDir; uniform float uTime; uniform float uStreak;',
    'varying vec3 vWorld; varying float vDist;',
    'void main(){',
    '  vec3 base = mix(uSkyMid, uHorizon, 0.42) * 0.9;',
    '  float ripple = sin(vWorld.x * 0.9 + uTime * 0.8) * sin(vWorld.z * 0.55 - uTime * 0.6) * 0.5 + 0.5;',
    '  ripple = ripple * 0.5 + vnoise(vWorld.xz * 0.6 + uTime * 0.05) * 0.5;',
    '  vec3 toP = normalize(vec3(vWorld.x - cameraPosition.x, 0.0, vWorld.z - cameraPosition.z));',
    '  vec3 sunFlat = normalize(vec3(uSunDir.x, 0.0, uSunDir.z));',
    '  float align = max(dot(toP, sunFlat), 0.0);',
    '  float streak = pow(align, 60.0) * uStreak * (0.55 + 0.45 * ripple);',
    '  vec3 col = base * (0.9 + 0.2 * ripple) + uSunGlow * streak * 0.9;',
    '  col = mix(col, uSkyMid * 0.85, 0.15 * smoothstep(0.6, 1.0, ripple));',
    '  col = applyFog(col, vDist);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var leafVertex = [
    'attribute vec4 aSeed; attribute vec3 aColor; attribute float aSpeed;',
    'uniform float uTime; uniform vec3 uCenter; uniform float uCalm; uniform vec3 uBox; uniform float uHide;',
    'varying vec3 vColor; varying vec2 vUv; varying float vDist; varying vec3 vNormal; varying float vHide;',
    'mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }',
    'mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }',
    'mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }',
    'void main(){',
    '  float t = uTime;',
    '  float fall = (0.55 + aSpeed * 0.75) * (0.45 + 0.55 * uCalm);',
    '  vec3 p = aSeed.xyz;',
    '  p.x += sin(t * 0.7 + aSeed.w * 6.2831) * (0.9 + 0.8 * uCalm) + t * 0.35 * uCalm;',
    '  p.z += cos(t * 0.5 + aSeed.w * 3.1) * 0.5;',
    '  p.y -= t * fall;',
    '  p.x = mod(p.x - uCenter.x + uBox.x * 0.5, uBox.x) - uBox.x * 0.5 + uCenter.x;',
    '  p.z = mod(p.z - uCenter.z + uBox.z * 0.55, uBox.z) - uBox.z * 0.55 + uCenter.z;',
    '  p.y = mod(p.y - uCenter.y + uBox.y * 0.35, uBox.y) - uBox.y * 0.35 + uCenter.y;',
    '  float spin = t * (0.8 + aSpeed * 1.6) * (0.5 + 0.5 * uCalm) + aSeed.w * 10.0;',
    '  mat3 R = rotY(spin * 0.7) * rotX(spin) * rotZ(aSeed.w * 6.2831);',
    '  vec3 local = R * (position * (0.8 + aSpeed * 0.6));',
    '  vNormal = R * vec3(0.0, 0.0, 1.0);',
    '  vec3 w = p + local;',
    '  vColor = aColor; vUv = uv; vDist = distance(cameraPosition, w);',
    '  vHide = aSpeed < uHide ? 1.0 : 0.0;',
    '  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);',
    '}'
  ].join('\n');

  var leafFragment = [
    'precision highp float;',
    GLSL_FOG,
    'uniform vec3 uLightDir; uniform vec3 uLightColor; uniform vec3 uAmbient; uniform float uLightIntensity;',
    'varying vec3 vColor; varying vec2 vUv; varying float vDist; varying vec3 vNormal; varying float vHide;',
    'void main(){',
    '  if (vHide > 0.5 || vDist < 1.6) discard;',
    '  vec2 q = (vUv - 0.5) * vec2(2.0, 2.0);',
    '  float tip = smoothstep(0.2, 1.0, abs(q.x));',
    '  float shape = length(vec2(q.x, q.y * (1.0 + tip * 0.6)));',
    '  if (shape > 1.0) discard;',
    '  float vein = smoothstep(0.03, 0.0, abs(q.y)) * 0.25;',
    '  float ndl = abs(dot(normalize(vNormal), uLightDir));',
    '  vec3 col = vColor * (uAmbient * 0.95 + uLightColor * uLightIntensity * (0.45 + 0.55 * ndl)) * (1.0 - vein);',
    '  col = applyFog(col, vDist);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* Painterly post-process: brush displacement + Kuwahara + canvas weave + vignette. */
  var postFragment = [
    'precision highp float;',
    GLSL_NOISE,
    'uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform vec2 uResolution; uniform float uTime; uniform float uVignette;',
    'varying vec2 vUv;',
    '#define RADIUS ' + KUWAHARA_RADIUS,
    'void main(){',
    '  vec2 uv = vUv;',
    '  vec2 warp = vec2(vnoise(uv * vec2(16.0, 10.0) + uTime * 0.03), vnoise(uv * vec2(10.0, 16.0) - uTime * 0.025)) - 0.5;',
    '  uv += warp * 0.0065;',
    '  vec3 best = vec3(0.0); float bestVar = 1e9;',
    '  for (int s = 0; s < 4; s++) {',
    '    vec2 dir = vec2(s == 0 || s == 3 ? -1.0 : 1.0, s < 2 ? -1.0 : 1.0);',
    '    vec3 mean = vec3(0.0); vec3 sq = vec3(0.0); float n = 0.0;',
    '    for (int i = 0; i <= RADIUS; i++) {',
    '      for (int j = 0; j <= RADIUS; j++) {',
    '        vec3 c = texture2D(tDiffuse, uv + vec2(float(i), float(j)) * dir * uTexel).rgb;',
    '        mean += c; sq += c * c; n += 1.0;',
    '      }',
    '    }',
    '    mean /= n; sq = abs(sq / n - mean * mean);',
    '    float v = sq.r + sq.g + sq.b;',
    '    if (v < bestVar) { bestVar = v; best = mean; }',
    '  }',
    '  vec3 col = best;',
    '  col = mix(col, floor(col * 20.0 + 0.5) / 20.0, 0.2);',
    '  float weave = (sin(gl_FragCoord.x * 0.9) * sin(gl_FragCoord.y * 0.9)) * 0.012 + (vnoise(gl_FragCoord.xy * 0.45) - 0.5) * 0.04;',
    '  col += weave;',
    '  float vig = smoothstep(0.45, 1.15, length((vUv - 0.5) * vec2(1.25, 1.0)) * 1.35);',
    '  col *= 1.0 - uVignette * vig;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var postVertex = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

  /* Stars: painted dabs, depth-tested against the hills so they never shine through the ground. */
  var starVertex = [
    'attribute float aSize; attribute float aPhase;',
    'uniform float uTime; uniform float uScale; uniform float uStars;',
    'varying float vTwinkle;',
    'void main(){',
    '  vTwinkle = (0.6 + 0.4 * sin(uTime * 1.4 + aPhase * 40.0)) * uStars;',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_PointSize = aSize * uScale * (0.85 + 0.3 * vTwinkle);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');
  var starFragment = [
    'precision highp float;',
    'varying float vTwinkle;',
    'void main(){',
    '  float r = length(gl_PointCoord - 0.5) * 2.0;',
    '  float a = (1.0 - smoothstep(0.25, 0.95, r)) * vTwinkle;',
    '  gl_FragColor = vec4(vec3(0.95, 0.96, 1.0) * a * 1.2, 1.0);',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------------
   * Scene graph
   * ------------------------------------------------------------------ */
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(56, 1, 0.3, 1200);

  var shared = {
    uTime: { value: 0 },
    uWind: { value: 1 },
    uLightDir: { value: new THREE.Vector3(0.3, 0.8, 0.5) },
    uLightColor: { value: new THREE.Vector3(1, 0.9, 0.7) },
    uAmbient: { value: new THREE.Vector3(0.5, 0.5, 0.6) },
    uLightIntensity: { value: 1.2 },
    uFogColor: { value: new THREE.Vector3(0.9, 0.8, 0.65) },
    uFogNear: { value: 28 },
    uFogFar: { value: 250 }
  };

  function paintMaterial(extra) {
    var uniforms = Object.assign({
      uTrunk: { value: new THREE.Vector3(0.36, 0.24, 0.16) },
      uHasCanopy: { value: 0 }
    }, shared, extra || {});
    return new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: paintVertex, fragmentShader: paintFragment });
  }

  /* --- terrain --- */
  function buildTerrain() {
    var geo = new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, TERRAIN_SEG[0], TERRAIN_SEG[1]);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var MEADOW = [0.74, 0.55, 0.25], RUST = [0.66, 0.30, 0.16], OCHRE = [0.82, 0.52, 0.17];
    var PINE = [0.36, 0.43, 0.21], TRAIL = [0.49, 0.36, 0.23], ROCK = [0.44, 0.37, 0.40], BASIN = [0.30, 0.30, 0.26];
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i) + TERRAIN_CZ;
      var h = terrainHeight(x, z);
      pos.setY(i, h);
      pos.setZ(i, z);
      var d = Math.abs(x - trailX(z));
      var n1 = noise2(x * 0.11 + 9, z * 0.11), n2 = noise2(x * 0.05 + 40, z * 0.05 + 2), n3 = noise2(x * 0.2 + 70, z * 0.2);
      var c = MEADOW.slice();
      var rust = sstep(0.42, 0.7, n1);
      for (var k = 0; k < 3; k++) c[k] = mix(c[k], RUST[k], rust);
      var ochre = sstep(0.58, 0.78, n2);
      for (k = 0; k < 3; k++) c[k] = mix(c[k], OCHRE[k], ochre * 0.8);
      var pine = sstep(0.68, 0.85, n3) * sstep(5, 14, h);
      for (k = 0; k < 3; k++) c[k] = mix(c[k], PINE[k], pine);
      var rock = sstep(13, 24, h);
      for (k = 0; k < 3; k++) c[k] = mix(c[k], ROCK[k], rock * 0.85);
      var trail = 1 - sstep(1.4, 3.2, d);
      for (k = 0; k < 3; k++) c[k] = mix(c[k], TRAIL[k], trail);
      var b = basin(x, z);
      for (k = 0; k < 3; k++) c[k] = mix(c[k], BASIN[k], sstep(0.35, 0.8, b));
      var jitter = 0.95 + 0.1 * hash2(i, 3);
      colors[i * 3] = c[0] * jitter; colors[i * 3 + 1] = c[1] * jitter; colors[i * 3 + 2] = c[2] * jitter;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aCanopy', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
    geo.computeVertexNormals();
    var mat = paintMaterial();
    mat.vertexColors = true;
    var mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh;
  }

  /* --- far mountains: a handful of displaced cones on the far edge --- */
  function buildMountains() {
    var parts = [];
    var count = 15;
    for (var i = 0; i < count; i++) {
      var t = i / (count - 1);
      var x = mix(-260, 260, t) + (hash2(i, 1) - 0.5) * 50;
      var z = -352 + hash2(i, 2) * 40 - Math.abs(t - 0.5) * 50;
      var radius = 42 + hash2(i, 3) * 38;
      var height = 48 + hash2(i, 4) * 58 + (1 - Math.abs(t - 0.5) * 2) * 24;
      var g = new THREE.ConeGeometry(radius, height, 7, 3, false).toNonIndexed();
      var p = g.attributes.position;
      var frac = new Float32Array(p.count);
      for (var j = 0; j < p.count; j++) {
        var px = p.getX(j), py = p.getY(j), pz = p.getZ(j);
        var nz = noise2(px * 0.03 + i, pz * 0.03) - 0.5;
        p.setXYZ(j, px * (1 + nz * 0.4), py + nz * height * 0.25 * (1 - py / height), pz * (1 + nz * 0.3));
        frac[j] = (p.getY(j) + height / 2) / height;   // 0 at the base, 1 at the peak
      }
      g.setAttribute('aCanopy', new THREE.BufferAttribute(frac, 1));
      g.translate(x, height / 2 - 16 + z * 0.022, z);
      parts.push(g);
    }
    var geo = mergeGeometries(parts);
    var colors = new Float32Array(geo.attributes.position.count * 3);
    var pos = geo.attributes.position;
    var fracAttr = geo.attributes.aCanopy;
    for (var k = 0; k < pos.count; k++) {
      var f = fracAttr.getX(k);
      var snow = sstep(0.66, 0.86, f + (noise2(pos.getX(k) * 0.08, pos.getZ(k) * 0.08) - 0.5) * 0.12);
      var c = [mix(0.40, 0.90, snow), mix(0.33, 0.88, snow), mix(0.47, 0.92, snow)];
      colors[k * 3] = c[0]; colors[k * 3 + 1] = c[1]; colors[k * 3 + 2] = c[2];
    }
    // The mountain shader treats aCanopy as "is canopy"; reset it so the trunk tint is never mixed in.
    geo.setAttribute('aCanopy', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mat = paintMaterial();
    mat.vertexColors = true;
    var mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh;
  }

  /* Concatenate non-indexed geometries (position/normal/aCanopy only). */
  function mergeGeometries(list) {
    var total = 0;
    list.forEach(function (g) { total += g.attributes.position.count; });
    var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), can = new Float32Array(total);
    var off = 0;
    list.forEach(function (g) {
      var p = g.attributes.position.array, n = g.attributes.normal ? g.attributes.normal.array : null;
      pos.set(p, off * 3);
      if (n) nor.set(n, off * 3);
      if (g.attributes.aCanopy) can.set(g.attributes.aCanopy.array, off);
      off += g.attributes.position.count;
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('aCanopy', new THREE.BufferAttribute(can, 1));
    return geo;
  }

  /* --- trees: trunk + three lumpy canopies, instanced with autumn colours --- */
  function buildTrees() {
    var trunk = new THREE.CylinderGeometry(0.1, 0.2, 1.9, 6, 1).toNonIndexed();
    trunk.translate(0, 0.95, 0);
    trunk.setAttribute('aCanopy', new THREE.BufferAttribute(new Float32Array(trunk.attributes.position.count), 1));
    var canopies = [[0, 2.35, 0, 1.05], [0.55, 1.75, 0.25, 0.75], [-0.5, 1.9, -0.3, 0.7]].map(function (c, idx) {
      var g = new THREE.IcosahedronGeometry(c[3], 1);
      var p = g.attributes.position;
      for (var j = 0; j < p.count; j++) {
        var px = p.getX(j), py = p.getY(j), pz = p.getZ(j);
        var jit = 1 + (hash2(Math.round(px * 50) + idx, Math.round(py * 50) + Math.round(pz * 50)) - 0.5) * 0.3;
        p.setXYZ(j, px * jit, py * jit * 0.9, pz * jit);
      }
      g.translate(c[0], c[1], c[2]);
      g.setAttribute('aCanopy', new THREE.BufferAttribute(new Float32Array(p.count).fill(1), 1));
      return g;
    });
    var geo = mergeGeometries([trunk].concat(canopies));
    geo.computeVertexNormals();
    var mat = paintMaterial();
    var mesh = new THREE.InstancedMesh(geo, mat, TREE_COUNT);
    var colors = new Float32Array(TREE_COUNT * 3);
    var m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    var foliage = JL.timeline.FOLIAGE.map(JL.timeline.hexToRgb);
    var placed = 0, attempts = 0;
    while (placed < TREE_COUNT && attempts < TREE_COUNT * 40) {
      attempts++;
      var z = 40 - hash2(attempts, 11) * 215;          // from z=40 to z=-175
      var x = (hash2(attempts, 12) - 0.5) * 150;
      var d = Math.abs(x - trailX(z));
      if (d < 5.5) continue;
      if (z < -118 && d < 11) continue;                 // keep the overlook clear
      if (basin(x, z) > 0.2) continue;
      var h = terrainHeight(x, z);
      if (h > 20) continue;
      var scale = 0.75 + hash2(attempts, 13) * 1.1;
      if (d < 12) scale *= 0.9;
      v.set(x, h - 0.15, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash2(attempts, 14) * Math.PI * 2);
      s.set(scale, scale * (0.9 + hash2(attempts, 15) * 0.4), scale);
      m.compose(v, q, s);
      mesh.setMatrixAt(placed, m);
      var c = foliage[Math.floor(hash2(attempts, 16) * foliage.length)];
      var tint = 0.85 + hash2(attempts, 17) * 0.3;
      colors[placed * 3] = c[0] / 255 * tint; colors[placed * 3 + 1] = c[1] / 255 * tint; colors[placed * 3 + 2] = c[2] / 255 * tint;
      placed++;
    }
    mesh.count = placed;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /* --- falling leaves: GPU-animated instanced quads around the camera --- */
  function buildLeaves() {
    var base = new THREE.PlaneGeometry(0.3, 0.19);
    var geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    var seeds = new Float32Array(LEAF_COUNT * 4), colors = new Float32Array(LEAF_COUNT * 3), speeds = new Float32Array(LEAF_COUNT);
    var foliage = JL.timeline.FOLIAGE.map(JL.timeline.hexToRgb);
    for (var i = 0; i < LEAF_COUNT; i++) {
      seeds[i * 4] = (hash2(i, 21) - 0.5) * 40;
      seeds[i * 4 + 1] = hash2(i, 22) * 18;
      seeds[i * 4 + 2] = (hash2(i, 23) - 0.5) * 36;
      seeds[i * 4 + 3] = hash2(i, 24);
      var c = foliage[Math.floor(hash2(i, 25) * foliage.length)];
      var tint = 0.9 + hash2(i, 26) * 0.25;
      colors[i * 3] = c[0] / 255 * tint; colors[i * 3 + 1] = c[1] / 255 * tint; colors[i * 3 + 2] = c[2] / 255 * tint;
      speeds[i] = hash2(i, 27);
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
    geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
    geo.instanceCount = LEAF_COUNT;
    var mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({
        uCenter: { value: new THREE.Vector3() },
        uCalm: { value: 1 },
        uHide: { value: 0 },
        uBox: { value: new THREE.Vector3(40, 18, 36) }
      }, shared),
      vertexShader: leafVertex,
      fragmentShader: leafFragment,
      side: THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh;
  }

  var skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uSkyTop: { value: new THREE.Vector3() }, uSkyMid: { value: new THREE.Vector3() }, uHorizon: { value: new THREE.Vector3() },
      uSunGlow: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uStars: { value: 0 }, uTime: shared.uTime, uGlowStrength: { value: 1 }
    },
    vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false
  });
  var sky = new THREE.Mesh(new THREE.SphereGeometry(700, 36, 20), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -3;

  var orbMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Vector3(1, 1, 0.9) }, uGlow: { value: new THREE.Vector3(1, 0.6, 0.3) }, uMoon: { value: 0 }, uGlowStrength: { value: 1 } },
    vertexShader: orbVertex, fragmentShader: orbFragment, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
  });
  var orb = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), orbMat);
  orb.frustumCulled = false;
  orb.renderOrder = -2;

  var lakeMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({
      uSkyMid: skyMat.uniforms.uSkyMid, uHorizon: skyMat.uniforms.uHorizon, uSunGlow: skyMat.uniforms.uSunGlow,
      uSunDir: skyMat.uniforms.uSunDir, uStreak: { value: 0 }
    }, shared),
    vertexShader: lakeVertex, fragmentShader: lakeFragment
  });
  var lake = new THREE.Mesh(new THREE.PlaneGeometry(LAKE_RX * 2.4, LAKE_RZ * 2.4, 1, 1), lakeMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(LAKE_CENTER.x, LAKE_LEVEL + LAKE_CENTER.z * 0.022, LAKE_CENTER.z);
  lake.frustumCulled = false;

  function buildStars() {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(STAR_COUNT * 3), size = new Float32Array(STAR_COUNT), phase = new Float32Array(STAR_COUNT);
    for (var i = 0; i < STAR_COUNT; i++) {
      var az = hash2(i, 31) * Math.PI * 2;
      var el = 0.06 + Math.pow(hash2(i, 32), 0.8) * 1.45;
      var r = 640;
      pos[i * 3] = Math.cos(el) * Math.sin(az) * r;
      pos[i * 3 + 1] = Math.sin(el) * r;
      pos[i * 3 + 2] = Math.cos(el) * Math.cos(az) * r;
      size[i] = 6 + Math.pow(hash2(i, 33), 2.5) * 11;
      phase[i] = hash2(i, 34);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    var mat = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uScale: { value: 1 }, uStars: { value: 0 } },
      vertexShader: starVertex, fragmentShader: starFragment,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = -1;
    return points;
  }

  var terrain = buildTerrain();
  var mountains = buildMountains();
  var trees = buildTrees();
  var leaves = buildLeaves();
  var stars = buildStars();
  scene.add(sky, stars, orb, mountains, terrain, lake, trees, leaves);

  /* --- painterly post pass --- */
  var rt = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
  var postMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture },
      uTexel: { value: new THREE.Vector2(1 / 2, 1 / 2) },
      uResolution: { value: new THREE.Vector2(2, 2) },
      uTime: shared.uTime,
      uVignette: { value: 0.28 }
    },
    vertexShader: postVertex, fragmentShader: postFragment, depthTest: false, depthWrite: false
  });
  var postScene = new THREE.Scene();
  var postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

  /* ------------------------------------------------------------------
   * State: progress + palette from main.js
   * ------------------------------------------------------------------ */
  var state = JL.state || { progress: 0, theme: 'day', blend: 0 };
  var target = { progress: state.progress };
  var current = { progress: state.progress };
  var tmp = new THREE.Vector3();

  window.addEventListener('jl:state', function (e) {
    if (e && e.detail) { state = e.detail; target.progress = state.progress; needsRender = true; }
  });

  /* The scene eases its own progress (camera lag), so it samples the timeline itself
     and mixes day/night by the toggle blend that journey.js animates. */
  function paletteAt(p) {
    var b = typeof state.blend === 'number' ? state.blend : (state.theme === 'night' ? 1 : 0);
    if (b <= 0) return JL.timeline.sample(p, 'light');
    if (b >= 1) return JL.timeline.sample(p, 'dark');
    return JL.timeline.blend(JL.timeline.sample(p, 'light'), JL.timeline.sample(p, 'dark'), b);
  }

  function setVec(u, rgb) { u.value.set(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255); }

  function applyPalette(pal) {
    var c = pal.rgb;
    setVec(skyMat.uniforms.uSkyTop, c.skyTop);
    setVec(skyMat.uniforms.uSkyMid, c.skyMid);
    setVec(skyMat.uniforms.uHorizon, c.horizon);
    setVec(skyMat.uniforms.uSunGlow, c.sunGlow);
    setVec(shared.uFogColor, c.fog);
    setVec(shared.uLightColor, c.light);
    setVec(shared.uAmbient, c.ambient);
    shared.uLightIntensity.value = pal.lightIntensity;
    skyMat.uniforms.uStars.value = pal.stars;
    stars.material.uniforms.uStars.value = pal.stars;
    stars.visible = pal.stars > 0.01;
    setVec(orbMat.uniforms.uColor, c.sun);
    setVec(orbMat.uniforms.uGlow, c.sunGlow);
    orbMat.uniforms.uMoon.value = pal.moon;

    // Sun direction from the timeline's normalised sky position.
    var az = (pal.sunX - 0.5) * Math.PI * 1.15;
    var el = clamp(pal.sunY, -0.12, 0.95) * Math.PI * 0.5;
    var dir = skyMat.uniforms.uSunDir.value;
    dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    var lel = Math.max(el, 0.09);
    shared.uLightDir.value.set(Math.sin(az) * Math.cos(lel), Math.sin(lel), -Math.cos(az) * Math.cos(lel)).normalize();
    var high = sstep(0.15, 0.7, pal.sunY);
    var glow = mix(1.0, 0.45, high) * mix(1, 0.55, pal.moon);
    skyMat.uniforms.uGlowStrength.value = glow;
    orbMat.uniforms.uGlowStrength.value = glow;
    orb.visible = pal.sunY > -0.1;
    // A low sun lays a streak on the water; the moon always does, gently.
    lakeMat.uniforms.uStreak.value = Math.max((1 - sstep(0.02, 0.4, pal.sunY)) * sstep(-0.08, 0.0, pal.sunY), 0.65 * pal.moon);
    // Lightly thicken the fog as the day cools; keep the night airy so stars read.
    shared.uFogNear.value = mix(26, 36, pal.progress);
    shared.uFogFar.value = mix(mix(300, 270, pal.progress), 330, pal.night);
    var calm = sstep(0.55, 1, pal.progress);
    leaves.material.uniforms.uCalm.value = 1 - 0.7 * calm;
    leaves.material.uniforms.uHide.value = 0.45 * calm;
    shared.uWind.value = (1 - 0.65 * calm) * (typeof state.wind === 'number' ? 0.6 + 0.4 * Math.abs(state.wind) : 1);
  }

  /* ------------------------------------------------------------------
   * Camera path
   * ------------------------------------------------------------------ */
  function placeCamera(p) {
    var z = -p * TRAIL_LENGTH;
    var x = trailX(z);
    var y = terrainHeight(x, z) + EYE;
    camera.position.set(x + Math.sin(p * 9) * 0.4, y, z);
    var ahead = 14;
    var tz = z - ahead;
    var tx = trailX(tz);
    var ty = terrainHeight(tx, tz) + EYE;
    var arrive = sstep(0.72, 1, p);
    var pitch = mix(-0.2, 1.4, arrive);                       // lift the gaze toward the sky for the payoff
    tmp.set(tx, mix(mix(ty, y, 0.5), y, arrive) + pitch, tz); // ...and stop following the trail down into the lake
    camera.lookAt(tmp);
    camera.rotation.z = Math.sin(p * 6.0) * 0.012;
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    var sd = skyMat.uniforms.uSunDir.value;
    orb.position.copy(camera.position).addScaledVector(sd, 560);
    orb.quaternion.copy(camera.quaternion);
    var size = 60 + 30 * (1 - clamp(sd.y, 0, 1));            // bigger disc near the horizon, like a painting
    orb.scale.set(size, size, 1);
    leaves.material.uniforms.uCenter.value.copy(camera.position);
  }

  /* ------------------------------------------------------------------
   * Sizing and frame loop
   * ------------------------------------------------------------------ */
  var width = 1, height = 1;
  function resize() {
    width = window.innerWidth; height = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    var rw = Math.max(2, Math.floor(width * dpr * RT_SCALE)), rh = Math.max(2, Math.floor(height * dpr * RT_SCALE));
    rt.setSize(rw, rh);
    stars.material.uniforms.uScale.value = dpr * RT_SCALE;
    postMat.uniforms.uTexel.value.set(1 / rw, 1 / rh);
    postMat.uniforms.uResolution.value.set(width * dpr, height * dpr);
    needsRender = true;
  }

  var needsRender = true;
  var running = false;
  var frames = 0;
  var lastT = 0;
  var simTime = 0;
  var first = true;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    var dt = lastT ? Math.min((now - lastT) / 1000, 0.1) : 0.016;
    lastT = now;
    if (!reduceMotion) simTime += dt;
    shared.uTime.value = simTime;

    // Ease the camera toward the scrolled position (time-based so it feels the same at any frame rate).
    if (first) { current.progress = target.progress; first = false; }
    else current.progress += (target.progress - current.progress) * (1 - Math.exp(-dt * 7));
    var moving = Math.abs(target.progress - current.progress) > 0.00005;

    if (reduceMotion && !needsRender && !moving) return;
    needsRender = false;

    applyPalette(paletteAt(current.progress));
    placeCamera(current.progress);

    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
    frames++;
  }

  function start() {
    if (running) return;
    running = true; lastT = 0;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    stop();
    root.classList.remove('has-webgl');
    root.classList.add('no-webgl');
  });

  resize();
  start();

  JL.scene = { renderer: renderer, scene: scene, camera: camera, orb: orb, ready: true, counts: { trees: trees.count, leaves: LEAF_COUNT, stars: STAR_COUNT }, get frames() { return frames; } };
  root.setAttribute('data-scene', 'webgl');
})();
