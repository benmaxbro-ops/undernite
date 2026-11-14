// Undernite - realistic procedural sea creatures.
// Bodies are lofted from cross-sections (like a ship hull), coloured per vertex
// (dark back, light belly, stripes, spots, gills) and animated with a swimming
// wave in the vertex shader, so the whole body bends like a real fish.
// Forward is -z for every model. Body units: the body runs from z = -stretch to +stretch.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
const sst = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// smooth curve through keys [[t, value], ...]
function spline(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0; while (t > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)][1], p1 = keys[i][1], p2 = keys[i + 1][1], p3 = keys[Math.min(n - 1, i + 2)][1];
  const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
}

// ---------- geometry helpers ----------
// Body: rings along t (0 = nose, 1 = tail). color(t, u, v) -> THREE.Color, u = side (cos), v = up (sin)
function loft(P, stretch, color, rings = 34, seg = 18) {
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, w = Math.max(0, spline(P.w, t)), h = Math.max(0, spline(P.h, t)), yc = spline(P.y, t), z = (-1 + 2 * t) * stretch;
    for (let j = 0; j < seg; j++) {
      const a = j / seg * TAU, u = Math.cos(a), v = Math.sin(a);
      pos.push(u * w, yc + v * h, z);
      const c = color(t, u, v); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + (j + 1) % seg, c = a + seg, d = b + seg;
    idx.push(a, c, b, b, c, d);
  }
  // close the tail end
  const last = rings * seg, cz = (pos[last * 3 + 2]), cy = spline(P.y, 1);
  pos.push(0, cy, cz + 0.001); const lc = color(1, 0, 0); col.push(lc.r, lc.g, lc.b);
  for (let j = 0; j < seg; j++) idx.push(last + j, last + (j + 1) % seg, rings * seg + seg);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Flat fin: polygon points [a, b] mapped to 3D by map(a, b) -> [x, y, z]; fan from the first point.
function fin(points, map, color) {
  const pos = [], col = [];
  const P = points.map(([a, b]) => map(a, b));
  for (let i = 1; i < P.length - 1; i++) {
    for (const p of [P[0], P[i], P[i + 1]]) { pos.push(...p); col.push(color.r, color.g, color.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function merge(geos) {
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); col.set(g.attributes.color.array, o);
    o += g.attributes.position.count * 3;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return m;
}
// Material with a swimming wave. Each creature gets its own copy (own uniforms),
// the GPU program is shared through customProgramCacheKey.
function swimMat(o) {
  const u = { uPh: { value: 0 }, uAmp: { value: o.amp }, uK: { value: o.k }, uZ0: { value: o.z0 }, uLen: { value: o.len } };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough ?? 0.45, metalness: o.metal ?? 0.15, side: THREE.DoubleSide,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 0, flatShading: !!o.flat });
  const wave = o.ray
    ? 'float bt = clamp(abs(transformed.x) / uLen, 0.0, 1.5); transformed.y += sin(uPh - bt * uK) * uAmp * bt * bt;'
    : 'float bt = clamp((transformed.z - uZ0) / uLen, 0.0, 1.0); transformed.x += sin(uPh - bt * uK) * uAmp * bt * bt;';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uPh, uAmp, uK, uZ0, uLen;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + wave);
  };
  m.customProgramCacheKey = () => (o.ray ? 'swim-ray' : 'swim') + (o.flat ? '-flat' : '');
  m.userData.u = u;
  return m;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...o });
const glowM = (color, i = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.3 });
const SPH = new THREE.SphereGeometry(1, 14, 10), CONE = new THREE.ConeGeometry(1, 1, 6), CYL = new THREE.CylinderGeometry(1, 1, 1, 6);
function put(parent, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; }

