// Undernite server: static file host + authoritative game simulation over WebSocket.
// Start with:  node server.js   (PORT env var optional, default 8080)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  World, SUITS, SUIT_ORDER, WEAPONS, WEAPON_IDS, RARITY, VEHICLES, VEHICLE_IDS,
  CREATURES, CREATURE_IDS, SURFACE, TICK_HZ, segSphere, creatureR,
  EXP_HP, EXP_BOAT, EXP_RESPAWN, EXP_START_MONEY, REGEN_DELAY, REGEN_RATE, REGEN_RATE_SURFACE, FLOORS, floorAt, FISH, GOLD_CHANCE, GOLD_MUL, BOSSES, BOSS_RESPAWN,
  TANKS, LUNGS, LAMPS, airUse, SHOP_WEAPONS, PLAY, fishValue, AQUARIUM, aqIncome, catchToNet,
} from './public/js/shared.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(DIR, 'public');
const PORT = +process.env.PORT || 8080;
const SPEED = +process.env.UN_SPEED || 1;     // sim steps per timer tick (testing only)
const DT = 1 / TICK_HZ;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let u;
  try { u = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (u === '/') u = '/index.html';
  const f = path.normalize(path.join(PUB, u));
  if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});
const wss = new WebSocketServer({ server });

// ---------- helpers ----------
const rnd = Math.random;
const r2 = v => Math.round(v * 100) / 100;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
const dist2d = (a, x, z) => Math.sqrt((a.x - x) ** 2 + (a.z - z) ** 2);
const pick = arr => arr[(rnd() * arr.length) | 0];
function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(`http://${i.address}:${PORT}`);
  return out;
}

const BOT_NAMES = ['Käpt\'n Kiemen', 'Graf Zackenbarsch', 'Tiefsee-Tina', 'Blubber-Bernd', 'Sardinen-Susi', 'Hummer-Hans',
  'Qualle-Kalle', 'Muräne-Mona', 'Seestern-Stefan', 'Krabben-Klaus', 'Plankton-Paula', 'Nautilus-Nils', 'Koralle-Karla',
  'Dorsch-Dieter', 'Rochen-Rita', 'Algen-Achim', 'Barrakuda-Bea', 'Tintenfisch-Tom', 'Seegurken-Sven', 'Anglerfisch-Anna',
  'Makrelen-Max', 'Flossen-Frieda', 'Kugelfisch-Kurt', 'Perlen-Pia'];
const PHASES = [
  { wait: 45, shrink: 35, r: 200, dps: 2 }, { wait: 35, shrink: 30, r: 125, dps: 3 },
  { wait: 30, shrink: 25, r: 70, dps: 5 }, { wait: 25, shrink: 20, r: 32, dps: 7 },
  { wait: 20, shrink: 20, r: 10, dps: 10 }, { wait: 10, shrink: 15, r: 0, dps: 14 },
];
const LOOT_W = [['needler', 30], ['scatter', 22], ['harpoon', 22], ['torpedo', 12], ['pistol', 14]];
const W_SCORE = { pistol: 1, needler: 2.2, scatter: 2.0, harpoon: 2.2, torpedo: 2.6 };
const W_PREF = { pistol: 16, needler: 18, scatter: 8, harpoon: 30, torpedo: 24 };

// ---------- state ----------
const clients = new Map();   // ws -> client
let nextId = 1;
const G = {
  phase: 'lobby', mode: 'br', seed: (rnd() * 1e9) | 0, world: null, bots: 11, time: 0,
  players: new Map(), creatures: [], vehicles: new Map(), pickups: new Map(), crates: [], proj: [],
  zone: null, events: [], endT: 0, noHumanT: 0,
  bossT: [], fishT: [],                 // expedition: boss respawn timers, fish spawn timers per floor
};
G.world = new World(G.seed, G.mode);

