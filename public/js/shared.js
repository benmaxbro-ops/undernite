// Undernite - shared definitions and deterministic world generation.
// Imported by both the Node server and the browser client, so everything
// in here must be pure JS without DOM or Node APIs.

export const SURFACE = 130;      // y of the water surface
export const SIZE = 640;         // world edge length in metres
export const HALF = SIZE / 2;
export const PLAY = 288;         // playable half extent (inside the rim)
export const GRID_N = 256;       // height grid cells per edge
export const CELL = SIZE / GRID_N;
export const TICK_HZ = 20;

export const SUIT_ORDER = ['manta', 'triton', 'bulwark', 'goliath'];
export const SUITS = {
  manta:   { name: 'Manta',    hp: 70,  speed: 13.5, boost: 1.7,  r: 0.7, scale: 0.85, cam: 4.2, dmg: 1.0,
             desc: 'Schlank, klein, extrem wendig. Schwer zu treffen, hält wenig aus.' },
  triton:  { name: 'Triton',   hp: 100, speed: 11.0, boost: 1.6,  r: 0.9, scale: 1.0,  cam: 4.8, dmg: 1.0,
             desc: 'Der Allrounder. Ausgewogen in Tempo und Panzerung.' },
  bulwark: { name: 'Bollwerk', hp: 150, speed: 8.6,  boost: 1.5,  r: 1.2, scale: 1.3,  cam: 5.8, dmg: 1.0,
             desc: 'Schwerer Panzeranzug. Langsam, aber zäh.' },
  goliath: { name: 'Goliath',  hp: 240, speed: 6.3,  boost: 1.45, r: 1.9, scale: 1.0,  cam: 8.5, dmg: 1.12, mech: true,
             desc: 'Tiefsee-Mech. Riesig, träge, schlägt härter zu. Passt in kein Fahrzeug, kein Oktopus hält ihn.' },
};

export const WEAPON_IDS = ['pistol', 'needler', 'scatter', 'harpoon', 'torpedo', 'subtorp'];
// range = how far (metres) a shot flies before it is gone. The starter pistol has the shortest.
export const WEAPONS = {
  pistol:  { name: 'Bolzenpistole',  dmg: 14, rate: 3.5, speed: 95,  mag: 12, reload: 1.3, spread: 0.008, range: 22, pellets: 1, splash: 0 },
  needler: { name: 'Nadler',         dmg: 10, rate: 9,   speed: 115, mag: 30, reload: 1.8, spread: 0.022, range: 38, pellets: 1, splash: 0 },
  scatter: { name: 'Splitterwerfer', dmg: 9,  rate: 1.3, speed: 85,  mag: 5,  reload: 2.0, spread: 0.085, range: 26, pellets: 7, splash: 0 },
  harpoon: { name: 'Harpune',        dmg: 68, rate: 0.9, speed: 150, mag: 3,  reload: 2.2, spread: 0.002, range: 65, pellets: 1, splash: 0 },
  torpedo: { name: 'Torpedowerfer',  dmg: 80, rate: 0.7, speed: 44,  mag: 2,  reload: 2.8, spread: 0.004, range: 80, pellets: 1, splash: 9 },
  subtorp: { name: 'Bordtorpedo',    dmg: 60, rate: 1.1, speed: 58,  mag: 99, reload: 0,   spread: 0.004, range: 90, pellets: 1, splash: 8 },
};
for (const w of Object.values(WEAPONS)) w.life = w.range / w.speed;   // flight time in seconds

export const RARITY = [
  { name: 'Gewöhnlich', color: '#9fb2bd', mul: 1.0 },
  { name: 'Selten',     color: '#3fa9f5', mul: 1.15 },
  { name: 'Episch',     color: '#b970ff', mul: 1.3 },
  { name: 'Legendär',   color: '#ffb52e', mul: 1.45 },
];

