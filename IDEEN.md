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
- [x] **3b. Startwaffen** kaufen und im Ausrüstungs-Fenster aussuchen
- [ ] **4. Verbesserungen** (jeweils 3 Stufen):
  - [x] schneller nachladen (Schnellladen)
  - [x] weniger Rückstoß (Rückstoßdämpfer)
  - [x] ruhigeres Zielfernrohr (Ruhiges Visier)
  - [x] schneller schwimmen (Profi-Flossen)
  - [x] besserer Kompressor (Turbo-Kompressor)
  - [ ] Waffe schneller ziehen
  - [ ] mehr Leben
- [x] **5. Waffen-Aufsätze:** Leuchtpunkt-Visier, Zielfernrohr, großes Magazin, Trommelmagazin, Kompensator, Würgebohrung, Laservisier, Druck-Verstärker
- [x] **Neue Waffen:** Bolzen-Revolver, Netzwerfer, Stachel-MG, Magnet-Gewehr (legt den Mech 3,5 s lahm)
- [x] **Magnet-Gewehr für alle außer Goliath**, nur 2 Schuss; Nachladen = Magnet vom Rücken holen und vorne aufsetzen
- [x] **Alle Nachlade-Animationen prüfen und überarbeiten** (Revolver: Trommel klappt raus, neue Trommel rein, zuschlagen)
- [x] **6. 8 Taucher:** Zu Manta, Triton, Bollwerk und Goliath kommen 4 neue, jeder mit einer Spezialfähigkeit:
  - [x] **Sepia:** Tintenflucht
  - [x] **Barrakuda:** Sprinter
  - [x] **Nautilus:** Techniker, Kompressor schneller
  - [x] **Hammerhai:** Elektrosinn, Gegner auf der Minikarte
- [x] **7. Gadgets:** je eins pro Taucher (Taste Q): Haiköder, Sonar-Boje, Schild-Generator, Bodenstampfer, Tintenbombe, Seilharpune, Geschütz-Drohne, Elektroschocker
- [x] **Ausrüstungs-Fenster pro Taucher** vor der Runde: Startwaffe und Gadget (Aufsätze folgen)
- [x] **Mech realistischer:** wie echte Unterwasserroboter (Videos, Sounds), Roboterarme in der Ego-Sicht, Sicht wie hinter einer Glaskuppel mit Licht innen
- [ ] **Arme und Hände weniger klobig** (nicht so zylindermäßig), Vorbild Call of Duty
- [ ] **8. Neue Fahrzeuge:** schneller Jetski-Scooter, Kampf-Mech, Torpedo-Rochen
- [ ] **9. Handy-Steuerung:** Joystick und Knöpfe auf dem Bildschirm

## Reihenfolge (Ben, 16.11.): 4 neue Taucher → Gadgets für alle 8 + Ausrüstungs-Fenster pro Taucher vor der Runde → Waffen-Aufsätze je Waffe + neue Waffen → Stabwaffen + schönere Waffen → Brustschwimmen

## Realistischer wie im Video „Bodycam“ (Wünsche vom 16.11.)

Vorbild: das Spiel „Bodycam“ (YouTube: „Das ist nicht echt! - Das ist Bodycam!“). Alles umgesetzt für unter Wasser.

- [x] **Bodycam-Look:** Bild am Rand gewölbt (Fischauge), dunkler runder Rand wie eine Taucherbrille, rot-blaue Farbsäume
- [ ] **Rückstoß wie im Video:** Waffe und Kamera reißen zusammen hoch, aber das Wasser bremst. Gasblase statt Patronenhülse. (teilweise: Nachschwingen ist drin)
- [ ] **Flüssiger schwimmen:** weniger stockig und eckig, weichere Bewegungen
- [x] **Hände sehen:** beim Schwimmen die Hände vorne, wie beim Brustschwimmen
- [ ] **Waffe wegstecken** können (bisher nur zwangsweise bei Überhitzung, nicht selbst per Taste)
- [x] **Große Waffen mit beiden Händen halten:** eine Hand vorne, eine hinten, mehr in der Mitte vom Bildschirm
- [x] **Battle Royale viel heller:** statt leuchtendem Boden leuchtende Riff-Adern über die ganze Karte (so wolltest du es)
- [ ] **Getroffener Gegner:** sackt zusammen und sinkt, Waffe fällt langsam zum Boden, dunkle Wolke im Wasser
- [ ] **Selbst sterben:** Bild wird langsam dunkler, dann ganz schwarz, dann ein „Du bist tot“-Bildschirm.
      Von da aus: neue Klasse (Taucher) aussuchen oder in den Shop gehen.

