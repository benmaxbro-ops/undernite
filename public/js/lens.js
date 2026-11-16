// Undernite – Bodycam-Linse: das fertige Bild wird so verändert, als käme es aus einer echten Körperkamera.
//   distort  = Fischauge: die Mitte wird größer, der Rand gewölbt (0 = aus, 0.3 = sehr stark)
//   chroma   = Farbsäume am Rand: Rot und Blau laufen auseinander (0 = aus, 0.03 = stark)
//   vignette = dunkler, runder Rand (0 = aus, 1 = stark)
//   grain    = Filmkorn: feines Rauschen (0 = aus, 0.08 = stark)
//   glare    = helle Stellen bluten leicht aus (wie überbelichtet), 0 = aus
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const LENS = { distort: 0.16, chroma: 0.014, vignette: 0.9, grain: 0.035, glare: 0.12 };

const LensShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 16 / 9 },
    uDistort: { value: LENS.distort }, uChroma: { value: LENS.chroma }, uVig: { value: LENS.vignette }, uGrain: { value: LENS.grain }, uGlare: { value: LENS.glare },
  },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uAspect, uDistort, uChroma, uVig, uGrain, uGlare; varying vec2 vUv;
    // Fischauge: jeder Bildpunkt holt seine Farbe etwas weiter außen → der Rand wird zusammengedrückt (gewölbt)
    vec2 warp(vec2 uv, float k) {
      vec2 p = uv * 2.0 - 1.0; p.x *= uAspect;
      float r2 = dot(p, p);
      p *= (1.0 + k * r2) / (1.0 + k * uAspect * uAspect);   // so skaliert, dass links und rechts genau passen
      p.x /= uAspect; return p * 0.5 + 0.5;
    }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv * 2.0 - 1.0; c.x *= uAspect;
      float r = length(c) / length(vec2(uAspect, 1.0));          // 0 in der Mitte, 1 in der Ecke
      // Farbsäume: Rot etwas stärker gewölbt, Blau etwas schwächer – nur am Rand sichtbar
      float ca = uChroma * r * r * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, warp(vUv, uDistort + ca)).r;
      col.g = texture2D(tDiffuse, warp(vUv, uDistort)).g;
      col.b = texture2D(tDiffuse, warp(vUv, uDistort - ca)).b;
      // helle Stellen bluten etwas aus (billiger Kamerasensor)
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col += col * smoothstep(0.55, 1.0, l) * uGlare;
      // runder dunkler Rand
      float v = smoothstep(1.02, 0.5, r);
      col *= mix(1.0, v, uVig);
      // Filmkorn, jedes Bild anders
      float n = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime * 7.31) * 100.0) - 0.5;
      col += n * uGrain * (0.6 + 0.4 * (1.0 - l));
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function makeLensPass() {
  const pass = new ShaderPass(LensShader);
  pass.tick = (t, aspect) => {
    const u = pass.uniforms;
    u.uTime.value = t; u.uAspect.value = aspect;
    u.uDistort.value = LENS.distort; u.uChroma.value = LENS.chroma; u.uVig.value = LENS.vignette; u.uGrain.value = LENS.grain; u.uGlare.value = LENS.glare;
  };
  return pass;
}
