// Undernite - browser client: networking, input, camera, entity sync, effects.
import * as THREE from 'three';
import { World, SUITS, WEAPONS, WEAPON_IDS, RARITY, VEHICLES, VEHICLE_IDS, CREATURES, CREATURE_IDS, SURFACE, dirFrom, segSphere, FINISHER,
  creatureR, FISH, BOSSES, EXP_BOAT, LAMPS, catchFromNet, catchName, catchRate, deepGlow } from './shared.js';
import { buildEnvironment } from './world.js';
import { makePlayerModel, makeShark, makeOcto, makeJelly, makeSub, makeScooter, makeCrate, makePickup, makeProjectile, makeBeam, makeWaterGun, makeViewArms, makeReloadHand, poseReload, RELOAD_STEPS, makeFish, makeBoss, makeTrophy } from './models.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';
import { startFinisher } from './finisher.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x2b8fb0, 0.01);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.25, 900);
camera.rotation.order = 'YXZ'; scene.add(camera);
const hemi = new THREE.HemisphereLight(0xb5e8ff, 0x12303c, 1.25); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xdff6ff, 1.35); sun.position.set(0.35, 1, 0.2); scene.add(sun);
const lamp = new THREE.SpotLight(0xe6fbff, 0, 90, 0.42, 0.8, 1.1); lamp.position.set(0, -1.2, 0);
camera.add(lamp); lamp.target.position.set(0, 0, -1); camera.add(lamp.target);
// visible light cone of the expedition flashlight (apex at the diver, opening towards -z)
const torchBeam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0).rotateX(Math.PI / 2),
  new THREE.ShaderMaterial({   // bright at the lamp, fading out towards the end of the cone
    uniforms: { c: { value: new THREE.Color(0xfff3c4) }, o: { value: 0.11 } },
    vertexShader: 'varying float vz; void main() { vz = -position.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 c; uniform float o; varying float vz; void main() { gl_FragColor = vec4(c, o * pow(1.0 - vz, 1.8)); }',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
torchBeam.rotation.order = 'YXZ'; torchBeam.visible = false; scene.add(torchBeam);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const hud = new Hud(), sfx = new Sfx();
const dyn = new THREE.Group(); scene.add(dyn);
let W = null, env = null;
let mode = 'br', phase = 'connecting', myId = 0, mySuit = 'triton', you = null, zone = null, aliveN = 0, frameNo = 0, time = 0;
const meta = new Map(), players = new Map(), creatures = new Map(), vehicles = new Map(), pickups = new Map(), projs = new Map();
let crates = [];
const me = { x: 0, y: 60, z: 0, vx: 0, vy: 0, vz: 0, hyaw: 0, hpitch: 0, byaw: 0, bpitch: 0, energy: 100, boost: false, exhaust: false };
const LAVA_SKY = new THREE.Color(0xff9a50), LAVA_GROUND = new THREE.Color(0xff3a08), PRIM_SKY = new THREE.Color(0x6fa8ff), PRIM_GROUND = new THREE.Color(0x10204a);
let held = -1;   // expedition: index of the caught fish/boss in your hand (-1 = weapon)
// Wasserstrahlen der Hitscan-Waffen, die gerade sichtbar sind. BEAM_TIME = wie lange einer zu sehen ist (Sekunden).
const beams = [], BEAM_TIME = 0.18;
// Waffe in der Ego-Perspektive: hängt an der Kamera, rechts unten im Bild.
// gills = wie weit die Kiemen offen sind (0…1), charge = wie voll das Druckfenster ist (0…1), kick = Rückstoß nach einem Schuss
const view = { g: new THREE.Group(), gun: null, arms: null, rHand: null, widx: -2, gills: 0, charge: 0, kick: 0, bob: 0, tilt: 0, rsnd: 0 };
view.g.position.set(0.15, -0.13, 0);   // rechts, unten (die Tiefe kommt von der Waffe selbst, siehe updateViewModel)
camera.add(view.g);
// firstPerson = Taste V gedrückt (Ego-Perspektive), fpOn = sie ist gerade wirklich aktiv (nicht in Fahrzeugen)
let firstPerson = false, fpOn = false;
let camYaw = 0, camPitch = -0.35, camDist = 5, firing = false, nextFire = 0, specId = 0, shockUntil = 0, shake = 0, deadInfo = null, promptT = 0, sendT = 0;
let vehSince = 0, headUp = 0;
// expedition flashlight: on/off with L, battery in seconds, recharges at the surface
const torch = { on: false, bat: LAMPS[0].battery, lvl: 0, hinted: false };
const keys = {};
const lerpAngle = (a, b, k) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };
const approachAngle = (a, b, step) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return a + Math.max(-step, Math.min(step, d)); };
const volAt = (x, y, z) => { const d = Math.hypot(x - camera.position.x, y - camera.position.y, z - camera.position.z); return Math.max(0, 1 - d / 95) ** 2; };

// ---------- network ----------
const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
const send = (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
ws.onclose = () => hud.conn(true);
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.t === 's') onSnap(m);
  else if (m.t === 'welcome') { myId = m.id; send({ t: 'set', name: prefs.name, suit: prefs.suit }); }
  else if (m.t === 'meta') { for (const p of m.players) meta.set(p[0], { name: p[1], suit: p[2], bot: !!p[3] }); }
  else if (m.t === 'lobby') { ensureWorld(m.seed, m.mode); if (phase !== 'play') { phase = 'lobby'; clearDyn(); hud.show('lobby'); if (document.pointerLockElement) document.exitPointerLock(); } hud.setLobby(m, myId); const mine = m.players.find(p => p.id === myId); if (mine) mySuit = mine.suit; }
  else if (m.t === 'start') onStart(m);
  else if (m.t === 'end') { phase = 'end'; hud.end(m, myId); hud.show('end'); if (document.pointerLockElement) document.exitPointerLock(); }
};
const prefs = hud.buildLobby((c) => {
  sfx.init();
  if (c.start) { send({ t: 'start' }); canvas.requestPointerLock?.(); }
  else if (c.mode) send({ t: 'set', mode: c.mode });
  else send({ t: 'set', ...c });
});

function ensureWorld(seed, wmode = 'br') {
  if (env && env.seed === seed && env.mode === wmode) return;
  if (env) env.dispose();
  W = new World(seed, wmode); env = buildEnvironment(scene, W);
}
// ---------- expedition shop ----------
const nearBoat = () => Math.hypot(me.x - EXP_BOAT.x, me.z - EXP_BOAT.z) < 20 && SURFACE - me.y < 9;
// your own base (the server gives every diver one of the 6); foreign bases only refill air
const myBase = () => W && W.bases && you && you.x && you.x.base != null ? W.bases[you.x.base] : null;
const nearBase = () => { const b = myBase(); return !!b && Math.hypot(me.x - b.c.x, me.y - b.c.y, me.z - b.c.z) < 16; };
const otherBaseOwner = () => { if (!W || !W.bases) return null; const i = W.bases.findIndex(b => Math.hypot(me.x - b.c.x, me.y - b.c.y, me.z - b.c.z) < 16);
  if (i < 0 || (you && you.x && i === you.x.base)) return null; const o = (baseInfo || []).find(b => b[0] === i); return o ? o[2] : 'niemand'; };