export const VEHICLE_IDS = ['scooter', 'sub'];
export const VEHICLES = {
  scooter: { name: 'U-Scooter',   hp: 0,   speed: 24, accel: 3.0, r: 1.1, cam: 6.5 },
  sub:     { name: 'Mini-U-Boot', hp: 450, speed: 17, accel: 1.6, r: 3.0, cam: 16 },
};

export const CREATURE_IDS = ['shark', 'octo', 'jelly', 'fish', 'boss'];
export const CREATURES = {
  shark: { name: 'Hai',     r: 1.5, hp: 90 },
  octo:  { name: 'Oktopus', r: 1.3, hp: 80 },
  jelly: { name: 'Qualle',  r: 0.9, hp: 18 },
  fish:  { name: 'Fisch',   r: 0.6, hp: 10 },   // real values per species in FISH
  boss:  { name: 'Boss',    r: 3.0, hp: 500 },  // real values per floor in BOSSES
};
// hit radius of a creature (fish and bosses carry their own)
export const creatureR = (type, sub) => type === 'fish' ? Math.max(0.5, FISH[sub].size * 0.9) : type === 'boss' ? BOSSES[sub].r : CREATURES[type].r;

// ======================================================================
// Tiefsee-Expedition (mode 'exp'): dive deeper, hunt fish, sell them at
// the boat, buy better gear. All balance values for the mode live here.
// ======================================================================
export const EXP_HP = 100;
export const EXP_BOAT = { x: 0, z: 0 };           // shop boat floats at the surface here
export const EXP_RESPAWN = 5;                     // seconds until you wake up at the boat
export const EXP_START_MONEY = 100;               // new divers start with this much money
// Health regeneration: starts after REGEN_DELAY seconds without damage.
export const REGEN_DELAY = 5, REGEN_RATE = 4, REGEN_RATE_SURFACE = 15;
// Floors ("Etagen") by depth in metres below the surface.
export const FLOORS = [
  { name: 'Sonnenriff',   top: 0,   bot: 60,  fish: 16 },
  { name: 'Zwielicht',    top: 60,  bot: 130, fish: 14 },
  { name: 'Mitternacht',  top: 130, bot: 210, fish: 13 },
  { name: 'Abgrund',      top: 210, bot: 290, fish: 11 },
  { name: 'Tiefseegraben', top: 290, bot: 370, fish: 10 },
];
export const floorAt = (depth) => { for (let i = FLOORS.length - 1; i >= 0; i--) if (depth >= FLOORS[i].top) return i; return 0; };
// Fish species. value = money when sold, dmg > 0 means it bites back.
// shape: 0 normal, 1 tall/flat, 2 long (eel), 3 angler (lure light)
export const FISH = [
  { name: 'Sardine',        floor: 0, value: 4,    hp: 6,   size: 0.35, speed: 7,  col: 0xc9d6e0, glow: 0, shape: 0, w: 55 },
  { name: 'Clownfisch',     floor: 0, value: 8,    hp: 10,  size: 0.4,  speed: 6,  col: 0xff7b1c, glow: 0, shape: 1, w: 30 },
  { name: 'Doktorfisch',    floor: 0, value: 15,   hp: 16,  size: 0.55, speed: 7,  col: 0x2f6bff, glow: 0, shape: 1, w: 15 },
  { name: 'Makrele',        floor: 1, value: 25,   hp: 22,  size: 0.7,  speed: 10, col: 0x5d8fa8, glow: 0, shape: 0, w: 55 },
  { name: 'Thunfisch',      floor: 1, value: 45,   hp: 45,  size: 1.2,  speed: 11, col: 0x34506e, glow: 0, shape: 0, w: 30 },
  { name: 'Barrakuda',      floor: 1, value: 65,   hp: 40,  size: 1.1,  speed: 12, col: 0x8fa3ad, glow: 0, shape: 2, w: 15, dmg: 6 },
  { name: 'Laternenfisch',  floor: 2, value: 90,   hp: 30,  size: 0.5,  speed: 8,  col: 0x1b2a3a, glow: 0x4dfff0, shape: 0, w: 55 },
  { name: 'Beilfisch',      floor: 2, value: 125,  hp: 50,  size: 0.6,  speed: 8,  col: 0xb8c8d8, glow: 0x9fd8ff, shape: 1, w: 30 },
  { name: 'Viperfisch',     floor: 2, value: 170,  hp: 65,  size: 0.95, speed: 11, col: 0x23182e, glow: 0xff4df0, shape: 2, w: 15, dmg: 9 },
  { name: 'Geisterfisch',   floor: 3, value: 250,  hp: 80,  size: 0.8,  speed: 9,  col: 0xdfe8ff, glow: 0xbfd0ff, shape: 1, w: 55 },
  { name: 'Tiefsee-Aal',    floor: 3, value: 330,  hp: 105, size: 1.6,  speed: 9,  col: 0x2e2a22, glow: 0xffb03a, shape: 2, w: 30 },
  { name: 'Anglerfisch',    floor: 3, value: 430,  hp: 125, size: 1.0,  speed: 8,  col: 0x2a1d1a, glow: 0xfff07a, shape: 3, w: 15, dmg: 12 },
  { name: 'Kristallfisch',  floor: 4, value: 650,  hp: 140, size: 0.9,  speed: 9,  col: 0x9ff7ff, glow: 0x6ff0ff, shape: 1, w: 55 },
  { name: 'Drachenfisch',   floor: 4, value: 850,  hp: 170, size: 1.4,  speed: 12, col: 0x1a0d14, glow: 0xff3355, shape: 2, w: 30, dmg: 15 },
  { name: 'Leuchtrochen',   floor: 4, value: 1100, hp: 220, size: 1.8,  speed: 8,  col: 0x251a40, glow: 0xb06bff, shape: 1, w: 15 },
];
export const GOLD_CHANCE = 0.04, GOLD_MUL = 5;
// Money a caught fish is worth. Bag/aquarium entries are { s: species index, g: 1 if golden }.
// (Very old saves only kept the value: { v: euros }.)
// Caught things ("Fang"): a fish { s: species, g: golden } or a boss { b: boss index }.
export const fishValue = (e) => e.v ?? (e.b != null ? BOSSES[e.b].reward : FISH[e.s].value * (e.g ? GOLD_MUL : 1));
// Aquarium: everything living there earns money every second.
export const AQUARIUM = {
  rate: 0.08 / 60,                              // a fish earns 8 % of its value per minute
  sizes: [3, 6, 10, 15, 20],                    // places per upgrade level
  prices: [0, 500, 2000, 6000, 15000],          // price of each upgrade level
  afkTime: 60,                                  // no money after 60 s without moving/looking around (and none while offline)
};
// € per second of one caught thing in the aquarium (bosses have their own, much higher number)
export const catchRate = (e) => e.v != null ? 0 : e.b != null ? BOSSES[e.b].aq : fishValue(e) * AQUARIUM.rate;
export const aqIncome = (aq) => aq.reduce((a, e) => a + catchRate(e), 0);   // € per second
export const catchName = (e) => e.v != null ? 'Alter Fang' : e.b != null ? '☠ ' + BOSSES[e.b].name : (e.g ? '⭐ Goldener ' : '') + FISH[e.s].name;
// network form: fish [s, g], boss [-2, b], very old catch [-1, euros]
export const catchToNet = (e) => e.v != null ? [-1, e.v] : e.b != null ? [-2, e.b] : [e.s, e.g ? 1 : 0];
export const catchFromNet = (a) => a[0] === -1 ? { v: a[1] } : a[0] === -2 ? { b: a[1] } : { s: a[0], g: a[1] };
// One boss per floor. dmg is per bite. aq = € per second in the aquarium (harder boss = more money).
export const BOSSES = [
  { name: 'Riffkönig',      hp: 450,  dmg: 20, reward: 300,   aq: 5,   model: 'shark', scale: 2.2, col: 0xffc94d, r: 3.0, speed: 10 },
  { name: 'Krakenmutter',   hp: 950,  dmg: 20, reward: 800,   aq: 12,  model: 'octo',  scale: 3.2, col: 0x9a2fd6, r: 3.6, speed: 9 },
  { name: 'Laternenschlund', hp: 1700, dmg: 20, reward: 2000, aq: 30,  model: 'fish',  scale: 6,   col: 0x2a1d1a, glow: 0xfff07a, shape: 3, r: 4.0, speed: 9 },
  { name: 'Knochenhai',     hp: 2700, dmg: 20, reward: 5000,  aq: 70,  model: 'shark', scale: 3.2, col: 0x3b4450, r: 4.2, speed: 12 },
  { name: 'Leviathan',      hp: 4200, dmg: 20, reward: 12000, aq: 150, model: 'fish',  scale: 7,   col: 0x10202a, glow: 0x5ef2e0, shape: 2, r: 4.5, speed: 11 },
];
export const BOSS_RESPAWN = 120;
// Air tanks: cap = air units, maxDepth = safe depth (below it the pressure hurts).
export const TANKS = [
  { name: 'Mini-Flasche',        cap: 90,  maxDepth: 70,  price: 0 },
  { name: 'Stahlflasche',        cap: 160, maxDepth: 140, price: 400 },
  { name: 'Doppelflasche',       cap: 260, maxDepth: 220, price: 1500 },
  { name: 'Tiefsee-Rebreather',  cap: 400, maxDepth: 300, price: 4500 },
  { name: 'Abyss-Kreislaufgerät', cap: 600, maxDepth: 400, price: 11000 },
];
// Breathing training: multiplies air use.
export const LUNGS = [
  { name: 'Untrainiert',     mul: 1.0,  price: 0 },
  { name: 'Atemtraining I',  mul: 0.85, price: 250 },
  { name: 'Atemtraining II', mul: 0.72, price: 1000 },
  { name: 'Atemtraining III', mul: 0.6, price: 3000 },
  { name: 'Freitaucher-Profi', mul: 0.5, price: 8000 },
];
// Flashlights: toggle with L, battery (seconds) recharges at the surface.
export const LAMPS = [
  { name: 'Taschenlampe',      range: 40,  power: 120, angle: 0.38, battery: 60,  price: 0 },
  { name: 'Tauchlampe',        range: 60,  power: 200, angle: 0.42, battery: 120, price: 300 },
  { name: 'Halogen-Strahler',  range: 85,  power: 300, angle: 0.47, battery: 200, price: 1200 },
  { name: 'Tiefsee-Flutlicht', range: 120, power: 450, angle: 0.55, battery: 320, price: 4000 },
];
// Air used per second at a given depth (before training).
export const airUse = (depth) => 1 + Math.max(0, depth) / 60;
export const SHOP_WEAPONS = [
  { wid: 'needler', rar: 0, price: 150 },
  { wid: 'scatter', rar: 0, price: 300 },
  { wid: 'harpoon', rar: 1, price: 700 },
  { wid: 'needler', rar: 2, price: 1200 },
  { wid: 'torpedo', rar: 1, price: 2000 },
  { wid: 'harpoon', rar: 2, price: 3200 },
  { wid: 'needler', rar: 3, price: 5000 },
  { wid: 'torpedo', rar: 3, price: 8500 },
];
// Terrace profile of the expedition funnel: [inner radius, height step]
const EXP_STEPS = [[45, 100], [100, 85], [160, 80], [220, 55]];
const EXP_BOTTOM = -225;
// Ledge of each floor: radius range where its boss lives.
export const EXP_LEDGES = [[240, 275], [180, 210], [120, 150], [62, 92], [0, 30]];

