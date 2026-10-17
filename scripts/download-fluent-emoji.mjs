/**
 * Download curated Microsoft Fluent UI 3D emojis (everyday objects + human roles).
 * Source: https://github.com/microsoft/fluentui-emoji (MIT)
 *
 * No yellow smiley faces. Objects, clothes, tools, food, transport, a few people.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'fluent-emoji');
const RAW = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets';

/** Fluent folder name → local id (filename without .png) */
const ITEMS = [
  // clothes / body essentials
  ['T-shirt', 'tshirt'],
  ['Jeans', 'jeans'],
  ['Socks', 'socks'],
  ['Shorts', 'shorts'],
  ['Coat', 'coat'],
  ['Dress', 'dress'],
  ['Gloves', 'gloves'],
  ['Billed cap', 'cap'],
  ['Mans shoe', 'shoe'],
  ['Running shoe', 'running_shoe'],
  ['Hiking boot', 'boot'],
  ['Womans sandal', 'sandal'],
  ['Necktie', 'necktie'],
  ['Lab coat', 'lab_coat'],
  ['Glasses', 'glasses'],
  // money / shopping
  ['Money bag', 'money_bag'],
  ['Dollar banknote', 'dollar'],
  ['Euro banknote', 'euro'],
  ['Coin', 'coin'],
  ['Credit card', 'credit_card'],
  ['Shopping cart', 'shopping_cart'],
  ['Shopping bags', 'shopping_bags'],
  ['Handbag', 'handbag'],
  ['Backpack', 'backpack'],
  ['Luggage', 'luggage'],
  ['Package', 'package'],
  // home / daily tools
  ['Key', 'key'],
  ['Door', 'door'],
  ['Chair', 'chair'],
  ['Bed', 'bed'],
  ['Mirror', 'mirror'],
  ['Bathtub', 'bathtub'],
  ['Soap', 'soap'],
  ['Toothbrush', 'toothbrush'],
  ['Broom', 'broom'],
  ['Basket', 'basket'],
  ['Bucket', 'bucket'],
  ['Locked', 'locked'],
  ['Light bulb', 'light_bulb'],
  ['Flashlight', 'flashlight'],
  ['Candle', 'candle'],
  ['Battery', 'battery'],
  ['Electric plug', 'electric_plug'],
  ['Alarm clock', 'alarm_clock'],
  ['Watch', 'watch'],
  ['Bell', 'bell'],
  ['Television', 'television'],
  ['Camera', 'camera'],
  ['Mobile phone', 'phone'],
  ['Laptop', 'laptop'],
  ['Closed umbrella', 'umbrella'],
  // school / office
  ['Open book', 'book'],
  ['Books', 'books'],
  ['Notebook', 'notebook'],
  ['Pencil', 'pencil'],
  ['Pen', 'pen'],
  ['Fountain pen', 'fountain_pen'],
  ['Crayon', 'crayon'],
  ['Paintbrush', 'paintbrush'],
  ['Scissors', 'scissors'],
  ['Straight ruler', 'ruler'],
  ['Paperclip', 'paperclip'],
  ['Bookmark', 'bookmark'],
  ['Clipboard', 'clipboard'],
  ['Memo', 'memo'],
  ['School', 'school'],
  // kitchen / food
  ['Fork and knife with plate', 'plate'],
  ['Kitchen knife', 'knife'],
  ['Cooking', 'cooking'],
  ['Hot beverage', 'coffee'],
  ['Cup with straw', 'cup'],
  ['Teapot', 'teapot'],
  ['Glass of milk', 'milk'],
  ['Bread', 'bread'],
  ['Baguette bread', 'baguette'],
  ['Cheese wedge', 'cheese'],
  ['Pizza', 'pizza'],
  ['Sandwich', 'sandwich'],
  ['Green apple', 'apple'],
  ['Banana', 'banana'],
  ['Tangerine', 'orange'],
  ['Strawberry', 'strawberry'],
  ['Tomato', 'tomato'],
  ['Carrot', 'carrot'],
  ['Egg', 'egg'],
  ['Butter', 'butter'],
  // nature / weather
  ['Sun', 'sun'],
  ['Crescent moon', 'moon'],
  ['Cloud', 'cloud'],
  ['Droplet', 'water'],
  ['Fire', 'fire'],
  ['Deciduous tree', 'tree'],
  ['Hibiscus', 'flower'],
  // animals
  ['Dog', 'dog'],
  ['Cat', 'cat'],
  ['Bird', 'bird'],
  ['Fish', 'fish'],
  // transport / places
  ['Automobile', 'car'],
  ['Bus', 'bus'],
  ['Bicycle', 'bike'],
  ['Motorcycle', 'motorcycle'],
  ['Airplane', 'plane'],
  ['High-speed train', 'train'],
  ['Passenger ship', 'ship'],
  ['House', 'house'],
  ['Hospital', 'hospital'],
  ['Bank', 'bank'],
  ['Hotel', 'hotel'],
  ['Ambulance', 'ambulance'],
  ['Fire engine', 'fire_engine'],
  // tools
  ['Hammer', 'hammer'],
  ['Hammer and wrench', 'wrench'],
  ['Axe', 'axe'],
  ['Nut and bolt', 'nut_bolt'],
  ['Gear', 'gear'],
  ['Ladder', 'ladder'],
  ['Balance scale', 'balance'],
  // human roles (not yellow smileys)
  ['Cook', 'cook'],
  ['Mechanic', 'mechanic'],
  ['Firefighter', 'firefighter'],
  ['Artist', 'artist'],
  ['Man teacher', 'teacher'],
  ['Man student', 'student'],
  ['Man standing', 'man'],
  ['Girl', 'girl'],
  ['Boy', 'boy'],
  ['Child', 'child'],
  ['Farmer', 'farmer'],
  ['Guard', 'guard'],
  // color squares (référence visuelle: blue square) + circles
  ['Blue square', 'blue_square'],
  ['Red square', 'red_square'],
  ['Orange square', 'orange_square'],
  ['Yellow square', 'yellow_square'],
  ['Green square', 'green_square'],
  ['Purple square', 'purple_square'],
  ['Brown square', 'brown_square'],
  ['Black large square', 'black_square'],
  ['White large square', 'white_square'],
  ['Blue circle', 'blue_circle'],
  ['Red circle', 'red_circle'],
  ['Orange circle', 'orange_circle'],
  ['Yellow circle', 'yellow_circle'],
  ['Green circle', 'green_circle'],
  ['Purple circle', 'purple_circle'],
  ['Brown circle', 'brown_circle'],
  ['Black circle', 'black_circle'],
  ['White circle', 'white_circle'],
  // keycap numbers (same Fluent square-with-glyph style)
  ['Keycap 0', 'keycap_0'],
  ['Keycap 1', 'keycap_1'],
  ['Keycap 2', 'keycap_2'],
  ['Keycap 3', 'keycap_3'],
  ['Keycap 4', 'keycap_4'],
  ['Keycap 5', 'keycap_5'],
  ['Keycap 6', 'keycap_6'],
  ['Keycap 7', 'keycap_7'],
  ['Keycap 8', 'keycap_8'],
  ['Keycap 9', 'keycap_9'],
  ['Keycap 10', 'keycap_10'],
];

function fileSlug(folder) {
  return folder
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function downloadOne(folder, id) {
  const slug = fileSlug(folder);
  const url = `${RAW}/${encodeURIComponent(folder)}/3D/${slug}_3d.png`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${folder}: HTTP ${res.status} (${url})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = path.join(OUT, `${id}.png`);
  await writeFile(out, buf);
  return { id, folder, bytes: buf.length, out };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const ok = [];
  const fail = [];
  for (const [folder, id] of ITEMS) {
    try {
      const r = await downloadOne(folder, id);
      ok.push(r);
      console.log('OK', id, `(${r.bytes} B)`);
    } catch (e) {
      fail.push({ folder, id, error: String(e.message || e) });
      console.error('FAIL', id, e.message || e);
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  console.log(`\nDone: ${ok.length} ok, ${fail.length} fail → ${OUT}`);
  if (fail.length) process.exitCode = 1;
}

main();
