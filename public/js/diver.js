// Undernite - realistic scuba diver: neoprene wetsuit, hood, mask with reflective glass,
// regulator, yellow tank with valve and hoses, BCD, gloves, long fins and a flutter kick
// from hips, knees and ankles. The diver lies horizontally, head towards -z, back up (+y).
import * as THREE from 'three';
import { loft } from './creatures.js';
import { neoprene } from './textures.js';

const TAU = Math.PI * 2;
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, ...o });
const SPH = new THREE.SphereGeometry(1, 20, 14), CYL = new THREE.CylinderGeometry(1, 1, 1, 16), BOX = new THREE.BoxGeometry(1, 1, 1);
function put(p, geo, m, x, y, z, sx = 1, sy = sx, sz = sx) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); p.add(o); return o; }
// limb segment along -z from the joint: tapered capsule-like lathe
const limbCache = new Map();
function limbGeo(r0, r1, len) {
  const k = `${r0}|${r1}|${len}`;
  if (limbCache.has(k)) return limbCache.get(k);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, r = (r0 + (r1 - r0) * t) * (1 + 0.12 * Math.sin(t * Math.PI));   // a bit of muscle bulge
    pts.push(new THREE.Vector2(Math.max(0.001, r * Math.sin(Math.min(1, Math.min(t, 1 - t) * 8) * Math.PI / 2)), t * len));
  }
  const g = new THREE.LatheGeometry(pts, 14).rotateX(-Math.PI / 2);   // along -z
  limbCache.set(k, g); return g;
}
function hose(parent, points, m, r = 0.012) {
  const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  parent.add(new THREE.Mesh(new THREE.TubeGeometry(c, 24, r, 6), m));
}

