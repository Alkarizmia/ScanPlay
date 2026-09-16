import { describe, expect, it } from 'vitest';
import { clipTtsInput, MAX_TTS_CHARS, ttsCacheKey, ttsInstructions, ttsVoiceForLang } from './openaiTts';

describe('openai tts mapping', () => {
  it('picks a stable voice per language', () => {
    expect(ttsVoiceForLang('fr')).toBe('coral');
    expect(ttsVoiceForLang('nl')).toBe('sage');
    expect(ttsVoiceForLang('en')).toBe('verse');
    expect(ttsVoiceForLang('es')).toBe('nova');
  });

  it('asks the model to speak the target language', () => {
    expect(ttsInstructions('nl')).toMatch(/Dutch/i);
    expect(ttsInstructions('fr')).toMatch(/French/i);
    expect(ttsInstructions('nl', 0.65)).toMatch(/slowly/i);
    expect(ttsInstructions('en', 0.84)).not.toMatch(/slowly/i);
  });

  it('keeps slow and normal playback on different cache keys', () => {
    expect(ttsCacheKey('Hallo', 'nl')).not.toBe(ttsCacheKey('Hallo', 'nl', 0.65));
    expect(ttsCacheKey('Hallo', 'nl')).not.toBe(ttsCacheKey('Hallo', 'fr'));
  });

  it('clips overly long coach replies', () => {
    const long = 'a'.repeat(MAX_TTS_CHARS + 40);
    expect(clipTtsInput(long).length).toBe(MAX_TTS_CHARS);
  });
});