// ---------- math helpers ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z, seed, oct) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f, seed + i * 17) * a; n += a; a *= 0.5; f *= 2; }
  return s / n;
}
export function sstep(e0, e1, x) {
  let t = (x - e0) / (e1 - e0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}
// Forward vector for yaw/pitch. yaw 0 looks down -z, positive pitch looks up.
export function dirFrom(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}
// Segment (a, a+d) against sphere. Returns t in [0,1] or -1.
export function segSphere(ax, ay, az, dx, dy, dz, cx, cy, cz, r) {
  const fx = ax - cx, fy = ay - cy, fz = az - cz;
  const c = fx * fx + fy * fy + fz * fz - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz;
  if (a === 0) return -1;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  let disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  disc = Math.sqrt(disc);
  const t = (-b - disc) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

const HC = 16; // collider hash cell size
const hkey = (cx, cz) => (cx + 64) * 256 + (cz + 64);

// ---------- world ----------
export class World {
  constructor(seed, mode = 'br') {
    this.seed = seed | 0;
    this.mode = mode;
    const exp = mode === 'exp';
    const R = rng(this.seed ^ 0x9e3779b9);
    const TAU = Math.PI * 2;

    // seamount position feeds into the height field
    const sa = R() * TAU;
    this.smx = Math.cos(sa) * 150; this.smz = Math.sin(sa) * 150;

    const n1 = GRID_N + 1;
    this.grid = new Float32Array(n1 * n1);
    for (let iz = 0; iz < n1; iz++) for (let ix = 0; ix < n1; ix++) {
      this.grid[iz * n1 + ix] = this._raw(ix * CELL - HALF, iz * CELL - HALF);
    }

    this.cols = [];      // sphere colliders
    this.rocks = []; this.kelp = []; this.coral = []; this.columns = []; this.lintels = [];
    this.crates = []; this.vehSpawns = []; this.lairs = []; this.swarms = []; this.pois = [];

    const farFrom = (x, z, list, d) => list.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > d * d);
    const pickSite = (maxR, others, d) => {
      for (let i = 0; i < 60; i++) {
        const x = (R() * 2 - 1) * maxR, z = (R() * 2 - 1) * maxR;
        if (farFrom(x, z, others, d)) return { x, z };
      }
      return { x: (R() * 2 - 1) * maxR, z: (R() * 2 - 1) * maxR };
    };
    const sites = [{ x: this.smx, z: this.smz }];
    // expedition: decorations sit on the ledges of the funnel
    const ringSite = (r0, r1) => { const a = R() * TAU, d = r0 + R() * (r1 - r0); return { x: Math.cos(a) * d, z: Math.sin(a) * d }; };

    // wreck
    const ws = exp ? ringSite(186, 204) : pickSite(190, sites, 130); sites.push(ws);
    this.wreck = { x: ws.x, z: ws.z, y: this.heightAt(ws.x, ws.z), yaw: R() * TAU };
    for (const k of [-12, -6, 0, 6, 12]) {
      const x = ws.x + Math.cos(this.wreck.yaw) * k, z = ws.z - Math.sin(this.wreck.yaw) * k;
      this.cols.push({ x, y: this.heightAt(x, z) + 2, z, r: 5 });
    }
    // ruins
    const rs = exp ? ringSite(126, 144) : pickSite(190, sites, 130); sites.push(rs);
    this.ruins = { x: rs.x, z: rs.z, y: this.heightAt(rs.x, rs.z) };
    const ring = (count, rad, miss) => {
      const out = [];
      for (let i = 0; i < count; i++) {
        if (R() < miss) { out.push(null); continue; }
        const a = i / count * TAU;
        const x = rs.x + Math.cos(a) * rad, z = rs.z + Math.sin(a) * rad;
        const c = { x, z, y: this.heightAt(x, z) - 0.5, h: 9 + R() * 6, r: 1.2 };
        this.columns.push(c); out.push(c);
        for (const f of [0.15, 0.5, 0.85]) this.cols.push({ x, y: c.y + c.h * f, z, r: c.r + 0.4 });
      }
      return out;
    };
    const outer = ring(10, 15, 0.2); ring(5, 7, 0.3);
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i], b = outer[(i + 1) % outer.length];
      if (a && b && R() < 0.65) {
        const top = Math.min(a.y + a.h, b.y + b.h);
        this.lintels.push({ x: (a.x + b.x) / 2, y: top + 0.5, z: (a.z + b.z) / 2,
          len: Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2) + 2, yaw: Math.atan2(-(b.z - a.z), b.x - a.x) });
      }
    }

    // rocks
    for (let i = 0; i < 95; i++) {
      const x = (R() * 2 - 1) * 275, z = (R() * 2 - 1) * 275;
      if (!farFrom(x, z, [ws, rs], 26)) continue;
      const r = R() < 0.12 ? 8 + R() * 5 : 2 + R() * 4.5;
      const y = this.heightAt(x, z) + r * 0.25;
      this.rocks.push({ x, y, z, r, sx: 0.8 + R() * 0.5, sy: 0.7 + R() * 0.6, sz: 0.8 + R() * 0.5, rot: R() * TAU });
      this.cols.push({ x, y, z, r: r * 0.92 });
    }

    // expedition: underwater base on the left (west) edge of the first floor, platform at 50 m depth
    this.base = null;
    if (exp) {
      let br = 240;
      for (let r = 196; r <= 286; r += 0.5) if (SURFACE - this.heightAt(-r, 0) <= 53) { br = r; break; }
      // 16 m out from the cliff edge, over the abyss on stilts (closer it would stick in the rock wall)
      const c = { x: -br + 16, y: SURFACE - 50, z: 0 };
      this.base = { c, dome: { x: c.x, y: c.y, z: c.z - 3.5 }, tank: { x: c.x, y: c.y, z: c.z + 5 } };
      const near = (o) => (o.x - c.x) ** 2 + (o.z - c.z) ** 2 < 16 * 16 && Math.abs(o.y - c.y) < 16;
      this.rocks = this.rocks.filter(o => !near(o)); this.cols = this.cols.filter(o => !near(o));   // clear the building site
      this.cols.push({ x: c.x, y: c.y + 1.2, z: c.z - 3.5, r: 4.6 }, { x: c.x, y: c.y + 1.6, z: c.z + 5, r: 3.7 }, { x: c.x, y: c.y + 3.6, z: c.z + 5, r: 3.7 });
    }

    // collider hash
    this.hash = new Map();
    for (const c of this.cols) {
      const pad = c.r + 4;
      for (let cx = Math.floor((c.x - pad) / HC); cx <= Math.floor((c.x + pad) / HC); cx++)
        for (let cz = Math.floor((c.z - pad) / HC); cz <= Math.floor((c.z + pad) / HC); cz++) {
          const k = hkey(cx, cz); let l = this.hash.get(k);
          if (!l) this.hash.set(k, l = []);
          l.push(c);
        }
    }

    const free = (x, y, z, pad) => !this.cols.some(c => (c.x - x) ** 2 + (c.y - y) ** 2 + (c.z - z) ** 2 < (c.r + pad) ** 2);
    const spot = (cx, cz, rad, lift, pad = 2) => {
      let p;
      for (let i = 0; i < 40; i++) {
        const a = R() * TAU, d = rad * Math.sqrt(R());
        let x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        x = Math.max(-270, Math.min(270, x)); z = Math.max(-270, Math.min(270, z));
        p = { x, y: this.heightAt(x, z) + lift, z, yaw: R() * TAU };
        if (free(p.x, p.y, p.z, pad)) return p;
      }
      return p;
    };
    this.spot = spot;

    // kelp forests
    const kelpSites = [];
    for (let i = 0; i < 4; i++) { const s = exp ? ringSite(245, 268) : pickSite(220, sites.concat(kelpSites), 70); kelpSites.push(s); }
    for (const s of kelpSites) for (let i = 0; i < 170; i++) {
      const p = spot(s.x, s.z, 38, 0, 0.5);
      this.kelp.push({ x: p.x, y: p.y - 0.3, z: p.z, h: 7 + R() * 12, rot: R() * Math.PI });
    }
    this.kelpSites = kelpSites;
    // coral reefs + scattered coral
    const reefs = [];
    for (let i = 0; i < 4; i++) reefs.push(exp ? ringSite(i < 3 ? 245 : 185, i < 3 ? 268 : 205) : pickSite(230, reefs, 80));
    const pal = [0xff5d8f, 0xff9a3c, 0xc86bff, 0xffd84d, 0x35e0c8, 0xff6b5e];
    for (let i = 0; i < 620; i++) {
      const s = i < 480 ? reefs[i % reefs.length] : { x: 0, z: 0 };
      const p = spot(s.x, s.z, i < 480 ? 34 : 270, 0, 0.3);
      if (exp && i >= 480 && p.y < 20) continue;     // no stray coral in the dark deep
      this.coral.push({ x: p.x, y: p.y, z: p.z, s: 0.5 + R() * 1.6, type: (R() * 3) | 0, col: pal[(R() * pal.length) | 0], rot: R() * TAU });
    }

    // loot crates
    const addCrates = (cx, cz, rad, n) => { for (let i = 0; i < n; i++) this.crates.push(spot(cx, cz, rad, 0.05, 2.2)); };
    addCrates(ws.x, ws.z, 22, 5);
    addCrates(rs.x, rs.z, 16, 5);
    addCrates(this.smx, this.smz, 30, 4);
    for (const s of kelpSites) addCrates(s.x, s.z, 30, 3);
    for (const s of reefs) addCrates(s.x, s.z, 28, 2);
    addCrates(0, 0, 265, 16);

    // vehicles
    this.vehSpawns.push({ type: 'sub', ...spot(ws.x, ws.z, 30, 3.5, 4) });
    this.vehSpawns.push({ type: 'sub', ...spot(rs.x, rs.z, 28, 3.5, 4) });
    for (let i = 0; i < 2; i++) this.vehSpawns.push({ type: 'sub', ...spot(0, 0, 240, 3.5, 4) });
    for (let i = 0; i < 9; i++) this.vehSpawns.push({ type: 'scooter', ...spot(0, 0, 250, 1.4, 2) });

    // creature sites
    this.lairs.push(spot(ws.x, ws.z, 14, 1.3, 1.5), spot(rs.x, rs.z, 10, 1.3, 1.5));
    for (const s of reefs.slice(0, 2)) this.lairs.push(spot(s.x, s.z, 18, 1.3, 1.5));
    this.lairs.push(spot(kelpSites[0].x, kelpSites[0].z, 15, 1.3, 1.5));
    for (let i = 0; i < 5; i++) { const p = spot(0, 0, 220, 0, 3); p.y += 12 + R() * 22; this.swarms.push(p); }

    // glowing crystals on the deep floors (expedition only, decoration)
    this.crystals = [];
    if (exp) for (let i = 0; i < 260; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * 215, x = Math.cos(a) * d, z = Math.sin(a) * d, y = this.heightAt(x, z);
      if (y > -30) continue;
      this.crystals.push({ x, y: y - 0.3, z, s: 0.6 + R() * 1.8, rot: R() * TAU, tilt: (R() - 0.5) * 0.6, col: [0x5ef2e0, 0xb06bff, 0x4db8ff, 0xff4df0][(R() * 4) | 0] });
    }
    // boss lairs: one on each floor's ledge, hovering a bit above the ground
    this.bossLairs = EXP_LEDGES.map(([r0, r1], i) => {
      let best = null;
      for (let k = 0; k < 40; k++) {
        const p = ringSite(r0, r1), y = this.heightAt(p.x, p.z), depth = SURFACE - y;
        const lair = { x: p.x, z: p.z, y: Math.min(SURFACE - FLOORS[i].top - 6, y + 7) };
        if (!best) best = lair;
        if (depth > FLOORS[i].top + 5 && depth < FLOORS[i].bot + 10) { best = lair; break; }
      }
      return best;
    });
    this.pois = exp ? [{ n: 'Boot', x: EXP_BOAT.x, z: EXP_BOAT.z }, { n: 'Basis', x: this.base.c.x, z: this.base.c.z }] : [
      { n: 'Wrack', x: ws.x, z: ws.z }, { n: 'Ruinen', x: rs.x, z: rs.z },
      { n: 'Seeberg', x: this.smx, z: this.smz }, { n: 'Kelpwald', x: kelpSites[0].x, z: kelpSites[0].z },
    ];
  }

  _raw(x, z) {
    const s = this.seed;
    if (this.mode === 'exp') {
      // a terraced funnel: every step down is a new floor ("Etage")
      const r = Math.sqrt(x * x + z * z) + (fbm(x * 0.008, z * 0.008, s + 7, 3) - 0.5) * 36;
      let h = EXP_BOTTOM;
      for (const [r0, step] of EXP_STEPS) h += step * sstep(r0, r0 + 12, r);
      h += (fbm(x * 0.03, z * 0.03, s + 50, 2) - 0.5) * 5;
      h += 30 * sstep(HALF - 70, HALF, Math.max(Math.abs(x), Math.abs(z)));
      return h;
    }
    let h = fbm(x * 0.0055, z * 0.0055, s, 4) * 52;
    h += (fbm(x * 0.035, z * 0.035, s + 50, 2) - 0.5) * 5;
    const tz = (fbm(x * 0.004, 3.7, s + 99, 2) - 0.5) * 300;      // winding trench
    h -= 34 * (1 - sstep(10, 46, Math.abs(z - tz)));
    const mx = x - this.smx, mz = z - this.smz;
    h += 55 * (1 - sstep(15, 95, Math.sqrt(mx * mx + mz * mz)));   // seamount
    h += 80 * sstep(HALF - 70, HALF, Math.max(Math.abs(x), Math.abs(z))); // rim
    return h;
  }

  heightAt(x, z) {
    let gx = (x + HALF) / CELL, gz = (z + HALF) / CELL;
    const m = GRID_N - 0.001;
    gx = gx < 0 ? 0 : gx > m ? m : gx; gz = gz < 0 ? 0 : gz > m ? m : gz;
    const ix = gx | 0, iz = gz | 0, fx = gx - ix, fz = gz - iz;
    const g = this.grid, i = iz * (GRID_N + 1) + ix;
    const a = g[i], b = g[i + 1], c = g[i + GRID_N + 1], d = g[i + GRID_N + 2];
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }

  // Push a sphere {x,y,z,vx,vy,vz} out of terrain, colliders and world bounds.
  // top: highest allowed y (default keeps the sphere just under the water surface)
  collide(p, r, top = SURFACE - r - 0.4) {
    if (p.x < -PLAY) { p.x = -PLAY; if (p.vx < 0) p.vx = 0; } else if (p.x > PLAY) { p.x = PLAY; if (p.vx > 0) p.vx = 0; }
    if (p.z < -PLAY) { p.z = -PLAY; if (p.vz < 0) p.vz = 0; } else if (p.z > PLAY) { p.z = PLAY; if (p.vz > 0) p.vz = 0; }
    const list = this.hash.get(hkey(Math.floor(p.x / HC), Math.floor(p.z / HC)));
    if (list) for (const c of list) {
      const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z, rr = c.r + r;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2), k = (rr - d) / d;
        p.x += dx * k; p.y += dy * k; p.z += dz * k;
      }
    }
    const g = this.heightAt(p.x, p.z) + r;
    if (p.y < g) { p.y = g; if (p.vy < 0) p.vy = 0; }
    if (p.y > top) { p.y = top; if (p.vy > 0) p.vy = 0; }
  }

  // First hit of a segment against terrain/colliders. Returns t in (0,1] or -1.
  segmentHit(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const n = Math.max(1, Math.ceil(len / 1.5));
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
      if (y < this.heightAt(x, z) || y > SURFACE) return t;
      const list = this.hash.get(hkey(Math.floor(x / HC), Math.floor(z / HC)));
      if (list) for (const c of list) {
        const ex = x - c.x, ey = y - c.y, ez = z - c.z;
        if (ex * ex + ey * ey + ez * ez < c.r * c.r) return t;
      }
    }
    return -1;
  }
}