let baseInfo = null;   // [[base index, owner id, owner name, aquarium], ...] from the server
function openShop(kind) { hud.openShop(you, kind); firing = false; if (document.pointerLockElement) document.exitPointerLock(); }
function closeShop() { hud.closeShop(); lock(); }
hud.initShop((k, i) => send({ t: 'buy', k, i }), closeShop, () => { hud.closeShop(); send({ t: 'quit' }); });
function clearDyn() {
  dyn.clear(); players.clear(); creatures.clear(); vehicles.clear(); pickups.clear(); projs.clear(); crates = [];
  you = null; zone = null; deadInfo = null; specId = 0;
}
function onStart(m) {
  mode = m.mode || 'br';
  ensureWorld(m.seed, mode); clearDyn();
  phase = 'play'; meta.clear(); hud.setMode(mode);
  torch.on = false; torchBeam.visible = false;
  for (const p of m.players) meta.set(p[0], { name: p[1], suit: p[2], bot: !!p[3] });
  if (meta.has(myId)) mySuit = meta.get(myId).suit;
  if (mode === 'br') crates = W.crates.map((c, i) => { const g = makeCrate(); g.position.set(c.x, c.y, c.z); g.rotation.y = c.yaw; if (m.crates[i]) g.userData.open(); dyn.add(g); return g; });
  for (const p of m.pickups) addPickup(p);
  if (m.spawn) { me.x = m.spawn[0]; me.y = m.spawn[1]; me.z = m.spawn[2]; me.vx = me.vy = me.vz = 0; camYaw = m.spawn[3]; camPitch = -0.55; me.energy = 100; }
  hud.show('game'); hud.spec(null);
  hud.banner(mode === 'exp' ? 'Tiefsee-Expedition! Jag Fische und verkauf sie am Boot.' : m.spectator ? 'Runde läuft – du schaust zu' : 'Abtauchen! Such dir Ausrüstung.', 4);
  hud.pause(!document.pointerLockElement);
}
function addPickup(p) {
  const mesh = makePickup(p[1], p[2], p[3]); mesh.position.set(p[4], p[5], p[6]); dyn.add(mesh);
  pickups.set(p[0], { id: p[0], k: p[1], wid: p[2], rar: p[3], x: p[4], y: p[5], z: p[6], mesh });
}
function spawnPlayer(id) {
  const m = meta.get(id) || { name: '?', suit: 'triton' };
  const mesh = makePlayerModel(m.suit, id, id === myId ? null : m.name); dyn.add(mesh);
  const e = { id, mesh, suit: m.suit, name: m.name, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, tx: 0, ty: 0, tz: 0, tyaw: 0, tpitch: 0, hp: 0, fl: 0, w: 0, veh: 0, fresh: true, speed: 0, seen: 0, bubT: 0 };
  players.set(id, e); return e;
}
function sync(map, id, make) {
  let e = map.get(id);
  if (!e) { e = make(); e.fresh = true; e.speed = 0; dyn.add(e.mesh); map.set(id, e); }
  e.seen = frameNo; return e;
}
function prune(map) { for (const [id, e] of map) if (e.seen !== frameNo) { dyn.remove(e.mesh); map.delete(id); } }
function target(e, a, o) { e.tx = a[o]; e.ty = a[o + 1]; e.tz = a[o + 2]; e.tyaw = a[o + 3]; e.tpitch = a[o + 4]; if (e.fresh) { e.x = e.tx; e.y = e.ty; e.z = e.tz; e.yaw = e.tyaw; e.pitch = e.tpitch; e.fresh = false; } }

function onSnap(m) {
  if (phase !== 'play') return;
  const c = m.c; frameNo++;
  zone = c.z; aliveN = c.n; baseInfo = c.b || null;
  const wasAlive = you && you.alive;
  you = m.you;
  for (const a of c.p) { const e = players.get(a[0]) || spawnPlayer(a[0]); e.seen = frameNo; target(e, a, 1); e.hp = a[6]; e.fl = a[8]; e.w = e.weapon = a[9]; e.veh = a[10]; }
  prune(players);
  for (const a of c.c) {
    const type = CREATURE_IDS[a[1]];
    const e = sync(creatures, a[0], () => ({ type, sub: a[8], gold: a[10], r: creatureR(type, a[8]),
      mesh: type === 'shark' ? makeShark() : type === 'octo' ? makeOcto() : type === 'fish' ? makeFish(FISH[a[8]], a[10]) : type === 'boss' ? makeBoss(BOSSES[a[8]]) : makeJelly(a[0]) }));
    target(e, a, 2); e.state = a[7]; e.hpPct = a[9];
  }
  prune(creatures);
  for (const a of c.v) { const type = VEHICLE_IDS[a[1]]; const e = sync(vehicles, a[0], () => ({ type, mesh: type === 'sub' ? makeSub() : makeScooter() })); target(e, a, 2); e.hp = a[7]; e.driver = a[8]; }
  prune(vehicles);
  for (const e of c.e) onEvent(e);
  for (const e of m.ye) onPrivate(e);
  if (wasAlive && you && !you.alive && document.pointerLockElement) { /* keep lock for spectating */ }
}

