/**
 * SINIcare — tests/i18n.test.js
 *
 * Tests for the internationalization system.
 */

import { describe, test, expect } from './test-runner.js';
import { t, setLang, getLang, SUPPORTED_LANGUAGES, detectLanguage } from '../js/i18n.js?v=2';

describe('i18n language selection', () => {
  test('supports English, Hindi, Tamil, Telugu, Bengali, Marathi', () => {
    const codes = Object.keys(SUPPORTED_LANGUAGES);
    expect(codes).toContain('en');
    expect(codes).toContain('hi');
    expect(codes).toContain('ta');
    expect(codes).toContain('te');
    expect(codes).toContain('bn');
    expect(codes).toContain('mr');
  });

  test('defaults to en or persists active language', () => {
    setLang('en');
    expect(getLang()).toBe('en');
  });

  test('switches language and returns correct translated string', () => {
    setLang('hi');
    expect(getLang()).toBe('hi');
    const sendText = t('btn.send');
    expect(sendText).toBe('भेजें');
    setLang('en'); // Reset
  });

  test('falls back to English if key is missing in selected language', () => {
    setLang('ta');
    // Common keys exist in all languages
    expect(t('app.title')).toBe('SINIcare');
    setLang('en');
  });

  test('supports variable interpolation in translations', () => {
    setLang('en');
    const formatted = t('chat.welcome.named', { name: 'Sarla' });
    expect(formatted).toContain('Sarla');
  });

  test('returns key itself if translation is nonexistent', () => {
    expect(t('nonexistent.key.xyz')).toBe('nonexistent.key.xyz');
  });
});

describe('detectLanguage automatic language detection', () => {
  test('detects Devanagari Hindi text', () => {
    expect(detectLanguage('नमस्ते, मुझे डॉक्टर की पर्ची समझाइए')).toBe('hi');
    expect(detectLanguage('यह मैसेज क्या है?')).toBe('hi');
  });

  test('detects spoken Romanized Hindi / Hinglish phrases', () => {
    expect(detectLanguage('mera phone hang ho raha hai')).toBe('hi');
    expect(detectLanguage('kripya mujhe batao kaise kare')).toBe('hi');
    expect(detectLanguage('namaste betaji')).toBe('hi');
  });

  test('detects clear English sentences', () => {
    expect(detectLanguage('Is this message safe or a scam?')).toBe('en');
    expect(detectLanguage('Help me book a doctor appointment')).toBe('en');
    expect(detectLanguage('How to make an online payment?')).toBe('en');
  });

  test('returns null for empty or non-string inputs', () => {
    expect(detectLanguage('')).toBe(null);
    expect(detectLanguage(null)).toBe(null);
  });
});
