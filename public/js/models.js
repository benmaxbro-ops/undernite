// Undernite - procedural models. Everything is built from primitives so the
// game ships without any binary assets. Forward is -z for all models.
import * as THREE from 'three';
import { SUITS, RARITY } from './shared.js';

const TAU = Math.PI * 2;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...o });
const glow = (color, i = 1.5, o = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.4, ...o });
function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
}
// shared geometries (never disposed)
const zCapsule = (r, len, seg = 10) => new THREE.CapsuleGeometry(r, len, 4, seg).rotateX(Math.PI / 2);
const zCyl = (r1, r2, len, seg = 12) => new THREE.CylinderGeometry(r1, r2, len, seg).rotateX(Math.PI / 2);
const GEO = {
  torso: zCapsule(0.3, 0.7), head: new THREE.SphereGeometry(0.23, 14, 10), visor: new THREE.SphereGeometry(0.17, 12, 8),
  tank: zCyl(0.13, 0.13, 0.6), arm: zCapsule(0.08, 0.5, 6), leg: zCapsule(0.1, 0.7, 6), fin: new THREE.BoxGeometry(0.28, 0.03, 0.55),
  gun: new THREE.BoxGeometry(0.09, 0.13, 0.7), barrel: zCyl(0.035, 0.035, 0.5, 6), plate: new THREE.BoxGeometry(0.3, 0.18, 0.42),
  box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 16, 12), cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  zcyl: zCyl(1, 1, 1, 14), torus: new THREE.TorusGeometry(1, 0.08, 6, 20),
};
const WCOL = [0xffe066, 0x4de8ff, 0xff9838, 0xf2f6f8, 0xff4d4d, 0xff4d4d];
const SUIT_COL = { manta: 0x1fd6b4, triton: 0xf08a24, bulwark: 0x8a2f3a, goliath: 0x5a6a78 };

function tri(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  g.computeVertexNormals();
  return g;
}

export function makeTag(text, color = '#e8fbff') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48;
  const c = cv.getContext('2d');
  c.font = '600 26px Bahnschrift, "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(3,16,26,0.55)';
  const w = Math.min(250, c.measureText(text).width + 22);
  c.beginPath(); c.roundRect(128 - w / 2, 6, w, 36, 10); c.fill();
  c.fillStyle = color; c.fillText(text, 128, 25);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(3.2, 0.6, 1);
  return s;
}

