// Undernite - tiny synthesised sound set (WebAudio, no asset files).
export class Sfx {
  constructor() { this.ctx = null; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(ctx.destination);
    // noise buffer shared by all noise based sounds
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // ambient rumble
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170;
    const g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(lp).connect(g).connect(this.master); src.start();
  }
  noise(dur, freq, q, vol, type = 'bandpass', slide = 0, at = 0) {
    const ctx = this.ctx; if (!ctx || vol <= 0.003) return;
    const t = ctx.currentTime + at, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }
  tone(f0, f1, dur, vol, type = 'sine', at = 0) {
    const ctx = this.ctx; if (!ctx || vol <= 0.003) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  shot(w, vol) {
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
    const big = w === 6 ? 1 : w === 3 ? 0.9 : w === 2 ? 0.75 : w === 0 ? 0.4 : 0.15;   // Plasmalanze, Harpune, Splitterwerfer, Pistole, Nadler
    const dur = 0.1 + big * 0.12, at = 0.055;                          // at = wann der Abschuss kommt (nach dem Aufladen)
    // A) Aufladen
    this.tone(260 + big * 80, 1500 - big * 400, at, (0.1 + big * 0.06) * vol, 'sawtooth');
    this.noise(at, 900, 2, 0.12 * vol, 'bandpass', 3200);
    // B) Abschuss
    this.tone(150 - big * 70, 38, 0.12 + big * 0.1, (0.75 + big * 0.3) * vol, 'sine', at);
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
  }
  // "Schusch": ein Schuss fliegt knapp an dir vorbei. pan = von welcher Seite (−1 links … +1 rechts)
  whoosh(vol, pan) {
    const ctx = this.ctx; if (!ctx || vol < 0.03) return;
    const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.6;
    f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3400, t + 0.11); f.frequency.exponentialRampToValueAtTime(450, t + 0.32);   // kommt näher … und weg
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.8 * vol, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    src.connect(f).connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(this.master); }
    else g.connect(this.master);
    src.start(t, Math.random()); src.stop(t + 0.38);
    this.tone(1100, 520, 0.28, 0.05 * vol, 'sine');   // leises Pfeifen mit Doppler-Effekt (Ton fällt, wenn es vorbei ist)
  }
  // ---------- Magazin wechseln ----------
  magOut() { this.tone(1500, 1100, 0.03, 0.22, 'square'); this.noise(0.12, 1800, 2, 0.25, 'bandpass', 900, 0.02); }          // Klick – Magazin löst sich und rutscht raus
  stow() {                                                                                                                       // ins Rucksack-Fach stecken, Kompressor zischt kurz
    this.noise(0.18, 700, 1, 0.22, 'lowpass', 300); this.tone(220, 120, 0.08, 0.25, 'square', 0.1);
    this.noise(0.35, 5000, 1, 0.08, 'highpass', 0, 0.15);
  }
  magGrab() { this.noise(0.1, 900, 1, 0.18, 'lowpass', 400); this.tone(900, 700, 0.03, 0.12, 'square', 0.05); }                // neues Magazin aus dem Fach ziehen
  magIn() { this.tone(260, 110, 0.07, 0.5, 'square'); this.noise(0.05, 2400, 2, 0.45, 'bandpass'); this.tone(1700, 1300, 0.025, 0.2, 'square', 0.04); }   // Klack!
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
  inhale(vol = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, dur = 1.05, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(1800, t); f.frequency.linearRampToValueAtTime(2600, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.13 * vol, t + 0.25); g.gain.linearRampToValueAtTime(0.1 * vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    this.tone(2900, 3100, 0.05, 0.03 * vol, 'sine');   // leises Klicken des Ventils
  }
  // Ausatmen: dumpfes Blubbern, die Blasen steigen aus dem Ventil
  exhale(vol = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, dur = 1.1, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
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
  hit(vol) { this.noise(0.08, 700, 2, 0.4 * vol, 'bandpass', 250); }
  hitmark(kill) { this.tone(kill ? 1300 : 950, kill ? 1900 : 950, kill ? 0.22 : 0.05, 0.22, 'triangle'); }
  boom(vol) { this.noise(0.9, 400, 0.7, 0.9 * vol, 'lowpass', 50); this.tone(110, 30, 0.7, 0.7 * vol); }
  hurt() { this.tone(180, 70, 0.18, 0.45, 'sawtooth'); }
  bite(vol) { this.noise(0.16, 300, 1, 0.8 * vol, 'lowpass', 90); this.tone(240, 60, 0.2, 0.4 * vol, 'square'); }
  pickup() { this.tone(660, 990, 0.09, 0.2, 'triangle'); setTimeout(() => this.tone(990, 1320, 0.1, 0.18, 'triangle'), 70); }
  ping() { this.tone(1250, 1180, 1.1, 0.22, 'sine'); }
  shock() { this.noise(0.25, 3200, 6, 0.4, 'bandpass', 1200); }
  crate() { this.noise(0.3, 500, 1, 0.4, 'lowpass', 1500); this.tone(330, 660, 0.25, 0.2, 'triangle'); }
}
