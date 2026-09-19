/**
 * SINIcare — tests/security.test.js
 */

import { describe, test, expect } from './test-runner.js';
import {
  escapeHtml,
  sanitizeInput,
  renderMarkdownSafe,
  isValidApiKey,
  isValidPhone,
  quickScamScan,
} from '../js/security.js';
import { isHindiText } from '../js/voice.js';

describe('escapeHtml', () => {
  test('escapes < and > characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  test('escapes & character', () => {
    expect(escapeHtml('bread & butter')).toBe('bread &amp; butter');
  });

  test('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  test('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  test('returns empty string for non-strings', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('');
  });

  test('passes through safe text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  test('prevents XSS injection pattern', () => {
    const xss = '<img src=x onerror=alert(1)>';
    const result = escapeHtml(xss);
    expect(result).not.toContain('<img');
    expect(result).not.toContain('>');
  });
});

describe('sanitizeInput', () => {
  test('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  test('enforces max length', () => {
    const long = 'a'.repeat(5000);
    expect(sanitizeInput(long, 4000)).toHaveLength(4000);
  });

  test('returns empty string for non-strings', () => {
    expect(sanitizeInput(null)).toBe('');
    expect(sanitizeInput(undefined)).toBe('');
  });

  test('handles normal input unchanged', () => {
    expect(sanitizeInput('Is this email safe?')).toBe('Is this email safe?');
  });
});

describe('renderMarkdownSafe', () => {
  test('converts **bold** to <strong>', () => {
    const result = renderMarkdownSafe('**Important**');
    expect(result).toContain('<strong>Important</strong>');
  });

  test('escapes HTML in input before rendering', () => {
    const result = renderMarkdownSafe('<script>alert(1)</script>');
    expect(result).not.toContain('<script>');
  });

  test('converts bullet lists to <ul><li>', () => {
    const result = renderMarkdownSafe('- First\n- Second');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
  });

  test('returns empty string for non-string input', () => {
    expect(renderMarkdownSafe(null)).toBe('');
  });
});

describe('isValidApiKey', () => {
  test('accepts valid-looking API key', () => {
    expect(isValidApiKey('AIzaSyAbcdefghijklmnopqrstuvwxyz12345')).toBeTruthy();
  });

  test('rejects empty string', () => {
    expect(isValidApiKey('')).toBeFalsy();
  });

  test('rejects too-short key', () => {
    expect(isValidApiKey('abc123')).toBeFalsy();
  });

  test('rejects key with invalid characters', () => {
    expect(isValidApiKey('AIzaSy abc!@#')).toBeFalsy();
  });

  test('rejects non-string', () => {
    expect(isValidApiKey(null)).toBeFalsy();
    expect(isValidApiKey(12345)).toBeFalsy();
  });
});

describe('isValidPhone', () => {
  test('accepts Indian mobile number', () => {
    expect(isValidPhone('+91 98765 43210')).toBeTruthy();
  });

  test('accepts 10-digit number', () => {
    expect(isValidPhone('9876543210')).toBeTruthy();
  });

  test('rejects too short number', () => {
    expect(isValidPhone('123')).toBeFalsy();
  });

  test('rejects non-string', () => {
    expect(isValidPhone(null)).toBeFalsy();
  });
});

describe('quickScamScan', () => {
  test('returns low score for benign text', () => {
    const { score } = quickScamScan('Hi, how are you? Your parcel has been shipped.');
    expect(score).toBeLessThanOrEqual(0.3);
  });

  test('returns high score for OTP request', () => {
    const { score, flags } = quickScamScan(
      'Dear customer, your OTP is 123456. Do not share with anyone.'
    );
    expect(score).toBeGreaterThan(0.2);
    expect(flags).toContain('OTP request');
  });

  test('flags urgency tactic', () => {
    const { flags } = quickScamScan('Act immediately! Your account will expire!');
    expect(flags).toContain('Urgency tactic');
  });

  test('flags lottery/prize offer', () => {
    const { flags } = quickScamScan('Congratulations! You have won a prize of 10 lakh rupees!');
    expect(flags).toContain('Too-good-to-be-true');
  });

  test('returns object with score and flags', () => {
    const result = quickScamScan('Hello');
    expect(typeof result.score).toBe('number');
    expect(Array.isArray(result.flags)).toBeTruthy();
  });

  test('handles non-string input gracefully', () => {
    const result = quickScamScan(null);
    expect(result.score).toBe(0);
    expect(result.flags).toHaveLength(0);
  });
});

describe('isHindiText detection', () => {
  test('detects Devanagari Hindi text', () => {
    expect(isHindiText('नमस्ते')).toBeTruthy();
    expect(isHindiText('क्या हाल है?')).toBeTruthy();
  });

  test('detects mixed English-Hindi text with Devanagari', () => {
    expect(isHindiText('Hello नमस्ते')).toBeTruthy();
  });

  test('returns false for pure English text', () => {
    expect(isHindiText('How are you doing today?')).toBeFalsy();
  });

  test('handles empty or null gracefully', () => {
    expect(isHindiText('')).toBeFalsy();
    expect(isHindiText(null)).toBeFalsy();
  });
});
