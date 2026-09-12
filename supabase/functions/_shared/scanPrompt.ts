/** Compact system prompts — keep vision tokens for the image + pairs JSON. */

export const SCANPLAY_VOCAB_SYSTEM_PROMPT = `Moteur d'extraction ScanPlay (vocabulaire).
Réponds UNIQUEMENT en JSON valide (schema imposé). N'invente pas.

Lecture: PHOTO = vérité. Parcours toute la page haut→bas ; chaque ligne du tableau = 1 carte.
Liste 2 colonnes (EN|FR, NL|FR, …): gauche=term, droite=definition (même ligne).
Corrige les erreurs OCR typiques: "Tobe"→"To be", "Tosee"→"To see", "de mander"→"demander".
INTERDIT: couper une phrase d'une seule langue en term+definition (ex. "De qui s'agit"→"il ?" / "La isse"→"le ici").
INTERDIT: FR→FR ou EN→EN si la fiche est bilingue. Une face = une langue.
INTERDIT: titre de fiche / headers (ex. "25 verbes…", "Anglais", "Français") comme cartes.
Extrais TOUTES les lignes jusqu'à maxPairs (pas d'échantillon 8/10/12).
Ignore titres, consignes, déco/drapeaux. Enlève [phonétique].
Opposés sur une ligne (riche/pauvre→rijk/arm): une carte par mot.
Conjugaison 3+ colonnes: term + faces[] + definition.
Grille pictos: term=libellé imprimé, definition=traduction FR courte.

Sortie: readable, sheetType, detectedLangs, pairs[{term,definition,faces,termLang,defLang,confidence}], warnings.
faces=[] si carte classique. readable=true dès ≥4 paires lisibles.`;

export const SCANPLAY_NOTES_SYSTEM_PROMPT = `Moteur d'extraction ScanPlay (notes/définitions).
JSON uniquement. N'invente pas.
Découpe en idées mémorables (term→definition), toutes les notions visibles jusqu'à maxPairs.
Si la photo est une liste 2 colonnes de traduction, sheetType="vocab" et aligne ligne à ligne (langue1→langue2).
Formules visibles → LaTeX. Ignore titres/consignes.
Sortie: readable, sheetType, detectedLangs, pairs[{term,definition,faces,termLang,defLang,confidence}], warnings.`;

export const SCANPLAY_MATH_SYSTEM_PROMPT = `Moteur d'extraction ScanPlay (math/sciences).
JSON uniquement. N'invente pas. PHOTO = vérité.

Table 2 colonnes (ex. Fonction f(x) | Dérivée f'(x)) :
- term = libellé/formule de GAUCHE (ex. "\\\\sin x", "x^n", "k (constante)")
- definition = formule de DROITE en LaTeX (ex. "\\\\cos x", "nx^{n-1}", "0")
Une ligne du tableau = 1 carte. Garde les réponses courtes ("0", "1", "k").

Autres fiches : term = libellé vu (Domaine, loi, grandeur…) ; definition = formule LaTeX ou fait court.
LaTeX : \\\\frac, ^{}, _{}, \\\\sqrt, \\\\sin, \\\\cos, \\\\tan, \\\\mathbb{R}…
Ignore titres, chapitres, noms de prof, numéros de page. Pas d'exercice type mémorisé.
Extrais TOUTES les lignes jusqu'à maxPairs.
readable=true dès ≥2 paires (une table de formules courte compte).

Sortie: readable, sheetType, detectedLangs, pairs[{term,definition,faces,termLang,defLang,confidence}], warnings.`;

export const SCANPLAY_DEFINITIONS_SYSTEM_PROMPT = `Moteur d'extraction ScanPlay (définitions / formules).
JSON uniquement. N'invente pas. PHOTO = vérité.
Découpe en idées mémorables (term→definition), toutes les notions visibles jusqu'à maxPairs.
Si tableau 2 colonnes notion|formule : term=gauche, definition=droite (LaTeX si maths).
Formules visibles → LaTeX. Ignore titres/consignes/noms de prof.
Si la photo est une liste 2 colonnes de traduction, sheetType="vocab" et aligne ligne à ligne.
Sortie: readable, sheetType, detectedLangs, pairs[{term,definition,faces,termLang,defLang,confidence}], warnings.`;

/** @deprecated Prefer sheet-type specific prompts via selectScanSystemPrompt. */
export const SCANPLAY_AI_SYSTEM_PROMPT = SCANPLAY_VOCAB_SYSTEM_PROMPT;

export function selectScanSystemPrompt(sheetType: string): string {
  if (sheetType === 'math') return SCANPLAY_MATH_SYSTEM_PROMPT;
  if (sheetType === 'definitions') return SCANPLAY_DEFINITIONS_SYSTEM_PROMPT;
  if (sheetType === 'notes') return SCANPLAY_NOTES_SYSTEM_PROMPT;
  return SCANPLAY_VOCAB_SYSTEM_PROMPT;
}

export const SCANPLAY_EXTRACT_JSON_SCHEMA = {
  name: 'scanplay_extract',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      readable: { type: 'boolean' },
      sheetType: { type: 'string', enum: ['vocab', 'notes', 'definitions', 'math'] },
      detectedLangs: { type: 'array', items: { type: 'string' } },
      pairs: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            term: { type: 'string' },
            definition: { type: 'string' },
            faces: { type: 'array', items: { type: 'string' } },
            termLang: { type: 'string', enum: ['nl', 'fr', 'en', 'es', 'unknown'] },
            defLang: { type: 'string', enum: ['nl', 'fr', 'en', 'es', 'unknown'] },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['term', 'definition', 'faces', 'termLang', 'defLang', 'confidence'],
        },
      },
      warnings: { type: 'array', items: { type: 'string' } },
    },
    required: ['readable', 'sheetType', 'detectedLangs', 'pairs', 'warnings'],
  },
} as const;

export function buildScanUserPrompt(sheetType: string, maxPairs = 100, plan = 'free'): string {
  if (sheetType === 'math') {
    return `Type=math plan=${plan} maxPairs=${maxPairs}.
Tableau formule→résultat : chaque ligne = 1 carte (term=gauche, definition=droite LaTeX).
Exemple dérivées: term="\\\\sin x" definition="\\\\cos x" ; term="x^n" definition="nx^{n-1}" ; term="k" definition="0".
Extrais toutes les lignes visibles. Ignore titres.`;
  }
  if (sheetType === 'definitions') {
    return `Type=definitions plan=${plan} maxPairs=${maxPairs}. Toutes les notions/formules visibles. Table 2 colonnes → term|definition. Si traduction bilingue → sheetType vocab.`;
  }
  if (sheetType === 'notes') {
    return `Type=notes plan=${plan} maxPairs=${maxPairs}. Toutes les notions visibles. Si 2 colonnes traduction → sheetType vocab.`;
  }
  return `Type=vocab plan=${plan} maxPairs=${maxPairs}.
Liste 2 colonnes: chaque ligne = 1 carte langue1→langue2 (ex. EN→FR).
Compte les lignes; renvoie autant de paires (plafond ${maxPairs}).
JAMAIS FR→FR / coupure de phrase / décalage de lignes (interdit: "J'arrive"→"J'ai mal à la tête"). Ignore déco.`;
}
