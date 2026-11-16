// Undernite - browser client: networking, input, camera, entity sync, effects.
import * as THREE from 'three';
import { World, SUITS, WEAPONS, WEAPON_IDS, RARITY, VEHICLES, VEHICLE_IDS, CREATURES, CREATURE_IDS, SURFACE, dirFrom, segSphere, FINISHER, DEEP,
  creatureR, FISH, BOSSES, EXP_BOAT, LAMPS, catchFromNet, catchName, catchRate, deepGlow, SHOT_CHARGE, upMul, REEF_HITBOX } from './shared.js';
// gekaufte Verbesserungen aus dem Perlen-Shop (kommen mit der Lobby-Nachricht). Wirken nur im Battle Royale.
let myUp = {};
const UP = (k) => mode === 'exp' ? 1 : upMul(myUp, k);
import { buildEnvironment } from './world.js';
import { makePlayerModel, makeShark, makeOcto, makeJelly, makeSub, makeScooter, makeCrate, makePickup, makeProjectile, makeBeam, makeWaterGun, makeViewArms, makeReloadHand, poseReload, reloadRoll, RELOAD_STEPS, makeFish, makeBoss, makeTrophy } from './models.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';
import { startFinisher } from './finisher.js';
import { settings, onSettings, openSettings, closeSettings, QUALITY } from './settings.js';
import { setReefQuality } from './reef.js';
import { makeShock, SHOCK } from './shock.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x2b8fb0, 0.01);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.25, 900);
camera.rotation.order = 'YXZ'; scene.add(camera);
const hemi = new THREE.HemisphereLight(0xb5e8ff, 0x12303c, 1.25); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xdff6ff, 1.35); sun.position.set(0.35, 1, 0.2); scene.add(sun);
// Helmlampe: kaltweißes LED-Licht, sitzt am Helm des Tauchers (nicht an der Kamera) und leuchtet nur einen engen Kegel
// in Blickrichtung aus. penumbra 0.35 = ziemlich scharfer Rand, decay 1.6 = wird mit der Entfernung schnell schwächer.
const LAMP_COLOR = 0xf2f7ff;
const lamp = new THREE.SpotLight(LAMP_COLOR, 0, 90, 0.42, 0.35, 1.6);
scene.add(lamp); scene.add(lamp.target);
// visible light cone of the expedition flashlight (apex at the diver, opening towards -z)
const torchBeam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0).rotateX(Math.PI / 2),
  new THREE.ShaderMaterial({   // bright at the lamp, fading out towards the end of the cone
    uniforms: { c: { value: new THREE.Color(LAMP_COLOR) }, o: { value: 0.08 } },
    vertexShader: 'varying float vz; void main() { vz = -position.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 c; uniform float o; varying float vz; void main() { gl_FragColor = vec4(c, o * pow(1.0 - vz, 1.8)); }',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
torchBeam.rotation.order = 'YXZ'; torchBeam.visible = false; scene.add(torchBeam);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (post.composer) { post.composer.setPixelRatio(renderer.getPixelRatio()); post.composer.setSize(innerWidth, innerHeight); }
}
// ---------- Grafik-Nachbearbeitung (je nach Qualitätsstufe) ----------
// Das Bild wird erst normal gezeichnet und dann bearbeitet:
//   GTAO  = weiche Schatten in Spalten, Höhlen und Ecken (macht alles weniger "blockig")
//   Bloom = helle, leuchtende Dinge strahlen in ihre Umgebung (Korallen, Quallen, Mündungsblitz, Lampe)
const post = { on: false, composer: null, bloom: null, ao: null };
function setupPost(Q) {
  post.on = Q.bloom > 0 || Q.ao;
  if (!post.on) return;
  if (!post.composer) {
    post.composer = new EffectComposer(renderer);
    post.composer.addPass(new RenderPass(scene, camera));
    post.ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    post.ao.updateGtaoMaterial({ radius: 1.4, distanceExponent: 1.6, thickness: 2, scale: 1.3, samples: 12 });
    post.composer.addPass(post.ao);
    post.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.55, 0.7);
    post.composer.addPass(post.bloom);
    post.composer.addPass(new OutputPass());   // Farben und Helligkeit wie ohne Nachbearbeitung (Tone Mapping)
  }
  post.ao.enabled = !!Q.ao;
  post.bloom.enabled = Q.bloom > 0; post.bloom.strength = Q.bloom;
  post.composer.setPixelRatio(renderer.getPixelRatio()); post.composer.setSize(innerWidth, innerHeight);
}
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
const flashLight = new THREE.PointLight(0x9fe4ff, 0, 5, 1.6); flashLight.position.set(0.15, -0.08, -0.6); camera.add(flashLight);
// Mündungsblitz: zwei gekreuzte leuchtende Scheiben und ein heller Kern (blau-weiß, wie ein Druckstoß aus Wasser)
function makeFlash() {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const r of [0, Math.PI / 2]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.14), m); p.position.z = -0.06; p.rotation.set(Math.PI / 2, 0, r); g.add(p); }
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), m); c.position.z = -0.015; g.add(c);
  return g;
}
const view = { g: new THREE.Group(), gun: null, arms: null, rHand: null, rl: 0, widx: -2, gills: 0, charge: 0, kick: 0, bob: 0, tilt: 0, rsnd: 0 };
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
  else if (m.t === 'lobby') { ensureWorld(m.seed, m.mode); if (phase !== 'play') { phase = 'lobby'; clearDyn(); hud.show('lobby'); if (document.pointerLockElement) document.exitPointerLock(); } hud.setLobby(m, myId); const mine = m.players.find(p => p.id === myId); if (mine) { mySuit = mine.suit; myUp = mine.up || {}; } }
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
  for (const p of projs.values()) if (p.whine) p.whine.stop();
  sfx.engine(0);
  dyn.clear(); shocks.length = 0; players.clear(); creatures.clear(); vehicles.clear(); pickups.clear(); projs.clear(); crates = [];
  you = null; zone = null; deadInfo = null; specId = 0;
}
function onStart(m) {
  mode = m.mode || 'br'; cling = null;
  ensureWorld(m.seed, mode); clearDyn();
  phase = 'play'; meta.clear(); hud.setMode(mode);
  torch.on = false; torchBeam.visible = false; torch.bat = LAMPS[torch.lvl].battery;   // Akku zurücksetzen (im Battle Royale war er unendlich)
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
// ---------- Schockwelle bei jedem Schuss (Aussehen und Größe: siehe shock.js) ----------
const shocks = [];
function addShock(x, y, z, dx, dy, dz, widx, mine) {
  const s = makeShock(dyn, x, y, z, dx, dy, dz, widx, mine); if (!s) return;
  shocks.push(s);
  env.bubble(x, y, z, 5 + Math.round((SHOCK.size[widx] ?? 1) * 5), 0.15 * (SHOCK.size[widx] ?? 1), 1.5);   // Blasenwolke an der Mündung
}
function updateShocks(dt) { for (let i = shocks.length - 1; i >= 0; i--) if (!shocks[i].update(dt)) shocks.splice(i, 1); }
function onEvent(e) {
  switch (e[0]) {
    case 'pj': {
      // sichtbarer Start an der Mündung der Waffe (der Server rechnet weiter mit seinem eigenen Startpunkt)
      const mz = muzzleOf(e[3]); if (mz) { e[4] = mz.x; e[5] = mz.y; e[6] = mz.z; }
      const widx = e[2], def = WEAPONS[WEAPON_IDS[widx]], mesh = makeProjectile(widx);
      mesh.position.set(e[4], e[5], e[6]); mesh.lookAt(e[4] + e[7], e[5] + e[8], e[6] + e[9]); dyn.add(mesh);
      projs.set(e[1], { mesh, x: e[4], y: e[5], z: e[6], dx: e[7], dy: e[8], dz: e[9], sp: def.speed, life: def.life, trail: widx >= 4 ? 0.03 : 0.09, tt: 0, mine: e[3] === myId,
        whine: widx === 4 || widx === 5 ? sfx.torpedoWhine() : null });   // Torpedos: hohes, sirrendes Heulen
      if (def.pellets === 1 || !projs.lastShot || projs.lastShot !== time) {
        sfx.shot(widx, e[3] === myId ? 1 : volAt(e[4], e[5], e[6]));
        addShock(e[4], e[5], e[6], e[7], e[8], e[9], widx, e[3] === myId);   // sichtbare Schockwelle
      }
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
      if (beams.lastShot !== time) {
        sfx.jet(widx, e[2] === myId ? 1 : volAt(e[3], e[4], e[5]));
        addShock(e[3], e[4], e[5], e[6] - e[3], e[7] - e[4], e[8] - e[5], widx, e[2] === myId);   // sichtbare Schockwelle
      }
      beams.lastShot = time;
      if (e[2] === myId) { shake = Math.max(shake, widx >= 3 ? 0.25 : 0.08); view.kick = 1; }
      break;
    }
    case 'hit': removeProj(e[1]); env.bubble(e[2], e[3], e[4], 7, 0.4, 2); if (e[5] === 1 || e[5] === 3) env.blood(e[2], e[3], e[4]); sfx.hit(volAt(e[2], e[3], e[4])); break;
    case 'boom': {
      removeProj(e[1]); env.explosion(e[2], e[3], e[4], e[5]);
      // Wasser trägt tiefe Töne sehr weit: das Grollen hört man bis 600 m, das metallische Klicken nur in der Nähe
      const d = Math.hypot(e[2] - camera.position.x, e[3] - camera.position.y, e[4] - camera.position.z);
      const far = Math.max(0, 1 - d / 600) ** 1.4, near = volAt(e[2], e[3], e[4]);
      sfx.boom(far, near);
      shake = Math.max(shake, near * 1.4 + far * 0.25);   // Druckstoß: man spürt ihn als Schlag
      break;
    }
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
let fpsN = 0, fpsT = 0;
let lastGrunt = 0, sonarT = 2, bleedT = 0, bleedPuff = 0;   // bleedT = so lange blutest du noch   // sonarT = Sekunden bis zum nächsten Sonar-Ping im U-Boot
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
    case 'bleed': bleedT = e[1]; hud.banner('Autsch! An einer scharfen Koralle geschnitten – du blutest!', 2.2); break;
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
function removeProj(id) { const p = projs.get(id); if (p) { dyn.remove(p.mesh); if (p.whine) p.whine.stop(); projs.delete(id); } }

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (phase !== 'play' || !you || !you.alive) return;
  if (e.code === 'KeyV') { firstPerson = !firstPerson; return; }   // Ego-Perspektive an/aus
  if (e.code === 'KeyC' && canCling()) { toggleCling(); return; }  // Deckung: am Riff festhalten / loslassen
  if (e.code === 'KeyG') { const t = finTarget(); if (t) send({ t: 'fin', id: t.id }); return; }   // Finisher
  if (e.code === 'KeyL') {
    if (mode === 'exp' && torch.bat <= 0) hud.banner('Lampe leer – oben an der Oberfläche aufladen!', 2);
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
  const sens = 0.0022 * settings.sens * camera.fov / FOV;   // Mausempfindlichkeit aus den Einstellungen; mit Zoom entsprechend langsamer
  camYaw -= e.movementX * sens; camPitch = Math.max(-1.45, Math.min(1.45, camPitch - e.movementY * sens * (settings.invertY ? -1 : 1)));
});
const lock = () => { sfx.init(); if (phase === 'play' && document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); };
canvas.addEventListener('mousedown', (e) => { if (document.pointerLockElement !== canvas) { lock(); return; } if (e.button === 2) { scoping = true; return; } if (e.button !== 0) return; if (held >= 0) { if (nearBase()) placeHeld(); return; } firing = true; });
document.getElementById('pause').addEventListener('click', lock);
// Einstellungen: aus der Lobby und aus dem Pause-Bildschirm (Esc) erreichbar
hud.initBrShop((k) => send({ t: 'brbuy', k }));   // Perlen-Shop in der Lobby
for (const id of ['setBtnLobby', 'setBtnPause']) document.getElementById(id).addEventListener('click', (e) => { e.stopPropagation(); openSettings(); });
addEventListener('keydown', (e) => { if (e.code === 'Escape') closeSettings(); });

addEventListener('mouseup', (e) => { if (e.button === 0) firing = false; if (e.button === 2) scoping = false; });
addEventListener('wheel', (e) => {
  if (phase !== 'play' || !you || !you.alive) return;
  const dir = e.deltaY > 0 ? 1 : -1;
  for (let k = 1; k <= 3; k++) { const i = (you.slot + dir * k + 6) % 3; if (you.w[i]) { if (i !== you.slot) send({ t: 'slot', i }); break; } }
}, { passive: true });
addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { hud.pause(phase === 'play' && document.pointerLockElement !== canvas); if (document.pointerLockElement !== canvas) firing = false; });

// ---------- Deckung: Triton und Manta halten sich mit C an einem Riff-Hügel fest ----------
// reach = so viele Meter darf man höchstens vom Hügel weg sein, sway = Zielwackeln beim Festhalten (0.35 = nur noch 35 %)
const CLING = { reach: 1.8, sway: 0.35 };
let cling = null;   // { x, y, z } = hier hängt man gerade, null = man schwimmt frei
const canCling = () => mode !== 'exp' && (mySuit === 'triton' || mySuit === 'manta') && you && you.alive && !you.veh;   // nur Battle Royale
function nearReef() {
  const R = SUITS[mySuit].r;
  for (const m of (W && W.reefMounds) || []) {
    const d = Math.hypot(me.x - m.x, me.y - m.y, me.z - m.z) - m.r * (m.sx + m.sy + m.sz) / 3 * REEF_HITBOX - R;
    if (d < CLING.reach) return true;
  }
  return false;
}
function toggleCling() {
  if (cling) { cling = null; sfx.noise(0.15, 500, 1, 0.25, 'lowpass', 200); return; }
  if (!nearReef()) { hud.banner('Zu weit weg – schwimm näher an den Riff-Hügel!', 1.2); return; }
  cling = { x: me.x, y: me.y, z: me.z }; me.vx = me.vy = me.vz = 0;
  sfx.noise(0.12, 900, 1, 0.35, 'lowpass', 300); sfx.tone(160, 90, 0.08, 0.25, 'sine');   // Hand packt den Fels
}
// ---------- local player ----------
function controlMe(dt) {
  const S = SUITS[mySuit], v = you.veh ? vehicles.get(you.veh) : null, vt = v ? v.type : null;
  let speed = S.speed * UP('swim'), accel = 5, r = S.r, strafe = 1, canBoost = true;   // Profi-Flossen
  if (vt === 'scooter') { speed = VEHICLES.scooter.speed; accel = VEHICLES.scooter.accel; strafe = 0.35; r = VEHICLES.scooter.r; canBoost = false; }
  else if (vt === 'sub') { speed = VEHICLES.sub.speed; accel = VEHICLES.sub.accel; strafe = 0; r = VEHICLES.sub.r; canBoost = false; }
  if (vt === 'sub') { me.hyaw = approachAngle(me.hyaw, camYaw, 1.6 * dt); me.hpitch += Math.max(-1.1 * dt, Math.min(1.1 * dt, camPitch - me.hpitch)); }
  else { me.hyaw = camYaw; me.hpitch = camPitch; }
  const shop = hud.shopOpen;   // no swimming while shopping
  const down = canCling() ? keys.KeyX : (keys.KeyC || keys.KeyX);   // Triton/Manta: C = festhalten, also sinken nur mit X
  const f = shop ? 0 : (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = shop ? 0 : (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), u = shop ? 0 : (keys.Space ? 1 : 0) - (down ? 1 : 0);
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
  // am Riff festhalten: ganz still hängen. Wegschwimmen (WASD, Leertaste, X) lässt los.
  if (cling && (f || s || u || vt || you.grab || !canCling())) cling = null;
  if (cling) {
    me.x = cling.x; me.y = cling.y; me.z = cling.z; me.vx = me.vy = me.vz = 0; me.boost = false;
    me.energy = Math.min(100, me.energy + 13 * dt);
    return;
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
  // Expedition: bis an die Oberfläche (Kopf schaut raus). Battle Royale: Tiefsee, die obere Grenze liegt tief unter der Oberfläche
  W.collide(me, r, mode === 'exp' ? (vt ? undefined : SURFACE - 0.15) : SURFACE - DEEP.brCeil);
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
// ---------- Leuchtende Quallen und Korallen als schwache Lichtquellen ----------
// Jedes Licht kostet Rechenzeit, darum gibt es nur GLOW.lights Stück. Sie springen viermal pro Sekunde zu den
// Quallen und leuchtenden Korallen, die dir am nächsten sind. So sieht man um sie herum dezent den Boden.
const GLOW = { lights: 8, range: 10, jelly: 16, coral: 5, near: 70 };   // Helligkeit: Quallen 16, Korallen 5
const glowLights = [];
for (let i = 0; i < GLOW.lights; i++) { const l = new THREE.PointLight(0xffffff, 0, GLOW.range, 2); scene.add(l); glowLights.push(l); }
let glowT = 0, glowPick = [];
function updateGlow(dt) {
  if (!env) return;
  const cp = camera.position, d2 = (o) => (o.x - cp.x) ** 2 + (o.y - cp.y) ** 2 + (o.z - cp.z) ** 2, max = GLOW.near * GLOW.near;
  glowT -= dt;
  if (glowT <= 0) {   // die nächsten Leuchtquellen suchen
    glowT = 0.25;
    const cand = [];
    for (const c of creatures.values()) if (c.type === 'jelly') { const d = d2(c); if (d < max) cand.push({ c, d }); }
    for (const g of env.glow || []) { const d = d2(g); if (d < max) cand.push({ g, d }); }
    cand.sort((a, b) => a.d - b.d); glowPick = cand.slice(0, GLOW.lights);
  }
  glowLights.forEach((l, i) => {
    const p = glowPick[i];
    if (!p) { l.intensity = 0; return; }
    if (p.c) {   // Qualle: wandert mit und pulsiert mit ihrem Schwimmtakt
      l.position.set(p.c.x, p.c.y + 0.2, p.c.z); l.color.setHex(p.c.mesh.userData.glowColor || 0x7ae6ff);
      l.intensity = GLOW.jelly * (0.75 + 0.25 * Math.sin(time * 2.4 + i));
    } else { l.position.set(p.g.x, p.g.y, p.g.z); l.color.setHex(p.g.col); l.intensity = p.g.I || GLOW.coral; }
  });
}
// ---------- Licht ----------
// Je tiefer, desto dunkler. darkDepth = ab hier ist es fast schwarz (nur noch ambientMin übrig), sunDepth = hier endet das Sonnenlicht.
// Battle Royale wird schneller dunkel, in der Expedition etwas langsamer (dort hat die Lampe einen Akku).
// Im Battle Royale ist man immer in der Tiefsee (DEEP.brOffset Meter), dort kommt gar kein Sonnenlicht mehr an.
const LIGHT = { br: { darkDepth: 70, sunDepth: 40, ambientMin: 0.03 }, exp: { darkDepth: 60, sunDepth: 30, ambientMin: 0.025 } };
const depthOffset = () => mode === 'exp' ? 0 : DEEP.brOffset;   // so viele Meter kommen zur echten Tiefe dazu
const BR_LAMP = { range: 70, power: 300, angle: 0.34, battery: Infinity };   // Helmlampe im Battle Royale (enger Kegel)
function updateTorch(dt, depth) {
  const exp = mode === 'exp', lvl = exp ? you.x.lamp || 0 : 0, L = exp ? LAMPS[lvl] : BR_LAMP;
  if (exp && lvl !== torch.lvl) { torch.lvl = lvl; torch.bat = L.battery; }   // new lamp bought: comes fully charged
  if (!exp) torch.bat = Infinity;
  else if (depth < 2.6) torch.bat = Math.min(L.battery, torch.bat + L.battery * 0.25 * dt);
  else if (torch.on && you.alive) {
    torch.bat = Math.max(0, torch.bat - dt);
    if (torch.bat <= 0) { torch.on = false; hud.banner('Lampe leer – oben an der Oberfläche aufladen!', 3); }
  }
  if (!torch.hinted && !torch.on && depth > (exp ? 70 : 30) && torch.bat > 0) { torch.hinted = true; hud.banner('Zu dunkel? Drück L für die Taschenlampe!', 3.5); }
  lamp.intensity = torch.on && you.alive ? L.power : 0; lamp.distance = L.range; lamp.angle = L.angle;
  // die Lampe sitzt vorne am Helm und zeigt dorthin, wo du hinschaust
  const dir = dirFrom(camYaw, camPitch), up = SUITS[mySuit].mech ? 1.4 : 0.15, fwd = SUITS[mySuit].mech ? 0.5 : 0.65;
  lamp.position.set(me.x + dir[0] * fwd, me.y + up + dir[1] * fwd, me.z + dir[2] * fwd);
  lamp.target.position.set(lamp.position.x + dir[0] * 10, lamp.position.y + dir[1] * 10, lamp.position.z + dir[2] * 10);
  torchBeam.visible = lamp.intensity > 0;
  if (torchBeam.visible) {
    const len = L.range * 0.6, r = len * Math.tan(L.angle) * 0.75;
    torchBeam.scale.set(r, r, len);
    torchBeam.position.copy(lamp.position);
    torchBeam.rotation.set(camPitch, camYaw, 0);
  }
}
// Umgebungslicht (hemi) und Sonne werden mit der Tiefe schwächer – nicht gleichmäßig, sondern zuerst schnell, dann langsam
function darkness(dep, D) {
  const a = Math.max(0, Math.min(1, 1 - dep / D.darkDepth)), s = Math.max(0, Math.min(1, 1 - dep / D.sunDepth));
  hemi.intensity = 1.25 * Math.max(D.ambientMin, a * a);
  sun.intensity = 1.35 * s * s;
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
// Aufladen: chargeShot merkt sich, welche Waffe gerade Druck aufbaut. Nach chargeEnd geht der Schuss raus,
// auch wenn man die Maustaste schon losgelassen hat. Waffe gewechselt, Nachladen oder tot → Schuss fällt aus.
let chargeShot = null, chargeStart = 0, chargeEnd = 0;
function tryFire(now) {
  if (chargeShot) {
    if (now < chargeEnd) return;
    const c = chargeShot; chargeShot = null;
    const w = you && you.alive && you.slot === c.slot && !you.veh ? you.w[you.slot] : null;
    if (w && w[0] === c.id && you.rl <= 0 && w[2] > 0) { w[2]--; shoot(null, w); }
    return;
  }
  if (!firing || held >= 0) return;
  const v = you.veh ? vehicles.get(you.veh) : null;
  let rate, w = null;
  if (v && v.type === 'sub') rate = WEAPONS.subtorp.rate;
  else { w = you.w[you.slot]; if (!w || you.rl > 0 || w[2] <= 0) return; rate = WEAPONS[w[0]].rate; }
  if (now < nextFire) return;
  const ct = w ? (SHOT_CHARGE[w[0]] || 0) * 1000 : 0;
  nextFire = now + Math.max(1000 / rate, ct * 2);   // Aufladen + Druckwelle müssen vorbei sein
  if (ct > 0) {
    chargeShot = { slot: you.slot, id: w[0] }; chargeStart = now; chargeEnd = now + ct;
    sfx.charge(WEAPON_IDS.indexOf(w[0]), ct / 1000);
    return;
  }
  if (w) w[2]--;
  shoot(v, w);
}
function shoot(v, w) {
  const d = aimDir().map(x => +x.toFixed(4));
  send(aimAt ? { t: 'f', d, a: aimAt } : { t: 'f', d });
  recoil(v ? WEAPONS.subtorp : WEAPONS[w[0]]);
}
function computePrompt() {
  if (!you || !you.alive) return null;
  if (you.grab) return ['F', 'Befreien – mehrfach drücken!'];
  if (cling) return ['C', 'Loslassen (oder wegschwimmen)'];
  if (canCling() && nearReef()) return ['C', 'Am Riff festhalten (Deckung)'];
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
    // Atemtempo: beim Sprinten steigt es schnell auf BREATH_SPRINT (fast 3-mal so schnell), danach beruhigt es sich langsam wieder
    const sprint = e.id === myId ? me.boost : !!(e.fl & 2);
    e.brate = (e.brate ?? 1) + ((sprint ? BREATH_SPRINT : 1) - (e.brate ?? 1)) * Math.min(1, dt * (sprint ? 1.2 : 0.18));
    e.breath = (e.breath ?? Math.random() * 4) - dt * e.brate;
    const myBreath = e.id === myId && you && you.alive && SURFACE - e.y > 1.2 && !myFin;
    const pant = (e.brate - 1) / (BREATH_SPRINT - 1);   // 0 = ruhig, 1 = außer Atem: kürzer und lauter
    if (myBreath && !e.inhaled && e.breath < 1.9) { e.inhaled = true; sfx.inhale(BREATH_VOL * (1 + pant * 0.6), e.brate); }
    if (e.breath <= 0) { e.breath = 3.4 + Math.random() * 1.4; e.exhale = 0.9; e.inhaled = false; if (myBreath) sfx.exhale(BREATH_VOL * (1 + pant * 0.5), e.brate); }
    if (e.exhale > 0 && near < 90 * 90 && SURFACE - e.y > 1.2) {
      e.exhale -= dt;
      const f = dirFrom(e.yaw, e.pitch), big = e.exhale > 0.45, n = Math.random() < (big ? 0.9 : 0.5) ? (big ? 2 : 1) : 0;
      for (let i = 0; i < n; i++) env.bubble(e.x + f[0] * 0.8, e.y + f[1] * 0.8 - 0.05, e.z + f[2] * 0.8, 1, 0.1, 0, big ? 0.04 + Math.random() ** 1.5 * 0.17 : 0.02 + Math.random() * 0.06);
    }
  }
  let engine = 0;
  for (const v of vehicles.values()) {
    if (v.type === 'sub' && v.driver) { const d = Math.hypot(v.x - camera.position.x, v.y - camera.position.y, v.z - camera.position.z); engine = Math.max(engine, Math.min(1, (v.speed || 0) / 12 + 0.25) * Math.max(0, 1 - d / 150)); }
    if (v.driver === myId && alive) { v.x = me.x; v.y = me.y; v.z = me.z; v.yaw = me.hyaw; v.pitch = me.hpitch; v.speed = Math.hypot(me.vx, me.vy, me.vz); }
    else { const ox = v.x, oz = v.z, oy = v.y; v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k; v.z += (v.tz - v.z) * k; v.yaw = lerpAngle(v.yaw, v.tyaw, k); v.pitch += (v.tpitch - v.pitch) * k; v.speed += (Math.hypot(v.x - ox, v.y - oy, v.z - oz) / dt - v.speed) * 0.2; }
    v.mesh.position.set(v.x, v.y, v.z); v.driven = !!v.driver;
    v.mesh.userData.update(dt, v);
    if (v.driver === myId && v.type === 'sub' && alive) { sonarT -= dt; if (sonarT <= 0) { sonarT = 6; sfx.sonar(); } }
    if (v.driver && v.speed > 3 && Math.random() < dt * 25) { const f = dirFrom(v.yaw, v.pitch), o = v.type === 'sub' ? 4.2 : 0.6; env.bubble(v.x - f[0] * o, v.y - f[1] * o, v.z - f[2] * o, 1, 0.8, 1); }
  }
  sfx.engine(engine);
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
    if (p.whine) { const d = Math.hypot(p.x - camera.position.x, p.y - camera.position.y, p.z - camera.position.z); p.whine.set(Math.max(0, 1 - d / 140) ** 1.5); }
    if (p.life <= -0.15 || p.y < W.heightAt(p.x, p.z) - 0.5) removeProj(id);
  }
  updateShocks(dt);
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
// Rechte Maustaste halten = zielen. Waffen mit Zielfernrohr (scope: true) zoomen stark auf SCOPE_FOV,
// alle anderen holt man vors Auge und schaut über Kimme und Korn (ADS_FOV = leichter Zoom).
let FOV = 72; const SCOPE_FOV = 16, ADS_FOV = 50, SWAY_MIN = 0.0015, SWAY_MAX = 0.018;
let scoping = false, aim = 0, scoped = 0, swayT = 0, swayX = 0, swayY = 0;
// Einstellungen anwenden (hier, weil FOV erst ab dieser Stelle existiert)
onSettings((s) => {
  const Q = QUALITY[s.quality] || QUALITY.high;
  sfx.setVolume(s.volume);
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pr)); resize();
  setupPost(Q);                 // Leuchten und weiche Schatten
  setReefQuality(Q.reef);       // gilt ab der nächsten Welt (nächste Runde)
  FOV = s.fov;
  document.getElementById('fpsBox').classList.toggle('hidden', !s.fps);
});
const BREATH_VOL = 0.8;     // Lautstärke der Atemgeräusche
const BREATH_SPRINT = 2.8; // so viel schneller atmet man beim Sprinten
function updateScope(dt) {
  const w = you && you.alive && !you.veh && held < 0 ? you.w[you.slot] : null;
  const def = w ? WEAPONS[w[0]] : null, isScope = !!(def && def.scope);
  const can = scoping && def && !myFin && !(you.rl > 0);          // beim Nachladen kann man nicht zielen
  aim += ((can ? 1 : 0) - aim) * Math.min(1, dt * 12);
  scoped = isScope ? aim : 0;
  const fov = FOV + ((isScope ? SCOPE_FOV : ADS_FOV) - FOV) * aim;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  hud.scope(scoped > 0.5, aim > 0.5);
  view.scopeKick = Math.max(0, (view.scopeKick || 0) - dt * 3.5);
  hud.scopeKick(view.scopeKick);
  // Wackeln: zwei langsame Wellen übereinander, das sieht aus wie zitternde Hände. Es verschiebt das echte Zielen!
  const lifeLeft = you && you.mhp ? Math.max(0, Math.min(1, you.hp / you.mhp)) : 1;
  const amp = (SWAY_MIN + (SWAY_MAX - SWAY_MIN) * (1 - lifeLeft)) * aim * (isScope ? 1 : 0.45) * UP('scope') * (cling ? CLING.sway : 1);   // über Kimme und Korn wackelt es weniger; Ruhiges Visier
  swayT += dt;
  const nx = (Math.sin(swayT * 0.9) + Math.sin(swayT * 2.3 + 1) * 0.45) * amp, ny = (Math.cos(swayT * 1.1) + Math.sin(swayT * 2.9) * 0.4) * amp;
  camYaw += nx - swayX; camPitch += ny - swayY; swayX = nx; swayY = ny;
}
// Rückstoß: die Kamera springt beim Schuss nach oben (und etwas zur Seite) und federt dann zum Großteil zurück.
// Mehr Schaden pro Schuss = mehr Rückstoß. RECOIL_BACK = wie viel davon zurückfedert (0.75 = 75 %).
let recoilBack = 0;
const RECOIL = 0.0006, RECOIL_BACK = 0.75;
function recoil(def) {
  const k = Math.min(0.09, 0.006 + def.dmg * def.pellets * RECOIL) * UP('recoil');   // Rückstoßdämpfer
  camPitch = Math.min(1.45, camPitch + k);
  camYaw += (Math.random() - 0.5) * k * 0.6;
  recoilBack += k * RECOIL_BACK;
  shake = Math.max(shake, k * 2.5);
  view.kick = 1;
  view.kickPow = 0.7 + Math.min(1.5, def.dmg * def.pellets / 45);   // große Waffen schlagen stärker zurück
  view.kickRoll = (Math.random() - 0.5) * 0.12;
  // durchs Zielfernrohr: stärker hoch, das Fernrohr-Bild springt mit, und es federt langsamer zurück
  if (scoped > 0.5) { camPitch = Math.min(1.45, camPitch + k * 0.6); recoilBack += k * 0.6 * RECOIL_BACK; view.scopeKick = 1; }
}
// ---------- Nachladen: Magazin wechseln (die Bewegungen stehen in models.js bei poseReload) ----------
// Nachlade-Geräusche: [Zeitpunkt 0…1, Name des Sounds in audio.js]
const RELOAD_SOUNDS = [[0.11, 'magOut'], [0.3, 'stow'], [0.4, 'magGrab'], [0.6, 'magIn'], [0.73, 'cockBack'], [0.8, 'cockRelease'], [0.85, 'ready']];
// Rucksack und Ellbogen der zweiten Hand – in Kamera-Koordinaten (unten links, außerhalb des Bildes)
const PACK_CAM = new THREE.Vector3(-0.32, -0.55, 0.02), ELBOW_CAM = new THREE.Vector3(-0.35, -0.6, -0.12);
const IM = new THREE.Matrix4(), PL = new THREE.Vector3(), EL = new THREE.Vector3();
// Kiemen, Druckanzeige, Nachladen und die Waffe vor der Kamera (Ego-Perspektive)
function updateViewModel(dt) {
  // Rückstoß zurückfedern lassen
  const back = Math.min(recoilBack, dt * (scoped > 0.5 ? 0.22 : 0.6)); camPitch -= back; recoilBack -= back;   // im Fernrohr langsamer zurück
  updateScope(dt);
  const w = you && you.alive ? you.w[you.slot] : null;
  // Der Server schickt den Nachlade-Stand nur 20-mal pro Sekunde. Damit die Animation flüssig ist, zählt der Browser
  // selbst in jedem Bild weiter und gleicht sich nur an, wenn er mehr als 0,15 s danebenliegt.
  if (w && you.rl > 0) view.rl = view.rl > 0 && Math.abs(view.rl - you.rl) < 0.15 ? Math.max(0.001, view.rl - dt) : you.rl;
  else view.rl = 0;
  const reloading = !!w && view.rl > 0;
  const done = reloading ? Math.min(1, 1 - view.rl / you.rlT) : 0;
  // Nachlade-Geräusche: jedes einmal, wenn sein Zeitpunkt erreicht ist
  if (!reloading) view.rsnd = 0;
  else while (view.rsnd < RELOAD_SOUNDS.length && done >= RELOAD_SOUNDS[view.rsnd][0]) sfx[RELOAD_SOUNDS[view.rsnd++][1]](WEAPON_IDS.indexOf(w[0]));
  // Kiemen: beim Aufladen gehen sie langsam auf, beim Schuss puffen sie kurz auf (der Druck entweicht)
  const chg = chargeShot ? Math.min(1, (performance.now() - chargeStart) / Math.max(1, chargeEnd - chargeStart)) : 0;
  view.gills = Math.max(view.gills - dt * 4, view.kick * 0.7, chg);
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
  // Kippen: beim Magazinwechsel Boden nach links, beim Durchladen fast gerade
  const roll = rl ? reloadRoll(done) : 0;
  view.tilt += (roll - view.tilt) * Math.min(1, dt * 14);
  // Zielen über Kimme und Korn: die Waffe wandert in die Bildmitte, so dass die Visierlinie genau im Fadenkreuz liegt
  const ads = aim * (scoped > 0 ? 0 : 1);
  // Schwanken beim Schwimmen (beim Zielen viel weniger), Rückstoß beim Schießen
  const speed = Math.hypot(me.vx, me.vy, me.vz);
  view.bob += dt * (2 + speed * 0.6);
  view.kick = Math.max(0, view.kick - dt * 9);
  const sway = Math.min(1, speed / 10) * 0.012 * (1 - ads * 0.8);
  const K = view.kick * (view.kickPow || 1);
  const sh = U.fpShift, z = -(U.rear + 0.3) + sh[2], sx = sh[0] * (1 - ads), sy = sh[1] * (1 - ads);
  view.g.position.set(0.15 * (1 - ads), -0.13 * (1 - ads), 0);
  view.gun.position.set(
    sx - U.sightAt[0] * ads + Math.cos(view.bob) * sway - view.tilt * 0.08,
    sy - U.sightAt[1] * ads + Math.abs(Math.sin(view.bob)) * sway + view.tilt * 0.1 + K * 0.02,
    z - ads * 0.04 + K * 0.075);                                                    // Rückstoß: die Waffe fährt nach hinten
  view.gun.rotation.set(K * 0.2 + view.tilt * 0.15, view.tilt * 0.3, -view.tilt * 1.15 + K * (view.kickRoll || 0));   // −z-Drehung = Boden nach links
  // der Schlitten / Spannhebel fährt bei jedem Schuss kurz zurück
  if (U.cock && !rl) U.cock.g.position.z = U.cock.travel * Math.min(1, view.kick * 1.4);
  if (rl) {
    // Rucksack und Ellbogen von Kamera- in Waffen-Koordinaten umrechnen
    view.gun.updateMatrix(); IM.copy(view.gun.matrix).invert();
    PL.copy(PACK_CAM).sub(view.g.position).applyMatrix4(IM); EL.copy(ELBOW_CAM).sub(view.g.position).applyMatrix4(IM);
    poseReload(done, U, view.rHand, PL, EL);
  } else { view.rHand.visible = false; if (U.mag) { U.mag.g.position.copy(U.mag.seat); U.mag.g.visible = true; U.mag.fill.emissiveIntensity = 0.4 + 1.4 * view.charge; } }
  // Mündungsblitz: ganz kurz hell an der Mündung, und er beleuchtet die Hände
  const fl = Math.max(0, (view.kick - 0.55) / 0.45);
  if (!U.flash) { U.flash = makeFlash(); U.muzzle.add(U.flash); }
  U.flash.visible = fl > 0; U.flash.scale.setScalar(0.6 + fl * (view.kickPow || 1) * 0.5); U.flash.rotation.z = Math.random() * 6;
  flashLight.intensity = fl * 6;
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
    if ((firstPerson || aim > 0.5) && !v) { fpOn = true; want = 0; side = 0; up = 0; }
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
  view.g.visible = false; lamp.intensity = 0; torchBeam.visible = false; for (const l of glowLights) l.intensity = 0;   // keine Waffe und keine Lampe in der Lobby
  if (camera.fov !== FOV) { camera.fov = FOV; camera.updateProjectionMatrix(); } aim = scoped = 0; hud.scope(false, false);   // Zoom aus
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
    updateFinishers(dt); updateViewModel(dt); updateEntities(dt); updateCamera(dt); updateGlow(dt);
    sfx.setDepth(SURFACE - camera.position.y + depthOffset());   // die Gasblasen-Physik der Sounds hängt von der Tiefe ab
    if (bleedT > 0 && you && you.alive) { bleedT -= dt; bleedPuff -= dt; if (bleedPuff <= 0) { bleedPuff = 0.35; env.blood(me.x + (Math.random() - 0.5) * 0.6, me.y, me.z + (Math.random() - 0.5) * 0.6); } }
    const fx = alive ? me : camera.position;
    outside = !!zone && Math.hypot(fx.x - zone[0], fx.z - zone[1]) > zone[2];
    promptT -= dt; if (promptT <= 0) { promptT = 0.12; hud.prompt(computePrompt()); }
    if (mode === 'exp' && you && you.x) { if (held >= you.x.bagL.length || !you.alive) held = -1; updateTorch(dt, SURFACE - fx.y); updateAquarium(dt); }
    hud.update({ you, zone, alive: aliveN, energy: me.energy, depth: SURFACE - fx.y + depthOffset(), suit: mySuit, outside, time, dt,
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
      darkness(dep, LIGHT.exp);
      // floor 6 (Vulkanschlund) glows red from the lava below, floor 7 (Urzeittiefe) has a faint blue shimmer
      const lava = deepGlow(dep).lava, prim = deepGlow(dep).prim;
      hemi.color.setHex(0xb5e8ff).lerp(LAVA_SKY, lava).lerp(PRIM_SKY, prim);
      hemi.groundColor.setHex(0x12303c).lerp(LAVA_GROUND, lava).lerp(PRIM_GROUND, prim);
      hemi.intensity = Math.max(hemi.intensity, 0.9 * lava + 0.45 * prim);
    } else { darkness(SURFACE - camera.position.y + DEEP.brOffset, LIGHT.br); hemi.color.setHex(0xb5e8ff); hemi.groundColor.setHex(0x12303c); }
    hud.drawMini(env.mini, zone, { x: fx.x, z: fx.z, yaw: camYaw }, vehicles.values(), mode === 'exp' ? expPois() : W.pois, marks);
    if (mode === 'exp' && you && !you.alive && deadInfo) hud.spec(`<b>Ohnmächtig!</b>Erwischt von ${esc(deadInfo.by)}${deadInfo.lost ? ` · ${deadInfo.lost} Fische verloren` : ''} · aufwachen in ${Math.ceil(you.x?.rt || 0)} s`);
    else if (you && !you.alive && deadInfo) { const s = players.get(specId); hud.spec(`<b>Platz ${deadInfo.place}</b>Erwischt von ${esc(deadInfo.by)}${s ? ` · du beobachtest ${esc(s.name)}` : ''}`); }
    else if (!you) { const s = players.get(specId); hud.spec(`Zuschauer${s ? ` · ${esc(s.name)}` : ''}`); }
    else if (you.alive) hud.spec(null);
    if (mode !== 'exp' && you) updateTorch(dt, SURFACE - fx.y + DEEP.brOffset);
  } else lobbyCamera();
  if (env) env.update(dt, time, camera, phase === 'play' ? zone : null, outside);
  if (post.on) post.composer.render(); else renderer.render(scene, camera);
  // FPS-Anzeige (Bilder pro Sekunde), zweimal pro Sekunde aktualisiert
  if (settings.fps) { fpsN++; fpsT += dt; if (fpsT >= 0.5) { document.getElementById('fpsBox').textContent = Math.round(fpsN / fpsT) + ' FPS'; fpsN = 0; fpsT = 0; } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// small hook for automated smoke tests
window.__un = { get state() { return { phase, myId, you, aliveN, me, players: players.size, creatures: creatures.size, pickups: pickups.size, projs: projs.size }; },
  look(y, p) { camYaw = y; camPitch = p; }, key(c, d) { keys[c] = d; }, fire(b) { firing = b; }, send, tp(x, y, z) { me.x = x; me.y = y; me.z = z; }, world: () => W, ents: () => ({ players, creatures, vehicles, crates, pickups }) };
