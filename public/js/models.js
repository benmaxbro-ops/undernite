// Undernite - procedural models. Everything is built from primitives so the
// game ships without any binary assets. Forward is -z for all models.
import * as THREE from 'three';
import { SUITS, RARITY, FISH, BOSSES } from './shared.js';
import { makeRealFish, makeRealShark, makeRealOcto, makeRealBoss } from './creatures.js';
import { makeShip } from './ship.js';
import { buildRealDiver } from './diver.js';

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
      // Goliath-Finisher: beide Arme hoch über den Kopf … und runter!
      if (s.fin) {
        const p = s.fin.p, up = Math.min(1, p / 0.3), down = Math.max(0, Math.min(1, (p - 0.3) / 0.1));
        const x = p < 0.3 ? up * 1.9 : 1.9 - down * 2.3;
        for (const a of parts.arms) a.rotation.x = p < 0.75 ? x : s.pitch;
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
        } else if (f) {                          // Faust: zurückziehen … und zuschlagen
          const p = f.p, back = Math.min(1, p / 0.35), hit = Math.max(0, Math.min(1, (p - 0.38) / 0.07));
          parts.hand.rotation.x = handBase.x + back * 0.9 - hit * 1.4;
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
  /* 1 Nadler         */ { kind: 'rifle',  L: 0.28, H: 0.05,  W: 0.04,  barrel: 0.16, br: 0.009, gills: 3, stock: 'short', mag: true },
  /* 2 Splitterwerfer */ { kind: 'rifle',  L: 0.34, H: 0.06,  W: 0.05,  barrel: 0.3,  br: 0.02,  gills: 4, stock: 'full', pump: true },
  /* 3 Harpune        */ { kind: 'rifle',  L: 0.34, H: 0.05,  W: 0.04,  barrel: 0.45, br: 0.012, gills: 4, stock: 'full', scope: true },
  /* 4 Torpedowerfer  */ { kind: 'tube',   L: 0.75, R: 0.075, gills: 5 },
  /* 5 Bordtorpedo    */ { kind: 'tube',   L: 0.75, R: 0.075, gills: 5 },
  /* 6 Plasmalanze    */ { kind: 'rifle',  L: 0.4,  H: 0.065, W: 0.05,  barrel: 0.3,  br: 0.016, gills: 4, stock: 'full', scope: true, mag: true },
  /* 7 Schallkanone   */ { kind: 'tube',   L: 0.85, R: 0.095, gills: 6, dish: true },
];
const GUN_WHITE = 0xf2f7fa, GUN_BLUE = 0x2fa8ff;
// Profile werden pro Waffe nur einmal gebaut und dann wiederverwendet (spart Speicher)
const GUN_GEO = new Map();
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
  const white = new THREE.MeshStandardMaterial({ color: GUN_WHITE, emissive: 0x55606a, emissiveIntensity: 0.45, roughness: 0.3, metalness: 0.05 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x7d8b96, emissive: 0x1c252c, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a2229, emissive: 0x0a1218, emissiveIntensity: 0.5, roughness: 0.7 });
  const blue = new THREE.MeshStandardMaterial({ color: GUN_BLUE, emissive: GUN_BLUE, emissiveIntensity: 1.3, roughness: 0.3 });
  const gillIn = new THREE.MeshStandardMaterial({ color: 0x08233d, emissive: GUN_BLUE, emissiveIntensity: 0.15, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fe4ff, emissive: GUN_BLUE, emissiveIntensity: 0.25, transparent: true, opacity: 0.55, roughness: 0.05 });
  const fill = new THREE.MeshStandardMaterial({ color: 0x7fdcff, emissive: GUN_BLUE, emissiveIntensity: 1.6 });
  const part = (geo, mat, x = 0, y = 0, z = 0) => add(g, geo, mat, x, y, z);
  // Box von u0 bis u1 (vorne), v0 bis v1 (oben), Breite w, seitlich verschoben um x
  const box = (mat, u0, u1, v0, v1, w, x = 0) => { const m = part(GEO.box, mat, x, (v0 + v1) / 2, -(u0 + u1) / 2); m.scale.set(w, v1 - v0, u1 - u0); return m; };
  // Zylinder entlang der Waffe (nach vorne), von u0 bis u1 auf Höhe v
  const tube = (mat, u0, u1, v, r) => { const m = part(GEO.zcyl, mat, 0, v, -(u0 + u1) / 2); m.scale.set(r, r, u1 - u0); return m; };
  const side = (key, mat, pts, w, holes) => part(profileGeo(K + key, pts, w, holes), mat);
  const ring = (u, v, r, mat = blue) => tube(mat, u - 0.004, u + 0.004, v, r);
  const flaps = [];   // Kiemen-Lamellen
  let rear = 0, chargeBars = [];
  // muzzleAt = wo der Schuss rauskommt, gripTop/gripW = Griff für die rechte Hand, support = Stelle für die linke Hand
  let muzzleAt = [0, 0, 0], gripTop = 0, gripW = 0.04, support = null;
  // Kiemen: n senkrechte Schlitze auf beiden Seiten (x = ±sx), von u0 nach vorne, Höhe h um v
  const gills = (n, u0, du, v, h, sx) => {
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
      const u = u0 + i * du;
      box(gillIn, u - du * 0.25, u + du * 0.25, v - h / 2, v + h / 2, 0.004, s * sx);           // leuchtender Schlitz
      for (let k = 0; k < 3; k++) {                                                          // 3 Lamellen, die sich auffächern
        const hinge = new THREE.Group(); hinge.position.set(s * (sx + 0.002 + k * 0.0015), v, -(u + du * 0.3)); g.add(hinge);
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
  const grip = (top, w, len = 0.1) => {
    side('grip', metal, [[-0.006, top], [0.034, top], [0.016, top - len], [-0.03, top - len], [-0.026, top - len * 0.25]], w * 0.85);
    box(blue, -0.03, 0.016, top - len - 0.008, top - len, w * 0.9);                                         // blaue Bodenplatte
    for (let i = 1; i < 4; i++) box(dark, -0.026 + i * 0.002, 0.03 - i * 0.004, top - len * (0.2 + i * 0.2), top - len * (0.2 + i * 0.2) + 0.003, w * 0.87);   // Griffrillen
    side('guard', white, [[0.034, top], [0.1, top], [0.1, top - 0.01], [0.075, top - 0.036], [0.03, top - 0.036]], w * 0.35,
      [[[0.04, top - 0.006], [0.09, top - 0.006], [0.07, top - 0.028], [0.04, top - 0.028]]]);
    const trig = box(metal, 0.052, 0.058, top - 0.024, top - 0.002, w * 0.2); trig.rotation.x = 0.35;
  };

  if (P.kind === 'pistol') {
    const { L, H, W } = P;
    // Schlitten (oben, weiß) und Rahmen (unten)
    side('slide', white, [[-0.03, 0], [L - 0.03, 0], [L - 0.03, H * 0.75], [L - 0.04, H], [-0.025, H], [-0.03, H * 0.85]], W);
    side('frame', white, [[-0.022, -0.014], [L - 0.04, -0.014], [L - 0.04, 0], [-0.022, 0]], W * 0.88);
    box(metal, L * 0.45, L - 0.045, -0.02, -0.014, W * 0.5);                              // Schiene unten
    for (let i = 0; i < 6; i++) box(dark, -0.024 + i * 0.006, -0.021 + i * 0.006, H * 0.15, H * 0.9, W + 0.002);   // Griffrillen am Schlitten
    tube(metal, L - 0.035, L - 0.02, H * 0.5, P.br * 1.3);                                // Lauf
    ring(L - 0.02, H * 0.5, P.br * 1.5);                                                  // blaue Mündung
    tube(dark, L - 0.02, L - 0.017, H * 0.5, P.br * 0.8);
    box(dark, -0.026, -0.02, H, H + 0.007, 0.008, -0.007); box(dark, -0.026, -0.02, H, H + 0.007, 0.008, 0.007);   // Kimme
    box(blue, L - 0.05, L - 0.045, H, H + 0.007, 0.004);                                  // Korn (blau leuchtend)
    box(glass, 0.02, 0.09, H - 0.003, H + 0.001, W * 0.5);                                // Fenster oben
    chargeBar(0.015, 0.075, H * 0.25, 0.008, W / 2 + 0.002);
    gills(3, 0.085, 0.024, H * 0.5, H * 0.75, W / 2 + 0.002);
    grip(-0.014, W);
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
    // Druckpatrone (Magazin): durchsichtig, innen leuchtet das Wasser
    if (P.mag) {
      const mu = front * 0.45, mv = -H / 2 - 0.05;
      const m1 = part(GEO.cyl, glass, 0, mv, -mu); m1.scale.set(0.017, 0.09, 0.017); m1.rotation.x = -0.25;
      const m2 = part(GEO.cyl, fill, 0, mv, -mu); m2.scale.set(0.011, 0.075, 0.011); m2.rotation.x = -0.25;
      const m3 = part(GEO.cyl, metal, 0, mv - 0.046, -mu - 0.012); m3.scale.set(0.019, 0.012, 0.019); m3.rotation.x = -0.25;
    }
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
    ring(-back + 0.01, 0, H * 0.45);
    chargeBar(-back * 0.85, -back * 0.15, H * 0.15, 0.012, W / 2 + 0.002);
    gills(P.gills, front * 0.15, 0.03, H * 0.05, H * 0.75, W / 2 + 0.002);
    grip(-H / 2, W);
    muzzleAt = [0, bv, -(tip + 0.045)]; gripTop = -H / 2; gripW = W; support = [0, -H * 0.42, -(front + hg * 0.5)];
  } else {
    // Werferrohr
    const { L, R } = P, u0 = -L * 0.3, u1 = L * 0.7;
    tube(white, u0, u1, 0, R);
    tube(metal, u1, u1 + 0.03, 0, R * 1.12);                                                // vorderer Rand
    tube(dark, u1 + 0.02, u1 + 0.031, 0, R * 0.85);                                         // dunkle Öffnung
    tube(metal, u0 - 0.03, u0, 0, R * 1.08);                                                // hintere Kappe
    tube(dark, u0 - 0.032, u0 - 0.028, 0, R * 0.7);
    for (const u of [u0 + 0.04, L * 0.15, u1 - 0.05]) ring(u, 0, R * 1.03);                 // blaue Bänder
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
  Object.assign(g.userData, { muzzle, gripTop, gripW, support, fpShift });
  g.userData.setGills(0); g.userData.setCharge(1);
  return g;
}

// ---------- Arme und Hände in der Ego-Perspektive ----------
const Z_AXIS = new THREE.Vector3(0, 0, 1);
// ein Zylinder von Punkt a nach Punkt b (für Arme und Finger)
function limb(parent, mat, a, b, r) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), len = d.length();
  const m = new THREE.Mesh(GEO.zcyl, mat); m.scale.set(r, r, len);
  m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Z_AXIS, d.normalize());
  parent.add(m); return m;
}
// gun = userData der Waffe (gripTop, gripW, support, rear). Die Arme werden an die Waffe gehängt und bewegen sich mit ihr.
export function makeViewArms(suit, gun) {
  const g = new THREE.Group(), col = SUIT_COL[suit] || 0x1fd6b4;
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x1a1f24, emissive: 0x0c1014, emissiveIntensity: 0.7, roughness: 0.85 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x343c44, emissive: 0x141a20, emissiveIntensity: 0.7, roughness: 0.6 });
  const acc = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.45, roughness: 0.5 });
  const big = suit === 'bulwark' ? 1.3 : suit === 'manta' ? 0.9 : 1;   // Bollwerk hat dicke Panzerarme
  const t = gun.gripTop, w = gun.gripW, back = gun.rear + 0.2;
  // rechte Hand: umschließt den Griff, Zeigefinger am Abzug, Daumen auf der linken Seite
  const palm = add(g, GEO.box, glove, 0, t - 0.04, 0.004); palm.scale.set(w + 0.026, 0.065, 0.05);
  for (let i = 0; i < 3; i++) { const y = t - 0.032 - i * 0.019, z = -(0.03 - i * 0.005); limb(g, glove, [-w / 2 - 0.012, y, z], [w / 2 + 0.012, y, z], 0.0095); }
  limb(g, glove, [w / 2 + 0.006, t - 0.012, -0.025], [0.004, t - 0.018, -0.06], 0.008);
  limb(g, glove, [-w / 2 - 0.011, t - 0.035, 0.018], [-w / 2 - 0.011, t - 0.008, -0.028], 0.0095);
  limb(g, acc, [0, t - 0.055, 0.025], [0.006, t - 0.065, 0.065], 0.031 * big);                // Bündchen in Anzugfarbe
  limb(g, sleeve, [0.006, t - 0.065, 0.06], [0.16, t - 0.34, back], 0.036 * big);            // Unterarm bis aus dem Bild
  if (big > 1.2) limb(g, acc, [0.03, t - 0.1, 0.13], [0.07, t - 0.16, 0.25], 0.043 * big);     // Panzerplatte
  // linke Hand (Gewehre und Werfer): stützt die Waffe vorne von unten
  if (gun.support) {
    const [sx, sy, sz] = gun.support;
    const h = add(g, GEO.box, glove, sx, sy - 0.012, sz); h.scale.set(0.05, 0.05, 0.075);
    for (let i = 0; i < 3; i++) { const z = sz - 0.025 + i * 0.022; limb(g, glove, [0.026, sy - 0.02, z], [0.026, sy + 0.022, z - 0.004], 0.0085); }
    limb(g, glove, [-0.026, sy - 0.015, sz + 0.02], [-0.026, sy + 0.02, sz - 0.01], 0.009);
    limb(g, acc, [0, sy - 0.035, sz + 0.035], [-0.01, sy - 0.05, sz + 0.07], 0.03 * big);
    limb(g, sleeve, [-0.01, sy - 0.05, sz + 0.065], [-0.24, sy - 0.32, back], 0.035 * big);
  }
  return g;
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
