// Film post chain: shot render (with transitions) -> bloom -> anamorphic streaks -> final film grade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { HASH } from './glsl.js';

const quadVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// ---------- transitions between two rendered shots ----------
const transFrag = /* glsl */ `
  ${HASH}
  uniform sampler2D tA, tB;
  uniform float uMix;   // 0 = A, 1 = B
  uniform int uType;    // 0 dissolve, 1 glow dissolve, 2 iris, 3 wipe-right, 4 white flash through
  uniform vec2 uRes;
  varying vec2 vUv;
  void main() {
    vec4 a = texture2D(tA, vUv);
    vec4 b = texture2D(tB, vUv);
    vec4 c;
    if (uType == 0) {
      c = mix(a, b, smoothstep(0.0, 1.0, uMix));
    } else if (uType == 1) {
      float m = smoothstep(0.0, 1.0, uMix);
      float glowAmt = sin(m * 3.14159);
      c = mix(a, b, m) + vec4(vec3(1.0, 0.85, 0.55) * glowAmt * 0.42, 0.0);
    } else if (uType == 2) {
      vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float r = length(p);
      float R = mix(0.0, 1.6, uMix);
      c = mix(a, b, smoothstep(R, R - 0.01, r));
    } else if (uType == 3) {
      float edge = mix(-0.15, 1.15, uMix);
      float x = vUv.x + 0.08 * sin(vUv.y * 9.0);
      float k = smoothstep(edge + 0.05, edge - 0.05, x);
      c = mix(a, b, k) + vec4(vec3(1.0, 0.9, 0.6) * (1.0 - abs(x - edge) * 12.0) * step(abs(x - edge), 0.08) * 0.8, 0.0);
    } else {
      float w = 1.0 - abs(uMix * 2.0 - 1.0);
      c = (uMix < 0.5 ? a : b) + vec4(vec3(w * w * 3.0), 0.0);
    }
    gl_FragColor = c;
  }
`;

export class ShotPass extends Pass {
  constructor(W, H) {
    super();
    this.needsSwap = false;
    const opts = { type: THREE.HalfFloatType, samples: 4 };
    this.rtA = new THREE.WebGLRenderTarget(W, H, opts);
    this.rtB = new THREE.WebGLRenderTarget(W, H, opts);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uType: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) } },
      vertexShader: quadVert, fragmentShader: transFrag, depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
    this.job = null; // { a: renderFn, b?: renderFn, mix, type }
  }
  render(renderer, writeBuffer, readBuffer) {
    const job = this.job;
    if (!job) return;
    if (!job.b) {
      job.a(renderer, readBuffer);
      if (job.after) job.after();
      return;
    }
    job.a(renderer, this.rtA);
    job.b(renderer, this.rtB);
    if (job.after) job.after();
    this.mat.uniforms.tA.value = this.rtA.texture;
    this.mat.uniforms.tB.value = this.rtB.texture;
    this.mat.uniforms.uMix.value = job.mix;
    this.mat.uniforms.uType.value = job.type || 0;
    renderer.setRenderTarget(readBuffer);
    this.quad.render(renderer);
  }
  setSize(W, H) { this.rtA.setSize(W, H); this.rtB.setSize(W, H); }
}

// ---------- anamorphic horizontal streaks ----------
const brightFrag = /* glsl */ `
  uniform sampler2D tDiffuse; uniform float uThresh; varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(uThresh, uThresh * 1.6 + 0.2, l), 1.0);
  }`;
const streakFrag = /* glsl */ `
  uniform sampler2D tDiffuse; uniform float uStep; uniform vec2 uTexel; varying vec2 vUv;
  void main(){
    vec3 s = vec3(0.0); float wsum = 0.0;
    for (int i = -12; i <= 12; i++) {
      float fi = float(i);
      float w = exp(-abs(fi) * 0.22);
      s += texture2D(tDiffuse, vUv + vec2(fi * uStep * uTexel.x, 0.0)).rgb * w;
      wsum += w;
    }
    gl_FragColor = vec4(s / wsum * 1.8, 1.0);
  }`;