function send(ws, obj) { if (ws.readyState === 1) ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
function broadcast(obj) { const s = JSON.stringify(obj); for (const c of clients.values()) send(c.ws, s); }
function lobbyMsg() {
  return { t: 'lobby', seed: G.seed, mode: G.mode, bots: G.bots, urls: lanUrls(),
    players: [...clients.values()].map(c => ({ id: c.id, name: c.name, suit: c.suit })) };
}
const ev = (...a) => G.events.push(a);

// ---------- match setup ----------
function mkPlayer(id, name, suit, bot) {
  const S = SUITS[suit];
  return { id, name, suit, bot, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, lx: 0, ly: 0, lz: 0, yaw: 0, pitch: 0,
    hp: S.hp, maxhp: S.hp, shield: 0, alive: true, weapons: [{ id: 'pistol', rar: 0, ammo: WEAPONS.pistol.mag }, null, null],
    slot: 0, reload: 0, reloadT: 1, nextFire: 0, veh: 0, kills: 0, grabbed: 0, ink: 0, shockT: 0, boost: false, place: 0,
    zoneAcc: 0, ye: [],
    thinkT: rnd() * 0.4, goal: null, crate: -1, target: null, mode: 'loot', skill: 0.12 + rnd() * 0.08, reactT: 0,   // skill = aim error (higher = worse)
    phase: rnd() * 6.28, stuckT: 0, burst: 0, holdT: 0, strT: 0, fightUntil: 0, peaceUntil: 0 };
}
function rollRarity(bonus = 0) { const r = rnd() - bonus; return r < 0.05 ? 3 : r < 0.2 ? 2 : r < 0.5 ? 1 : 0; }
function rollWeapon() {
  let t = rnd() * 100;
  for (const [id, w] of LOOT_W) { if ((t -= w) < 0) return id; }
  return 'needler';
}
function addPickup(k, x, y, z, wid = '', rar = 0, ammo = -1) {
  const p = { id: nextId++, k, wid, rar, ammo: ammo < 0 && wid ? WEAPONS[wid].mag : ammo, x, y, z };
  G.pickups.set(p.id, p);
  ev('pk+', p.id, k, wid, rar, r2(x), r2(y), r2(z));
  return p;
}
function removePickup(p) { G.pickups.delete(p.id); ev('pk-', p.id); }
function randSpot(rad, lift) {
  const W = G.world;
  for (let i = 0; i < 30; i++) {
    const a = rnd() * 6.283, d = Math.sqrt(rnd()) * rad;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, y = W.heightAt(x, z) + lift;
    if (!W.cols.some(c => (c.x - x) ** 2 + (c.y - y) ** 2 + (c.z - z) ** 2 < (c.r + 2) ** 2)) return { x, y, z };
  }
  return { x: 0, y: W.heightAt(0, 0) + lift, z: 0 };
}

function startMatch() {
  const W = G.world;
  G.phase = 'play'; G.time = 0; G.noHumanT = 0;
  G.players = new Map(); G.proj = []; G.pickups = new Map(); G.events = [];
  G.crates = W.crates.map(c => ({ x: c.x, y: c.y, z: c.z, open: false }));
  G.vehicles = new Map();
  for (const s of W.vehSpawns) {
    const v = { id: nextId++, type: s.type, x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: 0, hp: VEHICLES[s.type].hp, driver: 0, nextFire: 0 };
    G.vehicles.set(v.id, v);
  }
  G.creatures = [];
  for (let i = 0; i < 7; i++) {
    const p = randSpot(250, 10 + rnd() * 25);
    G.creatures.push({ id: nextId++, type: 'shark', ...p, vx: 0, vy: 0, vz: 0, yaw: rnd() * 6.28, pitch: 0, hp: CREATURES.shark.hp,
      state: 'patrol', wp: null, tid: 0, scanT: rnd(), t: 0, bites: 0 });
  }
  for (const l of W.lairs) G.creatures.push({ id: nextId++, type: 'octo', x: l.x, y: l.y, z: l.z, vx: 0, vy: 0, vz: 0, yaw: rnd() * 6.28, pitch: 0,
    hp: CREATURES.octo.hp, state: 'lurk', lair: l, tid: 0, cool: 0, grip: 0, acc: 0, scanT: rnd() });
  for (const s of W.swarms) {
    const ph = rnd() * 6.28;
    for (let i = 0; i < 7; i++) G.creatures.push({ id: nextId++, type: 'jelly', x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0,
      hp: CREATURES.jelly.hp, state: 'drift', sw: s, sph: ph, ox: (rnd() - 0.5) * 12, oy: (rnd() - 0.5) * 7, oz: (rnd() - 0.5) * 12, ph: rnd() * 6.28 });
  }
  // participants
  for (const c of clients.values()) { const p = mkPlayer(c.id, c.name, c.suit, false); G.players.set(p.id, p); c.playing = true; }
  const names = [...BOT_NAMES].sort(() => rnd() - 0.5);
  for (let i = 0; i < G.bots; i++) {
    const p = mkPlayer(nextId++, names[i % names.length], pick(SUIT_ORDER), true);
    G.players.set(p.id, p);
  }
  for (const p of G.players.values()) {
    const a = rnd() * 6.283, d = 60 + rnd() * 190;
    p.x = p.lx = Math.cos(a) * d; p.z = p.lz = Math.sin(a) * d; p.y = p.ly = SURFACE - 6;
    p.yaw = Math.atan2(p.x, p.z); p.pitch = -0.6;
  }
  // floor loot
  for (let i = 0; i < 24; i++) {
    const s = randSpot(260, 1.0), r = rnd();
    if (r < 0.55) addPickup('w', s.x, s.y, s.z, rollWeapon(), rollRarity(-0.15));
    else addPickup(r < 0.78 ? 'med' : 'sh', s.x, s.y, s.z);
  }
  G.events = [];
  G.zone = { x: 0, z: 0, r: 430, fx: 0, fz: 0, fr: 430, nx: 0, nz: 0, nr: 430, ph: 0, t: 0, sh: false };
  pickNextZone();
  for (const c of clients.values()) send(c.ws, startMsg(c));
  console.log(`[match] started: ${clients.size} human(s), ${G.bots} bot(s), seed ${G.seed}`);
}
function startMsg(c) {
  const me = G.players.get(c.id);
  return { t: 'start', seed: G.seed, mode: G.mode, you: c.id, spectator: !me, spawn: me ? [r2(me.x), r2(me.y), r2(me.z), r2(me.yaw)] : null,
    players: [...G.players.values()].map(p => [p.id, p.name, p.suit, p.bot ? 1 : 0]),
    crates: G.crates.map(c => c.open ? 1 : 0),
    pickups: [...G.pickups.values()].map(p => [p.id, p.k, p.wid, p.rar, r2(p.x), r2(p.y), r2(p.z)]) };
}
function pickNextZone() {
  const z = G.zone, P = PHASES[z.ph];
  if (!P) { z.nx = z.x; z.nz = z.z; z.nr = 0; return; }
  const maxOff = Math.max(0, z.r - P.r) * 0.9;
  const a = rnd() * 6.283, d = Math.sqrt(rnd()) * (z.ph === 0 ? 90 : maxOff);
  z.nx = clamp(z.x + Math.cos(a) * d, -170, 170); z.nz = clamp(z.z + Math.sin(a) * d, -170, 170); z.nr = P.r;
}
function updateZone(dt) {
  const z = G.zone, P = PHASES[z.ph];
  if (!P) return;
  z.t += dt;
  if (!z.sh) {
    if (z.t >= P.wait) { z.sh = true; z.t = 0; z.fx = z.x; z.fz = z.z; z.fr = z.r; ev('msg', 'Das Schwarzwasser rückt vor!'); }
  } else {
    const k = Math.min(1, z.t / P.shrink);
    z.x = z.fx + (z.nx - z.fx) * k; z.z = z.fz + (z.nz - z.fz) * k; z.r = z.fr + (z.nr - z.fr) * k;
    if (k >= 1) { z.ph++; z.sh = false; z.t = 0; pickNextZone(); }
  }
}
const zoneDps = () => PHASES[Math.min(G.zone.ph, PHASES.length - 1)].dps;
const aliveCount = () => { let n = 0; for (const p of G.players.values()) if (p.alive) n++; return n; };

// ---------- damage ----------
function damage(p, amt, src, how, sx, sz) {
  if (!p.alive || amt <= 0) return;
  if (!p.bot && src && src.bot) amt *= 0.7;        // bots hit humans a little softer
  if (p.bot && (how === 'shark' || how === 'octo' || how === 'jelly')) amt *= 0.5;
  if (p.bot && src && src.bot) amt *= 0.1;   // keep bot-vs-bot fights from emptying the lobby too early
  const v = p.veh && G.vehicles.get(p.veh);
  if (v && v.type === 'sub' && how !== 'zone') { damageVehicle(v, amt, src); return; }
  let a = amt;
  p.hurtT = G.time;   // expedition: pauses health regeneration
  if (how !== 'zone') { const s = Math.min(p.shield, a); p.shield -= s; a -= s; }
  p.hp -= a;
  if (!p.bot) p.ye.push(['hurt', Math.round(amt), r2(sx ?? p.x), r2(sz ?? p.z), how === 'zone' ? 1 : 0]);
  if (src && src.id && !src.bot && src !== p) src.ye.push(['hm', Math.round(amt), p.hp <= 0 ? 1 : 0]);
  if (p.bot && src && src.id && src !== p && src.alive && (!src.bot || G.time >= p.peaceUntil) && (!p.target || rnd() < 0.5)) {
    if (src.bot) p.fightUntil = G.time + 5 + rnd() * 4; p.target = { k: 'p', ref: src }; p.reactT = Math.min(p.reactT, 0.25); }
  if (p.hp <= 0) { if (G.mode === 'exp') expDown(p, src, how); else kill(p, src, how); }
}
function damageVehicle(v, amt, src) {
  if (v.dead) return;
  v.hp -= amt;
  const d = v.driver && G.players.get(v.driver);
  if (d && !d.bot) d.ye.push(['hurt', Math.round(amt), r2(v.x), r2(v.z), 0]);
  if (src && src.id && !src.bot && d && src !== d) src.ye.push(['hm', Math.round(amt), 0]);
  if (v.hp <= 0) {
    v.dead = true; G.vehicles.delete(v.id);
    ev('boom', 0, r2(v.x), r2(v.y), r2(v.z), 7);
    ev('vdie', v.id);
    if (d) { d.veh = 0; damage(d, 35, src, 'wreck', v.x, v.z); }
  }
}
function kill(p, src, how) {
  p.alive = false; p.hp = 0;
  p.place = aliveCount() + 1;
  if (p.veh) { const v = G.vehicles.get(p.veh); if (v) v.driver = 0; p.veh = 0; }
  if (p.grabbed) { const o = G.creatures.find(c => c.id === p.grabbed); if (o) releaseOcto(o); }
  for (const w of p.weapons) if (w && !(w.id === 'pistol' && w.rar === 0))
    addPickup('w', p.x + (rnd() - 0.5) * 2, p.y + rnd(), p.z + (rnd() - 0.5) * 2, w.id, w.rar, w.ammo);
  if (rnd() < 0.6) addPickup(rnd() < 0.5 ? 'med' : 'sh', p.x, p.y + 0.5, p.z);
  const label = { zone: 'Schwarzwasser', shark: 'Hai', octo: 'Oktopus', jelly: 'Qualle', left: 'Verbindung', wreck: 'Explosion' }[how];
  let by = label || '?';
  if (src && src.id && src !== p) { src.kills++; by = src.name; } else if (src && src.id && src === p) by = 'Eigentor';
  ev('kill', by, p.name, p.id, src && src.id && src !== p ? src.id : 0);
  if (!p.bot) p.ye.push(['dead', p.place, by]);
}
function damageCreature(c, amt, src) {
  if (c.dead) return;
  c.hp -= amt;
  if (src && !src.bot) src.ye.push(['hm', Math.round(amt), c.hp <= 0 ? 1 : 0]);
  if (c.type === 'fish' || c.type === 'boss') return expCreatureHurt(c, src);
  if (c.type === 'octo' && c.state === 'hold') c.grip -= amt;
  if (c.type === 'shark' && src && src.alive && c.state !== 'retreat') { c.state = 'hunt'; c.tid = src.id; }
  if (c.hp <= 0) {
    c.dead = true;
    if (c.type === 'octo') releaseOcto(c);
    ev('cdie', c.id, r2(c.x), r2(c.y), r2(c.z));
    if (src && c.type !== 'jelly') ev('kill', src.name, CREATURES[c.type].name, 0, src.id);
    if (c.type === 'shark') addPickup('sh', c.x, c.y, c.z);
    if (c.type === 'octo') addPickup('w', c.x, c.y + 0.5, c.z, rollWeapon(), Math.max(1, rollRarity(0.1)));
  }
}

// ---------- weapons ----------
function startReload(p) {
  const w = p.weapons[p.slot];
  if (!w || p.reload > 0) return;
  const d = WEAPONS[w.id];
  if (w.ammo >= d.mag) return;
  p.reload = p.reloadT = d.reload;
}
function spawnProj(p, wid, ox, oy, oz, d, mul, vehId) {
  const def = WEAPONS[wid];
  let dx = d[0] + (rnd() * 2 - 1) * def.spread, dy = d[1] + (rnd() * 2 - 1) * def.spread, dz = d[2] + (rnd() * 2 - 1) * def.spread;
  const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= l; dy /= l; dz /= l;
  const pr = { id: nextId++, o: p.id, wid, x: ox, y: oy, z: oz, dx, dy, dz, sp: def.speed, life: def.life, dmg: def.dmg * mul, splash: def.splash, veh: vehId || 0 };
  G.proj.push(pr);
  ev('pj', pr.id, WEAPON_IDS.indexOf(wid), p.id, r2(ox), r2(oy), r2(oz), +dx.toFixed(3), +dy.toFixed(3), +dz.toFixed(3));
}
function fire(p, d) {
  if (!p.alive || !Array.isArray(d) || d.length !== 3 || d.some(v => typeof v !== 'number' || !isFinite(v))) return;
  const l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
  if (l < 0.5) return;
  d = [d[0] / l, d[1] / l, d[2] / l];
  const v = p.veh && G.vehicles.get(p.veh);
  if (v && v.type === 'sub') {
    if (G.time < v.nextFire - 0.06) return;
    v.nextFire = G.time + 1 / WEAPONS.subtorp.rate;
    spawnProj(p, 'subtorp', v.x + d[0] * 4.4, v.y + d[1] * 4.4 - 0.6, v.z + d[2] * 4.4, d, 1, v.id);
    return;
  }
  const w = p.weapons[p.slot];
  if (!w || p.reload > 0 || G.time < p.nextFire - 0.06) return;
  if (w.ammo <= 0) { startReload(p); return; }
  const def = WEAPONS[w.id], S = SUITS[p.suit];
  w.ammo--; p.nextFire = G.time + 1 / def.rate;
  const o = S.r + 0.5;
  for (let i = 0; i < def.pellets; i++) spawnProj(p, w.id, p.x + d[0] * o, p.y + d[1] * o, p.z + d[2] * o, d, RARITY[w.rar].mul * S.dmg, 0);
  if (w.ammo === 0) startReload(p);
}
function explode(pr, x, y, z) {
  const owner = G.players.get(pr.o);
  ev('boom', pr.id, r2(x), r2(y), r2(z), pr.splash);
  const fall = (d) => pr.dmg * (1 - 0.7 * d / pr.splash);
  for (const q of G.players.values()) {
    if (!q.alive) continue;
    const d = Math.sqrt((q.x - x) ** 2 + (q.y - y) ** 2 + (q.z - z) ** 2) - SUITS[q.suit].r;
    if (d < pr.splash) damage(q, fall(Math.max(0, d)) * (q === owner ? 0.5 : 1), owner, 'p', x, z);
  }
  for (const v of [...G.vehicles.values()]) {
    if (v.type !== 'sub' || v.driver) continue;   // driven subs are damaged through their driver
    const d = dist(v, { x, y, z }) - 3;
    if (d < pr.splash) damageVehicle(v, fall(Math.max(0, d)), owner);
  }
  for (const c of G.creatures) {
    if (c.dead) continue;
    const d = dist(c, { x, y, z }) - creatureR(c.type, c.sub);
    if (d < pr.splash) damageCreature(c, fall(Math.max(0, d)), owner);
  }
}
function stepProjectiles(dt) {
  const W = G.world;
  for (const pr of G.proj) {
    const sx = pr.dx * pr.sp * dt, sy = pr.dy * pr.sp * dt, sz = pr.dz * pr.sp * dt;
    let best = W.segmentHit(pr.x, pr.y, pr.z, pr.x + sx, pr.y + sy, pr.z + sz), hit = null, kind = 0;
    if (best < 0) best = 2;
    for (const q of G.players.values()) {
      if (!q.alive || q.id === pr.o) continue;
      const inSub = q.veh && G.vehicles.get(q.veh)?.type === 'sub';
      if (inSub) continue;
      const t = segSphere(pr.x, pr.y, pr.z, sx, sy, sz, q.x, q.y, q.z, SUITS[q.suit].r * 1.05);
      if (t >= 0 && t < best) { best = t; hit = q; kind = 1; }
    }
    for (const v of G.vehicles.values()) {
      if (v.type !== 'sub' || v.id === pr.veh) continue;
      const t = segSphere(pr.x, pr.y, pr.z, sx, sy, sz, v.x, v.y, v.z, 3);
      if (t >= 0 && t < best) { best = t; hit = v; kind = 2; }
    }
    for (const c of G.creatures) {
      if (c.dead) continue;
      const t = segSphere(pr.x, pr.y, pr.z, sx, sy, sz, c.x, c.y, c.z, creatureR(c.type, c.sub));
      if (t >= 0 && t < best) { best = t; hit = c; kind = 3; }
    }
    const owner = G.players.get(pr.o);
    if (best <= 1) {
      const hx = pr.x + sx * best, hy = pr.y + sy * best, hz = pr.z + sz * best;
      pr.dead = true;
      if (pr.splash) explode(pr, hx, hy, hz);
      else {
        ev('hit', pr.id, r2(hx), r2(hy), r2(hz), kind);
        if (kind === 1) damage(hit, pr.dmg, owner, 'p', pr.x, pr.z);
        else if (kind === 2) { const d = hit.driver && G.players.get(hit.driver); if (d) damage(d, pr.dmg, owner, 'p', pr.x, pr.z); else damageVehicle(hit, pr.dmg, owner); }
        else if (kind === 3) damageCreature(hit, pr.dmg, owner);
      }
      continue;
    }
    pr.x += sx; pr.y += sy; pr.z += sz; pr.life -= dt;
    if (pr.life <= 0) { pr.dead = true; if (pr.splash) explode(pr, pr.x, pr.y, pr.z); }
  }
  G.proj = G.proj.filter(p => !p.dead);
}

// ---------- loot / interaction ----------
function openCrate(i) {
  const c = G.crates[i];
  if (!c || c.open) return;
  c.open = true; ev('crate', i);
  const drop = (k, wid, rar) => { const a = rnd() * 6.283; addPickup(k, c.x + Math.cos(a) * 1.8, c.y + 1.2 + rnd() * 0.6, c.z + Math.sin(a) * 1.8, wid, rar); };
  drop('w', rollWeapon(), rollRarity(0.05));
  if (rnd() < 0.65) drop(rnd() < 0.5 ? 'med' : 'sh');
  if (rnd() < 0.35) drop('w', rollWeapon(), rollRarity(0));
}
const wScore = (w) => w ? W_SCORE[w.id] * RARITY[w.rar].mul : 0;
const pkScore = (pk) => W_SCORE[pk.wid] * RARITY[pk.rar].mul;
function takeWeapon(p, pk, slot) {
  const old = p.weapons[slot];
  if (old) addPickup('w', p.x, p.y + 0.3, p.z, old.id, old.rar, old.ammo);
  p.weapons[slot] = { id: pk.wid, rar: pk.rar, ammo: pk.ammo };
  p.slot = slot; p.reload = 0;
  removePickup(pk);
  if (!p.bot) p.ye.push(['got', pk.k, pk.wid, pk.rar]);
}
function autoCollect(p) {
  const S = SUITS[p.suit], reach = S.r + 2.2;
  for (const pk of G.pickups.values()) {
    const dx = pk.x - p.x, dy = pk.y - p.y, dz = pk.z - p.z;
    if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
    if (pk.k === 'med') { if (p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + 50); removePickup(pk); if (!p.bot) p.ye.push(['got', 'med', '', 0]); } }
    else if (pk.k === 'sh') { if (p.shield < 100) { p.shield = Math.min(100, p.shield + 50); removePickup(pk); if (!p.bot) p.ye.push(['got', 'sh', '', 0]); } }
    else {
      const freeSlot = p.weapons.indexOf(null);
      const dupe = p.weapons.some(w => w && w.id === pk.wid && w.rar >= pk.rar);
      if (dupe) continue;
      if (freeSlot >= 0) takeWeapon(p, pk, freeSlot);
      else if (p.bot) {
        let worst = 0; for (let i = 1; i < 3; i++) if (wScore(p.weapons[i]) < wScore(p.weapons[worst])) worst = i;
        if (pkScore(pk) > wScore(p.weapons[worst]) * 1.15) takeWeapon(p, pk, worst);
      }
    }
  }
}
function interact(p) {
  if (!p.alive) return;
  if (p.veh) { const v = G.vehicles.get(p.veh); if (v) v.driver = 0; p.veh = 0; return; }
  const S = SUITS[p.suit];
  let best = null, bd = 1e9;
  for (const pk of G.pickups.values()) if (pk.k === 'w') { const d = dist(p, pk); if (d < S.r + 3.5 && d < bd) { bd = d; best = { k: 'pk', pk }; } }
  G.crates.forEach((c, i) => { if (!c.open) { const d = dist(p, c); if (d < S.r + 4.5 && d < bd) { bd = d; best = { k: 'crate', i }; } } });
  if (!S.mech && !p.grabbed) for (const v of G.vehicles.values()) if (!v.driver) { const d = dist(p, v) - (v.type === 'sub' ? 2 : 0); if (d < S.r + 4.5 && d < bd) { bd = d; best = { k: 'veh', v }; } }
  if (!best) return;
  if (best.k === 'pk') takeWeapon(p, best.pk, p.slot);
  else if (best.k === 'crate') openCrate(best.i);
  else { best.v.driver = p.id; p.veh = best.v.id; }
}
function releaseOcto(o) {
  const p = G.players.get(o.tid);
  if (p && p.grabbed === o.id) p.grabbed = 0;
  o.state = 'return'; o.cool = 10; o.tid = 0;
}
function struggle(p) {
  if (!p.grabbed) return;
  const o = G.creatures.find(c => c.id === p.grabbed);
  if (o) o.grip -= 9;
}

