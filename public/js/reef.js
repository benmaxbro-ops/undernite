// Undernite – Riff-Deko: neue Korallenarten und Fischschwärme. Alles hier ist nur zum Anschauen
// (der Server weiß nichts davon), deshalb kann man es frei ändern, ohne das Spiel kaputt zu machen.
//   Korallen: Geweihkoralle, Hirnkoralle, Tischkoralle, Fächerkoralle, Röhrenschwämme, Anemonen (wiegen sich)
//   Fische:   Schwärme kleiner Fische, die um die Riffe ziehen
import * as THREE from 'three';
import { seeded, pores, fanLattice } from './textures.js';

const TAU = Math.PI * 2;
// Wie viele neue Korallen pro alter Koralle und wie viele Fische – hier kannst du drehen!
export const REEF = { perCoral: 1.5, schools: 10, fishPerSchool: 36 };
const PAL = [0xff5d8f, 0xff9a3c, 0xc86bff, 0xffd84d, 0x35e0c8, 0xff6b5e, 0x7fb2ff, 0xf2f2e6];

// ---------- Hilfsmittel: viele Teile zu einer einzigen Form verschmelzen (schneller zu zeichnen) ----------
// parts = [{ geo, m: Matrix4, shade(x, y, z) -> Helligkeit 0…1 }]
function merge(parts) {
  const list = parts.map(p => { const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(); g.applyMatrix4(p.m); return [g, p.shade]; });
  const n = list.reduce((a, [g]) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const [g, shade] of list) {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++, o++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), s = shade ? shade(x, y, z) : 1;
      pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
      nor[o * 3] = N.getX(i); nor[o * 3 + 1] = N.getY(i); nor[o * 3 + 2] = N.getZ(i);
      col[o * 3] = col[o * 3 + 1] = col[o * 3 + 2] = s;
      if (U) { uv[o * 2] = U.getX(i); uv[o * 2 + 1] = U.getY(i); }
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
const UP = new THREE.Vector3(0, 1, 0);
// Matrix für ein Teil: Position p, Richtung dir (zeigt die y-Achse hin), Größe s
const place = (p, dir, s) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()), s);
const tipShade = (top) => (x, y) => Math.min(1, 0.55 + (y / top) * 0.5);     // Spitzen heller als der Fuß

// ---------- die sechs Korallen-Formen ----------
function staghornGeo() {     // Geweihkoralle: Äste, die sich immer wieder teilen
  const R = seeded(5), parts = [], cyl = new THREE.CylinderGeometry(0.55, 1, 1, 6, 1, true).translate(0, 0.5, 0), tip = new THREE.ConeGeometry(0.55, 0.6, 6).translate(0, 0.3, 0);
  const branch = (p, dir, len, r, depth) => {
    parts.push({ geo: cyl, m: place(p, dir, new THREE.Vector3(r, len, r)), shade: tipShade(1.4) });
    const end = p.clone().addScaledVector(dir, len);
    if (depth >= 3) { parts.push({ geo: tip, m: place(end, dir, new THREE.Vector3(r, r, r)), shade: () => 1 }); return; }
    const n = 2 + (R() < 0.15 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, tilt = 0.35 + R() * 0.45;
      const d = dir.clone().applyAxisAngle(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), tilt).normalize();
      branch(end, d, len * (0.7 + R() * 0.15), r * 0.7, depth + 1);
    }
  };
  for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35).normalize(), 0.45, 0.07, 0); }
  return merge(parts);
}
function brainGeo() {        // Hirnkoralle: Halbkugel mit gewundenen Rillen
  const g = new THREE.SphereGeometry(1, 64, 32, 0, TAU, 0, Math.PI / 2), P = g.attributes.position, col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const groove = Math.sin(x * 16 + Math.sin(z * 9) * 2.4) * Math.cos(z * 14 + Math.sin(x * 7) * 2.1);
    const k = 1 + 0.045 * groove;
    P.setXYZ(i, x * k, y * k * 0.62, z * k);
    const s = 0.62 + 0.38 * (groove * 0.5 + 0.5); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = s;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}