// ---------- divers & mech ----------
function buildDiver(suit, accent) {
  const S = SUITS[suit], g = new THREE.Group();
  const body = std(SUIT_COL[suit]), dark = std(0x26333f), acc = glow(accent, 0.45);
  const heavy = suit === 'bulwark', slim = suit === 'manta';
  add(g, GEO.torso, body).scale.set(heavy ? 1.3 : slim ? 0.85 : 1, heavy ? 1.15 : 1, 1);
  add(g, GEO.head, dark, 0, 0.05, -0.82).scale.setScalar(heavy ? 1.2 : 1);
  add(g, GEO.visor, glow(0x7df9ff, 1.4), 0, 0.02, -0.93).scale.setScalar(heavy ? 1.15 : 1);
  if (heavy) { add(g, GEO.tank, dark, -0.17, 0.4, 0.05); add(g, GEO.tank, dark, 0.17, 0.4, 0.05); add(g, GEO.plate, dark, -0.45, 0.1, -0.4); add(g, GEO.plate, dark, 0.45, 0.1, -0.4); }
  else add(g, GEO.tank, slim ? acc : std(0xd8dde2, { metalness: 0.7 }), 0, 0.36, 0.05);
  add(g, new THREE.BoxGeometry(heavy ? 0.7 : 0.5, 0.05, 0.12), acc, 0, heavy ? 0.36 : 0.3, -0.35);
  add(g, GEO.arm, body, -0.26, -0.18, -0.85); add(g, GEO.arm, body, 0.26, -0.18, -0.85);
  const gun = new THREE.Group(); gun.position.set(0, -0.22, -1.2); g.add(gun);
  const gunMat = std(0x3a4650), gunGlow = glow(WCOL[0], 1.2);
  add(gun, GEO.gun, gunMat); add(gun, GEO.barrel, gunGlow, 0, 0.02, -0.5);
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.14, 0, 0.55); g.add(hip);
    add(hip, GEO.leg, body, 0, 0, 0.45); add(hip, GEO.fin, acc, 0, 0, 1.08).scale.set(slim ? 0.8 : 1, 1, slim ? 0.8 : 1);
    legs.push(hip);
  }
  if (slim) {
    const wm = glow(accent, 0.5, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    add(g, tri([0.25, 0.08, -0.4], [1.35, 0.08, 0.45], [0.25, 0.08, 0.5]), wm);
    add(g, tri([-0.25, 0.08, -0.4], [-0.25, 0.08, 0.5], [-1.35, 0.08, 0.45]), wm);
  }
  g.scale.setScalar(S.scale);
  return { g, legs, gunGlow, mech: false };
}
function buildMech(accent) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.scale.setScalar(0.75); body.position.y = 0.55;
  const hull = std(0x8496a6, { roughness: 0.45 }), dark = std(0x35424e), acc = glow(accent, 0.7);
  add(body, GEO.box, hull, 0, 0.2, 0).scale.set(2.0, 1.5, 1.5);
  add(body, GEO.box, dark, 0, -0.9, 0).scale.set(1.4, 0.5, 1.0);
  add(body, GEO.sph, glow(0x7df9ff, 1.2, { transparent: true, opacity: 0.85 }), 0, 0.45, -0.7).scale.setScalar(0.62);
  add(body, GEO.box, dark, 0, 0.3, 0.95).scale.set(1.4, 1.2, 0.6);
  add(body, GEO.box, acc, 0, 1.0, 0).scale.set(1.6, 0.08, 1.2);
  for (const sx of [-1, 1]) { add(body, GEO.zcyl, glow(0x58d7ff, 2), sx * 0.4, -0.1, 1.3).scale.set(0.22, 0.22, 0.2); }
  const arms = [], legs = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 1.3, 0.75, 0); body.add(sh);
    add(sh, GEO.sph, dark).scale.setScalar(0.5);
    add(sh, GEO.cyl, hull, 0, -0.6, 0).scale.set(0.28, 1.0, 0.28);
    add(sh, GEO.zcyl, dark, 0, -1.1, -0.5).scale.set(0.3, 0.3, 1.4);
    add(sh, GEO.zcyl, acc, 0, -1.1, -1.22).scale.set(0.2, 0.2, 0.1);
    arms.push(sh);
    const hip = new THREE.Group(); hip.position.set(sx * 0.55, -1.1, 0); body.add(hip);
    add(hip, GEO.box, hull, 0, -0.5, 0).scale.set(0.5, 1.0, 0.6);
    add(hip, GEO.box, dark, 0, -1.45, 0.05).scale.set(0.42, 1.0, 0.5);
    add(hip, GEO.box, hull, 0, -2.05, -0.15).scale.set(0.7, 0.25, 1.1);
    legs.push(hip);
  }
  return { g, legs, arms, mech: true };
}

// Returns a group with userData.update(dt, {yaw, pitch, speed, t, weapon})
export function makePlayerModel(suit, id, name) {
  const accent = new THREE.Color().setHSL((id * 0.137) % 1, 0.9, 0.6).getHex();
  const root = new THREE.Group();
  const parts = suit === 'goliath' ? buildMech(accent) : buildDiver(suit, accent);
  const inner = parts.g; inner.rotation.order = 'YXZ'; root.add(inner);
  if (name) { const tag = makeTag(name); tag.position.y = suit === 'goliath' ? 3.0 : 1.5; root.add(tag); root.userData.tag = tag; }
  let phase = Math.random() * 6, lastW = -2;
  root.userData.inner = inner;
  root.userData.update = (dt, s) => {
    inner.rotation.y = s.yaw;
    phase += dt * (3 + Math.min(14, s.speed) * 0.8);
    const amp = 0.12 + Math.min(1, s.speed / 9) * 0.4;
    if (parts.mech) {
      inner.rotation.x = s.pitch * 0.2;
      for (const a of parts.arms) a.rotation.x = s.pitch;
      parts.legs[0].rotation.x = Math.sin(phase * 0.6) * amp; parts.legs[1].rotation.x = -Math.sin(phase * 0.6) * amp;
    } else {
      inner.rotation.x = s.pitch;
      inner.rotation.z = Math.sin(phase * 0.5) * 0.05;
      parts.legs[0].rotation.x = Math.sin(phase) * amp; parts.legs[1].rotation.x = -Math.sin(phase) * amp;
      if (s.weapon !== lastW && s.weapon >= 0) { lastW = s.weapon; parts.gunGlow.color.setHex(WCOL[s.weapon]); parts.gunGlow.emissive.setHex(WCOL[s.weapon]); }
    }
  };
  return root;
}

