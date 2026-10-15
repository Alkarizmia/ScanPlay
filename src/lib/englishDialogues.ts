/**
 * Static mini-dialogues for Universe English listen games.
 * No AI generation — content is fixed; playback uses browser TTS (speakDialogueLocal).
 */
import type { CefrLevel, EnglishGoal, EnglishNativeLang } from './englishCurriculum';

export type DialogueGameMode = 'topic' | 'mood' | 'fact';

export interface EnglishDialogue {
  id: string;
  levels: CefrLevel[];
  goals: EnglishGoal[];
  /** Short turns — ~10–18s spoken. */
  lines: { text: string }[];
  topic: Record<EnglishNativeLang, string>;
  topicWrong: [Record<EnglishNativeLang, string>, Record<EnglishNativeLang, string>];
  mood: Record<EnglishNativeLang, string>;
  moodWrong: [Record<EnglishNativeLang, string>, Record<EnglishNativeLang, string>];
  /** Statement about the dialogue (user language). */
  fact: Record<EnglishNativeLang, string>;
  factTrue: boolean;
}

const L = (
  fr: string,
  nl: string,
  es: string,
  ar: string,
  de: string,
): Record<EnglishNativeLang, string> => ({ fr, nl, es, ar, de });

export const ENGLISH_DIALOGUES: EnglishDialogue[] = [
  {
    id: 'cafe-order',
    levels: ['A1', 'A2'],
    goals: ['travel', 'fun', 'other'],
    lines: [
      { text: 'Hi! Can I have a coffee, please?' },
      { text: 'Sure. Small or large?' },
      { text: 'Large, please. How much is it?' },
      { text: 'Three euros fifty.' },
    ],
    topic: L('Commander un café', 'Koffie bestellen', 'Pedir un café', 'طلب قهوة', 'Kaffee bestellen'),
    topicWrong: [
      L('Réserver un hôtel', 'Een hotel boeken', 'Reservar un hotel', 'حجز فندق', 'Ein Hotel buchen'),
      L('Acheter un billet', 'Een ticket kopen', 'Comprar un billete', 'شراء تذكرة', 'Ein Ticket kaufen'),
    ],
    mood: L('Poli / service', 'Beleefd / service', 'Cortés / servicio', 'مهذب / خدمة', 'Höflich / Service'),
    moodWrong: [
      L('Colère', 'Boosheid', 'Enfado', 'غضب', 'Wut'),
      L('Tristesse', 'Verdriet', 'Tristeza', 'حزن', 'Traurigkeit'),
    ],
    fact: L('Le café coûte 3,50 €.', 'De koffie kost 3,50 €.', 'El café cuesta 3,50 €.', 'القهوة تكلف 3,50 €.', 'Der Kaffee kostet 3,50 €.'),
    factTrue: true,
  },
  {
    id: 'hotel-checkin',
    levels: ['A1', 'A2', 'B1'],
    goals: ['travel', 'other'],
    lines: [
      { text: 'Good evening. I have a reservation.' },
      { text: 'Your name, please?' },
      { text: 'Anna Miller.' },
      { text: 'Here is your key. Room twelve.' },
    ],
    topic: L('Arrivée à l’hôtel', 'Inchecken in het hotel', 'Llegada al hotel', 'الوصول إلى الفندق', 'Ankunft im Hotel'),
    topicWrong: [
      L('Demander mon chemin', 'De weg vragen', 'Preguntar el camino', 'سؤال عن الطريق', 'Nach dem Weg fragen'),
      L('Parler du sport', 'Over sport praten', 'Hablar de deporte', 'الحديث عن الرياضة', 'Über Sport sprechen'),
    ],
    mood: L('Accueil poli', 'Vriendelijke ontvangst', 'Recibimiento cortés', 'استقبال مهذب', 'Freundlicher Empfang'),
    moodWrong: [
      L('Dispute', 'Ruzie', 'Discusión', 'جدال', 'Streit'),
      L('Blague', 'Grap', 'Broma', 'مزاح', 'Scherz'),
    ],
    fact: L('La chambre est le numéro 12.', 'De kamer is nummer 12.', 'La habitación es la 12.', 'الغرفة رقم 12.', 'Das Zimmer ist Nummer 12.'),
    factTrue: true,
  },
  {
    id: 'ask-directions',
    levels: ['A1', 'A2'],
    goals: ['travel', 'fun', 'other'],
    lines: [
      { text: 'Excuse me, where is the station?' },
      { text: 'Go straight, then turn left.' },
      { text: 'Is it far?' },
      { text: 'No, about five minutes.' },
    ],
    topic: L('Demander son chemin', 'De weg vragen', 'Preguntar el camino', 'السؤال عن الطريق', 'Nach dem Weg fragen'),
    topicWrong: [
      L('Commander à manger', 'Eten bestellen', 'Pedir comida', 'طلب طعام', 'Essen bestellen'),
      L('Parler du travail', 'Over werk praten', 'Hablar del trabajo', 'الحديث عن العمل', 'Über die Arbeit sprechen'),
    ],
    mood: L('Aide utile', 'Behulpzaam', 'Ayuda útil', 'مساعدة مفيدة', 'Hilfreich'),
    moodWrong: [
      L('Peur', 'Angst', 'Miedo', 'خوف', 'Angst'),
      L('Sarcasme', 'Sarcasme', 'Sarcasmo', 'سخرية', 'Sarkasmus'),
    ],
    fact: L('La gare est à cinq minutes.', 'Het station is vijf minuten.', 'La estación está a cinco minutos.', 'المحطة على بعد خمس دقائق.', 'Der Bahnhof ist fünf Minuten entfernt.'),
    factTrue: true,
  },
  {
    id: 'late-meeting',
    levels: ['A2', 'B1'],
    goals: ['work', 'other'],
    lines: [
      { text: 'Sorry I am late. The train was late.' },
      { text: 'No problem. We can start now.' },
      { text: 'Did you get my email?' },
      { text: 'Yes. Let’s open the file.' },
    ],
    topic: L('Réunion de travail', 'Werkvergadering', 'Reunión de trabajo', 'اجتماع عمل', 'Arbeitsbesprechung'),
    topicWrong: [
      L('Cours de cuisine', 'Kookles', 'Clase de cocina', 'درس طبخ', 'Kochkurs'),
      L('Match de foot', 'Voetbalwedstrijd', 'Partido de fútbol', 'مباراة كرة قدم', 'Fußballspiel'),
    ],
    mood: L('Professionnel / calme', 'Professioneel / kalm', 'Profesional / calmado', 'مهني / هادئ', 'Professionell / ruhig'),
    moodWrong: [
      L('Fête', 'Feest', 'Fiesta', 'حفلة', 'Party'),
      L('Panique', 'Paniek', 'Pánico', 'ذعر', 'Panik'),
    ],
    fact: L('La personne est en retard à cause du train.', 'De persoon is te laat door de trein.', 'Llega tarde por el tren.', 'تأخر بسبب القطار.', 'Die Person kommt wegen des Zugs zu spät.'),
    factTrue: true,
  },
  {
    id: 'doctor-appointment',
    levels: ['A2', 'B1'],
    goals: ['travel', 'other', 'fun'],
    lines: [
      { text: 'I have a headache and a sore throat.' },
      { text: 'How long have you felt like this?' },
      { text: 'Since yesterday morning.' },
      { text: 'Rest today and drink a lot of water.' },
    ],
    topic: L('Chez le médecin', 'Bij de dokter', 'En el médico', 'عند الطبيب', 'Beim Arzt'),
    topicWrong: [
      L('Acheter des vêtements', 'Kleren kopen', 'Comprar ropa', 'شراء ملابس', 'Kleidung kaufen'),
      L('Réserver un vol', 'Een vlucht boeken', 'Reservar un vuelo', 'حجز رحلة', 'Einen Flug buchen'),
    ],
    mood: L('Conseil médical', 'Medisch advies', 'Consejo médico', 'نصيحة طبية', 'Medizinischer Rat'),
    moodWrong: [
      L('Colère', 'Boosheid', 'Enfado', 'غضب', 'Wut'),
      L('Flirt', 'Flirten', 'Ligoteo', 'غزل', 'Flirten'),
    ],
    fact: L('Le patient a mal depuis hier.', 'De patiënt voelt zich zo sinds gisteren.', 'El paciente está así desde ayer.', 'المريض هكذا منذ أمس.', 'Dem Patienten geht es seit gestern so.'),
    factTrue: true,
  },
  {
    id: 'class-homework',
    levels: ['A1', 'A2', 'B1'],
    goals: ['school', 'exam', 'other'],
    lines: [
      { text: 'Is the homework for tomorrow?' },
      { text: 'Yes. Page twenty, exercise three.' },
      { text: 'Can we work in pairs?' },
      { text: 'Yes, that’s fine.' },
    ],
    topic: L('Devoirs à l’école', 'Huiswerk op school', 'Deberes en clase', 'واجب مدرسي', 'Hausaufgaben in der Schule'),
    topicWrong: [
      L('Shopping', 'Winkelen', 'Compras', 'تسوق', 'Einkaufen'),
      L('Voyage en avion', 'Vliegreis', 'Viaje en avión', 'سفر بالطائرة', 'Flugreise'),
    ],
    mood: L('Classe / organisation', 'Klas / organisatie', 'Clase / organización', 'صف / تنظيم', 'Klasse / Organisation'),
    moodWrong: [
      L('Dispute familiale', 'Familieruzie', 'Discusión familiar', 'خلاف عائلي', 'Familienstreit'),
      L('Blague', 'Grap', 'Broma', 'مزاح', 'Scherz'),
    ],
    fact: L('Les devoirs sont page 20.', 'Het huiswerk is pagina 20.', 'Los deberes son la página 20.', 'الواجب في الصفحة 20.', 'Die Hausaufgaben sind Seite 20.'),
    factTrue: true,
  },
  {
    id: 'phone-wrong-number',
    levels: ['A2', 'B1'],
    goals: ['work', 'other', 'fun'],
    lines: [
      { text: 'Hello, is this the bank?' },
      { text: 'No, sorry. You have the wrong number.' },
      { text: 'Oh, excuse me!' },
      { text: 'No worries. Bye!' },
    ],
    topic: L('Mauvais numéro', 'Verkeerd nummer', 'Número equivocado', 'رقم خطأ', 'Falsche Nummer'),
    topicWrong: [
      L('Commander une pizza', 'Pizza bestellen', 'Pedir una pizza', 'طلب بيتزا', 'Eine Pizza bestellen'),
      L('Entretien d’embauche', 'Sollicitatiegesprek', 'Entrevista de trabajo', 'مقابلة عمل', 'Vorstellungsgespräch'),
    ],
    mood: L('Malentendu poli', 'Beleefd misverstand', 'Malentendido cortés', 'سوء فهم مهذب', 'Höfliches Missverständnis'),
    moodWrong: [
      L('Menace', 'Dreigement', 'Amenaza', 'تهديد', 'Drohung'),
      L('Romance', 'Romantiek', 'Romance', 'رومانسية', 'Romantik'),
    ],
    fact: L('C’est bien la banque au téléphone.', 'Het is wel de bank aan de lijn.', 'Sí es el banco al teléfono.', 'إنه البنك فعلا على الهاتف.', 'Es ist wirklich die Bank am Telefon.'),
    factTrue: false,
  },
  {
    id: 'weekend-plans',
    levels: ['A1', 'A2', 'B1'],
    goals: ['fun', 'other', 'school'],
    lines: [
      { text: 'What are you doing this weekend?' },
      { text: 'I want to see a film.' },
      { text: 'Nice! Can I come with you?' },
      { text: 'Of course. Saturday at seven.' },
    ],
    topic: L('Plans pour le week-end', 'Weekendplannen', 'Planes de fin de semana', 'خطط نهاية الأسبوع', 'Wochenendpläne'),
    topicWrong: [
      L('Problème d’ordinateur', 'Computerprobleem', 'Problema de ordenador', 'مشكلة حاسوب', 'Computerproblem'),
      L('Contrôle de police', 'Politiecontrole', 'Control policial', 'تفتيش شرطة', 'Polizeikontrolle'),
    ],
    mood: L('Amical / sorties', 'Vriendelijk / uitgaan', 'Amistoso / salir', 'ودي / خروج', 'Freundlich / ausgehen'),
    moodWrong: [
      L('Tristesse', 'Verdriet', 'Tristeza', 'حزن', 'Traurigkeit'),
      L('Formalité froide', 'Koude formaliteit', 'Formalidad fría', 'رسمية باردة', 'Kalte Formalität'),
    ],
    fact: L('Ils se voient samedi à 19 h.', 'Ze zien elkaar zaterdag om zeven.', 'Quedan el sábado a las siete.', 'يلتقيان السبت في السابعة.', 'Sie treffen sich Samstag um sieben.'),
    factTrue: true,
  },
  {
    id: 'shop-refund',
    levels: ['A2', 'B1', 'B2'],
    goals: ['travel', 'other', 'fun'],
    lines: [
      { text: 'I bought this shirt yesterday. It is too small.' },
      { text: 'Do you have the receipt?' },
      { text: 'Yes. Here it is.' },
      { text: 'OK. I can give your money back.' },
    ],
    topic: L('Remboursement en magasin', 'Terugbetaling in de winkel', 'Devolución en la tienda', 'استرداد في المتجر', 'Rückerstattung im Laden'),
    topicWrong: [
      L('Cours de langue', 'Taalles', 'Clase de idioma', 'درس لغة', 'Sprachkurs'),
      L('Réparer une voiture', 'Een auto repareren', 'Reparar un coche', 'إصلاح سيارة', 'Ein Auto reparieren'),
    ],
    mood: L('Service client', 'Klantenservice', 'Atención al cliente', 'خدمة العملاء', 'Kundenservice'),
    moodWrong: [
      L('Fête surprise', 'Verrassingsfeest', 'Fiesta sorpresa', 'حفلة مفاجئة', 'Überraschungsparty'),
      L('Plainte agressive', 'Agressieve klacht', 'Queja agresiva', 'شكوى عدوانية', 'Aggressive Beschwerde'),
    ],
    fact: L('Le client a le ticket de caisse.', 'De klant heeft de kassabon.', 'El cliente tiene el ticket.', 'الزبون معه الإيصال.', 'Der Kunde hat den Kassenbon.'),
    factTrue: true,
  },
  {
    id: 'job-interview',
    levels: ['B1', 'B2'],
    goals: ['work', 'other'],
    lines: [
      { text: 'Tell me about your last job.' },
      { text: 'I worked in a small office for two years.' },
      { text: 'Why do you want this role?' },
      { text: 'I want to learn and grow with your team.' },
    ],
    topic: L('Entretien d’embauche', 'Sollicitatiegesprek', 'Entrevista de trabajo', 'مقابلة عمل', 'Vorstellungsgespräch'),
    topicWrong: [
      L('Réserver une table', 'Een tafel reserveren', 'Reservar una mesa', 'حجز طاولة', 'Einen Tisch reservieren'),
      L('Cours de sport', 'Sportles', 'Clase de deporte', 'حصة رياضة', 'Sportunterricht'),
    ],
    mood: L('Sérieux / professionnel', 'Serieus / professioneel', 'Serio / profesional', 'جاد / مهني', 'Ernst / professionell'),
    moodWrong: [
      L('Blague entre amis', 'Grap onder vrienden', 'Broma entre amigos', 'مزاح بين أصدقاء', 'Scherz unter Freunden'),
      L('Panique', 'Paniek', 'Pánico', 'ذعر', 'Panik'),
    ],
    fact: L('La personne a travaillé deux ans dans un bureau.', 'De persoon werkte twee jaar op kantoor.', 'Trabajó dos años en una oficina.', 'عمل سنتين في مكتب.', 'Die Person hat zwei Jahre in einem Büro gearbeitet.'),
    factTrue: true,
  },
  {
    id: 'missed-bus',
    levels: ['A1', 'A2'],
    goals: ['travel', 'other', 'fun'],
    lines: [
      { text: 'Oh no! We missed the bus.' },
      { text: 'When is the next one?' },
      { text: 'In fifteen minutes.' },
      { text: 'OK. Let’s wait here.' },
    ],
    topic: L('Bus manqué', 'Bus gemist', 'Autobús perdido', 'فوات الحافلة', 'Bus verpasst'),
    topicWrong: [
      L('Cuisiner ensemble', 'Samen koken', 'Cocinar juntos', 'الطبخ معا', 'Zusammen kochen'),
      L('Examen oral', 'Mondeling examen', 'Examen oral', 'امتحان شفوي', 'Mündliche Prüfung'),
    ],
    mood: L('Léger stress', 'Lichte stress', 'Estrés ligero', 'توتر خفيف', 'Leichter Stress'),
    moodWrong: [
      L('Joie intense', 'Grote vreugde', 'Alegría intensa', 'فرح شديد', 'Große Freude'),
      L('Colère forte', 'Grote boosheid', 'Enfado fuerte', 'غضب شديد', 'Starke Wut'),
    ],
    fact: L('Le prochain bus est dans 15 minutes.', 'De volgende bus is over 15 minuten.', 'El próximo bus es en 15 minutos.', 'الحافلة التالية بعد 15 دقيقة.', 'Der nächste Bus kommt in 15 Minuten.'),
    factTrue: true,
  },
  {
    id: 'library-quiet',
    levels: ['A2', 'B1'],
    goals: ['school', 'exam', 'other'],
    lines: [
      { text: 'Excuse me, could you speak more quietly?' },
      { text: 'Sorry! Are we too loud?' },
      { text: 'A little. This is a quiet area.' },
      { text: 'OK, we will whisper.' },
    ],
    topic: L('À la bibliothèque', 'In de bibliotheek', 'En la biblioteca', 'في المكتبة', 'In der Bibliothek'),
    topicWrong: [
      L('Match de tennis', 'Tenniswedstrijd', 'Partido de tenis', 'مباراة تنس', 'Tennismatch'),
      L('Achat de voiture', 'Auto kopen', 'Compra de coche', 'شراء سيارة', 'Autokauf'),
    ],
    mood: L('Politesse / rappel', 'Beleefde herinnering', 'Recordatorio cortés', 'تذكير مهذب', 'Höfliche Erinnerung'),
    moodWrong: [
      L('Fête', 'Feest', 'Fiesta', 'حفلة', 'Party'),
      L('Peur', 'Angst', 'Miedo', 'خوف', 'Angst'),
    ],
    fact: L('Ils sont dans une zone silencieuse.', 'Ze zijn in een stille zone.', 'Están en una zona silenciosa.', 'هما في منطقة هادئة.', 'Sie sind in einer ruhigen Zone.'),
    factTrue: true,
  },
];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function pickDialogueForLesson(
  lessonId: string,
  level: CefrLevel,
  goal: EnglishGoal,
  salt = 0,
): EnglishDialogue | null {
  const pool = ENGLISH_DIALOGUES.filter(
    (d) => d.levels.includes(level) && (d.goals.includes(goal) || d.goals.includes('other')),
  );
  const list = pool.length ? pool : ENGLISH_DIALOGUES;
  if (!list.length) return null;
  const idx = hashSeed(`${lessonId}:${salt}`) % list.length;
  return list[idx]!;
}

export function buildDialogueChoices(
  dialogue: EnglishDialogue,
  mode: DialogueGameMode,
  native: EnglishNativeLang,
  seed: string,
): { prompt: string; options: string[]; correct: string } {
  if (mode === 'topic') {
    const correct = dialogue.topic[native];
    const options = shuffle(
      [correct, dialogue.topicWrong[0][native], dialogue.topicWrong[1][native]],
      hashSeed(seed),
    );
    return { prompt: '', options, correct };
  }
  if (mode === 'mood') {
    const correct = dialogue.mood[native];
    const options = shuffle(
      [correct, dialogue.moodWrong[0][native], dialogue.moodWrong[1][native]],
      hashSeed(seed + ':m'),
    );
    return { prompt: '', options, correct };
  }
  // fact: True / False labels are built in the game via i18n; options are the statement + T/F buttons
  return {
    prompt: dialogue.fact[native],
    options: [],
    correct: dialogue.factTrue ? 'true' : 'false',
  };
}

export function hasDialogueForLesson(level: CefrLevel, goal: EnglishGoal): boolean {
  return ENGLISH_DIALOGUES.some(
    (d) => d.levels.includes(level) && (d.goals.includes(goal) || d.goals.includes('other')),
  );
}
