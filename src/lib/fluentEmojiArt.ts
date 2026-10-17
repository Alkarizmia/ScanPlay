/**
 * Fluent UI 3D emoji art for Image Pick (and vocab visuals).
 * Assets: /public/fluent-emoji from https://github.com/microsoft/fluentui-emoji (MIT).
 * No yellow round smileys — everyday objects, clothes, tools, food, transport + human roles.
 */

export interface FluentEmojiArt {
  id: string;
  src: string;
  /** Multilingual aliases for ScanPlay decks (FR / EN / NL / ES / DE / …). */
  aliases: string[];
}

const src = (id: string) => `/fluent-emoji/${id}.png`;

export const FLUENT_EMOJI_ART: FluentEmojiArt[] = [
  { id: 'tshirt', src: src('tshirt'), aliases: ['tshirt', 't-shirt', 'tee', 'shirt', 'chemise', 'maglietta', 'camiseta', 'hemd'] },
  { id: 'jeans', src: src('jeans'), aliases: ['jeans', 'pantalon', 'pants', 'trousers', 'broek', 'pantalones', 'hose'] },
  { id: 'socks', src: src('socks'), aliases: ['socks', 'sock', 'chaussette', 'chaussettes', 'sok', 'sokken', 'calcetin', 'calcetines', 'socke'] },
  { id: 'shorts', src: src('shorts'), aliases: ['shorts', 'short', 'kurze hose'] },
  { id: 'coat', src: src('coat'), aliases: ['coat', 'manteau', 'jas', 'abrigo', 'mantel'] },
  { id: 'dress', src: src('dress'), aliases: ['dress', 'robe', 'jurk', 'vestido', 'kleid'] },
  { id: 'gloves', src: src('gloves'), aliases: ['gloves', 'glove', 'gant', 'gants', 'handschoen', 'guante', 'handschuh'] },
  { id: 'cap', src: src('cap'), aliases: ['cap', 'casquette', 'pet', 'gorra', 'kappe', 'hat', 'chapeau', 'hoed', 'sombrero'] },
  { id: 'shoe', src: src('shoe'), aliases: ['shoe', 'chaussure', 'schoen', 'zapato', 'schuh'] },
  { id: 'running_shoe', src: src('running_shoe'), aliases: ['sneaker', 'sneakers', 'basket', 'baskets', 'running shoe', 'sportschoen'] },
  { id: 'boot', src: src('boot'), aliases: ['boot', 'boots', 'botte', 'bottes', 'laars', 'bota', 'stiefel'] },
  { id: 'sandal', src: src('sandal'), aliases: ['sandal', 'sandale', 'sandaal', 'sandalia'] },
  { id: 'necktie', src: src('necktie'), aliases: ['necktie', 'tie', 'cravate', 'stropdas', 'corbata', 'krawatte'] },
  { id: 'lab_coat', src: src('lab_coat'), aliases: ['lab coat', 'blouse', 'kittel'] },
  { id: 'glasses', src: src('glasses'), aliases: ['glasses', 'lunettes', 'bril', 'gafas', 'brille'] },

  { id: 'money_bag', src: src('money_bag'), aliases: ['money', 'argent', 'geld', 'dinero', 'geldbeutel', 'money bag', 'cash'] },
  { id: 'dollar', src: src('dollar'), aliases: ['dollar', 'banknote', 'billet', 'billete', 'schein'] },
  { id: 'euro', src: src('euro'), aliases: ['euro', 'euros'] },
  { id: 'coin', src: src('coin'), aliases: ['coin', 'piece', 'pièce', 'munt', 'moneda', 'munze', 'münze'] },
  { id: 'credit_card', src: src('credit_card'), aliases: ['credit card', 'card', 'carte', 'kaart', 'tarjeta', 'karte'] },
  { id: 'shopping_cart', src: src('shopping_cart'), aliases: ['shopping cart', 'cart', 'caddie', 'winkelwagen', 'carrito'] },
  { id: 'shopping_bags', src: src('shopping_bags'), aliases: ['shopping bags', 'bags', 'sacs', 'tassen'] },
  { id: 'handbag', src: src('handbag'), aliases: ['handbag', 'purse', 'sac', 'handtas', 'bolso', 'handtasche', 'bag'] },
  { id: 'backpack', src: src('backpack'), aliases: ['backpack', 'sac a dos', "sac à dos", 'rugzak', 'mochila', 'rucksack'] },
  { id: 'luggage', src: src('luggage'), aliases: ['luggage', 'suitcase', 'valise', 'koffer', 'maleta'] },
  { id: 'package', src: src('package'), aliases: ['package', 'parcel', 'colis', 'pakket', 'paquete', 'paket'] },

  { id: 'key', src: src('key'), aliases: ['key', 'cle', 'clé', 'sleutel', 'llave', 'schlussel', 'schlüssel'] },
  { id: 'door', src: src('door'), aliases: ['door', 'porte', 'deur', 'puerta', 'tur', 'tür'] },
  { id: 'chair', src: src('chair'), aliases: ['chair', 'chaise', 'stoel', 'silla', 'stuhl'] },
  { id: 'bed', src: src('bed'), aliases: ['bed', 'lit', 'bed', 'cama', 'bett'] },
  { id: 'mirror', src: src('mirror'), aliases: ['mirror', 'miroir', 'spiegel', 'espejo'] },
  { id: 'bathtub', src: src('bathtub'), aliases: ['bathtub', 'bath', 'baignoire', 'badkuip', 'banera', 'badewanne'] },
  { id: 'soap', src: src('soap'), aliases: ['soap', 'savon', 'zeep', 'jabon', 'seife'] },
  { id: 'toothbrush', src: src('toothbrush'), aliases: ['toothbrush', 'brosse a dents', 'brosse à dents', 'tandenborstel', 'cepillo'] },
  { id: 'broom', src: src('broom'), aliases: ['broom', 'balai', 'bezem', 'escoba', 'besen'] },
  { id: 'basket', src: src('basket'), aliases: ['basket', 'panier', 'mand', 'cesta', 'korb'] },
  { id: 'bucket', src: src('bucket'), aliases: ['bucket', 'seau', 'emmer', 'cubo', 'eimer'] },
  { id: 'locked', src: src('locked'), aliases: ['lock', 'locked', 'cadenas', 'slot', 'candado', 'schloss'] },
  { id: 'light_bulb', src: src('light_bulb'), aliases: ['light bulb', 'bulb', 'ampoule', 'lamp', 'lampe', 'bombilla', 'gluhbirne', 'glühbirne'] },
  { id: 'flashlight', src: src('flashlight'), aliases: ['flashlight', 'torch', 'lampe torche', 'zaklamp', 'linterna', 'taschenlampe'] },
  { id: 'candle', src: src('candle'), aliases: ['candle', 'bougie', 'kaars', 'vela', 'kerze'] },
  { id: 'battery', src: src('battery'), aliases: ['battery', 'pile', 'batterij', 'bateria', 'batterie'] },
  { id: 'electric_plug', src: src('electric_plug'), aliases: ['plug', 'prise', 'stekker', 'enchufe', 'stecker'] },
  { id: 'alarm_clock', src: src('alarm_clock'), aliases: ['alarm clock', 'clock', 'horloge', 'reveil', 'réveil', 'wekker', 'reloj', 'uhr'] },
  { id: 'watch', src: src('watch'), aliases: ['watch', 'montre', 'horloge', 'horloge', 'horloge', 'horloge', 'polshorloge', 'reloj', 'uhr'] },
  { id: 'bell', src: src('bell'), aliases: ['bell', 'cloche', 'bel', 'campana', 'glocke'] },
  { id: 'television', src: src('television'), aliases: ['television', 'tv', 'tele', 'télé', 'televisie', 'television', 'fernseher'] },
  { id: 'camera', src: src('camera'), aliases: ['camera', 'appareil photo', 'camera', 'camara', 'kamera'] },
  { id: 'phone', src: src('phone'), aliases: ['phone', 'telephone', 'téléphone', 'mobile', 'gsm', 'handy', 'telefono', 'telefoon'] },
  { id: 'laptop', src: src('laptop'), aliases: ['laptop', 'ordinateur', 'computer', 'pc', 'portable', 'ordenador', 'rechner'] },
  { id: 'umbrella', src: src('umbrella'), aliases: ['umbrella', 'parapluie', 'paraplu', 'paraguas', 'regenschirm'] },

  { id: 'book', src: src('book'), aliases: ['book', 'livre', 'boek', 'libro', 'buch', 'to read', 'lire', 'lezen', 'leer', 'lesen'] },
  { id: 'books', src: src('books'), aliases: ['books', 'livres', 'boeken', 'libros', 'bucher', 'bücher'] },
  { id: 'notebook', src: src('notebook'), aliases: ['notebook', 'cahier', 'schrift', 'cuaderno', 'heft'] },
  { id: 'pencil', src: src('pencil'), aliases: ['pencil', 'crayon', 'potlood', 'lapiz', 'bleistift'] },
  { id: 'pen', src: src('pen'), aliases: ['pen', 'stylo', 'pen', 'boligrafo', 'kugelschreiber'] },
  { id: 'fountain_pen', src: src('fountain_pen'), aliases: ['fountain pen', 'stylo plume', 'vulpen'] },
  { id: 'crayon', src: src('crayon'), aliases: ['crayon', 'pastel', 'wasco', 'kreide'] },
  { id: 'paintbrush', src: src('paintbrush'), aliases: ['paintbrush', 'pinceau', 'kwast', 'pincel', 'pinsel'] },
  { id: 'scissors', src: src('scissors'), aliases: ['scissors', 'ciseaux', 'schaar', 'tijeras', 'schere'] },
  { id: 'ruler', src: src('ruler'), aliases: ['ruler', 'regle', 'règle', 'liniaal', 'regla', 'lineal'] },
  { id: 'paperclip', src: src('paperclip'), aliases: ['paperclip', 'trombone', 'paperclip', 'clip'] },
  { id: 'bookmark', src: src('bookmark'), aliases: ['bookmark', 'marque-page', 'bladwijzer', 'marcapaginas'] },
  { id: 'clipboard', src: src('clipboard'), aliases: ['clipboard', 'presse-papiers', 'klembord'] },
  { id: 'memo', src: src('memo'), aliases: ['memo', 'note', 'notitie'] },
  { id: 'school', src: src('school'), aliases: ['school', 'ecole', 'école', 'escuela', 'schule'] },

  { id: 'plate', src: src('plate'), aliases: ['plate', 'assiette', 'bord', 'plato', 'teller', 'fork', 'knife', 'couverts'] },
  { id: 'knife', src: src('knife'), aliases: ['knife', 'couteau', 'mes', 'cuchillo', 'messer'] },
  { id: 'cooking', src: src('cooking'), aliases: ['cooking', 'cook', 'cuisine', 'koken', 'cocinar', 'kochen', 'pot'] },
  { id: 'coffee', src: src('coffee'), aliases: ['coffee', 'cafe', 'café', 'koffie', 'kaffee', 'hot beverage'] },
  { id: 'cup', src: src('cup'), aliases: ['cup', 'tasse', 'beker', 'taza', 'tasse', 'verre', 'glass', 'drink', 'boire', 'drinken', 'beber'] },
  { id: 'teapot', src: src('teapot'), aliases: ['teapot', 'theiere', 'théière', 'theepot'] },
  { id: 'milk', src: src('milk'), aliases: ['milk', 'lait', 'melk', 'leche', 'milch'] },
  { id: 'bread', src: src('bread'), aliases: ['bread', 'pain', 'brood', 'pan', 'brot'] },
  { id: 'baguette', src: src('baguette'), aliases: ['baguette'] },
  { id: 'cheese', src: src('cheese'), aliases: ['cheese', 'fromage', 'kaas', 'queso', 'kase', 'käse'] },
  { id: 'pizza', src: src('pizza'), aliases: ['pizza'] },
  { id: 'sandwich', src: src('sandwich'), aliases: ['sandwich', 'boterham'] },
  { id: 'apple', src: src('apple'), aliases: ['apple', 'pomme', 'appel', 'manzana', 'apfel'] },
  { id: 'banana', src: src('banana'), aliases: ['banana', 'banane', 'banaan', 'platano'] },
  { id: 'orange', src: src('orange'), aliases: ['orange', 'tangerine', 'mandarine'] },
  { id: 'strawberry', src: src('strawberry'), aliases: ['strawberry', 'fraise', 'aardbei', 'fresa', 'erdbeere'] },
  { id: 'tomato', src: src('tomato'), aliases: ['tomato', 'tomate', 'tomaat'] },
  { id: 'carrot', src: src('carrot'), aliases: ['carrot', 'carotte', 'wortel', 'zanahoria', 'karotte'] },
  { id: 'egg', src: src('egg'), aliases: ['egg', 'oeuf', 'œuf', 'ei', 'huevo'] },
  { id: 'butter', src: src('butter'), aliases: ['butter', 'beurre', 'boter', 'mantequilla'] },

  { id: 'sun', src: src('sun'), aliases: ['sun', 'soleil', 'zon', 'sol', 'sonne'] },
  { id: 'moon', src: src('moon'), aliases: ['moon', 'lune', 'maan', 'luna', 'mond'] },
  { id: 'cloud', src: src('cloud'), aliases: ['cloud', 'nuage', 'wolk', 'nube', 'wolke'] },
  { id: 'water', src: src('water'), aliases: ['water', 'eau', 'agua', 'wasser', 'droplet', 'soif', 'thirsty'] },
  { id: 'fire', src: src('fire'), aliases: ['fire', 'feu', 'vuur', 'fuego', 'feuer'] },
  { id: 'tree', src: src('tree'), aliases: ['tree', 'arbre', 'boom', 'arbol', 'árbol', 'baum'] },
  { id: 'flower', src: src('flower'), aliases: ['flower', 'fleur', 'bloem', 'flor', 'blume'] },

  { id: 'dog', src: src('dog'), aliases: ['dog', 'chien', 'hond', 'perro', 'hund'] },
  { id: 'cat', src: src('cat'), aliases: ['cat', 'chat', 'kat', 'gato', 'katze'] },
  { id: 'bird', src: src('bird'), aliases: ['bird', 'oiseau', 'vogel', 'pajaro', 'pájaro', 'vogel'] },
  { id: 'fish', src: src('fish'), aliases: ['fish', 'poisson', 'vis', 'pez', 'fisch'] },

  { id: 'car', src: src('car'), aliases: ['car', 'voiture', 'auto', 'coche', 'wagen', 'drive', 'conduire', 'rijden', 'conducir'] },
  { id: 'bus', src: src('bus'), aliases: ['bus', 'autobus', 'omnibus'] },
  { id: 'bike', src: src('bike'), aliases: ['bike', 'bicycle', 'velo', 'vélo', 'fiets', 'bicicleta', 'fahrrad', 'cycle', 'cycling'] },
  { id: 'motorcycle', src: src('motorcycle'), aliases: ['motorcycle', 'moto', 'motor'] },
  { id: 'plane', src: src('plane'), aliases: ['plane', 'airplane', 'avion', 'vliegtuig', 'avion', 'flugzeug'] },
  { id: 'train', src: src('train'), aliases: ['train', 'trein', 'tren', 'zug'] },
  { id: 'ship', src: src('ship'), aliases: ['ship', 'bateau', 'boot', 'barco', 'schiff', 'boat'] },
  { id: 'house', src: src('house'), aliases: ['house', 'maison', 'huis', 'casa', 'haus', 'home', 'habiter', 'wonen', 'vivir'] },
  { id: 'hospital', src: src('hospital'), aliases: ['hospital', 'hopital', 'hôpital', 'ziekenhuis', 'krankenhaus'] },
  { id: 'bank', src: src('bank'), aliases: ['bank', 'banque', 'banco'] },
  { id: 'hotel', src: src('hotel'), aliases: ['hotel', 'hôtel'] },
  { id: 'ambulance', src: src('ambulance'), aliases: ['ambulance'] },
  { id: 'fire_engine', src: src('fire_engine'), aliases: ['fire engine', 'firetruck', 'camion de pompiers'] },

  { id: 'hammer', src: src('hammer'), aliases: ['hammer', 'marteau', 'hamer', 'martillo', 'hammer'] },
  { id: 'wrench', src: src('wrench'), aliases: ['wrench', 'cle a molette', 'clé à molette', 'moersleutel', 'llave inglesa'] },
  { id: 'axe', src: src('axe'), aliases: ['axe', 'hache', 'bijl', 'hacha', 'axt'] },
  { id: 'nut_bolt', src: src('nut_bolt'), aliases: ['nut and bolt', 'bolt', 'boulon', 'bout'] },
  { id: 'gear', src: src('gear'), aliases: ['gear', 'engrenage', 'tandwiel', 'engranaje', 'zahnrad'] },
  { id: 'ladder', src: src('ladder'), aliases: ['ladder', 'echelle', 'échelle', 'ladder', 'escalera', 'leiter'] },
  { id: 'balance', src: src('balance'), aliases: ['balance', 'scale', 'waage', 'balanza'] },

  { id: 'cook', src: src('cook'), aliases: ['cook', 'chef', 'cuisinier', 'kok', 'cocinero', 'koch'] },
  { id: 'mechanic', src: src('mechanic'), aliases: ['mechanic', 'mecanicien', 'mécanicien', 'monteur', 'mecanico'] },
  { id: 'firefighter', src: src('firefighter'), aliases: ['firefighter', 'pompier', 'brandweerman', 'bombero', 'feuerwehrmann'] },
  { id: 'artist', src: src('artist'), aliases: ['artist', 'artiste', 'kunstenaar', 'artista', 'kunstler', 'künstler'] },
  { id: 'teacher', src: src('teacher'), aliases: ['teacher', 'professeur', 'enseignant', 'leraar', 'profesor', 'lehrer'] },
  { id: 'student', src: src('student'), aliases: ['student', 'eleve', 'élève', 'leerling', 'estudiante', 'schuler', 'schüler'] },
  { id: 'man', src: src('man'), aliases: ['man', 'homme', 'man', 'hombre', 'mann'] },
  { id: 'girl', src: src('girl'), aliases: ['girl', 'fille', 'meisje', 'nina', 'niña', 'madchen', 'mädchen'] },
  { id: 'boy', src: src('boy'), aliases: ['boy', 'garcon', 'garçon', 'jongen', 'nino', 'niño', 'junge'] },
  { id: 'child', src: src('child'), aliases: ['child', 'enfant', 'kind', 'nino', 'niño'] },
  { id: 'farmer', src: src('farmer'), aliases: ['farmer', 'fermier', 'boer', 'granjero', 'bauer'] },
  { id: 'guard', src: src('guard'), aliases: ['guard', 'garde', 'bewaker', 'guardia'] },
];