// ---------- vehicles ----------
export function makeSub() {
  const root = new THREE.Group(), g = new THREE.Group(); g.rotation.order = 'YXZ'; root.add(g);
  const hull = std(0xf2b705, { roughness: 0.4 }), dark = std(0x2c3d49);
  add(g, zCapsule(1.5, 4.4, 16), hull);
  add(g, GEO.sph, glow(0x7fdcf0, 0.35, { transparent: true, opacity: 0.85 }), 0, 0.1, -2.9).scale.setScalar(1.15);
  add(g, GEO.cyl, hull, 0, 1.7, -0.3).scale.set(0.7, 1.1, 0.7);
  add(g, GEO.cyl, dark, 0.2, 2.6, -0.3).scale.set(0.07, 0.9, 0.07);
  for (const sx of [-1, 1]) {
    add(g, zCapsule(0.45, 2.2), dark, sx * 1.75, -0.5, 0.2);
    add(g, GEO.box, hull, sx * 1.2, 0, 3.2).scale.set(1.6, 0.1, 0.9);
    add(g, GEO.sph, glow(0xfff2c0, 3), sx * 0.9, -0.6, -3.3).scale.setScalar(0.16);
  }
  add(g, GEO.box, hull, 0, 0.9, 3.2).scale.set(0.1, 1.6, 0.9);
  add(g, GEO.box, glow(0xff5a36, 0.8), 0, 0, 0).scale.set(3.05, 0.25, 0.5);
  const prop = new THREE.Group(); prop.position.z = 3.95; g.add(prop);
  for (let i = 0; i < 4; i++) { const b = add(prop, GEO.box, dark); b.scale.set(1.3, 0.08, 0.3); b.rotation.z = i * Math.PI / 4; }
  const ring = add(g, GEO.torus, dark, 0, 0, 3.95); ring.scale.setScalar(1.0);
  const beam = add(g, new THREE.ConeGeometry(3, 22, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, -14),
    new THREE.MeshBasicMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  root.userData.update = (dt, s) => { g.rotation.y = s.yaw; g.rotation.x = s.pitch; prop.rotation.z += dt * (2 + s.speed * 1.5); beam.visible = !!s.driven; };
  return root;
}
export function makeScooter() {
  const root = new THREE.Group(), g = new THREE.Group(); g.rotation.order = 'YXZ'; root.add(g);
  const b = new THREE.Group(); b.position.set(0, -0.5, -1.25); g.add(b);
  const hull = std(0x23c2e8, { roughness: 0.35 }), dark = std(0x26333f);
  add(b, zCyl(0.26, 0.26, 1.3), hull);
  add(b, zCyl(0.02, 0.26, 0.45), glow(0xffe066, 0.8), 0, 0, -0.87);
  add(b, GEO.box, dark, 0, 0.12, 0.45).scale.set(1.0, 0.05, 0.06);
  const ring = add(b, GEO.torus, dark, 0, 0, 0.72); ring.scale.setScalar(0.36);
  const prop = new THREE.Group(); prop.position.z = 0.72; b.add(prop);
  for (let i = 0; i < 3; i++) { const p = add(prop, GEO.box, dark); p.scale.set(0.6, 0.04, 0.1); p.rotation.z = i * Math.PI / 3; }
  root.userData.update = (dt, s) => { g.rotation.y = s.yaw; g.rotation.x = s.pitch; prop.rotation.z += dt * (3 + s.speed * 2); };
  return root;
}

// ---------- creatures ----------
function sharkBody() {
  const pts = [[0, -2.3], [0.22, -2.05], [0.46, -1.3], [0.56, -0.4], [0.5, 0.5], [0.3, 1.5], [0.1, 2.2]].map(p => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.LatheGeometry(pts, 14).rotateX(Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.smoothstep(pos.getY(i), -0.25, 0.12);
    col[i * 3] = 0.82 - 0.56 * k; col[i * 3 + 1] = 0.86 - 0.52 * k; col[i * 3 + 2] = 0.88 - 0.46 * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
let SHARK_GEO = null;
export function makeShark(tint) {
  SHARK_GEO ||= sharkBody();
  const root = new THREE.Group(), g = new THREE.Group(); g.rotation.order = 'YXZ'; root.add(g);
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, color: tint ?? 0xffffff });
  const finM = new THREE.MeshStandardMaterial({ color: tint ? new THREE.Color(tint).multiplyScalar(0.55) : 0x4a5a68, roughness: 0.6, side: THREE.DoubleSide });
  const body = add(g, SHARK_GEO, skin); body.scale.set(0.85, 1.05, 1);
  add(g, tri([0, 0.5, -0.5], [0, 1.45, 0.35], [0, 0.48, 0.5]), finM);
  add(g, tri([0.4, -0.2, -0.9], [1.5, -0.6, 0.1], [0.4, -0.25, -0.1]), finM);
  add(g, tri([-0.4, -0.2, -0.9], [-0.4, -0.25, -0.1], [-1.5, -0.6, 0.1]), finM);
  const eye = std(0x050505, { roughness: 0.2 });
  add(g, GEO.sph, eye, 0.33, 0.12, -1.6).scale.setScalar(0.07); add(g, GEO.sph, eye, -0.33, 0.12, -1.6).scale.setScalar(0.07);
  add(g, GEO.box, std(0xe8eef0), 0, -0.28, -1.75).scale.set(0.42, 0.04, 0.5);
  const tail = new THREE.Group(); tail.position.z = 2.05; g.add(tail);
  add(tail, tri([0, 0, -0.1], [0, 1.25, 0.9], [0, 0.1, 0.45]), finM);
  add(tail, tri([0, 0, -0.1], [0, -0.1, 0.45], [0, -0.85, 0.75]), finM);
  let ph = Math.random() * 6;
  root.userData.update = (dt, s) => {
    ph += dt * (s.state ? 13 : 5);
    g.rotation.y = s.yaw + Math.sin(ph) * 0.06; g.rotation.x = s.pitch;
    tail.rotation.y = Math.sin(ph - 0.8) * 0.55;
  };
  return root;
}
export function makeOcto(color) {
  const root = new THREE.Group(), g = new THREE.Group(); g.rotation.order = 'YXZ'; root.add(g);
  const skin = std(color ?? 0xd2452f, { roughness: 0.75, metalness: 0 }), pale = std(color ? new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45) : 0xf0a070, { roughness: 0.8, metalness: 0 });
  add(g, GEO.sph, skin, 0, 0.25, -0.6).scale.set(0.85, 0.9, 1.15);
  for (const sx of [-1, 1]) { add(g, GEO.sph, glow(0xffe066, 1.6), sx * 0.5, 0.35, 0.15).scale.setScalar(0.16); add(g, GEO.sph, std(0x000000), sx * 0.6, 0.35, 0.2).scale.set(0.06, 0.12, 0.09); }
  const seg = zCyl(0.16, 0.12, 0.55, 7).translate(0, 0, 0.275);
  const arms = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + 0.2, base = new THREE.Group();
    base.position.set(Math.cos(a) * 0.45, Math.sin(a) * 0.4 + 0.1, 0.35);
    base.rotation.set(-Math.sin(a) * 0.75, Math.cos(a) * 0.75, 0);
    g.add(base);
    let parent = base; const chain = [];
    for (let k = 0; k < 6; k++) {
      const j = new THREE.Group(); j.position.z = k ? 0.5 : 0; parent.add(j);
      const t = 1 - k * 0.13; add(j, seg, k % 2 ? pale : skin).scale.set(t, t, 1);
      add(j, GEO.sph, skin).scale.setScalar(0.16 * t);
      chain.push(j); parent = j;
    }
    arms.push({ chain, a });
  }
  let ph = Math.random() * 6;
  root.userData.update = (dt, s) => {
    ph += dt * (s.state === 1 ? 7 : 2.2);
    g.rotation.y = s.yaw; g.rotation.x = s.pitch;
    const curl = s.state === 2 ? 0.5 : s.state === 1 ? 0.05 : 0.22;
    for (const arm of arms) for (let k = 0; k < arm.chain.length; k++) {
      const w = Math.sin(ph + arm.a * 2 + k * 0.8) * 0.22;
      arm.chain[k].rotation.x = Math.sin(arm.a) * (curl + w); arm.chain[k].rotation.y = -Math.cos(arm.a) * (curl + w);
    }
  };
  return root;
}
const JELLY = { bell: new THREE.SphereGeometry(0.75, 14, 8, 0, TAU, 0, Math.PI / 2), skirt: new THREE.CylinderGeometry(0.5, 0.22, 1.7, 9, 3, true).translate(0, -0.85, 0) };
export function makeJelly(id) {
  const root = new THREE.Group();
  const c = [0xff7ad9, 0x7ae6ff, 0xb48cff][id % 3];
  const bell = add(root, JELLY.bell, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false, roughness: 0.3 }));
  const core = add(root, GEO.sph, glow(c, 2.0), 0, 0.15, 0); core.scale.setScalar(0.2);
  const skirt = add(root, JELLY.skirt, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  let ph = (id * 1.7) % 6;
  root.userData.update = (dt) => {
    ph += dt * 2.4; const k = Math.sin(ph);
    bell.scale.set(1 + k * 0.14, 1 - k * 0.18, 1 + k * 0.14);
    skirt.scale.set(1 - k * 0.2, 1 + k * 0.12, 1 - k * 0.2);
  };
  return root;
}

