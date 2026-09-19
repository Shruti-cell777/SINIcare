/**
 * SINIcare — storage.js
 *
 * A safe, typed wrapper around localStorage.
 * All reads include error handling; corrupt data is discarded gracefully.
 */

'use strict';

const PREFIX = 'sinicare_';

/**
 * Stores a value under a namespaced key.
 * Objects are JSON-serialized automatically.
 *
 * @param {string} key
 * @param {*} value
 * @returns {boolean} true on success
 */
export function setItem(key, value) {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(PREFIX + key, serialized);
    return true;
  } catch (err) {
    console.warn('[SINIcare Storage] setItem failed:', err);
    return false;
  }
}

/**
 * Retrieves a stored value. Returns defaultValue if missing or corrupt.
 *
 * @param {string} key
 * @param {*} [defaultValue=null]
 * @returns {*}
 */
export function getItem(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[SINIcare Storage] getItem parse error:', err);
    return defaultValue;
  }
}

/**
 * Removes a stored key.
 *
 * @param {string} key
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (err) {
    console.warn('[SINIcare Storage] removeItem failed:', err);
  }
}

/**
 * Checks whether localStorage is available and writable.
 * Returns false in private-browsing modes or when storage is full.
 *
 * @returns {boolean}
 */
export function isAvailable() {
  const testKey = PREFIX + '__test__';
  try {
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// ── Typed accessors ──────────────────────────────────────────────────────────

/** @returns {string} Gemini API key or empty string */
export function getApiKey()          { return getItem('api_key', ''); }
/** @param {string} key */
export function setApiKey(key)       { setItem('api_key', key); }

/** @returns {'en'|'hi'} Current UI language */
export function getLanguage()        { return getItem('language', 'en'); }
/** @param {'en'|'hi'} lang */
export function setLanguage(lang)    { setItem('language', lang); }

/** @returns {'normal'|'large'|'xl'} Font size preference */
export function getFontSize()        { return getItem('font_size', 'normal'); }
/** @param {'normal'|'large'|'xl'} size */
export function setFontSize(size)    { setItem('font_size', size); }

/** @returns {boolean} Whether TTS auto-play is enabled */
export function getTtsEnabled()      { return getItem('tts_enabled', true); }
/** @param {boolean} val */
export function setTtsEnabled(val)   { setItem('tts_enabled', val); }

/** @returns {boolean} High-contrast mode */
export function getHighContrast()    { return getItem('high_contrast', false); }
/** @param {boolean} val */
export function setHighContrast(val) { setItem('high_contrast', val); }

/** @returns {number} Speech synthesis rate (0.7 to 1.2, default 0.88 for seniors) */
export function getSpeechRate()       { return getItem('speech_rate', 0.88); }
/** @param {number} rate */
export function setSpeechRate(rate)   { setItem('speech_rate', rate); }

/** @returns {boolean} Whether user has completed initial onboarding setup */
export function hasCompletedSetup()   { return Boolean(getItem('setup_completed', false)) || Boolean(getItem('api_key', '')); }
/** @param {boolean} val */
export function setCompletedSetup(val = true) { setItem('setup_completed', Boolean(val)); }

/** @returns {{ name: string, phone: string }} Trusted contact */
export function getTrustedContact()  { return getItem('trusted_contact', { name: '', phone: '' }); }
/** @param {{ name: string, phone: string }} contact */
export function setTrustedContact(c) { setItem('trusted_contact', c); }

// ── Chat history ─────────────────────────────────────────────────────────────

const MAX_HISTORY = 40;   // max messages to persist

/** @typedef {{ role: 'user'|'model', content: string, timestamp: number }} ChatMessage */

/**
 * Loads persisted chat history.
 * @returns {ChatMessage[]}
 */
export function getChatHistory() {
  return getItem('chat_history', []);
}

/**
 * Appends a message to persisted chat history, trimming to MAX_HISTORY.
 * @param {ChatMessage} message
 */
export function appendChatHistory(message) {
  const history = getChatHistory();
  history.push(message);
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  setItem('chat_history', history);
}

/**
 * Clears all persisted chat history.
 */
export function clearChatHistory() {
  removeItem('chat_history');
}

// ── Reminders ────────────────────────────────────────────────────────────────

/** @typedef {{ id: string, text: string, time: string|null, completed: boolean, createdAt: number }} Reminder */

/** @returns {Reminder[]} */
export function getReminders() {
  return getItem('reminders', []);
}

/** @param {Reminder[]} reminders */
export function saveReminders(reminders) {
  setItem('reminders', reminders);
}

/**
 * Adds a new reminder.
 * @param {{ text: string, time?: string }} data
 * @returns {Reminder}
 */
export function addReminder({ text, time = null }) {
  const reminders = getReminders();
  const reminder = {
    id:        crypto.randomUUID(),
    text:      text.trim().slice(0, 500),
    time:      time,
    completed: false,
    createdAt: Date.now(),
  };
  reminders.unshift(reminder);
  saveReminders(reminders);
  return reminder;
}

/**
 * Toggles a reminder's completed state.
 * @param {string} id
 * @returns {boolean} new completed state
 */
export function toggleReminder(id) {
  const reminders = getReminders();
  const item = reminders.find(r => r.id === id);
  if (!item) return false;
  item.completed = !item.completed;
  saveReminders(reminders);
  return item.completed;
}

/**
 * Deletes a reminder by id.
 * @param {string} id
 */
export function deleteReminder(id) {
  const reminders = getReminders().filter(r => r.id !== id);
  saveReminders(reminders);
}
