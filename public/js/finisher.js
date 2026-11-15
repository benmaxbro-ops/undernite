// Undernite – Finisher: kurze Animationen, wenn man einen Gegner mit wenig Leben per G erledigt (nur Battle Royale).
// Jede Klasse hat ihren eigenen Finisher:
//   Manta    – schleicht sich hinter den Gegner und schneidet mit dem Messer den Luftschlauch durch
//   Triton   – ein sauberer Kopfschuss, der Gegner ist einfach weg
//   Bollwerk – haut den Gegner mit der Faust k.o.
//   Goliath  – der Mech holt aus und schlägt einmal zu, der Gegner fliegt weg
// Der Server hat den Gegner schon erledigt. Hier wird nur gezeigt, wie es passiert: dafür wird eine Kopie
// des Gegners ("ghost") an seine Stelle gesetzt und animiert.
import { SUIT_ORDER, dirFrom } from './shared.js';
import { makePlayerModel } from './models.js';

// wie lange jeder Finisher dauert (Sekunden) und wann genau der Treffer passiert (0 = Anfang, 1 = Ende)
export const FIN_TIME = { manta: 1.8, triton: 1.1, bulwark: 1.4, goliath: 1.4 };
const HIT_AT = { manta: 0.5, triton: 0.3, bulwark: 0.45, goliath: 0.4 };

const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };   // weich anfahren und abbremsen

// c = Hilfsmittel aus main.js: { dyn, env, sfx, posOf(id), muzzleOf(id), beam(x0,y0,z0,x1,y1,z1,r), shake(stärke) }
// e = ['fin', Angreifer, Opfer, Klasse Angreifer, Klasse Opfer, x, y, z, Blickrichtung Opfer]
export function startFinisher(c, e) {
  const attacker = e[1], type = SUIT_ORDER[e[3]], vSuit = SUIT_ORDER[e[4]];
  const V = { x: e[5], y: e[6], z: e[7], yaw: e[8] };
  const A0 = { ...(c.posOf(attacker) || { x: V.x + 3, y: V.y, z: V.z }) };
  // Kopie des Gegners; ihre Materialien werden kopiert, damit sie durchsichtig werden kann, ohne andere Taucher zu ändern
  const ghost = makePlayerModel(vSuit, e[2], '');
  const mats = [];
  ghost.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; mats.push(o.material); } });
  ghost.position.set(V.x, V.y, V.z);
  c.dyn.add(ghost);
  const gs = { yaw: V.yaw, pitch: 0, speed: 0, weapon: -1, surf: false };
  // Richtung vom Angreifer zum Gegner (waagerecht)
  let dx = V.x - A0.x, dz = V.z - A0.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const faceV = Math.atan2(-dx, -dz);                 // Blickrichtung "zum Gegner hin"
  const vf = dirFrom(V.yaw, 0);                       // wohin der Gegner schaut
  // wo der Angreifer am Ende stehen soll
  const goal = type === 'manta' ? { x: V.x - vf[0] * 1.2, y: V.y + 0.1, z: V.z - vf[2] * 1.2, yaw: V.yaw }   // direkt hinter ihm
    : type === 'bulwark' ? { x: V.x - dx * 1.5, y: V.y, z: V.z - dz * 1.5, yaw: faceV }                       // vor ihm
    : type === 'goliath' ? { x: V.x - dx * 3, y: V.y, z: V.z - dz * 3, yaw: faceV }
    : { x: A0.x, y: A0.y, z: A0.z, yaw: faceV };                                                              // Triton bleibt stehen
  const moveEnd = type === 'manta' ? 0.4 : type === 'triton' ? 0.01 : 0.33;
  const dur = FIN_TIME[type], hitAt = HIT_AT[type];
  let t = 0, hit = false, vx = 0, vy = 0, vz = 0, spin = 0, gone = 0;

  const f = {
    attacker, type, p: 0, pose: null, ghost,
    // gibt false zurück, wenn der Finisher vorbei ist
    update(dt) {
      t += dt; const p = f.p = Math.min(1, t / dur);
      // 1) Angreifer bewegt sich in Position
      const m = ease(p / moveEnd);
      f.pose = { x: A0.x + (goal.x - A0.x) * m, y: A0.y + (goal.y - A0.y) * m, z: A0.z + (goal.z - A0.z) * m, yaw: goal.yaw };
      // 2) der Treffer
      if (!hit && p >= hitAt) { hit = true; onHit(); }
      // 3) was danach mit dem Gegner passiert
      if (hit) afterHit(dt, p);
      ghost.userData.update(dt, gs);
      // am Ende ausblenden
      const fade = type === 'triton' ? 1 - gone : 1 - ease((p - 0.7) / 0.3);
      for (const mt of mats) mt.opacity = fade;
      if (p >= 1) { c.dyn.remove(ghost); return false; }
      return true;
    },
  };

  function onHit() {
    const gx = ghost.position.x, gy = ghost.position.y, gz = ghost.position.z;
    if (type === 'manta') {
      c.sfx.knife(); c.sfx.hoseCut(); c.shake(0.15);
    } else if (type === 'triton') {
      // sauberer Kopfschuss: Strahl von der Mündung zum Kopf, Blitz und Blasen – und weg ist er
      const mz = c.muzzleOf(attacker) || { x: A0.x, y: A0.y + 0.3, z: A0.z };
      c.beam(mz.x, mz.y, mz.z, gx, gy + 0.35, gz, 0.09);
      c.sfx.headshot(); c.env.bubble(gx, gy + 0.35, gz, 50, 0.5, 4);
    } else if (type === 'bulwark') {
      c.sfx.punch(); c.shake(0.5);
      vx = dx * 10; vy = 2.5; vz = dz * 10; spin = 7;
      c.env.bubble(gx, gy + 0.2, gz, 25, 0.4, 3);
    } else {
      c.sfx.slam(); c.shake(1.1);
      vx = dx * 22; vy = 6; vz = dz * 22; spin = 11;
      c.env.explosion(gx, gy, gz, 4);
    }
  }
  function afterHit(dt, p) {
    const g = ghost;
    if (type === 'manta') {
      // Luft sprudelt aus dem durchgeschnittenen Schlauch, der Gegner zappelt, dann sinkt er bewusstlos weg
      const s = Math.max(0, 1 - (p - hitAt) * 2.5);
      g.rotation.z = Math.sin(t * 25) * 0.25 * s;
      g.rotation.x = -ease((p - 0.65) / 0.3) * 1.2;
      g.position.y -= dt * 0.9 * ease((p - 0.6) / 0.2);
      if (Math.random() < 0.8) c.env.bubble(g.position.x - vf[0] * 0.35, g.position.y + 0.35, g.position.z - vf[2] * 0.35, 2, 0.1, 2.5, 0.03 + Math.random() * 0.05);
    } else if (type === 'triton') {
      gone = Math.min(1, gone + dt * 7);       // in weniger als 0,2 s verschwunden
      g.scale.setScalar(Math.max(0.01, 1 - gone));
    } else {
      // k.o. geschlagen: fliegt weg, überschlägt sich, wird langsamer
      g.position.x += vx * dt; g.position.y += vy * dt; g.position.z += vz * dt;
      const k = Math.exp(-dt * 2.8); vx *= k; vy *= k; vz *= k;
      g.rotation.x -= spin * dt; spin *= Math.exp(-dt * 1.5);
      if (Math.random() < 0.4) c.env.bubble(g.position.x, g.position.y, g.position.z, 1, 0.3, 0.5);
    }
  }
  return f;
}