// ---------- creatures ----------
function steer(c, tx, ty, tz, speed, dt, r) {
  let dx = tx - c.x, dy = ty - c.y, dz = tz - c.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const k = Math.min(1, 2.5 * dt);
  c.vx += (dx / d * speed - c.vx) * k; c.vy += (dy / d * speed - c.vy) * k; c.vz += (dz / d * speed - c.vz) * k;
  c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
  G.world.collide(c, r);
  const h = Math.sqrt(c.vx * c.vx + c.vz * c.vz);
  if (h > 0.3) { c.yaw = Math.atan2(-c.vx, -c.vz); c.pitch = Math.atan2(c.vy, h); }
  return d;
}
const los = (a, b) => G.world.segmentHit(a.x, a.y, a.z, b.x, b.y, b.z) < 0;
const inSub = (p) => p.veh && G.vehicles.get(p.veh)?.type === 'sub';

function sharkStep(c, dt) {
  const W = G.world;
  if (c.state === 'patrol') {
    if (!c.wp || dist(c, c.wp) < 7) { const z = G.zone, s = randSpot(Math.min(250, Math.max(40, z.r)), 6 + rnd() * 28); c.wp = { x: clamp(s.x + z.x, -270, 270), y: s.y, z: clamp(s.z + z.z, -270, 270) }; }
    steer(c, c.wp.x, c.wp.y, c.wp.z, 5.5, dt, 1.2);
    c.scanT -= dt;
    if (c.scanT <= 0 && G.time > 35) {
      c.scanT = 0.5;
      let best = null, bd = 1e9;
      for (const p of G.players.values()) {
        if (!p.alive) continue;
        const d = dist(c, p), range = (p.hp < p.maxhp * 0.5 ? 70 : 36) * (inSub(p) ? 0.5 : 1);
        if (d < range && d < bd && los(c, p)) { bd = d; best = p; }
      }
      if (best) { c.state = 'hunt'; c.tid = best.id; if (!best.bot) best.ye.push(['warn', 'Ein Hai hat dich gewittert!']); }
    }
  } else if (c.state === 'hunt') {
    const p = G.players.get(c.tid);
    if (!p || !p.alive || dist(c, p) > 85 || c.hp < 25) { c.state = 'patrol'; c.wp = null; return; }
    const d = steer(c, p.x, p.y, p.z, 14.5, dt, 1.2);
    const reach = (inSub(p) ? 3 : SUITS[p.suit].r) + 1.8;
    if (d < reach) {
      ev('bite', r2(p.x), r2(p.y), r2(p.z));
      damage(p, 18, null, 'shark', c.x, c.z);
      c.state = 'retreat'; c.t = 2.4;
      const ax = c.x - p.x, az = c.z - p.z, al = Math.sqrt(ax * ax + az * az) || 1;
      c.rp = { x: c.x + ax / al * 30 + (rnd() - 0.5) * 20, y: Math.min(SURFACE - 8, c.y + 8), z: c.z + az / al * 30 + (rnd() - 0.5) * 20 };
    }
  } else {
    c.t -= dt;
    steer(c, c.rp.x, c.rp.y, c.rp.z, 10, dt, 1.2);
    if (c.t <= 0) { if (++c.bites >= 2 || rnd() < 0.35) { c.state = 'patrol'; c.wp = null; c.bites = 0; c.scanT = 10 + rnd() * 8; } else c.state = 'hunt'; }
  }
  const g = W.heightAt(c.x, c.z) + 2.5;
  if (c.y < g) c.y = g;
}
function octoStep(c, dt) {
  const L = c.lair;
  if (c.state === 'lurk') {
    c.cool -= dt; c.scanT -= dt;
    c.vx = c.vy = c.vz = 0;
    if (c.cool <= 0 && c.scanT <= 0) {
      c.scanT = 0.3;
      let best = null, bd = 13;
      for (const p of G.players.values()) {
        if (!p.alive || p.grabbed || SUITS[p.suit].mech || inSub(p)) continue;
        const d = dist(c, p);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) { c.state = 'lunge'; c.tid = best.id; }
    }
  } else if (c.state === 'lunge') {
    const p = G.players.get(c.tid);
    if (!p || !p.alive || p.grabbed || inSub(p) || dist(c, L) > 30) { c.state = 'return'; c.cool = 5; return; }
    const d = steer(c, p.x, p.y, p.z, 13, dt, 1.0);
    if (d < SUITS[p.suit].r + 1.3) {
      c.state = 'hold'; c.grip = 45; c.acc = 0; p.grabbed = c.id; p.ink = 3.5;
      ev('ink', r2(p.x), r2(p.y), r2(p.z));
      if (!p.bot) p.ye.push(['grab']);
    }
  } else if (c.state === 'hold') {
    const p = G.players.get(c.tid);
    if (!p || !p.alive || p.grabbed !== c.id || c.grip <= 0 || inSub(p)) { releaseOcto(c); return; }
    c.x = p.x; c.y = p.y - 0.4; c.z = p.z; c.yaw = p.yaw; c.pitch = 0;
    c.acc += 6 * dt;
    if (c.acc >= 3) { c.acc -= 3; damage(p, 3, null, 'octo', c.x, c.z); }
  } else {
    const d = steer(c, L.x, L.y, L.z, 6, dt, 1.0);
    c.cool -= dt;
    if (d < 2) { c.state = 'lurk'; c.pitch = 0; }
  }
}
function jellyStep(c) {
  const t = G.time, s = c.sw;
  c.x = s.x + Math.cos(t * 0.05 + c.sph) * 25 + c.ox;
  c.z = s.z + Math.sin(t * 0.05 + c.sph) * 25 + c.oz;
  c.y = Math.max(G.world.heightAt(c.x, c.z) + 3, s.y + c.oy + Math.sin(t * 0.7 + c.ph) * 1.6);
  for (const p of G.players.values()) {
    if (!p.alive || inSub(p) || G.time < p.shockT) continue;
    const rr = SUITS[p.suit].r + 1.2;
    if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2 < rr * rr) {
      p.shockT = G.time + 0.8;
      if (!p.bot) p.ye.push(['shock']);
      damage(p, 8, null, 'jelly', c.x, c.z);
    }
  }
}

