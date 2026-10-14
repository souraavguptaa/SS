// Painted sky dome: gradient + sun + moon + stars + nebula + aurora + painted cloud streaks.
import * as THREE from 'three';
import { SNOISE, HASH } from './glsl.js';

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // push to far plane
  }
`;

const frag = /* glsl */ `
  ${SNOISE}
  ${HASH}
  uniform float uTime;
  uniform vec3 uZenith, uMid, uHorizon, uGround;
  uniform float uMidH, uHorizonSharp, uGroundFade;
  uniform vec3 uSunDir, uSunColor; uniform float uSunSize, uSunGlow, uSunGlowPow, uSunDisc, uSunHalo, uSunHaloPow;
  uniform vec3 uMoonDir, uMoonColor; uniform float uMoonSize, uMoonGlow, uMoonPhase;
  uniform float uStars, uStarScale, uStarDensity, uStarTwinkle, uStarHorizon;
  uniform float uNebula; uniform vec3 uNebA, uNebB, uNebAxis; uniform float uNebScale, uNebWidth;
  uniform float uAurora; uniform vec3 uAurA, uAurB; uniform float uAurLow, uAurHigh;
  uniform float uClouds; uniform vec3 uCloudLit, uCloudShade; uniform float uCloudHigh, uCloudScale, uCloudCover;
  uniform float uPixAng; // radians per pixel (for star AA)
  varying vec3 vDir;

  float starLayer(vec3 d, float scale, float density, float sizePx, float seed) {
    vec3 p = d * scale;
    vec3 c = floor(p);
    vec3 f = fract(p);
    float s = 0.0;
    vec3 h = hash33(c + seed);
    if (hash13(c + seed * 1.7) < density) {
      vec3 sp = 0.15 + 0.7 * h;
      float dist = length(f - sp) / scale; // angular distance approx (radians)
      float b = hash13(c + seed * 3.1);
      float rad = uPixAng * sizePx * (0.5 + b * b * 1.6);
      float core = 1.0 - smoothstep(rad * 0.4, rad, dist);
      float halo = exp(-dist / (rad * 2.5)) * 0.25;
      float tw = 1.0 - uStarTwinkle * 0.5 * (1.0 + sin(uTime * (1.5 + 4.0 * h.x) + h.y * 40.0));
      s = (core + halo) * (0.35 + 0.65 * b) * tw;
    }
    return s;
  }

  void main() {
    vec3 d = normalize(vDir);
    float e = d.y;
    // --- gradient ---
    vec3 col;
    if (e >= 0.0) {
      float hz = pow(1.0 - e, uHorizonSharp);
      vec3 upper = mix(uMid, uZenith, smoothstep(uMidH, 1.0, e));
      vec3 lower = mix(uHorizon, uMid, smoothstep(0.0, uMidH, e));
      col = e < uMidH ? lower : upper;
      col = mix(col, uHorizon, hz * 0.35);
    } else {
      col = mix(uHorizon, uGround, smoothstep(0.0, uGroundFade, -e));
    }
    float az = atan(d.z, d.x);

    // --- nebula band ---
    if (uNebula > 0.0) {
      float band = exp(-pow(dot(d, normalize(uNebAxis)) / uNebWidth, 2.0));
      float n1 = fbm3(d * uNebScale + vec3(0.0, 0.0, uTime * 0.004));
      float n2 = fbm3(d * uNebScale * 2.3 + vec3(5.2, 1.3, 0.0));
      float neb = smoothstep(-0.2, 0.7, n1 + 0.4 * band) * band;
      vec3 nc = mix(uNebA, uNebB, smoothstep(-0.3, 0.5, n2));
      col += nc * neb * uNebula;
      // dark dust lanes
      col *= 1.0 - 0.45 * band * smoothstep(0.15, 0.45, n2) * uNebula;
    }

    // --- stars ---
    if (uStars > 0.0) {
      float horizonFade = smoothstep(-0.02, uStarHorizon, e);
      float s = starLayer(d, uStarScale, uStarDensity, 1.3, 1.0)
              + starLayer(d, uStarScale * 0.43, uStarDensity * 0.7, 2.0, 7.0)
              + starLayer(d, uStarScale * 0.17, uStarDensity * 0.5, 2.8, 13.0);
      vec3 sc = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), hash13(floor(d * 50.0)));
      col += sc * s * uStars * horizonFade;
    }

    // --- aurora curtains ---
    if (uAurora > 0.0 && e > uAurLow - 0.08) {
      float t = uTime;
      float fold = snoise(vec3(az * 1.3, t * 0.04, 1.0)) + 0.5 * snoise(vec3(az * 3.1, t * 0.06, 7.0));
      float base = uAurLow + 0.07 * fold;
      float h = (e - base) / (uAurHigh - base);
      // sinuous ribbons: distance to a wavy line in azimuth
      float band = sin(az * 2.0 + fold * 2.6 + t * 0.05);
      float curtain = smoothstep(0.15, 0.95, band * 0.5 + 0.5) * (0.6 + 0.4 * snoise(vec3(az * 4.0, t * 0.08, 3.0)));
      float rays = 0.78 + 0.22 * snoise(vec3(az * 34.0 + fold * 6.0 + e * 8.0, t * 0.2, 2.0));
      float shape = smoothstep(0.0, 0.06, h) * exp(-max(h, 0.0) * 2.2) * (1.0 - smoothstep(0.85, 1.2, h));
      vec3 ac = mix(uAurA, uAurB, smoothstep(0.15, 0.95, h));
      col += ac * shape * curtain * rays * uAurora;
    }

    // --- painted cloud streaks (lit by the sun) ---
    if (uClouds > 0.0 && e > -0.02 && e < uCloudHigh + 0.1) {
      float lat = e / uCloudHigh;
      float n = fbm3(vec3(az * uCloudScale, e * uCloudScale * 9.0, 2.0)) ;
      float band = smoothstep(0.0, 0.15, lat) * (1.0 - smoothstep(0.75, 1.0, lat));
      float c = smoothstep(uCloudCover, uCloudCover + 0.06, n * band + 0.25 * band);
      float lit = smoothstep(-0.2, 0.4, dot(d, uSunDir)) * 0.6 + 0.4 * smoothstep(0.0, 0.6, snoise(vec3(az * uCloudScale * 2.0, e * 40.0, 7.0)));
      vec3 cc = mix(uCloudShade, uCloudLit, lit);
      col = mix(col, cc, c * uClouds);
    }

    // --- sun ---
    if (uSunGlow > 0.0 || uSunDisc > 0.0) {
      float sd = max(dot(d, normalize(uSunDir)), 0.0);
      col += uSunColor * pow(sd, uSunGlowPow) * uSunGlow;
      col += uSunColor * pow(sd, uSunHaloPow) * uSunHalo;
      float cosS = cos(uSunSize);
      float disc = smoothstep(cosS - 0.0004, cosS + 0.0004, sd);
      col = mix(col, uSunColor * 1.6 + vec3(0.6), disc * uSunDisc);
    }

    // --- moon (cel crescent) ---
    if (uMoonGlow > 0.0) {
      vec3 md = normalize(uMoonDir);
      float m = dot(d, md);
      float cosM = cos(uMoonSize);
      float disc = smoothstep(cosM - 0.00025, cosM + 0.00025, m);
      // crescent: offset second disc
      vec3 side = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
      vec3 md2 = normalize(md + side * uMoonSize * uMoonPhase);
      float disc2 = smoothstep(cosM - 0.00025, cosM + 0.00025, dot(d, md2));
      float lit = disc * (1.0 - disc2 * step(0.001, uMoonPhase));
      float craters = 0.88 + 0.12 * smoothstep(-0.2, 0.4, snoise(d * 900.0));
      col += uMoonColor * pow(max(m, 0.0), 900.0) * uMoonGlow * 0.6;
      col += uMoonColor * pow(max(m, 0.0), 60.0) * uMoonGlow * 0.12;
      col = mix(col, uMoonColor * craters * 1.3, lit);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function makeSky(params = {}) {
  const c = (v, d) => ({ value: new THREE.Color(v ?? d) });
  const v3 = (v, d) => ({ value: new THREE.Vector3(...(v ?? d)).normalize() });
  const f = (v, d) => ({ value: v ?? d });
  const p = params;
  const uniforms = {
    uTime: { value: 0 },
    uZenith: c(p.zenith, 0x0b1030), uMid: c(p.mid, 0x1d2a66), uHorizon: c(p.horizon, 0x4b5fa8), uGround: c(p.ground, 0x0a0a14),
    uMidH: f(p.midH, 0.25), uHorizonSharp: f(p.horizonSharp, 6.0), uGroundFade: f(p.groundFade, 0.2),
    uSunDir: v3(p.sunDir, [0, 0.1, -1]), uSunColor: c(p.sunColor, 0xffc070), uSunSize: f(p.sunSize, 0.035),
    uSunGlow: f(p.sunGlow, 0), uSunGlowPow: f(p.sunGlowPow, 40), uSunDisc: f(p.sunDisc, 0),
    uSunHalo: f(p.sunHalo, 0), uSunHaloPow: f(p.sunHaloPow, 4),
    uMoonDir: v3(p.moonDir, [0.3, 0.4, -1]), uMoonColor: c(p.moonColor, 0xfff3d6), uMoonSize: f(p.moonSize, 0.045),
    uMoonGlow: f(p.moonGlow, 0), uMoonPhase: f(p.moonPhase, 0),
    uStars: f(p.stars, 0), uStarScale: f(p.starScale, 380), uStarDensity: f(p.starDensity, 0.22),
    uStarTwinkle: f(p.starTwinkle, 0.5), uStarHorizon: f(p.starHorizon, 0.15),
    uNebula: f(p.nebula, 0), uNebA: c(p.nebA, 0x6a2c91), uNebB: c(p.nebB, 0x1f8fa8), uNebAxis: v3(p.nebAxis, [0.3, 1, 0.2]),
    uNebScale: f(p.nebScale, 2.2), uNebWidth: f(p.nebWidth, 0.35),
    uAurora: f(p.aurora, 0), uAurA: c(p.aurA, 0x2bff9a), uAurB: c(p.aurB, 0x8a3cff), uAurLow: f(p.aurLow, 0.12), uAurHigh: f(p.aurHigh, 0.6),
    uClouds: f(p.clouds, 0), uCloudLit: c(p.cloudLit, 0xffd0a0), uCloudShade: c(p.cloudShade, 0x7a5a9a),
    uCloudHigh: f(p.cloudHigh, 0.18), uCloudScale: f(p.cloudScale, 1.6), uCloudCover: f(p.cloudCover, 0.25),
    uPixAng: { value: 0.0004 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, depthTest: true });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky';
  // Follow the camera so the sky is infinitely far away.
  mesh.onBeforeRender = (renderer, scene, camera) => {
    mesh.position.copy(camera.position);
    mesh.scale.setScalar(camera.far * 0.9);
    mesh.updateMatrixWorld();
    const hfov = 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    uniforms.uPixAng.value = hfov / renderer.getSize(new THREE.Vector2()).x;
  };
  mesh.uniforms = uniforms;
  mesh.set = (k, v) => {
    const u = uniforms[k];
    if (!u) throw new Error('sky uniform ' + k);
    if (u.value && u.value.isColor) u.value.set(v);
    else if (u.value && u.value.isVector3) u.value.set(...v).normalize();
    else u.value = v;
  };
  return mesh;
}
