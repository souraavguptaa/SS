// Cel ("toon") shading + inverted-hull ink lines, art-directed through one shared light rig.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// One global light rig. Each shot sets these before rendering; every cel material reads them.
export const RIG = {
  uLightDir: { value: new THREE.Vector3(0.4, 0.8, 0.45).normalize() },
  uLightColor: { value: new THREE.Color(1, 1, 1) },
  uShadowTint: { value: new THREE.Color(0.5, 0.46, 0.68) },
  uAmbient: { value: new THREE.Color(0.0, 0.0, 0.0) },
  uRimColor: { value: new THREE.Color(1, 1, 1) },
  uRimStrength: { value: 0.0 },
  uFogColor: { value: new THREE.Color(0, 0, 0) },
  uFogNear: { value: 1e5 },
  uFogFar: { value: 2e5 },
  uP1Pos: { value: new THREE.Vector3() },
  uP1Color: { value: new THREE.Color(0, 0, 0) },
  uP1Range: { value: 1 },
  uP2Pos: { value: new THREE.Vector3() },
  uP2Color: { value: new THREE.Color(0, 0, 0) },
  uP2Range: { value: 1 },
  uTime: { value: 0 },
  uSat: { value: 1 }, // global saturation multiplier for cel surfaces (used for the "wellness" colour return)
};

export const INK = {
  uRes: { value: new THREE.Vector2(1920, 816) },
  uInkColor: { value: new THREE.Color(0.04, 0.02, 0.07) },
  uInkRef: { value: 6.0 },
  uInkMin: { value: 0.2 },
};

export function resetRig() {
  RIG.uLightDir.value.set(0.4, 0.8, 0.45).normalize();
  RIG.uLightColor.value.setRGB(1, 1, 1);
  RIG.uShadowTint.value.setRGB(0.5, 0.46, 0.68);
  RIG.uAmbient.value.setRGB(0, 0, 0);
  RIG.uRimColor.value.setRGB(1, 1, 1);
  RIG.uRimStrength.value = 0;
  RIG.uFogColor.value.setRGB(0, 0, 0);
  RIG.uFogNear.value = 1e5; RIG.uFogFar.value = 2e5;
  RIG.uP1Color.value.setRGB(0, 0, 0); RIG.uP1Range.value = 1;
  RIG.uP2Color.value.setRGB(0, 0, 0); RIG.uP2Range.value = 1;
  RIG.uSat.value = 1;
  INK.uInkColor.value.setRGB(0.04, 0.02, 0.07);
  INK.uInkRef.value = 6.0; INK.uInkMin.value = 0.2;
}

const instancingNormal = /* glsl */ `
  #ifdef USE_INSTANCING
    mat3 im = mat3(instanceMatrix);
    objectNormal /= vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2]));
    objectNormal = im * objectNormal;
  #endif
`;

