# Vorlagen für „Piktogramme“ und „Pixel-Art“ erzeugen

Einmalige Werkzeuge, mit denen `src/data/pictograms.ts` entstanden ist. Für den Betrieb der App
werden sie nicht gebraucht. Lizenzen und Urheber: siehe [VORLAGEN-LIZENZEN.md](../../VORLAGEN-LIZENZEN.md).

1. Quellen herunterladen (nicht ins Repository übernehmen):
   - game-icons: <https://github.com/game-icons/icons> (ZIP des Branches `master`), entpacken.
   - Kenney „1-Bit Pack“: <https://opengameart.org/content/1-bit-pack> (`1bitpack_kenney_1.1.zip`).
2. Optional Kandidaten ansehen: `node candidates.mjs <icons-ordner> <ausgabe-ordner>` schreibt
   Kontaktbögen (`gi-page*.png`) mit allen passenden, nicht zu stark gefüllten Symbolen.
3. Die gewählten Kenney-Kacheln stehen als 16 × 16-Bitfolgen in `kenney-tiles.json`
   (Kachel „Zeile,Spalte“ aus `Tilesheet/monochrome_transparent_packed.png`).
4. Datei erzeugen:
   `node gen.mjs <icons-ordner> kenney-tiles.json ../../src/data/pictograms.ts credits.txt`
   Die Auswahl der Symbole und ihre deutschen Namen stehen in `gen.mjs`; `credits.txt` enthält
   die Urheberliste für `VORLAGEN-LIZENZEN.md`.
