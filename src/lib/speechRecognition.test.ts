import { describe, expect, it } from 'vitest';
import { gradeSpokenFromCandidates } from './speechRecognition';

describe('gradeSpokenFromCandidates', () => {
  it('rejects unrelated sentence for target word', () => {
    const grade = gradeSpokenFromCandidates(
      ['Je m\'appelle Chocolat.'],
      'bring',
      { phraseSpeech: 'Now pronounce the word bring.' },
    );
    expect(grade).toBe('wrong');
  });

  it('accepts target word in phrase', () => {
    const grade = gradeSpokenFromCandidates(
      ['bring'],
      'bring',
      { phraseSpeech: 'Now pronounce the word bring.' },
    );
    expect(grade).toBe('correct');
  });

  it('near match on close pronunciation', () => {
    const grade = gradeSpokenFromCandidates(['brin'], 'bring', {
      phraseSpeech: 'Now pronounce the word bring.',
    });
    expect(['near', 'correct']).toContain(grade);
  });

  it('near match on partial Dutch target word', () => {
    const grade = gradeSpokenFromCandidates(['alarmtek'], 'alarmteken');
    expect(grade).toBe('near');
  });

  it('rejects unrelated Dutch sentence for alarmteken', () => {
    const grade = gradeSpokenFromCandidates(
      ['Ik hou van chocolade, maar niet van Nederlanders.'],
      'alarmteken',
      { phraseSpeech: 'In deze oefening is het woord alarmteken.' },
    );
    expect(grade).toBe('wrong');
  });

  it('rejects each unrelated Dutch token for alarmteken', () => {
    for (const word of ['ik', 'hou', 'van', 'chocolade', 'maar', 'niet', 'nederlanders']) {
      expect(gradeSpokenFromCandidates([word], 'alarmteken')).toBe('wrong');
    }
  });
});
