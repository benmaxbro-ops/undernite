// Undernite - the trader's pirate ship at the surface (own design: "Seeschwalbe").
// Wooden hull lofted from cross-sections, two masts with square sails, crow's nest,
// bowsprit with a swordfish figurehead, captain's cabin, cannons, lanterns, rigging.
// y = 0 is the waterline, the bow points to -z.
import * as THREE from 'three';
import { makeTag } from './models.js';

const TAU = Math.PI * 2;
function spline(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0; while (t > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)][1], p1 = keys[i][1], p2 = keys[i + 1][1], p3 = keys[Math.min(n - 1, i + 2)][1];
  const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...o });
const glow = (color, i = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.4 });
const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 12), SPH = new THREE.SphereGeometry(1, 14, 10);
function put(p, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); p.add(m); return m; }
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// hull shape along t (0 = bow, 1 = stern)
const LEN = 24, Z0 = -12;
const HB = [[0, 0.1], [0.08, 1.5], [0.22, 3.0], [0.5, 3.6], [0.8, 3.4], [1, 2.9]];      // half beam
const DEP = [[0, 1.4], [0.1, 3.6], [0.5, 4.6], [0.9, 4.2], [1, 3.4]];                   // keel depth below the deck edge
const SHEER = [[0, 3.6], [0.15, 2.6], [0.5, 2.1], [0.78, 2.7], [1, 3.8]];               // height of the deck edge
const zAt = (t) => Z0 + LEN * t;
const DECK_Y = 1.75;

function hullGeometry() {
  const rings = 48, seg = 64, pos = [], col = [], idx = [];
  const C = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, hb = spline(HB, t), dep = spline(DEP, t), sh = spline(SHEER, t), z = zAt(t);
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * Math.PI, c = Math.cos(a), s = Math.sin(a);
      const x = hb * Math.sign(c) * Math.abs(c) ** 0.55, y = sh - dep * s ** 1.5;
      pos.push(x, y, z);
      // below the waterline: dark red antifouling, white waterline stripe, wooden planks above
      if (y < -0.35) C.setHex(0x8a3a2c);
      else if (y < 0.05) C.setHex(0xe8e2d4);
      else {
        const plank = Math.floor((y + 0.05) / 0.42);
        C.setHex(plank % 2 ? 0x8a5a34 : 0x9c6a40);
        if (sh - y < 0.35) C.setHex(0x3e2616);                               // dark wale at the top
        if (((y + 0.05) % 0.42) < 0.035) C.multiplyScalar(0.6);             // plank seams
        C.multiplyScalar(0.92 + 0.08 * Math.sin(z * 3.1 + plank * 1.7));
      }
      col.push(C.r, C.g, C.b);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);   // outward facing
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// flat polygon (closed outline in the xy plane) -> mesh
function shapeMesh(pts, mat) { const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))); return new THREE.Mesh(new THREE.ShapeGeometry(s), mat); }
// billowing square sail
function sail(w, h, tex, bulge = 0.9) {
  const g = new THREE.PlaneGeometry(w, h, 10, 8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2); p.setZ(i, -bulge * (1 - x * x * 0.8) * (1 - (y * 0.85) ** 2)); }
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.95 }));
}

