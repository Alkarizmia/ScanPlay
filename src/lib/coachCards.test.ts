import { describe, expect, it } from 'vitest';
import {
  buildCoachReviewPairs,
  extractDashPairs,
  extractNumberedCoachPairs,
} from './coachCards';
import { enrichCoachActions } from './coachMessageFormat';

describe('coachCards', () => {
  it('parses comma-separated user dumps', () => {
    const pairs = extractDashPairs('je suis - I am, you are - tu es, but - pourquoi');
    expect(pairs).toEqual([
      { term: 'je suis', definition: 'I am' },
      { term: 'you are', definition: 'tu es' },
      { term: 'but', definition: 'pourquoi' },
    ]);
  });

  it('parses numbered coach corrections and trims glued chatter', () => {
    const raw = `Super, on va revoir ça ensemble ! 👇

1. **I am** - Traduction : je suis

2. **You are** - Traduction : tu es / vous êtes

3. **But** - Traduction : mais Si tu veux approfondir ou ajouter d'autres mots, fais-moi signe !`;
    const pairs = extractNumberedCoachPairs(raw);
    expect(pairs).toEqual([
      { term: 'I am', definition: 'je suis' },
      { term: 'You are', definition: 'tu es / vous êtes' },
      { term: 'But', definition: 'mais' },
    ]);
  });

  it('marks wrong user glosses as uncertain (but → pourquoi vs mais)', () => {
    const user = 'je suis - I am, you are - tu es, but - pourquoi';
    const coach = `Super, on va revoir ça ensemble ! 👇

1. **I am** - Traduction : je suis

2. **You are** - Traduction : tu es / vous êtes

3. **But** - Traduction : mais

[[action:continue_chat]]`;
    const pairs = buildCoachReviewPairs(user, coach);
    expect(pairs).toHaveLength(3);
    const but = pairs.find((p) => /but/i.test(p.term));
    expect(but).toMatchObject({ definition: 'mais', quality: 'uncertain' });
    const iam = pairs.find((p) => /i am/i.test(p.term));
    expect(iam?.quality).toBe('trusted');
  });

  it('auto-adds create_cards on vocab review replies', () => {
    const raw = `Super, on va revoir ça ensemble ! 👇

1. **But** - Traduction : mais

Si tu veux approfondir, fais-moi signe !`;
    const out = enrichCoachActions(raw);
    expect(out).toContain('[[action:create_cards]]');
  });

  it('parses English / math labels the same way', () => {
    const en = extractNumberedCoachPairs('1. **But** - Translation: but (conjunction)\n2. **Hi** - Meaning: salut');
    expect(en.map((p) => p.term)).toEqual(['But', 'Hi']);
    const math = extractNumberedCoachPairs("1. **f'(x)** - Formule : 2x");
    expect(math).toEqual([{ term: "f'(x)", definition: '2x' }]);
  });
});