// ---------- bots ----------
function botThink(b) {
  const W = G.world, z = G.zone, S = SUITS[b.suit];
  // target acquisition
  let best = null, bd = G.time < 30 ? 0 : 30;
  // bots fight each other in short bursts with breaks in between, so rounds last long enough for humans
  const cur = b.target && b.target.k === 'p' ? b.target.ref : null;
  if (cur && cur.bot && G.time > b.fightUntil) { b.target = null; b.peaceUntil = G.time + 7 + rnd() * 9; }
  const peace = G.time < b.peaceUntil;
  for (const p of G.players.values()) {
    if (p === b || !p.alive || (peace && p.bot)) continue;
    const d = dist(b, p);
    if (d < bd && los(b, p)) { bd = d; best = { k: 'p', ref: p }; }
  }
  for (const c of G.creatures) {
    if (c.dead) continue;
    const mine = (c.type === 'shark' && c.tid === b.id && c.state !== 'patrol') || (c.type === 'octo' && c.state === 'lunge' && c.tid === b.id);
    if (!mine) continue;
    const d = dist(b, c);
    if (d < 24 && d < bd + 10) { bd = d; best = { k: 'c', ref: c }; }
  }
  const prev = b.target;
  if (best && (!prev || prev.ref !== best.ref)) { b.reactT = 0.6 + rnd() * 0.7; if (best.k === 'p' && best.ref.bot) b.fightUntil = G.time + 5 + rnd() * 4; }
  if (best || !prev || !targetOk(prev) || dist(b, prev.ref) > 60) b.target = best;
  // choose weapon for the range
  if (b.target) {
    const d = dist(b, b.target.ref); let bi = b.slot, bs = -1;
    b.weapons.forEach((w, i) => {
      if (!w) return;
      let s = wScore(w);
      if (w.id === 'scatter') s *= d < 14 ? 1.6 : d > 25 ? 0.3 : 1;
      if (w.id === 'harpoon') s *= d > 25 ? 1.4 : 1;
      if (w.id === 'torpedo') s *= d < 10 ? 0.2 : 1;
      if (s > bs) { bs = s; bi = i; }
    });
    if (bi !== b.slot && b.reload <= 0) b.slot = bi;
  }
  // zone awareness
  const tz = z.nr > 0 ? { x: z.nx, z: z.nz, r: z.nr } : { x: z.x, z: z.z, r: Math.max(z.r, 4) };
  const P = PHASES[z.ph];
  const tLeft = P ? (z.sh ? 0 : P.wait - z.t) : 0;
  const outNow = dist2d(b, z.x, z.z) > z.r - 8;
  if (outNow || (dist2d(b, tz.x, tz.z) > tz.r * 0.8 && (z.sh || tLeft < 25))) {
    b.mode = 'zone';
    const a = rnd() * 6.283, d = tz.r * 0.35 * rnd();
    const x = tz.x + Math.cos(a) * d, zz = tz.z + Math.sin(a) * d;
    if (!b.goal || !b.goal.zone) b.goal = { x, y: W.heightAt(x, zz) + 5 + rnd() * 8, z: zz, zone: true };
    return;
  }
  if (b.mode === 'zone') { b.mode = 'loot'; b.goal = null; }
  if (b.target) return;
  // loot
  const have = b.weapons.filter(Boolean).length;
  let goal = null, gd = 1e9; b.crate = -1;
  const inNext = (o) => dist2d(o, tz.x, tz.z) < tz.r;
  for (const pk of G.pickups.values()) {
    const want = pk.k === 'med' ? b.hp < b.maxhp * 0.75 : pk.k === 'sh' ? b.shield < 60
      : (have < 3 || pkScore(pk) > Math.min(...b.weapons.map(wScore)) * 1.15);
    if (!want || !inNext(pk)) continue;
    const d = dist(b, pk);
    if (d < 70 && d < gd) { gd = d; goal = { x: pk.x, y: pk.y, z: pk.z }; }
  }
  if (!goal && (have < 3 || b.shield < 50)) G.crates.forEach((c, i) => {
    if (c.open || !inNext(c)) return;
    const d = dist(b, c);
    if (d < 160 && d < gd) { gd = d; goal = { x: c.x, y: c.y + 1.2, z: c.z }; b.crate = i; }
  });
  if (goal) { b.goal = goal; if (b.crate >= 0 && gd < S.r + 4) openCrate(b.crate); return; }
  if (!b.goal || b.goal.zone || dist(b, b.goal) < 4) {
    const a = rnd() * 6.283, d = tz.r * 0.7 * Math.sqrt(rnd());
    const x = clamp(tz.x + Math.cos(a) * d, -270, 270), zz = clamp(tz.z + Math.sin(a) * d, -270, 270);
    b.goal = { x, y: W.heightAt(x, zz) + 4 + rnd() * 12, z: zz };
  }
}
const targetOk = (T) => T && (T.k === 'p' ? T.ref.alive : !T.ref.dead);
function botStep(b, dt) {
  const W = G.world, S = SUITS[b.suit];
  if (b.grabbed) { b.strT -= dt; if (b.strT <= 0) { struggle(b); b.strT = 0.35; } }
  b.thinkT -= dt;
  if (b.thinkT <= 0) { b.thinkT = 0.25 + rnd() * 0.15; botThink(b); }
  if (!targetOk(b.target)) b.target = null;
  const tgt = b.target ? b.target.ref : null;
  let gx = b.x, gy = b.y, gz = b.z;
  if (tgt && b.mode !== 'zone') {
    const dx = tgt.x - b.x, dy = tgt.y - b.y, dz = tgt.z - b.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, dh = Math.sqrt(dx * dx + dz * dz) || 1;
    const w = b.weapons[b.slot], pref = w ? W_PREF[w.id] : 15;
    const s = Math.sin(G.time * 0.9 + b.phase) * 7;
    gx = tgt.x - dx / d * pref + (-dz / dh) * s; gz = tgt.z - dz / d * pref + (dx / dh) * s;
    gy = tgt.y - dy / d * pref * 0.3 + Math.cos(G.time * 0.7 + b.phase) * 3;
  } else if (b.goal) { gx = b.goal.x; gy = b.goal.y; gz = b.goal.z; }
  let dx = gx - b.x, dy = gy - b.y, dz = gz - b.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d > 1) { dx /= d; dy /= d; dz /= d; } else { dx = dy = dz = 0; }
  if (b.y < W.heightAt(b.x, b.z) + S.r + 1.5) dy += 0.7;
  const sp = S.speed * (b.mode === 'zone' ? S.boost * 0.9 : 1) * (b.grabbed ? 0.3 : 1) * (G.time < b.shockT ? 0.5 : 1);
  b.boost = b.mode === 'zone';
  const k = Math.min(1, 4 * dt);
  b.vx += (dx * sp - b.vx) * k; b.vy += (dy * sp - b.vy) * k; b.vz += (dz * sp - b.vz) * k;
  const ox = b.x, oy = b.y, oz = b.z;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  W.collide(b, S.r);
  const moved = Math.sqrt((b.x - ox) ** 2 + (b.y - oy) ** 2 + (b.z - oz) ** 2);
  if (d > 3 && moved < sp * dt * 0.25) {
    b.stuckT += dt;
    if (b.stuckT > 1) { b.stuckT = 0; if (b.goal) b.goal.y = Math.min(SURFACE - 6, b.goal.y + 12); b.vy += 6; }
  } else b.stuckT = Math.max(0, b.stuckT - dt);
  // facing + fire
  if (tgt) {
    const ax = tgt.x - b.x, ay = tgt.y - b.y, az = tgt.z - b.z, ad = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    b.yaw = Math.atan2(-ax, -az); b.pitch = Math.asin(clamp(ay / ad, -1, 1));
    b.reactT -= dt;
    const w = b.weapons[b.slot];
    if (w && b.reactT <= 0 && ad < Math.min(42, WEAPONS[w.id].range * 0.9) && G.time >= b.nextFire && G.time >= b.holdT && b.reload <= 0) {
      const def = WEAPONS[w.id], tt = ad / def.speed, e = b.skill;
      // bots only half-predict where you are going, so moving targets are harder for them to hit
      const lead = tt * (0.3 + rnd() * 0.4);
      const px = tgt.x + (tgt.vx || 0) * lead - b.x, py = tgt.y + (tgt.vy || 0) * lead - b.y, pz = tgt.z + (tgt.vz || 0) * lead - b.z;
      const pl = Math.sqrt(px * px + py * py + pz * pz) || 1;
      fire(b, [px / pl + (rnd() + rnd() - 1) * e, py / pl + (rnd() + rnd() - 1) * e, pz / pl + (rnd() + rnd() - 1) * e]);
      b.burst++;
      if (def.rate > 5 && b.burst >= 6 + rnd() * 6) { b.holdT = G.time + 0.5 + rnd(); b.burst = 0; }
      else b.holdT = G.time + rnd() * 0.15;
    }
  } else {
    const h = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    if (h > 0.5) { b.yaw = Math.atan2(-b.vx, -b.vz); b.pitch = Math.atan2(b.vy, h); }
    const w = b.weapons[b.slot];
    if (w && w.ammo < WEAPONS[w.id].mag * 0.5) startReload(b);
  }
}