// ---------- body shapes (half width w, half height h, centre y) ----------
const BODY = {
  fusiform: { w: [[0, 0], [0.05, 0.13], [0.22, 0.25], [0.5, 0.24], [0.8, 0.11], [0.93, 0.05], [1, 0.05]], h: [[0, 0], [0.05, 0.15], [0.25, 0.33], [0.5, 0.3], [0.8, 0.13], [0.93, 0.07], [1, 0.08]], y: [[0, -0.03], [0.3, 0], [1, 0]] },
  tuna:     { w: [[0, 0], [0.05, 0.15], [0.25, 0.33], [0.5, 0.33], [0.78, 0.14], [0.9, 0.05], [1, 0.04]], h: [[0, 0], [0.05, 0.17], [0.28, 0.4], [0.52, 0.38], [0.8, 0.14], [0.9, 0.06], [1, 0.07]], y: [[0, -0.03], [0.3, 0], [1, 0]] },
  tall:     { w: [[0, 0], [0.06, 0.08], [0.3, 0.13], [0.6, 0.11], [0.88, 0.05], [1, 0.04]], h: [[0, 0], [0.06, 0.3], [0.3, 0.62], [0.55, 0.58], [0.85, 0.2], [1, 0.12]], y: [[0, 0.05], [0.3, 0], [1, 0]] },
  clown:    { w: [[0, 0], [0.06, 0.14], [0.3, 0.22], [0.6, 0.2], [0.88, 0.09], [1, 0.07]], h: [[0, 0], [0.06, 0.25], [0.3, 0.44], [0.6, 0.4], [0.88, 0.18], [1, 0.13]], y: [[0, 0], [1, 0]] },
  barra:    { w: [[0, 0], [0.06, 0.07], [0.2, 0.13], [0.5, 0.14], [0.85, 0.07], [1, 0.05]], h: [[0, 0], [0.06, 0.08], [0.2, 0.15], [0.5, 0.16], [0.85, 0.08], [1, 0.07]], y: [[0, -0.02], [1, 0]] },
  hatchet:  { w: [[0, 0], [0.08, 0.08], [0.35, 0.1], [0.7, 0.06], [1, 0.03]], h: [[0, 0], [0.08, 0.35], [0.3, 0.8], [0.55, 0.55], [0.8, 0.15], [1, 0.1]], y: [[0, 0.15], [0.3, -0.2], [0.6, -0.05], [1, 0]] },
  viper:    { w: [[0, 0], [0.05, 0.11], [0.2, 0.14], [0.6, 0.11], [0.9, 0.05], [1, 0.04]], h: [[0, 0], [0.05, 0.14], [0.2, 0.19], [0.6, 0.15], [0.9, 0.07], [1, 0.06]], y: [[0, 0], [1, 0]] },
  eel:      { w: [[0, 0], [0.04, 0.1], [0.15, 0.13], [0.6, 0.12], [0.9, 0.07], [1, 0.01]], h: [[0, 0], [0.04, 0.11], [0.15, 0.15], [0.6, 0.14], [0.9, 0.1], [1, 0.02]], y: [[0, 0], [1, 0]] },
  angler:   { w: [[0, 0], [0.02, 0.32], [0.18, 0.6], [0.45, 0.5], [0.75, 0.2], [1, 0.08]], h: [[0, 0], [0.02, 0.35], [0.2, 0.55], [0.45, 0.48], [0.75, 0.2], [1, 0.12]], y: [[0, -0.05], [0.3, 0], [1, 0.05]] },
  shark:    { w: [[0, 0], [0.04, 0.07], [0.12, 0.17], [0.3, 0.25], [0.5, 0.22], [0.75, 0.11], [0.9, 0.05], [1, 0.04]], h: [[0, 0], [0.04, 0.08], [0.12, 0.2], [0.3, 0.28], [0.5, 0.24], [0.75, 0.12], [0.9, 0.06], [1, 0.05]], y: [[0, 0.02], [0.1, 0], [0.5, 0], [1, 0.03]] },
};