// ---------- expedition: fish, bosses, boat ----------
// Fish body profiles (radius along the length, nose at -z). shape: 0 normal, 1 tall, 2 long, 3 angler
const FISH_PROFILE = [
  [[0, -1], [0.3, -0.75], [0.5, -0.3], [0.48, 0.2], [0.28, 0.65], [0.08, 1]],
  [[0, -1], [0.45, -0.6], [0.55, -0.1], [0.45, 0.35], [0.2, 0.75], [0.06, 1]],
  [[0, -1], [0.18, -0.8], [0.24, -0.4], [0.24, 0.2], [0.18, 0.7], [0.05, 1]],
  [[0, -1], [0.62, -0.7], [0.7, -0.25], [0.5, 0.25], [0.22, 0.7], [0.06, 1]],
];
const FISH_GEO = [];
const fishGeo = (shape) => FISH_GEO[shape] ||= new THREE.LatheGeometry(FISH_PROFILE[shape].map(p => new THREE.Vector2(p[0], p[1])), 12).rotateX(Math.PI / 2);
// S: entry from FISH (or a fish-type boss). Returns a group with userData.update(dt, {yaw, pitch, state}).
export function makeFish(S, gold) {
  const root = new THREE.Group(), g = new THREE.Group(); g.rotation.order = 'YXZ'; root.add(g);
  const len = S.size ?? 1, shape = S.shape ?? 0;
  const col = gold ? 0xffd34d : S.col;
  const skin = new THREE.MeshStandardMaterial({ color: col, roughness: gold ? 0.25 : 0.5, metalness: gold ? 0.9 : 0.3,
    emissive: gold ? 0x8a5a00 : (S.glow || 0x000000), emissiveIntensity: gold ? 0.6 : S.glow ? 0.08 : 0 });
  const finM = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.7), roughness: 0.6, side: THREE.DoubleSide,
    transparent: true, opacity: 0.85, emissive: S.glow || 0x000000, emissiveIntensity: S.glow ? 0.5 : 0 });
  const body = add(g, fishGeo(shape), skin);
  const tall = shape === 1 ? 1.5 : 1, long = shape === 2 ? 2.2 : 1;
  body.scale.set(len * 0.55, len * tall, len * long);
  add(g, tri([0, len * 0.4 * tall, -len * 0.2 * long], [0, len * 0.95 * tall, len * 0.3 * long], [0, len * 0.35 * tall, len * 0.55 * long]), finM);
  const eye = std(0x050505, { roughness: 0.1, metalness: 0.5 });
  for (const sx of [-1, 1]) add(g, GEO.sph, eye, sx * len * 0.24, len * 0.12 * tall, -len * 0.7 * long).scale.setScalar(len * 0.07 + 0.02);
  if (S.glow) {   // a row of glowing dots along each side
    const dot = glow(S.glow, 2.2);
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) add(g, GEO.sph, dot, sx * len * 0.26, -len * 0.18 * tall, (-0.45 + i * 0.3) * len * long).scale.setScalar(len * 0.045 + 0.015);
  }
  if (shape === 3) {   // angler: fishing rod with a glowing lure
    const stalk = add(g, zCyl(0.02, 0.02, 1, 5), std(0x3a2a22), 0, len * 0.75, -len * 0.75);
    stalk.scale.set(len, len, len * 0.9); stalk.rotation.x = -0.9;
    add(g, GEO.sph, glow(S.glow || 0xfff07a, 3), 0, len * 1.15, -len * 1.25).scale.setScalar(len * 0.12);
    const tooth = std(0xf2f2e6);
    for (let i = 0; i < 5; i++) add(g, new THREE.ConeGeometry(0.03, 0.12, 4), tooth, (i - 2) * len * 0.1, -len * 0.05, -len * 0.98).scale.setScalar(len * 1.2);
  }
  const tail = new THREE.Group(); tail.position.z = len * 0.95 * long; g.add(tail);
  add(tail, tri([0, 0, 0], [0, len * 0.55 * tall, len * 0.5], [0, -len * 0.55 * tall, len * 0.5]), finM);
  if (gold) add(g, GEO.sph, new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })).scale.setScalar(len * 1.4 * long);
  let ph = Math.random() * 6;
  root.userData.update = (dt, s) => {
    ph += dt * (s.state ? 16 : 7);
    g.rotation.y = s.yaw + Math.sin(ph) * 0.05; g.rotation.x = s.pitch;
    tail.rotation.y = Math.sin(ph - 0.8) * 0.6;
  };
  return root;
}
// Floor boss i (see BOSSES in shared.js), with a name tag.
export function makeBoss(B) {
  let inner;
  if (B.model === 'shark') inner = makeShark(B.col);
  else if (B.model === 'octo') inner = makeOcto(B.col);
  else inner = makeFish({ size: 1, shape: B.shape, col: B.col, glow: B.glow });
  inner.scale.setScalar(B.scale);
  const root = new THREE.Group(); root.add(inner);
  const tag = makeTag('☠ ' + B.name, '#ffc94d'); tag.scale.multiplyScalar(1.7); tag.position.y = B.r + 2.5; root.add(tag);
  root.userData.update = (dt, s) => inner.userData.update(dt, s);
  return root;
}
// The trader boat at the surface. y = 0 is the waterline.
export function makeBoat() {
  const g = new THREE.Group();
  const hull = std(0xc8382c, { roughness: 0.5 }), white = std(0xf2f0e6), wood = std(0x7a5634, { roughness: 0.9 }), dark = std(0x26333f);
  add(g, GEO.box, hull, 0, -0.6, 0).scale.set(5, 2.2, 13);
  add(g, new THREE.ConeGeometry(2.5, 4, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 4), hull, 0, -0.6, -8.4).scale.set(1.41, 0.62, 1);
  add(g, GEO.box, dark, 0, -1.75, 0).scale.set(5.05, 0.25, 13.05);
  add(g, GEO.box, wood, 0, 0.55, 0).scale.set(4.8, 0.15, 12.8);
  add(g, GEO.box, white, 0, 2.1, 2.5).scale.set(3.6, 3, 4.5);
  add(g, GEO.box, hull, 0, 3.75, 2.5).scale.set(4, 0.3, 5);
  for (const sx of [-1, 1]) add(g, GEO.box, glow(0xffe8a0, 1.5), sx * 1.82, 2.4, 2.5).scale.set(0.05, 0.9, 2.6);
  add(g, GEO.cyl, wood, 0, 6, -3).scale.set(0.15, 11, 0.15);
  const flag = add(g, GEO.box, glow(0x5ef2e0, 0.8), 0.9, 10.5, -3); flag.scale.set(1.8, 1.1, 0.04);
  add(g, GEO.sph, glow(0xffc94d, 3), 0, 4.3, 0).scale.setScalar(0.35);
  const sign = makeTag('⚓ HÄNDLER', '#ffc94d'); sign.scale.multiplyScalar(2.2); sign.position.set(0, 7.5, 2.5); g.add(sign);
  // light beam down into the water so you find your way back up
  const beam = add(g, GEO.cyl, new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, -90, 0);
  beam.scale.set(3, 180, 3);
  let t = 0;
  g.userData.beam = beam;
  g.userData.update = (dt) => { t += dt; g.rotation.z = Math.sin(t * 0.8) * 0.03; g.rotation.x = Math.sin(t * 0.6) * 0.02; flag.rotation.y = Math.sin(t * 3) * 0.3; };
  return g;
}

