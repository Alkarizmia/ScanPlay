import { describe, expect, it } from 'vitest';
import {
  enrichCoachActions,
  extractCoachActions,
  normalizeCoachSpacing,
  parseCoachSegments,
} from './coachMessageFormat';

describe('coachMessageFormat', () => {
  it('splits glued numbered items onto new lines', () => {
    const raw =
      'Pour bien progresser : 1. **Het is jammer** : Revois. 2. **Langues** : Verbes. 3. **Maths** : Bases.';
    const out = normalizeCoachSpacing(raw);
    expect(out).toContain('\n\n1. ');
    expect(out).toContain('\n\n2. ');
    expect(out).toContain('\n\n3. ');
  });

  it('parses **bold** without leaving stars', () => {
    const segments = parseCoachSegments('Revois **Het is jammer** puis **Maths**.');
    expect(segments).toEqual([
      { type: 'text', value: 'Revois ' },
      { type: 'bold', value: 'Het is jammer' },
      { type: 'text', value: ' puis ' },
      { type: 'bold', value: 'Maths' },
      { type: 'text', value: '.' },
    ]);
  });

  it('extracts action shortcuts and strips markers', () => {
    const out = extractCoachActions('Appuie ici 👇\n[[action:scan]]\n[[action:settings]]');
    expect(out.actions).toEqual(['scan', 'settings']);
    expect(out.text).toContain('Appuie ici');
    expect(out.text).not.toContain('[[action:');
  });

  it('adds a scan button when the reply invites scanning without a tag', () => {
    const raw =
      "Pour bien commencer, tu peux scanner directement ta fiche ! Appuie sur le bouton **Accueil** dans l'application.";
    const out = enrichCoachActions(raw);
    expect(out).toContain('[[action:scan]]');
    const parsed = extractCoachActions(out);
    expect(parsed.actions).toEqual(['scan']);
    expect(parsed.text).toContain('scanner directement');
  });
});
