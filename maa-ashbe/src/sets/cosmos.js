// Shot 1: deep space, the title assembled from starlight, a golden comet, sunrise over Earth's limb.
import * as THREE from 'three';
import { makeSky } from '../core/sky.js';
import { starField, updatePointPx, morphCloud, glowSprite, sparkleTexture, toScreen, pointMaterial } from '../core/fx.js';
import { goldText, samplePoints, textPlane } from '../core/text.js';
import { SNOISE, HASH } from '../core/glsl.js';
import { keys, ease, sstep, clamp, mulberry32, lerp, window4 } from '../core/util.js';

function nebulaCloud(color1, color2, seed, size) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(color1) }, uB: { value: new THREE.Color(color2) }, uSeed: { value: seed }, uOpacity: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `${SNOISE}
      uniform float uTime, uSeed, uOpacity; uniform vec3 uA, uB; varying vec2 vUv;
      void main(){
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float n = fbm3(vec3(p * 3.0, uSeed + uTime * 0.01));
        float n2 = fbm3(vec3(p * 6.0 + 3.0, uSeed * 2.0));
        float d = smoothstep(1.0, 0.1, r + n * 0.6);
        vec3 c = mix(uA, uB, smoothstep(-0.3, 0.4, n2));
        float wisps = smoothstep(0.0, 0.6, n + 0.3) ;
        gl_FragColor = vec4(c * d * wisps * uOpacity, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  return m;
}

function planet(R) {
  const uniforms = { uSunDir: { value: new THREE.Vector3(0.25, -0.02, -1).normalize() }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vN; varying vec3 vW; varying vec3 vObj;
      void main(){ vObj = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${SNOISE} ${HASH}
      uniform vec3 uSunDir; uniform float uTime; varying vec3 vN; varying vec3 vW; varying vec3 vObj;
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        vec3 S = normalize(uSunDir);
        float ndl = dot(N, S);
        float land = smoothstep(0.0, 0.05, fbm3(vObj * 3.0 + vec3(1.0, 7.0, 3.0)));
        float mountains = smoothstep(0.35, 0.5, fbm3(vObj * 9.0)) * land;
        float clouds = smoothstep(0.05, 0.45, fbm3(vObj * 7.0 + vec3(uTime * 0.004, 0.0, 0.0)));
        vec3 ocean = vec3(0.02, 0.09, 0.28);
        vec3 ground = mix(vec3(0.12, 0.32, 0.12), vec3(0.42, 0.34, 0.2), smoothstep(0.1, 0.4, fbm3(vObj * 5.0)));
        ground = mix(ground, vec3(0.95), mountains * 0.9);
        vec3 day = mix(ocean, ground, land);
        day = mix(day, vec3(1.0, 0.97, 0.94), clouds * 0.85);
        vec3 night = mix(vec3(0.008, 0.015, 0.05), vec3(0.015, 0.02, 0.04), land);
        night = mix(night, vec3(0.05, 0.07, 0.13), clouds * 0.6);
        // city lights
        vec3 cell = floor(vObj * 260.0);
        float h = hash13(cell);
        vec3 f = fract(vObj * 260.0) - 0.5;
        float city = step(0.86, h) * smoothstep(0.3, 0.0, length(f)) * land * (1.0 - clouds * 0.8);
        city *= 0.6 + 0.4 * sin(uTime * 2.0 + h * 50.0);
        night += vec3(1.0, 0.62, 0.25) * city * 2.2;
        float lit = smoothstep(-0.04, 0.04, ndl);
        vec3 col = mix(night, day * 1.15, lit);
        // warm terminator band
        col += vec3(1.0, 0.45, 0.15) * exp(-abs(ndl) * 18.0) * 0.5;
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 atmo = mix(vec3(0.15, 0.35, 1.0), vec3(1.0, 0.6, 0.25), smoothstep(-0.2, 0.25, ndl) * smoothstep(0.6, 1.0, dot(-V, S) * 0.5 + 0.5));
        col += atmo * fres * (0.25 + 0.55 * smoothstep(-0.25, 0.2, ndl));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120), mat);
  uniforms.uCenter = { value: new THREE.Vector3() };
  uniforms.uR = { value: R };
  const atmoMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uSunDir; uniform vec3 uCenter; uniform float uR; varying vec3 vW;
      void main(){
        vec3 O = cameraPosition; vec3 D = normalize(vW - O);
        vec3 OC = uCenter - O;
        float tca = dot(OC, D);
        vec3 closest = O + D * tca;
        float h = length(closest - uCenter);
        float alt = (h - uR) / (uR * 0.035);
        float glow = exp(-max(alt, 0.0) * 5.0) * (1.0 - smoothstep(0.75, 1.0, alt));
        vec3 n = normalize(closest - uCenter);
        vec3 S = normalize(uSunDir);
        float sunSide = smoothstep(-0.45, 0.3, dot(n, S));
        float toward = pow(max(dot(D, S), 0.0), 24.0);
        vec3 c = mix(vec3(0.12, 0.32, 1.0), vec3(1.0, 0.58, 0.22), clamp(sunSide * 0.75 + toward, 0.0, 1.0));
        gl_FragColor = vec4(c * glow * (0.35 + 0.55 * sunSide + 1.2 * toward), 1.0);
      }`,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 160, 120), atmoMat);
  const g = new THREE.Group();
  g.add(mesh, atmo);
  g.uniforms = uniforms;
  return g;
}

