export type CoachPlan = 'free' | 'plus' | 'pro' | 'max';

/** Soft UX caps only — daily message quotas removed; AI envelope is the ceiling. */
export const COACH_LIMITS = {
  free: { chatPerDay: 9999, maxChars: 4000, historyWindow: 7 },
  plus: { chatPerDay: 9999, maxChars: 4000, historyWindow: 15 },
  pro: { chatPerDay: 9999, maxChars: 4000, historyWindow: 25 },
  max: { chatPerDay: 9999, maxChars: 4000, historyWindow: 40 },
} as const;

function normalizeCoachPlan(plan?: string): CoachPlan {
  if (plan === 'plus' || plan === 'pro' || plan === 'max') return plan;
  return 'free';
}

/** Univers hearts sentence from the user's plan (Free 3 / Plus 5 / Pro·Max ∞). */
function universeHeartsForPlan(lang: 'en' | 'nl' | 'es' | 'fr', plan?: string): string {
  const p = normalizeCoachPlan(plan);
  if (p === 'pro' || p === 'max') {
    const label = p === 'max' ? 'Max' : 'Pro';
    if (lang === 'en') {
      return `As a **${label}** perk, you have **unlimited hearts** in Universe: quiz mistakes don't cost a life.`;
    }
    if (lang === 'nl') {
      return `Als **${label}**-voordeel heb je **oneindige harten** in Univers: quizfouten kosten geen leven.`;
    }
    if (lang === 'es') {
      return `Como privilegio **${label}**, tienes **corazones infinitos** en Universo: los fallos del quiz no quitan vidas.`;
    }
    return `Privilège **${label}** : tu as les **cœurs infinis** dans Univers. Une faute au quiz ne t'enlève pas de vie.`;
  }
  if (p === 'plus') {
    if (lang === 'en') {
      return `On **Plus**, you get **5 hearts**: a quiz mistake costs one, and each heart comes back in about 4 hours (or buy one in the Shop).`;
    }
    if (lang === 'nl') {
      return `Op **Plus** heb je **5 harten**: een fout in de quiz kost er één, en elk hart komt terug in ongeveer 4 uur (of koop er één in de Shop).`;
    }
    if (lang === 'es') {
      return `En **Plus** tienes **5 corazones**: un fallo en el quiz quita uno, y cada corazón vuelve en unas 4 h (o cómpralo en la Tienda).`;
    }
    return `Sur **Plus**, tu as **5 cœurs** : une faute au quiz en enlève un, et chaque cœur revient en environ 4 h (ou tu en rachètes un dans la Boutique).`;
  }
  if (lang === 'en') {
    return `You get 3 hearts: a quiz mistake costs one, and each heart comes back in about 8 hours (or buy one in the Shop).`;
  }
  if (lang === 'nl') {
    return `Je hebt 3 harten: een fout in de quiz kost er één, en elk hart komt terug in ongeveer 8 uur (of koop er één in de Shop).`;
  }
  if (lang === 'es') {
    return `Tienes 3 corazones: un fallo en el quiz quita uno, y cada corazón vuelve en unas 8 h (o cómpralo en la Tienda).`;
  }
  return `Tu as 3 cœurs : une faute au quiz en enlève un, et chaque cœur revient en environ 8 h (ou tu en rachètes un dans la Boutique).`;
}

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