// ---------- species looks (keyed by the names in shared.js) ----------
// pattern(t, u, v, c) may change colour c (a THREE.Color already set to the countershaded base).
const dark = (c, k) => c.multiplyScalar(k);
const LOOK = {
  'Sardine': { body: 'fusiform', tail: 'fork', ts: 0.5, dorsal: [[0.4, 0.52, 0.22]], anal: [[0.74, 0.82, 0.1]], back: 0x24566e, belly: 0xe9eef2, fin: 0x9aaab4, metal: 0.65, rough: 0.3,
    pattern: (t, u, v, c) => { if (v > 0.25 && v < 0.5 && t > 0.25 && t < 0.6 && Math.abs(Math.sin(t * 40)) > 0.8) dark(c, 0.45); }, wave: [0.16, 2.6, 10] },
  'Clownfisch': { body: 'clown', tail: 'round', ts: 0.42, dorsal: [[0.22, 0.48, 0.24], [0.5, 0.78, 0.3]], anal: [[0.62, 0.82, 0.22]], back: 0xff6408, belly: 0xff8a30, fin: 0xf2650c, rough: 0.5,
    pattern: (t, u, v, c) => { for (const [b, w] of [[0.2, 0.05], [0.5, 0.06], [0.83, 0.035]]) { const d = Math.abs(t - b - v * 0.03); if (d < w) c.setHex(0xf6f7f2); else if (d < w + 0.012) c.setHex(0x111111); } }, wave: [0.2, 2, 7] },
  'Doktorfisch': { body: 'tall', tail: 'truncate', ts: 0.5, tailCol: 0xffd21a, dorsal: [[0.15, 0.85, 0.18]], anal: [[0.42, 0.85, 0.16]], back: 0x1846d8, belly: 0x2c66ee, fin: 0x1a3fa8,
    pattern: (t, u, v, c) => { const band = v > 0.1 + (t - 0.45) ** 2 * 1.6 && v < 0.62 - (t - 0.4) ** 2; if (band && t > 0.18 && t < 0.78) c.setHex(0x080c2a); }, wave: [0.12, 1.8, 6] },
  'Makrele': { body: 'fusiform', stretch: 1.15, tail: 'fork', ts: 0.6, dorsal: [[0.3, 0.42, 0.24], [0.58, 0.66, 0.13]], anal: [[0.6, 0.68, 0.11]], finlets: 0x6f8a6a, back: 0x2c7a66, belly: 0xdde6e8, fin: 0x5c6e70, metal: 0.55, rough: 0.32,
    pattern: (t, u, v, c) => { if (v > 0.15 && Math.sin(t * 60 + Math.sin(v * 9) * 3) > 0.35) c.setHex(0x12302e); }, wave: [0.15, 2.4, 10] },
  'Thunfisch': { body: 'tuna', stretch: 1.1, tail: 'lunate', ts: 0.55, dorsal: [[0.3, 0.4, 0.34], [0.55, 0.62, 0.3]], anal: [[0.6, 0.67, 0.28]], finlets: 0xf2c531, pect: [0.28, 0.75, 0.13, 0.2], back: 0x16294f, belly: 0xd8dee6, fin: 0x2a3550, metal: 0.55, rough: 0.3,
    pattern: (t, u, v, c) => { if (Math.abs(v - 0.12) < 0.05 && t > 0.2 && t < 0.75) c.lerp(new THREE.Color(0x9a8a40), 0.5); }, wave: [0.11, 2.2, 8] },
  'Barrakuda': { body: 'barra', stretch: 1.6, tail: 'fork', ts: 0.55, dorsal: [[0.3, 0.36, 0.17], [0.66, 0.72, 0.13]], anal: [[0.66, 0.72, 0.11]], back: 0x47575f, belly: 0xe2e8ea, fin: 0x55646c, metal: 0.55, rough: 0.3, teeth: 0.16,
    pattern: (t, u, v, c) => { if (v > -0.05 && (t * 16 - v * 2) % 1 < 0.22 && t > 0.2 && t < 0.85) dark(c, 0.55); if (v < 0 && t > 0.6 && hash(t * 50 | 0, v * 9 | 0) > 0.85) dark(c, 0.4); }, wave: [0.12, 2.8, 8] },
  'Laternenfisch': { body: 'fusiform', tail: 'fork', ts: 0.45, dorsal: [[0.42, 0.55, 0.18]], anal: [[0.62, 0.75, 0.12]], back: 0x161d2a, belly: 0x5d6b7c, fin: 0x2a3340, metal: 0.6, rough: 0.3, eyeR: 0.11, photo: 'rows', wave: [0.15, 2.4, 9] },
  'Beilfisch': { body: 'hatchet', tail: 'fork', ts: 0.35, dorsal: [[0.5, 0.62, 0.15]], back: 0x6d7d8e, belly: 0xdce8f2, fin: 0xa8b8c8, metal: 0.9, rough: 0.18, eyeR: 0.13, eyeUp: true, photo: 'belly', wave: [0.08, 2, 7] },
  'Viperfisch': { body: 'viper', stretch: 1.4, tail: 'fork', ts: 0.4, spine: 0.85, anal: [[0.8, 0.88, 0.12]], back: 0x14101c, belly: 0x2a2338, fin: 0x1d1828, rough: 0.35, metal: 0.4, fangs: 0.32, eyeR: 0.08, photo: 'rows', wave: [0.18, 3, 8] },
  'Geisterfisch': { body: 'tall', tail: 'round', ts: 0.45, dorsal: [[0.2, 0.8, 0.22]], anal: [[0.45, 0.8, 0.2]], back: 0xcfd9ee, belly: 0xeef3ff, fin: 0xdfe8ff, rough: 0.25, ei: 0.25, eyeR: 0.12, longPelvic: true, wave: [0.14, 1.8, 6] },
  'Tiefsee-Aal': { body: 'eel', stretch: 2.4, tail: 'none', longFin: true, back: 0x2b261e, belly: 0x5a5040, fin: 0x3a3226, rough: 0.35, metal: 0.2, eyeR: 0.05,
    pattern: (t, u, v, c) => { if (hash(t * 90 | 0, (v * 6 + 6) | 0) > 0.9) dark(c, 0.6); }, wave: [0.42, 6.5, 6] },
  'Anglerfisch': { body: 'angler', tail: 'round', ts: 0.35, dorsal: [[0.72, 0.82, 0.14]], anal: [[0.74, 0.84, 0.12]], back: 0x2a1d1a, belly: 0x3e2c25, fin: 0x241917, rough: 0.8, teeth: 0.45, lure: true, eyeR: 0.05,
    pattern: (t, u, v, c) => { if (hash(t * 40 | 0, (u * 8 + 8) | 0 + (v * 8 + 8) * 17) > 0.75) dark(c, 0.7); }, wave: [0.08, 1.6, 4] },
  'Kristallfisch': { body: 'tall', tail: 'fork', ts: 0.5, dorsal: [[0.25, 0.7, 0.2]], anal: [[0.45, 0.75, 0.16]], back: 0x7fdff0, belly: 0xd5fbff, fin: 0xa8f0ff, rough: 0.1, metal: 0.3, flat: true, ei: 0.35, wave: [0.12, 2, 6] },
  'Drachenfisch': { body: 'viper', stretch: 1.6, tail: 'fork', ts: 0.35, dorsal: [[0.84, 0.9, 0.14]], anal: [[0.84, 0.9, 0.12]], back: 0x0c090e, belly: 0x18121c, fin: 0x140f18, rough: 0.3, metal: 0.4, fangs: 0.26, barbel: true, eyeR: 0.07, photo: 'rows', wave: [0.22, 3.2, 7] },
  'Leuchtrochen': { ray: true, back: 0x251a40, belly: 0xc8c0d8 },
  // giant oarfish, used for the Leviathan boss: silver ribbon body with a red crest
  'Riemenfisch': { body: 'eel', stretch: 2.6, tail: 'none', longFin: true, crest: true, back: 0xaab6c0, belly: 0xe6edf2, fin: 0xd02828, metal: 0.75, rough: 0.25, eyeR: 0.06,
    pattern: (t, u, v, c) => { if (v > -0.3 && Math.sin(t * 70 + v * 5) > 0.75) dark(c, 0.55); if (hash(t * 120 | 0, (v * 5 + 5) | 0) > 0.93) dark(c, 0.5); }, wave: [0.38, 5.5, 4] },
};
// the deep-sea fish glow colour comes from FISH[].glow in shared.js

