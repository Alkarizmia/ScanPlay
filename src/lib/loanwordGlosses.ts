/** Courtes définitions pédagogiques pour listes « mots français en anglais » (OCR / secours). */
const GLOSSES: Record<string, string> = {
  apéritif: 'Boisson servie avant le repas',
  aperitif: 'Boisson servie avant le repas',
  apostrophe: "Signe ’ pour la contraction ou la possession",
  'avant-garde': 'Groupe innovateur en art ou en idées',
  'bon voyage': 'Souhait de bon voyage',
  brunette: 'Femme aux cheveux bruns',
  champagne: 'Vin mousseux de la région de Reims',
  chauffeur: 'Conducteur, personne qui conduit',
  cliché: 'Idée ou image très répétée, stéréotype',
  'déjà vu': 'Impression d’avoir déjà vécu une situation',
  'deja vu': 'Impression d’avoir déjà vécu une situation',
  detour: 'Chemin plus long pour éviter un obstacle',
  dossier: 'Ensemble de documents sur un sujet',
  gallery: 'Salle ou espace pour exposer des œuvres',
  gastronomy: 'Art et culture de la bonne cuisine',
  liaison: 'Lien, connexion entre personnes ou choses',
  literature: 'Ensemble des œuvres écrites artistiques',
  machine: 'Appareil qui remplace ou aide le travail humain',
  metro: 'Métro, transport urbain souterrain',
  occasion: 'Moment favorable, opportunité',
  premiere: 'Première représentation ou diffusion',
  'rendez-vous': 'Rencontre fixée à une heure précise',
  restaurant: 'Établissement où l’on mange sur place',
  rich: 'Riche, abondant ou savoureux (sens figuré)',
  sabotage: 'Action de nuire secrètement à quelque chose',
  souvenir: 'Objet ou souvenir d’un lieu visité',
  technique: 'Méthode ou savoir-faire précis',
  television: 'Appareil et média de diffusion d’images',
  uniform: 'Tenue identique pour un groupe',
  valid: 'Valide, fondé ou en règle',
};

function normalizeKey(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function lookupLoanwordGloss(word: string): string | null {
  const key = normalizeKey(word);
  return GLOSSES[key] ?? null;
}