/** Questions about ScanPlay AI envelope / usage % (not sheet history window). */
export function looksLikeAiUsageAsk(message: string): boolean {
  const text = message.trim();
  if (/\d+\s*%/.test(text)) return true;
  if (/%\s*(utilis|used|gebruik|usado|مستخد)/i.test(text)) return true;
  return /\b(limite\s*ai|limite\s*ia|enveloppe|quota\s*ai|quota\s*ia|usage\s*ai|ai\s*limit|ai\s*usage|token|combien\s*(de\s*)?(limite|pour\s*cent)|en\s*%|percent|pourcentage|barre\s*(ia|ai)|scanplay\s*ai|utilis[eé](r|s)?\s*.*%|j'?ai\s*utilis)/i.test(
    text,
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

/** User asks if the coach remembers / saw the photo or file they sent. */
export function looksLikePhotoRecallAsk(message: string): boolean {
  const text = message.trim();
  if (
    /\b(pas encore|jamais|pas (du tout )?envoy|haven't|have not|not (yet )?sent|geen .*gestuurd|aún no|todavía no)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  const aboutMedia = /\b(photo|image|fichier|picture|file|png|jpe?g|img)\b/i.test(text);
  const aboutRecall =
    /\b(rappel\w*|souviens\w*|remember\w*|re[cç]u|seen|tu as (vu|reçu)|what i (sent|shared)|ce que je t['']ai envoy)\b/i.test(
      text,
    );
  return aboutMedia && aboutRecall;
}

/** User wants a PDF / Word export (not “can I upload a PDF?”). */
export function looksLikeExportAsk(message: string): 'pdf' | 'word' | 'both' | null {
  const text = message.trim();
  const hasPdf = /\bpdf\b/i.test(text);
  const hasWord = /\b(word|docx)\b/i.test(text);
  const hasSynthExport =
    /\b(synthèse|synthese|synthesis)\b/i.test(text) &&
    /\b(export|télécharg|telecharg|download|imprim|print|pdf|word)\b/i.test(text);
  if (!hasPdf && !hasWord && !hasSynthExport) return null;

  if (
    /\b(support[eé]?s?|accepte[sr]?|compatible|import(er)?|upload|ouvrir un|open a|fichier pdf)\b/i.test(
      text,
    ) &&
    !/\b(crée|créer|fais|fait|génère|genere|export|télécharge|telecharge|download|make|create|donne|give|haz|maak)\b/i.test(
      text,
    )
  ) {
    return null;
  }

  if (hasPdf && hasWord) return 'both';
  if (hasPdf) return 'pdf';
  if (hasWord) return 'word';
  return 'both';
}

/** Réponse locale : pas d'IA, pas de crédit. Null = vrai appel coach (fiches + question). */
export function localCoachReply(
  message: string,
  locale: string,
  opts: {
    sheetCount: number;
    isNewAccount?: boolean;
    aiUsagePercent?: number;
    aiEnvelopeLabel?: string;
    plan?: string;
    sheetPreview?: { title: string; count: number; sample: string } | null;
  },
): string | null {
  if (looksLikeOtherUserPii(message)) return refusePii(locale);
  if (looksLikeSupportIssue(message)) return refuseSupport(locale);

  const lang = coachLang(locale);
  const empty = opts.sheetCount <= 0;
  const pct = Math.max(0, Math.min(100, Math.round(opts.aiUsagePercent ?? 0)));
  const envelope = opts.aiEnvelopeLabel?.trim() || (lang === 'en' ? 'your plan' : 'ton plan');
  const preview = opts.sheetPreview;

  if (looksLikePhotoRecallAsk(message)) {
    if (preview && preview.count > 0) {
      if (lang === 'en') {
        return `Yes. Your photo is in my memory as **${preview.title}** (${preview.count} cards: ${preview.sample}). Ask me anything about it, or export a PDF.\n\n[[action:export_pdf]]\n[[action:continue_game]]`;
      }
      if (lang === 'nl') {
        return `Ja. Je foto staat in mijn geheugen als **${preview.title}** (${preview.count} kaarten: ${preview.sample}). Vraag me er alles over, of exporteer een PDF.\n\n[[action:export_pdf]]\n[[action:continue_game]]`;
      }
      if (lang === 'es') {
        return `Sí. Tu foto está en mi memoria como **${preview.title}** (${preview.count} tarjetas: ${preview.sample}). Pregúntame lo que quieras, o exporta un PDF.\n\n[[action:export_pdf]]\n[[action:continue_game]]`;
      }
      return `Oui. Ta photo est bien en mémoire comme **${preview.title}** (${preview.count} cartes : ${preview.sample}). Pose-moi une question dessus, ou exporte un PDF.\n\n[[action:export_pdf]]\n[[action:continue_game]]`;
    }
    if (lang === 'en') {
      return "I don't have a sheet from a photo in this chat yet. Attach one with +, or scan from Home.\n\n[[action:scan]]";
    }
    if (lang === 'nl') {
      return "Ik heb in dit chat nog geen blad van een foto. Voeg er een toe met +, of scan via Home.\n\n[[action:scan]]";
    }
    if (lang === 'es') {
      return "Aún no tengo una ficha de una foto en este chat. Añade una con +, o escanea desde Inicio.\n\n[[action:scan]]";
    }
    return "Je n'ai pas encore de fiche issue d'une photo dans ce chat. Joins-en une avec +, ou scanne depuis Accueil.\n\n[[action:scan]]";
  }

  const exportKind = looksLikeExportAsk(message);
  if (exportKind) {
    if (empty) {
      if (lang === 'en') {
        return "I can make a PDF or Word, but I need a sheet first. Attach one with + here, or scan from Home.\n\n[[action:scan]]";
      }
      if (lang === 'nl') {
        return "Ik kan een PDF of Word maken, maar ik heb eerst een blad nodig. Voeg er een toe met +, of scan via Home.\n\n[[action:scan]]";
      }
      if (lang === 'es') {
        return "Puedo crear un PDF o Word, pero primero necesito una ficha. Añade una con +, o escanea desde Inicio.\n\n[[action:scan]]";
      }
      return "Je peux créer un PDF ou un Word, mais il me faut d'abord une fiche. Joins-en une avec +, ou scanne depuis Accueil.\n\n[[action:scan]]";
    }
    const tags =
      exportKind === 'pdf'
        ? '[[action:export_pdf]]'
        : exportKind === 'word'
          ? '[[action:export_word]]'
          : '[[action:export_pdf]]\n[[action:export_word]]';
    if (lang === 'en') {
      return `Yes. Tap the button below: ScanPlay builds the document from your sheet (print dialog for PDF, or Word download).\n\n${tags}`;
    }
    if (lang === 'nl') {
      return `Ja. Tik op de knop hieronder: ScanPlay maakt het document van je blad (printen voor PDF, of Word-download).\n\n${tags}`;
    }
    if (lang === 'es') {
      return `Sí. Pulsa el botón de abajo: ScanPlay crea el documento a partir de tu ficha (imprimir para PDF, o descarga Word).\n\n${tags}`;
    }
    return `Oui. Appuie sur le bouton ci-dessous : ScanPlay crée le document à partir de ta fiche (impression pour le PDF, ou téléchargement Word).\n\n${tags}`;
  }

  if (looksLikeAiUsageAsk(message)) {
    if (lang === 'en') {
      return `Yes — your **ScanPlay AI** bar is at **${pct}%** (envelope ${envelope}).\n\nThat % comes from Settings, not your sheet count. Sheets in my memory are only for quizzes — they don't fill the AI bar.\n\nAt ~90% quality steps down a bit; at 100% AI pauses until the next cycle.\n\n[[action:settings]]`;
    }
    if (lang === 'nl') {
      return `Ja — je **ScanPlay AI**-balk staat op **${pct}%** (enveloppe ${envelope}).\n\nDat % komt uit Instellingen, niet uit je aantal bladen. Bladen in mijn geheugen zijn alleen voor quizzen.\n\nRond 90% daalt de kwaliteit wat; bij 100% pauzeert AI tot de volgende cyclus.\n\n[[action:settings]]`;
    }
    if (lang === 'es') {
      return `Sí — tu barra **IA ScanPlay** está al **${pct}%** (envolvente ${envelope}).\n\nEse % sale de Ajustes, no del número de fichas. Las fichas en mi memoria son solo para quizzes.\n\nCerca del 90% baja un poco la calidad; al 100% la IA espera al siguiente ciclo.\n\n[[action:settings]]`;
    }
    return `Oui — ta barre **IA ScanPlay** est bien à **${pct}%** (enveloppe ${envelope}).\n\nCe % vient des paramètres, pas du nombre de fiches. Les fiches en mémoire coach, c'est juste ce que je peux quiz ; ça ne compte pas dans la barre IA.\n\nVers 90 % on baisse un peu la qualité ; à 100 % l'IA attend le prochain cycle.\n\n[[action:settings]]`;
  }

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
    const hearts = universeHeartsForPlan(lang, opts.plan);
    if (lang === 'en') {
      return `In ScanPlay, **Universe** is Pix’s ready-made course store. No scan needed.\n\nRight now you can learn English (A1 to C2), with chapters based on your goal. ${hearts}\n\nOpen it here 👇\n[[action:universe]]`;
    }
    if (lang === 'nl') {
      return `In ScanPlay is **Univers** de store met kant-en-klare Pix-cursussen. Geen scan nodig.\n\nNu kun je Engels leren (A1 tot C2), met hoofdstukken volgens jouw doel. ${hearts}\n\nOpen hier 👇\n[[action:universe]]`;
    }
    if (lang === 'es') {
      return `En ScanPlay, **Universo** es la tienda de cursos listos de Pix. Sin escanear.\n\nAhora puedes aprender inglés (A1 a C2), con capítulos según tu objetivo. ${hearts}\n\nÁbrelo aquí 👇\n[[action:universe]]`;
    }
    return `Dans ScanPlay, **Univers** c'est le store de cours prêts par Pix. Pas besoin de scanner.\n\nTu peux y apprendre l'anglais (A1 à C2), avec des chapitres selon ton objectif. ${hearts}\n\nOuvre-le ici 👇\n[[action:universe]]`;
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
