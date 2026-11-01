// Erzeugt src/data/pictograms.ts aus den ausgewählten game-icons und Kenney-Kacheln.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { iconPath, parsePath, rasterize } from './raster.mjs';

const [root, kenneyJson, outFile, creditsFile] = process.argv.slice(2);

const ICONS = `delapouite/air-balloon Heißluftballon|lorc/anchor Anker|delapouite/ant Ameise|delapouite/banana Banane
caro-asercion/barn-owl Schleiereule|delapouite/bat Fledermaus|delapouite/bear-head Bär|lorc/bee Biene|delapouite/bird-house Vogelhaus
delapouite/bus Bus|lorc/butterfly Schmetterling|delapouite/cactus Kaktus|delapouite/cactus-pot Topfkaktus|delapouite/camel Kamel
delapouite/camping-tent Zelt|lorc/candle-holder Kerze|delapouite/cargo-ship Frachtschiff|delapouite/carrot Karotte|delapouite/castle Burg
lorc/cat Katze|delapouite/cherry Kirschen|delapouite/chestnut-leaf Kastanienblatt|lorc/acorn Eichel|lorc/cake-slice Kuchenstück
delapouite/balloon-dog Ballonhund|delapouite/bonsai-tree Bonsai|delapouite/chicken Huhn|delapouite/church Kirche|delapouite/circling-fish Fische
delapouite/city-car Auto|sbed/clover Kleeblatt|delapouite/coffee-cup Kaffeetasse|delapouite/commercial-airplane Flugzeug
delapouite/converse-shoe Turnschuh|delapouite/cow Kuh|lorc/crab Krebs|lorc/crown Krone|delapouite/cupcake Muffin|lorc/cut-diamond Diamant
delapouite/dandelion-flower Pusteblume|caro-asercion/deer Hirsch|delapouite/dog-house Hundehütte|delapouite/dolphin Delfin
delapouite/double-fish Fischpaar|lorc/dragonfly Libelle|delapouite/drum Trommel|delapouite/duck Ente|delapouite/elephant Elefant
lorc/empty-hourglass Sanduhr|lorc/envelope Briefumschlag|delapouite/farm-tractor Traktor|lorc/feather Feder|delapouite/fire-flower Blume
delapouite/flamingo Flamingo|delapouite/flower-emblem Blüte|lorc/flower-pot Blumentopf|delapouite/flower-star Sternblume
delapouite/food-truck Imbisswagen|caro-asercion/fox Fuchs|lorc/frog Frosch|delapouite/fruit-tree Obstbaum|skoll/goat Ziege
delapouite/gorilla Gorilla|lorc/grapes Weintrauben|delapouite/grass-mushroom Pilze|lorc/guitar Gitarre|caro-asercion/hedgehog Igel
delapouite/helicopter Hubschrauber|delapouite/house Haus|delapouite/igloo Iglu|lorc/jellyfish Qualle|delapouite/kangaroo Känguru
delapouite/kite Drachen|delapouite/kiwi-bird Kiwi|delapouite/koala Koala|delapouite/ladybug Marienkäfer|delapouite/lighthouse Leuchtturm
delapouite/floating-ghost Gespenst|lorc/lion Löwe|lorc/lotus-flower Lotusblüte|delapouite/magic-hat Zauberhut|lorc/maple-leaf Ahornblatt
delapouite/mine-truck Kipplaster|lorc/monkey Affe|delapouite/moon-orbit Planet|delapouite/mouse Maus|lorc/mushroom Pilz
delapouite/mushroom-house Pilzhaus|lorc/octopus Krake|lorc/owl Eule|delapouite/pagoda Pagode|delapouite/palm-tree Palme
delapouite/paper-windmill Windrad|lorc/paw-print Pfote|delapouite/pear Birne|delapouite/penguin Pinguin|delapouite/photo-camera Kamera
skoll/pig Schwein|lorc/pine-tree Tanne|delapouite/plastic-duck Quietscheente|cathelineau/polar-bear Eisbär|delapouite/police-car Polizeiauto
lorc/pumpkin-lantern Kürbis|lorc/queen-crown Königskrone|delapouite/rabbit Hase|delapouite/rabbit-head Hasenkopf|lorc/raven Rabe
lorc/ringing-bell Glocke|lorc/rocket Rakete|delapouite/rooster Hahn|lorc/rose Rose|delapouite/sailboat Segelboot|delapouite/sand-castle Sandburg
lorc/scarab-beetle Käfer|john-redman/scissors Schere|delapouite/scooter Motorroller|delapouite/sea-turtle Meeresschildkröte
caro-asercion/sewing-machine Nähmaschine|delapouite/shark-fin Haiflosse|delapouite/sheep Schaf|delapouite/ship-wheel Steuerrad
pierre-leducq/shooner-sailboat Schoner|delapouite/sitting-dog Hund|lorc/snail Schnecke|lorc/snake Schlange|lorc/snowflake-1 Schneeflocke
lorc/snowflake-2 Eiskristall|lorc/snowman Schneemann|delapouite/sperm-whale Wal|carl-olsen/spider-alt Spinne|lorc/spider-web Spinnennetz
lorc/spotted-mushroom Fliegenpilz|delapouite/stairs-cake Torte|delapouite/steam-locomotive Dampflok|delapouite/strawberry Erdbeere
delapouite/submarine U-Boot|lorc/sun Sonne|delapouite/sun-cloud Sonne und Wolke|delapouite/sunflower Sonnenblume|lorc/swan Schwan
lorc/teapot Teekanne|delapouite/sydney-opera-house Opernhaus|lorc/top-hat Zylinder|delapouite/tortoise Schildkröte
delapouite/tow-truck Abschleppwagen|delapouite/tree-beehive Bienenstock|lorc/tree-branch Zweig|delapouite/tree-swing Schaukel
delapouite/trophy-cup Pokal|delapouite/tropical-fish Tropenfisch|delapouite/truck Lastwagen|delapouite/trumpet Trompete|lorc/umbrella Regenschirm
delapouite/unicorn Einhorn|lorc/vintage-robot Roboter|zajkonur/violin Geige|delapouite/watermelon Wassermelone|delapouite/whale-tail Walflosse
caro-asercion/willow-tree Weide|delapouite/windmill Windmühle|delapouite/winter-hat Mütze|lorc/wolf-howl Wolf`
  .split(/[|\n]/).map(s => s.trim()).filter(Boolean).map(s => {
    const [path, ...name] = s.split(' ');
    const [author, file] = path.split('/');
    return { author, file, name: name.join(' ') };
  });