// =====================================================================
// ---------- Tiefsee-Expedition ----------
// Dive, hunt fish, sell them at the boat, buy better gear, beat a boss
// on every floor. Progress is saved per player name in saves/.
// =====================================================================
const SAVE_FILE = path.join(DIR, 'saves', 'expedition.json');
let saves = {};
try { saves = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')); } catch { saves = {}; }
let saveTimer = null;
const saveKey = (name) => name.toLowerCase();
function storeProgress(p) {
  saves[saveKey(p.name)] = { money: p.money, tank: p.tank, lung: p.lung, lamp: p.lamp, bag: p.bag, aq: p.aq, aqLvl: p.aqLvl, last: Date.now(),
    weapons: p.weapons.map(w => w ? { id: w.id, rar: w.rar } : null) };
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.mkdir(path.dirname(SAVE_FILE), { recursive: true }, () =>
      fs.writeFile(SAVE_FILE, JSON.stringify(saves, null, 1), (e) => { if (e) console.error('[save]', e.message); }));
  }, 1000);
}
const depthOf = (o) => SURFACE - o.y;
const nearBoat = (p, r = 16, d = 6) => dist2d(p, EXP_BOAT.x, EXP_BOAT.z) < r && depthOf(p) < d;
// the underwater base with the aquarium and an air station
const nearBase = (p, r = 16) => !!G.world.base && dist(p, G.world.base.c) < r;
// wake up in the water next to the ship (it is 24 m long along z, 7 m wide)
const boatSpawn = () => { const s = rnd() < 0.5 ? -1 : 1; return { x: EXP_BOAT.x + s * (6 + rnd() * 2), y: SURFACE - 2.5, z: EXP_BOAT.z + (rnd() - 0.5) * 12, yaw: s > 0 ? 1.57 : -1.57 }; };

function expJoin(c) {
  const p = mkPlayer(c.id, c.name, 'triton', false);
  const s = saves[saveKey(c.name)];
  p.money = s ? (s.money || 0) : EXP_START_MONEY;   // brand-new divers get starting money
  p.tank = clamp(s?.tank || 0, 0, TANKS.length - 1); p.lung = clamp(s?.lung || 0, 0, LUNGS.length - 1);
  p.lamp = clamp(s?.lamp || 0, 0, LAMPS.length - 1);
  // caught fish: { s: species, g: golden } (very old saves stored only the value)
  const fishList = (l) => Array.isArray(l) ? l.map(e => typeof e === 'number' ? { v: e } : e).filter(e => e && (e.v != null || (e.b != null ? BOSSES[e.b] : FISH[e.s]))) : [];
  p.bag = fishList(s?.bag);
  p.aq = fishList(s?.aq).filter(e => e.v == null); p.aqLvl = clamp(s?.aqLvl || 0, 0, AQUARIUM.sizes.length - 1); p.aqAcc = 0;
  // the aquarium only earns while you really play (no offline money, no AFK money)
  p.actT = G.time; p.act = null; p.afk = false;
  if (s?.weapons) p.weapons = s.weapons.map(w => w && WEAPONS[w.id] ? { id: w.id, rar: w.rar, ammo: WEAPONS[w.id].mag } : null);
  if (!p.weapons.some(Boolean)) p.weapons[0] = { id: 'pistol', rar: 0, ammo: WEAPONS.pistol.mag };
  p.slot = Math.max(0, p.weapons.findIndex(Boolean));
  p.hp = p.maxhp = EXP_HP; p.air = TANKS[p.tank].cap; p.envAcc = 0; p.warnT = 0; p.respawnT = 0; p.lowAir = false;
  const s0 = boatSpawn(); p.x = p.lx = s0.x; p.y = p.ly = s0.y; p.z = p.lz = s0.z; p.yaw = s0.yaw; p.pitch = -0.3;
  G.players.set(p.id, p); c.playing = true;
  return p;
}
const metaMsg = () => ({ t: 'meta', players: [...G.players.values()].map(p => [p.id, p.name, p.suit, p.bot ? 1 : 0]) });

