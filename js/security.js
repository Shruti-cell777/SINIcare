/**
 * SINIcare — security.js
 *
 * Input sanitization and XSS prevention utilities.
 * All user-supplied content must pass through these helpers
 * before being inserted into the DOM.
 */

'use strict';

/**
 * Escapes a string so it is safe to use as textContent.
 * This is the primary defense against XSS — always prefer
 * setting element.textContent directly over using this for innerHTML.
 *
 * @param {string} str - Raw user input
 * @returns {string} HTML-entity-encoded string
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

/**
 * Sanitizes user input for safe storage and processing.
 * Trims whitespace and enforces a maximum length.
 *
 * @param {string} input - Raw input string
 * @param {number} [maxLength=4000] - Maximum allowed character length
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input, maxLength = 4000) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  return trimmed.slice(0, maxLength);
}

/**
 * Safely sets text content on a DOM element.
 * Uses textContent to prevent any HTML injection.
 *
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text to set
 */
export function safeSetText(element, text) {
  if (element && typeof text === 'string') {
    element.textContent = text;
  }
}

/**
 * Converts a safe (already-escaped or trusted) markdown-lite string
 * into HTML. Only allows a whitelist of safe tags:
 * <strong>, <em>, <br>, <ul>, <ol>, <li>, <p>
 *
 * This is used ONLY for rendering AI responses (not user input).
 * The AI response is treated as semi-trusted but still sanitized.
 *
 * @param {string} text - Markdown-like text from the AI
 * @returns {string} Safe HTML string
 */
export function renderMarkdownSafe(text) {
  if (typeof text !== 'string') return '';

  // Escape any HTML that might have slipped through
  let safe = escapeHtml(text);

  // Convert markdown-like syntax to whitelisted HTML
  safe = safe
    // Bold: **text** or __text__
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Numbered list items: "1. text"
    .replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>')
    // Bullet list items: "- text" or "• text"
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n+/g, '</p><p>')
    // Single newlines → <br>
    .replace(/\n/g, '<br>');

  // Wrap consecutive <li> items in <ol> or <ul>
  safe = safe.replace(/(<li>.*?<\/li>)+/gs, (match) => {
    return `<ul>${match}</ul>`;
  });

  // Wrap in paragraph if not already
  if (!safe.startsWith('<')) {
    safe = `<p>${safe}</p>`;
  } else if (!safe.startsWith('<ul>') && !safe.startsWith('<ol>') && !safe.startsWith('<p>')) {
    safe = `<p>${safe}</p>`;
  }

  return safe;
}

/**
 * Validates that a string looks like a plausible Gemini API key.
 * Does NOT verify with the server — just basic format check.
 *
 * @param {string} key - API key string to validate
 * @returns {boolean}
 */
export function isValidApiKey(key) {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  // Gemini API keys are alphanumeric + hyphens/underscores, typically 30-60 chars
  return /^[A-Za-z0-9_\-]{20,100}$/.test(trimmed);
}

/**
 * Validates a phone number (Indian format or international).
 *
 * @param {string} phone - Phone number string
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  return /^[+]?[\d\s\-()]{7,15}$/.test(phone.trim());
}

/**
 * Detects if text contains patterns commonly found in scam messages.
 * Returns a preliminary risk score (0 = low, 1 = high) for quick filtering.
 * Full analysis is delegated to the AI.
 *
 * @param {string} text - Message text to check
 * @returns {{ score: number, flags: string[] }}
 */
export function quickScamScan(text) {
  if (typeof text !== 'string') return { score: 0, flags: [] };

  const lower = text.toLowerCase();
  const flags = [];
  let score = 0;

  const patterns = [
    { re: /otp|one.time.pass/i,                  flag: 'OTP request',            weight: 0.3 },
    { re: /bank.?account|account.?number/i,       flag: 'Bank account request',   weight: 0.3 },
    { re: /aadhaar|aadhar|pan.?card/i,            flag: 'Government ID request',  weight: 0.25 },
    { re: /click.?here|tap.?here|bit\.ly|tinyurl/i, flag: 'Suspicious link',      weight: 0.2 },
    { re: /urgent|immediately|act.?now|expire/i,  flag: 'Urgency tactic',         weight: 0.2 },
    { re: /won|winner|prize|lottery|crore|lakh/i, flag: 'Too-good-to-be-true',    weight: 0.25 },
    { re: /password|passcode/i,                   flag: 'Password request',        weight: 0.3 },
    { re: /verify.?your|confirm.?your/i,          flag: 'Verification tactic',    weight: 0.15 },
    { re: /free.?(?:gift|money|recharge)/i,       flag: 'Free offer',             weight: 0.2 },
    { re: /block|suspend|deactivat/i,             flag: 'Threat tactic',          weight: 0.2 },
  ];

  for (const { re, flag, weight } of patterns) {
    if (re.test(lower)) {
      flags.push(flag);
      score = Math.min(1, score + weight);
    }
  }

  return { score, flags };
}