const AUTHORS = {
  delapouite: 'Delapouite', lorc: 'Lorc', 'caro-asercion': 'Caro Asercion', sbed: 'Sbed', skoll: 'Skoll',
  cathelineau: 'Cathelineau', 'john-redman': 'John Redman', 'pierre-leducq': 'Pierre Leducq', zajkonur: 'Zajkonur', 'carl-olsen': 'Carl Olsen'
};

/** Auf die belegte Fläche zuschneiden und als Base64-Bitfolge packen. */
function pack(bits, size) {
  let x0 = size, y0 = size, x1 = -1, y1 = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (bits[y * size + x]) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const bytes = new Uint8Array(Math.ceil((w * h) / 8));
  let k = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++, k++) if (bits[y * size + x]) bytes[k >> 3] |= 0x80 >> (k & 7);
  return { w, h, data: Buffer.from(bytes).toString('base64') };
}

const entries = [];
for (const icon of ICONS) {
  const svg = readFileSync(join(root, icon.author, `${icon.file}.svg`), 'utf8');
  const cov = rasterize(parsePath(iconPath(svg)), 64);
  const bits = Array.from(cov, v => (v >= 0.5 ? 1 : 0));
  if (!AUTHORS[icon.author]) throw new Error('author ' + icon.author);
  entries.push({ set: 'icons', name: icon.name, author: AUTHORS[icon.author], id: `${icon.author}/${icon.file}`, ...pack(bits, 64) });
}
const kenney = JSON.parse(readFileSync(kenneyJson, 'utf8').replace(/^﻿/, ''));
for (const t of kenney) {
  entries.push({ set: 'pixelart', name: t.name, author: 'Kenney', id: `1-bit-pack/${t.tile}`, ...pack(Array.from(t.bits, c => +c), 16) });
}

const lines = entries.map(e =>
  `  { set: '${e.set}', name: '${e.name}', author: '${e.author}', id: '${e.id}', w: ${e.w}, h: ${e.h}, data: '${e.data}' }`);
writeFileSync(outFile, `/**
 * Vorlagen für die Motive „Piktogramme“ und „Pixel-Art“ (automatisch erzeugt, nicht von Hand ändern).
 *
 * - Piktogramme: game-icons.net, Lizenz CC BY 3.0 – Urheber je Eintrag unter „author“.
 * - Pixel-Art: „1-Bit Pack“ von Kenney (kenney.nl), Lizenz CC0.
 *
 * Jede Vorlage ist auf die belegte Fläche zugeschnitten; „data“ enthält die Felder zeilenweise
 * als Bitfolge (höchstwertiges Bit zuerst), Base64-kodiert.
 */
export interface Pictogram {
  set: 'icons' | 'pixelart';
  name: string;
  author: string;
  id: string;
  w: number;
  h: number;
  data: string;
}

export const PICTOGRAMS: readonly Pictogram[] = [
${lines.join(',\n')}
];
`);

// Nachweisliste für die Lizenzdatei
const byAuthor = {};
for (const e of entries.filter(e => e.set === 'icons')) (byAuthor[e.author] ??= []).push(e.id.split('/')[1]);
writeFileSync(creditsFile, Object.entries(byAuthor).sort().map(([a, list]) => `- ${a}: ${list.sort().join(', ')}`).join('\n'));
console.log('icons', ICONS.length, 'kenney', kenney.length, 'total', entries.length);