// ---------- loot ----------
export function makeCrate() {
  const g = new THREE.Group();
  const hull = std(0x13616e, { metalness: 0.55, roughness: 0.4 }), band = std(0xd9a441, { metalness: 0.8, roughness: 0.3 });
  add(g, GEO.box, hull, 0, 0.45, 0).scale.set(1.5, 0.9, 1.0);
  for (const x of [-0.5, 0.5]) add(g, GEO.box, band, x, 0.45, 0).scale.set(0.14, 0.94, 1.04);
  const lid = new THREE.Group(); lid.position.set(0, 0.9, 0.5); g.add(lid);
  add(lid, GEO.box, hull, 0, 0.13, -0.5).scale.set(1.5, 0.26, 1.0);
  for (const x of [-0.5, 0.5]) add(lid, GEO.box, band, x, 0.13, -0.5).scale.set(0.14, 0.3, 1.04);
  const seam = add(g, GEO.box, glow(0xffd166, 2.5), 0, 0.9, 0); seam.scale.set(1.52, 0.05, 1.02);
  const beam = add(g, GEO.cyl, new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 9, 0);
  beam.scale.set(0.3, 16, 0.3);
  g.userData.open = (instant) => { lid.rotation.x = 1.9; seam.visible = false; beam.visible = false; g.userData.isOpen = true; };
  return g;
}
export function makePickup(kind, wid, rar) {
  const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
  let col;
  if (kind === 'w') {
    col = new THREE.Color(RARITY[rar].color).getHex();
    const wc = { pistol: 0, needler: 1, scatter: 2, harpoon: 3, torpedo: 4 }[wid] ?? 0;
    const len = { pistol: 0.5, needler: 0.85, scatter: 0.7, harpoon: 1.2, torpedo: 1.0 }[wid] ?? 0.7;
    const thick = wid === 'torpedo' ? 0.26 : wid === 'scatter' ? 0.2 : 0.13;
    add(spin, GEO.box, std(0x2b343c, { metalness: 0.6 })).scale.set(thick, thick + 0.05, len);
    add(spin, GEO.box, std(0x2b343c), 0, -0.16, len * 0.25).scale.set(0.08, 0.22, 0.1);
    add(spin, GEO.zcyl, glow(WCOL[wc], 1.5), 0, 0.02, -len * 0.55).scale.set(0.05, 0.05, len * 0.5);
  } else if (kind === 'med') {
    col = 0x4dff88;
    add(spin, GEO.box, std(0xf2f6f8)).scale.set(0.55, 0.45, 0.3);
    add(spin, GEO.box, glow(0x2ee66b, 1.6)).scale.set(0.36, 0.1, 0.32); add(spin, GEO.box, glow(0x2ee66b, 1.6)).scale.set(0.1, 0.34, 0.32);
  } else {
    col = 0x4db8ff;
    add(spin, new THREE.IcosahedronGeometry(0.34, 0), glow(0x4db8ff, 1.4, { transparent: true, opacity: 0.85, flatShading: true }));
  }
  const ring = add(g, GEO.torus, new THREE.MeshBasicMaterial({ color: col }), 0, -0.45, 0);
  ring.rotation.x = Math.PI / 2; ring.scale.setScalar(0.5);
  const halo = add(g, GEO.sph, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(0.85);
  const by = Math.random() * 6;
  g.userData.update = (t) => { spin.rotation.y = t * 1.4 + by; spin.position.y = Math.sin(t * 2 + by) * 0.12; };
  return g;
}

// ---------- projectiles ----------
const PGEO = [zCapsule(0.05, 0.5, 5), zCapsule(0.035, 0.7, 5), new THREE.SphereGeometry(0.08, 6, 5), zCyl(0.03, 0.03, 1.6, 5), zCapsule(0.16, 0.8, 8), zCapsule(0.2, 1.0, 8)];
const PMAT = WCOL.map(c => new THREE.MeshBasicMaterial({ color: c }));
export function makeProjectile(widx) { return new THREE.Mesh(PGEO[widx] || PGEO[0], PMAT[widx] || PMAT[0]); }
export { WCOL };
