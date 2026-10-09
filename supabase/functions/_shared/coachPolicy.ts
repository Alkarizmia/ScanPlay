export type CoachPlan = 'free' | 'plus' | 'pro';

export const COACH_LIMITS = {
  free: { chatPerDay: 0, maxChars: 150, historyWindow: 0 },
  plus: { chatPerDay: 15, maxChars: 200, historyWindow: 4 },
  pro: { chatPerDay: 40, maxChars: 250, historyWindow: 7 },
} as const;

const PII_TOPIC =
  /\b(e-?mails?|courriels?|t[eé]l[eé]phones?|num[eé]ros?|whatsapp|instagram|discord|passwords?|mots? de passe|adresses? (mail|e-?mail|postales?)|date of birth|date de naissance)\b/i;

const OTHER_PERSON =
  /\b(de|d'|du|des|of|from|pour)\s+["«']?[a-zàâäéèêëïîôùûüç]{2,}/i;

const SELF =
  /\b(moi|mon|ma|mes|me|myself|my|mine|ik|mijn|yo|mi|mis)\b/i;

export function looksLikeOtherUserPii(message: string): boolean {
  const text = message.trim();
  if (!PII_TOPIC.test(text)) return false;
  if (SELF.test(text) && !OTHER_PERSON.test(text)) return false;
  return OTHER_PERSON.test(text) || /["«'][a-zàâäéèêëïîôùûüç]{2,}["»']/i.test(text);
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const ORDINAL_BEYOND: Record<number, RegExp> = {
  2: /\b(3(e|eme|ème)?|troisi[eè]me|4(e|eme|ème)?|quatri[eè]me|5(e|eme|ème)?|cinqui[eè]me|plus ancienne|older (sheet|fiche)|all (my )?history|tout (mon )?historique)\b/i,
  4: /\b(5(e|eme|ème)?|cinqui[eè]me|6(e|eme|ème)?|sixi[eè]me|7(e|eme|ème)?|septi[eè]me|plus ancienne)\b/i,
  7: /\b(8(e|eme|ème)?|huiti[eè]me|9(e|eme|ème)?|neuvi[eè]me|10(e|eme|ème)?|dixi[eè]me)\b/i,
};

export function asksLockedHistory(
  message: string,
  historyWindow: number,
  lockedTitles: string[],
  sheetCount = 0,
): boolean {
  const haystack = normalizeTitle(message);
  if (haystack.length >= 4) {
    const hitLocked = lockedTitles.some((title) => {
      const needle = normalizeTitle(title);
      return needle.length >= 4 && haystack.includes(needle);
    });
    if (hitLocked) return true;
  }
  if (sheetCount < historyWindow) return false;
  const ordinal = ORDINAL_BEYOND[historyWindow] ?? ORDINAL_BEYOND[2];
  return ordinal.test(message);
}

export function looksLikeSupportIssue(message: string): boolean {
  return /\b(support|bug|crash|paiement|stripe|rembours|refund|pirat|hack|compte (vol[ée]|supprim|bloqu)|ne (marche|fonctionne) pas|ça marche pas|ca marche pas|can't (log|sign)|connexion impossible|serveur|erreur technique)\b/i.test(
    message,
  );
}

export function refusePii(locale: string): string {
  if (locale.startsWith('en')) {
    return "I can't share another student's personal info (email, phone, address). Ask me about your own sheets.";
  }
  if (locale.startsWith('nl')) {
    return 'Ik mag geen persoonsgegevens van andere leerlingen geven (e-mail, telefoon, adres). Vraag me over je eigen bladen.';
  }
  if (locale.startsWith('es')) {
    return 'No puedo dar datos personales de otros alumnos (correo, teléfono, dirección). Pregúntame por tus propias fichas.';
  }
  return "Je ne peux pas donner les infos perso d'un autre élève (email, téléphone, adresse). Demande-moi plutôt tes propres fiches.";
}

export function refuseHistory(locale: string, window: number): string {
  if (locale.startsWith('en')) {
    return `I can only use your ${window} most recent sheets on this plan. Upgrade to go further back.`;
  }
  if (locale.startsWith('nl')) {
    return `Op dit plan zie ik alleen je ${window} nieuwste bladen. Upgrade om verder terug te gaan.`;
  }
  if (locale.startsWith('es')) {
    return `En este plan solo puedo usar tus ${window} fichas más recientes. Pasa de plan para ir más atrás.`;
  }
  return `Je n'ai accès qu'à tes ${window} dernières fiches avec ce plan. Passe à Plus ou Pro pour aller plus loin.`;
}

export function refuseSupport(locale: string): string {
  if (locale.startsWith('en')) {
    return 'That sounds like something I cannot fix here. Write to support@scanplay.org, they will help you.';
  }
  if (locale.startsWith('nl')) {
    return 'Dit klinkt als een écht probleem dat ik hier niet kan oplossen. Mail support@scanplay.org, zij helpen je.';
  }
  if (locale.startsWith('es')) {
    return 'Eso parece un problema real que yo no puedo resolver. Escribe a support@scanplay.org, te ayudarán.';
  }
  return "Là, c'est un vrai souci, je ne peux pas le régler dans le chat. Écris à support@scanplay.org, l'équipe t'aidera.";
}

function coachLang(locale: string): 'en' | 'nl' | 'es' | 'fr' {
  if (locale.startsWith('en')) return 'en';
  if (locale.startsWith('nl')) return 'nl';
  if (locale.startsWith('es')) return 'es';
  return 'fr';
}

export function looksLikeThanks(message: string): boolean {
  return /^(merci(\s+beaucoup)?|thanks?(?:\s+you)?|thx|ty|gracias|dank(jewel| je wel)?|de rien)[\s!.]*$/i.test(
    message.trim(),
  );
}

export function looksLikeNewUserAsk(message: string): boolean {
  return /\b(je suis nouveau|je suis nouvelle|i'?m new|new here|soy nuevo|soy nueva|ik ben nieuw)\b/i.test(message);
}

export function looksLikeScanHelp(message: string): boolean {
  return /\b(comment scanner|how (do i |to )?scan|hoe scan|c[oó]mo escane|scanner\s*\?|scanne|scan)\b/i.test(
    message,
  );
}

export function looksLikeBoost(message: string): boolean {
  return /\b(encourage[- ]moi|cheer me|moedig me|anímame|boost)\b/i.test(message);
}

export function looksLikeSettingsHelp(message: string): boolean {
  return /\b(param[eè]tres?|settings?|instellingen|ajustes|notifications?|langue|language|mot de passe|password)\b/i.test(
    message,
  );
}

/** Univers / Univer / Universe in ScanPlay (not "université"). */
export function looksLikeUniverseAsk(message: string): boolean {
  const text = message.trim();
  if (/\buniversit[eé]|university|universidad|universiteit\b/i.test(text)) return false;
  return /\b(univers|univer|universe|pix univers|apprendre l['']anglais|learn english|c[oœ]urs? univers|hearts? univers)\b/i.test(
    text,
  );
}

/** Réponse locale : pas d'IA, pas de crédit. Null = vrai appel coach (fiches + question). */
export function localCoachReply(
  message: string,
  locale: string,
  opts: { sheetCount: number; isNewAccount?: boolean },
): string | null {
  if (looksLikeOtherUserPii(message)) return refusePii(locale);
  if (looksLikeSupportIssue(message)) return refuseSupport(locale);

  const lang = coachLang(locale);
  const empty = opts.sheetCount <= 0;

  if (looksLikeThanks(message)) {
    if (lang === 'en') {
      return empty
        ? "Anytime. I still need a sheet though: Home, then scan a photo of your notes."
        : "Anytime. Tell me what you want to revise on your last sheets.";
    }
    if (lang === 'nl') {
      return empty
        ? "Graag gedaan. Ik heb nog een blad nodig: Home, daarna een foto van je les scannen."
        : "Graag gedaan. Zeg maar wat je wilt herhalen op je laatste bladen.";
    }
    if (lang === 'es') {
      return empty
        ? "De nada. Aún me falta una ficha: Inicio, luego escanea una foto de tus apuntes."
        : "De nada. Dime qué quieres repasar de tus últimas fichas.";
    }
    return empty
      ? "Avec plaisir. Il me manque encore une fiche : Accueil, puis scanne une photo de ton cours."
      : "Avec plaisir. Dis-moi ce que tu veux réviser sur tes dernières fiches.";
  }

  if (looksLikeSettingsHelp(message)) {
    if (lang === 'en') {
      return "Open Settings from the gear on Home (top left of the bell). Language, notifications and account are there.\n\n[[action:settings]]";
    }
    if (lang === 'nl') {
      return "Open Instellingen via het tandwiel op Home (links van het belletje). Taal, meldingen en account staan daar.\n\n[[action:settings]]";
    }
    if (lang === 'es') {
      return "Abre Ajustes con el engranaje en Inicio (a la izquierda de la campana). Idioma, notificaciones y cuenta están ahí.\n\n[[action:settings]]";
    }
    return "Ouvre les paramètres via l'engrenage sur Accueil (à gauche de la cloche). Langue, notifications et compte sont là.\n\n[[action:settings]]";
  }

  if (looksLikeUniverseAsk(message)) {
    if (lang === 'en') {
      return "In ScanPlay, **Universe** is Pix’s ready-made course store. No scan needed.\n\nRight now you can learn English (A1 to C2), with chapters based on your goal. You get 3 hearts; a quiz mistake costs one, and each heart comes back in about 8 hours (or buy one in the Shop).\n\nOpen it here 👇\n[[action:universe]]";
    }
    if (lang === 'nl') {
      return "In ScanPlay is **Univers** de store met kant-en-klare Pix-cursussen. Geen scan nodig.\n\nNu kun je Engels leren (A1 tot C2), met hoofdstukken volgens jouw doel. Je hebt 3 harten; een fout in de quiz kost er één, en elk hart komt terug in ongeveer 8 uur (of koop er één in de Shop).\n\nOpen hier 👇\n[[action:universe]]";
    }
    if (lang === 'es') {
      return "En ScanPlay, **Universo** es la tienda de cursos listos de Pix. Sin escanear.\n\nAhora puedes aprender inglés (A1 a C2), con capítulos según tu objetivo. Tienes 3 corazones; un fallo en el quiz quita uno, y cada corazón vuelve en unas 8 h (o cómpralo en la Tienda).\n\nÁbrelo aquí 👇\n[[action:universe]]";
    }
    return "Dans ScanPlay, **Univers** c'est le store de cours prêts par Pix. Pas besoin de scanner.\n\nTu peux y apprendre l'anglais (A1 à C2), avec des chapitres selon ton objectif. Tu as 3 cœurs : une faute au quiz en enlève un, et chaque cœur revient en environ 8 h (ou tu en rachètes un dans la Boutique).\n\nOuvre-le ici 👇\n[[action:universe]]";
  }

  if (looksLikeScanHelp(message)) {
    if (lang === 'en') {
      return "Open Home, tap scan, photograph a page. When it shows up in History, come back and I can quiz you.\n\nTap here to scan 👇\n[[action:scan]]";
    }
    if (lang === 'nl') {
      return "Ga naar Home, tik op scannen, fotografeer een blad. Als het in je geschiedenis staat, kan ik je overhoren.\n\nTik hier om te scannen 👇\n[[action:scan]]";
    }
    if (lang === 'es') {
      return "Abre Inicio, pulsa escanear, fotografía una hoja. Cuando esté en el historial, te hago un test.\n\nPulsa aquí para escanear 👇\n[[action:scan]]";
    }
    return "Va sur Accueil, appuie sur scanner, prends une photo de ta page. Quand elle est dans l'historique, reviens, je pourrai te tester.\n\nAppuie ici pour scanner 👇\n[[action:scan]]";
  }

  if (looksLikeNewUserAsk(message)) {
    if (lang === 'en') {
      return "Welcome. Photo of a lesson from Home, we turn it into a game, then I help you. Nothing scanned yet, start there.\n\n[[action:scan]]";
    }
    if (lang === 'nl') {
      return "Welkom. Foto van je les via Home, wij maken er een spel van, daarna help ik je. Nog niets gescand, begin daar.\n\n[[action:scan]]";
    }
    if (lang === 'es') {
      return "Bienvenido. Foto de tu clase desde Inicio, lo convertimos en juego, luego te ayudo. Aún no hay escaneo, empieza por ahí.\n\n[[action:scan]]";
    }
    return "Bienvenue. Photo d'un cours depuis Accueil, on en fait un jeu, ensuite je t'aide. Tu n'as encore rien scanné, commence par là.\n\n[[action:scan]]";
  }

  if (looksLikeBoost(message)) {
    if (empty) {
      if (lang === 'en') return "You are in. The real first win is one scan from Home. Then we play.";
      if (lang === 'nl') return "Je bent er. De echte eerste winst is één scan via Home. Daarna spelen we.";
      if (lang === 'es') return "Ya estás dentro. El primer logro de verdad es un escaneo desde Inicio. Luego jugamos.";
      return "T'es lancé. Le vrai premier succès, c'est un scan depuis Accueil. Ensuite on joue.";
    }
    return null;
  }

  if (empty) {
    if (lang === 'en') {
      return "I can talk, but I have no sheet to quiz you on. Scan a lesson from Home first.\n\n[[action:scan]]";
    }
    if (lang === 'nl') {
      return "Ik kan praten, maar ik heb nog geen blad voor een quiz. Scan eerst een les via Home.\n\n[[action:scan]]";
    }
    if (lang === 'es') {
      return "Puedo hablar, pero no tengo ficha para un test. Escanea una lección desde Inicio.\n\n[[action:scan]]";
    }
    return "Je peux te parler, mais je n'ai pas de fiche pour un quiz. Scanne un cours depuis Accueil d'abord.\n\n[[action:scan]]";
  }

  return null;
}

export function refuseTooLong(locale: string, maxChars: number): string {
  if (locale.startsWith('en')) {
    return `That message is too long (${maxChars} characters max on this plan).`;
  }
  if (locale.startsWith('nl')) {
    return `Dat bericht is te lang (max. ${maxChars} tekens op dit plan).`;
  }
  if (locale.startsWith('es')) {
    return `Ese mensaje es demasiado largo (máximo ${maxChars} caracteres en este plan).`;
  }
  return `Ce message est trop long (max. ${maxChars} caractères sur ce plan).`;
}
