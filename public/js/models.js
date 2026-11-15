// Undernite - procedural models. Everything is built from primitives so the
// game ships without any binary assets. Forward is -z for all models.
import * as THREE from 'three';
import { SUITS, RARITY, FISH, BOSSES } from './shared.js';
import { makeRealFish, makeRealShark, makeRealOcto, makeRealBoss } from './creatures.js';
import { makeShip } from './ship.js';
import { buildRealDiver } from './diver.js';
import { polymer, brushed, stipple, neoprene } from './textures.js';

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
const WCOL = [0xffe066, 0x4de8ff, 0xff9838, 0xf2f6f8, 0xff4d4d, 0xff4d4d, 0xd86bff, 0x7dffb0];
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
  const parts = suit === 'goliath' ? buildMech(accent) : buildRealDiver(suit, accent);
  const inner = parts.g; inner.rotation.order = 'YXZ'; root.add(inner);
  if (name) { const tag = makeTag(name); tag.position.y = suit === 'goliath' ? 3.0 : 1.5; root.add(tag); root.userData.tag = tag; }
  let phase = Math.random() * 6, lastW = -2, tilt = 0, heldKey = '', heldMesh = null, gunModel = null;
  root.userData.inner = inner;
  // wo die Mündung der Waffe gerade ist (null, wenn keine Waffe sichtbar ist)
  root.userData.muzzle = () => gunModel && parts.gun && parts.gun.visible ? gunModel.userData.muzzle : null;
  let knife = null, handBase = null;
  root.userData.update = (dt, s) => {
    inner.rotation.y = s.yaw;
    phase += dt * (3 + Math.min(14, s.speed) * 0.8);
    const amp = 0.12 + Math.min(1, s.speed / 9) * 0.4;
    if (parts.mech) {
      inner.rotation.x = s.pitch * 0.2;
      for (const a of parts.arms) a.rotation.x = s.pitch;
      parts.legs[0].rotation.x = Math.sin(phase * 0.6) * amp; parts.legs[1].rotation.x = -Math.sin(phase * 0.6) * amp;
      // Goliath-Finisher: nach vorne greifen, hoch über den Kopf heben … und werfen!
      if (s.fin) {
        const p = s.fin.p, k = (a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
        const x = p < 0.22 ? k(0, 0.22) * 0.5 : p < 0.45 ? 0.5 + k(0.22, 0.45) * 1.9 : 2.4 - k(0.45, 0.52) * 2.6;
        for (const a of parts.arms) a.rotation.x = p < 0.7 ? x : s.pitch;
      }
    } else {
      // at the surface the diver turns upright and treads water, head out of the water
      tilt += ((s.surf ? 1 : 0) - tilt) * Math.min(1, dt * 3);
      inner.rotation.x = s.pitch * (1 - tilt) + 1.15 * tilt;
      inner.rotation.z = Math.sin(phase * 0.5) * 0.05;
      if (parts.animate) parts.animate(dt, s, phase, 0.5 + amp * 1.6);
      else { parts.legs[0].rotation.x = Math.sin(phase) * amp; parts.legs[1].rotation.x = -Math.sin(phase) * amp; }
      // neue Waffe in der Hand: das passende weiß-blaue Modell einsetzen
      if (s.weapon !== lastW && s.weapon >= 0) {
        lastW = s.weapon;
        parts.gun.clear();
        gunModel = makeWaterGun(s.weapon); gunModel.scale.setScalar(0.9); parts.gun.add(gunModel);
      }
      if (gunModel) { gunModel.userData.setGills(s.gills || 0); gunModel.userData.setCharge(s.charge || 0); }
      // a fish or boss held in the hand instead of the weapon
      const hk = s.held ? JSON.stringify(s.held) : '';
      if (hk !== heldKey && parts.hand) {
        heldKey = hk;
        if (heldMesh) { parts.hand.remove(heldMesh); heldMesh = null; }
        if (s.held) { heldMesh = makeTrophy(s.held, s.held.b != null ? 1.5 : 0.8); heldMesh.position.set(0.1, 0.05, s.held.b != null ? -0.85 : -0.55); parts.hand.add(heldMesh); }
        parts.gun.visible = !s.held;
      }
      if (heldMesh) heldMesh.userData.update(dt, { yaw: Math.PI / 2, pitch: 0, state: 1 });
      // Finisher: Manta schneidet mit dem Messer, Bollwerk schlägt mit der Faust (Triton schießt einfach)
      if (parts.hand) {
        if (!handBase) handBase = parts.hand.rotation.clone();
        const f = s.fin && (s.fin.type === 'manta' || s.fin.type === 'bulwark') ? s.fin : null;
        if (f && f.type === 'manta' && !knife) {
          knife = new THREE.Group();
          add(knife, GEO.box, std(0x22282e), 0, 0, 0).scale.set(0.03, 0.03, 0.1);                                         // Griff
          add(knife, GEO.box, std(0xdfe8ee, { metalness: 0.9, roughness: 0.2 }), 0, 0.004, -0.15).scale.set(0.006, 0.035, 0.2);   // Klinge
          knife.position.set(0, 0, -0.32); parts.hand.add(knife);
        }
        if (knife) knife.visible = !!f && f.type === 'manta';
        if (parts.gun) parts.gun.visible = !f && !s.held;
        parts.hand.rotation.copy(handBase);
        if (f && f.type === 'manta') {          // ausholen … und quer durchziehen
          const p = f.p, cut = Math.max(0, Math.min(1, (p - 0.45) / 0.1));   // 0 = ausgeholt, 1 = durchgezogen
          parts.hand.rotation.y = handBase.y + (p < 0.45 ? 0.9 * Math.min(1, p / 0.3) : 0.9 - cut * 1.9);
        } else if (f) {                          // Bollwerk: Arm nach vorne, hält die Minigun (die Minigun selbst baut finisher.js)
          parts.hand.rotation.x = handBase.x - 0.35 * Math.min(1, f.p / 0.12);
        }
      }
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

// ---------- creatures (realistic versions live in creatures.js) ----------
export function makeShark(tint) { return makeRealShark(tint ? { back: tint } : {}); }
export function makeOcto(color) { return makeRealOcto(color); }
const JELLY = { bell: new THREE.SphereGeometry(0.75, 14, 8, 0, TAU, 0, Math.PI / 2), skirt: new THREE.CylinderGeometry(0.5, 0.22, 1.7, 9, 3, true).translate(0, -0.85, 0) };
export function makeJelly(id) {
  const root = new THREE.Group();
  const c = [0xff7ad9, 0x7ae6ff, 0xb48cff][id % 3];
  root.userData.glowColor = c;   // so leuchtet die Qualle (main.js setzt dort ein schwaches Licht hin)
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

// ---------- expedition: fish, bosses, ship ----------
export function makeFish(S, gold) { return makeRealFish(S, gold); }
// Floor boss with a name tag above it.
export function makeBoss(B) {
  const inner = makeRealBoss(B);
  const root = new THREE.Group(); root.add(inner);
  const tag = makeTag('☠ ' + B.name, '#ffc94d'); tag.scale.multiplyScalar(1.7); tag.position.y = B.r + 3; root.add(tag);
  root.userData.update = (dt, s) => inner.userData.update(dt, s);
  return root;
}
export function makeBoat() { return makeShip(); }
// A caught fish ({s, g}) or boss ({b}) as a small model about len metres long (for the hand and the aquarium).
export function makeTrophy(e, len) {
  const inner = e.b != null ? makeRealBoss(BOSSES[e.b]) : makeRealFish(FISH[e.s], !!e.g);
  const root = new THREE.Group(); root.add(inner);
  inner.userData.update(0, { yaw: 0, pitch: 0, state: 0 });
  const size = new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3());
  root.scale.setScalar(len / Math.max(0.01, size.x, size.y, size.z));
  root.userData.update = (dt, st) => inner.userData.update(dt, st);
  return root;
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
  // kein Lichtstrahl mehr nach oben: Truhen sind versteckt (in den Höhlen der Korallen-Berge) und müssen gesucht werden
  const beam = add(g, GEO.cyl, new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 9, 0);
  beam.scale.set(0.3, 16, 0.3); beam.visible = false;
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
const PGEO = [zCapsule(0.05, 0.5, 5), zCapsule(0.035, 0.7, 5), new THREE.SphereGeometry(0.08, 6, 5), zCyl(0.03, 0.03, 1.6, 5), zCapsule(0.16, 0.8, 8), zCapsule(0.2, 1.0, 8), zCapsule(0.07, 1.1, 6), new THREE.TorusGeometry(0.35, 0.06, 6, 16)];
// Alle Waffen schießen komprimiertes Wasser: jede Waffe hat ihr eigenes Blau (hell = klein, dunkel/kräftig = groß).
//               Pistole   Nadler    Splitter  Harpune   Torpedo   Bordtorp. Plasma    Schall
const SHOT_COL = [0x9fe4ff, 0x6fd6ff, 0xbff0ff, 0xe8f8ff, 0x2f8cff, 0x2f8cff, 0x4dc3ff, 0x1f6bff];
const PMAT = SHOT_COL.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 }));
export function makeProjectile(widx) { return new THREE.Mesh(PGEO[widx] || PGEO[0], PMAT[widx] || PMAT[0]); }

// ---------- Wasserdruck-Waffen (weiß-blau, mit Kiemen) ----------
// Jede Waffe wird aus Seitenprofilen gebaut: ein Umriss (u = nach vorne, v = nach oben, in Metern),
// der dick gemacht wird und abgerundete Kanten bekommt. Der Ursprung (0, 0) ist da, wo die Hand den Griff hält.
// kind: 'pistol' = Pistole, 'rifle' = Gewehr, 'tube' = Werferrohr. L = Länge, H = Höhe, W = Breite, R = Rohr-Radius.
const GUNS = [
  /* 0 Bolzenpistole  */ { kind: 'pistol', L: 0.2,  H: 0.034, W: 0.03,  barrel: 0.02, br: 0.009, gills: 3 },
  /* 1 Nadler         */ { kind: 'rifle',  L: 0.28, H: 0.05,  W: 0.04,  barrel: 0.16, br: 0.009, gills: 3, stock: 'short', magK: 1 },
  /* 2 Splitterwerfer */ { kind: 'rifle',  L: 0.34, H: 0.06,  W: 0.05,  barrel: 0.3,  br: 0.02,  gills: 4, stock: 'full', pump: true, magK: 1.2 },
  /* 3 Harpune        */ { kind: 'rifle',  L: 0.34, H: 0.05,  W: 0.04,  barrel: 0.45, br: 0.012, gills: 4, stock: 'full', scope: true, magK: 0.85 },
  /* 4 Torpedowerfer  */ { kind: 'tube',   L: 0.75, R: 0.075, gills: 5 },
  /* 5 Bordtorpedo    */ { kind: 'tube',   L: 0.75, R: 0.075, gills: 5 },
  /* 6 Plasmalanze    */ { kind: 'rifle',  L: 0.4,  H: 0.065, W: 0.05,  barrel: 0.3,  br: 0.016, gills: 4, stock: 'full', scope: true, magK: 1.15 },
  /* 7 Schallkanone   */ { kind: 'tube',   L: 0.85, R: 0.095, gills: 6, dish: true },
];
const GUN_WHITE = 0xf2f7fa, GUN_BLUE = 0x2fa8ff;
// Profile werden pro Waffe nur einmal gebaut und dann wiederverwendet (spart Speicher)
const GUN_GEO = new Map();
// Würfel mit abgerundeten Kanten (1 × 1 × 1), damit nichts mehr kantig aussieht
const RBOX = (() => {
  const bs = 0.14, bt = 0.14, h = 0.5 - bs, r = 0.12, s = new THREE.Shape();
  s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  const d = 1 - 2 * bt, geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 3, curveSegments: 4 });
  geo.translate(0, 0, -d / 2); geo.computeVertexNormals();
  return geo;
})();
const GUN_CYL = zCyl(1, 1, 1, 32);     // glatte Zylinder (32 Ecken statt 14)
const GUN_CYL_Y = new THREE.CylinderGeometry(1, 1, 1, 24);   // stehender Zylinder (für Magazine)
const GUN_TUBE = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true).rotateX(Math.PI / 2);   // Rohr ohne Deckel (offen)
const FINGER = new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2), KNUCKLE = new THREE.SphereGeometry(1, 16, 12);
const FINGER_T = new THREE.CylinderGeometry(0.86, 1, 1, 16).rotateX(Math.PI / 2);   // Fingerglied: vorne 14 % dünner als hinten
function profileGeo(key, pts, depth, holes = []) {
  if (GUN_GEO.has(key)) return GUN_GEO.get(key);
  const sh = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
  const bev = Math.min(0.005, depth * 0.22), d = Math.max(0.002, depth - bev * 2);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.7, bevelSegments: 2, curveSegments: 8 });
  geo.translate(0, 0, -d / 2);
  geo.rotateY(Math.PI / 2);            // Umriss-u zeigt jetzt nach vorne (-z), die Dicke liegt quer (x)
  GUN_GEO.set(key, geo);
  return geo;
}
// fp = true: Version für die Ego-Perspektive (ohne Schaft – der steckt an der Schulter, außerhalb des Bildes)
export function makeWaterGun(widx, fp = false) {
  const P = GUNS[widx] || GUNS[0], K = 'g' + widx + ':';
  const g = new THREE.Group();
  // Materialien (jede Waffe eigene, weil Kiemen und Druckanzeige leuchten)
  // weißer Kunststoff mit feiner Körnung, gebürstetes Metall, Griff mit Noppen
  const white = new THREE.MeshStandardMaterial({ color: GUN_WHITE, emissive: 0x55606a, emissiveIntensity: 0.45, roughness: 0.32, metalness: 0.05, bumpMap: polymer(), bumpScale: 0.3 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x7d8b96, emissive: 0x1c252c, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.75, bumpMap: brushed(), bumpScale: 0.5 });
  const gripM = new THREE.MeshStandardMaterial({ color: 0x5f6d78, emissive: 0x1a232a, emissiveIntensity: 0.6, roughness: 0.75, metalness: 0.1, bumpMap: stipple(), bumpScale: 1.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a2229, emissive: 0x0a1218, emissiveIntensity: 0.5, roughness: 0.7 });
  const blue = new THREE.MeshStandardMaterial({ color: GUN_BLUE, emissive: GUN_BLUE, emissiveIntensity: 1.3, roughness: 0.3 });
  const gillIn = new THREE.MeshStandardMaterial({ color: 0x08233d, emissive: GUN_BLUE, emissiveIntensity: 0.15, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fe4ff, emissive: GUN_BLUE, emissiveIntensity: 0.25, transparent: true, opacity: 0.55, roughness: 0.05 });
  const fill = new THREE.MeshStandardMaterial({ color: 0x7fdcff, emissive: GUN_BLUE, emissiveIntensity: 1.6 });
  let tgt = g;   // wohin neue Teile kommen (normalerweise die Waffe selbst, beim Schlitten in dessen Gruppe)
  const part = (geo, mat, x = 0, y = 0, z = 0) => add(tgt, geo, mat, x, y, z);
  // Box von u0 bis u1 (vorne), v0 bis v1 (oben), Breite w, seitlich verschoben um x
  const box = (mat, u0, u1, v0, v1, w, x = 0) => { const m = part(RBOX, mat, x, (v0 + v1) / 2, -(u0 + u1) / 2); m.scale.set(w, v1 - v0, u1 - u0); return m; };
  // Zylinder entlang der Waffe (nach vorne), von u0 bis u1 auf Höhe v
  const tube = (mat, u0, u1, v, r) => { const m = part(GUN_CYL, mat, 0, v, -(u0 + u1) / 2); m.scale.set(r, r, u1 - u0); return m; };
  const side = (key, mat, pts, w, holes) => part(profileGeo(K + key, pts, w, holes), mat);
  const ring = (u, v, r, mat = blue) => tube(mat, u - 0.004, u + 0.004, v, r);
  const flaps = [];   // Kiemen-Lamellen
  // Magazin: eine Gruppe, deren Ursprung das obere Ende ist (das Ende, das in der Waffe steckt); es zeigt nach unten (−y).
  // magFill leuchtet je nachdem, wie voll das Magazin ist.
  const magFill = new THREE.MeshStandardMaterial({ color: 0x7fdcff, emissive: GUN_BLUE, emissiveIntensity: 1.6 });
  let mag = null;
  const makeMag = (kind, k = 1) => {
    const m = new THREE.Group(), at = (geo, mat, y, sx, sy, sz) => { const o = new THREE.Mesh(geo, mat); o.position.y = y; o.scale.set(sx, sy, sz); m.add(o); return o; };
    let len;
    if (kind === 'pistol') {          // flaches Magazin, steckt fast ganz im Griff, unten die blaue Bodenplatte
      len = 0.104;
      at(RBOX, glass, -0.05, P.W * 0.55, 0.1, 0.03); at(RBOX, magFill, -0.05, P.W * 0.35, 0.09, 0.018);
      at(RBOX, blue, -0.101, P.W * 0.9, 0.009, 0.046);
    } else if (kind === 'rifle') {    // durchsichtige Druckpatrone mit Metallkappe
      len = 0.1 * k;
      at(GUN_CYL_Y, glass, -0.045 * k, 0.018 * k, 0.09 * k, 0.018 * k); at(GUN_CYL_Y, magFill, -0.045 * k, 0.012 * k, 0.08 * k, 0.012 * k);
      at(GUN_CYL_Y, metal, -0.095 * k, 0.02 * k, 0.012, 0.02 * k); at(GUN_CYL_Y, blue, -0.088 * k, 0.0205 * k, 0.004, 0.0205 * k);
    } else {                          // dicke Patrone für die Werfer
      len = 0.15;
      at(GUN_CYL_Y, glass, -0.065, P.R * 0.62, 0.13, P.R * 0.62); at(GUN_CYL_Y, magFill, -0.065, P.R * 0.45, 0.12, P.R * 0.45);
      at(GUN_CYL_Y, metal, -0.14, P.R * 0.68, 0.02, P.R * 0.68); at(GUN_CYL_Y, blue, -0.128, P.R * 0.69, 0.006, P.R * 0.69);
    }
    return { m, len };
  };
  const seatMag = (kind, k, x, y, z, tilt) => {
    const { m, len } = makeMag(kind, k);
    m.position.set(x, y, z); m.rotation.x = tilt; g.add(m);
    const out = new THREE.Vector3(0, -1, 0).applyQuaternion(m.quaternion);   // in diese Richtung wird es herausgezogen
    mag = { g: m, seat: m.position.clone(), seatQ: m.quaternion.clone(), out, len, fill: magFill };
  };
  let rear = 0, chargeBars = [];
  // muzzleAt = wo der Schuss rauskommt, gripTop/gripW = Griff für die rechte Hand, support = Stelle für die linke Hand
  let muzzleAt = [0, 0, 0], gripTop = 0, gripW = 0.04, support = null;
  // cock = Teil, das beim Durchladen nach hinten gezogen wird (Schlitten oder Spannhebel), sightAt = Höhe/Seite der Visierlinie
  let cock = null, sightAt = [0, 0];
  // Kiemen: n senkrechte Schlitze auf beiden Seiten (x = ±sx), von u0 nach vorne, Höhe h um v
  const gills = (n, u0, du, v, h, sx) => {
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
      const u = u0 + i * du;
      box(gillIn, u - du * 0.25, u + du * 0.25, v - h / 2, v + h / 2, 0.004, s * sx);           // leuchtender Schlitz
      for (let k = 0; k < 3; k++) {                                                          // 3 Lamellen, die sich auffächern
        const hinge = new THREE.Group(); hinge.position.set(s * (sx + 0.002 + k * 0.0015), v, -(u + du * 0.3)); tgt.add(hinge);
        const len = du * (0.95 - k * 0.2), hh = h * (1 - k * 0.12);
        const lam = add(hinge, GEO.box, white, 0, 0, len / 2); lam.scale.set(0.0025, hh, len);
        const edge = add(hinge, GEO.box, blue, s * 0.0014, 0, len - 0.002); edge.scale.set(0.001, hh, 0.003);   // blaue Kante
        flaps.push({ hinge, s, k });
      }
    }
  };
  // Druckanzeige: dunkles Fenster mit blauem Balken, der beim Komprimieren voll wird
  const chargeBar = (u0, u1, v, h, sx) => {
    for (const s of [-1, 1]) {
      box(dark, u0, u1, v - h / 2, v + h / 2, 0.003, s * sx);
      const bar = box(fill, u0 + 0.003, u1 - 0.003, v - h * 0.3, v + h * 0.3, 0.003, s * (sx + 0.001));
      chargeBars.push({ bar, u0: u0 + 0.003, len: u1 - u0 - 0.006 });
    }
  };
  // Griff mit Abzugsbügel und Abzug; top = Unterkante des Gehäuses
  const grip = (top, w, len = 0.1, plate = true) => {
    side('grip', gripM, [[-0.006, top], [0.034, top], [0.016, top - len], [-0.03, top - len], [-0.026, top - len * 0.25]], w * 0.85);
    if (plate) box(blue, -0.03, 0.016, top - len - 0.008, top - len, w * 0.9);                              // blaue Bodenplatte
    for (let i = 1; i < 4; i++) box(dark, -0.026 + i * 0.002, 0.03 - i * 0.004, top - len * (0.2 + i * 0.2), top - len * (0.2 + i * 0.2) + 0.003, w * 0.87);   // Griffrillen
    side('guard', white, [[0.034, top], [0.1, top], [0.1, top - 0.01], [0.075, top - 0.036], [0.03, top - 0.036]], w * 0.35,
      [[[0.04, top - 0.006], [0.09, top - 0.006], [0.07, top - 0.028], [0.04, top - 0.028]]]);
    const trig = box(metal, 0.052, 0.058, top - 0.024, top - 0.002, w * 0.2); trig.rotation.x = 0.35;
  };

  if (P.kind === 'pistol') {
    const { L, H, W } = P;
    // Schlitten (oben, weiß): eine eigene Gruppe, damit er beim Schuss und beim Durchladen nach hinten fahren kann
    const slideG = new THREE.Group(); g.add(slideG); tgt = slideG;
    side('slide', white, [[-0.03, 0], [L - 0.03, 0], [L - 0.03, H * 0.75], [L - 0.04, H], [-0.025, H], [-0.03, H * 0.85]], W);
    tgt = g;
    // Rahmen (unten)
    side('frame', white, [[-0.022, -0.014], [L - 0.04, -0.014], [L - 0.04, 0], [-0.022, 0]], W * 0.88);
    box(metal, L * 0.45, L - 0.045, -0.02, -0.014, W * 0.5);                              // Schiene unten
    tgt = slideG;
    for (let i = 0; i < 6; i++) box(dark, -0.024 + i * 0.006, -0.021 + i * 0.006, H * 0.15, H * 0.9, W + 0.002);   // Griffrillen am Schlitten
    tgt = g;
    tube(metal, L - 0.035, L - 0.02, H * 0.5, P.br * 1.3);                                // Lauf
    ring(L - 0.02, H * 0.5, P.br * 1.5);                                                  // blaue Mündung
    tube(dark, L - 0.02, L - 0.017, H * 0.5, P.br * 0.8);
    tgt = slideG;                                                                         // alles Weitere sitzt auf dem Schlitten
    box(dark, -0.026, -0.02, H, H + 0.007, 0.008, -0.007); box(dark, -0.026, -0.02, H, H + 0.007, 0.008, 0.007);   // Kimme
    box(blue, L - 0.05, L - 0.045, H, H + 0.007, 0.004);                                  // Korn (blau leuchtend)
    box(glass, 0.02, 0.09, H - 0.003, H + 0.001, W * 0.5);                                // Fenster oben
    chargeBar(0.015, 0.075, H * 0.25, 0.008, W / 2 + 0.002);
    gills(3, 0.085, 0.024, H * 0.5, H * 0.75, W / 2 + 0.002);
    box(dark, 0.035, 0.08, H * 0.55, H + 0.001, 0.004, W / 2 + 0.001);                    // Auswurffenster rechts
    for (let i = 0; i < 4; i++) box(dark, L - 0.075 + i * 0.006, L - 0.072 + i * 0.006, H * 0.2, H * 0.85, W + 0.002);   // vordere Griffrillen
    const dotM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });
    for (const x of [-0.007, 0.007]) add(slideG, KNUCKLE, dotM, x, H + 0.005, 0.0235).scale.setScalar(0.0016);   // Punkte auf der Kimme
    add(slideG, KNUCKLE, dotM, 0, H + 0.006, -(L - 0.05) - 0.0028).scale.setScalar(0.0016);                        // Punkt auf dem Korn
    tgt = g;
    cock = { g: slideG, at: new THREE.Vector3(0, H + 0.012, 0.012), travel: 0.032 };   // hinten oben an den Griffrillen anfassen
    sightAt = [0, H + 0.005];
    grip(-0.014, W, 0.1, false);
    seatMag('pistol', 1, 0, -0.016, -0.014, -0.207);   // schräg wie der Griff
    rear = 0.035;
    muzzleAt = [0, H * 0.5, -(L - 0.015)]; gripTop = -0.014; gripW = W;
  } else if (P.kind === 'rifle') {
    const { L, H, W } = P, back = L * 0.35, front = L * 0.65;
    // Gehäuse
    side('recv', white, [[-back, -H / 2], [front, -H / 2], [front, H * 0.3], [front - H * 0.4, H / 2], [-back + H * 0.2, H / 2], [-back, H * 0.3]], W);
    // Schiene oben mit Zähnen
    box(metal, -back * 0.7, front * 0.9, H / 2, H / 2 + 0.006, W * 0.45);
    for (let u = -back * 0.65; u < front * 0.85; u += 0.016) box(metal, u, u + 0.008, H / 2 + 0.006, H / 2 + 0.01, W * 0.5);
    // Handschutz mit Lüftungsschlitzen
    const hg = P.barrel * 0.55;
    side('hand', white, [[front - 0.005, -H * 0.42], [front + hg, -H * 0.32], [front + hg, H * 0.3], [front - 0.005, H * 0.38]], W * 0.85);
    for (let i = 0; i < 4; i++) { const u = front + hg * (0.15 + i * 0.2); box(dark, u, u + hg * 0.1, -H * 0.15, H * 0.15, W * 0.87); }
    // Lauf und Mündung
    const bv = H * 0.05, tip = front + P.barrel;
    tube(metal, front + hg - 0.01, tip, bv, P.br);
    tube(metal, tip, tip + 0.04, bv, P.br * 1.7);                                          // Mündungsaufsatz
    for (let i = 0; i < 3; i++) box(dark, tip + 0.008 + i * 0.011, tip + 0.013 + i * 0.011, bv + P.br * 1.2, bv + P.br * 1.75, P.br * 1.2);   // Löcher oben
    ring(tip + 0.04, bv, P.br * 1.75);
    tube(dark, tip + 0.04, tip + 0.043, bv, P.br * 1.1);
    // Kimme und Korn
    box(dark, -back * 0.5, -back * 0.5 + 0.01, H / 2 + 0.01, H / 2 + 0.022, W * 0.4);
    box(blue, front + hg - 0.012, front + hg - 0.006, H * 0.3, H * 0.3 + 0.03, 0.004);
    // Zielfernrohr
    if (P.scope) {
      const sv = H / 2 + 0.03;
      tube(metal, -back * 0.3, front * 0.6, sv, 0.016);
      tube(metal, front * 0.6, front * 0.6 + 0.03, sv, 0.021); ring(front * 0.6 + 0.03, sv, 0.019, glass);
      tube(metal, -back * 0.3 - 0.025, -back * 0.3, sv, 0.019);
      box(metal, 0, 0.012, H / 2 + 0.006, sv, 0.01); box(metal, front * 0.4, front * 0.4 + 0.012, H / 2 + 0.006, sv, 0.01);
    }
    // Pump-Griff (Splitterwerfer)
    if (P.pump) {
      tube(metal, front + hg, front + hg + 0.1, -H * 0.4, P.br * 1.2);
      for (let i = 0; i < 6; i++) tube(dark, front + hg + 0.01 + i * 0.015, front + hg + 0.017 + i * 0.015, -H * 0.4, P.br * 1.3);
    }
    // Druckpatrone (Magazin): durchsichtig, innen leuchtet das Wasser, unten nach vorne geneigt
    const mu = Math.max(0.13, front * 0.5);                                                     // vor dem Abzugsbügel
    box(metal, mu - 0.02, mu + 0.02, -H / 2 - 0.008, -H / 2 + 0.002, W * 0.7);                  // Magazinschacht
    seatMag('rifle', P.magK || 1, 0, -H / 2 + 0.004, -mu, 0.25);
    // Schaft
    if (fp) rear = back;
    else if (P.stock === 'full') {
      side('stock', white, [[-back, -H / 2], [-back, H * 0.4], [-back - 0.2, H * 0.25], [-back - 0.23, H * 0.25], [-back - 0.23, -H / 2 - 0.06], [-back - 0.19, -H / 2 - 0.06], [-back - 0.06, -H / 2]], W * 0.8,
        [[[-back - 0.04, -H * 0.2], [-back - 0.17, -H * 0.05], [-back - 0.17, -H / 2 - 0.035], [-back - 0.1, -H / 2 - 0.008]]]);
      box(metal, -back - 0.24, -back - 0.226, -H / 2 - 0.06, H * 0.25, W * 0.85);         // Schulterstütze
      rear = back + 0.24;
    } else {
      side('stock', white, [[-back, -H / 2], [-back, H * 0.3], [-back - 0.09, H * 0.2], [-back - 0.1, -H / 2 - 0.02], [-back - 0.04, -H / 2]], W * 0.7);
      rear = back + 0.1;
    }
    box(dark, front * 0.15, front * 0.45, H * 0.05, H * 0.35, 0.004, W / 2 + 0.001);       // Auswurffenster rechts
    for (const [u, v] of [[-back * 0.7, -H * 0.25], [-back * 0.2, -H * 0.25], [front * 0.75, -H * 0.25], [front * 0.75, H * 0.3]]) {
      for (const sd of [-1, 1]) { const sc = part(GUN_CYL, metal, sd * (W / 2 + 0.001), v, -u); sc.scale.set(0.004, 0.004, 0.003); sc.rotation.y = Math.PI / 2; }   // Schrauben
    }
    ring(-back + 0.01, 0, H * 0.45);
    // Spannhebel: läuft in einer Schiene an der linken Seite
    box(dark, front * 0.05, front * 0.55, H * 0.2, H * 0.36, 0.004, -W / 2 - 0.001);              // Schiene
    const chG = new THREE.Group(); g.add(chG); tgt = chG;
    box(metal, front * 0.45, front * 0.55, H * 0.17, H * 0.39, 0.014, -W / 2 - 0.006);
    const knob = part(GUN_CYL, blue, -W / 2 - 0.02, H * 0.28, -front * 0.5); knob.scale.set(0.008, 0.008, 0.02); knob.rotation.y = Math.PI / 2;
    tgt = g;
    cock = { g: chG, at: new THREE.Vector3(-W / 2 - 0.03, H * 0.28, -front * 0.5), travel: front * 0.4 };
    sightAt = [0, P.scope ? H / 2 + 0.03 : H / 2 + 0.016];
    chargeBar(-back * 0.85, -back * 0.15, H * 0.15, 0.012, W / 2 + 0.002);
    gills(P.gills, front * 0.15, 0.03, H * 0.05, H * 0.75, W / 2 + 0.002);
    grip(-H / 2, W);
    muzzleAt = [0, bv, -(tip + 0.045)]; gripTop = -H / 2; gripW = W; support = [0, -H * 0.42, -(front + hg * 0.5)];
  } else {
    // Werferrohr
    const { L, R } = P, u0 = -L * 0.3, u1 = L * 0.7;
    // Rohr hinten offen: außen weiß, innen ein dunkler Ladeschacht, in den die Patrone geschoben wird
    const pipe = (mat, a, b, r) => { const m = part(GUN_TUBE, mat, 0, 0, -(a + b) / 2); m.scale.set(r, r, b - a); return m; };
    pipe(white, u0, u1, R);
    const darkIn = dark.clone(); darkIn.side = THREE.DoubleSide;                             // von innen sichtbar
    pipe(darkIn, u0 - 0.03, u0 + 0.22, R * 0.66);                                           // Ladeschacht (innen dunkel)
    tube(dark, u0 + 0.21, u0 + 0.22, 0, R * 0.66);                                          // Boden des Schachts
    const rim = new THREE.Mesh(new THREE.RingGeometry(R * 0.66, R * 1.08, 32), metal);     // Rand hinten (Ring mit Loch)
    rim.position.z = -(u0 - 0.03); g.add(rim);
    const rimIn = new THREE.Mesh(new THREE.RingGeometry(R * 0.66, R, 32), white); rimIn.position.z = -u0; rimIn.rotation.y = Math.PI; g.add(rimIn);
    tube(metal, u1, u1 + 0.03, 0, R * 1.12);                                                // vorderer Rand
    tube(dark, u1 + 0.02, u1 + 0.031, 0, R * 0.85);                                         // dunkle Öffnung
    pipe(metal, u0 - 0.03, u0, R * 1.08);                                                   // hinterer Ring (außen)
    seatMag('tube', 1, 0, 0, -(u0 + 0.12), -Math.PI / 2);                                   // Patrone wird von hinten eingeschoben
    for (const u of [u0 + 0.04, L * 0.15, u1 - 0.05]) pipe(blue, u - 0.004, u + 0.004, R * 1.03);   // blaue Bänder (echte Ringe, innen hohl)
    if (P.dish) {                                                                           // Schallkanone: Trichter vorne
      const cone = part(new THREE.CylinderGeometry(R * 1.6, R * 1.05, 0.08, 20, 1, true).rotateX(Math.PI / 2), metal, 0, 0, -(u1 + 0.07)); cone.material.side = THREE.DoubleSide;
      const ringT = add(g, GEO.torus, blue, 0, 0, -(u1 + 0.11)); ringT.scale.setScalar(R * 1.6);
    }
    // Drucktanks an der Seite (leuchten beim Komprimieren)
    for (const s of [-1, 1]) {
      const t1 = part(GEO.zcyl, glass, s * R * 0.95, -R * 0.45, -L * 0.25); t1.scale.set(0.022, 0.022, L * 0.45);
      const t2 = part(GEO.zcyl, fill, s * R * 0.95, -R * 0.45, -L * 0.25); t2.scale.set(0.014, 0.014, L * 0.42);
      chargeBars.push({ tank: t2 });
    }
    // Visier oben links
    box(metal, L * 0.05, L * 0.2, R, R + 0.03, 0.03, -R * 0.4);
    ring(L * 0.2, R + 0.015, 0.013, glass).position.x = -R * 0.4;
    // Vordergriff
    const fg = part(GEO.cyl, metal, 0, -R - 0.05, -L * 0.4); fg.scale.set(0.016, 0.1, 0.016);
    gills(P.gills, -L * 0.15, 0.03, R * 0.1, R * 0.9, R * 0.98);
    const chG = new THREE.Group(); g.add(chG); tgt = chG;
    box(metal, L * 0.0, L * 0.06, R * 0.1, R * 0.45, 0.02, -R - 0.004);
    const knob = part(GUN_CYL, blue, -R - 0.025, R * 0.3, -L * 0.03); knob.scale.set(0.011, 0.011, 0.03); knob.rotation.y = Math.PI / 2;
    tgt = g;
    cock = { g: chG, at: new THREE.Vector3(-R - 0.04, R * 0.3, -L * 0.03), travel: 0.07 };
    sightAt = [-R * 0.4, R + 0.03];
    grip(-R * 0.85, 0.04);
    rear = L * 0.3 + 0.03;
    muzzleAt = [0, 0, -(u1 + (P.dish ? 0.12 : 0.035))]; gripTop = -R * 0.85; gripW = 0.04; support = [0, -R - 0.06, -L * 0.4];
  }

  // Kiemen öffnen: die Lamellen fächern nacheinander auf (zuerst die äußere, dann die nächste …)
  g.userData.setGills = (open) => {
    for (const f of flaps) {
      const o = Math.max(0, Math.min(1, open * 1.6 - f.k * 0.3));
      const e = o * o * (3 - 2 * o);                                  // weich beschleunigen und abbremsen
      f.hinge.rotation.y = f.s * e * (0.45 + f.k * 0.3);              // hinten klappt die Lamelle nach außen auf
    }
    gillIn.emissiveIntensity = 0.15 + open * 2.6;                      // dahinter leuchtet das einströmende Wasser
  };
  // Druckanzeige füllen
  g.userData.setCharge = (c) => {
    for (const b of chargeBars) {
      if (b.bar) { const l = Math.max(0.001, b.len * c); b.bar.scale.z = l; b.bar.position.z = -(b.u0 + l / 2); }
      if (b.tank) b.tank.material.emissiveIntensity = 0.3 + c * 2.2;
    }
    blue.emissiveIntensity = 1.3 + c * 1.4;
  };
  g.userData.rear = rear;   // wie weit die Waffe hinter der Hand weitergeht (für die Ego-Perspektive)
  const muzzle = new THREE.Object3D(); muzzle.position.set(...muzzleAt); g.add(muzzle);
  // fpShift: Werferrohre sitzen in der Ego-Perspektive weiter vorne und weiter rechts (sonst schaut man ins Rohr)
  const fpShift = P.kind === 'tube' ? [0.07, -0.035, -0.32] : [0, 0, 0];
  Object.assign(g.userData, { muzzle, gripTop, gripW, support, fpShift, mag, cock, sightAt });
  g.userData.setGills(0); g.userData.setCharge(1);
  return g;
}

