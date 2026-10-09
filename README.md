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

- ein **Google-Konto** (z. B. eine Gmail-Adresse)
- einen Computer mit Windows, macOS oder Linux und Internetzugang
- **Node.js 20 oder neuer** – wie du es installierst, steht in Schritt 1
- dieses Projekt als ZIP-Datei (`mosaik-typescript.zip`)
- etwa 20 Minuten Zeit für die erste Einrichtung; spätere Updates dauern nur noch eine Minute

> **Hinweis zu den Bildschirmtexten:** Die Firebase-Konsole ist je nach Spracheinstellung deutsch oder englisch. Die Bezeichnungen sind hier auf Deutsch angegeben, die englischen stehen in Klammern. Google passt die Oberfläche gelegentlich an, einzelne Texte können daher leicht abweichen.

### Kurzer Überblick: Was ist ein Terminal?

Einige Schritte werden im **Terminal** erledigt – einem Fenster, in das man Befehle eintippt. Dabei gilt:

- Befehle stehen in dieser Anleitung in grauen Kästen, z. B. `npm install`. Du kannst sie kopieren und ins Terminal einfügen (Windows: Strg+V oder Rechtsklick, macOS: Cmd+V).
- Jeder Befehl wird mit **Enter** ausgeführt.
- Während ein Befehl läuft, erscheinen Textzeilen. Er ist fertig, wenn wieder die Eingabezeile mit blinkendem Cursor erscheint.
- Gelbe Warnungen wie `npm warn deprecated …` sind normal und können ignoriert werden. Nur Zeilen mit **`Error`** bzw. **`Fehler`** deuten auf ein Problem hin – siehe [Fehlerbehebung](#fehlerbehebung).
- Ein laufender Befehl lässt sich mit **Strg+C** abbrechen.

---

### Schritt 1: Node.js installieren

Node.js wird gebraucht, um die App zu bauen und hochzuladen. Für die Nutzer der fertigen App ist es nicht nötig.

1. https://nodejs.org öffnen.
2. Die Version mit der Aufschrift **LTS** herunterladen (empfohlen, „Long Term Support“).
3. Das heruntergeladene Installationsprogramm starten und mit den vorgeschlagenen Einstellungen durchklicken.
   - **Windows:** Die Option „Tools for Native Modules“ (bzw. „Automatically install the necessary tools“) wird **nicht** benötigt und kann abgewählt bleiben.
   - **macOS:** Eventuell fragt der Mac nach dem Passwort des Benutzerkontos – das ist normal.
   - **Linux:** Am einfachsten über die Paketverwaltung oder den auf nodejs.org beschriebenen Weg; Node.js muss mindestens Version 20 haben.
4. Prüfen, ob es geklappt hat: Ein **neues** Terminal öffnen (siehe Schritt 2) und eingeben:

   ```bash
   node -v
   npm -v
   ```

   Die erste Ausgabe muss mit `v20` oder höher beginnen, z. B. `v22.11.0`. Die zweite zeigt eine Versionsnummer wie `10.9.0`. Erscheint stattdessen „Befehl nicht gefunden“ bzw. „ist nicht als interner oder externer Befehl … erkannt“, das Terminal schließen und neu öffnen; hilft das nicht, den Computer neu starten.

Ist Node.js bereits installiert, aber älter als Version 20, einfach die aktuelle LTS-Version darüber installieren.

### Schritt 2: Projekt entpacken und Terminal im Projektordner öffnen

**Entpacken**

- **Windows:** Rechtsklick auf `mosaik-typescript.zip` → **Alle extrahieren…** → Zielordner wählen (z. B. `Dokumente`) → **Extrahieren**.
- **macOS:** Doppelklick auf die ZIP-Datei.
- **Linux:** Rechtsklick → **Hier entpacken**.

Es entsteht ein Ordner `mosaik`, darin liegen u. a. die Dateien `package.json` und `README.md`.

**Terminal im Ordner `mosaik` öffnen**

- **Windows:**
  1. Im Explorer den Ordner `mosaik` öffnen (sodass `package.json` sichtbar ist).
  2. Oben in die **Adresszeile** klicken, den Text durch `cmd` ersetzen und Enter drücken.
  3. Es öffnet sich ein schwarzes Fenster; die Zeile endet mit `…\mosaik>`.

  Bitte die **Eingabeaufforderung** (`cmd`) verwenden, nicht die PowerShell – dort sind npm-Befehle auf manchen Computern gesperrt.
- **macOS:**
  1. Programm **Terminal** öffnen (Spotlight: Cmd+Leertaste, „Terminal“ tippen).
  2. `cd ` eintippen (mit Leerzeichen dahinter), den Ordner `mosaik` aus dem Finder ins Terminalfenster ziehen und Enter drücken.
  3. Die Zeile endet nun mit `mosaik %`.
- **Linux:** Im Dateimanager im Ordner `mosaik` Rechtsklick → **Im Terminal öffnen**.

Zur Kontrolle `dir` (Windows) bzw. `ls` (macOS/Linux) eingeben: In der Liste muss `package.json` auftauchen. Alle weiteren Befehle werden in **diesem** Terminalfenster ausgeführt. Wenn du das Fenster später schließt, für die nächsten Schritte wieder so öffnen.

### Schritt 3: Projekt vorbereiten

Im Terminal eingeben:

```bash
npm install
```

Das lädt alle benötigten Werkzeuge in den Unterordner `node_modules` – auch die Firebase-Befehle. Beim ersten Mal dauert das ein bis drei Minuten und benötigt rund 350 MB Speicherplatz. Am Ende erscheint eine Zeile wie `added 700 packages in 1m`.

Optional prüfen, ob alles funktioniert:

```bash
npm test
```

Am Ende sollte `Tests  52 passed` (bzw. eine ähnliche Zahl) stehen. Und wer die App vor dem Veröffentlichen lokal ansehen möchte:

```bash
npm run dev
```

Dann im Browser die angezeigte Adresse öffnen (meist `http://localhost:5173`). Mit **Strg+C** im Terminal wird der lokale Server wieder beendet.

### Schritt 4: Firebase-Projekt anlegen

Ein Firebase-Projekt ist der „Behälter“ für die veröffentlichte App. Es wird einmal im Browser angelegt.

1. https://console.firebase.google.com öffnen und mit dem Google-Konto anmelden. Beim allerersten Besuch müssen die Nutzungsbedingungen bestätigt werden.
2. Auf **Neues Firebase-Projekt erstellen** (*Create a new Firebase project*) bzw. **Projekt hinzufügen** (*Add project*) klicken.
3. **Projektname** eingeben, z. B. `Mosaik Rätsel`.
   - Darunter erscheint die **Projekt-ID**, z. B. `mosaik-raetsel` oder mit angehängter Zufallsendung wie `mosaik-raetsel-3f2a1`. Sie wird Teil der Internetadresse: `https://mosaik-raetsel.web.app`.
   - Über das Stift-Symbol neben der ID lässt sie sich jetzt noch ändern (nur Kleinbuchstaben, Ziffern und Bindestriche, weltweit eindeutig). **Später ist das nicht mehr möglich.**
   - Die Bedingungen bestätigen und auf **Weiter** (*Continue*) klicken.
4. **Gemini in Firebase** (KI-Assistent in der Konsole): wird für die App nicht benötigt – den Schalter ausschalten und **Weiter**.
5. **Google Analytics**: wird nicht benötigt – den Schalter **Google Analytics für dieses Projekt aktivieren** ausschalten. Danach heißt der Button **Projekt erstellen** (*Create project*).
6. Kurz warten, bis „Ihr neues Projekt ist bereit“ (*Your Firebase project is ready*) erscheint, dann **Weiter**. Es öffnet sich die Projektübersicht.
7. **Hosting aktivieren:**
   1. Im linken Menü **Build** (bzw. **Erstellen**) aufklappen und **Hosting** wählen. Falls der Punkt nicht sichtbar ist: über **Alle Produkte** (*All products*) nach „Hosting“ suchen.
   2. Auf **Jetzt starten** (*Get started*) klicken.
   3. Der Assistent zeigt drei Schritte („Firebase CLI installieren“, „Projekt initialisieren“, „Bereitstellen“). Diese Befehle sind im Projekt bereits eingebaut – einfach jeweils **Weiter** (*Next*) und zuletzt **Weiter zur Konsole** (*Continue to console*) klicken.

   Damit legt Firebase die Website im Projekt an. Ohne diesen Schritt meldet das Hochladen später „Could not determine the default site for the project“.

Das Projekt läuft automatisch im kostenlosen **Spark-Tarif**. Es wird **keine** Zahlungsmethode verlangt; falls doch ein Dialog zum „Upgrade“ oder zum Blaze-Tarif erscheint, diesen schließen – er ist für die App nicht nötig.

### Schritt 5: Im Terminal bei Google anmelden

Damit das Terminal Dateien in dein Firebase-Projekt hochladen darf, meldest du dich einmalig an:

```bash
npm run firebase:login
```

Nacheinander erscheinen zwei Fragen, die jeweils mit `Y` (ja) oder `n` (nein) und Enter beantwortet werden:

1. `Enable Gemini in Firebase features?` – betrifft nur KI-Funktionen des Firebase-Werkzeugs, die hier nicht gebraucht werden. Empfehlung: **`n`**.
2. `Allow Firebase to collect CLI and Emulator Suite usage and error reporting information?` – anonyme Nutzungsstatistik für Google. Nach Belieben; im Zweifel **`n`**.

Danach öffnet sich automatisch ein Browserfenster:

1. Das **gleiche Google-Konto** wählen, mit dem in Schritt 4 das Projekt angelegt wurde.
2. Die Seite „Firebase CLI möchte auf Ihr Google-Konto zugreifen“ mit **Zulassen** (*Allow*) bestätigen.
3. Es erscheint „Firebase CLI Login Successful“. Das Browserfenster kann geschlossen werden.

Im Terminal steht nun:

```
✔  Success! Logged in as name@gmail.com
```

Die Anmeldung bleibt auf diesem Computer gespeichert; dieser Schritt ist nur einmal nötig. Öffnet sich kein Browser (z. B. im Firmennetz oder auf einem entfernten Rechner), siehe [Fehlerbehebung](#fehlerbehebung).

### Schritt 6: Projekt verknüpfen

Jetzt sagst du dem Projektordner, in welches Firebase-Projekt er hochladen soll:

```bash
npm run firebase:setup
```

1. Es erscheint eine Liste deiner Firebase-Projekte:

   ```
   ? Which project do you want to add? (Use arrow keys)
   ❯ mosaik-raetsel (Mosaik Rätsel)
   ```

   Mit den **Pfeiltasten** das Projekt aus Schritt 4 auswählen und **Enter** drücken.
2. Dann:

   ```
   ? What alias do you want to use for this project? (e.g. staging)
   ```

   **`default`** eintippen (genau so, kleingeschrieben) und **Enter** drücken.
3. Zur Bestätigung erscheint:

   ```
   Created alias default for mosaik-raetsel.
   Now using alias default (mosaik-raetsel)
   ```

Im Projektordner liegt nun die Datei `.firebaserc`, die sich das Projekt merkt. (Dateien mit Punkt am Anfang sind im Explorer/Finder oft ausgeblendet – das ist normal.)

### Schritt 7: Veröffentlichen

```bash
npm run deploy
```

Der Befehl erledigt drei Dinge nacheinander: Er prüft die Einrichtung, baut die App (Ordner `dist`) und lädt sie hoch. Das dauert etwa eine halbe Minute. Die Ausgabe sieht sinngemäß so aus:

```
Firebase-Projekt: mosaik-raetsel
…
✓ built in 1.2s

=== Deploying to 'mosaik-raetsel'...

i  deploying hosting
i  hosting[mosaik-raetsel]: beginning deploy...
i  hosting[mosaik-raetsel]: found 7 files in dist
✔  hosting[mosaik-raetsel]: file upload complete
✔  hosting[mosaik-raetsel]: version finalized
✔  hosting[mosaik-raetsel]: release complete

✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/mosaik-raetsel/overview
Hosting URL: https://mosaik-raetsel.web.app
```

Die Adresse hinter **Hosting URL** ist die Adresse deiner App. Sie ist zusätzlich unter `https://<projekt-id>.firebaseapp.com` erreichbar.

### Schritt 8: Prüfen und teilen

1. Die Hosting-URL im Browser öffnen. Es erscheint das Beispielrätsel „Segelboot“.
2. Kurz testen:
   - **Zufallsrätsel** anklicken – nach einem Moment erscheint ein neues Rätsel.
   - **Ersteller…** → **Aufgabe + Lösung als JPG** – zwei Bilder werden heruntergeladen (manche Browser fragen beim ersten Mal, ob mehrere Downloads erlaubt sind).
3. Die Adresse auch auf dem Handy öffnen; die App passt sich der Bildschirmgröße an.
4. Zum Teilen genügt die Adresse. Tipp: Im Browser lässt sich die App als Lesezeichen speichern oder auf dem Handy über **Zum Startbildschirm hinzufügen** wie eine App ablegen.

Jeder Nutzer hat seinen eigenen Spielstand – er wird im jeweiligen Browser gespeichert und ist für niemanden sonst sichtbar.

### Updates veröffentlichen

Nach jeder Änderung am Projekt das Terminal im Ordner `mosaik` öffnen (wie in Schritt 2) und eingeben:

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

Die Sicherheitsabfrage mit `y` und Enter bestätigen. Danach ist die Adresse nicht mehr erreichbar. Mit `npm run deploy` lässt sich die App jederzeit wieder veröffentlichen. Um alles endgültig zu entfernen, das Projekt in der Firebase-Konsole unter **Projekteinstellungen** löschen.

### Kosten und Grenzen

Firebase Hosting ist im Spark-Tarif kostenlos und enthält 10 GB Speicher sowie 10 GB Datenübertragung pro Monat (Stand 2026; aktuelle Werte unter https://firebase.google.com/pricing). Ein Aufruf der App überträgt rund 40 KB (komprimiert) – das reicht für weit über 100.000 Aufrufe im Monat. Wird eine Grenze doch erreicht, wird das Hosting bis zum Monatsende angehalten; es entstehen im Spark-Tarif keine Kosten.

### Was `npm run deploy` im Hintergrund macht

1. `scripts/firebase-check.mjs` prüft, ob ein Projekt verknüpft ist, und erklärt sonst die Einrichtung.
2. `npm run build` prüft die Typen und erzeugt den Ordner `dist`.
3. `firebase deploy --only hosting` lädt `dist` gemäß `firebase.json` hoch. Dateien unter `/assets` tragen einen Hash im Namen und werden ein Jahr lang zwischengespeichert; `index.html` wird nie zwischengespeichert, damit Updates sofort ankommen.

### Fehlerbehebung

| Meldung / Problem | Lösung |
|---|---|
| „Es ist noch kein Firebase-Projekt verknüpft“ | Schritt 6 ausführen: `npm run firebase:setup` |
| `Failed to authenticate, have you run firebase login?` | Schritt 5 ausführen: `npm run firebase:login` |
| `'firebase' ist nicht als interner oder externer Befehl …` bzw. `firebase: command not found` | `npm install` im Projektordner ausführen (Schritt 3) |
| Hinweis auf eine zu alte Node.js-Version (`requires node >=20`) | Aktuelle LTS-Version von https://nodejs.org installieren, Terminal neu öffnen |
| Windows PowerShell: „Die Ausführung von Skripts ist auf diesem System deaktiviert“ | Statt PowerShell die Eingabeaufforderung `cmd` verwenden (siehe Schritt 2) |
| Beim Anmelden öffnet sich kein Browser oder die Anmeldung hängt (z. B. Firmennetz, entfernter Rechner) | Mit Strg+C abbrechen, dann `npx firebase login --no-localhost` ausführen: Den angezeigten Link im Browser öffnen, anmelden, den angezeigten Code kopieren und ins Terminal einfügen |
| `HTTP Error: 403` oder „permission denied“ | Falsches Google-Konto: `npx firebase logout`, dann `npm run firebase:login` mit dem Konto, das das Projekt angelegt hat |
| `Could not determine the default site for the project.`, „Hosting site not found“ oder `404` beim Deploy | In der Konsole unter **Build → Hosting** auf **Jetzt starten** klicken (Schritt 4, Punkt 7) |
| Im Browser erscheint noch die alte Version | Seite neu laden (Strg+F5 bzw. Cmd+Shift+R) |
| Falsches Projekt verknüpft | `npm run firebase:setup` erneut ausführen oder die Datei `.firebaserc` löschen und neu verknüpfen |
| In der Projektliste bei Schritt 6 fehlt das Projekt | Mit einem anderen Google-Konto angemeldet: `npx firebase logout`, dann Schritt 5 wiederholen |
| `npm install` bricht mit Netzwerkfehler ab (`ETIMEDOUT`, `ECONNRESET`) | Internetverbindung prüfen und erneut ausführen; im Firmennetz ggf. Proxy-Einstellungen bei der IT erfragen |
| Ich habe mich bei den Fragen in Schritt 5 vertippt | `npx firebase logout` und Schritt 5 wiederholen – die Fragen werden erneut gestellt |

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
5. Wer das Motiv lieber selbst nachzeichnen möchte: **Automatische Felder entfernen** entfernt die aus dem Bild erzeugten Felder, das Bild bleibt als Vorlage hinterlegt. Von Hand gesetzte Felder bleiben dabei erhalten. Dann die gewünschten Felder per Klick oder Ziehen füllen. Derselbe Button heißt danach **Automatische Felder wiederherstellen** und holt die erzeugten Felder zurück (selbst gezeichnete Felder bleiben dabei erhalten). Auch eine Änderung an Schwelle, Umkehrung oder Glättung stellt die automatischen Felder wieder her.
6. **Schwierigkeit** wählen und „Rätsel erstellen und spielen“ bzw. „Aufgabe + Lösung als JPG“.

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