const celVert = /* glsl */ `
  uniform float uTime;
  uniform float uSway;      // wind sway amplitude (world units at local y=1)
  uniform float uSwayFreq;
  varying vec3 vNv;
  varying vec3 vPv;
  varying vec3 vCol;
  varying vec2 vUv;
  varying vec3 vObj;
  #ifdef USE_GROW
    attribute float aGrow;
    uniform float uGrowT;
    uniform float uGrowDur;
  #endif
  void main() {
    vec3 objectNormal = normal;
    vec3 transformed = position;
    #ifdef USE_GROW
      float gk = clamp((uGrowT - aGrow) / uGrowDur, 0.0, 1.0);
      gk = gk * gk * (3.0 - 2.0 * gk);
      transformed *= mix(0.02, 1.0, gk);
      transformed.y += (1.0 - gk) * 0.0;
    #endif
    vCol = vec3(1.0);
    #ifdef USE_COLOR
      vCol *= color;
    #endif
    #ifdef USE_INSTANCING_COLOR
      vCol *= instanceColor;
    #endif
    vUv = uv;
    vObj = position;
    ${instancingNormal}
    #ifdef USE_INSTANCING
      vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    #else
      vec4 wp = modelMatrix * vec4(transformed, 1.0);
    #endif
    if (uSway > 0.0) {
      float h = max(position.y, 0.0);
      float ph = wp.x * 0.35 + wp.z * 0.27;
      wp.x += sin(uTime * uSwayFreq + ph) * uSway * h * h;
      wp.z += cos(uTime * uSwayFreq * 0.8 + ph * 1.3) * uSway * 0.6 * h * h;
    }
    vec4 mv = viewMatrix * wp;
    vNv = normalize(normalMatrix * objectNormal);
    #ifdef USE_INSTANCING
      vNv = normalize(mat3(viewMatrix) * mat3(modelMatrix) * objectNormal);
    #endif
    vPv = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const celFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uShade;
  uniform float uShadeMix;
  uniform vec3 uEmissive;
  uniform float uRim;
  uniform float uSpec;
  uniform float uOpacity;
  uniform float uTerm;       // terminator offset (-0.3..0.3): more or less shadow
  uniform float uFlat;       // 1 = unlit flat colour
  uniform float uFogAmt;
  uniform float uDesat;      // per-material desaturation (0..1)
  uniform vec3 uLightDir, uLightColor, uShadowTint, uAmbient, uRimColor;
  uniform float uRimStrength;
  uniform vec3 uFogColor;
  uniform float uFogNear, uFogFar;
  uniform vec3 uP1Pos, uP1Color; uniform float uP1Range;
  uniform vec3 uP2Pos, uP2Color; uniform float uP2Range;
  uniform float uSat;
  varying vec3 vNv;
  varying vec3 vPv;
  varying vec3 vCol;
  varying vec2 vUv;
  varying vec3 vObj;
  #ifdef USE_MAP
    uniform sampler2D map;
  #endif

  vec3 pointLight(vec3 pos, vec3 colr, float range, vec3 N, vec3 base) {
    vec3 p = (viewMatrix * vec4(pos, 1.0)).xyz;
    vec3 d = p - vPv;
    float r = length(d);
    float a = 1.0 - smoothstep(0.0, range, r);
    a = a * a;
    // two soft cel bands for the falloff
    float band = smoothstep(0.12, 0.18, a) * 0.55 + smoothstep(0.42, 0.5, a) * 0.45;
    float l = smoothstep(-0.1, 0.05, dot(N, d / max(r, 1e-4)));
    return base * colr * band * l;
  }

  void main() {
    vec3 N = normalize(vNv);
    #ifdef DOUBLE_SIDED
      N *= gl_FrontFacing ? 1.0 : -1.0;
    #endif
    vec3 V = normalize(-vPv);
    vec3 L = normalize((viewMatrix * vec4(uLightDir, 0.0)).xyz);
    vec3 base = uColor * vCol;
    #ifdef USE_MAP
      vec4 tx = texture2D(map, vUv);
      base *= tx.rgb;
    #endif
    float g = dot(base, vec3(0.299, 0.587, 0.114));
    base = mix(vec3(g), base, uSat * (1.0 - uDesat));
    vec3 col;
    if (uFlat > 0.5) {
      col = base;
    } else {
      float ndl = dot(N, L) + uTerm;
      float aa = max(fwidth(ndl) * 0.75, 0.002);
      float lit = smoothstep(-aa, aa, ndl);
      vec3 shade = mix(base * uShadowTint, uShade, uShadeMix) + uAmbient * base;
      col = mix(shade, base * uLightColor, lit);
      col += pointLight(uP1Pos, uP1Color, uP1Range, N, base);
      col += pointLight(uP2Pos, uP2Color, uP2Range, N, base);
      vec3 H = normalize(L + V);
      col += uLightColor * uSpec * smoothstep(0.955, 0.97, dot(N, H)) * lit;
      float fr = 1.0 - max(dot(N, V), 0.0);
      float raa = max(fwidth(fr) * 0.75, 0.002);
      float rim = smoothstep(0.68 - raa, 0.68 + raa, fr);
      col += uRimColor * rim * uRimStrength * uRim;
    }
    col += uEmissive;
    float fogF = smoothstep(uFogNear, uFogFar, length(vPv)) * uFogAmt;
    col = mix(col, uFogColor, fogF);
    float alpha = uOpacity;
    #ifdef USE_MAP
      alpha *= tx.a;
      if (alpha < 0.02) discard;
    #endif
    gl_FragColor = vec4(col, alpha);
  }
`;