// suit: 'manta' | 'triton' | 'bulwark'. accent: player colour (stripes, fin rails).
export function buildRealDiver(suit, accent) {
  const g = new THREE.Group();
  const heavy = suit === 'bulwark', slim = suit === 'manta';
  // Neopren: das Strickmuster kommt als "bump"-Textur, so sieht der Anzug nach Stoff aus statt nach Plastik
  const suitBlack = mat(0x121519, { roughness: 0.5, metalness: 0.08, bumpMap: neoprene(), bumpScale: 1.2 });
  const rubber = mat(0x0b0c0e, { roughness: 0.65 });
  const acc = mat(accent, { roughness: 0.45, emissive: accent, emissiveIntensity: 0.18 });
  const tankCol = slim ? 0xc8ced4 : heavy ? 0x3e4a56 : 0xd9d24a;
  const tankM = mat(tankCol, { roughness: 0.3, metalness: slim ? 0.85 : 0.35 });
  const chrome = mat(0xd8dde2, { roughness: 0.2, metalness: 0.95 });
  const hoseM = mat(0x16181b, { roughness: 0.6 }), yellowHose = mat(0xe8c21a, { roughness: 0.5 });

  // ----- torso: neoprene with coloured side panels -----
  const A = new THREE.Color(accent), BLK = new THREE.Color(0x121519), GRY = new THREE.Color(0x2a3036), C = new THREE.Color();
  const wide = slim ? 0.88 : heavy ? 1.15 : 1;
  const torso = loft({ w: [[0, 0.07], [0.1, 0.19 * wide], [0.22, 0.225 * wide], [0.5, 0.185 * wide], [0.78, 0.165 * wide], [1, 0.17 * wide]],
    h: [[0, 0.08], [0.1, 0.13], [0.3, 0.148], [0.6, 0.128], [1, 0.13]], y: [[0, 0.02], [1, 0]] }, 0.43, (t, u, v) => {
    C.copy(BLK);
    if (Math.abs(v) < 0.22 && Math.abs(u) > 0.75 && t > 0.15) C.copy(A);          // side panel
    else if (v > 0.55 && t < 0.3) C.copy(GRY);                                     // shoulder panel
    return C;
  }, 26, 20);
  const torsoMesh = put(g, torso, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.08, bumpMap: neoprene(), bumpScale: 1.2 }), 0, 0, -0.12);
  // BCD vest: back plate, shoulder straps, waist belt, inflator hose
  const bcd = mat(0x24292f, { roughness: 0.6 });
  put(g, BOX, bcd, 0, 0.12, -0.18, 0.36 * wide, 0.05, 0.52);
  for (const s of [-1, 1]) { const st = put(g, BOX, bcd, s * 0.15 * wide, 0.05, -0.47, 0.06, 0.26, 0.05); st.rotation.z = s * 0.35; }
  const belt = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 24), bcd); belt.scale.set(0.18 * wide, 0.125, 1); belt.position.set(0, 0, 0.2); g.add(belt);
  put(g, BOX, chrome, 0, -0.12, 0.2, 0.06, 0.02, 0.05);   // buckle
  if (heavy) {   // armour plates for the "Bollwerk"
    const plate = mat(0x55606a, { roughness: 0.35, metalness: 0.7 });
    for (const s of [-1, 1]) { put(g, BOX, plate, s * 0.2, 0.02, -0.4, 0.14, 0.2, 0.22).rotation.z = s * 0.4; put(g, BOX, plate, s * 0.12, -0.11, -0.25, 0.14, 0.04, 0.3); }
  }

  // ----- tank(s) on the back with valve and first stage -----
  const tanks = heavy ? [-0.11, 0.11] : [0];
  for (const tx of tanks) {
    const r = heavy ? 0.085 : 0.095;
    put(g, CYL, tankM, tx, 0.215, -0.1, r, 0.62, r).rotation.x = Math.PI / 2;
    put(g, SPH, tankM, tx, 0.215, -0.41, r, r, r * 0.9);
    put(g, SPH, tankM, tx, 0.215, 0.21, r, r, r * 0.7);
    for (const z of [-0.2, 0.05]) { const band = put(g, CYL, rubber, tx, 0.215, z, r + 0.008, 0.04, r + 0.008); band.rotation.x = Math.PI / 2; }
  }
  put(g, CYL, chrome, 0, 0.26, -0.5, 0.03, 0.12, 0.03).rotation.x = Math.PI / 2;      // valve
  put(g, CYL, rubber, 0, 0.32, -0.5, 0.04, 0.03, 0.04);                                // valve knob
  put(g, SPH, chrome, 0.05, 0.27, -0.55, 0.04, 0.035, 0.04);                           // first stage

  // ----- head: hood, mask, regulator -----
  const head = new THREE.Group(); head.position.set(0, 0.04, -0.68); g.add(head);
  put(g, CYL, suitBlack, 0, 0.03, -0.58, 0.07, 0.12, 0.07).rotation.x = Math.PI / 2 - 0.3;   // neck
  put(head, SPH, suitBlack, 0, 0, 0, 0.11, 0.115, 0.13);                                         // hooded head
  put(head, SPH, mat(0x0d0f12, { roughness: 0.6 }), 0, -0.02, 0.08, 0.1, 0.1, 0.1);              // back of hood
  const skirt = new THREE.Mesh(new THREE.TorusGeometry(1, 0.22, 10, 28), rubber);               // Maskenrahmen (rund)
  skirt.scale.set(0.082, 0.04, 0.12); skirt.position.set(0, -0.04, -0.148); skirt.rotation.x = -0.25; head.add(skirt);
  // Gesicht hinter der Maske: Haut, Augen mit Pupillen, Augenbrauen – so sieht man, dass ein Mensch im Anzug steckt
  const skin = mat(0xd9a27e, { roughness: 0.6 }), eyeW = mat(0xf4f4f0, { roughness: 0.2 }), iris = mat(0x2a4a6a, { roughness: 0.2 }), brow = mat(0x3a2a20);
  const face = new THREE.Group(); face.position.set(0, -0.038, -0.128); face.rotation.x = -0.25; head.add(face);
  put(face, SPH, skin, 0, 0, 0, 0.068, 0.034, 0.025);
  for (const s of [-1, 1]) {
    put(face, SPH, eyeW, s * 0.03, 0.002, -0.017, 0.013, 0.009, 0.008);
    put(face, SPH, iris, s * 0.03, 0.002, -0.024, 0.006, 0.006, 0.003);
    put(face, BOX, brow, s * 0.03, 0.016, -0.02, 0.024, 0.004, 0.004).rotation.z = -s * 0.15;
  }
  put(face, SPH, skin, 0, -0.016, -0.02, 0.009, 0.012, 0.01);   // Nase (steckt in der Nasentasche der Maske)
  // Maskenglas: durchsichtig mit Spiegelung, damit man das Gesicht dahinter sieht
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfe8f8, metalness: 0.2, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.32 });
  const lens = put(head, BOX, glass, 0, -0.04, -0.155, 0.145, 0.06, 0.012); lens.rotation.x = -0.25;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 20), rubber); strap.scale.set(0.12, 0.12, 0.12); strap.rotation.y = Math.PI / 2; strap.rotation.z = 0.3; strap.position.set(0, -0.02, 0); head.add(strap);
  // regulator in the mouth with the exhaust tee where the bubbles come out
  put(head, CYL, rubber, 0, -0.1, -0.12, 0.028, 0.06, 0.028).rotation.x = Math.PI / 2;
  put(head, BOX, mat(0x2b2f35), 0, -0.13, -0.135, 0.07, 0.025, 0.03);
  // hoses: regulator to first stage over the right shoulder, yellow octopus, gauge
  hose(g, [[0.03, -0.06, -0.8], [0.12, -0.02, -0.74], [0.17, 0.12, -0.6], [0.06, 0.27, -0.55]], hoseM, 0.014);
  hose(g, [[0.05, 0.27, -0.56], [-0.16, 0.18, -0.52], [-0.19, -0.05, -0.35], [-0.1, -0.12, -0.22]], yellowHose, 0.012);
  hose(g, [[0.06, 0.26, -0.56], [0.22, 0.15, -0.4], [0.24, -0.02, -0.05], [0.2, -0.08, 0.15]], hoseM, 0.011);
  put(g, CYL, mat(0xe8e8e0, { roughness: 0.3 }), 0.2, -0.09, 0.17, 0.035, 0.015, 0.035);   // gauge face

  // ----- arms: right arm holds the weapon forward, left arm tucked in -----
  const arm = (side, shoulderRot, elbowRot) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.2 * wide, 0.0, -0.5); sh.rotation.set(...shoulderRot); g.add(sh);
    put(sh, SPH, suitBlack, 0, 0, 0, 0.06);
    sh.add(new THREE.Mesh(limbGeo(0.055, 0.047, 0.28), suitBlack));
    const el = new THREE.Group(); el.position.z = -0.28; el.rotation.set(...elbowRot); sh.add(el);
    el.add(new THREE.Mesh(limbGeo(0.047, 0.036, 0.25), suitBlack));
    put(el, SPH, suitBlack, 0, 0, 0, 0.05);   // elbow
    put(el, SPH, rubber, 0, 0, -0.29, 0.045, 0.03, 0.06);   // glove
    return el;
  };
  const rightHand = arm(1, [-0.32, 0.28, 0], [0.18, -0.05, 0]);
  arm(-1, [0.55, Math.PI + 0.35, 0], [0, 1.6, 0]);
  // weapon in the right hand: the white-blue water gun is put in here by makePlayerModel (models.js)
  const gun = new THREE.Group(); gun.position.set(0, 0.05, -0.25); rightHand.add(gun);

  // ----- legs with long fins -----
  const finM = mat(0x0f1114, { roughness: 0.55, side: THREE.DoubleSide });
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.06, 0); finShape.lineTo(0.06, 0); finShape.lineTo(0.12, 0.45); finShape.quadraticCurveTo(0.13, 0.66, 0.06, 0.68);
  finShape.lineTo(0, 0.6); finShape.lineTo(-0.06, 0.68); finShape.quadraticCurveTo(-0.13, 0.66, -0.12, 0.45); finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.012, bevelEnabled: false }).rotateX(Math.PI / 2);   // blade along +z, flat in xz
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(side * 0.09 * wide, -0.02, 0.27); g.add(hip);
    put(hip, SPH, suitBlack, 0, 0, 0, 0.085, 0.085, 0.1);   // hip joint
    const thigh = new THREE.Mesh(limbGeo(0.08, 0.06, 0.42), suitBlack); thigh.rotation.y = Math.PI; hip.add(thigh);   // along +z
    const knee = new THREE.Group(); knee.position.z = 0.42; hip.add(knee);
    put(knee, SPH, suitBlack, 0, 0, 0, 0.062);   // knee
    const shin = new THREE.Mesh(limbGeo(0.058, 0.04, 0.4), suitBlack); shin.rotation.y = Math.PI; knee.add(shin);
    const ankle = new THREE.Group(); ankle.position.z = 0.4; knee.add(ankle);
    put(ankle, SPH, rubber, 0, 0, 0, 0.045);
    put(ankle, BOX, rubber, 0, 0, 0.08, 0.075, 0.06, 0.2);                       // foot pocket
    const fin = new THREE.Group(); fin.position.set(0, -0.01, 0.1); ankle.add(fin);
    fin.add(new THREE.Mesh(finGeo, finM));
    for (const s of [-1, 1]) { const rail = put(fin, BOX, acc, s * 0.09, 0.008, 0.33, 0.012, 0.02, 0.5); rail.rotation.y = -s * 0.12; }   // coloured rails
    legs.push({ hip, knee, ankle, fin });
  }
  g.scale.setScalar({ manta: 0.92, triton: 1, bulwark: 1.12 }[suit] ?? 1);

  return {
    g, gun, hand: rightHand, mech: false, legs: [],
    // flutter kick: legs move up and down from the hip, knees and fins follow with a delay
    animate(dt, s, phase, amp) {
      for (let i = 0; i < 2; i++) {
        const L = legs[i], ph = phase + i * Math.PI;
        L.hip.rotation.x = Math.sin(ph) * 0.3 * amp - 0.05;
        L.knee.rotation.x = -Math.max(0, Math.sin(ph + 0.9)) * 0.55 * amp - 0.08;
        L.ankle.rotation.x = 0.15;
        L.fin.rotation.x = Math.sin(ph - 1.1) * 0.35 * amp;
      }
    },
  };
}
