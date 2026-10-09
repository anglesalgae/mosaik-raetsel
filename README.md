# Mosaik – Fill-a-Pix im Browser

Browser-App zum Anzeigen und Lösen von Mosaik-Rätseln (Fill-a-Pix), geschrieben in TypeScript ohne UI-Framework.

> **Hinweis:** Es dürfen ausschließlich bereinigte Daten verwendet werden – das gilt für geladene Rätsel ebenso wie für Titel, Autorenangaben und gespeicherte Spielstände.

## Schnellstart

```bash
npm install
npm run dev        # Entwicklungsserver mit Hot Reload
npm test           # Unit-Tests (Vitest)
npm run build      # Typprüfung + Produktions-Build nach dist/
npm run preview    # gebauten Stand lokal ansehen
npm run deploy     # veröffentlichen über Firebase Hosting (siehe Anleitung unten)
```

Voraussetzung: Node.js 20 oder neuer.

## Anleitung: Veröffentlichen mit Google (Firebase Hosting)

Mit einem Google-Konto lässt sich die App kostenlos über **Firebase Hosting** ins Internet stellen. Danach ist sie unter einer Adresse wie `https://mosaik-raetsel.web.app` erreichbar – auf dem Computer, Tablet und Handy, ohne Installation.

Die App besteht nach dem Build nur aus wenigen statischen Dateien (rund 100 KB). Firebase liefert diese Dateien lediglich aus; Rätsel, Bilder und Spielstände werden **nie** auf einen Server hochgeladen, sondern bleiben im Browser bzw. landen als Downloads auf dem Gerät.

> **Wichtig:** Die veröffentlichte App ist für jeden erreichbar, der den Link kennt. Verwende ausschließlich bereinigte Daten. Wenn du die App im Rahmen deiner Organisation einsetzt, kläre vorher mit der IT, ob eine Veröffentlichung über ein (privates) Google-Konto zulässig ist.

### Was du brauchst