export async function buildCosmos(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, ctx.aspect, 0.5, 6000);

  const sky = makeSky({
    zenith: 0x02020a, mid: 0x050414, horizon: 0x0a0720, ground: 0x050410, midH: 0.4,
    stars: 1.2, starScale: 420, starDensity: 0.25, starHorizon: -1,
    nebula: 1.1, nebA: 0x5a1f8a, nebB: 0x1d6f9a, nebAxis: [0.35, 1, 0.25], nebScale: 1.8, nebWidth: 0.45,
  });
  scene.add(sky);

  const stars = starField({ count: 16000, radius: 1400, inner: 30, seed: 11, sizeMin: 0.35, sizeMax: 3.2 });
  scene.add(stars);
  const brights = starField({ count: 260, radius: 900, inner: 120, seed: 5, sizeMin: 2.5, sizeMax: 6.5, colors: [[1, 0.95, 0.85], [0.8, 0.9, 1], [1, 0.8, 0.6]] });
  scene.add(brights);

  const neb1 = nebulaCloud(0x7a2a9a, 0x2a7ab0, 1.3, 900); neb1.position.set(-260, 120, -700); neb1.lookAt(0, 0, 300);
  const neb2 = nebulaCloud(0xb03a6a, 0x5030a0, 4.1, 700); neb2.position.set(320, -60, -500); neb2.lookAt(0, 0, 300);
  const neb3 = nebulaCloud(0x2060a0, 0x60c0c0, 7.7, 600); neb3.position.set(40, 260, -900); neb3.lookAt(0, 0, 300);
  [neb1, neb2, neb3].forEach((n) => { n.material.uniforms.uOpacity.value = 0.55; scene.add(n); });

  // ---- title: মা আসবে assembled from starlight ----
  const title = goldText('মা আসবে', { font: 'Galada', size: 300, pad: 90, strokeW: 16, glowBlur: 50 });
  const tW = 80, tH = tW / title.aspect;
  const titleZ = 60;
  const titleMesh = textPlane(title, tH);
  titleMesh.position.set(0, 4, titleZ);
  titleMesh.material.opacity = 0;
  scene.add(titleMesh);
  titleMesh.material.color.setScalar(0.82);
  const titleGlow = glowSprite(0xffa040, 120, 0.0);
  titleGlow.position.set(0, 4, titleZ - 5);
  scene.add(titleGlow);

  const N = 5200;
  const pts = samplePoints(title.mask, N, 9, 160);
  const rnd = mulberry32(42);
  const starts = [], ends = [], delays = [], sizes = [], colors = [], seeds = [];
  for (let i = 0; i < N; i++) {
    const u = pts[i * 2], v = pts[i * 2 + 1];
    ends.push((u - 0.5) * tW, 4 + (v - 0.5) * tH, titleZ + (rnd() - 0.5) * 1.5);
    const a = rnd() * Math.PI * 2, r = 60 + rnd() * 260;
    starts.push(Math.cos(a) * r, Math.sin(a) * r * 0.6, titleZ - 100 - rnd() * 500);
    delays.push(rnd() * 0.45);
    sizes.push(0.18 + rnd() * rnd() * 0.5);
    const warm = rnd();
    colors.push(1.0, 0.65 + 0.3 * warm, 0.25 + 0.4 * warm * warm);
    seeds.push(rnd());
  }
  const titleDust = morphCloud({ starts, ends, delays, sizes, colors, seeds });
  titleDust.material.uniforms.uDrift.value.set(0, -40, -30);
  scene.add(titleDust);

  // ---- golden comet (Uma's light) ----
  const comet = new THREE.Group();
  const cHead = glowSprite(0xffd27a, 18, 2.2);
  const cCore = glowSprite(0xffffff, 6, 3.0, sparkleTexture());
  comet.add(cHead, cCore);
  scene.add(comet);
  const TRAIL = 220;
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const tcol = new Float32Array(TRAIL * 3), tsz = new Float32Array(TRAIL), tsd = new Float32Array(TRAIL);
  for (let i = 0; i < TRAIL; i++) { const k = 1 - i / TRAIL; tcol.set([1.0 * k, (0.7 + 0.2 * k) * k, (0.3 + 0.5 * k * k) * k], i * 3); tsz[i] = 2.6 * Math.pow(k, 1.5) + 0.2; tsd[i] = (i * 0.618) % 1; }
  tg.setAttribute('aColor', new THREE.BufferAttribute(tcol, 3));
  tg.setAttribute('aSize', new THREE.BufferAttribute(tsz, 1));
  tg.setAttribute('aSeed', new THREE.BufferAttribute(tsd, 1));
  const trail = new THREE.Points(tg, pointMaterial({ twinkle: 0.3, maxPx: 60 }));
  trail.frustumCulled = false;
  scene.add(trail);

  // ---- Earth ----
  const R = 1000;
  const earth = planet(R);
  earth.position.set(0, -1080, -900);
  earth.uniforms.uCenter.value.copy(earth.position);
  scene.add(earth);
  const sunPos = new THREE.Vector3();

  function cometPath(u, p0, p1, p2) {
    // quadratic bezier
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    return new THREE.Vector3(a * p0.x + b * p1.x + c * p2.x, a * p0.y + b * p1.y + c * p2.y, a * p0.z + b * p1.z + c * p2.z);
  }
  function placeComet(u, P) {
    const head = cometPath(clamp(u, 0, 1), ...P);
    comet.position.copy(head);
    const arr = tg.attributes.position.array;
    for (let i = 0; i < TRAIL; i++) {
      const uu = clamp(u - i * 0.0016, 0, 1);
      const p = cometPath(uu, ...P);
      const jitter = i * 0.012;
      arr[i * 3] = p.x + Math.sin(i * 1.7) * jitter;
      arr[i * 3 + 1] = p.y + Math.cos(i * 2.3) * jitter;
      arr[i * 3 + 2] = p.z;
    }
    tg.attributes.position.needsUpdate = true;
  }

  function common(T) {
    for (const p of [stars, brights, trail, titleDust]) {
      p.material.uniforms.uTime.value = T;
      updatePointPx(p.material, camera, ctx.H);
    }
    [neb1, neb2, neb3].forEach((n) => (n.material.uniforms.uTime.value = T));
    earth.uniforms.uTime.value = T;
  }

  const shots = {
    open(lt, T, dur) {
      camera.fov = 28; camera.updateProjectionMatrix();
      const z = keys(lt, [[0, 330], [dur, 205, ease.linear]]);
      camera.position.set(Math.sin(lt * 0.15) * 2, 2 + Math.sin(lt * 0.11) * 1, z);
      camera.lookAt(0, 2, -400);
      camera.rotateZ(keys(lt, [[0, 0.04], [dur, -0.02, ease.linear]]));
      // title assembly
      const prog = keys(lt, [[1.0, 0], [5.0, 1, ease.inOut2]]);
      const u = titleDust.material.uniforms;
      u.uProg.value = prog;
      u.uSwirl.value = 6;
      u.uScatter.value = keys(lt, [[6.6, 0], [dur + 0.5, 1, ease.in2]]);
      u.uOpacity.value = 1;
      const tOn = window4(lt, 4.2, 5.2, 6.6, 8.0);
      titleMesh.material.opacity = tOn;
      titleGlow.material.color.setRGB(1.0, 0.55, 0.2).multiplyScalar(0.12 * tOn + 0.1 * sstep(3, 5, lt) * (1 - sstep(7, 8.5, lt)));
      // comet streak across the top late in the shot
      const cu = keys(lt, [[6.4, 0], [dur, 0.62, ease.linear]]);
      comet.visible = trail.visible = lt > 6.4;
      placeComet(cu, [new THREE.Vector3(-260, 120, -150), new THREE.Vector3(-40, 60, 40), new THREE.Vector3(160, -40, 100)]);
      earth.visible = false;
      common(T);
      return {
        bloom: 0.75, bloomRadius: 0.55, bloomThreshold: 0.8, streak: 0.4, streakThreshold: 0.95,
        vignette: 0.5, grain: 0.05, lift: [0.01, 0.0, 0.03], sat: 1.15, contrast: 1.08,
        fade: 1 - sstep(0, 1.6, lt),
        flash: 0.12 * window4(lt, 4.6, 5.0, 5.0, 5.8),
        flashColor: [1, 0.85, 0.5],
      };
    },
    earth(lt, T, dur) {
      camera.fov = 30; camera.updateProjectionMatrix();
      earth.visible = true;
      titleMesh.material.opacity = 0;
      titleGlow.material.color.setRGB(0, 0, 0);
      titleDust.material.uniforms.uOpacity.value = 0;
      const pitch = keys(lt, [[0, 0.42], [3.6, 0.0, ease.inOut3], [dur, -0.02, ease.linear]]);
      camera.position.set(0, keys(lt, [[0, 0], [dur, -18]]), keys(lt, [[0, 0], [dur, -40]]));
      camera.rotation.set(pitch, keys(lt, [[0, 0.06], [dur, -0.02]]), 0.0, 'YXZ');
      // sun just behind the limb, rising
      const sunDir = new THREE.Vector3(0.28, keys(lt, [[0, -0.095], [dur, -0.035]]), -1).normalize();
      earth.uniforms.uSunDir.value.copy(sunDir);
      sky.set('uSunDir', sunDir.toArray());
      sky.set('uSunGlow', 0.5); sky.set('uSunGlowPow', 600); sky.set('uSunHalo', 0.12); sky.set('uSunHaloPow', 30); sky.set('uSunDisc', 0); sky.set('uSunColor', 0xffb060);
      sunPos.copy(camera.position).addScaledVector(sunDir, 3000);
      const sp = toScreen(sunPos, camera) || [0.6, 0.3];
      // comet dives to the planet (towards the Himalaya)
      comet.visible = trail.visible = true;
      const cu = keys(lt, [[0, 0.2], [dur, 1.0, ease.in2]]);
      placeComet(cu, [new THREE.Vector3(-300, 260, -500), new THREE.Vector3(-60, 60, -420), new THREE.Vector3(60, -120, -620)]);
      common(T);
      const sunUp = sstep(1.5, 5.5, lt);
      return {
        bloom: 0.7, bloomRadius: 0.6, bloomThreshold: 0.75, streak: 0.6, streakThreshold: 0.9,
        vignette: 0.45, grain: 0.05, sat: 1.15, contrast: 1.08, exposure: 0.95,
        flare: 0.6 * sunUp, flarePos: sp, flareTint: [1, 0.85, 0.65],
        flash: 0.15 * sstep(dur - 0.5, dur, lt), flashColor: [1, 0.85, 0.55],
      };
    },
  };
  return { scene, camera, sky, shots };
}
