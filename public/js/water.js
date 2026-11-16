// Undernite – wie Licht sich im Wasser verhält.
//
// 1) Farben verschwinden mit der Entfernung. Wasser schluckt Rot sehr schnell, Grün langsamer, Blau am langsamsten.
//    Darum wirkt unter Wasser alles in der Ferne blau-grün, und ein rotes Riff sieht aus 10 m Entfernung braun aus.
//    absorb = wie schnell Rot, Grün, Blau verschwinden (größer = schneller weg)
//    haze   = wie stark der Nebel je Farbe zunimmt (Rot wird früher vom Wasser verschluckt)
//    Das gilt automatisch für ALLES, was einen Nebel hat (Riff, Fische, Taucher, Boden …).
//
// 2) Meeresschnee: winzige Schwebeteilchen, die im Lampenlicht aufblitzen – wie in jedem echten Tieftauch-Video.
//    count = wie viele, radius = in welchem Umkreis um dich (Meter), size = Größe, lit = wie hell im Lampenkegel,
//    dark = wie gut man sie ohne Licht sieht (in der Tiefsee fast gar nicht)
import * as THREE from 'three';

export const WATER = { absorb: [3.6, 0.95, 0.4], haze: [1.25, 1.0, 0.9] };
export const SNOW = { count: 2600, radius: 32, size: 0.07, lit: 3.2, dark: 0.12 };

// Die Nebel-Formel von three.js wird ersetzt: statt einer Zahl für alle Farben gibt es eine pro Farbe.
// Je dichter der Nebel (fogDensity), desto stärker schluckt das Wasser – über Wasser (dünner Nebel) fast gar nicht.
const v3 = (a) => `vec3(${a.map(x => x.toFixed(3)).join(', ')})`;
THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    vec3 fogD = fogDensity * ${v3(WATER.haze)} * vFogDepth;
    vec3 fogF = 1.0 - exp( - fogD * fogD );
    // Farbe geht auf dem Weg durchs Wasser verloren (Rot zuerst)
    gl_FragColor.rgb *= exp( - vFogDepth * fogDensity * ${v3(WATER.absorb)} );
  #else
    vec3 fogF = vec3( smoothstep( fogNear, fogFar, vFogDepth ) );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogF );
#endif`;

// Meeresschnee-Material: jedes Teilchen fragt, ob es im Lichtkegel der Lampe liegt.
export function makeSnowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLampPos: { value: new THREE.Vector3() }, uLampDir: { value: new THREE.Vector3(0, 0, -1) },
      uLampCos: { value: 0.94 }, uLampRange: { value: 60 }, uLampOn: { value: 0 },
      uDark: { value: SNOW.dark }, uLit: { value: SNOW.lit }, uScale: { value: 500 }, uSize: { value: SNOW.size },
      uFogDensity: { value: 0.02 },
    },
    vertexShader: `
      uniform vec3 uLampPos, uLampDir; uniform float uLampCos, uLampRange, uLampOn, uDark, uLit, uScale, uSize, uFogDensity;
      varying float vB;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * wp;
        vec3 L = wp.xyz - uLampPos; float d = length(L);
        float cone = smoothstep(uLampCos, mix(uLampCos, 1.0, 0.35), dot(L / max(d, 0.001), uLampDir));
        float fall = clamp(1.0 - d / uLampRange, 0.0, 1.0);
        float lit = cone * fall * fall * uLampOn;
        // Teilchen flackern leicht (jedes anders), weil sie sich drehen und das Licht unterschiedlich zurückwerfen
        float tw = 0.6 + 0.4 * fract(sin(dot(position.xz, vec2(12.99, 78.23))) * 43758.5);
        float far = exp(-(-mv.z) * uFogDensity * 1.4);
        float near = smoothstep(0.4, 1.6, -mv.z);   // ganz nah an der Kamera: ausblenden (sonst riesige Flecken)
        vB = (uDark + lit * uLit * tw) * far * near;
        gl_PointSize = min(uSize * uScale / max(-mv.z, 0.3) * (1.0 + lit * 0.6), 6.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vB;
      void main() {
        vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(c));
        gl_FragColor = vec4(vec3(0.86, 0.95, 1.0) * vB * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
}