export class StreakPass extends Pass {
  constructor(W, H) {
    super();
    this.needsSwap = false;
    const w = Math.round(W / 4), h = Math.round(H / 8);
    const o = { type: THREE.HalfFloatType };
    this.rt1 = new THREE.WebGLRenderTarget(w, h, o);
    this.rt2 = new THREE.WebGLRenderTarget(w, h, o);
    this.bright = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uThresh: { value: 1.0 } }, vertexShader: quadVert, fragmentShader: brightFrag }));
    this.blurMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uStep: { value: 1 }, uTexel: { value: new THREE.Vector2(1 / w, 1 / h) } }, vertexShader: quadVert, fragmentShader: streakFrag });
    this.blur = new FullScreenQuad(this.blurMat);
    this.texture = this.rt1.texture;
    this.threshold = 1.0;
  }
  render(renderer, writeBuffer, readBuffer) {
    this.bright.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.bright.material.uniforms.uThresh.value = this.threshold;
    renderer.setRenderTarget(this.rt1); this.bright.render(renderer);
    const steps = [1, 4, 12];
    let src = this.rt1, dst = this.rt2;
    for (const s of steps) {
      this.blurMat.uniforms.tDiffuse.value = src.texture;
      this.blurMat.uniforms.uStep.value = s;
      renderer.setRenderTarget(dst); this.blur.render(renderer);
      [src, dst] = [dst, src];
    }
    this.texture = src.texture;
  }
}

// ---------- final film look ----------
const finalFrag = /* glsl */ `
  ${HASH}
  uniform sampler2D tDiffuse;
  uniform sampler2D tStreak;
  uniform vec2 uRes;
  uniform float uFrame;
  uniform float uExposure, uContrast, uSat, uVignette, uGrain, uWeave, uCA, uStreak, uFade, uFlash, uDust;
  uniform vec3 uLift, uGain, uStreakTint, uFlashColor;
  uniform vec2 uFlarePos; uniform float uFlare; uniform vec3 uFlareTint;
  uniform vec2 uIrisC; uniform float uIrisR;
  uniform float uBars;
  varying vec2 vUv;

  vec3 toSRGB(vec3 c) {
    c = max(c, 0.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  float flareRing(vec2 p, vec2 c, float r, float w) { float d = length(p - c); return smoothstep(r + w, r, d) * smoothstep(r - w * 3.0, r, d); }
  float flareDisc(vec2 p, vec2 c, float r) { return smoothstep(r, r * 0.6, length(p - c)); }

  void main() {
    vec2 uv = vUv;
    // gate weave: slow sub-pixel drift
    float f = uFrame;
    vec2 weave = vec2(sin(f * 0.37) + 0.5 * sin(f * 1.13 + 1.7), cos(f * 0.29) + 0.5 * sin(f * 0.91)) * uWeave / uRes;
    uv += weave;
    // chromatic aberration (radial)
    vec2 dc = uv - 0.5;
    float ca = uCA * dot(dc, dc);
    vec3 c;
    c.r = texture2D(tDiffuse, uv - dc * ca).r;
    c.g = texture2D(tDiffuse, uv).g;
    c.b = texture2D(tDiffuse, uv + dc * ca).b;
    // anamorphic streaks
    c += texture2D(tStreak, uv).rgb * uStreakTint * uStreak;
    // lens flare ghosts (80s)
    if (uFlare > 0.0) {
      vec2 asp = vec2(uRes.x / uRes.y, 1.0);
      vec2 p = (uv - 0.5) * asp;
      vec2 s = (uFlarePos - 0.5) * asp;
      vec3 fl = vec3(0.0);
      fl += vec3(1.0, 0.55, 0.25) * flareDisc(p, s * -0.35, 0.05) * 0.25;
      fl += vec3(0.4, 1.0, 0.6) * flareRing(p, s * -0.6, 0.11, 0.008) * 0.35;
      fl += vec3(0.5, 0.6, 1.0) * flareDisc(p, s * 0.45, 0.025) * 0.35;
      fl += vec3(1.0, 0.4, 0.9) * flareRing(p, s * -1.05, 0.2, 0.012) * 0.22;
      fl += vec3(1.0, 0.8, 0.4) * flareDisc(p, s * 0.2, 0.012) * 0.5;
      float hl = exp(-abs(p.y - s.y) * 90.0) * exp(-abs(p.x - s.x) * 1.6);
      fl += vec3(0.45, 0.65, 1.0) * hl * 0.9;
      c += fl * uFlare * uFlareTint;
    }
    c *= uExposure;
    c = toSRGB(c);
    // grade
    c = uGain * (c + uLift * (1.0 - c));
    c = (c - 0.5) * uContrast + 0.5;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, uSat);
    // vignette
    vec2 q = vUv - 0.5;
    q.x *= uRes.x / uRes.y * 0.75;
    c *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(q));
    // dust specks + rare scratch
    if (uDust > 0.0) {
      float fr = floor(f);
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 pos = vec2(hash11(fr * 1.31 + fi * 7.7), hash11(fr * 2.17 + fi * 3.3));
        float r = (0.0015 + 0.003 * hash11(fr + fi * 13.1));
        vec2 dp = (vUv - pos) * vec2(uRes.x / uRes.y, 1.0);
        float sp = smoothstep(r, r * 0.3, length(dp * vec2(1.0, 1.0 + 2.0 * hash11(fr * 5.0 + fi))));
        float on = step(0.55, hash11(fr * 0.71 + fi * 21.0));
        c = mix(c, vec3(0.05, 0.04, 0.03), sp * on * uDust * 0.8);
      }
      float sx = hash11(floor(f / 3.0) * 4.1);
      float scr = step(0.93, hash11(floor(f / 3.0) * 9.7)) * smoothstep(0.0012, 0.0, abs(vUv.x - sx - 0.002 * sin(vUv.y * 30.0)));
      c = mix(c, vec3(0.9, 0.88, 0.8), scr * uDust * 0.35);
    }
    // grain (luma weighted)
    float g = hash12(vUv * uRes + fract(f * 0.6180339) * 1000.0) - 0.5;
    float g2 = hash12(vUv * uRes * 0.5 + fract(f * 0.4142) * 1000.0) - 0.5;
    float lg = dot(c, vec3(0.333));
    c += (g * 0.7 + g2 * 0.6) * uGrain * (0.45 + 0.55 * (1.0 - abs(lg - 0.45) * 1.6));
    // flash + fade
    c = mix(c, uFlashColor, clamp(uFlash, 0.0, 1.0));
    c *= 1.0 - uFade;
    // iris (90s cartoon iris-out); radius in screen heights, 2 = fully open
    if (uIrisR < 1.9) {
      vec2 ip = (vUv - uIrisC) * vec2(uRes.x / uRes.y, 1.0);
      c *= smoothstep(uIrisR, uIrisR - 0.004, length(ip));
    }
    // extra letterbox bars (fraction of height each side)
    if (uBars > 0.0) { c *= step(uBars, vUv.y) * step(vUv.y, 1.0 - uBars); }
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }
`;