const toColor = (c) => (c instanceof THREE.Color ? c.clone() : new THREE.Color(c));

// Create a cel material. opts: shade (explicit shadow colour), emissive, rim, spec, opacity, term, flat,
// side, map, vertexColors, sway, swayFreq, fog (0..1), desat, transparent, depthWrite, blending.
export function cel(color = 0xffffff, opts = {}) {
  const uniforms = {
    ...RIG,
    uColor: { value: toColor(color) },
    uShade: { value: toColor(opts.shade ?? 0x000000) },
    uShadeMix: { value: opts.shade !== undefined ? 1 : 0 },
    uEmissive: { value: toColor(opts.emissive ?? 0x000000) },
    uRim: { value: opts.rim ?? 1 },
    uSpec: { value: opts.spec ?? 0 },
    uOpacity: { value: opts.opacity ?? 1 },
    uTerm: { value: opts.term ?? 0 },
    uFlat: { value: opts.flat ? 1 : 0 },
    uFogAmt: { value: opts.fog ?? 1 },
    uDesat: { value: opts.desat ?? 0 },
    uSway: { value: opts.sway ?? 0 },
    uSwayFreq: { value: opts.swayFreq ?? 1.3 },
  };
  if (opts.map) uniforms.map = { value: opts.map };
  if (opts.grow) { uniforms.uGrowT = { value: 0 }; uniforms.uGrowDur = { value: opts.growDur ?? 0.6 }; }
  const m = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: celVert,
    fragmentShader: celFrag,
    side: opts.side ?? THREE.FrontSide,
    vertexColors: !!opts.vertexColors,
    transparent: !!opts.transparent || (opts.opacity !== undefined && opts.opacity < 1),
    depthWrite: opts.depthWrite ?? true,
    blending: opts.blending ?? THREE.NormalBlending,
  });
  m.defines = {};
  if (opts.map) m.defines.USE_MAP = '';
  if (opts.grow) m.defines.USE_GROW = '';
  m.isCel = true;
  return m;
}

// Unlit glow material (for flames, lamps, magic). Additive by default.
export function glow(color = 0xffffff, intensity = 1, opts = {}) {
  return new THREE.MeshBasicMaterial({
    color: toColor(color).multiplyScalar(intensity),
    transparent: true,
    opacity: opts.opacity ?? 1,
    blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false,
    side: opts.side ?? THREE.FrontSide,
    fog: false,
    toneMapped: false,
  });
}