// Wo ist die Mündung der Waffe von Spieler id gerade? (in der Ego-Perspektive: die Waffe vor der Kamera)
const MZ = new THREE.Vector3();
function muzzleOf(id) {
  let m = null;
  if (id === myId && view.g.visible && view.gun) m = view.gun.userData.muzzle;
  else { const e = players.get(id); if (e && e.mesh.visible && e.mesh.userData.muzzle) m = e.mesh.userData.muzzle(); }
  return m ? m.getWorldPosition(MZ) : null;
}
// Knapp vorbei: wie nah (Meter) ein fremder Schuss an dir vorbei muss, damit es "Schusch" macht
const NEAR_MISS = 2.5;
function whooshAt(x, y, z, d) {
  const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);                     // "rechts" von der Kamera aus
  const side = ((x - me.x) * rx + (z - me.z) * rz) / Math.max(0.3, d);
  sfx.whoosh(1 - d / (NEAR_MISS + 0.5), side);
}
function nearMiss(x0, y0, z0, x1, y1, z1) {
  if (!you || !you.alive) return;
  // der Punkt auf dem Strahl, der mir am nächsten ist
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L = dx * dx + dy * dy + dz * dz || 1;
  const k = Math.max(0, Math.min(1, ((me.x - x0) * dx + (me.y - y0) * dy + (me.z - z0) * dz) / L));
  const px = x0 + dx * k, py = y0 + dy * k, pz = z0 + dz * k, d = Math.hypot(px - me.x, py - me.y, pz - me.z);
  if (d < NEAR_MISS) whooshAt(px, py, pz, d);
}
function addBeam(x0, y0, z0, x1, y1, z1, r) {
  const mesh = makeBeam(x0, y0, z0, x1, y1, z1, r);
  dyn.add(mesh);
  beams.push({ mesh, t: BEAM_TIME });
}
function onEvent(e) {
  switch (e[0]) {
    case 'pj': {
      // sichtbarer Start an der Mündung der Waffe (der Server rechnet weiter mit seinem eigenen Startpunkt)
      const mz = muzzleOf(e[3]); if (mz) { e[4] = mz.x; e[5] = mz.y; e[6] = mz.z; }
      const widx = e[2], def = WEAPONS[WEAPON_IDS[widx]], mesh = makeProjectile(widx);
      mesh.position.set(e[4], e[5], e[6]); mesh.lookAt(e[4] + e[7], e[5] + e[8], e[6] + e[9]); dyn.add(mesh);
      projs.set(e[1], { mesh, x: e[4], y: e[5], z: e[6], dx: e[7], dy: e[8], dz: e[9], sp: def.speed, life: def.life, trail: widx >= 4 ? 0.03 : 0.09, tt: 0, mine: e[3] === myId });
      if (def.pellets === 1 || !projs.lastShot || projs.lastShot !== time) sfx.shot(widx, e[3] === myId ? 1 : volAt(e[4], e[5], e[6]));
      projs.lastShot = time;
      if (e[3] === myId) { shake = Math.max(shake, widx >= 3 ? 0.25 : 0.08); view.kick = 1; }
      break;
    }
    case 'beam': {
      // Hitscan-Wasserstrahl: e = ['beam', Waffe, Schütze, Start x y z, Ende x y z]
      const widx = e[1], def = WEAPONS[WEAPON_IDS[widx]];
      const mz = muzzleOf(e[2]); if (mz) { e[3] = mz.x; e[4] = mz.y; e[5] = mz.z; }   // der Strahl beginnt an der Mündung
      addBeam(e[3], e[4], e[5], e[6], e[7], e[8], def.beam || 0.06);
      if (e[2] !== myId) nearMiss(e[3], e[4], e[5], e[6], e[7], e[8]);
      // ein paar Blasen entlang des Strahls
      for (let i = 0; i < 4; i++) { const k = Math.random(); env.bubble(e[3] + (e[6] - e[3]) * k, e[4] + (e[7] - e[4]) * k, e[5] + (e[8] - e[5]) * k, 1, 0.15, 0.5); }
      // Splitterwerfer schießt 7 Strahlen gleichzeitig – das Geräusch nur einmal abspielen
      if (beams.lastShot !== time) sfx.jet(widx, e[2] === myId ? 1 : volAt(e[3], e[4], e[5]));
      beams.lastShot = time;
      if (e[2] === myId) { shake = Math.max(shake, widx >= 3 ? 0.25 : 0.08); view.kick = 1; }
      break;
    }
    case 'hit': removeProj(e[1]); env.bubble(e[2], e[3], e[4], 7, 0.4, 2); if (e[5] === 1 || e[5] === 3) env.blood(e[2], e[3], e[4]); sfx.hit(volAt(e[2], e[3], e[4])); break;
    case 'boom': { removeProj(e[1]); env.explosion(e[2], e[3], e[4], e[5]); const v = volAt(e[2], e[3], e[4]); sfx.boom(v); shake = Math.max(shake, v * 0.9); break; }
    case 'kill': { const mine = e[3] === myId || e[4] === myId; hud.feed(`<b>${esc(e[1])}</b> ▸ <i>${esc(e[2])}</i>`, mine); break; }
    case 'pk+': addPickup(e.slice(1)); break;
    case 'pk-': { const p = pickups.get(e[1]); if (p) { dyn.remove(p.mesh); pickups.delete(e[1]); } break; }
    case 'crate': { const c = crates[e[1]]; if (c) { c.userData.open(); env.bubble(c.position.x, c.position.y + 1, c.position.z, 14, 1, 1); if (volAt(c.position.x, c.position.y, c.position.z) > 0.3) sfx.crate(); } break; }
    case 'msg': hud.banner(e[1], 3.2); sfx.ping(); break;
    case 'cdie': env.blood(e[2], e[3], e[4]); env.bubble(e[2], e[3], e[4], 22, 1.5, 2); break;
    case 'bite': env.blood(e[1], e[2], e[3]); sfx.bite(volAt(e[1], e[2], e[3])); break;
    case 'ink': env.ink(e[1], e[2], e[3]); break;
    case 'fin': {
      // der Gegner verschwindet sofort, an seiner Stelle spielt eine Kopie die Finisher-Animation
      const ve = players.get(e[2]); if (ve) { dyn.remove(ve.mesh); players.delete(e[2]); }
      const f = startFinisher(finCtx, e);
      fins.push(f);
      if (e[1] === myId) { myFin = f; firing = false; }
      break;
    }
  }
}
// ---------- Finisher ----------
const fins = [];      // alle Finisher, die gerade laufen
let myFin = null;     // mein eigener (dann steuert die Animation meinen Taucher und die Kamera)
let lastGrunt = 0;
const finCtx = {
  dyn, sfx, get env() { return env; },
  posOf: (id) => id === myId ? me : players.get(id),
  muzzleOf, beam: addBeam, shake: (v) => { shake = Math.max(shake, v); }, zone: () => zone,
};
// welcher Gegner kann gerade gefinisht werden? (nah genug und wenig Leben)
function finTarget() {
  if (mode === 'exp' || !you || !you.alive || you.veh || myFin) return null;
  const range = FINISHER.range[mySuit]; let best = null, bd = 1e9;
  for (const e of players.values()) {
    if (e.id === myId || !e.mesh.visible || e.hp > SUITS[e.suit].hp * FINISHER.hp) continue;
    const d = Math.hypot(e.x - me.x, e.y - me.y, e.z - me.z);
    if (d < range && d < bd) { bd = d; best = e; }
  }
  return best;
}
function updateFinishers(dt) {
  for (let i = fins.length - 1; i >= 0; i--) if (!fins[i].update(dt)) { if (fins[i] === myFin) myFin = null; fins.splice(i, 1); }
  // während meines Finishers bewegt die Animation meinen Taucher
  if (myFin && myFin.pose) { const P = myFin.pose; me.x = P.x; me.y = P.y; me.z = P.z; me.vx = me.vy = me.vz = 0; me.byaw = P.yaw; me.bpitch = 0; }
}
function onPrivate(e) {
  switch (e[0]) {
    case 'hurt': {
      if (e[4]) { hud.hurt(null); break; }
      const rel = Math.atan2(e[2] - me.x, -(e[3] - me.z)) + camYaw;
      hud.hurt(rel); sfx.hurt(); shake = Math.max(shake, 0.35);
      // Treffer-Wackler: die Kamera wird kurz zur Seite und nach oben gerissen (stärker bei mehr Schaden)
      const jolt = Math.min(0.08, 0.01 + e[1] * 0.0015);
      camYaw += (Math.random() - 0.5) * jolt * 1.5; camPitch += (Math.random() * 0.6 - 0.2) * jolt; view.kick = Math.max(view.kick, 0.6);
      if (time - lastGrunt > 0.7) { lastGrunt = time; sfx.grunt(mySuit === 'goliath' ? 1.5 : mySuit === 'bulwark' ? 1.15 : 1); }
      break;
    }
    // Treffer: e = ['hm', Schaden, Kill, Leben übrig 0…1, Schild zerbrochen]
    case 'hm': hud.hitmark(e[1], e[2], e[3]); sfx.hitmark(e[2]); if (e[4]) sfx.shieldBreak(1); break;
    case 'shb': sfx.shieldBreak(0.8); hud.banner('Schild zerstört!', 1.2); shake = Math.max(shake, 0.35); break;   // dein eigenes Schild
    case 'warn': hud.banner(e[1], 2.5); break;
    case 'grab': hud.banner('Ein Oktopus hat dich gepackt – F hämmern!', 3); break;
    case 'shock': shockUntil = time + 0.8; hud.shock(); sfx.shock(); break;
    case 'got': sfx.pickup(); hud.feed(e[1] === 'w' ? `Aufgenommen: <b style="color:${RARITY[e[3]].color}">${WEAPONS[e[2]].name}</b> · ${RARITY[e[3]].name}` : e[1] === 'med' ? 'Reparaturkit: <b>+50 Leben</b>' : 'Schildzelle: <b>+50 Schild</b>', true); break;
    case 'dead': held = -1; deadInfo = { place: e[1], by: e[2], lost: e[3] || 0 }; firing = false; if (hud.shopOpen) hud.closeShop(); break;
    case 'spawn': torch.on = false; torch.bat = LAMPS[torch.lvl].battery; me.x = e[1]; me.y = e[2]; me.z = e[3]; me.vx = me.vy = me.vz = 0; camYaw = e[4]; camPitch = -0.3; me.energy = 100; deadInfo = null; specId = 0; hud.spec(null); hud.banner('Du wachst am Boot wieder auf.', 2.5); break;
    case 'fish': { const S = FISH[e[1]]; sfx.pickup(); hud.feed(`${e[2] ? '⭐ <b style="color:#ffd34d">Goldener</b> ' : 'Gefangen: '}<b>${S.name}</b> · +${e[3]} €`, true); break; }
    case 'aqfree': hud.feed(`Freigelassen: <b>${catchName(catchFromNet(e[1]))}</b>`, true); break;
    case 'sold': hud.banner(`${e[1]} Fische verkauft: +${e[2].toLocaleString('de-DE')} €`, 3); sfx.ping(); break;
    case 'bought': hud.shopMsg(`Gekauft: ${e[1]}`, true); hud.feed(`Gekauft: <b>${esc(e[1])}</b>`, true); sfx.crate(); break;
    case 'shop': hud.shopMsg(e[1]); hud.banner(e[1], 2); break;
    case 'bagHint': hud.banner(`${e[1]} Fische dabei (${e[2].toLocaleString('de-DE')} €) – drück E zum Verkaufen!`, 4); break;
    case 'baseHint': hud.banner(e[1] ? 'Basis: Fang in die Hand (4–9) + E = ins Aquarium!' : 'Basis: Hier wird deine Luft aufgefüllt.', 4); sfx.ping(); break;
    case 'aqin': { const c = catchFromNet(e[1]); sfx.pickup(); hud.feed(`Ins Aquarium: <b>${catchName(c)}</b> · +${catchRate(c).toLocaleString('de-DE', { maximumFractionDigits: 2 })} €/s`, true); break; }
    case 'aqoffline': hud.banner(`Während du weg warst, hat dein Aquarium ${e[1].toLocaleString('de-DE')} € verdient!`, 5); sfx.ping(); break;
    case 'boss': hud.banner(`${BOSSES[e[1]].name} besiegt! Verkaufen: ${e[2].toLocaleString('de-DE')} € – oder ins Aquarium: ${BOSSES[e[1]].aq} €/s`, 6); hud.feed(`☠ <b>${BOSSES[e[1]].name}</b> ist in deiner Fang-Leiste – am Boot verkaufen <b>oder</b> in der Basis ins Aquarium setzen`, true); sfx.ping(); break;
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function removeProj(id) { const p = projs.get(id); if (p) { dyn.remove(p.mesh); projs.delete(id); } }

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (phase !== 'play' || !you || !you.alive) return;
  if (e.code === 'KeyV') { firstPerson = !firstPerson; return; }   // Ego-Perspektive an/aus
  if (e.code === 'KeyG') { const t = finTarget(); if (t) send({ t: 'fin', id: t.id }); return; }   // Finisher
  if (mode === 'exp' && e.code === 'KeyL') {
    if (torch.bat <= 0) hud.banner('Lampe leer – oben an der Oberfläche aufladen!', 2);
    else { torch.on = !torch.on; sfx.hitmark(false); }
    return;
  }
  if (mode === 'exp' && e.code === 'KeyE') {
    if (hud.shopOpen) closeShop();
    else if (held >= 0 && nearBase()) placeHeld();
    else if (nearBoat()) openShop('boat'); else if (nearBase()) openShop('base');
    return;
  }
  // catch bar: 4-9 take a fish/boss in the hand (same key again = back to the weapon), Q = next one
  if (mode === 'exp' && /^Digit[4-9]$/.test(e.code)) {
    const i = (held >= 6 ? held - 5 : 0) + (+e.code.slice(5) - 4);
    held = held === i || !you.x.bagL[i] ? -1 : i; firing = false; return;
  }
  if (mode === 'exp' && e.code === 'KeyQ') { const n = you.x.bagL.length; held = held + 1 < n ? held + 1 : -1; firing = false; return; }
  if (/^Digit[1-3]$/.test(e.code)) held = -1;
  if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') { const i = +e.code.slice(5) - 1; if (you.w[i]) send({ t: 'slot', i }); }
  else if (e.code === 'KeyR') send({ t: 'r' });
  else if (e.code === 'KeyE') send({ t: 'e' });
  else if (e.code === 'KeyF') { send({ t: 'x' }); env.bubble(me.x, me.y, me.z, 4, 1, 2); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; firing = false; });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  const sens = 0.0022 * camera.fov / FOV;   // mit Zoom (kleines Sichtfeld) entsprechend langsamer
  camYaw -= e.movementX * sens; camPitch = Math.max(-1.45, Math.min(1.45, camPitch - e.movementY * sens));
});
const lock = () => { sfx.init(); if (phase === 'play' && document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); };
canvas.addEventListener('mousedown', (e) => { if (document.pointerLockElement !== canvas) { lock(); return; } if (e.button === 2) { scoping = true; return; } if (e.button !== 0) return; if (held >= 0) { if (nearBase()) placeHeld(); return; } firing = true; });
document.getElementById('pause').addEventListener('click', lock);
addEventListener('mouseup', (e) => { if (e.button === 0) firing = false; if (e.button === 2) scoping = false; });
addEventListener('wheel', (e) => {
  if (phase !== 'play' || !you || !you.alive) return;
  const dir = e.deltaY > 0 ? 1 : -1;
  for (let k = 1; k <= 3; k++) { const i = (you.slot + dir * k + 6) % 3; if (you.w[i]) { if (i !== you.slot) send({ t: 'slot', i }); break; } }
}, { passive: true });
addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { hud.pause(phase === 'play' && document.pointerLockElement !== canvas); if (document.pointerLockElement !== canvas) firing = false; });