export function makeShip() {
  const ship = new THREE.Group();
  const wood = std(0x6e4a2c), darkWood = std(0x3e2616), gold = std(0xc9a24a, { metalness: 0.6, roughness: 0.35 }), iron = std(0x23262a, { metalness: 0.7, roughness: 0.4 }), rope = new THREE.LineBasicMaterial({ color: 0x2a2018 });

  // ----- hull + deck + stern -----
  // a little self-light so the hull does not turn into a black blob when seen from below
  ship.add(new THREE.Mesh(hullGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, emissive: 0x3a2014, emissiveIntensity: 0.6 })));
  const deckTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#8a6440'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#7d5a38' : '#94704a'; c.fillRect(i * 16, 0, 15, h); c.fillStyle = '#4a3220'; c.fillRect(i * 16 + 15, 0, 1, h); }
    for (let i = 0; i < 40; i++) { c.fillStyle = '#3a2818'; c.fillRect(((Math.random() * 16) | 0) * 16 + 7, Math.random() * h, 2, 2); }
  });
  deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping; deckTex.repeat.set(0.35, 0.12);
  const deckPts = [];
  for (let i = 0; i <= 30; i++) { const t = 0.06 + 0.94 * i / 30; deckPts.push([spline(HB, t) * 0.96, zAt(t)]); }
  for (let i = 30; i >= 0; i--) { const t = 0.06 + 0.94 * i / 30; deckPts.push([-spline(HB, t) * 0.96, zAt(t)]); }
  const deck = shapeMesh(deckPts, std(0xffffff, { map: deckTex, side: THREE.DoubleSide }));
  deck.rotation.x = Math.PI / 2; deck.position.y = DECK_Y; ship.add(deck);
  // stern transom with glowing windows
  const sternPts = [];
  for (let j = 0; j <= 16; j++) { const a = j / 16 * Math.PI, c = Math.cos(a), s = Math.sin(a); sternPts.push([spline(HB, 1) * Math.sign(c) * Math.abs(c) ** 0.55, spline(SHEER, 1) - spline(DEP, 1) * s ** 1.5]); }
  const transom = shapeMesh(sternPts, std(0x5c3a22, { side: THREE.DoubleSide })); transom.position.z = zAt(1) - 0.01; ship.add(transom);
  for (let i = -1; i <= 1; i++) { put(ship, BOX, glow(0xffc870, 1.6), i * 1.2, 2.9, zAt(1) + 0.02, 0.7, 0.8, 0.05); put(ship, BOX, gold, i * 1.2, 2.9, zAt(1) + 0.03, 0.82, 0.08, 0.05); }
  put(ship, BOX, darkWood, 0, -1.2, zAt(1) + 0.3, 0.25, 3.2, 1.2);     // rudder

  // ----- railings -----
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = 0.04 + 0.96 * i / 24; pts.push(new THREE.Vector3(s * spline(HB, t) * 0.97, spline(SHEER, t) + 0.8, zAt(t))); }
    ship.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.07, 6), darkWood));
    for (let i = 0; i <= 24; i += 2) { const p = pts[i]; put(ship, CYL, darkWood, p.x, p.y - 0.42, p.z, 0.06, 0.85, 0.06); }
  }

  // ----- captain's cabin (stern) + forecastle -----
  put(ship, BOX, std(0x7a5232), 0, DECK_Y + 1.3, 8.6, 5.4, 2.6, 5.4);
  put(ship, BOX, darkWood, 0, DECK_Y + 2.7, 8.6, 6.0, 0.25, 6.0);
  for (const s of [-1, 1]) for (const z of [7.4, 9.8]) { put(ship, BOX, glow(0xffc870, 1.4), s * 2.71, DECK_Y + 1.5, z, 0.05, 0.75, 0.9); put(ship, BOX, gold, s * 2.73, DECK_Y + 1.5, z, 0.05, 0.85, 0.08); }
  put(ship, BOX, std(0x5a3a22), 0, DECK_Y + 1.05, 5.88, 1.1, 2.0, 0.08);   // cabin door
  put(ship, SPH, gold, 0.38, DECK_Y + 1.05, 5.82, 0.07);
  put(ship, BOX, std(0x7a5232), 0, DECK_Y + 0.6, -8.3, 3.2, 1.2, 3.2);     // forecastle
  // ship's wheel on the cabin roof
  const wheel = new THREE.Group(); wheel.position.set(0, DECK_Y + 3.6, 7.2); ship.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 20), darkWood));
  for (let i = 0; i < 8; i++) { const sp = put(wheel, CYL, darkWood, 0, 0, 0, 0.03, 1.4, 0.03); sp.rotation.z = i / 8 * Math.PI; }
  put(ship, CYL, darkWood, 0, DECK_Y + 3.2, 7.35, 0.1, 0.9, 0.1);

  // ----- masts, yards, sails, crow's nest -----
  const sailTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#ece2c6'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(120,100,70,.35)'; c.lineWidth = 2;
    for (let x = 32; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    c.fillStyle = 'rgba(200,180,140,.6)'; c.fillRect(170, 150, 40, 34); c.strokeRect(170, 150, 40, 34);   // a patch
    c.fillStyle = 'rgba(90,70,50,.18)'; for (let i = 0; i < 30; i++) c.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  });
  const emblemTex = canvasTex(256, 256, (c, w, h) => {
    c.drawImage(sailTex.image, 0, 0);
    drawEmblem(c, w / 2, h / 2 + 6, 0.9, '#7a1f1a');
  });
  const masts = [{ z: 0.5, h: 17, sails: [[8.2, 6.2, 6.6, emblemTex], [6.4, 4.2, 12.3, sailTex]] }, { z: -6.2, h: 14, sails: [[6.6, 5.2, 6.1, sailTex], [5.2, 3.6, 10.6, sailTex]] }];
  for (const M of masts) {
    put(ship, CYL, wood, 0, DECK_Y + M.h / 2, M.z, 0.24, M.h, 0.24);
    for (const [w, h, y, tex] of M.sails) {
      const yard = put(ship, CYL, darkWood, 0, DECK_Y + y + h / 2 + 0.15, M.z - 0.2, 0.12, w + 1.2, 0.12); yard.rotation.z = Math.PI / 2;
      const s = sail(w, h, tex); s.position.set(0, DECK_Y + y, M.z - 0.35); ship.add(s);
    }
  }
  // crow's nest on the main mast
  const nestY = DECK_Y + 14.6;
  put(ship, CYL, darkWood, 0, nestY, 0.5, 0.95, 0.12, 0.95);
  const nest = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.9, 1, 14, 1, true), std(0x6e4a2c, { side: THREE.DoubleSide })); nest.position.set(0, nestY + 0.5, 0.5); nest.scale.set(0.95, 0.9, 0.95); ship.add(nest);
  // pirate flag on top (own emblem: fish skeleton and harpoons)
  const flagTex = canvasTex(256, 160, (c, w, h) => { c.fillStyle = '#111316'; c.fillRect(0, 0, w, h); drawEmblem(c, w / 2, h / 2, 0.6, '#f2efe6'); });
  const flagG = new THREE.PlaneGeometry(2.6, 1.6, 10, 4).translate(1.3, 0, 0);
  const flag = new THREE.Mesh(flagG, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.9 }));
  flag.position.set(0, DECK_Y + 17.3, 0.5); flag.rotation.y = Math.PI / 2; ship.add(flag);
  const flagBase = flagG.attributes.position.array.slice();

  // ----- bowsprit, jib sail and swordfish figurehead -----
  const bowY = spline(SHEER, 0.04) + 0.2, bowZ = zAt(0.03);
  const sprit = put(ship, CYL, wood, 0, bowY + 1.1, bowZ - 3.2, 0.16, 7.5, 0.16); sprit.rotation.x = Math.PI / 2 - 0.3;
  const tipY = bowY + 2.2, tipZ = bowZ - 6.8;
  const jib = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, tipY, tipZ), new THREE.Vector3(0, DECK_Y + 13, -6.2), new THREE.Vector3(0, DECK_Y + 2.2, -9.8)]);
  jib.setIndex([0, 1, 2]); jib.computeVertexNormals();
  ship.add(new THREE.Mesh(jib, new THREE.MeshStandardMaterial({ map: sailTex, side: THREE.DoubleSide, roughness: 0.95 })));
  const fig = new THREE.Group(); fig.position.set(0, bowY - 0.6, bowZ - 0.9); fig.rotation.x = -0.35; ship.add(fig);
  put(fig, SPH, gold, 0, 0, 0, 0.45, 0.55, 1.3);                                          // body
  const sword = put(fig, new THREE.ConeGeometry(0.12, 2.4, 8), gold, 0, 0.05, -2.3); sword.rotation.x = -Math.PI / 2;   // sword
  const dors = put(fig, new THREE.ConeGeometry(0.5, 1.0, 3), gold, 0, 0.6, 0.1, 0.25, 1, 1);
  dors.rotation.x = 0.4;
  for (const s of [-1, 1]) put(fig, SPH, std(0x111111, { roughness: 0.1 }), s * 0.3, 0.12, -0.75, 0.09);

  // ----- cannons -----
  for (const s of [-1, 1]) for (const z of [-3.5, -0.5, 2.5]) {
    const t = (z - Z0) / LEN, x = spline(HB, t);
    put(ship, BOX, std(0x1a120c), s * (x + 0.02), 1.1, z, 0.06, 0.75, 0.85);
    const barrel = put(ship, CYL, iron, s * (x + 0.45), 1.1, z, 0.17, 1.1, 0.17); barrel.rotation.z = Math.PI / 2;
    put(ship, CYL, iron, s * (x + 0.98), 1.1, z, 0.21, 0.12, 0.21).rotation.z = Math.PI / 2;
  }

  // ----- lanterns -----
  const lanternM = glow(0xffc46a, 3);
  for (const [x, y, z] of [[2.6, DECK_Y + 3.5, 11.4], [-2.6, DECK_Y + 3.5, 11.4], [0, bowY + 1.2, bowZ + 0.4]]) {
    put(ship, BOX, iron, x, y + 0.4, z, 0.12, 0.6, 0.12);
    put(ship, SPH, lanternM, x, y, z, 0.22);
  }

  // ----- anchor hanging at the bow -----
  const anc = new THREE.Group(); anc.position.set(2.1, 0.4, -9); ship.add(anc);
  put(anc, CYL, iron, 0, 0, 0, 0.08, 1.6, 0.08);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 6, 12, Math.PI), iron); arc.rotation.z = Math.PI; arc.position.y = -0.65; anc.add(arc);
  put(anc, BOX, iron, 0, 0.75, 0, 0.8, 0.1, 0.1);

  // ----- rigging (ropes from the mast tops to the sides) -----
  const lines = [];
  for (const M of masts) {
    const top = new THREE.Vector3(0, DECK_Y + M.h - 0.5, M.z);
    for (const s of [-1, 1]) for (const dz of [-1.2, 0, 1.2]) {
      const t = (M.z + dz - Z0) / LEN;
      lines.push(top, new THREE.Vector3(s * spline(HB, t), spline(SHEER, t) + 0.8, M.z + dz + 1.5));
    }
  }
  lines.push(new THREE.Vector3(0, DECK_Y + 16.5, 0.5), new THREE.Vector3(0, DECK_Y + 13.5, -6.2), new THREE.Vector3(0, DECK_Y + 13.5, -6.2), new THREE.Vector3(0, tipY, tipZ));
  lines.push(new THREE.Vector3(0, DECK_Y + 16.5, 0.5), new THREE.Vector3(0, DECK_Y + 3.4, 11));
  ship.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), rope));

  // ----- shop sign + light beam down into the water -----
  const sign = makeTag('⚓ HÄNDLER', '#ffc94d'); sign.scale.multiplyScalar(2.4); sign.position.set(0, DECK_Y + 5.4, 8.6); ship.add(sign);
  const beam = put(ship, CYL, new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, -92, 0, 3, 180, 3);

  // gentle rocking on the waves + waving flag
  let t = 0;
  ship.userData.beam = beam;
  ship.userData.update = (dt) => {
    t += dt;
    ship.rotation.z = Math.sin(t * 0.7) * 0.035; ship.rotation.x = Math.sin(t * 0.5) * 0.015; ship.position.y = (ship.userData.baseY ??= ship.position.y) + Math.sin(t * 0.9) * 0.12;
    const fp = flagG.attributes.position;
    for (let i = 0; i < fp.count; i++) { const x = flagBase[i * 3]; fp.setZ(i, Math.sin(x * 2.2 - t * 5) * 0.18 * (x / 2.6)); }
    fp.needsUpdate = true;
  };
  return ship;
}

