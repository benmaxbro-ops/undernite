# Undernite

Battle Royale unter Wasser – 3D, Third-Person, läuft im Browser.
Ein kleiner Node.js-Server auf dem Windows-PC hostet das Spiel für alle Geräte im Heimnetz
und füllt freie Plätze mit Bots auf.

## Starten (Windows)

1. Einmalig [Node.js LTS](https://nodejs.org) installieren (oder `winget install OpenJS.NodeJS.LTS`).
2. Repo klonen (oder als ZIP laden und entpacken), `start.bat` doppelklicken. Der Browser öffnet sich auf `http://localhost:8080`.
3. Mitspieler im selben WLAN/LAN öffnen die Adresse, die im Serverfenster und in der Lobby
   unter „Mitspieler im Heimnetz“ steht (z. B. `http://192.168.x.y:8080`).
   Beim ersten Start fragt die Windows-Firewall nach – für **private Netzwerke** zulassen.

Beim ersten Start installiert `start.bat` einmalig die einzige Abhängigkeit (`ws`) per `npm install`.
Danach läuft alles offline; three.js liegt unter `public/vendor/` bei.
Anderer Port: `set PORT=9000` vor `node server.js`.

## Steuerung

| Taste | Aktion |
|---|---|
| W A S D | schwimmen (in Blickrichtung, volle 3D-Bewegung) |
| Maus | zielen / umsehen |
| Leertaste / C | auftauchen / abtauchen |
| Shift | Schub (verbraucht Energie) |
| Linksklick | feuern |
| 1 2 3 / Mausrad | Waffe wechseln |
| R | nachladen |
| E | Truhe öffnen, Waffe aufheben/tauschen, Fahrzeug ein-/aussteigen |
| F | aus dem Oktopusgriff befreien (hämmern) |

## Was drin ist (v0.1)

- **Runde:** Absprung von der Oberfläche, Ausrüstung suchen, das *Schwarzwasser* (die Zone) zieht sich in
  sechs Phasen zusammen, der Letzte gewinnt. Dauer ca. 5 Minuten.
- **Anzüge:** Manta (klein, schnell, 70 LP) · Triton (Allrounder, 100 LP) · Bollwerk (Panzeranzug, 150 LP) ·
  Goliath (Mech, 240 LP, +12 % Schaden, passt in kein Fahrzeug, Oktopusse können ihn nicht halten).
- **Waffen:** Bolzenpistole, Nadler, Splitterwerfer, Harpune, Torpedowerfer – jeweils in vier Seltenheitsstufen.
- **Fahrzeuge:** U-Scooter (schnell, Fahrer ungeschützt) und Mini-U-Boot (450 Rumpfpunkte, Bordtorpedos).
- **Raubtiere:** Haie wittern Verletzte aus großer Entfernung und greifen im Vorbeischwimmen an,
  Oktopusse lauern an Wrack, Ruinen und Riffen, packen zu und vernebeln die Sicht, Quallenschwärme
  verteilen Stromschläge. Alle lassen sich erlegen und hinterlassen Beute.
- **Welt:** bei jeder Runde neu erzeugt – Graben, Seeberg, Wrack, Ruinen, Kelpwälder, Korallenriffe.

## Aufbau

```
server.js            Node-Server: liefert public/ aus und simuliert das Spiel (20 Hz, autoritativ)
public/js/shared.js  Regeln, Werte und deterministische Welterzeugung (Server und Client)
public/js/main.js    Client: Netzwerk, Eingabe, Kamera, Entity-Sync
public/js/world.js   Meeresboden, Flora, Wasser, Partikel, Zonenwand
public/js/models.js  prozedurale Modelle (Taucher, Mech, U-Boot, Hai, Oktopus …)
public/js/hud.js     HUD, Lobby, Ergebnis
public/js/audio.js   synthetische Sounds (WebAudio)
```

Balance-Werte (Leben, Tempo, Waffen, Zonenphasen) stehen oben in `shared.js` bzw. `server.js` (`PHASES`).
`node test-sim.mjs` spielt bei laufendem Server eine Runde als Testclient durch
(`UN_SPEED=25` am Server = Zeitraffer).