const TMP = new THREE.Color(), BACK = new THREE.Color(), BELLY = new THREE.Color();
function bodyColor(L, gold) {
  BACK.setHex(gold ? 0xb8860b : L.back); BELLY.setHex(gold ? 0xffe07a : L.belly);
  return (t, u, v) => {
    TMP.copy(BELLY).lerp(BACK, sst(-0.35, 0.3, v));
    if (!gold && L.pattern) L.pattern(t, u, v, TMP);
    if (Math.abs(v - 0.04) < 0.025 && t > 0.22 && t < 0.92) dark(TMP, 0.85);                 // lateral line
    if (t > 0.19 && t < 0.215 && v > -0.55 && Math.abs(u) > 0.2) dark(TMP, 0.65);           // gill cover
    if (t < 0.07 && v < 0.02 && v > -0.35) dark(TMP, 0.4);                                    // mouth
    return TMP.multiplyScalar(0.93 + 0.07 * hash(t * 97, u * 13 + v * 7));
  };
}

// ---------- fish ----------
// S: entry from FISH (or a fish-shaped boss). Returns group with userData.update(dt, {yaw, pitch, state}).
export function makeRealFish(S, gold, lookName) {
  const L = LOOK[lookName || S.name] || LOOK.Sardine;
  if (L.ray) return makeRay(S, gold, L);
  const P = BODY[L.body], st = L.stretch || 1;
  const tz = (t) => (-1 + 2 * t) * st, top = (t) => spline(P.y, t) + Math.max(0, spline(P.h, t)), bot = (t) => spline(P.y, t) - Math.max(0, spline(P.h, t));
  const W = (t) => Math.max(0, spline(P.w, t)), Yc = (t) => spline(P.y, t), H = (t) => Math.max(0, spline(P.h, t));
  const finC = new THREE.Color(gold ? 0xd9a520 : L.fin);
  const geos = [loft(P, st, bodyColor(L, gold))];
  // tail (caudal fin)
  const T = (L.ts || 0.5) * 1, z = tz(1) - 0.03, hb = H(0.96);
  const tailShapes = {
    fork: [[z, 0], [z, hb], [z + T * 0.9, T * 1.05], [z + T * 0.42, 0], [z + T * 0.9, -T * 1.05], [z, -hb]],
    lunate: [[z, 0], [z, hb], [z + T * 0.95, T * 1.3], [z + T * 0.55, T * 0.3], [z + T * 0.42, 0], [z + T * 0.55, -T * 0.3], [z + T * 0.95, -T * 1.3], [z, -hb]],
    truncate: [[z, 0], [z, hb], [z + T * 0.8, T * 0.85], [z + T * 0.74, 0], [z + T * 0.8, -T * 0.85], [z, -hb]],
    round: [[z, 0], ...Array.from({ length: 9 }, (_, k) => { const a = -1.15 + k * 2.3 / 8; return [z + T * 0.85 * Math.cos(a), T * 0.75 * Math.sin(a)]; }).reverse()],
  };
  if (tailShapes[L.tail]) geos.push(fin(tailShapes[L.tail], (a, b) => [0, Yc(1) + b, a], L.tailCol && !gold ? new THREE.Color(L.tailCol) : finC));
  // dorsal + anal fins: swept-back sails sitting on the body
  const sail = (t0, t1, hgt, up) => {
    const y0 = up ? top : bot, s = up ? 1 : -1, n = 6, pts = [[tz(t0), y0(t0) - s * 0.02]];
    for (let k = 0; k <= n; k++) { const t = t0 + (t1 - t0) * k / n, f = Math.sin(Math.min(1, k / n * 1.25) * Math.PI * 0.5) * (1 - 0.6 * (k / n) ** 3); pts.push([tz(t) + hgt * 0.35 * (k / n), y0(t) + s * hgt * f]); }
    pts.push([tz(t1), y0(t1) - s * 0.02]);
    return fin(pts, (a, b) => [0, b, a], finC);
  };
  for (const [t0, t1, hgt] of L.dorsal || []) geos.push(sail(t0, t1, hgt, true));
  for (const [t0, t1, hgt] of L.anal || []) geos.push(sail(t0, t1, hgt, false));
  if (L.longFin) { geos.push(sail(0.3, 0.995, 0.09, true)); geos.push(sail(0.45, 0.995, 0.08, false)); }
  if (L.crest) for (let k = 0; k < 6; k++) {   // long red spines on the head (oarfish crest)
    const t = 0.05 + k * 0.025;
    geos.push(fin([[tz(t), top(t)], [tz(t) + 0.15 + k * 0.05, top(t) + 0.55 - k * 0.06], [tz(t) + 0.06, top(t)]], (a, b) => [0, b, a], finC));
  }
  if (L.spine) geos.push(fin([[tz(0.17), top(0.17)], [tz(0.2), top(0.2) + L.spine], [tz(0.19), top(0.19)]], (a, b) => [0, b, a], finC));
  // finlets between second dorsal and tail
  if (L.finlets) {
    const fc = new THREE.Color(gold ? 0xffd34d : L.finlets);
    for (let k = 0; k < 5; k++) { const t = 0.72 + k * 0.045; for (const up of [true, false]) { const y0 = up ? top(t) : bot(t), s = up ? 1 : -1; geos.push(fin([[tz(t), y0], [tz(t) + 0.06, y0 + s * 0.06], [tz(t) + 0.08, y0]], (a, b) => [0, b, a], fc)); } }
  }
  // pectoral fins (pair), swept back and slightly down
  const [pt, pl, pw, pd] = L.pect || [0.25, 0.42, 0.14, 0.35];
  for (const side of [-1, 1]) {
    const bx = W(pt) * 0.92, by = Yc(pt) - H(pt) * 0.25, bz = tz(pt);
    geos.push(fin([[0, 0], [pl * 0.35, pw], [pl, pw * 0.45], [pl * 0.85, 0]], (a, b) => [side * (bx + a * 0.35), by - a * pd + b * 0.3, bz + a], finC));
    // pelvic fins under the belly
    const vt = 0.42, vx = W(vt) * 0.4, vy = bot(vt), vz = tz(vt), vl = L.longPelvic ? 0.9 : 0.22;
    geos.push(fin([[0, 0], [vl * 0.5, 0.05], [vl, 0.015], [vl * 0.8, 0]], (a, b) => [side * (vx + b), vy - a * 0.35, vz + a * 0.8], finC));
  }
  const geo = merge(geos);
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const [amp, k, freq] = L.wave || [0.15, 2.4, 8];
  const mat = swimMat({ amp, k, z0: tz(0.22), len: tz(1) - tz(0.22) + (L.ts || 0.5), metal: gold ? 0.9 : L.metal, rough: gold ? 0.22 : L.rough, flat: L.flat,
    emissive: gold ? 0x6a4a00 : (L.ei ? (S.glow || L.back) : 0), ei: gold ? 0.5 : L.ei || 0 });
  g.add(new THREE.Mesh(geo, mat));
  // eyes: silver iris + black pupil
  const et = 0.1, eR = L.eyeR || 0.07, irisM = std(gold ? 0xffe07a : 0xc9c4a8, { metalness: 0.8, roughness: 0.25 }), pupM = std(0x020202, { roughness: 0.05 });
  for (const side of [-1, 1]) {
    const ex = W(et) * 0.85, ey = Yc(et) + H(et) * (L.eyeUp ? 0.55 : 0.3);
    put(g, SPH, irisM, side * ex, ey, tz(et), eR, eR, eR);
    put(g, SPH, pupM, side * (ex + eR * 0.45), ey + (L.eyeUp ? eR * 0.3 : 0), tz(et), eR * 0.62, eR * 0.62, eR * 0.62);
  }
  // teeth / fangs
  const toothM = std(0xf4f1e6, { roughness: 0.3 });
  if (L.teeth) for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 1.6, tx = Math.sin(a) * W(0.04) * 1.6;
    for (const s of [1, -1]) { const m = put(g, CONE, toothM, tx, Yc(0.03) + s * 0.015, tz(0.03) + Math.abs(tx) * 0.6, 0.012 * (1 + L.teeth * 3), L.teeth * 0.35, 0.012 * (1 + L.teeth * 3)); m.rotation.x = s > 0 ? Math.PI : 0; }
  }
  if (L.fangs) for (const s of [-1, 1]) for (const up of [1, -1]) {
    const m = put(g, CONE, toothM, s * W(0.05) * 0.6, Yc(0.04) + up * 0.02, tz(0.035), 0.022, L.fangs, 0.022); m.rotation.x = up > 0 ? Math.PI + 0.25 : -0.25;
  }
  // glowing photophores
  const glowCol = S.glow || 0x4dfff0;
  if (L.photo && !gold) {
    const pm = glowM(glowCol, 2.6);
    for (let i = 0; i < 9; i++) {
      const t = 0.14 + i * 0.065;
      for (const side of [-1, 1]) {
        put(g, SPH, pm, side * W(t) * 0.75, bot(t) + H(t) * 0.25, tz(t), 0.022, 0.022, 0.022);
        if (L.photo === 'rows') put(g, SPH, pm, side * W(t) * 0.97, Yc(t) - H(t) * 0.05, tz(t), 0.018, 0.018, 0.018);
      }
    }
  }
  if (L.lure) {   // anglerfish: bent fishing rod with a glowing bulb
    const rod = new THREE.Group(); rod.position.set(0, top(0.12), tz(0.12)); g.add(rod);
    const st1 = put(rod, CYL, std(0x3a2a22), 0, 0.25, -0.12, 0.018, 0.55, 0.018); st1.rotation.x = -0.45;
    put(rod, SPH, glowM(glowCol, 3.5), 0, 0.5, -0.38, 0.07, 0.07, 0.07);
    put(rod, SPH, new THREE.MeshBasicMaterial({ color: glowCol, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.5, -0.38, 0.22, 0.22, 0.22);
  }
  if (L.barbel) {   // dragonfish: chin barbel with a light at the tip
    const b = put(g, CYL, std(0x1a1420), 0, bot(0.05) - 0.3, tz(0.05), 0.008, 0.6, 0.008); b.rotation.x = 0.15;
    put(g, SPH, glowM(glowCol, 3), 0, bot(0.05) - 0.62, tz(0.05) + 0.05, 0.035, 0.035, 0.035);
  }
  if (gold) put(g, SPH, new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0, 0, 0.9 * st, 0.7, 1.4 * st);
  const root = new THREE.Group(); root.add(g);
  g.scale.setScalar(S.size ?? 1);
  let ph = Math.random() * 6;
  root.userData.update = (dt, s) => {
    ph += dt * freq * (s.state ? 1.9 : 1);
    mat.userData.u.uPh.value = ph;
    g.rotation.y = s.yaw - Math.sin(ph) * amp * 0.12; g.rotation.x = s.pitch;
  };
  return root;
}

// ---------- ray (flat, flapping wings, whip tail) ----------
function makeRay(S, gold, L) {
  const geo = new THREE.SphereGeometry(1, 40, 18), p = geo.attributes.position, col = [];
  BACK.setHex(gold ? 0xb8860b : L.back); BELLY.setHex(gold ? 0xffe07a : L.belly);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const span = 1.9 * (1 - 0.45 * Math.max(0, z) ** 2) * (1 - 0.25 * Math.max(0, -z));
    const nx = x * span, nz = z * 1.05 - Math.abs(x) * 0.35, ny = y * 0.2 * (1 - 0.75 * x * x);
    p.setXYZ(i, nx, ny, nz);
    TMP.copy(BELLY).lerp(BACK, sst(-0.3, 0.2, y));
    if (y > 0 && hash(nx * 9 | 0, nz * 9 | 0) > 0.82) TMP.lerp(new THREE.Color(S.glow || 0xb06bff), 0.8);
    col.push(TMP.r, TMP.g, TMP.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const mat = swimMat({ ray: true, amp: 0.45, k: 2.5, z0: 0, len: 1.9, rough: 0.5, emissive: gold ? 0x6a4a00 : S.glow || 0, ei: gold ? 0.5 : 0.06 });
  const g = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(new THREE.Mesh(geo, mat));
  const tail = put(g, CYL, std(gold ? 0xb8860b : L.back), 0, 0, 1.9, 0.03, 2.2, 0.03); tail.rotation.x = Math.PI / 2;
  put(g, SPH, glowM(S.glow || 0xb06bff, 2.5), 0, 0, 3.0, 0.05, 0.05, 0.05);
  for (const s of [-1, 1]) put(g, SPH, std(0x050505, { roughness: 0.1 }), s * 0.25, 0.14, -0.55, 0.05, 0.05, 0.05);
  g.scale.setScalar(S.size ?? 1);
  const root = new THREE.Group(); root.add(g);
  let ph = Math.random() * 6;
  root.userData.update = (dt, s) => { ph += dt * (s.state ? 5 : 2.6); mat.userData.u.uPh.value = ph; g.rotation.y = s.yaw; g.rotation.x = s.pitch; tail.rotation.y = Math.sin(ph * 0.7) * 0.15; };
  return root;
}

// ---------- shark ----------
// look: { back, belly, pattern: 'tiger' | 'scars' | undefined }
export function makeRealShark(look = {}) {
  const P = BODY.shark, st = 2.3;
  const tz = (t) => (-1 + 2 * t) * st, H = (t) => Math.max(0, spline(P.h, t)), W = (t) => Math.max(0, spline(P.w, t)), Yc = (t) => spline(P.y, t);
  const top = (t) => Yc(t) + H(t), bot = (t) => Yc(t) - H(t);
  BACK.setHex(look.back ?? 0x5b6b78); BELLY.setHex(look.belly ?? 0xe6eaed);
  const color = (t, u, v) => {
    TMP.copy(BELLY).lerp(BACK, sst(-0.28, -0.05, v + 0.05 * Math.sin(t * 20)));
    if (look.pattern === 'tiger' && v > -0.1 && Math.sin(t * 48 + v * 4) > 0.55 && t > 0.2) dark(TMP, 0.6);
    if (look.pattern === 'scars' && v > -0.2 && hash(t * 30 | 0, (v * 10 + 10) | 0) > 0.93) TMP.lerp(new THREE.Color(0xd8d0c8), 0.7);
    for (let k = 0; k < 5; k++) if (Math.abs(t - (0.19 + k * 0.016)) < 0.003 && Math.abs(u) > 0.45 && v > -0.45 && v < 0.35) dark(TMP, 0.35);  // gill slits
    if (t > 0.05 && t < 0.11 && v < -0.7) dark(TMP, 0.35);   // mouth
    return TMP.multiplyScalar(0.94 + 0.06 * hash(t * 97, u * 13 + v * 7));
  };
  const finC = new THREE.Color(look.back ?? 0x5b6b78).multiplyScalar(0.85);
  const geos = [loft(P, st, color, 40, 20)];
  const yz = (a, b) => [0, b, a];
  // first dorsal: tall, swept back
  geos.push(fin([[tz(0.36), top(0.36) - 0.03], [tz(0.42), top(0.42) + 0.35], [tz(0.5) + 0.12, top(0.47) + 0.62], [tz(0.5), top(0.5) - 0.03]], yz, finC));
  geos.push(fin([[tz(0.74), top(0.74) - 0.02], [tz(0.79) + 0.05, top(0.78) + 0.16], [tz(0.79), top(0.79) - 0.02]], yz, finC));   // second dorsal
  geos.push(fin([[tz(0.75), bot(0.75) + 0.02], [tz(0.8) + 0.05, bot(0.79) - 0.13], [tz(0.8), bot(0.8) + 0.02]], yz, finC));       // anal
  // heterocercal tail: long upper lobe
  const z = tz(1) - 0.05, hb = H(0.97), T = 0.95;
  geos.push(fin([[z, 0], [z, hb], [z + T * 0.95, T * 1.15], [z + T * 0.82, T * 0.95], [z + T * 0.32, 0.02], [z + T * 0.48, -T * 0.6], [z + T * 0.2, -T * 0.3], [z, -hb]], (a, b) => [0, Yc(1) + b, a], finC));
  for (const s of [-1, 1]) {
    const bx = W(0.28) * 0.9, by = bot(0.28) + H(0.28) * 0.35, bz = tz(0.28);
    geos.push(fin([[0, 0], [0.25, 0.3], [0.85, 0.95], [0.75, 0.75], [0.55, 0]], (a, b) => [s * (bx + b * 0.95), by - b * 0.42, bz + a * 0.9], finC));   // pectorals
    geos.push(fin([[0, 0], [0.12, 0.18], [0.3, 0.2], [0.26, 0]], (a, b) => [s * (W(0.62) * 0.5 + b), bot(0.62) - b * 0.4, tz(0.62) + a], finC));     // pelvics
  }
  const mat = swimMat({ amp: 0.38, k: 2.2, z0: tz(0.25), len: tz(1) - tz(0.25) + 1, rough: 0.55, metal: 0.05 });
  const g = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(new THREE.Mesh(merge(geos), mat));
  for (const s of [-1, 1]) put(g, SPH, std(0x030303, { roughness: 0.05, metalness: 0.4 }), s * W(0.11) * 0.92, Yc(0.11) + H(0.11) * 0.25, tz(0.11), 0.045, 0.045, 0.045);
  const root = new THREE.Group(); root.add(g);
  let ph = Math.random() * 6;
  root.userData.update = (dt, s) => { ph += dt * (s.state ? 10 : 4.5); mat.userData.u.uPh.value = ph; g.rotation.y = s.yaw - Math.sin(ph) * 0.04; g.rotation.x = s.pitch; };
  return root;
}

// ---------- octopus ----------
export function makeRealOcto(color = 0xb8432c) {
  const base = new THREE.Color(color), pale = base.clone().lerp(new THREE.Color(0xffe2cc), 0.55);
  // mottled mantle: lighter underneath, darker spots on top
  const mg = new THREE.SphereGeometry(1, 28, 20), mp = mg.attributes.position, mc = [];
  for (let i = 0; i < mp.count; i++) {
    const x = mp.getX(i), y = mp.getY(i), z = mp.getZ(i);
    const bump = 1 + 0.05 * Math.sin(x * 9 + z * 7) * Math.cos(y * 8);
    mp.setXYZ(i, x * bump, y * bump, z * bump);
    TMP.copy(pale).lerp(base, sst(-0.6, 0.2, y));
    if (hash((x * 6) | 0, ((y + z) * 6) | 0) > 0.7) dark(TMP, 0.7);
    if (hash((x * 14) | 0, ((y - z) * 14) | 0) > 0.86) TMP.lerp(new THREE.Color(0xfff0e0), 0.35);
    mc.push(TMP.r, TMP.g, TMP.b);
  }
  mg.setAttribute('color', new THREE.Float32BufferAttribute(mc, 3)); mg.computeVertexNormals();
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.05 });
  const root = new THREE.Group(), g = new THREE.Group(); g.rotation.order = 'YXZ'; root.add(g);
  const mantle = put(g, mg, skin, 0, 0.35, 0.35, 0.8, 0.75, 1.15); mantle.rotation.x = -0.35;
  put(g, mg, skin, 0, 0.05, -0.35, 0.62, 0.5, 0.55);   // head
  for (const s of [-1, 1]) {   // eyes with a horizontal pupil
    put(g, SPH, std(0xd9b44a, { metalness: 0.6, roughness: 0.3 }), s * 0.5, 0.18, -0.45, 0.14, 0.14, 0.14);
    put(g, new THREE.BoxGeometry(1, 1, 1), std(0x020202), s * 0.62, 0.18, -0.45, 0.04, 0.05, 0.16);
  }
  // arms: tapered segments, suckers on the underside
  const segG = new THREE.CylinderGeometry(0.8, 1, 1, 10, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2), sc = [], sp = segG.attributes.position;
  for (let i = 0; i < sp.count; i++) { const y = sp.getY(i); TMP.copy(y < -0.2 ? pale : base); sc.push(TMP.r, TMP.g, TMP.b); }
  segG.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const sucker = std(0xffe8d8, { roughness: 0.5 });
  const arms = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + 0.2, b0 = new THREE.Group();
    b0.position.set(Math.cos(a) * 0.38, Math.sin(a) * 0.3 - 0.15, -0.2);
    b0.rotation.set(-Math.sin(a) * 0.7 + 0.5, Math.cos(a) * 0.7, 0);
    g.add(b0);
    let parent = b0; const chain = [];
    for (let k = 0; k < 10; k++) {
      const j = new THREE.Group(); j.position.z = k ? 0.32 : 0; parent.add(j);
      const r = 0.15 * (1 - k * 0.088);
      const m = new THREE.Mesh(segG, skin); m.scale.set(r, r, 0.34); j.add(m);
      if (k % 2 === 0 && k < 9) put(j, SPH, sucker, 0, -r * 0.85, 0.16, r * 0.45, r * 0.2, r * 0.45);
      chain.push(j); parent = j;
    }
    arms.push({ chain, a });
  }
  let ph = Math.random() * 6;
  root.userData.update = (dt, s) => {
    ph += dt * (s.state === 1 ? 6 : 1.8);
    g.rotation.y = s.yaw; g.rotation.x = s.pitch;
    mantle.scale.y = 0.75 + Math.sin(ph * 0.8) * 0.04;   // breathing
    const curl = s.state === 2 ? 0.42 : s.state === 1 ? 0.04 : 0.17;
    for (const arm of arms) for (let k = 0; k < arm.chain.length; k++) {
      const w = Math.sin(ph + arm.a * 2 + k * 0.6) * 0.16;
      arm.chain[k].rotation.x = Math.sin(arm.a) * (curl + w) + 0.05; arm.chain[k].rotation.y = -Math.cos(arm.a) * (curl + w);
    }
  };
  return root;
}

// ---------- bosses ----------
// How each floor boss looks (realistic versions, scaled up).
export const BOSS_LOOK = {
  'Riffkönig':       { kind: 'shark', look: { back: 0x7a6a4a, belly: 0xe8e2d0, pattern: 'tiger' }, scale: 2.0 },
  'Krakenmutter':    { kind: 'octo', color: 0x8a2a6a, scale: 3.2 },
  'Laternenschlund': { kind: 'fish', look: 'Anglerfisch', size: 1, glow: 0xfff07a, scale: 5.5 },
  'Knochenhai':      { kind: 'shark', look: { back: 0x4f5a62, belly: 0xf0f0ec, pattern: 'scars' }, scale: 3.0 },
  'Leviathan':       { kind: 'fish', look: 'Riemenfisch', size: 1, scale: 4.2 },
};
export function makeRealBoss(B) {
  const L = BOSS_LOOK[B.name] || { kind: 'shark', look: {}, scale: B.scale };
  const inner = L.kind === 'shark' ? makeRealShark(L.look) : L.kind === 'octo' ? makeRealOcto(L.color) : makeRealFish({ size: L.size, glow: L.glow }, false, L.look);
  inner.scale.setScalar(L.scale);
  return inner;
}