// own pirate emblem: a fish skeleton above two crossed harpoons
function drawEmblem(c, cx, cy, s, color) {
  c.save(); c.translate(cx, cy); c.scale(s, s); c.strokeStyle = color; c.fillStyle = color; c.lineCap = 'round';
  c.lineWidth = 9;
  for (const a of [-0.6, 0.6]) {   // crossed harpoons
    c.save(); c.rotate(a); c.beginPath(); c.moveTo(0, -95); c.lineTo(0, 95); c.stroke();
    c.beginPath(); c.moveTo(0, -112); c.lineTo(-15, -86); c.lineTo(15, -86); c.closePath(); c.fill(); c.restore();
  }
  c.lineWidth = 7;
  c.beginPath(); c.moveTo(-58, -8); c.lineTo(52, -8); c.stroke();                          // spine
  c.beginPath(); c.arc(-62, -8, 22, 0, TAU); c.fill();                                       // skull
  c.fillStyle = '#111316'; c.beginPath(); c.arc(-67, -14, 6, 0, TAU); c.fill(); c.fillStyle = color;
  for (let i = 0; i < 6; i++) { const x = -30 + i * 14; c.beginPath(); c.moveTo(x, -8); c.lineTo(x + 6, -34 + i * 3); c.moveTo(x, -8); c.lineTo(x + 6, 18 - i * 3); c.stroke(); }
  c.beginPath(); c.moveTo(52, -8); c.lineTo(76, -30); c.lineTo(70, -8); c.lineTo(76, 14); c.closePath(); c.fill();  // tail
  c.restore();
}