- ein Google-Konto
- **Node.js 20 oder neuer** (https://nodejs.org – die „LTS“-Version wählen)
- dieses Projekt, entpackt in einen Ordner, z. B. `mosaik`

Ob Node.js installiert ist, prüfst du im Terminal mit `node -v`. Die Ausgabe muss mit `v20` oder höher beginnen.

### Schritt 1: Terminal im Projektordner öffnen

- **Windows:** Im Explorer den Ordner `mosaik` öffnen, in die Adresszeile `cmd` tippen und Enter drücken.
- **macOS:** Programm „Terminal“ öffnen, `cd ` eingeben (mit Leerzeichen), den Ordner `mosaik` ins Fenster ziehen und Enter drücken.
- **Linux:** Im Dateimanager per Rechtsklick „Im Terminal öffnen“.

Alle folgenden Befehle werden in diesem Terminal ausgeführt.

### Schritt 2: Projekt vorbereiten

```bash
npm install
```

Das lädt alle benötigten Werkzeuge herunter, auch die Firebase-Befehle (dauert beim ersten Mal ein bis zwei Minuten). Optional prüfst du danach, ob alles funktioniert:

```bash
npm test
```

### Schritt 3: Firebase-Projekt anlegen

1. https://console.firebase.google.com öffnen und mit dem Google-Konto anmelden.
2. **Projekt erstellen** (bzw. „Projekt hinzufügen“) wählen.
3. Einen Namen eingeben, z. B. `Mosaik Rätsel`. Darunter zeigt Firebase die **Projekt-ID** (z. B. `mosaik-raetsel`) – sie wird Teil der späteren Adresse. Über das Stift-Symbol lässt sie sich jetzt noch ändern, später nicht mehr.
4. Google Analytics wird nicht benötigt und kann ausgeschaltet werden.
5. Nach dem Anlegen im linken Menü unter **Build → Hosting** auf **Jetzt starten** klicken und die angezeigten Schritte mit **Weiter** überspringen – die Befehle dort sind bereits im Projekt eingebaut. Dadurch wird die Website im Projekt angelegt.

Das Projekt startet automatisch im kostenlosen **Spark-Tarif**; eine Zahlungsmethode ist nicht nötig.

### Schritt 4: Im Terminal bei Google anmelden

```bash
npm run firebase:login
```

Es öffnet sich ein Browserfenster: dasselbe Google-Konto wählen und den Zugriff erlauben. Die Frage, ob Firebase anonyme Nutzungsdaten sammeln darf, kannst du nach Belieben beantworten. Am Ende meldet das Terminal `Success! Logged in as …`.

Die Anmeldung bleibt auf diesem Computer gespeichert; dieser Schritt ist nur einmal nötig.

### Schritt 5: Projekt verknüpfen

```bash
npm run firebase:setup
```

1. Mit den Pfeiltasten das in Schritt 3 angelegte Projekt auswählen und Enter drücken.
2. Bei der Frage nach einem Alias `default` eingeben und Enter drücken.

Dadurch entsteht im Projektordner die Datei `.firebaserc`, die sich das Projekt merkt.

### Schritt 6: Veröffentlichen

```bash
npm run deploy
```

Der Befehl prüft die Einrichtung, baut die App und lädt sie hoch. Am Ende steht im Terminal:

```
✔  Deploy complete!
Hosting URL: https://mosaik-raetsel.web.app
```

Diese Adresse im Browser öffnen – fertig. Die App ist zusätzlich unter `https://<projekt-id>.firebaseapp.com` erreichbar.

### Updates veröffentlichen

Nach jeder Änderung am Projekt genügt:

```bash
npm run deploy
```

Wer die App schon offen hat, sieht die neue Version nach dem Neuladen der Seite. In der Firebase-Konsole unter **Hosting** sind alle bisherigen Versionen aufgelistet; dort lässt sich eine ältere Version mit einem Klick wiederherstellen („Rollback“).

### Testversion vorab ansehen (optional)

```bash
npm run deploy:vorschau
```

Das veröffentlicht die App unter einer eigenen Vorschau-Adresse (sie steht am Ende im Terminal), ohne die eigentliche Seite zu verändern. Die Vorschau läuft nach 7 Tagen automatisch ab.

### Eigene Domain verwenden (optional)

In der Firebase-Konsole unter **Hosting → Benutzerdefinierte Domain hinzufügen** lässt sich eine eigene Adresse wie `raetsel.example.de` einrichten. Firebase zeigt die DNS-Einträge an, die beim Domain-Anbieter eingetragen werden müssen, und stellt das HTTPS-Zertifikat automatisch bereit.

### App wieder offline nehmen

```bash
npx firebase hosting:disable
```

Danach ist die Adresse nicht mehr erreichbar. Mit `npm run deploy` lässt sich die App jederzeit wieder veröffentlichen. Um alles endgültig zu entfernen, das Projekt in der Firebase-Konsole unter **Projekteinstellungen** löschen.

### Kosten und Grenzen

Firebase Hosting ist im Spark-Tarif kostenlos und enthält 10 GB Speicher sowie 10 GB Datenübertragung pro Monat (Stand 2026; aktuelle Werte unter https://firebase.google.com/pricing). Ein Aufruf der App überträgt rund 40 KB (komprimiert) – das reicht für weit über 100.000 Aufrufe im Monat. Wird eine Grenze doch erreicht, wird das Hosting bis zum Monatsende angehalten; es entstehen im Spark-Tarif keine Kosten.

### Was `npm run deploy` im Hintergrund macht

1. `scripts/firebase-check.mjs` prüft, ob ein Projekt verknüpft ist, und erklärt sonst die Einrichtung.
2. `npm run build` prüft die Typen und erzeugt den Ordner `dist`.
3. `firebase deploy --only hosting` lädt `dist` gemäß `firebase.json` hoch. Dateien unter `/assets` tragen einen Hash im Namen und werden ein Jahr lang zwischengespeichert; `index.html` wird nie zwischengespeichert, damit Updates sofort ankommen.

### Fehlerbehebung

| Meldung / Problem | Lösung |
|---|---|
| „Es ist noch kein Firebase-Projekt verknüpft“ | Schritt 5 ausführen: `npm run firebase:setup` |
| `Failed to authenticate, have you run firebase login?` | Schritt 4 ausführen: `npm run firebase:login` |
| `'firebase' ist nicht als interner oder externer Befehl …` bzw. `firebase: command not found` | `npm install` im Projektordner ausführen (Schritt 2) |
| Hinweis auf eine zu alte Node.js-Version (`requires node >=20`) | Aktuelle LTS-Version von https://nodejs.org installieren, Terminal neu öffnen |
| Windows PowerShell: „Die Ausführung von Skripts ist auf diesem System deaktiviert“ | Statt PowerShell die Eingabeaufforderung `cmd` verwenden (siehe Schritt 1) |
| Beim Anmelden öffnet sich kein Browser oder die Anmeldung hängt (z. B. Firmennetz, entfernter Rechner) | `npx firebase login --no-localhost` und den angezeigten Anweisungen folgen |
| `HTTP Error: 403` oder „permission denied“ | Falsches Google-Konto: `npx firebase logout`, dann `npm run firebase:login` mit dem Konto, das das Projekt angelegt hat |
| „Hosting site not found“ oder `404` beim Deploy | In der Konsole unter **Build → Hosting** auf **Jetzt starten** klicken (Schritt 3, Punkt 5) |
| Im Browser erscheint noch die alte Version | Seite neu laden (Strg+F5 bzw. Cmd+Shift+R) |
| Falsches Projekt verknüpft | `npm run firebase:setup` erneut ausführen oder die Datei `.firebaserc` löschen und neu verknüpfen |

### Alternative ohne Google-Konto

Bei Netlify Drop (https://app.netlify.com/drop) genügt es, nach `npm run build` den Ordner `dist` ins Browserfenster zu ziehen – ganz ohne Terminal-Befehle für die Veröffentlichung. Für eine dauerhafte Adresse ist ein kostenloses Netlify-Konto nötig.

## Projektstruktur

```
src/
  main.ts                 Einstiegspunkt
  app.ts                  App-Controller: verbindet Spiel, Löser und Oberfläche
  core/                   Logik ohne DOM-Abhängigkeiten (testbar)
    types.ts              Gemeinsame Typen (Cell, Puzzle, SaveFile, …)
    parser.ts             JSON → Rätsel, mit verständlichen Fehlermeldungen
    serializer.ts         Rätsel + Spielstand → JSON, Dateinamen
    solver.ts             Logik-Löser (Einzel- und Paar-Regeln) + Backtracking
    solver.worker.ts      Löser im Web Worker
    solverClient.ts       Promise-Schnittstelle zum Worker (mit Fallback)
    game.ts               Spielzustand, Verlauf (Rückgängig/Wiederholen), Zeit, Events
    hints.ts              Hinweise mit Erklärtext
    generator.ts          Rätsel-Generator: Zahlen aus Raster, Ausdünnen
    generator.worker.ts   Generator im Web Worker
    generatorClient.ts    Promise-Schnittstelle zum Generator (abbrechbar)
    motifs.ts             Motiv-Generator: Kleckse, Pixelfigur, Geometrie, Wellen, Mandala, Labyrinth
    puzzleFactory.ts      Zufallsrätsel erzeugen, Rätsel aus Raster zusammensetzen
    random.ts             Reproduzierbarer Zufallsgenerator
    emitter.ts            Typisierter Event-Emitter
  ui/                     Oberflächenkomponenten
    boardView.ts          Canvas-Darstellung des Spielfelds
    boardInput.ts         Maus, Touch und Tastatur
    header.ts             Titel, Zeit, Fortschritt, Rückgängig/Wiederholen
    sidebar.ts            Datei-, Werkzeug-, Hilfe- und Ansichtsbereich
    dialogs.ts            JSON-Text- und Dateiformat-Dialog
    creatorDialog.ts      Dialog „Rätsel erstellen“ (Zufallsmotiv oder Bild)
    statusBar.ts          Meldungszeile
    viewState.ts          Ansichtszustand (Werkzeug, Zoom, Markierungen …)
    theme.ts              Farben aus CSS-Variablen, Hell/Dunkel
    dom.ts                Kleine DOM-Helfer
    difficulty.ts         Namen der Stufen und Rauten-Symbol
  image/
    imageSampler.ts       Bild laden und in Rasterfelder abtasten
    pattern.ts            Schwelle (Otsu), Schwarz-Weiß-Raster, Glätten
  io/
    files.ts              Datei lesen, herunterladen, kopieren
    imageExport.ts        Aufgabe und Lösung als JPG zeichnen
    dropZone.ts           Drag & Drop von Dateien
    autosave.ts           Automatisches Speichern im localStorage
  data/examples.ts        Eingebautes Beispiel und Vorlage
  styles/main.css         Gestaltung
public/puzzles/           Beispiel-JSON-Dateien
tests/                    Unit-Tests für Parser, Löser und Spielzustand
```

Die Abhängigkeiten zeigen nur in eine Richtung: `ui/` und `io/` nutzen `core/`, aber `core/` kennt weder DOM noch Oberfläche. Die Oberfläche reagiert auf Events von `Game` (`load`, `change`, `solution`, `solved`, `tick`).

## Bedienung

- Oben neben Titel und Größe zeigt ein Abzeichen die Schwierigkeit mit derselben Raute wie in den Bildern (◇ Normal, halb gefüllt Fortgeschritten, ◆ Knifflig). Fehlt die Stufe in der Datei, bestimmt die App sie aus den Zahlen; bei Rätseln, die Ausprobieren erfordern, entfällt das Abzeichen.

- **Klick** füllt ein Feld, **Rechtsklick** oder **Umschalt+Klick** markiert es als leer, **Ziehen** bemalt mehrere Felder.
- Tastatur auf dem Spielfeld: Pfeiltasten, Leertaste/Enter/F (füllen), X (leer), Entf (löschen).
- Global: H (Hinweis), 1/2/3 (Werkzeug), Strg+Z / Strg+Y, Strg+S (speichern).
- **Hinweis** zeigt den nächsten logischen Schritt mit Begründung; ein zweiter Klick wendet ihn an.
- **Prüfen** markiert falsch gesetzte Felder (sofern die Lösung bekannt ist).
- **Lösung zeigen** blendet die Lösung ein, ohne deinen Stand zu verändern; der Button heißt dann **Lösung verbergen** und stellt mit einem Klick deinen Stand wieder dar. Solange die Lösung sichtbar ist, ruht die Zeit und das Spielfeld lässt sich nicht bearbeiten. Hinweis, Prüfen, Rückgängig und Zurücksetzen blenden die Lösung automatisch aus.

## Rätsel erzeugen

### Zufallsrätsel

**„Zufallsrätsel“** erzeugt mit einem Klick ein komplett neues Rätsel: Die App entwirft ein Motiv und legt die Zahlen fest. Größe, Motivart und Schwierigkeit kommen aus den Einstellungen im Ersteller (Standard: 20 × 20, Überraschungsmotiv, Normal).

Motivarten:

| Motiv | Beschreibung |
|-------|--------------|
| Kleckse | Organische Flächen, oft spiegel- oder drehsymmetrisch |
| Pixelfigur | Spiegelsymmetrische Figur im Stil alter Videospiele |
| Geometrie | Überlagerte Kreise, Ringe, Rechtecke und Rauten |
| Wellen | Verzerrte Streifen in zufälliger Richtung |
| Mandala | Radialsymmetrisches Muster |
| Labyrinth | Echtes Labyrinth mit Ein- und Ausgang; dünne Wände ergeben meist knifflige, dicke Wände leichtere Rätsel |

Jedes Motiv wird aus einem Startwert erzeugt und ist damit reproduzierbar; er steht in der gespeicherten Datei unter `source`. Ergibt ein Motiv kein eindeutig lösbares Rätsel, versucht die App automatisch ein anderes.

### Ersteller

**„Ersteller…“** öffnet den Dialog mit zwei Quellen:

- **Zufallsmotiv:** Motivart wählen, mit „Neues Motiv“ so lange würfeln, bis es gefällt.
- **Eigenes Bild:** siehe unten. Ein Bild lässt sich auch direkt auf das Spielfeld ziehen.

In beiden Fällen kannst du Felder in der Vorschau umschalten und Größe, Titel und Schwierigkeit festlegen. Dann:

- **Rätsel erstellen und spielen** lädt das Rätsel ins Spielfeld und schließt den Dialog.
- **Aufgabe + Lösung als JPG** erzeugt das Rätsel und speichert zwei druckfertige Bilder: `<titel>-<kürzel>-aufgabe.jpg` (leeres Raster mit Zahlen) und `<titel>-<kürzel>-loesung.jpg` (ausgefülltes Raster mit Zahlen), z. B. `kleckse-1518-05-aufgabe.jpg`. Kürzel: `00` = Normal, `05` = Fortgeschritten, `10` = Knifflig. Dialog und Motiv bleiben bestehen: Du kannst dasselbe Motiv gleich noch in einer anderen Stufe speichern und mit „Neues Motiv“ zum nächsten wechseln. Weicht die erreichte Stufe von der gewünschten ab, weist die Meldung darauf hin.

Kleine Rätsel werden etwa 2000 px groß gezeichnet und eignen sich für den Druck auf A4. Die Titelzeile zeigt links den Titel und rechts die Größe (z. B. „20 × 20“) sowie eine Raute für die Schwierigkeit: ◇ leer = Normal, linke Hälfte gefüllt (senkrecht geteilt) = Fortgeschritten, ◆ gefüllt = Knifflig. Manche Browser fragen beim ersten Mal, ob mehrere Downloads erlaubt sind.

### Aus einem Bild

1. Bild wählen. Am besten eignen sich klare Formen mit gutem Kontrast, etwa Logos, Piktogramme oder Silhouetten.
2. Rastergröße einstellen (5–80 Felder je Seite). Die Höhe folgt auf Wunsch dem Seitenverhältnis.
3. Die **Schwelle** bestimmt, ab welcher Helligkeit ein Feld gefüllt wird. „Auto“ wählt sie automatisch (Otsu-Verfahren). „Hell und dunkel tauschen“ kehrt das Bild um, „Einzelne Pixel glätten“ entfernt Ausreißer.
4. In der Vorschau lassen sich Felder per Klick oder Ziehen umschalten. Ohne Bild kann man dort auch frei zeichnen.
5. **Schwierigkeit** wählen und „Rätsel erstellen“.

Der Generator startet mit allen Zahlen und entfernt sie in zufälliger Reihenfolge, solange das Rätsel ohne Raten eindeutig lösbar bleibt:

| Stufe | Bedeutung |
|-------|-----------|
| Normal | Lösbar nur mit einfachen Schlüssen (Zahl ist erfüllt / alle freien Felder nötig) |
| Fortgeschritten | Zusätzlich sehr wenige Vergleiche zweier überlappender Zahlen: höchstens 2 bei kleinen, höchstens 6 bei großen Rätseln |
| Knifflig | Beliebig viele Vergleiche |

Die Stufe richtet sich nach den tatsächlich nötigen Vergleichen: 0 = Normal, bis zur Obergrenze = Fortgeschritten, darüber = Knifflig. Die Statusmeldung nach dem Erstellen nennt die Stufe und die Zahl der nötigen Vergleiche; in der JSON-Datei steht die Stufe unter `difficulty` (`easy`, `moderate`, `medium`). Die gewählte Stufe wird eingehalten: Fällt ein Rätsel zu leicht aus, verteilt die App die Zahlen neu. Kann ein Zufallsmotiv die Stufe grundsätzlich nicht erreichen (z. B. dünnwandige Labyrinthe bei „Normal“), nimmt „Rätsel erstellen und spielen“ bzw. „Zufallsrätsel“ ein anderes Motiv derselben Art – die Meldung sagt das dann. Bei eigenen Bildern, von Hand geänderten Motiven und beim Speichern als JPG bleibt das Motiv erhalten; ist die Stufe dort nicht erreichbar, weist die Meldung darauf hin.

Die Berechnung läuft in einem Web Worker; ein 60 × 60-Raster dauert wenige Sekunden. Das erzeugte Rätsel enthält die Lösung und lässt sich wie jedes andere mit „Stand speichern“ als JSON sichern.

Bitte nur bereinigte Bilder verwenden – ohne personenbezogene oder vertrauliche Inhalte.

## Dateiformat

```json
{
  "format": "fill-a-pix",
  "version": 1,
  "title": "Kleines Beispiel",
  "width": 5,
  "height": 5,
  "clues": ["..5..", "57..5", "5.9.5", ".6...", "1..3."],
  "solution": [".#.#.", "#####", "#####", ".###.", "..#.."]
}
```

| Feld | Pflicht | Bedeutung |
|------|---------|-----------|
| `clues` | ja | Zeilen mit `0`–`9` und `.` (keine Zahl); alternativ Arrays mit Zahlen und `null` oder durch Leerzeichen getrennte Einträge |
| `width`, `height` | nein | Werden sonst aus `clues` abgeleitet |
| `title`, `author` | nein | Anzeige |
| `solution` | nein | `#` gefüllt, `.` leer. Fehlt sie, berechnet die App die Lösung selbst |
| `progress` | nein | Wird beim Speichern ergänzt: `cells` (`#` gefüllt, `x` leer, `.` offen), `elapsedSeconds`, `solved`, `savedAt` |

Gespeicherte Stände lassen sich wieder öffnen und weiterspielen. Zusätzlich wird der letzte Stand automatisch im Browser gesichert.
