/** Make glued coach replies readable before render. */
export function normalizeCoachSpacing(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])\s+(?=\d+\.\s)/g, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type CoachActionId = 'scan' | 'settings' | 'home' | 'continue_chat' | 'continue_game' | 'export_word' | 'export_pdf';

const ACTION_RE =
  /\[\[action:(scan|settings|home|continue_chat|continue_game|export_word|export_pdf)\]\]/gi;

export function extractCoachActions(raw: string): { text: string; actions: CoachActionId[] } {
  const actions: CoachActionId[] = [];
  const text = raw
    .replace(ACTION_RE, (_full, id: string) => {
      const action = id.toLowerCase() as CoachActionId;
      if (!actions.includes(action)) actions.push(action);
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: normalizeCoachSpacing(text), actions };
}

/**
 * If Pix invites the user to scan / open settings / go home but forgot the
 * `[[action:…]]` tag (common with the live model), append it so the button shows.
 */
export function enrichCoachActions(raw: string): string {
  const { text, actions } = extractCoachActions(raw);
  const hay = text.toLowerCase();
  const add: CoachActionId[] = [];

  const invitesScan =
    /\b(scan+e|scanner|photograph|foto|photo|fiche|blad|escane)\b/i.test(hay) &&
    /\b(accueil|home|inicio|appuie|tap|tik|pulsa|bouton|button|commence|start|begin|directement)\b/i.test(
      hay,
    );
  const invitesSettings =
    /\b(param[eè]tres?|settings?|instellingen|ajustes|engrenage|tandwiel|gear)\b/i.test(hay);
  const invitesHome =
    !invitesScan &&
    /\b(retourne|reviens|va sur|go to|open|abre|ga naar)\b/i.test(hay) &&
    /\b(accueil|home|inicio)\b/i.test(hay);

  if (invitesScan && !actions.includes('scan')) add.push('scan');
  if (invitesSettings && !actions.includes('settings')) add.push('settings');
  if (invitesHome && !actions.includes('home') && !add.includes('scan')) add.push('home');
  if (/\b(continuer ici|continue here|hier verder|seguir aquí)\b/i.test(hay) && !actions.includes('continue_chat')) {
    add.push('continue_chat');
  }
  if (
    /\b(dans le jeu|in the game|in het spel|en el juego|lancer le parcours)\b/i.test(hay) &&
    !actions.includes('continue_game')
  ) {
    add.push('continue_game');
  }

  if (add.length === 0) {
    // Keep any tags that were already present.
    return actions.length === 0
      ? text
      : `${text}\n\n${actions.map((a) => `[[action:${a}]]`).join('\n')}`;
  }

  const all = [...actions, ...add];
  return `${text}\n\n${all.map((a) => `[[action:${a}]]`).join('\n')}`;
}

type CoachSegment = { type: 'text' | 'bold'; value: string };

/** Split `**bold**` markers into segments (no HTML). */
export function parseCoachSegments(raw: string): CoachSegment[] {
  const text = normalizeCoachSpacing(raw);
  const segments: CoachSegment[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) != null) {
    if (match.index > last) {
      segments.push({ type: 'text', value: text.slice(last, match.index) });
    }
    segments.push({ type: 'bold', value: match[1]! });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  if (segments.length === 0 && text) segments.push({ type: 'text', value: text });
  return segments;
}