// ---------- local player ----------
function controlMe(dt) {
  const S = SUITS[mySuit], v = you.veh ? vehicles.get(you.veh) : null, vt = v ? v.type : null;
  let speed = S.speed, accel = 5, r = S.r, strafe = 1, canBoost = true;
  if (vt === 'scooter') { speed = VEHICLES.scooter.speed; accel = VEHICLES.scooter.accel; strafe = 0.35; r = VEHICLES.scooter.r; canBoost = false; }
  else if (vt === 'sub') { speed = VEHICLES.sub.speed; accel = VEHICLES.sub.accel; strafe = 0; r = VEHICLES.sub.r; canBoost = false; }
  if (vt === 'sub') { me.hyaw = approachAngle(me.hyaw, camYaw, 1.6 * dt); me.hpitch += Math.max(-1.1 * dt, Math.min(1.1 * dt, camPitch - me.hpitch)); }
  else { me.hyaw = camYaw; me.hpitch = camPitch; }
  const shop = hud.shopOpen;   // no swimming while shopping
  const f = shop ? 0 : (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = shop ? 0 : (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), u = shop ? 0 : (keys.Space ? 1 : 0) - (keys.KeyC || keys.KeyX ? 1 : 0);
  const fw = dirFrom(me.hyaw, me.hpitch), rx = Math.cos(me.hyaw), rz = -Math.sin(me.hyaw);
  let wx = fw[0] * f + rx * s * strafe, wy = fw[1] * f + u, wz = fw[2] * f + rz * s * strafe;
  const wl = Math.hypot(wx, wy, wz); if (wl > 1) { wx /= wl; wy /= wl; wz /= wl; }
  // body direction: swimming backwards (S) the diver turns around and faces where he swims;
  // otherwise (and while shooting) he looks where the camera looks
  const hl = Math.hypot(wx, wz);
  if (!vt && f < 0 && !firing && hl > 0.1) {
    me.byaw = approachAngle(me.byaw ?? me.hyaw, Math.atan2(-wx, -wz), 7 * dt);
    me.bpitch += (Math.atan2(wy, hl) * 0.8 - me.bpitch) * Math.min(1, dt * 5);
  } else {
    me.byaw = approachAngle(me.byaw ?? me.hyaw, me.hyaw, (vt ? 50 : 9) * dt);
    me.bpitch += (me.hpitch - me.bpitch) * Math.min(1, dt * (vt ? 50 : 8));
  }
  me.boost = canBoost && (keys.ShiftLeft || keys.ShiftRight) && wl > 0.1 && !me.exhaust;
  if (me.boost) { me.energy = Math.max(0, me.energy - 26 * dt); if (me.energy <= 0) me.exhaust = true; speed *= S.boost; }
  else { me.energy = Math.min(100, me.energy + 13 * dt); if (me.energy > 20) me.exhaust = false; }
  if (you.grab) speed *= 0.3;
  if (time < shockUntil) speed *= 0.5;
  const k = Math.min(1, accel * dt);
  me.vx += (wx * speed - me.vx) * k; me.vy += (wy * speed - me.vy) * k; me.vz += (wz * speed - me.vz) * k;
  me.x += me.vx * dt; me.y += me.vy * dt; me.z += me.vz * dt;
  // divers may swim right up until head and shoulders are out of the water (vehicles stay below)
  W.collide(me, r, vt ? undefined : SURFACE - 0.15);
  // splash when breaking through the surface
  const atTop = SURFACE - me.y < 0.6;
  if (atTop && !me.surfaced && me.vy > 0.5) { env.bubble(me.x, SURFACE - 0.4, me.z, 28, 1.4, 1.5); sfx.noise(0.45, 1100, 0.7, 0.35, 'lowpass', 250); }
  me.surfaced = atTop;
}
// ---------- aquariums in the underwater bases: every base shows its owner's fish ----------
const aqViews = new Map(); let aqWorld = null;
function updateAquarium(dt) {
  if (mode !== 'exp' || !env || !env.bases || !env.bases.length || !you || !you.x) return;
  if (aqWorld !== env) { aqWorld = env; aqViews.clear(); }   // new world
  env.bases.forEach((B, i) => updateTank(B, i, dt));
}
function updateTank(B, i, dt) {
  const o = (baseInfo || []).find(b => b[0] === i), list = o ? o[3] : [];
  let v = aqViews.get(i); if (!v) { v = { key: '', fish: [], label: '' }; aqViews.set(i, v); }
  const mine = !!o && o[1] === myId, label = !o ? 'Freie Basis' : mine ? '🐠 DEINE BASIS' : '🐠 Basis von ' + o[2];
  if (label !== v.label) { v.label = label; B.setOwner(label, mine); }
  const key = JSON.stringify(list);
  if (key !== v.key) {   // the fish in the tank changed: rebuild them
    v.key = key;
    for (const f of v.fish) f.mesh.removeFromParent();
    v.fish = list.map((net) => {
      const c = catchFromNet(net), mesh = makeTrophy(c, c.b != null ? 1.6 + c.b * 0.2 : 0.45 + FISH[c.s].size * 0.45); B.tank.add(mesh);
      const a = Math.random() * 6.28, r = Math.random() * B.tankR;
      return { mesh, x: Math.cos(a) * r, y: B.tankH[0] + Math.random() * (B.tankH[1] - B.tankH[0]), z: Math.sin(a) * r, tx: 0, ty: 2, tz: 0, yaw: 0, t: 0 };
    });
  }
  // only animate when you are close enough to see it
  if (Math.hypot(camera.position.x - B.group.position.x, camera.position.y - B.group.position.y, camera.position.z - B.group.position.z) > 80) return;
  for (const f of v.fish) {
    if ((f.t -= dt) <= 0) {
      f.t = 2 + Math.random() * 3; const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * B.tankR;
      f.tx = Math.cos(a) * r; f.tz = Math.sin(a) * r; f.ty = B.tankH[0] + Math.random() * (B.tankH[1] - B.tankH[0]);
    }
    const dx = f.tx - f.x, dy = f.ty - f.y, dz = f.tz - f.z, d = Math.hypot(dx, dy, dz) || 1, sp = Math.min(d, 0.6 * dt);
    f.x += dx / d * sp; f.y += dy / d * sp; f.z += dz / d * sp;
    f.yaw = lerpAngle(f.yaw, Math.atan2(-dx, -dz), Math.min(1, dt * 3));
    f.mesh.position.set(f.x, f.y, f.z);
    f.mesh.userData.update(dt, { yaw: f.yaw, pitch: Math.asin(Math.max(-0.5, Math.min(0.5, dy / d))) * 0.5, state: 0 });
  }
}
// minimap names: boat, "Deine Basis" for yours, the owner's name for the others
function expPois() {
  const l = [{ n: 'Boot', x: EXP_BOAT.x, z: EXP_BOAT.z }];
  W.bases.forEach((b, i) => { const o = (baseInfo || []).find(q => q[0] === i); if (you && you.x && you.x.base === i) l.push({ n: 'Deine Basis', x: b.c.x, z: b.c.z }); else if (o) l.push({ n: o[2], x: b.c.x, z: b.c.z }); });
  return l;
}
// put the fish/boss in your hand into the aquarium
function placeHeld() {
  if (held < 0 || !you.x.bagL[held]) return;
  send({ t: 'buy', k: 'aq', i: held }); held = -1;
}
function updateTorch(dt, depth) {
  const lvl = you.x.lamp || 0, L = LAMPS[lvl];
  if (lvl !== torch.lvl) { torch.lvl = lvl; torch.bat = L.battery; }   // new lamp bought: comes fully charged
  if (depth < 2.6) torch.bat = Math.min(L.battery, torch.bat + L.battery * 0.25 * dt);
  else if (torch.on && you.alive) {
    torch.bat = Math.max(0, torch.bat - dt);
    if (torch.bat <= 0) { torch.on = false; hud.banner('Lampe leer – oben an der Oberfläche aufladen!', 3); }
  }
  if (!torch.hinted && !torch.on && depth > 70 && torch.bat > 0) { torch.hinted = true; hud.banner('Zu dunkel? Drück L für die Taschenlampe!', 3.5); }
  lamp.intensity = torch.on && you.alive ? L.power : 0; lamp.distance = L.range; lamp.angle = L.angle;
  torchBeam.visible = lamp.intensity > 0;
  if (torchBeam.visible) {
    const len = L.range * 0.6, r = len * Math.tan(L.angle) * 0.75;
    torchBeam.scale.set(r, r, len);
    torchBeam.position.set(me.x, me.y + 0.3, me.z);
    torchBeam.rotation.set(camPitch, camYaw, 0);
  }
}
function aimDir() {
  const cd = dirFrom(camYaw, camPitch), cp = camera.position;
  let D = 150;
  const t = W.segmentHit(cp.x, cp.y, cp.z, cp.x + cd[0] * D, cp.y + cd[1] * D, cp.z + cd[2] * D);
  if (t > 0) D *= t;
  // aimAt merkt sich, wen das Fadenkreuz trifft: [1, id] = Spieler, [3, id] = Kreatur (für den Lag-Ausgleich am Server)
  aimAt = null;
  const test = (x, y, z, r, who) => { const tt = segSphere(cp.x, cp.y, cp.z, cd[0] * D, cd[1] * D, cd[2] * D, x, y, z, r); if (tt > 0) { D *= tt; aimAt = who; } };
  for (const e of players.values()) if (e.id !== myId) test(e.x, e.y, e.z, SUITS[e.suit].r, [1, e.id]);
  for (const [id, c] of creatures) test(c.x, c.y, c.z, c.r, [3, id]);
  D = Math.max(D, camDist + 5);
  const ax = cp.x + cd[0] * D - me.x, ay = cp.y + cd[1] * D - me.y, az = cp.z + cd[2] * D - me.z, l = Math.hypot(ax, ay, az) || 1;
  return [ax / l, ay / l, az / l];
}
let aimAt = null;
function tryFire(now) {
  if (!firing || held >= 0) return;
  const v = you.veh ? vehicles.get(you.veh) : null;
  let rate, w = null;
  if (v && v.type === 'sub') rate = WEAPONS.subtorp.rate;
  else { w = you.w[you.slot]; if (!w || you.rl > 0 || w[2] <= 0) return; rate = WEAPONS[w[0]].rate; }
  if (now < nextFire) return;
  nextFire = now + 1000 / rate;
  if (w) w[2]--;
  const d = aimDir().map(x => +x.toFixed(4));
  send(aimAt ? { t: 'f', d, a: aimAt } : { t: 'f', d });
  recoil(v ? WEAPONS.subtorp : WEAPONS[w[0]]);
}
function computePrompt() {
  if (!you || !you.alive) return null;
  if (you.grab) return ['F', 'Befreien – mehrfach drücken!'];
  if (mode === 'exp' && held >= 0 && !hud.shopOpen && nearBase()) { const c = catchFromNet(you.x.bagL[held]); return ['E', `${catchName(c)} ins Aquarium setzen (+${catchRate(c).toLocaleString('de-DE', { maximumFractionDigits: 2 })} €/s)`]; }
  if (mode === 'exp' && !hud.shopOpen && !nearBoat() && !nearBase() && otherBaseOwner()) return ['–', `Basis von ${otherBaseOwner()} · nur Luft tanken`];
  if (mode === 'exp') return hud.shopOpen ? null : nearBoat() ? ['E', 'Händler-Boot: Fische verkaufen & Ausrüstung'] : nearBase() ? ['E', 'Unterwasser-Basis: Aquarium'] : null;
  const ft = finTarget(); if (ft) return ['G', `Finisher: ${ft.name}`];
  if (you.veh) { if (!vehSince) vehSince = time; return time - vehSince < 4 ? ['E', 'Aussteigen'] : null; }
  vehSince = 0;
  const S = SUITS[mySuit]; let best = null, bd = 1e9;
  const d3 = (o) => Math.hypot(o.x - me.x, o.y - me.y, o.z - me.z);
  for (const p of pickups.values()) if (p.k === 'w') { const d = d3(p); if (d < S.r + 3.5 && d < bd) { bd = d; best = ['E', `${WEAPONS[p.wid].name} (${RARITY[p.rar].name}) ${you.w.includes(0) ? 'aufheben' : 'tauschen'}`]; } }
  crates.forEach((c) => { if (!c.userData.isOpen) { const d = d3(c.position); if (d < S.r + 4.5 && d < bd) { bd = d; best = ['E', 'Truhe öffnen']; } } });
  if (!S.mech) for (const v of vehicles.values()) if (!v.driver) { const d = d3(v) - (v.type === 'sub' ? 2 : 0); if (d < S.r + 4.5 && d < bd) { bd = d; best = ['E', `${VEHICLES[v.type].name} steuern`]; } }
  return best;
}

// ---------- per-frame updates ----------
function updateEntities(dt) {
  const k = 1 - Math.exp(-dt * 14), alive = you && you.alive;
  for (const e of players.values()) {
    if (e.id === myId && alive) { e.x = me.x; e.y = me.y; e.z = me.z; e.yaw = me.byaw; e.pitch = me.bpitch; e.speed = Math.hypot(me.vx, me.vy, me.vz); }
    else {
      const ox = e.x, oy = e.y, oz = e.z;
      e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; e.z += (e.tz - e.z) * k; e.yaw = lerpAngle(e.yaw, e.tyaw, k); e.pitch += (e.tpitch - e.pitch) * k;
      e.speed += (Math.hypot(e.x - ox, e.y - oy, e.z - oz) / dt - e.speed) * 0.2;
    }
    e.surf = SURFACE - e.y < 1.3;   // at the surface the diver floats upright
    e.held = e.id === myId && held >= 0 && you && you.x ? catchFromNet(you.x.bagL[held]) : null;
    // nur vom eigenen Taucher weiß das Spiel, wann er nachlädt – also gehen nur bei dir die Kiemen auf
    e.gills = e.id === myId ? view.gills : 0; e.charge = e.id === myId ? view.charge : 0;
    e.fin = fins.find(f => f.attacker === e.id) || null;
    const veh = e.veh ? vehicles.get(e.veh) : null;
    // im U-Boot sieht man den Taucher nicht, und in der Ego-Perspektive nicht den eigenen Körper
    e.mesh.visible = !(veh && veh.type === 'sub') && !(e.id === myId && fpOn);
    e.mesh.position.set(e.x, e.y, e.z);
    e.mesh.userData.update(dt, e);
    const near = e.mesh.position.distanceToSquared(camera.position);
    if (e.mesh.userData.tag) e.mesh.userData.tag.visible = near < 55 * 55;
    // breathing: every few seconds the diver exhales a cloud of bubbles from the regulator
    e.breath = (e.breath ?? Math.random() * 4) - dt * (e.fl & 2 ? 1.7 : 1);
    const myBreath = e.id === myId && you && you.alive && SURFACE - e.y > 1.2 && !myFin;
    if (myBreath && !e.inhaled && e.breath < 1.9) { e.inhaled = true; sfx.inhale(BREATH_VOL); }
    if (e.breath <= 0) { e.breath = 3.4 + Math.random() * 1.4; e.exhale = 0.9; e.inhaled = false; if (myBreath) sfx.exhale(BREATH_VOL); }
    if (e.exhale > 0 && near < 90 * 90 && SURFACE - e.y > 1.2) {
      e.exhale -= dt;
      const f = dirFrom(e.yaw, e.pitch), big = e.exhale > 0.45, n = Math.random() < (big ? 0.9 : 0.5) ? (big ? 2 : 1) : 0;
      for (let i = 0; i < n; i++) env.bubble(e.x + f[0] * 0.8, e.y + f[1] * 0.8 - 0.05, e.z + f[2] * 0.8, 1, 0.1, 0, big ? 0.04 + Math.random() ** 1.5 * 0.17 : 0.02 + Math.random() * 0.06);
    }
  }
  for (const v of vehicles.values()) {
    if (v.driver === myId && alive) { v.x = me.x; v.y = me.y; v.z = me.z; v.yaw = me.hyaw; v.pitch = me.hpitch; v.speed = Math.hypot(me.vx, me.vy, me.vz); }
    else { const ox = v.x, oz = v.z, oy = v.y; v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k; v.z += (v.tz - v.z) * k; v.yaw = lerpAngle(v.yaw, v.tyaw, k); v.pitch += (v.tpitch - v.pitch) * k; v.speed += (Math.hypot(v.x - ox, v.y - oy, v.z - oz) / dt - v.speed) * 0.2; }
    v.mesh.position.set(v.x, v.y, v.z); v.driven = !!v.driver;
    v.mesh.userData.update(dt, v);
    if (v.driver && v.speed > 3 && Math.random() < dt * 25) { const f = dirFrom(v.yaw, v.pitch), o = v.type === 'sub' ? 4.2 : 0.6; env.bubble(v.x - f[0] * o, v.y - f[1] * o, v.z - f[2] * o, 1, 0.8, 1); }
  }
  for (const c of creatures.values()) {
    c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; c.z += (c.tz - c.z) * k; c.yaw = lerpAngle(c.yaw, c.tyaw, k); c.pitch += (c.tpitch - c.pitch) * k;
    c.mesh.position.set(c.x, c.y, c.z); c.mesh.userData.update(dt, c);
  }
  for (const p of pickups.values()) p.mesh.userData.update(time);
  for (const [id, p] of projs) {
    const st = p.sp * dt; p.x += p.dx * st; p.y += p.dy * st; p.z += p.dz * st; p.life -= dt;
    p.mesh.position.set(p.x, p.y, p.z);
    // fremdes Geschoss fliegt knapp an mir vorbei → "Schusch" (nur einmal pro Geschoss)
    if (!p.mine && !p.wh && you && you.alive) { const d = Math.hypot(p.x - me.x, p.y - me.y, p.z - me.z); if (d < NEAR_MISS + 0.5) { p.wh = true; whooshAt(p.x, p.y, p.z, d); } }
    p.tt -= dt; if (p.tt <= 0) { p.tt = p.trail; env.bubble(p.x, p.y, p.z, 1, 0.1, 0, 0.025 + Math.random() * 0.03); }
    if (p.life <= -0.15 || p.y < W.heightAt(p.x, p.z) - 0.5) removeProj(id);
  }
  // Wasserstrahlen verblassen in BEAM_TIME Sekunden und verschwinden dann
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i]; b.t -= dt;
    if (b.t <= 0) { dyn.remove(b.mesh); b.mesh.userData.dispose(); beams.splice(i, 1); }
    else b.mesh.userData.fade(b.t / BEAM_TIME);
  }
}
// ---------- Zielfernrohr (Harpune) ----------
// Rechte Maustaste halten: Zoom (Sichtfeld von FOV auf SCOPE_FOV Grad), Fernrohr-Bild, und das Zielen wackelt.
// Je weniger Leben man hat, desto mehr wackelt es (SWAY_MIN bei vollem Leben, SWAY_MAX kurz vor dem Tod).
const FOV = 72, SCOPE_FOV = 16, SWAY_MIN = 0.0015, SWAY_MAX = 0.018;
let scoping = false, scoped = 0, swayT = 0, swayX = 0, swayY = 0;
const BREATH_VOL = 0.8;   // Lautstärke der Atemgeräusche
function updateScope(dt) {
  const w = you && you.alive && !you.veh && held < 0 ? you.w[you.slot] : null;
  const can = scoping && w && WEAPONS[w[0]].scope && !myFin;
  scoped += ((can ? 1 : 0) - scoped) * Math.min(1, dt * 12);
  const fov = FOV + (SCOPE_FOV - FOV) * scoped;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  hud.scope(scoped > 0.5);
  // Wackeln: zwei langsame Wellen übereinander, das sieht aus wie zitternde Hände. Es verschiebt das echte Zielen!
  const lifeLeft = you && you.mhp ? Math.max(0, Math.min(1, you.hp / you.mhp)) : 1;
  const amp = (SWAY_MIN + (SWAY_MAX - SWAY_MIN) * (1 - lifeLeft)) * scoped;
  swayT += dt;
  const nx = (Math.sin(swayT * 0.9) + Math.sin(swayT * 2.3 + 1) * 0.45) * amp, ny = (Math.cos(swayT * 1.1) + Math.sin(swayT * 2.9) * 0.4) * amp;
  camYaw += nx - swayX; camPitch += ny - swayY; swayX = nx; swayY = ny;
}
// Rückstoß: die Kamera springt beim Schuss nach oben (und etwas zur Seite) und federt dann zum Großteil zurück.
// Mehr Schaden pro Schuss = mehr Rückstoß. RECOIL_BACK = wie viel davon zurückfedert (0.75 = 75 %).
let recoilBack = 0;
const RECOIL = 0.0006, RECOIL_BACK = 0.75;
function recoil(def) {
  const k = Math.min(0.09, 0.006 + def.dmg * def.pellets * RECOIL);
  camPitch = Math.min(1.45, camPitch + k);
  camYaw += (Math.random() - 0.5) * k * 0.6;
  recoilBack += k * RECOIL_BACK;
  shake = Math.max(shake, k * 2.5);
  view.kick = 1;
}
// ---------- Nachladen: Magazin wechseln (die Bewegungen stehen in models.js bei poseReload) ----------
// Nachlade-Geräusche: [Zeitpunkt 0…1, Name des Sounds in audio.js]
const RELOAD_SOUNDS = [[0.13, 'magOut'], [0.36, 'stow'], [0.5, 'magGrab'], [0.75, 'magIn'], [0.86, 'ready']];
// Kiemen, Druckanzeige, Nachladen und die Waffe vor der Kamera (Ego-Perspektive)
function updateViewModel(dt) {
  // Rückstoß zurückfedern lassen
  const back = Math.min(recoilBack, dt * 0.6); camPitch -= back; recoilBack -= back;
  updateScope(dt);
  const w = you && you.alive ? you.w[you.slot] : null;
  const reloading = !!w && you.rl > 0;
  const done = reloading ? 1 - you.rl / you.rlT : 0;
  // Nachlade-Geräusche: jedes einmal, wenn sein Zeitpunkt erreicht ist
  if (!reloading) view.rsnd = 0;
  else while (view.rsnd < RELOAD_SOUNDS.length && done >= RELOAD_SOUNDS[view.rsnd][0]) sfx[RELOAD_SOUNDS[view.rsnd++][1]]();
  // Kiemen: beim Schuss puffen sie kurz auf (der Druck entweicht)
  view.gills = Math.max(view.gills - dt * 4, view.kick * 0.7);
  // Druckanzeige = wie voll das Magazin in der Waffe ist
  const def = w ? WEAPONS[w[0]] : null;
  view.charge = def ? (reloading ? Math.max(0, done - RELOAD_STEPS.insert) / (1 - RELOAD_STEPS.insert) : w[2] / def.mag) : 0;
  // die Waffe vor der Kamera nur in der Ego-Perspektive, mit Waffe in der Hand (nicht mit Fisch)
  view.g.visible = fpOn && !!w && held < 0 && scoped < 0.5;   // beim Zielen durchs Fernrohr ist die Waffe nicht zu sehen
  if (!view.g.visible) return;
  const widx = WEAPON_IDS.indexOf(w[0]);
  if (widx !== view.widx) {   // Waffe gewechselt: neues Modell bauen
    view.widx = widx; view.g.clear();
    view.gun = makeWaterGun(widx, true); view.g.add(view.gun);
    view.arms = makeViewArms(mySuit, view.gun.userData); view.gun.add(view.arms);   // Arm und Hände halten die Waffe
    view.rHand = makeReloadHand(mySuit); view.gun.add(view.rHand);                   // zweite Hand fürs Nachladen
  }
  const U = view.gun.userData;
  U.setGills(view.gills);
  U.setCharge(view.charge);
  // Nachladen: zweite Hand und Magazin bewegen, die normale linke Hand ausblenden
  const rl = reloading && !!U.mag;
  if (view.arms.userData.left) view.arms.userData.left.visible = !rl;
  if (rl) poseReload(done, U, view.rHand);
  else { view.rHand.visible = false; if (U.mag) { U.mag.g.position.copy(U.mag.seat); U.mag.g.visible = true; U.mag.fill.emissiveIntensity = 0.4 + 1.4 * view.charge; } }
  // beim Nachladen die Waffe zur Seite kippen, damit man den Magazinschacht sieht
  view.tilt += ((rl ? 1 : 0) - view.tilt) * Math.min(1, dt * 7);
  // Schwanken beim Schwimmen, Rückstoß beim Schießen
  const speed = Math.hypot(me.vx, me.vy, me.vz);
  view.bob += dt * (2 + speed * 0.6);
  view.kick = Math.max(0, view.kick - dt * 10);
  const sway = Math.min(1, speed / 10) * 0.012;
  // die Waffe so weit nach vorne schieben, dass ihr hinteres Ende 0,3 m vor der Kamera ist
  const sh = U.fpShift, z = -(U.rear + 0.3) + sh[2];
  view.gun.position.set(sh[0] + Math.cos(view.bob) * sway - view.tilt * 0.07, sh[1] + Math.abs(Math.sin(view.bob)) * sway + view.tilt * 0.09 + view.kick * 0.015, z + view.kick * 0.09);
  view.gun.rotation.set(view.kick * 0.22 + view.tilt * 0.1, view.tilt * 0.35, view.tilt * 0.6);
}
const V = new THREE.Vector3();
function updateCamera(dt) {
  let tx, ty, tz, want, side = 0.9, up = 0.5;
  const alive = you && you.alive;
  fpOn = false;
  if (myFin) {
    const G = myFin.ghost.position, mx = (me.x + G.x) / 2, my = (me.y + G.y) / 2 + 0.6, mz = (me.z + G.z) / 2;
    const a = camYaw + 1.9 + myFin.p * 0.9, d = 5.5 + Math.hypot(me.x - G.x, me.z - G.z) * 0.55;   // weiter weg, wenn der Gegner weit fliegt
    let px = mx + Math.sin(a) * d, py = my + 1.6, pz = mz + Math.cos(a) * d;
    py = Math.min(SURFACE - 0.6, Math.max(py, W.heightAt(px, pz) + 0.8));
    shake = Math.max(0, shake - dt * 2.2);
    camera.position.set(px + (Math.random() - 0.5) * shake, py + (Math.random() - 0.5) * shake, pz);
    camera.lookAt(mx, my, mz);
    return;
  }
  if (alive) {
    const v = you.veh ? vehicles.get(you.veh) : null;
    want = v ? VEHICLES[v.type].cam : SUITS[mySuit].cam;
    if (v && v.type === 'sub') { side = 0; up = 2.2; }
    tx = me.x; ty = me.y + (SUITS[mySuit].mech ? 1.4 : 0.5); tz = me.z;
    // swimming at the surface: head out of the water, the camera looks across the sea
    if (SURFACE - me.y < 3.2) { headUp += (1 - headUp) * Math.min(1, dt * 3); } else headUp += (0 - headUp) * Math.min(1, dt * 4);
    // Ego-Perspektive: Kamera fährt in den Kopf (Abstand 0), nicht zur Seite, nicht nach oben
    if ((firstPerson || scoped > 0.5) && !v) { fpOn = true; want = 0; side = 0; up = 0; }
    else ty += headUp * 2.2;
  } else {
    let e = players.get(specId);
    if (!e) { for (const p of players.values()) { if (!e || (!meta.get(p.id)?.bot && meta.get(e.id)?.bot)) e = p; } specId = e ? e.id : 0; }
    if (e) { tx = e.x; ty = e.y + 0.6; tz = e.z; } else { tx = me.x; ty = me.y; tz = me.z; }
    want = 8; side = 0;
  }
  camDist += (want - camDist) * Math.min(1, dt * 5);
  const cd = dirFrom(camYaw, camPitch), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  let px = tx - cd[0] * camDist + rx * side, py = ty - cd[1] * camDist + up, pz = tz - cd[2] * camDist + rz * side;
  const t = W.segmentHit(tx, ty, tz, px, py, pz);
  if (t > 0) { const q = Math.max(0.15, t - 0.08); px = tx + (px - tx) * q; py = ty + (py - ty) * q; pz = tz + (pz - tz) * q; }
  py = Math.min(headUp > 0.5 ? SURFACE + 14 : SURFACE - 0.6, Math.max(py, W.heightAt(px, pz) + 0.5));
  if (headUp > 0.5 && py < SURFACE + 0.8 && py > SURFACE - 0.8) py = SURFACE + 0.8;   // never sit exactly in the water plane
  shake = Math.max(0, shake - dt * 2.2);
  camera.position.set(px + (Math.random() - 0.5) * shake, py + (Math.random() - 0.5) * shake, pz + (Math.random() - 0.5) * shake);
  camera.rotation.set(camPitch, camYaw, 0);
}
function lobbyCamera() {
  view.g.visible = false;   // keine Waffe vor der Kamera in der Lobby
  if (camera.fov !== FOV) { camera.fov = FOV; camera.updateProjectionMatrix(); } scoped = 0; hud.scope(false);   // Zoom aus
  if (!W) return;
  const a = time * 0.05, w = W.wreck;
  camera.position.set(w.x + Math.cos(a) * 46, w.y + 20, w.z + Math.sin(a) * 46);
  camera.lookAt(V.set(w.x, w.y + 6, w.z));
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  let outside = false;
  if (phase === 'play' && W) {
    const alive = you && you.alive;
    if (alive) {
      if (!myFin) { controlMe(dt); tryFire(now); }
      sendT += dt; if (sendT >= 1 / 30) { sendT = 0; send({ t: 'm', x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), yaw: +me.byaw.toFixed(3), pitch: +me.bpitch.toFixed(3), b: me.boost ? 1 : 0 }); }
    }
    updateFinishers(dt); updateViewModel(dt); updateEntities(dt); updateCamera(dt);
    const fx = alive ? me : camera.position;
    outside = !!zone && Math.hypot(fx.x - zone[0], fx.z - zone[1]) > zone[2];
    promptT -= dt; if (promptT <= 0) { promptT = 0.12; hud.prompt(computePrompt()); }
    if (mode === 'exp' && you && you.x) { if (held >= you.x.bagL.length || !you.alive) held = -1; updateTorch(dt, SURFACE - fx.y); updateAquarium(dt); }
    hud.update({ you, zone, alive: aliveN, energy: me.energy, depth: SURFACE - fx.y, suit: mySuit, outside, time, dt,
      lamp: mode === 'exp' ? { on: torch.on, bat: torch.bat, cap: LAMPS[torch.lvl].battery } : null, held });
    let marks = [];
    if (mode === 'exp') {
      // boss health bar for the closest boss nearby, boss dots + boat on the minimap
      let bb = null, bd = 70;
      marks = [{ x: EXP_BOAT.x, z: EXP_BOAT.z, c: '#ffc94d', s: 4 }, ...W.bases.map((b, i) => ({ x: b.c.x, z: b.c.z, c: you && you.x && you.x.base === i ? '#ffe066' : '#5ef2e0', s: you && you.x && you.x.base === i ? 5 : 3.5 }))];
      for (const c of creatures.values()) if (c.type === 'boss') {
        marks.push({ x: c.x, z: c.z, c: '#ff4d4d', s: 3.5 });
        const d = Math.hypot(c.x - fx.x, c.y - fx.y, c.z - fx.z); if (d < bd) { bd = d; bb = c; }
      }
      hud.boss(bb ? { name: BOSSES[bb.sub].name, hp: bb.hpPct } : null);
      hud.renderShop(you);
      if (hud.shopOpen && !(hud.shopKind === 'base' ? nearBase() : nearBoat())) hud.closeShop();
      // it gets darker the deeper you dive
      const df = Math.max(0, Math.min(1, (SURFACE - camera.position.y) / 300));
      // below ~150 m it is almost pitch black without a lamp
      const dep = SURFACE - camera.position.y;
      hemi.intensity = 1.25 * Math.min(1, Math.max(0.04, 1 - dep / 160)); sun.intensity = 1.35 * Math.min(1, Math.max(0, 1 - dep / 120));
      // floor 6 (Vulkanschlund) glows red from the lava below, floor 7 (Urzeittiefe) has a faint blue shimmer
      const lava = deepGlow(dep).lava, prim = deepGlow(dep).prim;
      hemi.color.setHex(0xb5e8ff).lerp(LAVA_SKY, lava).lerp(PRIM_SKY, prim);
      hemi.groundColor.setHex(0x12303c).lerp(LAVA_GROUND, lava).lerp(PRIM_GROUND, prim);
      hemi.intensity = Math.max(hemi.intensity, 0.9 * lava + 0.45 * prim);
    } else { hemi.intensity = 1.25; sun.intensity = 1.35; hemi.color.setHex(0xb5e8ff); hemi.groundColor.setHex(0x12303c); }
    hud.drawMini(env.mini, zone, { x: fx.x, z: fx.z, yaw: camYaw }, vehicles.values(), mode === 'exp' ? expPois() : W.pois, marks);
    if (mode === 'exp' && you && !you.alive && deadInfo) hud.spec(`<b>Ohnmächtig!</b>Erwischt von ${esc(deadInfo.by)}${deadInfo.lost ? ` · ${deadInfo.lost} Fische verloren` : ''} · aufwachen in ${Math.ceil(you.x?.rt || 0)} s`);
    else if (you && !you.alive && deadInfo) { const s = players.get(specId); hud.spec(`<b>Platz ${deadInfo.place}</b>Erwischt von ${esc(deadInfo.by)}${s ? ` · du beobachtest ${esc(s.name)}` : ''}`); }
    else if (!you) { const s = players.get(specId); hud.spec(`Zuschauer${s ? ` · ${esc(s.name)}` : ''}`); }
    else if (you.alive) hud.spec(null);
    if (mode !== 'exp') { lamp.intensity = 150 * Math.min(1, Math.max(0, (SURFACE - camera.position.y - 55) / 55)); lamp.distance = 90; lamp.angle = 0.42; }
  } else lobbyCamera();
  if (env) env.update(dt, time, camera, phase === 'play' ? zone : null, outside);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// small hook for automated smoke tests
window.__un = { get state() { return { phase, myId, you, aliveN, me, players: players.size, creatures: creatures.size, pickups: pickups.size, projs: projs.size }; },
  look(y, p) { camYaw = y; camPitch = p; }, key(c, d) { keys[c] = d; }, fire(b) { firing = b; }, send, tp(x, y, z) { me.x = x; me.y = y; me.z = z; }, world: () => W, ents: () => ({ players, creatures, vehicles, crates, pickups }) };