function tableGeo() {        // Tischkoralle: flache Platte auf einem kurzen Stiel
  const parts = [], Y = new THREE.Vector3(0, 1, 0), o = new THREE.Vector3();
  parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.16, 0.5, 12).translate(0, 0.25, 0), m: new THREE.Matrix4(), shade: () => 0.6 });
  parts.push({ geo: new THREE.CylinderGeometry(1, 0.8, 0.1, 40), m: place(o.set(0, 0.52, 0), Y, new THREE.Vector3(1, 1, 1)), shade: (x, y, z) => 0.7 + Math.hypot(x, z) * 0.3 });
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; parts.push({ geo: new THREE.SphereGeometry(0.08, 5, 3), m: place(new THREE.Vector3(Math.cos(a) * 0.97, 0.56, Math.sin(a) * 0.97), Y, new THREE.Vector3(1, 0.7, 1)), shade: () => 1 }); }
  return merge(parts);
}
function tubesGeo() {        // Röhrenschwämme: mehrere oben offene Röhren
  const R = seeded(9), parts = [];
  for (let i = 0; i < 6; i++) {
    const r = 0.08 + R() * 0.08, h = 0.4 + R() * 0.9, a = R() * TAU, d = i ? 0.12 + R() * 0.2 : 0;
    const geo = new THREE.CylinderGeometry(r * 1.2, r, h, 12, 1, true).translate(0, h / 2, 0);
    const dir = new THREE.Vector3((R() - 0.5) * 0.3, 1, (R() - 0.5) * 0.3);
    parts.push({ geo, m: place(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), dir, new THREE.Vector3(1, 1, 1)), shade: tipShade(1.3) });
    parts.push({ geo: new THREE.TorusGeometry(r * 1.2, 0.018, 4, 12).rotateX(Math.PI / 2).translate(0, h, 0), m: place(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), dir, new THREE.Vector3(1, 1, 1)), shade: () => 1 });
  }
  return merge(parts);
}
function anemoneGeo() {      // Anemone: dicker Fuß und viele Fangarme (die sich im Wasser wiegen)
  const R = seeded(13), parts = [], tent = new THREE.CylinderGeometry(0.004, 0.024, 0.4, 5, 3).translate(0, 0.2, 0);
  parts.push({ geo: new THREE.CylinderGeometry(0.17, 0.2, 0.22, 20).translate(0, 0.11, 0), m: new THREE.Matrix4(), shade: () => 0.55 });
  for (let i = 0; i < 46; i++) {
    const a = R() * TAU, rr = Math.sqrt(R()) * 0.16, out = rr / 0.16;
    const dir = new THREE.Vector3(Math.cos(a) * (0.2 + out), 1, Math.sin(a) * (0.2 + out));
    parts.push({ geo: tent, m: place(new THREE.Vector3(Math.cos(a) * rr, 0.21, Math.sin(a) * rr), dir, new THREE.Vector3(1, 0.7 + R() * 0.6, 1)), shade: (x, y) => Math.min(1, 0.5 + (y - 0.2) * 1.6) });
  }
  return merge(parts);
}
function fanGeo() {          // Fächerkoralle: flaches Netz (die Löcher kommen aus der Textur)
  const g = new THREE.PlaneGeometry(1.6, 1.5, 1, 1).translate(0, 0.75, 0);
  const col = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// ---------- kleine Schwarmfische ----------
export function schoolFishGeo() {
  // Körper: ein gedrehtes Profil (wie beim Töpfern), seitlich etwas flacher; Nase vorne (-z), Schwanz hinten (+z)
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(Math.max(0.002, 0.11 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.75)), t)); }
  const body = new THREE.LatheGeometry(pts, 12).rotateX(Math.PI / 2).translate(0, 0, -0.5);
  body.scale(0.55, 1, 1);
  const tail = new THREE.BufferGeometry(); tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.42, 0, 0.13, 0.68, 0, -0.13, 0.68], 3)); tail.computeVertexNormals();
  const geo = merge([{ geo: body, m: new THREE.Matrix4(), shade: (x, y) => y > 0.01 ? 0.35 : 1 }, { geo: tail, m: new THREE.Matrix4(), shade: () => 0.6 }]);
  geo.scale(0.32, 0.32, 0.32);
  return geo;
}