function startExp() {
  const W = G.world;
  G.phase = 'play'; G.time = 0; G.noHumanT = 0;
  G.players = new Map(); G.proj = []; G.pickups = new Map(); G.events = []; G.crates = []; G.vehicles = new Map();
  G.creatures = []; G.zone = null;
  G.bossT = BOSSES.map(() => 0); G.fishT = FLOORS.map(() => 0);
  for (let i = 0; i < BOSSES.length; i++) spawnBoss(i);
  for (let f = 0; f < FLOORS.length; f++) for (let k = 0; k < FLOORS[f].fish; k++) spawnFish(f, true);
  for (const c of clients.values()) expJoin(c);
  for (const c of clients.values()) send(c.ws, startMsg(c));
  console.log(`[expedition] started with ${clients.size} diver(s), seed ${G.seed}`);
}
function spawnBoss(i) {
  const B = BOSSES[i], L = G.world.bossLairs[i];
  G.creatures.push({ id: nextId++, type: 'boss', sub: i, x: L.x, y: L.y, z: L.z, vx: 0, vy: 0, vz: 0, yaw: rnd() * 6.28, pitch: 0,
    hp: B.hp, maxhp: B.hp, state: 'idle', lair: L, tid: 0, cool: 0, scanT: 0, t: 0, orb: rnd() * 6.28, dmgBy: new Set() });
}
function pickSpecies(f) {
  const list = FISH.map((s, i) => i).filter(i => FISH[i].floor === f);
  let t = rnd() * list.reduce((a, i) => a + FISH[i].w, 0);
  for (const i of list) if ((t -= FISH[i].w) < 0) return i;
  return list[0];
}
function waterSpot(f, near) {
  const F = FLOORS[f], W = G.world;
  for (let k = 0; k < 14; k++) {
    let x, z;
    if (near) { const a = rnd() * 6.283, d = 28 + rnd() * 40; x = near.x + Math.cos(a) * d; z = near.z + Math.sin(a) * d; }
    else { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * (PLAY - 10); x = Math.cos(a) * d; z = Math.sin(a) * d; }
    if (Math.abs(x) > PLAY - 6 || Math.abs(z) > PLAY - 6) continue;
    const ground = W.heightAt(x, z), yTop = SURFACE - F.top - 3, yBot = Math.max(SURFACE - F.bot, ground + 2);
    if (yBot >= yTop) continue;
    return { x, y: yBot + rnd() * (yTop - yBot), z };
  }
  return null;
}
function spawnFish(f, initial) {
  // most fish appear around divers on that floor, the rest anywhere on the floor
  const divers = [...G.players.values()].filter(p => p.alive && floorAt(depthOf(p)) === f);
  const near = !initial && divers.length && rnd() < 0.65 ? pick(divers) : null;
  const s = waterSpot(f, near) || waterSpot(f, null);
  if (!s) return;
  const sub = pickSpecies(f), S = FISH[sub];
  G.creatures.push({ id: nextId++, type: 'fish', sub, gold: rnd() < GOLD_CHANCE, ...s, vx: 0, vy: 0, vz: 0, yaw: rnd() * 6.28, pitch: 0,
    hp: S.hp, maxhp: S.hp, state: 'swim', wp: null, tid: 0, cool: 0, age: 0, scanT: rnd() * 0.5, fleeT: 0 });
}
function nearestDiver(c, range) {
  let best = null, bd = range;
  for (const p of G.players.values()) { if (!p.alive) continue; const d = dist(c, p); if (d < bd) { bd = d; best = p; } }
  return best;
}
function fishStep(c, dt) {
  const S = FISH[c.sub], F = FLOORS[S.floor], W = G.world;
  c.age += dt; c.cool -= dt; c.scanT -= dt;
  if (c.scanT <= 0) {
    c.scanT = 0.3;
    const p = nearestDiver(c, S.dmg ? 18 : 13);
    if (p) { c.tid = p.id; c.state = S.dmg ? 'attack' : 'flee'; c.fleeT = 2.5; }
    else if (c.state === 'attack' || (c.state === 'flee' && (c.fleeT -= 0.3) <= 0)) c.state = 'swim';
    // fish far away from every diver swim off and appear somewhere new later
    if (c.age > 45 && !nearestDiver(c, 160)) { c.dead = true; return; }
  }
  const p = c.tid && G.players.get(c.tid);
  const yTop = SURFACE - F.top - 2, yBot = SURFACE - F.bot;
  if (c.state === 'attack' && p && p.alive) {
    const d = steer(c, p.x, p.y, p.z, S.speed, dt, S.size * 0.6);
    if (d < S.size + SUITS[p.suit].r + 0.8 && c.cool <= 0) {
      c.cool = 1.4; p.lastHitBy = S.name;
      ev('bite', r2(p.x), r2(p.y), r2(p.z));
      damage(p, S.dmg, null, 'beast', c.x, c.z);
    }
  } else if (c.state === 'flee' && p) {
    const ax = c.x - p.x, ay = c.y - p.y, az = c.z - p.z, al = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    steer(c, c.x + ax / al * 10, clamp(c.y + ay / al * 10, yBot, yTop), c.z + az / al * 10, S.speed * 1.5, dt, S.size * 0.6);
  } else {
    if (!c.wp || dist(c, c.wp) < 3) {
      const a = rnd() * 6.283, d = 8 + rnd() * 22;
      const x = clamp(c.x + Math.cos(a) * d, -PLAY + 8, PLAY - 8), z = clamp(c.z + Math.sin(a) * d, -PLAY + 8, PLAY - 8);
      c.wp = { x, y: clamp(c.y + (rnd() - 0.5) * 10, Math.max(yBot, W.heightAt(x, z) + 2), yTop), z };
    }
    steer(c, c.wp.x, c.wp.y, c.wp.z, S.speed * 0.45, dt, S.size * 0.6);
  }
  if (c.y > yTop) c.y = yTop;
}
function bossStep(c, dt) {
  const B = BOSSES[c.sub], L = c.lair;
  c.cool -= dt; c.scanT -= dt;
  const p = c.tid && G.players.get(c.tid);
  if (c.state === 'idle' || c.state === 'return') {
    if (c.state === 'idle') { c.orb += dt * 0.25; steer(c, L.x + Math.cos(c.orb) * 8, L.y + Math.sin(c.orb * 2) * 1.5, L.z + Math.sin(c.orb) * 8, B.speed * 0.3, dt, B.r * 0.8); }
    else if (steer(c, L.x, L.y, L.z, B.speed * 0.8, dt, B.r * 0.8) < 6) c.state = 'idle';
    c.hp = Math.min(c.maxhp, c.hp + c.maxhp * 0.02 * dt);      // slowly heals when left alone
    if (c.hp >= c.maxhp) c.dmgBy.clear();
    if (c.scanT <= 0) {
      c.scanT = 0.4;
      const t = nearestDiver(c, 32);
      if (t && los(c, t)) { c.state = 'chase'; c.tid = t.id; if (!t.bot) t.ye.push(['warn', `${B.name} greift an!`]); }
    }
    return;
  }
  if (!p || !p.alive || dist(c, L) > 75) { c.state = 'return'; c.tid = 0; return; }
  if (c.state === 'swing') {
    steer(c, c.sx, c.sy, c.sz, B.speed, dt, B.r * 0.8);
    if ((c.t -= dt) <= 0) c.state = 'chase';
    return;
  }
  const d = steer(c, p.x, p.y, p.z, B.speed, dt, B.r * 0.8);
  if (d < B.r + SUITS[p.suit].r + 1.2 && c.cool <= 0) {
    c.cool = 1.6; p.lastHitBy = B.name;
    ev('bite', r2(p.x), r2(p.y), r2(p.z));
    damage(p, B.dmg, null, 'beast', c.x, c.z);
    // swim past and turn around for the next bite
    const ax = c.vx, az = c.vz, al = Math.sqrt(ax * ax + az * az) || 1;
    c.state = 'swing'; c.t = 1.3; c.sx = c.x + ax / al * 16; c.sy = c.y + 3; c.sz = c.z + az / al * 16;
  }
}
function expCreatureHurt(c, src) {
  if (c.type === 'boss') {
    if (src && src.id) { c.dmgBy.add(src.id); if (c.state === 'idle' || c.state === 'return') { c.state = 'chase'; c.tid = src.id; } }
  } else if (src && src.alive) { c.tid = src.id; c.state = FISH[c.sub].dmg ? 'attack' : 'flee'; c.fleeT = 3; }
  if (c.hp > 0) return;
  c.dead = true;
  ev('cdie', c.id, r2(c.x), r2(c.y), r2(c.z));
  if (c.type === 'fish') {
    if (!src || !src.id || !G.players.has(src.id)) return;
    const S = FISH[c.sub], value = S.value * (c.gold ? GOLD_MUL : 1);
    src.bag.push({ s: c.sub, g: c.gold ? 1 : 0 });
    src.ye.push(['fish', c.sub, c.gold ? 1 : 0, value]);
  } else {
    const B = BOSSES[c.sub];
    G.bossT[c.sub] = BOSS_RESPAWN;
    ev('kill', src?.name || '?', B.name, 0, src?.id || 0);
    ev('msg', `${B.name} wurde besiegt!`);
    for (const id of c.dmgBy) {
      const p = G.players.get(id);
      if (!p) continue;
      // no money right away: the boss goes into your catch. Sell it at the boat (reward) OR put it into the aquarium (€/s) – not both.
      p.bag.push({ b: c.sub }); p.ye.push(['boss', c.sub, B.reward]); storeProgress(p);
    }
  }
}
function expDown(p, src, how) {
  p.alive = false; p.hp = 0; p.respawnT = EXP_RESPAWN; p.vx = p.vy = p.vz = 0;
  const lost = Math.ceil(p.bag.length / 2);
  p.bag.splice(0, lost);
  const by = how === 'zone' ? (p.lastHitBy || 'Tiefsee') : how === 'beast' ? (p.lastHitBy || 'Raubfisch') : src && src.name ? src.name : 'Tiefsee';
  ev('kill', by, p.name, p.id, 0);
  p.ye.push(['dead', 0, by, lost]);
  storeProgress(p);
}
// selling fish and the aquarium (no money needed for these)
function expFishAction(p, m) {
  const i = m.i | 0;
  if (m.k === 'sellall' && p.bag.length) {
    const value = p.bag.reduce((a, e) => a + fishValue(e), 0), n = p.bag.length;
    p.money += value; p.bag = []; p.ye.push(['sold', n, value]);
  } else if (m.k === 'sell' && p.bag[i]) {
    const value = fishValue(p.bag[i]); p.money += value; p.bag.splice(i, 1); p.ye.push(['sold', 1, value]);
  } else if (m.k === 'aq' && p.bag[i]) {
    if (p.bag[i].v != null) { p.ye.push(['shop', 'Dieser alte Fang kann nur verkauft werden.']); return true; }
    if (p.aq.length >= AQUARIUM.sizes[p.aqLvl]) { p.ye.push(['shop', 'Dein Aquarium ist voll – vergrößere es oder verkaufe einen Fisch daraus.']); return true; }
    const f = p.bag.splice(i, 1)[0]; p.aq.push(f);
    p.ye.push(['aqin', catchToNet(f)]);
  } else if (m.k === 'aqsell' && p.aq[i]) {
    // set free: makes room, but no money – it already earned money per second (selling OR aquarium, not both)
    const f = p.aq.splice(i, 1)[0]; p.ye.push(['aqfree', catchToNet(f)]);
  } else return false;
  storeProgress(p);
  return true;
}
function expBuy(p, m) {
  const atBase = ['aq', 'aqsell', 'aqup'].includes(m.k);   // aquarium things happen in the base, everything else at the ship
  if (!p.alive || !(atBase ? nearBase(p, 20) : nearBoat(p, 22, 10))) { p.ye.push(['shop', atBase ? 'Du musst an der Basis sein!' : 'Du musst am Boot sein!']); return; }
  if (expFishAction(p, m)) return;
  let price, label, apply;
  if (m.k === 'aqup' && AQUARIUM.sizes[p.aqLvl + 1]) {
    price = AQUARIUM.prices[p.aqLvl + 1]; label = `Aquarium mit ${AQUARIUM.sizes[p.aqLvl + 1]} Plätzen`; apply = () => { p.aqLvl++; };
  } else if (m.k === 'tank' && TANKS[p.tank + 1]) {
    const T = TANKS[p.tank + 1]; price = T.price; label = T.name; apply = () => { p.tank++; p.air = T.cap; };
  } else if (m.k === 'lamp' && LAMPS[p.lamp + 1]) {
    const L = LAMPS[p.lamp + 1]; price = L.price; label = L.name; apply = () => { p.lamp++; };
  } else if (m.k === 'lung' && LUNGS[p.lung + 1]) {
    const L = LUNGS[p.lung + 1]; price = L.price; label = L.name; apply = () => { p.lung++; };
  } else if (m.k === 'w' && SHOP_WEAPONS[m.i]) {
    const it = SHOP_WEAPONS[m.i];
    if (p.weapons.some(w => w && w.id === it.wid && w.rar >= it.rar)) { p.ye.push(['shop', 'Die hast du schon (oder eine bessere)!']); return; }
    price = it.price; label = `${WEAPONS[it.wid].name} (${RARITY[it.rar].name})`;
    apply = () => {
      // same weapon type gets upgraded, otherwise a free slot, otherwise the weakest slot
      let slot = p.weapons.findIndex(w => w && w.id === it.wid);
      if (slot < 0) slot = p.weapons.indexOf(null);
      if (slot < 0) { slot = 0; for (let i = 1; i < 3; i++) if (wScore(p.weapons[i]) < wScore(p.weapons[slot])) slot = i; }
      p.weapons[slot] = { id: it.wid, rar: it.rar, ammo: WEAPONS[it.wid].mag }; p.slot = slot; p.reload = 0;
    };
  } else return;
  if (p.money < price) { p.ye.push(['shop', `Zu wenig Geld – dir fehlen ${price - p.money} €`]); return; }
  p.money -= price; apply();
  p.ye.push(['bought', label, price]);
  storeProgress(p);
}
function tickExp(dt) {
  G.time += dt;
  for (const p of G.players.values()) {
    if (!p.alive) {
      if ((p.respawnT -= dt) <= 0) {
        const s = boatSpawn();
        Object.assign(p, { alive: true, hp: p.maxhp, shield: 0, air: TANKS[p.tank].cap, x: s.x, y: s.y, z: s.z, lx: s.x, ly: s.y, lz: s.z, yaw: s.yaw, envAcc: 0, lowAir: false, reload: 0 });
        for (const w of p.weapons) if (w) w.ammo = WEAPONS[w.id].mag;
        p.ye.push(['spawn', r2(s.x), r2(s.y), r2(s.z), r2(s.yaw)]);
      }
      continue;
    }
    const k = 0.5;
    p.vx += ((p.x - p.lx) / dt - p.vx) * k; p.vy += ((p.y - p.ly) / dt - p.vy) * k; p.vz += ((p.z - p.lz) / dt - p.vz) * k;
    p.lx = p.x; p.ly = p.y; p.lz = p.z;
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { p.reload = 0; const w = p.weapons[p.slot]; if (w) w.ammo = WEAPONS[w.id].mag; } }
    // air and pressure
    const depth = depthOf(p), T = TANKS[p.tank];
    if (depth < 2.6 || nearBase(p, 14)) { p.air = Math.min(T.cap, p.air + T.cap * 0.35 * dt); p.lowAir = false; }   // surface or air station in the base
    else p.air = Math.max(0, p.air - airUse(depth) * LUNGS[p.lung].mul * (p.boost ? 1.4 : 1) * dt);
    if (!p.lowAir && p.air < T.cap * 0.25) { p.lowAir = true; p.ye.push(['warn', 'Luft wird knapp – auftauchen!']); }
    let hurt = 0;
    if (p.air <= 0) { hurt += 8; p.lastHitBy = 'Luftmangel'; }
    if (depth > T.maxDepth) {
      hurt += 6; p.lastHitBy = 'Wasserdruck';
      if ((p.warnT -= dt) <= 0) { p.warnT = 3; p.ye.push(['warn', `Zu tief für die ${T.name}! Max. ${T.maxDepth} m`]); }
    }
    // health regeneration after a few seconds without damage, faster at the surface
    if (p.hp < p.maxhp && G.time - (p.hurtT || 0) > REGEN_DELAY) p.hp = Math.min(p.maxhp, p.hp + (depth < 2.6 ? REGEN_RATE_SURFACE : REGEN_RATE) * dt);
    if (hurt) { p.envAcc += hurt * dt; if (p.envAcc >= 1) { const a = Math.floor(p.envAcc); p.envAcc -= a; damage(p, a, null, 'zone', p.x, p.z); } }
    // back at the boat with fish: remind once to sell them or put them into the aquarium
    const atBoat = nearBoat(p);
    if (atBoat && !p.atBoat && p.bag.length) p.ye.push(['bagHint', p.bag.length, p.bag.reduce((a, e) => a + fishValue(e), 0)]);
    p.atBoat = atBoat;
    const atBase = nearBase(p);
    if (atBase && !p.atBase) p.ye.push(['baseHint', p.bag.length]);
    p.atBase = atBase;
  }
  // aquarium income – only while you actually play: after AFK_TIME seconds without
  // swimming, looking around or shooting it pauses (no money for standing around AFK)
  for (const p of G.players.values()) {
    const afk = G.time - p.actT > AQUARIUM.afkTime;
    if (afk !== p.afk) { p.afk = afk; if (p.aq && p.aq.length) p.ye.push(['warn', afk ? 'AFK – dein Aquarium verdient gerade nichts!' : 'Weiter geht’s – das Aquarium verdient wieder.']); }
    if (afk || !p.aq || !p.aq.length) continue;
    p.aqAcc += aqIncome(p.aq) * dt;
    if (p.aqAcc >= 1) { const a = Math.floor(p.aqAcc); p.aqAcc -= a; p.money += a; if ((p.aqSaveT = (p.aqSaveT || 0) + a) > 50) { p.aqSaveT = 0; storeProgress(p); } }
  }
  // creatures + respawning
  for (const c of G.creatures) {
    if (c.dead) continue;
    if (c.type === 'fish') fishStep(c, dt); else if (c.type === 'boss') bossStep(c, dt);
  }
  G.creatures = G.creatures.filter(c => !c.dead);
  for (let i = 0; i < BOSSES.length; i++) if (G.bossT[i] > 0 && (G.bossT[i] -= dt) <= 0) { spawnBoss(i); ev('msg', `${BOSSES[i].name} ist zurück in Etage ${i + 1}!`); }
  const counts = FLOORS.map(() => 0);
  for (const c of G.creatures) if (c.type === 'fish') counts[FISH[c.sub].floor]++;
  for (let f = 0; f < FLOORS.length; f++) if (counts[f] < FLOORS[f].fish && (G.fishT[f] -= dt) <= 0) { G.fishT[f] = 1.2; spawnFish(f, false); }
  stepProjectiles(dt);
  if (clients.size === 0) toLobby();
}
function quitExp() {
  for (const p of G.players.values()) storeProgress(p);
  toLobby();
}