// ---------- Arme und Hände in der Ego-Perspektive ----------
const Z_AXIS = new THREE.Vector3(0, 0, 1);
// gun = userData der Waffe (gripTop, gripW, support, rear). Die Arme werden an die Waffe gehängt und bewegen sich mit ihr.
// Finger als Kette: Glieder (Zylinder) mit runden Knöcheln (Kugeln) an jedem Gelenk; pts = Gelenkpunkte, r = Dicke
// taper < 1 (Finger): jedes Glied wird dünner, die Gelenke sind so dick wie der Finger an der Stelle.
// taper = 1 (Arme, Bündchen): überall gleich dick.
function chain(parent, mat, pts, r, taper = 1) {
  for (let i = 0; i < pts.length; i++) {
    const ri = r * Math.pow(taper, i), last = i === pts.length - 1;
    const k = new THREE.Mesh(KNUCKLE, mat); k.position.set(...pts[i]); k.scale.setScalar(ri * (taper < 1 ? (last ? 0.9 : 0.99) : 1)); parent.add(k);
    if (i > 0) {
      const rp = r * Math.pow(taper, i - 1), A = new THREE.Vector3(...pts[i - 1]), d = new THREE.Vector3(...pts[i]).sub(A), len = d.length();
      const m = new THREE.Mesh(taper < 1 ? FINGER_T : FINGER, mat); m.scale.set(rp, rp, len); m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Z_AXIS, d.normalize()); parent.add(m);
    }
  }
}
const finger = (parent, mat, pts, r) => chain(parent, mat, pts, r, 0.86);
// gun = userData der Waffe (gripTop, gripW, support, rear). Die Arme hängen an der Waffe und bewegen sich mit ihr.
export function makeViewArms(suit, gun) {
  const g = new THREE.Group(), col = SUIT_COL[suit] || 0x1fd6b4;
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x1c2126, emissive: 0x0c1014, emissiveIntensity: 0.7, roughness: 0.8, bumpMap: neoprene(), bumpScale: 1.2 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x353d45, emissive: 0x141a20, emissiveIntensity: 0.65, roughness: 0.55, bumpMap: neoprene(), bumpScale: 0.8 });
  const acc = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4, roughness: 0.45, bumpMap: neoprene(), bumpScale: 0.6 });
  const big = suit === 'bulwark' ? 1.3 : suit === 'manta' ? 0.9 : 1;   // Bollwerk hat dicke Panzerarme
  const t = gun.gripTop, w = gun.gripW, back = gun.rear + 0.2, R = w / 2 + 0.009;
  // rechte Hand: Handfläche rechts am Griff, die Finger legen sich vorne herum bis auf die linke Seite
  const palm = add(g, RBOX, glove, R + 0.006, t - 0.047, 0.008); palm.scale.set(0.024, 0.078, 0.06);   // Handfläche rechts am Griff
  add(g, RBOX, glove, R * 0.25, t - 0.03, 0.034).scale.set(w + 0.024, 0.05, 0.032);                   // Handballen hinter dem Griff
  add(g, RBOX, glove, R + 0.012, t - 0.03, -0.004).scale.set(0.012, 0.064, 0.03);                      // Fingerknöchel-Polster
  for (let i = 0; i < 3; i++) {                                                                  // Mittel-, Ring-, kleiner Finger
    const y = t - 0.034 - i * 0.02, f = -(0.028 - i * 0.004), r = 0.0098 - i * 0.0008;
    finger(g, glove, [[R, y, f + 0.026], [R + 0.002, y, f - 0.004], [0, y - 0.002, f - 0.014], [-R, y - 0.002, f - 0.002], [-R - 0.002, y - 0.001, f + 0.016]], r);
  }
  finger(g, glove, [[R, t - 0.014, -0.006], [R - 0.002, t - 0.016, -0.034], [0.006, t - 0.02, -0.052], [0, t - 0.03, -0.058]], 0.009);   // Zeigefinger am Abzug
  finger(g, glove, [[R * 0.6, t - 0.04, 0.03], [-R * 0.3, t - 0.02, 0.026], [-R - 0.004, t - 0.008, 0.004], [-R - 0.004, t - 0.004, -0.02]], 0.0105);   // Daumen
  chain(g, acc, [[0.004, t - 0.058, 0.034], [0.01, t - 0.07, 0.07]], 0.031 * big);                // Bündchen in Anzugfarbe
  // Klettverschluss am Handgelenk wie bei echten Tauchhandschuhen
  const strapM = new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.9, bumpMap: neoprene(), bumpScale: 2 });
  const strap = add(g, RBOX, strapM, 0.007, t - 0.064, 0.048); strap.scale.set(0.07 * big, 0.068 * big, 0.016); strap.rotation.x = -0.3;
  add(g, RBOX, acc, 0.04 * big, t - 0.062, 0.048).scale.set(0.01, 0.03, 0.02);                          // Lasche
  chain(g, sleeve, [[0.01, t - 0.07, 0.068], [0.16, t - 0.34, back]], 0.036 * big);              // Unterarm bis aus dem Bild
  if (big > 1.2) { const p = add(g, RBOX, acc, 0.05, t - 0.13, 0.19); p.scale.set(0.09, 0.05, 0.16); p.rotation.set(-0.6, 0.3, 0.2); }   // Panzerplatte
  // linke Hand (Gewehre und Werfer): Handfläche unten, Finger rechts hoch, Daumen links
  const right = g; g.userData.left = null;
  if (gun.support) {
    const g = new THREE.Group(); right.add(g); right.userData.left = g;
    const [sx, sy, sz] = gun.support;
    const h = add(g, RBOX, glove, sx, sy - 0.022, sz + 0.005); h.scale.set(0.058, 0.026, 0.075);
    for (let i = 0; i < 4; i++) { const z = sz - 0.03 + i * 0.019, r = i === 3 ? 0.0078 : 0.0092; finger(g, glove, [[0.016, sy - 0.028, z], [0.032, sy - 0.012, z], [0.034, sy + 0.012, z - 0.003], [0.026, sy + 0.028, z - 0.006]], r); }
    finger(g, glove, [[-0.018, sy - 0.03, sz + 0.02], [-0.032, sy - 0.006, sz + 0.008], [-0.03, sy + 0.02, sz - 0.012]], 0.0105);
    chain(g, acc, [[-0.004, sy - 0.04, sz + 0.04], [-0.012, sy - 0.055, sz + 0.075]], 0.03 * big);
    chain(g, sleeve, [[-0.012, sy - 0.055, sz + 0.072], [-0.24, sy - 0.32, back]], 0.035 * big);
  }
  return right;
}
// Die linke Hand beim Nachladen: hält das Magazin zwischen Daumen und Fingern.
// setArm(hand, ellbogen) setzt die Hand an einen Punkt und zieht den Unterarm bis zum Ellbogen (außerhalb des Bildes).
export function makeReloadHand(suit) {
  const g = new THREE.Group(), col = SUIT_COL[suit] || 0x1fd6b4;
  const glove = new THREE.MeshStandardMaterial({ color: 0x353d45, emissive: 0x141a20, emissiveIntensity: 0.65, roughness: 0.55, bumpMap: neoprene(), bumpScale: 0.8 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x1c2126, emissive: 0x0c1014, emissiveIntensity: 0.7, roughness: 0.8, bumpMap: neoprene(), bumpScale: 1.2 });
  const acc = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4, roughness: 0.45 });
  const big = suit === 'bulwark' ? 1.3 : suit === 'manta' ? 0.9 : 1;
  const hand = new THREE.Group(); g.add(hand);
  add(hand, RBOX, glove, 0, -0.014, 0.014).scale.set(0.058, 0.026, 0.07);                                    // Handfläche
  for (let i = 0; i < 4; i++) { const x = -0.018 + i * 0.012; finger(hand, glove, [[x, -0.01, -0.012], [x, 0.008, -0.03], [x * 0.8, 0.02, -0.036]], i === 3 ? 0.0075 : 0.0088); }   // Finger umfassen das Magazin
  finger(hand, glove, [[0.026, -0.012, 0.01], [0.032, 0.006, -0.008], [0.026, 0.02, -0.02]], 0.01);         // Daumen
  const cuff = new THREE.Mesh(FINGER, acc), arm = new THREE.Mesh(FINGER, sleeve); g.add(cuff); g.add(arm);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3();
  const seg = (m, a, b, r) => { D.copy(b).sub(a); const l = D.length() || 0.001; m.scale.set(r, r, l); m.position.copy(a).addScaledVector(D, 0.5); m.quaternion.setFromUnitVectors(Z_AXIS, D.normalize()); };
  g.userData.setArm = (handPos, elbowPos) => {
    hand.position.copy(handPos);
    A.copy(handPos).add(new THREE.Vector3(0, -0.02, 0.03)); B.copy(elbowPos).sub(A).setLength(0.04).add(A);   // Bündchen immer 4 cm lang
    seg(cuff, A, B, 0.03 * big); seg(arm, B, elbowPos, 0.035 * big);
  };
  return g;
}

