// Undernite - Sounds (WebAudio). Die Schüsse und das Nachladen sind echte Aufnahmen (CC0, siehe public/sounds/QUELLEN.txt),
// alles andere wird aus Tönen und Rauschen gebaut. Die echten Aufnahmen laufen durch eine Unterwasser-Kette und bekommen
// eine Plasma-Schicht dazu. Hier kannst du drehen:
export const UNDERWATER = {
  cutoff: 1600,    // Hz: darüber wird es gedämpft (Wasser schluckt hohe Töne). Kleiner = dumpfer
  bass: 7,         // dB: mehr Bass für die Druckwelle
  pitch: 0.88,     // 1 = Originalhöhe, kleiner = tiefer
  wobble: 0.0018,  // wie stark der Klang "wabert" (Sekunden Verzögerungsschwankung)
  echo: 0.32,      // wie viel Echo zurückkommt (0 = keins)
  echoTime: 0.14,  // Sekunden bis zum Echo
  shotCutoff: 3000, // Hz: eigene Schüsse etwas heller als der Rest, aber trotzdem dumpf (Wasser schluckt Höhen)
  metal: 0.5,      // metallischer Nachklang (0 = aus). Unter Wasser klingt Kampflärm blechern …
  metalTime: 0.0045, // … weil Schall im Wasser viermal so schnell ist und von überall gleichzeitig zu kommen scheint
};
// Ein Schuss besteht aus Schichten (wie bei Profi-Spielen):
//   crack = der scharfe Knall-Anfang (die ersten 35 ms, ungefiltert) → das "Snap", das man spürt
//   body  = die Aufnahme selbst (leicht übersteuert)
//   boom  = ein kurzer, straffer Bass-Schlag (kurz, damit schnelle Schüsse nicht verschmieren)
//   mech  = der Verschluss klackt (das Gefühl "ich halte eine Waffe")
//   duck  = alle anderen Geräusche werden im Moment des Schusses kurz leiser → der Schuss wirkt lauter
export const SHOT = { crack: 1.0, body: 1.1, boom: 1.0, mech: 0.5, duck: 0.45 };
export const PLASMA = {
  ring: 0.12,      // elektrisches Brummen (Ringmodulation): 0 = aus, 1 = stark (zu viel macht den Schuss dünn)
  zap: 0.25,       // Lautstärke des "Dzzzt"
};
// Schuss-Aufnahme je Waffe (Reihenfolge wie WEAPON_IDS)
const SHOT_FILES = ['shot_pistol', 'shot_needler', 'shot_scatter', 'shot_harpoon', 'shot_torpedo', 'shot_torpedo', 'shot_plasma', 'shot_sonic'];
const FILES = [...new Set(SHOT_FILES), 'mag_out', 'mag_in', 'mag_in_rifle', 'slide_back', 'slide_fwd'];
export class Sfx {
  constructor() { this.ctx = null; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    // Kompressor am Ende: macht laute Spitzen gleichmäßiger, so kann alles lauter sein, ohne zu übersteuern
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.18;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0.62; this.master.connect(comp);
    this.world = ctx.createGain(); this.world.connect(this.master);   // alles außer den eigenen Schüssen (wird beim Schuss kurz leiser)
    // noise buffer shared by all noise based sounds
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // ambient rumble
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170;
    const g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(lp).connect(g).connect(this.world); src.start();
    this.makeWater();
    this.load();
  }
  // die Aufnahmen laden (bis sie da sind, spielen die gebauten Ersatz-Sounds)
  load() {
    this.bufs = {};
    for (const f of FILES) fetch(`./sounds/${f}.wav`).then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b)).then(buf => { this.bufs[f] = buf; }).catch(() => {});
  }
  // Unterwasser-Kette: Bass rauf → Höhen weg → Wabern (Chorus) → Echo
  makeWater() {
    this.uw = this.chain(UNDERWATER.cutoff, this.world);          // dumpf: Nachladen, Explosionen, Plasma-Zap …
    this.uwShot = this.chain(UNDERWATER.shotCutoff, this.master); // hell: Schüsse (sonst fehlt der Knall)
  }
  // Unterwasser-Kette: Bass rauf → Höhen weg → Wabern (Chorus) → Echo. Gibt den Eingang zurück.
  chain(cutoff, out) {
    const ctx = this.ctx, U = UNDERWATER, input = ctx.createGain();
    const shelf = ctx.createBiquadFilter(); shelf.type = 'lowshelf'; shelf.frequency.value = 150; shelf.gain.value = U.bass;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.7;
    input.connect(shelf).connect(lp).connect(out);
    // Wabern: eine winzige Verzögerung, die 5-mal pro Sekunde schwankt, wird dazugemischt
    const wob = ctx.createDelay(0.05); wob.delayTime.value = 0.008;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5; lg.gain.value = U.wobble; lfo.connect(lg).connect(wob.delayTime); lfo.start();
    const wg = ctx.createGain(); wg.gain.value = 0.4; lp.connect(wob).connect(wg).connect(out);
    // metallischer Nachklang (Kammfilter): eine winzige Verzögerung, die sich immer wieder selbst wiederholt → blechernes Klingeln
    const md = ctx.createDelay(0.05), mfb = ctx.createGain(), mbp = ctx.createBiquadFilter(), mout = ctx.createGain();
    md.delayTime.value = U.metalTime; mfb.gain.value = 0.62; mbp.type = 'bandpass'; mbp.frequency.value = 1400; mbp.Q.value = 0.8; mout.gain.value = U.metal;
    lp.connect(md); md.connect(mbp).connect(mfb).connect(md); mbp.connect(mout).connect(out);
    // Echo: kommt gedämpft zurück und wird jedes Mal leiser
    const ed = ctx.createDelay(1), fb = ctx.createGain(), elp = ctx.createBiquadFilter(), send = ctx.createGain();
    ed.delayTime.value = U.echoTime; fb.gain.value = U.echo; elp.type = 'lowpass'; elp.frequency.value = 650; send.gain.value = 0.4;
    lp.connect(send).connect(ed); ed.connect(elp).connect(fb).connect(ed); elp.connect(out);
    // leichte Übersteuerung (Sättigung) für Schüsse: schneidet Spitzen weich ab → klingt lauter und härter
    const sh = ctx.createWaveShaper(), c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(x * 2.6) / Math.tanh(2.6); }
    sh.curve = c; sh.connect(input); input.shaper = sh;
    return input;
  }
  // eine Aufnahme abspielen. plasma = wie viel elektrisches Brummen dazukommt. Gibt false zurück, wenn sie noch nicht geladen ist.
  // bus = 'shot' für die helle Schuss-Kette, sonst die dumpfe
  sample(name, vol = 1, { rate = 1, at = 0, plasma = 0, drive = false, bus = '' } = {}) {
    const ctx = this.ctx, buf = this.bufs && this.bufs[name];
    if (!ctx || !buf) return false;
    if (vol < 0.01) return true;
    const t = ctx.currentTime + at, src = ctx.createBufferSource(); src.buffer = buf;
    const r = rate * UNDERWATER.pitch * (0.96 + Math.random() * 0.08);   // jedes Mal minimal anders, klingt natürlicher
    src.playbackRate.value = r;
    const g = ctx.createGain(); g.gain.value = vol;
    const into = bus === 'shot' ? this.uwShot : this.uw;
    src.connect(g).connect(drive ? into.shaper : into);
    if (plasma > 0) {
      // Ringmodulation: die Lautstärke wird ~95-mal pro Sekunde zwischen + und − umgeschaltet → elektrisches Brummen
      const rm = ctx.createGain(); rm.gain.value = 0;
      const osc = ctx.createOscillator(); osc.frequency.value = 80 + Math.random() * 30; osc.connect(rm.gain);
      const pg = ctx.createGain(); pg.gain.value = plasma * vol;
      src.connect(rm).connect(pg).connect(into);
      osc.start(t); osc.stop(t + buf.duration / r + 0.05);
    }
    src.start(t);
    return true;
  }
  // Plasma-"Dzzzt": ein Sägezahn-Ton, der von hoch nach tief fällt, durch einen wandernden Filter, dazu Knistern
  zap(big, vol) {
    const ctx = this.ctx; if (!ctx || vol < 0.01) return;
    const t = ctx.currentTime, d = 0.12 + big * 0.12;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(2200 - big * 900, t); o.frequency.exponentialRampToValueAtTime(140, t + d);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 7; bp.frequency.setValueAtTime(4200, t); bp.frequency.exponentialRampToValueAtTime(380, t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(bp).connect(g).connect(this.uw); o.start(t); o.stop(t + d + 0.02);
    for (let i = 0; i < 4; i++) this.noise(0.012, 5000 + Math.random() * 3000, 4, vol * 0.5, 'bandpass', 0, Math.random() * d * 0.7);   // Knistern
  }
  // echter Schuss: Aufnahme (unter Wasser) + Plasma-Brummen + Dzzzt + ein tiefer Druckstoß
  // echter Schuss mit BUM: die Aufnahme (leicht übersteuert für mehr Biss), darunter ein großer Bass-Schlag (BUM),
  // ein dumpfer Druck-Knall, das Plasma-"Dzzzt" und bei Torpedos das "Wusch" der Druckluft
  realShot(w, vol) {
    const name = SHOT_FILES[w] || SHOT_FILES[0], buf = this.bufs && this.bufs[name], ctx = this.ctx;
    if (!buf) return false;
    const big = w === 7 ? 1 : w >= 4 && w <= 5 ? 0.95 : w === 6 ? 0.8 : w === 3 ? 0.85 : w === 2 ? 0.75 : w === 0 ? 0.55 : 0.35;
    const t = ctx.currentTime;
    // 1) metallisches Klicken: unter Wasser gibt es keinen hellen Knall, sondern ein hartes "Klick" (Verschluss + Druckwelle)
    const own = vol > 0.95;   // eigener Schuss: man hört ihn auch über die Knochen, also härter. Fremde Schüsse: dumpfer
    this.cur = this.uwShot;
    this.tone(2600 - big * 600, 1700 - big * 400, 0.014, SHOT.crack * vol * (own ? 0.55 : 0.25), 'square');
    this.noise(0.02, 3200, 3, SHOT.crack * vol * (own ? 0.5 : 0.2), 'bandpass');
    this.cur = null;
    // 2) Körper: die Aufnahme durch die helle Unterwasser-Kette, leicht übersteuert
    this.sample(name, SHOT.body * vol, { plasma: PLASMA.ring, drive: true, bus: own ? 'shot' : '', rate: 1.08 });
    // 3) kurzer, straffer Bass-Schlag (nicht nachklingen lassen, sonst verschmiert es)
    this.cur = this.master;
    this.tone(62 - big * 16, 32, 0.08 + big * 0.08, (1.2 + big * 0.4) * SHOT.boom * vol, 'sine');     // harter, dumpfer Schlag
    this.tone(130 - big * 30, 60, 0.05, 0.7 * SHOT.boom * vol, 'triangle');
    this.noise(0.05 + big * 0.06, 400, 0.8, 0.5 * SHOT.boom * vol, 'lowpass', 90);
    this.cur = null;
    // 4) Mechanik: der Verschluss klackt kurz nach dem Schuss (bei Werfern ein dumpfes Klonk)
    this.sample(w === 4 || w === 5 || w === 7 ? 'mag_in' : 'slide_fwd', SHOT.mech * vol * (w === 1 ? 0.5 : 1), { at: 0.02, rate: 1.2, bus: 'shot' });
    // 5) Plasma-"Dzzzt" (leise darunter) und bei Torpedos das "Wusch"
    this.zap(big, PLASMA.zap * vol * (0.6 + big * 0.4));
    if (w === 4 || w === 5) this.launch(vol);
    // 6) Ducking: alles andere kurz leiser, nur bei eigenen Schüssen (vol = 1)
    if (own && SHOT.duck > 0) {
      const gw = this.world.gain; gw.cancelScheduledValues(t); gw.setValueAtTime(gw.value, t);
      gw.linearRampToValueAtTime(1 - SHOT.duck, t + 0.008); gw.setTargetAtTime(1, t + 0.06, 0.09);
    }
    return true;
  }
  // Torpedo-Start: Druckluft stößt ihn raus ("Pfff"), dann läuft der Propeller an ("Wuuusch")
  launch(vol = 1) {
    this.noise(0.35, 500, 0.9, 0.7 * vol, 'bandpass', 2400);
    this.noise(0.9, 900, 1.4, 0.45 * vol, 'bandpass', 300, 0.15);
    this.tone(160, 820, 0.7, 0.12 * vol, 'sawtooth', 0.1);
    for (let i = 0; i < 8; i++) { const at = 0.05 + Math.random() * 0.6, p = 150 + Math.random() * 250; this.tone(p, p * 2.2, 0.06, 0.12 * vol, 'sine', at); }   // Blasen
  }
  noise(dur, freq, q, vol, type = 'bandpass', slide = 0, at = 0) {
    const ctx = this.ctx; if (!ctx || vol <= 0.003) return;
    const t = ctx.currentTime + at, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.cur || this.world || this.master); src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }
  tone(f0, f1, dur, vol, type = 'sine', at = 0) {
    const ctx = this.ctx; if (!ctx || vol <= 0.003) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.cur || this.world || this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  shot(w, vol) {
    if (this.realShot(w, vol)) return;
    if (w === 1) { this.noise(0.07, 2600, 2, 0.35 * vol, 'bandpass', 900); this.tone(900, 300, 0.06, 0.12 * vol, 'square'); }
    else if (w === 2) { this.noise(0.22, 900, 0.8, 0.6 * vol, 'lowpass', 200); }
    else if (w === 3) { this.tone(500, 90, 0.25, 0.4 * vol, 'sawtooth'); this.noise(0.18, 1800, 3, 0.3 * vol); }
    else if (w === 6) { this.tone(1400, 400, 0.12, 0.25 * vol, 'sawtooth'); this.noise(0.08, 3000, 2, 0.2 * vol, 'bandpass', 1500); }
    else if (w === 7) { this.tone(90, 40, 0.6, 0.6 * vol, 'sine'); this.tone(300, 60, 0.3, 0.3 * vol, 'square'); }
    else if (w >= 4) { this.tone(160, 60, 0.45, 0.5 * vol, 'sine'); this.noise(0.4, 500, 1, 0.3 * vol, 'lowpass', 120); }
    else { this.noise(0.1, 1500, 1.5, 0.45 * vol, 'bandpass', 500); this.tone(420, 150, 0.09, 0.2 * vol, 'triangle'); }
  }
  // Wasserstrahl mit Druck – ein Schuss in drei Teilen:
  //   A) Aufladen: ein kurzes Hochjaulen (der Druck baut sich auf, ca. 0,06 s)
  //   B) Abschuss: Druckstoß (tiefer Bums), Knall (Ventil), Strahl (Rauschen, das nach oben rast), Nachhall
  //   C) Abschluss: ein tiefes "Bwwww", das ausklingt, und das Ventil klackt zu ("Tschk")
  // big: 0 = kleine Waffe (hell, kurz) … 1 = große Waffe (tief, lang)
  jet(w, vol) {
    if (this.realShot(w, vol)) return;
    const big = w === 6 ? 1 : w === 3 ? 0.9 : w === 2 ? 0.75 : w === 0 ? 0.4 : 0.15;   // Plasmalanze, Harpune, Splitterwerfer, Pistole, Nadler
    const dur = 0.1 + big * 0.12, at = 0.018;                          // at = wann der Abschuss kommt (nach einem ganz kurzen Aufladen)
    // A) Aufladen
    this.tone(400 + big * 80, 1800 - big * 400, at, (0.06 + big * 0.04) * vol, 'sawtooth');
    this.noise(at, 1200, 2, 0.08 * vol, 'bandpass', 3600);
    // B) Abschuss
    this.tone(150 - big * 70, 38, 0.12 + big * 0.1, (0.95 + big * 0.3) * vol, 'sine', at);           // Wumms (stärker)
    this.noise(0.012, 5000, 0.8, (0.7 + big * 0.2) * vol, 'highpass', 0, at);                         // scharfer Knall-Anfang
    this.tone(95 - big * 30, 30, 0.08, 0.35 * vol, 'triangle', at);
    this.noise(0.035, 2600 - big * 900, 1.5, (0.55 + big * 0.2) * vol, 'bandpass', 0, at);
    this.tone(1800 - big * 600, 700, 0.03, 0.12 * vol, 'square', at);
    this.noise(dur, 450 - big * 150, 1.4, (0.5 + big * 0.2) * vol, 'bandpass', 5200 - big * 1600, at + 0.01);
    this.noise(dur * 0.7, 7500, 0.7, 0.14 * vol, 'highpass', 0, at + 0.01);
    this.noise(0.35 + big * 0.3, 380, 0.6, 0.2 * vol, 'lowpass', 90, at + 0.04);
    // C) Abschluss
    const tail = 0.15 + big * 0.3;
    this.tone(210 - big * 60, 65, tail, (0.22 + big * 0.18) * vol, 'sine', at + 0.06);            // Bwwww
    this.tone(105 - big * 30, 50, tail, (0.1 + big * 0.08) * vol, 'triangle', at + 0.06);
    this.tone(1500, 950, 0.025, (0.08 + big * 0.06) * vol, 'square', at + dur + 0.05);            // Ventil klackt zu
    this.noise(0.12, 6000, 0.8, (0.06 + big * 0.05) * vol, 'highpass', 0, at + dur + 0.05);       // Pssst
    // Echo: der Knall kommt gedämpft zweimal zurück (vom Meeresboden und von Felsen)
    for (const [d, v] of [[0.13, 0.32], [0.29, 0.15]]) {
      this.tone(130 - big * 50, 40, 0.16, (0.45 + big * 0.2) * v * vol, 'sine', at + d);
      this.noise(0.2, 650, 0.7, 0.3 * v * vol, 'lowpass', 160, at + d);
    }
  }
  // Durchladen: Schlitten / Spannhebel nach hinten ziehen (metallisches Schaben) und loslassen (Tschak!)
  cockBack() { if (this.sample('slide_back', 0.9)) return; this.noise(0.12, 2600, 3, 0.3, 'bandpass', 1600); this.tone(900, 600, 0.04, 0.15, 'square'); }
  cockRelease() { if (this.sample('slide_fwd', 1, { plasma: 0.15 })) { this.zap(0.2, 0.12); return; } this.tone(1400, 800, 0.03, 0.35, 'square'); this.noise(0.05, 3000, 2, 0.5, 'bandpass'); this.tone(200, 90, 0.08, 0.4, 'sine'); }
  // "Schusch": ein Schuss fliegt knapp an dir vorbei. pan = von welcher Seite (−1 links … +1 rechts)
  whoosh(vol, pan) {
    const ctx = this.ctx; if (!ctx || vol < 0.03) return;
    const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.6;
    f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3400, t + 0.11); f.frequency.exponentialRampToValueAtTime(450, t + 0.32);   // kommt näher … und weg
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.8 * vol, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    src.connect(f).connect(g);
    // keine Links/Rechts-Verteilung: unter Wasser scheint jedes Geräusch von überall zu kommen
    g.connect(this.uw);
    src.start(t, Math.random()); src.stop(t + 0.38);
    this.tone(1100, 520, 0.28, 0.05 * vol, 'sine');   // leises Pfeifen mit Doppler-Effekt (Ton fällt, wenn es vorbei ist)
  }
  // ---------- Magazin wechseln ----------
  magOut() { if (this.sample('mag_out', 0.9)) return; this.tone(1500, 1100, 0.03, 0.22, 'square'); this.noise(0.12, 1800, 2, 0.25, 'bandpass', 900, 0.02); }          // Klick – Magazin löst sich und rutscht raus
  stow() {                                                                                                                       // ins Rucksack-Fach stecken, Kompressor zischt kurz
    this.noise(0.18, 700, 1, 0.22, 'lowpass', 300); this.tone(220, 120, 0.08, 0.25, 'square', 0.1);
    this.noise(0.35, 5000, 1, 0.08, 'highpass', 0, 0.15);
  }
  magGrab() { this.noise(0.1, 900, 1, 0.18, 'lowpass', 400); this.tone(900, 700, 0.03, 0.12, 'square', 0.05); }                // neues Magazin aus dem Fach ziehen
  magIn(w = 0) { if (this.sample(w === 0 ? 'mag_in' : 'mag_in_rifle', 1)) return; this.tone(260, 110, 0.07, 0.5, 'square'); this.noise(0.05, 2400, 2, 0.45, 'bandpass'); this.tone(1700, 1300, 0.025, 0.2, 'square', 0.04); }   // Klack!
  ready() { this.noise(0.25, 4500, 1, 0.14, 'highpass', 0); this.tone(1900, 2100, 0.05, 0.12, 'triangle', 0.05); }            // Pssst – Druck liegt an, bereit
  // Schild zerbricht: wie Glas – viele kurze helle Splitter, fallende Glas-Töne und ein dumpfer Schlag
  shieldBreak(vol = 1) {
    this.tone(220, 60, 0.25, 0.5 * vol, 'sine');                               // dumpfer Schlag
    this.noise(0.08, 2500, 0.8, 0.6 * vol, 'highpass');                        // Krach
    for (let i = 0; i < 14; i++) {                                             // Splitter
      const at = Math.random() * 0.3, fr = 3000 + Math.random() * 6000;
      this.noise(0.03 + Math.random() * 0.05, fr, 8, (0.25 + Math.random() * 0.2) * vol, 'bandpass', fr * 0.8, at);
    }
    for (const [f0, at] of [[2600, 0], [3300, 0.04], [2100, 0.09], [2900, 0.15]]) this.tone(f0, f0 * 0.55, 0.35, 0.09 * vol, 'triangle', at);   // klirrende Töne
    this.tone(880, 330, 0.5, 0.12 * vol, 'sine', 0.05);                        // "Schild weg"-Ton, nach unten
  }
  // "Ahhr!" wenn man getroffen wird: eine Stimme besteht aus einem Grundton (Stimmbänder) und zwei
  // Resonanzen (Formanten) im Mund. 700 Hz und 1150 Hz klingen wie ein "a". Unter Wasser klingt alles dumpfer (Tiefpass).
  grunt(deep = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, dur = 0.38 + Math.random() * 0.12, f0 = (125 + Math.random() * 40) / deep;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 1.25, t); o.frequency.linearRampToValueAtTime(f0, t + 0.08); o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + dur);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 9; vg.gain.value = f0 * 0.04; vib.connect(vg).connect(o.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    for (const [fr, q, v] of [[700 / deep, 5, 1], [1150 / deep, 7, 0.6], [2500, 6, 0.15]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q;
      const bg = ctx.createGain(); bg.gain.value = v;
      o.connect(bp).connect(bg).connect(lp);
    }
    lp.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05); vib.start(t); vib.stop(t + dur + 0.05);
    this.noise(0.15, 1200, 0.8, 0.12, 'bandpass', 600);   // Luft beim Ausatmen
  }
  // ---------- Atmen durch den Lungenautomaten ----------
  // Einatmen: das Ventil öffnet und Luft zischt durch (wird lauter und wieder leiser)
  // rate = Atemtempo (1 = ruhig, größer = schneller): dann ist jeder Atemzug kürzer
  inhale(vol = 1, rate = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, dur = 1.05 / Math.pow(rate, 0.8), src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(1800, t); f.frequency.linearRampToValueAtTime(2600, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.13 * vol, t + 0.25); g.gain.linearRampToValueAtTime(0.1 * vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    this.tone(2900, 3100, 0.05, 0.03 * vol, 'sine');   // leises Klicken des Ventils
  }
  // Ausatmen: dumpfes Blubbern, die Blasen steigen aus dem Ventil
  exhale(vol = 1, rate = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, dur = 1.1 / Math.pow(rate, 0.8), src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.32 * vol, t + 0.12); g.gain.linearRampToValueAtTime(0.001, t + dur);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(), wob = ctx.createGain(); lfo.frequency.value = 11; lg.gain.value = 0.6; wob.gain.value = 1; lfo.connect(lg).connect(wob.gain);
    src.connect(f).connect(wob).connect(g).connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
    for (let i = 0; i < 9; i++) { const at = Math.random() * dur * 0.8, p = 140 + Math.random() * 260; this.tone(p, p * 2, 0.05, 0.08 * vol, 'sine', at); }
  }
  // ---------- Finisher: Triton beschwört einen Fischschwarm ----------
  summon() {   // magisches Glitzern, das nach oben steigt
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f * 1.01, 0.5, 0.12, 'triangle', i * 0.07));
    this.noise(0.8, 2000, 1, 0.12, 'bandpass', 6000);
  }
  swarm(dur = 1) {   // Rauschen von hunderten Flossen, das anschwillt
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.45, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(), wob = ctx.createGain(); lfo.frequency.value = 22; lg.gain.value = 0.4; wob.gain.value = 1; lfo.connect(lg).connect(wob.gain);
    src.connect(f).connect(wob).connect(g).connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  // ---------- Finisher: Bollwerks Minigun ----------
  spin(up, dur) {    // der Motor dreht hoch (up = true) oder runter
    this.tone(up ? 80 : 900, up ? 900 : 60, dur, 0.18, 'sawtooth');
    this.noise(dur, up ? 300 : 1500, 2, 0.15, 'bandpass', up ? 1500 : 200);
  }
  minigun(dur) {     // schnelles Rattern: viele kurze Schüsse hintereinander
    const n = Math.round(dur * 28);
    for (let i = 0; i < n; i++) { const at = i / 28; this.tone(140, 45, 0.05, 0.4, 'sine', at); this.noise(0.03, 2200, 1.4, 0.35, 'bandpass', 900, at); }
    this.tone(900, 900, dur, 0.06, 'sawtooth');   // Motor läuft weiter
  }
  // ---------- Finisher: Goliath packt und wirft ----------
  grab() { this.tone(160, 90, 0.2, 0.6, 'square'); this.noise(0.15, 600, 1, 0.5, 'lowpass', 200); this.tone(1800, 1200, 0.06, 0.15, 'square', 0.03); }
  hurl() { this.noise(0.6, 400, 1.2, 0.6, 'bandpass', 2500); this.tone(120, 40, 0.4, 0.5, 'sine'); }
  zoneZap() { this.noise(0.9, 3000, 4, 0.4, 'bandpass', 600); this.tone(70, 35, 0.8, 0.5, 'sawtooth'); this.tone(1300, 200, 0.5, 0.12, 'square'); }
  // Finisher-Sounds
  knife() { this.noise(0.12, 5000, 3, 0.45, 'bandpass', 9000); this.tone(3000, 5200, 0.08, 0.06, 'triangle'); }           // "Schhk"
  hoseCut() {                                                                                                              // Luft entweicht zischend und blubbernd
    this.noise(1.2, 2500, 1.2, 0.45, 'bandpass', 700, 0.03);
    for (let i = 0; i < 14; i++) { const at = 0.05 + Math.random() * 1.1, p = 160 + Math.random() * 300; this.tone(p, p * 2.4, 0.06, 0.16, 'sine', at); }
  }
  headshot() { this.tone(2600, 2400, 0.35, 0.22, 'sine'); this.tone(3900, 3700, 0.25, 0.1, 'sine'); this.noise(0.05, 3000, 1, 0.6, 'highpass'); this.tone(160, 40, 0.25, 0.7, 'sine'); }
  punch() { this.tone(130, 40, 0.22, 0.9, 'sine'); this.noise(0.09, 900, 1.2, 0.7, 'lowpass', 150); this.noise(0.03, 3000, 2, 0.35, 'bandpass'); }
  slam() { this.tone(90, 25, 0.6, 1, 'sine'); this.tone(240, 50, 0.3, 0.5, 'square'); this.noise(0.8, 500, 0.7, 0.8, 'lowpass', 60); this.noise(0.06, 2200, 1, 0.5, 'bandpass'); }
  hit(vol) {
    this.tone(2100, 1500, 0.012, 0.35 * vol, 'square');                          // Klatsch / Knack
    this.noise(0.03, 2600, 2, 0.4 * vol, 'bandpass');
    this.noise(0.28, 4500, 1.2, 0.16 * vol, 'bandpass', 1800, 0.025);            // Zischen der Blasenspur
  }
  hitmark(kill) { this.tone(kill ? 1300 : 950, kill ? 1900 : 950, kill ? 0.22 : 0.05, 0.22, 'triangle'); }
  // far = Lautstärke der tiefen Teile (tragen sehr weit), near = Lautstärke des Klicks (nur in der Nähe)
  boom(far, near = far) {
    if (far < 0.01) return;
    if (near > 0.02) { this.tone(3200, 1800, 0.02, 0.8 * near, 'square'); this.noise(0.03, 4000, 2, 0.9 * near, 'bandpass'); }   // hartes metallisches Klick (Stoßwelle)
    this.tone(58, 16, 1.6, 1.3 * far, 'sine');                              // tiefes Grollen
    this.noise(2.0, 260, 0.7, 1.0 * far, 'lowpass', 30, 0.02);              // Rumpeln
    for (const [at, v] of [[0.32, 0.7], [0.58, 0.4]]) {                     // Nachschläge: die Gasblase zieht sich zusammen und dehnt sich wieder
      this.tone(48, 22, 0.35, v * far, 'sine', at); this.noise(0.3, 200, 0.7, v * 0.7 * far, 'lowpass', 40, at);
      if (near > 0.02) this.tone(2400, 1600, 0.015, v * 0.4 * near, 'square', at);
    }
    for (let i = 0; i < 14; i++) { const at = 0.7 + Math.random() * 1.2, p = 70 + Math.random() * 160; this.tone(p, p * 2, 0.12, 0.22 * far, 'sine', at); }   // Gasblasen blubbern hoch
  }
  // ---------- Dauer-Geräusche (laufen, solange etwas passiert) ----------
  // Torpedo: hohes, sirrendes Heulen + Zischen (Kavitation). Gibt { set(lautstärke), stop() } zurück.
  torpedoWhine() {
    const ctx = this.ctx; if (!ctx) return null;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 1350 + Math.random() * 150;
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 23; vg.gain.value = 18; vib.connect(vg).connect(o.frequency);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 5;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 3000; const ng = ctx.createGain(); ng.gain.value = 0.35;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(bp).connect(g); n.connect(nf).connect(ng).connect(g); g.connect(this.uw);
    o.start(); vib.start(); n.start(0, Math.random());
    return {
      set: (v) => g.gain.setTargetAtTime(Math.max(0, v) * 0.22, ctx.currentTime, 0.05),
      stop: () => { const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, 0.04); o.stop(t + 0.3); vib.stop(t + 0.3); n.stop(t + 0.3); },
    };
  }
  // Schiffsschraube des U-Boots: rhythmisches Wummern + Rauschen/Zischen. level 0…1 (aus … volle Fahrt)
  engine(level) {
    const ctx = this.ctx; if (!ctx) return;
    if (!this.eng) {
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280;
      const thump = ctx.createGain(); thump.gain.value = 0.5;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 4; lg.gain.value = 0.5; lfo.connect(lg).connect(thump.gain);   // Wummern im Takt der Schraube
      const hiss = ctx.createBiquadFilter(); hiss.type = 'bandpass'; hiss.frequency.value = 2200; hiss.Q.value = 0.8; const hg = ctx.createGain(); hg.gain.value = 0.2;
      const g = ctx.createGain(); g.gain.value = 0;
      n.connect(lp).connect(thump).connect(g); n.connect(hiss).connect(hg).connect(g); g.connect(this.uw);
      n.start(); lfo.start();
      this.eng = { g, lfo, hg };
    }
    const t = ctx.currentTime, L = Math.max(0, Math.min(1, level));
    this.eng.g.gain.setTargetAtTime(L * 0.55, t, 0.2);
    this.eng.lfo.frequency.setTargetAtTime(2 + L * 7, t, 0.3);          // schneller drehende Schraube
    this.eng.hg.gain.setTargetAtTime(0.1 + L * L * 0.4, t, 0.3);         // bei voller Fahrt zischt es (Kavitation)
  }
  // Sonar: heller, durchdringender Ping, der im Rumpf nachhallt
  sonar() {
    this.tone(1480, 1460, 0.9, 0.28, 'sine');
    this.tone(2960, 2930, 0.4, 0.06, 'sine');
    for (const [at, v] of [[0.11, 0.12], [0.23, 0.07], [0.37, 0.04]]) this.tone(1480, 1450, 0.6, v, 'sine', at);   // Nachhall im Rumpf
  }
  hurt() { this.tone(180, 70, 0.18, 0.45, 'sawtooth'); }
  bite(vol) { this.noise(0.16, 300, 1, 0.8 * vol, 'lowpass', 90); this.tone(240, 60, 0.2, 0.4 * vol, 'square'); }
  pickup() { this.tone(660, 990, 0.09, 0.2, 'triangle'); setTimeout(() => this.tone(990, 1320, 0.1, 0.18, 'triangle'), 70); }
  ping() { this.tone(1250, 1180, 1.1, 0.22, 'sine'); }
  shock() { this.noise(0.25, 3200, 6, 0.4, 'bandpass', 1200); }
  crate() { this.noise(0.3, 500, 1, 0.4, 'lowpass', 1500); this.tone(330, 660, 0.25, 0.2, 'triangle'); }
}