// ---------- main tick ----------
function tick(dt) {
  if (G.mode === 'exp') return tickExp(dt);
  G.time += dt;
  updateZone(dt);
  const z = G.zone, dps = zoneDps();
  for (const p of G.players.values()) {
    if (!p.alive) continue;
    if (p.bot) botStep(p, dt);
    else {
      const k = 0.5;
      p.vx += ((p.x - p.lx) / dt - p.vx) * k; p.vy += ((p.y - p.ly) / dt - p.vy) * k; p.vz += ((p.z - p.lz) / dt - p.vz) * k;
      p.lx = p.x; p.ly = p.y; p.lz = p.z;
    }
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { p.reload = 0; const w = p.weapons[p.slot]; if (w) w.ammo = WEAPONS[w.id].mag; } }
    if (p.ink > 0) p.ink -= dt;
    if (dist2d(p, z.x, z.z) > z.r) { p.zoneAcc += dps * dt; if (p.zoneAcc >= 1) { const a = Math.floor(p.zoneAcc); p.zoneAcc -= a; damage(p, a, null, 'zone', z.x, z.z); } }
    if (p.alive) autoCollect(p);
  }
  for (const v of G.vehicles.values()) {
    const d = v.driver && G.players.get(v.driver);
    if (d && d.alive && d.veh === v.id) { v.x = d.x; v.y = d.y; v.z = d.z; v.yaw = d.yaw; v.pitch = d.pitch; }
    else if (v.driver) v.driver = 0;
  }
  for (const c of G.creatures) {
    if (c.dead) continue;
    if (c.type === 'shark') sharkStep(c, dt); else if (c.type === 'octo') octoStep(c, dt); else jellyStep(c);
  }
  G.creatures = G.creatures.filter(c => !c.dead);
  stepProjectiles(dt);
  // end conditions
  const alive = [...G.players.values()].filter(p => p.alive);
  const humansAlive = alive.filter(p => !p.bot).length;
  if (clients.size === 0) { toLobby(); return; }
  if (alive.length <= 1) endMatch();
  else if (humansAlive === 0) { G.noHumanT += dt; if (G.noHumanT > 6) endMatch(); }
}
function snapshot() {
  const z = G.zone, P = z && PHASES[z.ph];
  const common = {
    tm: r2(G.time), n: aliveCount(),
    z: z ? [r2(z.x), r2(z.z), r2(z.r), r2(z.nx), r2(z.nz), r2(z.nr), z.ph, P ? Math.ceil((z.sh ? P.shrink : P.wait) - z.t) : 0, z.sh ? 1 : 0] : null,
    p: [...G.players.values()].filter(p => p.alive).map(p => [p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), r2(p.pitch), Math.ceil(p.hp), Math.round(p.shield),
      (p.boost ? 2 : 0) | (p.grabbed ? 4 : 0), p.weapons[p.slot] ? WEAPON_IDS.indexOf(p.weapons[p.slot].id) : -1, p.veh]),
    c: G.creatures.map(c => [c.id, CREATURE_IDS.indexOf(c.type), r2(c.x), r2(c.y), r2(c.z), r2(c.yaw), r2(c.pitch),
      ['hunt', 'lunge', 'chase', 'swing', 'attack', 'flee'].includes(c.state) ? 1 : c.state === 'hold' ? 2 : 0,
      c.sub || 0, c.maxhp ? Math.max(0, Math.ceil(c.hp / c.maxhp * 100)) : 100, c.gold ? 1 : 0]),
    v: [...G.vehicles.values()].map(v => [v.id, VEHICLE_IDS.indexOf(v.type), r2(v.x), r2(v.y), r2(v.z), r2(v.yaw), r2(v.pitch), Math.ceil(v.hp), v.driver]),
    e: G.events,
  };
  const cs = JSON.stringify(common);
  for (const c of clients.values()) {
    const p = G.players.get(c.id);
    let you = null, ye = [];
    if (p) {
      const v = p.veh && G.vehicles.get(p.veh);
      you = { alive: p.alive, hp: Math.ceil(p.hp), mhp: p.maxhp, sh: Math.round(p.shield), slot: p.slot, kills: p.kills, place: p.place,
        w: p.weapons.map(w => w ? [w.id, w.rar, w.ammo] : 0), rl: r2(p.reload), rlT: p.reloadT, veh: p.veh, vhp: v ? Math.ceil(v.hp) : 0,
        grab: p.grabbed ? 1 : 0, ink: r2(Math.max(0, p.ink)) };
      if (G.mode === 'exp') you.x = { money: p.money, bag: p.bag.length, bagV: p.bag.reduce((a, e) => a + fishValue(e), 0), air: r2(p.air),
        tank: p.tank, lung: p.lung, lamp: p.lamp, rt: r2(Math.max(0, p.respawnT)),
        bagL: p.bag.map(catchToNet), aq: p.aq.map(catchToNet), aqLvl: p.aqLvl, aqRate: Math.round(aqIncome(p.aq) * 100) / 100, afk: p.afk ? 1 : 0 };
      ye = p.ye; p.ye = [];
    }
    send(c.ws, `{"t":"s","c":${cs},"you":${JSON.stringify(you)},"ye":${JSON.stringify(ye)}}`);
  }
  G.events = [];
}
function endMatch() {
  if (G.phase !== 'play') return;
  const rest = [...G.players.values()].filter(p => p.alive).sort((a, b) => b.hp + b.shield - a.hp - a.shield);
  rest.forEach((p, i) => { p.place = i + 1; });
  const rank = [...G.players.values()].sort((a, b) => a.place - b.place).map(p => ({ id: p.id, n: p.name, place: p.place, k: p.kills, bot: p.bot ? 1 : 0, suit: p.suit }));
  snapshot();
  G.phase = 'end'; G.endT = 10;
  broadcast({ t: 'end', rank, total: G.players.size });
  console.log(`[match] ended after ${Math.round(G.time)}s, winner: ${rank[0]?.n}`);
}
function toLobby() {
  if (G.mode === 'exp') for (const p of G.players.values()) storeProgress(p);
  G.phase = 'lobby';
  G.seed = (rnd() * 1e9) | 0; G.world = new World(G.seed, G.mode);
  G.players = new Map(); G.creatures = []; G.proj = []; G.events = [];
  broadcast(lobbyMsg());
}