// ---------- Nachladen: Magazin wechseln ----------
// Die zweite Hand zieht das alte Magazin raus, steckt es hinten in den Rucksack (dort füllt es der Kompressor wieder),
// holt das vollste Magazin raus, schiebt es ein und klopft es fest. Die Abschnitte (0 = Anfang, 1 = fertig):
export const RELOAD_STEPS = {
  grab: 0.1,      // Waffe kippt (Boden nach links), Hand kommt zum Magazin
  pull: 0.2,      // altes Magazin rausziehen
  stow: 0.36,     // nach hinten in den Rucksack stecken
  fetch: 0.5,     // neues Magazin aus dem Rucksack holen
  insert: 0.6,    // einschieben – Klack!
  slap: 0.64,     // festklopfen
  toCock: 0.72,   // Waffe dreht zurück, Hand greift Schlitten / Spannhebel
  cockBack: 0.8,  // nach hinten ziehen
  release: 0.84,  // loslassen – schnappt nach vorne, fertig
};
// wie stark die Waffe gekippt ist (0 = normal, 1 = Boden ganz nach links)
export function reloadRoll(done) {
  const S = RELOAD_STEPS, k = (a, b) => { const x = Math.max(0, Math.min(1, (done - a) / (b - a))); return x * x * (3 - 2 * x); };
  if (done < S.slap) return k(0, S.grab);
  if (done < S.release) return 1 - 0.7 * k(S.slap, S.toCock);
  return 0.3 * (1 - k(S.release, 1));
}
const RV = { hand: new THREE.Vector3(), tmp: new THREE.Vector3(), mag: new THREE.Vector3(), out: new THREE.Vector3() };
// done = 0…1 Fortschritt, gunUD = userData der Waffe, rHand = makeReloadHand(...),
// pack / elbow = Rucksack und Ellbogen in Waffen-Koordinaten (beide außerhalb des Bildes)
export function poseReload(done, gunUD, rHand, pack, elbow) {
  const M = gunUD.mag, C = gunUD.cock, S = RELOAD_STEPS; if (!M) return;
  const k = (a, b) => { const x = Math.max(0, Math.min(1, (done - a) / (b - a))); return x * x * (3 - 2 * x); };
  const seat = M.seat, out = RV.out.copy(M.out).multiplyScalar(M.len + 0.04).add(seat);
  const bottom = (p, into = RV.hand) => into.copy(M.out).multiplyScalar(M.len).add(p);   // die Hand hält das Magazin unten
  let magPos = seat, showMag = true, newMag = done >= S.stow, cockZ = 0;
  if (done < S.grab) RV.hand.copy(pack).lerp(bottom(seat, RV.tmp), k(0, S.grab));
  else if (done < S.pull) { magPos = RV.mag.copy(seat).lerp(out, k(S.grab, S.pull)); bottom(magPos); }
  else if (done < S.stow) { magPos = RV.mag.copy(out).lerp(pack, k(S.pull, S.stow)); bottom(magPos); showMag = done < S.stow - 0.03; }
  else if (done < S.fetch) { magPos = RV.mag.copy(pack).lerp(out, k(S.stow, S.fetch)); bottom(magPos); showMag = done > S.stow + 0.03; }
  else if (done < S.insert) { magPos = RV.mag.copy(out).lerp(seat, k(S.fetch, S.insert)); bottom(magPos); }
  else if (done < S.slap) { bottom(seat); RV.hand.addScaledVector(M.out, -0.012 * Math.sin(k(S.insert, S.slap) * Math.PI)); }   // Klaps von unten
  else if (C && done < S.toCock) RV.hand.copy(bottom(seat, RV.tmp)).lerp(C.at, k(S.slap, S.toCock));                              // Hand zum Schlitten
  else if (C && done < S.cockBack) { cockZ = C.travel * k(S.toCock, S.cockBack); RV.hand.copy(C.at); RV.hand.z += cockZ; }      // nach hinten ziehen
  else if (C && done < S.release) { const r = Math.min(1, (done - S.cockBack) / ((S.release - S.cockBack) * 0.35)); cockZ = C.travel * (1 - r); RV.hand.copy(C.at); RV.hand.z += C.travel; RV.hand.x -= 0.02 * r; }   // loslassen
  else { const from = C ? RV.tmp.copy(C.at).setZ(C.at.z + C.travel) : bottom(seat, RV.tmp); RV.hand.copy(from).lerp(gunUD.support ? RV.mag.set(...gunUD.support) : pack, k(C ? S.release : S.slap, 1)); }
  M.g.position.copy(magPos); M.g.visible = showMag;
  M.fill.emissiveIntensity = newMag ? 1.8 : 0.35;     // altes Magazin dunkel (fast leer), neues hell (voll)
  if (C) C.g.position.z = cockZ;
  rHand.visible = true;
  rHand.userData.setArm(RV.hand, elbow);
}