export function createPost(renderer, W, H) {
  const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  const shotPass = new ShotPass(W, H);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.5, 0.9);
  const streak = new StreakPass(W, H);
  const finalMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null }, tStreak: { value: null }, uRes: { value: new THREE.Vector2(W, H) }, uFrame: { value: 0 },
      uExposure: { value: 1 }, uContrast: { value: 1.05 }, uSat: { value: 1.08 }, uVignette: { value: 0.35 }, uGrain: { value: 0.05 },
      uWeave: { value: 0.6 }, uCA: { value: 0.012 }, uStreak: { value: 0.5 }, uFade: { value: 0 }, uFlash: { value: 0 }, uDust: { value: 0.6 },
      uLift: { value: new THREE.Vector3(0.02, 0.01, 0.04) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uStreakTint: { value: new THREE.Vector3(0.45, 0.65, 1.0) }, uFlashColor: { value: new THREE.Vector3(1, 1, 1) },
      uFlarePos: { value: new THREE.Vector2(0.5, 0.5) }, uFlare: { value: 0 }, uFlareTint: { value: new THREE.Vector3(1, 1, 1) },
      uIrisC: { value: new THREE.Vector2(0.5, 0.5) }, uIrisR: { value: 2.0 }, uBars: { value: 0 },
    },
    vertexShader: quadVert,
    fragmentShader: finalFrag,
    depthTest: false, depthWrite: false,
  });
  class FinalPass extends Pass {
    constructor() { super(); this.quad = new FullScreenQuad(finalMat); this.uniforms = finalMat.uniforms; }
    render(renderer, writeBuffer, readBuffer) {
      finalMat.uniforms.tDiffuse.value = readBuffer.texture;
      finalMat.uniforms.tStreak.value = streak.texture;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.quad.render(renderer);
    }
  }
  const final = new FinalPass();
  composer.addPass(shotPass);
  composer.addPass(bloom);
  composer.addPass(streak);
  composer.addPass(final);
  return { composer, shotPass, bloom, streak, final, F: finalMat.uniforms };
}

// Default look parameters; shots override a subset each frame.
export const LOOK_DEFAULTS = {
  bloom: 0.6, bloomRadius: 0.5, bloomThreshold: 0.85,
  streak: 0.35, streakThreshold: 1.0, streakTint: [0.45, 0.65, 1.0],
  exposure: 1.0, contrast: 1.05, sat: 1.1, vignette: 0.35, grain: 0.045, weave: 0.6, ca: 0.012, dust: 0.5,
  lift: [0.02, 0.012, 0.04], gain: [1, 1, 1],
  flare: 0, flarePos: [0.5, 0.5], flareTint: [1, 1, 1],
  fade: 0, flash: 0, flashColor: [1, 1, 1], irisC: [0.5, 0.5], irisR: 2.0, bars: 0,
};