- [x] **Deckung mit C** (nur Triton und Manta): am Riff-Hügel festhalten. Bollwerk und Goliath sinken mit C nur ab.
- [x] **Löcher im Riff**, in denen man stecken bleibt, reparieren (bessere Kollision + Notausgang zum nächsten freien Platz)
- [x] **Finisher** sauberer: Kamerafahrt mit Kinobalken und Zoom, Zeitlupe beim Treffer, flüssige Bewegungen, Manta schleicht im Bogen, ein Mech als Opfer bricht auseinander
- [x] **Schüsse von anderen**: dumpfer Schlag wie gegen eine Holztür, großes Kaliber dumpfer
- [x] **Nadler**: längere Lade-/Schockwellen-Zeit
- [x] **Sichtbare Schockwelle** aus Mündung und Seitenkiemen (shock.js) – kommt jetzt beim Hitze-Ablassen
- [x] **Hitze-System:** Hitze sammelt sich beim Schießen, kommt nach dem Aufhören auf einen Schlag raus (Schallwelle mit Wumms); zu viel → verbrennen, „Ah!“, benommen, Waffe 2 s wegstecken
- [x] **Schüsse wie Schlag gegen Holztür** (echte CC0-Aufnahme, tiefer, mit Wasser-Echo, weit hörbar)
- [x] **Bodycam-Linse** (lens.js)
- [x] **Kimme und Korn leuchten** (grüne Leuchtpunkte)
- [x] **Pistole beidhändig unten in der Mitte**, Waffe schwingt beim Drehen nach, Helmlampe beleuchtet die Hände
- [ ] **Ulti für jede Klasse (Taste 4):**
  - [ ] Manta: Zeitlupe wie in Matrix, weicht jeder Kugel aus
  - [ ] Goliath: kurz automatisches Zielen (gleich viele Schüsse nötig, nur ohne Zielen)
  - [ ] Triton und Bollwerk: noch ausdenken
- [ ] **Schuss-Richtungsanzeige:** kleiner Ring in der Mitte, ein Pfeil zeigt, woher geschossen wird
- [ ] **Grafik so realistisch wie möglich:** ✔ 1. Bodycam-Linse, ✔ 2. Unterwasser-Licht (Farben verschwinden mit der Tiefe,
      Lichtstrahlen, Meeresschnee), 3. Tiefenschärfe + Bewegungsunschärfe, 4. bessere Oberflächen, 5. Bodycam-Animationen, 6. bessere Taucher
- [ ] **Treffer-Sound:** wie eine Kugel, die richtig durchschlägt (im Internet recherchieren)
- [ ] **Vorbeifliegende Kugeln:** deutliches „Schwusch“

- [x] **Stabwaffen:** Dreizack, Elektro-Speer, Kampfstab (Beute oder Startwaffe)
- [x] **Waffen schöner und realistischer:** taktische Farben (Graphit, Stahl, Gummi), Metall spiegelt die Umgebung (Farben in GUN_LOOK, models.js)
- [x] **Brustschwimmen** mit Händen in der Ego-Sicht (Werte: SWIM in main.js, Bewegung: SWIM_KEYS in models.js)
- [ ] **Sonar-Radar statt Minikarte:** grüner Strahl dreht sich langsam, Gelände und Spieler leuchten kurz auf, wenn er drüberstreicht

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
