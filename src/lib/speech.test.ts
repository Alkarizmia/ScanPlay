import { describe, expect, it } from 'vitest';
import { sanitizeTextForSpeech } from './speech';

describe('sanitizeTextForSpeech', () => {
  it('drops IPA brackets instead of reading them aloud', () => {
    expect(sanitizeTextForSpeech('pregnancy [e]')).toBe('pregnancy');
    expect(sanitizeTextForSpeech('a newborn [ju:]')).toBe('a newborn');
  });

  it('drops irregular-verb stars and GB/US labels', () => {
    expect(sanitizeTextForSpeech('to give* birth')).toBe('to give birth');
    expect(sanitizeTextForSpeech('a nappy GB')).toBe('a nappy');
  });
});
