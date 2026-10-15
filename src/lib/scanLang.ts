/**
 * Shared language heuristics for scan (client + edge should stay aligned).
 * Keep EN/FR phrase-list signals strong enough for "I am coming" / "J'arrive".
 */

export type ScanLang = 'nl' | 'fr' | 'en' | 'es' | 'de' | 'unknown';

export function looksFr(text: string): boolean {
  return (
    /[àâäéèêëïîôùûüç]/i.test(text) ||
    /\b\w+['’]\w+/u.test(text) ||
    /\b(je|tu|nous|vous|qui|c'est|ça|le|la|les|des|du|suis|mal|tête|avance|retard|prêt|marrant|facile|difficile|égal)\b/i.test(
      text,
    )
  );
}

export function looksEn(text: string): boolean {
  return /\b(i|i'm|i am|it's|it is|my|who|what|leave|well|done|don't|doesn't|am|are|is|the|and|with|every|early|late|ready|funny|easy|difficult|care|hard|coming|leaving|aches|knows|patient|not at all)\b/i.test(
    text,
  );
}

export function looksDe(text: string): boolean {
  return (
    /[äöüßÄÖÜ]/.test(text) ||
    /\b(der|die|das|dem|den|und|nicht|auch|sich|mit|ist|sind|wird|werden)\b/i.test(text)
  );
}

export function detectScanLang(text: string): ScanLang {
  const t = text.trim();
  let fr = 0;
  let en = 0;
  let nl = 0;
  let es = 0;
  let de = 0;
  if (/[àâäéèêëïîôùûüç]/i.test(t)) fr += 2;
  if (/\b\w+['’]\w+/u.test(t)) fr += 2;
  if (/\b(le|la|les|des|du|je|tu|nous|vous|qui|c'est|ça|pas|très|mal|tête|avance|retard)\b/i.test(t)) {
    fr += 2;
  }
  if (/\w+(lijk|heid|isch)\b/i.test(t)) nl += 2;
  if (/\b(de|het|een|van|niet)\b/i.test(t) && fr === 0) nl += 1;
  if (looksEn(t)) en += 2;
  if (/\b(the|and|with|every|someone|before|after|without)\b/i.test(t)) en += 2;
  if (/[áéíóúñ¿¡]/i.test(t)) es += 2;
  if (/\b(el|la|los|las|un|una|que|con|por|para)\b/i.test(t) && fr === 0) es += 1;
  if (looksDe(t)) de += 2;
  if (/[äöüßÄÖÜ]/.test(t)) de += 2;
  if (/\b(der|die|das|ein|eine|und|nicht)\b/i.test(t) && fr === 0) de += 1;
  const best = Math.max(fr, en, nl, es, de);
  if (best === 0) return 'unknown';
  if (de === best && de > fr && de > en && de >= nl) return 'de';
  if (fr === best && fr > en) return 'fr';
  if (en === best && en > fr) return 'en';
  if (nl === best && nl > fr && nl > en && nl >= de) return 'nl';
  if (es === best && es > fr && es > en) return 'es';
  return 'unknown';
}

export function isClearCrossLang(term: string, definition: string): boolean {
  const tl = detectScanLang(term);
  const dl = detectScanLang(definition);
  if (tl === 'unknown' || dl === 'unknown') return false;
  return tl !== dl;
}
