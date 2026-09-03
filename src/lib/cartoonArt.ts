/** Cartoon assets used when a scanned word matches a real-life object or related verb. */

export interface CartoonArt {
  id: string;
  src: string;
  aliases: string[];
}

export const CARTOON_ART: CartoonArt[] = [
  {
    id: 'eau',
    src: '/game-art/game-eau.png',
    aliases: [
      'eau', 'water', 'agua', 'waterglas', 'verre', 'glass', 'drink', 'boire', 'drinken', 'beber',
      'soif', 'thirsty', 'dorst', 'sed', 'boisson',
    ],
  },
  {
    id: 'voiture',
    src: '/game-art/game-voiture.png',
    aliases: [
      'voiture', 'car', 'auto', 'coche', 'wagen', 'drive', 'conduire', 'rijden', 'conducir',
      'conduire une voiture', 'to drive',
    ],
  },
  {
    id: 'maison',
    src: '/game-art/game-maison.png',
    aliases: [
      'maison', 'house', 'huis', 'casa', 'home', 'habiter', 'wonen', 'vivir', 'live', 'to live',
    ],
  },
  {
    id: 'velo',
    src: '/game-art/game-velo.png',
    aliases: [
      'velo', 'vélo', 'bicycle', 'bike', 'fiets', 'bicicleta', 'pédaler', 'fietsen', 'cycle',
      'to cycle', 'cycling',
    ],
  },
  {
    id: 'chat',
    src: '/game-art/game-chat.png',
    aliases: ['chat', 'cat', 'kat', 'gato', 'kitten', 'miauw', 'miauler'],
  },
  {
    id: 'pomme',
    src: '/game-art/game-pomme.png',
    aliases: ['pomme', 'apple', 'appel', 'manzana', 'manger une pomme'],
  },
  {
    id: 'livre',
    src: '/game-art/game-livre.png',
    aliases: [
      'livre', 'book', 'boek', 'libro', 'read', 'lire', 'lezen', 'leer', 'to read', 'reading',
    ],
  },
  {
    id: 'soleil',
    src: '/game-art/game-soleil.png',
    aliases: ['soleil', 'sun', 'zon', 'sol', 'briller', 'shine', 'schijnen'],
  },
  {
    id: 'arbre',
    src: '/game-art/game-arbre.png',
    aliases: ['arbre', 'tree', 'boom', 'arbol', 'árbol', 'plante', 'plant'],
  },
  {
    id: 'pain',
    src: '/game-art/game-pain.png',
    aliases: ['pain', 'bread', 'brood', 'pan', 'baguette', 'manger du pain'],
  },
  {
    id: 'telephone',
    src: '/game-art/game-telephone.png',
    aliases: [
      'telephone', 'téléphone', 'phone', 'smartphone', 'telefoon', 'teléfono',
      'call', 'appeler', 'bellen', 'llamar', 'to call',
    ],
  },
  {
    id: 'sac',
    src: '/game-art/game-sac.png',
    aliases: ['sac', 'backpack', 'bag', 'rugzak', 'mochila', 'cartable', 'porter', 'carry'],
  },
  {
    id: 'h2o',
    src: '/game-art/game-h2o.png',
    aliases: ['h2o', 'h₂o', 'molecule', 'molécule', 'molecuul', 'water molecule'],
  },
  {
    id: 'horloge',
    src: '/game-art/game-horloge.png',
    aliases: ['horloge', 'clock', 'klok', 'reloj', 'alarm', 'heure', 'time', 'tijd', 'tiempo'],
  },
  {
    id: 'eclair',
    src: '/game-art/game-eclair.png',
    aliases: ['eclair', 'éclair', 'lightning', 'bliksem', 'rayo', 'foudre', 'orage', 'storm'],
  },
  {
    id: 'thermometre',
    src: '/game-art/game-thermometre.png',
    aliases: [
      'thermometre', 'thermomètre', 'thermometer', 'temperatuur', 'temperature',
      'fièvre', 'koorts',
    ],
  },
  {
    id: 'terre',
    src: '/game-art/game-terre.png',
    aliases: ['terre', 'earth', 'aarde', 'tierra', 'globe', 'monde', 'world', 'planet', 'planète'],
  },
  {
    id: 'coeur',
    src: '/game-art/game-coeur.png',
    aliases: ['coeur', 'cœur', 'heart', 'hart', 'corazon', 'corazón'],
  },
  {
    id: 'feu',
    src: '/game-art/game-feu.png',
    aliases: ['feu', 'fire', 'vuur', 'fuego', 'flamme', 'flame', 'bruler', 'brûler', 'burn'],
  },
  {
    id: 'balance',
    src: '/game-art/game-balance.png',
    aliases: ['balance', 'scale', 'weegschaal', 'balanza', 'masse', 'peser', 'weigh', 'wegen'],
  },
  {
    id: 'chien',
    src: '/game-art/game-chien.png',
    aliases: ['chien', 'dog', 'hond', 'perro', 'puppy', 'chiot', 'aboyer', 'bark', 'blaffen'],
  },
  {
    id: 'oiseau',
    src: '/game-art/game-oiseau.png',
    aliases: ['oiseau', 'bird', 'vogel', 'pajaro', 'pájaro', 'voler', 'vliegen', 'to fly'],
  },
  {
    id: 'banane',
    src: '/game-art/game-banane.png',
    aliases: ['banane', 'banana', 'banaan', 'plátano', 'platano'],
  },
  {
    id: 'bus',
    src: '/game-art/game-bus.png',
    aliases: ['bus', 'autobus', 'autocar', 'schoolbus', 'autobus scolaire'],
  },
  {
    id: 'porte',
    src: '/game-art/game-porte.png',
    aliases: ['porte', 'door', 'deur', 'puerta', 'ouvrir', 'open', 'openen', 'abrir'],
  },
  {
    id: 'chaise',
    src: '/game-art/game-chaise.png',
    aliases: ['chaise', 'chair', 'stoel', 'silla', 's\'asseoir', 'sit', 'zitten', 'sentarse'],
  },
  {
    id: 'cle',
    src: '/game-art/game-cle.png',
    aliases: ['cle', 'clé', 'key', 'sleutel', 'llave'],
  },
  {
    id: 'chaussure',
    src: '/game-art/game-chaussure.png',
    aliases: ['chaussure', 'shoe', 'schoen', 'zapato', 'basket', 'sneaker'],
  },
  {
    id: 'poisson',
    src: '/game-art/game-poisson.png',
    aliases: ['poisson', 'fish', 'vis', 'pez', 'nager', 'swim', 'zwemmen', 'nadar'],
  },
  {
    id: 'lune',
    src: '/game-art/game-lune.png',
    aliases: ['lune', 'moon', 'maan', 'luna'],
  },
  {
    id: 'fleur',
    src: '/game-art/game-fleur.png',
    aliases: ['fleur', 'flower', 'bloem', 'flor'],
  },
  {
    id: 'lait',
    src: '/game-art/game-lait.png',
    aliases: ['lait', 'milk', 'melk', 'leche'],
  },
  {
    id: 'crayon',
    src: '/game-art/game-crayon.png',
    aliases: ['crayon', 'pencil', 'potlood', 'lapiz', 'lápiz', 'ecrire', 'écrire', 'write', 'schrijven', 'escribir'],
  },
  {
    id: 'ballon',
    src: '/game-art/game-ballon.png',
    aliases: ['ballon', 'ball', 'bal', 'pelota', 'jouer au ballon'],
  },
  {
    id: 'parapluie',
    src: '/game-art/game-parapluie.png',
    aliases: ['parapluie', 'umbrella', 'paraplu', 'paraguas', 'pluie', 'rain', 'regen', 'lluvia'],
  },
  {
    id: 'lit',
    src: '/game-art/game-lit.png',
    aliases: ['lit', 'bed', 'cama', 'dormir', 'sleep', 'slapen'],
  },
  {
    id: 'avion',
    src: '/game-art/game-avion.png',
    aliases: ['avion', 'plane', 'airplane', 'vliegtuig', 'avioneta', 'aeroplano'],
  },
  {
    id: 'bateau',
    src: '/game-art/game-bateau.png',
    aliases: ['bateau', 'boat', 'ship', 'boot', 'barco', 'naviguer', 'sail', 'varen'],
  },
  {
    id: 'train',
    src: '/game-art/game-train.png',
    aliases: ['train', 'trein', 'tren', 'locomotive', 'locomotief'],
  },
  {
    id: 'table',
    src: '/game-art/game-table.png',
    aliases: ['table', 'desk', 'tafel', 'mesa'],
  },
  {
    id: 'fenetre',
    src: '/game-art/game-fenetre.png',
    aliases: ['fenetre', 'fenêtre', 'window', 'raam', 'ventana'],
  },
  {
    id: 'ordinateur',
    src: '/game-art/game-ordinateur.png',
    aliases: ['ordinateur', 'computer', 'laptop', 'pc', 'ordenador', 'portable'],
  },
  {
    id: 'tasse',
    src: '/game-art/game-tasse.png',
    aliases: ['tasse', 'cup', 'mug', 'kop', 'taza', 'cafe', 'café', 'coffee', 'koffie', 'thé', 'tea', 'thee'],
  },
  {
    id: 'fromage',
    src: '/game-art/game-fromage.png',
    aliases: ['fromage', 'cheese', 'kaas', 'queso'],
  },
  {
    id: 'orange',
    src: '/game-art/game-orange.png',
    aliases: ['orange', 'sinaasappel', 'naranja'],
  },
  {
    id: 'ecole',
    src: '/game-art/game-ecole.png',
    aliases: ['ecole', 'école', 'school', 'schoolgebouw', 'colegio', 'escuela'],
  },
  {
    id: 'nuage',
    src: '/game-art/game-nuage.png',
    aliases: ['nuage', 'cloud', 'wolk', 'nube'],
  },
  {
    id: 'chapeau',
    src: '/game-art/game-chapeau.png',
    aliases: ['chapeau', 'hat', 'hoed', 'sombrero'],
  },
  {
    id: 'pizza',
    src: '/game-art/game-pizza.png',
    aliases: ['pizza', 'part de pizza'],
  },
  {
    id: 'ciseaux',
    src: '/game-art/game-ciseaux.png',
    aliases: ['ciseaux', 'scissors', 'schaar', 'tijeras'],
  },
  {
    id: 'gomme',
    src: '/game-art/game-gomme.png',
    aliases: ['gomme', 'eraser', 'gum', 'goma', 'radiergummi'],
  },
  {
    id: 'assiette',
    src: '/game-art/game-assiette.png',
    aliases: ['assiette', 'plate', 'bord', 'plato'],
  },
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

const ALIAS_INDEX: Record<string, CartoonArt> = {};
for (const art of CARTOON_ART) {
  for (const alias of art.aliases) {
    ALIAS_INDEX[normalizeWord(alias)] = art;
  }
}

export function lookupCartoonArt(text: string): CartoonArt | null {
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

export function resolvePairCartoon(term: string, definition: string): CartoonArt | null {
  return lookupCartoonArt(term) ?? lookupCartoonArt(definition);
}