setInterval(() => {
  try {
    if (G.phase === 'play') {
      for (let i = 0; i < SPEED && G.phase === 'play'; i++) tick(DT);
      if (G.phase === 'play') snapshot();
    } else if (G.phase === 'end') { G.endT -= DT * SPEED; if (G.endT <= 0) toLobby(); }
  } catch (e) { console.error('[tick error]', e); }
}, 1000 / TICK_HZ);

// ---------- network ----------
const cleanName = (s) => String(s || '').replace(/[<>&"]/g, '').trim().slice(0, 16) || 'Taucher';
wss.on('connection', (ws) => {
  const c = { id: nextId++, ws, name: 'Taucher', suit: 'triton', playing: false };
  clients.set(ws, c);
  send(ws, { t: 'welcome', id: c.id });
  if (G.phase === 'lobby') broadcast(lobbyMsg());
  else {
    send(ws, lobbyMsg());
    // battle royale: watch the running round. expedition: joins as soon as the name arrives ('set')
    if (G.phase === 'play' && G.mode === 'br') send(ws, startMsg(c));
  }
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const p = G.phase === 'play' ? G.players.get(c.id) : null;
    switch (m.t) {
      case 'set':
        if (m.name !== undefined) c.name = cleanName(m.name);
        if (SUITS[m.suit]) c.suit = m.suit;
        if (Number.isFinite(m.bots)) G.bots = clamp(Math.round(m.bots), 0, 23);
        if ((m.mode === 'br' || m.mode === 'exp') && m.mode !== G.mode && G.phase === 'lobby') { G.mode = m.mode; G.world = new World(G.seed, G.mode); }
        if (G.phase === 'lobby') broadcast(lobbyMsg());
        else if (G.phase === 'play' && G.mode === 'exp' && !G.players.has(c.id)) {
          expJoin(c); broadcast(metaMsg()); send(ws, startMsg(c));
          ev('msg', `${c.name} taucht mit!`);
        }
        break;
      case 'start': if (G.phase === 'lobby') { if (G.mode === 'exp') startExp(); else startMatch(); } break;
      case 'buy': if (p && G.mode === 'exp') expBuy(p, m); break;
      case 'quit': if (G.phase === 'play' && G.mode === 'exp') quitExp(); break;
      case 'm':
        if (p && p.alive && [m.x, m.y, m.z, m.yaw, m.pitch].every(Number.isFinite)) {
          p.x = clamp(m.x, -300, 300); p.y = clamp(m.y, -260, SURFACE); p.z = clamp(m.z, -300, 300);
          // activity check for the aquarium: really moved or looked around (just bobbing in the water does not count)
          if (!p.act || dist(p, p.act) > 1.5 || Math.abs(m.yaw - p.act.yaw) > 0.15 || Math.abs(m.pitch - p.act.pitch) > 0.15) { p.act = { x: p.x, y: p.y, z: p.z, yaw: m.yaw, pitch: m.pitch }; p.actT = G.time; }
          p.yaw = m.yaw; p.pitch = clamp(m.pitch, -1.6, 1.6); p.boost = !!m.b;
        }
        break;
      case 'f': if (p) { p.actT = G.time; fire(p, m.d); } break;
      case 'r': if (p && p.alive) startReload(p); break;
      case 'slot': if (p && p.alive && [0, 1, 2].includes(m.i) && p.weapons[m.i]) { p.slot = m.i; p.reload = 0; } break;
      case 'e': if (p) interact(p); break;
      case 'x': if (p && p.alive) struggle(p); break;
    }
  });
  ws.on('close', () => {
    clients.delete(ws);
    const p = G.players.get(c.id);
    if (G.phase === 'play' && p && G.mode === 'exp') { storeProgress(p); G.players.delete(c.id); ev('msg', `${p.name} ist aufgetaucht und weg.`); }
    else if (G.phase === 'play' && p && p.alive) kill(p, null, 'left');
    if (G.phase === 'lobby') broadcast(lobbyMsg());
  });
  ws.on('error', () => {});
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('\n  UNDERNITE server is running\n');
  console.log(`  This PC:        ${url}`);
  for (const u of lanUrls()) console.log(`  Home network:   ${u}`);
  console.log('\n  Keep this window open while playing. Close it to stop the server.\n');
  if (process.platform === 'win32' && !process.env.UN_NO_OPEN) exec(`start "" "${url}"`);
});
