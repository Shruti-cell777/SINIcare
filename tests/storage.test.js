/**
 * SINIcare — tests/storage.test.js
 *
 * Tests for the storage module.
 * Note: Requires a browser environment with localStorage.
 */

import { describe, test, expect } from './test-runner.js';
import {
  setItem, getItem, removeItem, isAvailable,
  getReminders, addReminder, toggleReminder, deleteReminder,
  getLanguage, setLanguage, getFontSize, setFontSize,
  getTtsEnabled, setTtsEnabled,
  getSpeechRate, setSpeechRate,
  hasCompletedSetup, setCompletedSetup,
} from '../js/storage.js';

describe('localStorage availability', () => {
  test('reports localStorage as available', () => {
    expect(isAvailable()).toBeTruthy();
  });
});

describe('setItem / getItem', () => {
  test('stores and retrieves a string', () => {
    setItem('test_string', 'hello');
    expect(getItem('test_string')).toBe('hello');
    removeItem('test_string');
  });

  test('stores and retrieves a number', () => {
    setItem('test_num', 42);
    expect(getItem('test_num')).toBe(42);
    removeItem('test_num');
  });

  test('stores and retrieves an object', () => {
    setItem('test_obj', { name: 'Sunita', age: 72 });
    const result = getItem('test_obj');
    expect(result.name).toBe('Sunita');
    expect(result.age).toBe(72);
    removeItem('test_obj');
  });

  test('returns defaultValue when key not found', () => {
    removeItem('nonexistent');
    expect(getItem('nonexistent', 'fallback')).toBe('fallback');
  });

  test('returns null as default when no default specified', () => {
    removeItem('nonexistent');
    expect(getItem('nonexistent')).toBe(null);
  });
});

describe('preferences', () => {
  test('language defaults to en', () => {
    removeItem('language');
    expect(getLanguage()).toBe('en');
  });

  test('sets and gets language', () => {
    setLanguage('hi');
    expect(getLanguage()).toBe('hi');
    setLanguage('en'); // restore
  });

  test('font size defaults to normal', () => {
    removeItem('font_size');
    expect(getFontSize()).toBe('normal');
  });

  test('sets and gets font size', () => {
    setFontSize('large');
    expect(getFontSize()).toBe('large');
    setFontSize('normal'); // restore
  });

  test('TTS defaults to true', () => {
    removeItem('tts_enabled');
    expect(getTtsEnabled()).toBe(true);
  });

  test('sets TTS enabled to false', () => {
    setTtsEnabled(false);
    expect(getTtsEnabled()).toBe(false);
    setTtsEnabled(true); // restore
  });

  test('speech rate defaults to 0.88', () => {
    removeItem('speech_rate');
    expect(getSpeechRate()).toBe(0.88);
  });

  test('sets and gets speech rate', () => {
    setSpeechRate(0.75);
    expect(getSpeechRate()).toBe(0.75);
    setSpeechRate(0.88); // restore
  });

  test('hasCompletedSetup returns true when set', () => {
    setCompletedSetup(true);
    expect(hasCompletedSetup()).toBe(true);
    setCompletedSetup(false);
    removeItem('api_key');
    expect(hasCompletedSetup()).toBe(false);
  });
});

describe('reminders CRUD', () => {
  // Clean up before each suite
  const cleanup = () => {
    const reminders = getReminders();
    reminders.forEach(r => deleteReminder(r.id));
  };

  test('starts with empty reminders after cleanup', () => {
    cleanup();
    expect(getReminders()).toHaveLength(0);
  });

  test('adds a reminder', () => {
    cleanup();
    addReminder({ text: 'Take medicine' });
    expect(getReminders()).toHaveLength(1);
    cleanup();
  });

  test('added reminder has correct text', () => {
    cleanup();
    addReminder({ text: 'Doctor appointment' });
    const reminders = getReminders();
    expect(reminders[0].text).toBe('Doctor appointment');
    cleanup();
  });

  test('added reminder has completed: false', () => {
    cleanup();
    addReminder({ text: 'Morning walk' });
    const reminders = getReminders();
    expect(reminders[0].completed).toBe(false);
    cleanup();
  });

  test('added reminder has a unique id', () => {
    cleanup();
    addReminder({ text: 'Task 1' });
    addReminder({ text: 'Task 2' });
    const reminders = getReminders();
    expect(reminders[0].id).not.toBe(reminders[1].id);
    cleanup();
  });

  test('toggles reminder completed state', () => {
    cleanup();
    addReminder({ text: 'Toggle test' });
    const { id } = getReminders()[0];
    const result = toggleReminder(id);
    expect(result).toBe(true);
    expect(getReminders()[0].completed).toBe(true);
    cleanup();
  });

  test('deletes a reminder', () => {
    cleanup();
    addReminder({ text: 'Delete me' });
    const { id } = getReminders()[0];
    deleteReminder(id);
    expect(getReminders()).toHaveLength(0);
  });

  test('stores time when provided', () => {
    cleanup();
    addReminder({ text: 'Medicine', time: '08:30' });
    expect(getReminders()[0].time).toBe('08:30');
    cleanup();
  });

  test('truncates text to 500 chars', () => {
    cleanup();
    addReminder({ text: 'a'.repeat(600) });
    expect(getReminders()[0].text).toHaveLength(500);
    cleanup();
  });
});
