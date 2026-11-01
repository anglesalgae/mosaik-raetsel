// Kandidaten aus game-icons wählen, rastern, bewerten und als Kontaktbogen zeigen.
import { writeFileSync } from 'node:fs';
import { iconPath, listSvgs, parsePath, rasterize, readFileSync, writePng } from './raster.mjs';

const [root, outDir] = process.argv.slice(2);
const WORDS = `cat dog rabbit horse cow pig sheep goat owl eagle duck chicken rooster hen fish whale dolphin shark octopus
turtle snail butterfly bee ant spider frog snake lion elephant giraffe fox wolf bear deer squirrel mouse bat crab seahorse
penguin parrot swan hedgehog kangaroo camel dinosaur unicorn dragon bird beetle ladybug dragonfly jellyfish starfish
koala panda monkey gorilla rhinoceros hippo zebra crocodile lizard tortoise raven crow flamingo peacock pelican rat
anchor umbrella key bell teapot lamp candle hourglass guitar violin trumpet drum bicycle car truck ship sailboat
airplane rocket train house castle lighthouse windmill tree flower rose tulip sunflower leaf mushroom apple pear cherry
strawberry banana carrot cactus sun moon cloud snowflake crown diamond clover gift balloon kite teddy-bear
helicopter tractor bus scooter tent igloo pagoda church cupcake cake ice-cream pumpkin lemon grapes pineapple watermelon
acorn pine-tree palm-tree maple-leaf oak-leaf feather paw-print footprint heart-key hot-air-balloon submarine
locomotive steam-locomotive sewing-machine telephone camera glasses hat top-hat boot shoe sock mitten scarf
kettle mug coffee-cup wine-glass bottle fork knife spoon scissors hammer saw wrench screwdriver paintbrush pencil
book open-book envelope trophy medal music note treble-clef headphones microphone robot alien ghost skull snowman`.split(/\s+/);
const set = new Set(WORDS);
const all = listSvgs(root);
const chosen = all.filter(({ name }) => set.has(name) || name.split('-').some(w => set.has(w) && name.split('-').length <= 3));

const S = 64;
const results = [];
for (const c of chosen) {
  const d = iconPath(readFileSync(c.file, 'utf8'));
  if (!d) continue;
  let cov;
  try { cov = rasterize(parsePath(d), S); } catch (e) { console.error(c.name, e.message); continue; }
  const bits = Array.from(cov, v => (v >= 0.5 ? 1 : 0));
  const fill = bits.reduce((s, v) => s + v, 0) / bits.length;
  // Füllung nach Verkleinern auf 20 × 20 (Lesbarkeit kleiner Rätsel)
  const small = rasterize(parsePath(d), 20);
  const fill20 = Array.from(small).filter(v => v >= 0.5).length / 400;
  results.push({ ...c, file: undefined, bits, fill, fill20 });
}
const keep = results.filter(r => r.fill >= 0.15 && r.fill <= 0.45 && r.fill20 >= 0.12 && r.fill20 <= 0.5)
  .sort((a, b) => a.name.localeCompare(b.name));
console.log('kandidaten', chosen.length, 'gerastert', results.length, 'passend', keep.length);
writeFileSync(`${outDir}/candidates.json`, JSON.stringify(keep.map(r => ({ author: r.author, name: r.name, fill: r.fill, bits: r.bits.join('') }))));

// Kontaktbogen: 10 Spalten, jede Zelle 64 + Rand
const cols = 10, cell = S + 6, rows = Math.ceil(keep.length / cols);
for (let page = 0; page * 100 < keep.length; page++) {
  const part = keep.slice(page * 100, page * 100 + 100);
  const pr = Math.ceil(part.length / cols);
  const W = cols * cell, H = pr * cell;
  const g = new Uint8Array(W * H).fill(255);
  part.forEach((r, k) => {
    const ox = (k % cols) * cell + 3, oy = Math.floor(k / cols) * cell + 3;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) g[(oy + y) * W + ox + x] = r.bits[y * S + x] ? 0 : 235;
  });
  writePng(`${outDir}/gi-page${page}.png`, W, H, g);
  writeFileSync(`${outDir}/gi-page${page}.txt`, part.map((r, k) => `${k}: ${r.author}/${r.name} ${Math.round(r.fill * 100)}%`).join('\n'));
}
console.log('rows', rows);
