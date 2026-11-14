// Undernite - DOM based HUD, lobby and result screen.
import { SUITS, SUIT_ORDER, WEAPONS, RARITY, HALF } from './shared.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

export class Hud {
  constructor() {
    this.last = {};
    this.mini = $('mini').getContext('2d');
    this.slots = [];
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('div'); d.className = 'slot';
      d.innerHTML = `<div class="k">${i + 1}</div><div class="n">–</div><div class="a"></div><div class="rl"><i></i></div>`;
      $('slots').appendChild(d);
      this.slots.push({ d, n: d.children[1], a: d.children[2], rl: d.children[3].firstChild });
    }
    this.bannerT = 0;
  }
  set(id, prop, v) { const k = id + prop; if (this.last[k] === v) return; this.last[k] = v; const el = $(id); if (prop === 'text') el.textContent = v; else if (prop === 'html') el.innerHTML = v; else el.style[prop] = v; }

  // ----- lobby -----
  buildLobby(cb) {
    const name = $('name');
    name.value = localStorage.getItem('un_name') || '';
    name.addEventListener('input', () => { localStorage.setItem('un_name', name.value); cb({ name: name.value }); });
    const suits = $('suits'); let cur = localStorage.getItem('un_suit'); if (!SUITS[cur]) cur = 'triton';
    for (const id of SUIT_ORDER) {
      const S = SUITS[id], b = document.createElement('button');
      b.className = 'suit' + (id === cur ? ' on' : ''); b.dataset.id = id;
      const st = (l, v) => `<div class="stat">${l}<i><u style="width:${Math.round(v * 100)}%"></u></i></div>`;
      b.innerHTML = `<b>${S.name}</b><small>${S.desc}</small>${st('Tempo', S.speed / 13.5)}${st('Panzer', S.hp / 240)}${st('Wendig', 1 - (S.r - 0.6) / 1.6)}`;
      b.addEventListener('click', () => {
        suits.querySelectorAll('.suit').forEach(x => x.classList.toggle('on', x === b));
        localStorage.setItem('un_suit', id); cb({ suit: id });
      });
      suits.appendChild(b);
    }
    $('bots').addEventListener('input', (e) => { $('botsN').textContent = e.target.value; cb({ bots: +e.target.value }); });
    $('go').addEventListener('click', () => cb({ start: true }));
    return { name: name.value, suit: cur };
  }
  setLobby(m, myId) {
    $('plist').innerHTML = m.players.map(p => `<li><span>${esc(p.name)}${p.id === myId ? ' <small>(du)</small>' : ''}</span><small>${SUITS[p.suit].name}</small></li>`).join('')
      + `<li><span><small>+ ${m.bots} Bots</small></span></li>`;
    if (document.activeElement !== $('bots')) { $('bots').value = m.bots; $('botsN').textContent = m.bots; }
    $('lan').innerHTML = m.urls && m.urls.length
      ? `<b>Mitspieler im Heimnetz</b> öffnen im Browser:<br>${m.urls.map(u => `<code>${esc(u)}</code>`).join('<br>')}`
      : 'Kein Netzwerk gefunden – Solo-Runde gegen Bots.';
  }
  show(which) {
    $('lobby').classList.toggle('hidden', which !== 'lobby');
    $('hud').classList.toggle('hidden', which !== 'game');
    $('end').classList.toggle('hidden', which !== 'end');
    if (which !== 'game') $('pause').classList.add('hidden');
  }
  end(m, myId) {
    const mine = m.rank.find(r => r.id === myId);
    $('endTitle').innerHTML = mine && mine.place === 1 ? 'SIEG<span>!</span>' : 'AUFGE<span>TAUCHT</span>';
    $('endPlace').textContent = mine ? `PLATZ ${mine.place} VON ${m.total} · ${mine.k} KILLS` : `SIEGER: ${m.rank[0] ? m.rank[0].n : '–'}`;
    $('rank').innerHTML = m.rank.slice(0, 8).map(r => `<div class="${r.id === myId ? 'me' : ''}"><span class="num">${r.place}.</span><span>${esc(r.n)} <small>${SUITS[r.suit].name}${r.bot ? ' · Bot' : ''}</small></span><span class="num">${r.k} Kills</span></div>`).join('');
  }

  // ----- in game -----
  update(s) {
    const y = s.you;
    if (y) {
      this.set('hpFill', 'width', Math.max(0, y.hp / y.mhp * 100) + '%'); this.set('hpTxt', 'text', y.hp + ' / ' + y.mhp);
      this.set('shFill', 'width', y.sh + '%'); this.set('shTxt', 'text', y.sh ? String(y.sh) : '');
      this.set('enFill', 'width', s.energy + '%');
      this.set('kills', 'text', String(y.kills));
      this.set('suitName', 'text', SUITS[s.suit].name);
      $('vehBar').classList.toggle('on', !!y.vhp);
      if (y.vhp) { this.set('vhFill', 'width', y.vhp / 450 * 100 + '%'); this.set('vhTxt', 'text', 'Rumpf ' + y.vhp); }
      for (let i = 0; i < 3; i++) {
        const w = y.w[i], sl = this.slots[i], key = w ? w.join() + (y.slot === i) + Math.round(y.rl * 10) : 'x' + (y.slot === i);
        if (sl.key === key) continue; sl.key = key;
        sl.d.classList.toggle('on', y.slot === i);
        if (w) {
          const def = WEAPONS[w[0]];
          sl.n.textContent = def.name; sl.d.style.setProperty('--rar', RARITY[w[1]].color);
          sl.a.innerHTML = y.slot === i && y.rl > 0 ? 'lädt nach …' : `<b class="num">${w[2]}</b> / ${def.mag}`;
          sl.rl.style.width = y.slot === i && y.rl > 0 ? (1 - y.rl / y.rlT) * 100 + '%' : '0';
        } else { sl.n.textContent = '–'; sl.a.textContent = 'leer'; sl.d.style.setProperty('--rar', '#35424b'); sl.rl.style.width = '0'; }
      }
      this.set('ink', 'opacity', y.ink > 0 ? Math.min(1, y.ink / 0.8) : 0);
    }
    this.set('alive', 'text', String(s.alive));
    this.set('depth', 'text', `TIEFE ${Math.round(s.depth)} m`);
    const z = s.zone;
    if (z) {
      const txt = z[5] <= 0 && !z[8] ? 'Schwarzwasser überall – letzter Kampf!' : z[8] ? `Schwarzwasser rückt vor · ${mmss(z[7])}` : `Schwarzwasser kommt in ${mmss(z[7])}`;
      this.set('zoneTxt', 'text', txt); $('zoneTxt').classList.toggle('hot', !!z[8]);
    }
    this.set('zoneTint', 'opacity', s.outside ? 1 : 0);
    if (this.bannerT > 0 && (this.bannerT -= s.dt) <= 0) $('banner').classList.remove('on');
    this.vign = Math.max(0, (this.vign || 0) - s.dt * 1.6);
    const low = y && y.alive && y.hp < y.mhp * 0.3 ? 0.35 + 0.15 * Math.sin(s.time * 6) : 0;
    $('vign').style.opacity = Math.max(this.vign, low);
  }
  drawMini(base, zone, me, vehicles, pois) {
    const c = this.mini, n = 190, k = n / (HALF * 2), px = (x) => (x + HALF) * k;
    c.drawImage(base, 0, 0, n, n);
    c.font = '10px Bahnschrift, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(230,251,255,.75)';
    for (const p of pois) c.fillText(p.n, px(p.x), px(p.z) - 5);
    if (zone) {
      if (zone[5] > 0) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.setLineDash([4, 4]); c.lineWidth = 1.2; c.beginPath(); c.arc(px(zone[3]), px(zone[4]), zone[5] * k, 0, 7); c.stroke(); c.setLineDash([]); }
      c.fillStyle = 'rgba(120,40,220,.42)'; const zr = Math.max(0, zone[2] * k); c.beginPath(); c.rect(0, 0, n, n); c.moveTo(px(zone[0]) + zr, px(zone[1])); c.arc(px(zone[0]), px(zone[1]), zr, 0, Math.PI * 2); c.closePath(); c.fill('evenodd');
      c.strokeStyle = '#c58bff'; c.lineWidth = 1.6; c.beginPath(); c.arc(px(zone[0]), px(zone[1]), Math.max(0, zone[2] * k), 0, 7); c.stroke();
    }
    c.fillStyle = '#ffc94d';
    for (const v of vehicles) if (!v.driver) { const s = v.type === 'sub' ? 5 : 3; c.fillRect(px(v.x) - s / 2, px(v.z) - s / 2, s, s); }
    c.save(); c.translate(px(me.x), px(me.z)); c.rotate(-me.yaw);
    c.fillStyle = '#5ef2e0'; c.strokeStyle = '#03222a'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }
  feed(html, me) {
    const d = document.createElement('div'); d.innerHTML = html; if (me) d.className = 'me';
    const f = $('feed'); f.prepend(d); while (f.children.length > 6) f.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  }
  banner(text, dur = 2.6) { const b = $('banner'); b.textContent = text; b.classList.add('on'); this.bannerT = dur; }
  prompt(p) { const el = $('prompt'), key = p ? p.join() : ''; if (this.pKey === key) return; this.pKey = key; el.classList.toggle('hidden', !p); if (p) el.innerHTML = `<kbd>${p[0]}</kbd>${esc(p[1])}`; }
  hitmark(dmg, kill) {
    const h = $('hitm'); h.classList.remove('on'); h.classList.toggle('kill', !!kill); void h.offsetWidth; h.classList.add('on');
    const d = $('dmgNum'); d.textContent = dmg; d.classList.remove('on'); void d.offsetWidth; d.classList.add('on');
  }
  hurt(rel) {
    this.vign = 0.9;
    if (rel === null) return;
    const i = document.createElement('i'); i.style.transform = `rotate(${rel}rad)`; $('dirs').appendChild(i); setTimeout(() => i.remove(), 1100);
  }
  shock() { const s = $('shockFx'); s.style.opacity = 1; setTimeout(() => { s.style.opacity = 0; }, 180); }
  spec(html) { const el = $('spec'); el.classList.toggle('hidden', !html); if (html && this.sKey !== html) { this.sKey = html; el.innerHTML = html; } }
  pause(on) { $('pause').classList.toggle('hidden', !on); }
  conn(lost) { $('conn').classList.toggle('hidden', !lost); }
}