// ---------- Ink outlines ----------
const inkVert = /* glsl */ `
  uniform vec2 uRes;
  uniform float uInk;
  uniform float uInkRef;
  uniform float uInkMin;
  uniform float uSway;
  uniform float uSwayFreq;
  uniform float uTime;
  varying vec3 vPv;
  #ifdef USE_GROW
    attribute float aGrow;
    uniform float uGrowT;
    uniform float uGrowDur;
  #endif
  void main() {
    vec3 objectNormal = normal;
    vec3 transformed = position;
    #ifdef USE_GROW
      float gk = clamp((uGrowT - aGrow) / uGrowDur, 0.0, 1.0);
      gk = gk * gk * (3.0 - 2.0 * gk);
      transformed *= mix(0.02, 1.0, gk);
    #endif
    ${instancingNormal}
    #ifdef USE_INSTANCING
      vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
      vec3 nv = normalize(mat3(viewMatrix) * mat3(modelMatrix) * objectNormal);
    #else
      vec4 wp = modelMatrix * vec4(transformed, 1.0);
      vec3 nv = normalize(normalMatrix * objectNormal);
    #endif
    if (uSway > 0.0) {
      float h = max(position.y, 0.0);
      float ph = wp.x * 0.35 + wp.z * 0.27;
      wp.x += sin(uTime * uSwayFreq + ph) * uSway * h * h;
      wp.z += cos(uTime * uSwayFreq * 0.8 + ph * 1.3) * uSway * 0.6 * h * h;
    }
    vec4 mv = viewMatrix * wp;
    vec4 clip = projectionMatrix * mv;
    vec2 nd = (projectionMatrix * vec4(nv, 0.0)).xy * uRes;
    float l = length(nd);
    nd = l > 1e-6 ? nd / l : vec2(0.0);
    float depth = max(-mv.z, 1e-3);
    float px = uInk * clamp(uInkRef / depth, uInkMin, 1.0);
    clip.xy += nd * (px * 2.0 / uRes) * clip.w;
    vPv = mv.xyz;
    gl_Position = clip;
  }
`;
const inkFrag = /* glsl */ `
  uniform vec3 uInkColor;
  uniform vec3 uFogColor;
  uniform float uFogNear, uFogFar;
  uniform float uOpacity;
  varying vec3 vPv;
  void main() {
    float fogF = smoothstep(uFogNear, uFogFar, length(vPv));
    gl_FragColor = vec4(mix(uInkColor, uFogColor, fogF), uOpacity);
  }
`;

const inkMats = new Map();
export function inkMaterial(width = 2.5, opts = {}) {
  const key = `${width}|${opts.sway ?? 0}|${opts.swayFreq ?? 1.3}|${opts.opacity ?? 1}`;
  if (!opts.grow && inkMats.has(key)) return inkMats.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...INK,
      uFogColor: RIG.uFogColor, uFogNear: RIG.uFogNear, uFogFar: RIG.uFogFar, uTime: RIG.uTime,
      uInk: { value: width },
      uSway: { value: opts.sway ?? 0 },
      uSwayFreq: { value: opts.swayFreq ?? 1.3 },
      uOpacity: { value: opts.opacity ?? 1 },
    },
    vertexShader: inkVert,
    fragmentShader: inkFrag,
    side: THREE.BackSide,
    transparent: (opts.opacity ?? 1) < 1,
  });
  if (opts.grow) {
    m.uniforms.uGrowT = opts.grow.uGrowT;
    m.uniforms.uGrowDur = opts.grow.uGrowDur;
    m.defines = { USE_GROW: '' };
    return m;
  }
  inkMats.set(key, m);
  return m;
}

const smoothCache = new WeakMap();
// A copy of the geometry with welded vertices and averaged normals so the hull has no cracks at hard edges.
export function smoothedGeometry(geo) {
  if (smoothCache.has(geo)) return smoothCache.get(geo);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) g.setIndex(geo.index.clone());
  let m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  for (const [k, a] of Object.entries(geo.attributes)) if (a.isInstancedBufferAttribute) m.setAttribute(k, a);
  smoothCache.set(geo, m);
  return m;
}

// Add an ink outline to a mesh (or InstancedMesh). Returns the outline mesh.
export function ink(mesh, width = 2.5, opts = {}) {
  const geo = opts.raw ? mesh.geometry : smoothedGeometry(mesh.geometry);
  const mat = inkMaterial(width, opts);
  let o;
  if (mesh.isInstancedMesh) {
    o = new THREE.InstancedMesh(geo, mat, mesh.count);
    o.instanceMatrix = mesh.instanceMatrix;
    o.frustumCulled = false;
  } else {
    o = new THREE.Mesh(geo, mat);
  }
  o.name = (mesh.name || 'mesh') + ':ink';
  o.renderOrder = mesh.renderOrder;
  o.userData.isInk = true;
  mesh.add(o);
  // For InstancedMesh children inherit parent transform, but instance matrices are already relative to parent.
  return o;
}

// Convenience: mesh with cel material and optional ink.
export function part(geo, mat, inkWidth = 2.5, inkOpts) {
  const m = new THREE.Mesh(geo, mat);
  if (inkWidth > 0) ink(m, inkWidth, inkOpts);
  return m;
}