// root = Gruppe der Welt, W = die Welt (shared.js), decorate(mat) = fügt Lichtmuster (Kaustik) hinzu, uTime = Zeit für Shader
export function buildReef(root, W, decorate, uTime) {
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
  const poreTex = pores(), fanTex = fanLattice();
  const kinds = [
    { geo: staghornGeo(), mat: decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, bumpMap: poreTex, bumpScale: 0.8 })), s: [0.7, 1.4] },
    { geo: brainGeo(),    mat: decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, bumpMap: poreTex, bumpScale: 0.6 })), s: [0.35, 0.9] },
    { geo: tableGeo(),    mat: decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, bumpMap: poreTex, bumpScale: 0.6 })), s: [0.6, 1.4] },
    { geo: fanGeo(),      mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, map: fanTex, alphaTest: 0.35, side: THREE.DoubleSide }), s: [0.7, 1.5] },
    { geo: tubesGeo(),    mat: decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, bumpMap: poreTex, bumpScale: 0.5 })), s: [0.6, 1.3] },
    { geo: anemoneGeo(),  mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0x220a14, emissiveIntensity: 0.4 }), s: [0.7, 1.3] },
  ];
  // Anemonen-Fangarme wiegen sich: im Shader werden die oberen Punkte hin und her geschoben
  kinds[5].mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float h = max(0.0, position.y - 0.21);
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.4;
        #else
          float ph = 0.0;
        #endif
        transformed.x += sin(uTime * 1.6 + ph + position.z * 9.0) * h * h * 1.4;
        transformed.z += cos(uTime * 1.3 + ph + position.x * 9.0) * h * h * 1.1;`);
  };
  // Positionen: rund um jede vorhandene Koralle ein paar neue (immer gleich, weil der Zufall einen festen Startwert hat)
  const spots = kinds.map(() => []);
  // die alten Korallen der Welt bekommen die neuen, schöneren Formen: Kugel → Hirnkoralle, Kegel → Geweihkoralle, Halbkreis → Fächerkoralle
  const BASE_KIND = [1, 0, 3], BASE_SCALE = [0.65, 0.8, 0.9];
  for (const c of W.coral) spots[BASE_KIND[c.type]].push({ x: c.x, y: c.y - 0.05, z: c.z, s: c.s * BASE_SCALE[c.type], rot: c.rot, tilt: 0, col: c.col, light: 1 });
  W.coral.forEach((c, i) => {
    const R = seeded(i * 7919 + 13), n = Math.floor(REEF.perCoral) + (R() < REEF.perCoral % 1 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const t = (R() * kinds.length) | 0, a = R() * TAU, d = 0.8 + R() * 2.4;
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, y = W.heightAt(x, z) - 0.05;
      const [s0, s1] = kinds[t].s, s = s0 + R() * (s1 - s0);
      spots[t].push({ x, y, z, s, rot: R() * TAU, tilt: (R() - 0.5) * 0.25, col: PAL[(R() * PAL.length) | 0], light: 0.8 + R() * 0.35 });
    }
  });
  kinds.forEach((k, t) => {
    const list = spots[t]; if (!list.length) return;
    const im = new THREE.InstancedMesh(k.geo, k.mat, list.length);
    list.forEach((p, i) => {
      im.setMatrixAt(i, M4.compose(V.set(p.x, p.y, p.z), Q.setFromEuler(E.set(p.tilt, p.rot, p.tilt * 0.6)), S.set(p.s, p.s, p.s)));
      im.setColorAt(i, C.setHex(p.col).multiplyScalar(p.light));
    });
    im.instanceColor.needsUpdate = true;
    root.add(im);
  });

  // ---------- Fischschwärme ----------
  const anchors = [];
  for (const c of W.coral) { if (anchors.length >= REEF.schools) break; if (anchors.every(a => Math.hypot(a.x - c.x, a.z - c.z) > 30)) anchors.push(c); }
  const N = anchors.length * REEF.fishPerSchool;
  const fishMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.55, side: THREE.DoubleSide });
  fishMat.onBeforeCompile = (sh) => {      // Schwanz schlägt hin und her
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float fph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].y * 1.7;
        #else
          float fph = 0.0;
        #endif
        transformed.x += sin(uTime * 13.0 + fph + position.z * 14.0) * 0.035 * smoothstep(-0.05, 0.22, position.z);`);
  };
  const fish = new THREE.InstancedMesh(schoolFishGeo(), fishMat, Math.max(1, N));
  fish.count = N;
  const tints = [0x9fc8e8, 0xffd27a, 0x8fe8d8, 0xc8d0ff, 0xffb0a0];
  const members = [];
  anchors.forEach((a, si) => {
    const R = seeded(si * 31 + 7), tint = new THREE.Color(tints[si % tints.length]);
    const school = { ax: a.x, ay: a.y + 3 + R() * 3, az: a.z, rad: 6 + R() * 6, w: 0.08 + R() * 0.06, ph: R() * TAU };
    for (let i = 0; i < REEF.fishPerSchool; i++) {
      members.push({ school, ox: (R() - 0.5) * 4, oy: (R() - 0.5) * 1.6, oz: (R() - 0.5) * 4, ph: R() * TAU, s: 0.8 + R() * 0.5 });
      fish.setColorAt(members.length - 1, tint);
    }
  });
  if (fish.instanceColor) fish.instanceColor.needsUpdate = true;
  fish.frustumCulled = false;
  root.add(fish);
  const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), LM = new THREE.Matrix4(), UPV = new THREE.Vector3(0, 1, 0);
  const pathAt = (sc, t, out) => out.set(sc.ax + Math.cos(t * sc.w + sc.ph) * sc.rad, sc.ay + Math.sin(t * sc.w * 1.7 + sc.ph) * 1.5, sc.az + Math.sin(t * sc.w * 0.8 + sc.ph) * sc.rad);

  return {
    update(t) {
      // jeder Fisch folgt der Bahn seines Schwarms, mit eigenem kleinen Versatz, und schaut in Schwimmrichtung
      for (let i = 0; i < members.length; i++) {
        const m = members[i], sc = m.school, lag = (m.oz * 0.35) / (sc.rad * sc.w);
        pathAt(sc, t - lag, P0); pathAt(sc, t - lag + 0.1, P1);
        const wob = Math.sin(t * 1.3 + m.ph) * 0.3;
        P0.x += m.ox + wob; P0.y += m.oy + Math.cos(t * 1.1 + m.ph) * 0.2; P0.z += m.oz * 0.4;
        P1.x += m.ox + wob; P1.y += m.oy; P1.z += m.oz * 0.4;
        // lookAt richtet die z-Achse vom Ziel weg aus (z = P0 − P1 = nach hinten). Unsere Fische schauen nach −z, also nach vorne zu P1.
        LM.lookAt(P0, P1, UPV); Q.setFromRotationMatrix(LM);
        fish.setMatrixAt(i, M4.compose(P0, Q, S.set(m.s, m.s, m.s)));
      }
      fish.instanceMatrix.needsUpdate = true;
    },
  };
}