// ---------- Wasserstrahl (Hitscan-Waffen) ----------
// Ein dicker, sehr hellblauer Strahl von (x0,y0,z0) bis (x1,y1,z1). r = Dicke (Radius) in Metern.
// Außen ein leuchtender blauer Mantel, innen ein fast weißer Kern – so sieht es nach Druckwasser aus.
const BEAM_GEO = zCyl(1, 1, 1, 10);
export function makeBeam(x0, y0, z0, x1, y1, z1, r) {
  const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0) || 0.01;
  const g = new THREE.Group();
  g.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  g.lookAt(x1, y1, z1);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x5fd4ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xe6faff, transparent: true, opacity: 0.95, depthWrite: false });
  const glowM = new THREE.Mesh(BEAM_GEO, glowMat); glowM.scale.set(r * 2.2, r * 2.2, len); g.add(glowM);
  const coreM = new THREE.Mesh(BEAM_GEO, coreMat); coreM.scale.set(r, r, len); g.add(coreM);
  // fade = 1 (frisch) … 0 (weg): der Strahl wird dünner und durchsichtiger
  g.userData.fade = (f) => {
    glowMat.opacity = 0.55 * f; coreMat.opacity = 0.95 * f;
    glowM.scale.x = glowM.scale.y = r * 2.2 * (0.6 + 0.4 * f);
    coreM.scale.x = coreM.scale.y = r * (0.4 + 0.6 * f);
  };
  g.userData.dispose = () => { glowMat.dispose(); coreMat.dispose(); };
  return g;
}
export { WCOL };
