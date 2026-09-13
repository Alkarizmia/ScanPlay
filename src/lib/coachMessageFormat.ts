/** Make glued coach replies readable before render. */
export function normalizeCoachSpacing(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])\s+(?=\d+\.\s)/g, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