function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[²₂]/g, '2')
    .replace(/[³₃]/g, '3')
    .replace(/^(de|het|een|le|la|les|un|une|the|a|an|el|los|las|l'|to)\s+/i, '')
    .replace(/[^a-z0-9\s'-]/g, '')
    .trim();
}

function stemCandidates(word: string): string[] {
  const out = [word];
  if (word.endsWith('ing') && word.length > 5) out.push(word.slice(0, -3));
  if (word.endsWith('ed') && word.length > 4) out.push(word.slice(0, -2));
  if (word.endsWith('es') && word.length > 4) out.push(word.slice(0, -2));
  if (word.endsWith('s') && word.length > 3) out.push(word.slice(0, -1));
  if (word.endsWith('en') && word.length > 4) out.push(word.slice(0, -2));
  return out;
}

const ALIAS_INDEX: Record<string, FluentEmojiArt> = {};
for (const art of FLUENT_EMOJI_ART) {
  for (const alias of art.aliases) {
    ALIAS_INDEX[normalizeWord(alias)] = art;
  }
}

export function lookupFluentEmoji(text: string): FluentEmojiArt | null {
  const word = normalizeWord(text);
  if (!word) return null;

  const tokens = [word, ...word.split(/\s+/).filter(Boolean)];
  for (const token of tokens) {
    for (const candidate of stemCandidates(token)) {
      const hit = ALIAS_INDEX[candidate];
      if (hit) return hit;
    }
  }
  return null;
}

export function resolvePairFluentEmoji(term: string, definition: string): FluentEmojiArt | null {
  return lookupFluentEmoji(term) ?? lookupFluentEmoji(definition);
}
