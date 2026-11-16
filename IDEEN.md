# Ideen und Plan für Undernite 🌊

Hier steht alles, was wir bauen wollen, auch das, was noch nicht fertig ist.
Wenn ein Schritt fertig ist, wird `[ ]` zu `[x]`.

## Großer Plan: Undernite wird ein richtiges Indie-Game

Ziel: Im **Battle Royale** verdient man Geld und kauft sich damit Verbesserungen, Taucher, Gadgets und Fahrzeuge.
(In der **Tiefsee-Expedition** gibt es schon einen Laden am Boot: Waffen, Flaschen, Atemtraining, Lampen.)

- [x] **1. Grafik fertig + Handy-Stufe:** Bloom, weiche Schatten, Ultra mit Warnung, Handy startet automatisch mit „Handy“-Grafik
- [x] **2. Geld verdienen im Battle Royale:** (heißt jetzt „Perlen“ 🦪) Geld pro Kill, pro überlebter Minute, Bonus für Platz 1, 2 und 3.
      Wird unter deinem Namen gespeichert. Am Rundenende sieht man, wofür man wie viel bekommen hat.
- [x] **3a. Perlen-Shop oben rechts in der Lobby**
- [ ] **3b. Startwaffen** im Shop kaufen und aussuchen, mit welcher man startet
- [ ] **4. Verbesserungen** (jeweils 3 Stufen):
  - [x] schneller nachladen (Schnellladen)
  - [x] weniger Rückstoß (Rückstoßdämpfer)
  - [x] ruhigeres Zielfernrohr (Ruhiges Visier)
  - [x] schneller schwimmen (Profi-Flossen)
  - [x] besserer Kompressor (Turbo-Kompressor)
  - [ ] Waffe schneller ziehen
  - [ ] mehr Leben
- [ ] **5. Waffen-Aufsätze:** Zielfernrohr, größeres Magazin, Mündungsaufsatz gegen Rückstoß, Laservisier …
- [ ] **6. 8 Taucher:** Zu Manta, Triton, Bollwerk und Goliath kommen 4 neue, jeder mit einer Spezialfähigkeit:
  - [ ] **Sepia:** Tarnung mit Tinte
  - [ ] **Barrakuda:** Sprinter
  - [ ] **Nautilus:** Techniker, Gadgets laden schneller
  - [ ] **Hammerhai:** Sonar, sieht Gegner durch Wände
- [ ] **7. Gadgets:** Sonar-Boje, Tintenbombe, Haiköder, Schild-Generator, Seilharpune
- [ ] **8. Neue Fahrzeuge:** schneller Jetski-Scooter, Kampf-Mech, Torpedo-Rochen
- [ ] **9. Handy-Steuerung:** Joystick und Knöpfe auf dem Bildschirm

## Realistischer wie im Video „Bodycam“ (Wünsche vom 16.11.)

Vorbild: das Spiel „Bodycam“ (YouTube: „Das ist nicht echt! - Das ist Bodycam!“). Alles umgesetzt für unter Wasser.

- [ ] **Bodycam-Look:** Bild am Rand gewölbt (Fischauge), dunkler runder Rand wie eine Taucherbrille, rot-blaue Farbsäume
- [ ] **Rückstoß wie im Video:** Waffe und Kamera reißen zusammen hoch, aber das Wasser bremst. Gasblase statt Patronenhülse.
- [ ] **Flüssiger schwimmen:** weniger stockig und eckig, weichere Bewegungen
- [ ] **Hände sehen:** beim Schwimmen ab und zu die Hände vorne, wie beim Brustschwimmen
- [ ] **Waffe wegstecken** können
- [ ] **Große Waffen mit beiden Händen halten:** eine Hand vorne, eine hinten, mehr in der Mitte vom Bildschirm
- [ ] **Battle Royale viel heller:** der Boden soll leuchten, damit man sieht, wo unten ist. Riffe größer und spannender.
- [ ] **Getroffener Gegner:** sackt zusammen und sinkt, Waffe fällt langsam zum Boden, dunkle Wolke im Wasser
- [ ] **Selbst sterben:** Bild wird langsam dunkler, dann ganz schwarz, dann ein „Du bist tot“-Bildschirm.
      Von da aus: neue Klasse (Taucher) aussuchen oder in den Shop gehen.

- [x] **Deckung mit C** (nur Triton und Manta): am Riff-Hügel festhalten. Bollwerk und Goliath sinken mit C nur ab.
- [ ] **Löcher im Riff**, in denen man stecken bleibt, reparieren
- [ ] **Finisher** sauberer (Manta sieht komisch aus; beim Goliath geht der Mech kaputt)
- [ ] **Schüsse von anderen**: dumpfer Schlag wie gegen eine Holztür, großes Kaliber dumpfer
- [ ] **Nadler**: längere Lade-/Schockwellen-Zeit
- [x] **Sichtbare Schockwelle** aus Mündung und Seitenkiemen (shock.js) – kommt jetzt beim Hitze-Ablassen
- [x] **Hitze-System:** zu viel am Stück schießen → verbrennen, „Ah!“, benommen; nach Pause Hitze ablassen
- [x] **Schüsse wie Schlag gegen Holztür** (echte CC0-Aufnahme, tiefer, mit Wasser-Echo, weit hörbar)
- [x] **Bodycam-Linse** (lens.js)
- [ ] **Kimme und Korn leuchten** (wie Leuchtvisiere)
- [ ] **Schuss-Richtungsanzeige:** kleiner Ring in der Mitte, ein Pfeil zeigt, woher geschossen wird
- [ ] **Grafik so realistisch wie möglich:** 1. Bodycam-Linse, 2. Unterwasser-Licht (Farben verschwinden mit der Tiefe,
      Lichtstrahlen, Meeresschnee), 3. Tiefenschärfe + Bewegungsunschärfe, 4. bessere Oberflächen, 5. Bodycam-Animationen, 6. bessere Taucher
- [ ] **Treffer-Sound:** wie eine Kugel, die richtig durchschlägt (im Internet recherchieren)
- [ ] **Vorbeifliegende Kugeln:** deutliches „Schwusch“

## Fairness: Ligen

Gekaufte Upgrades machen **voll stark**. Damit das nicht unfair wird, kommen Spieler nach ihrem
Upgrade-Level in **Ligen 1 bis 4**: Anfänger spielen gegen Anfänger, Profis gegen Profis.
- Jeder Spieler hat ein Level, das sich aus seinen gekauften Upgrades ergibt.
- Der Server lässt mehrere Runden gleichzeitig laufen, eine pro Liga.
- Die Bots in einer Liga sind ähnlich stark ausgerüstet wie die Spieler dort.

(Kommt mit Schritt 2 und 3, weil man dafür erst Geld und Upgrades braucht.)

## Später

- 3D-Modelle, Musik
- Im Internet spielen
- Einführung für neue Spieler
