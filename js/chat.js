/**
 * SINIcare — chat.js
 *
 * Chat UI rendering and conversation management.
 * Handles message display, typing indicators, history,
 * and delegation to Gemini for AI responses.
 */

'use strict';

import { sendChat, GeminiError } from './gemini.js';
import { renderMarkdownSafe, sanitizeInput } from './security.js';
import { appendChatHistory, getChatHistory, clearChatHistory, setLanguage } from './storage.js';
import { announce, formatTime, formatDate } from './a11y.js';
import { t, getLang, setLang, applyTranslations, detectLanguage } from './i18n.js';
import { speak, isHindiText } from './voice.js';
import { showToast } from './toast.js';
import { openGrocery } from './features/grocery.js';

/** Dispatches a toast without circular dependency. */
function dispatchToast(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('sini:toast', { detail: { message, type } }));
}

// ── DOM refs (set in init) ────────────────────────────────────────────────────
let chatArea        = null;
let welcomeMessage  = null;

// ── In-memory conversation history ───────────────────────────────────────────
// Array of { role: 'user'|'model', content: string }
let conversationHistory = [];

const MAX_CONTEXT_MESSAGES = 20; // max messages sent to API for context

// ── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initializes the chat module.
 * Loads persisted chat history and renders it.
 */
export function initChat() {
  chatArea       = document.getElementById('chat-area');
  welcomeMessage = document.getElementById('welcome-message');

  // Restore persisted history
  const saved = getChatHistory();
  if (saved.length > 0) {
    conversationHistory = saved.map(m => ({ role: m.role, content: m.content }));
    hideWelcome();

    // Group by date and render
    let lastDate = null;
    saved.forEach(msg => {
      const msgDate = formatDate(msg.timestamp, getLang());
      if (msgDate !== lastDate) {
        appendDateDivider(msgDate);
        lastDate = msgDate;
      }
      const el = createBubbleElement(msg.role, msg.content, msg.timestamp);
      chatArea.appendChild(el);
    });

    scrollToBottom(false);
  }
}

// ── Public: send a user message ───────────────────────────────────────────────

/**
 * Sends a user message, renders it, and fetches SINI's response.
 *
 * @param {string} rawText - Raw user input
 * @returns {Promise<void>}
 */
export async function sendMessage(rawText) {
  const text = sanitizeInput(rawText, 4000);
  if (!text) return;

  // Auto-detect if user spoke/typed in Hindi or English
  const detected = detectLanguage(text);
  if (detected && detected !== getLang()) {
    setLang(detected);
    setLanguage(detected);
    applyTranslations();
    window.dispatchEvent(new CustomEvent('sini:lang-change', { detail: { lang: detected } }));
  }

  // Add today's date divider if needed
  const todayLabel = formatDate(Date.now(), getLang());
  const lastDivider = chatArea?.querySelector('.chat-date-divider:last-of-type span');
  if (!lastDivider || lastDivider.textContent !== todayLabel) {
    if (conversationHistory.length > 0) {
      appendDateDivider(todayLabel);
    }
  }

  hideWelcome();

  // Render user bubble
  const userTimestamp = Date.now();
  const userEl = createBubbleElement('user', text, userTimestamp);
  chatArea.appendChild(userEl);
  scrollToBottom();
  announce(t('input.send') + ': ' + text);

  // Persist
  appendChatHistory({ role: 'user', content: text, timestamp: userTimestamp });
  conversationHistory.push({ role: 'user', content: text });

  // Show typing indicator
  const typingEl = showTypingIndicator();

  try {
    // Build context (last MAX_CONTEXT_MESSAGES messages, excluding latest)
    const context = conversationHistory.slice(-(MAX_CONTEXT_MESSAGES + 1), -1);

    const responseText = await sendChat(context, text);

    // Remove typing indicator
    typingEl.remove();

    // Render SINI response
    const modelTimestamp = Date.now();
    const siniEl = createBubbleElement('model', responseText, modelTimestamp);
    chatArea.appendChild(siniEl);
    scrollToBottom();

    // Persist
    appendChatHistory({ role: 'model', content: responseText, timestamp: modelTimestamp });
    conversationHistory.push({ role: 'model', content: responseText });

    // Announce and speak
    announce('SINI: ' + responseText);
    speak(responseText);

    // Auto-open grocery ordering assistant if requested
    const lowerMsg = text.toLowerCase();
    const isGroceryReq = lowerMsg.includes('order grocer') ||
                         lowerMsg.includes('groceries') ||
                         lowerMsg.includes('किराना') ||
                         lowerMsg.includes('राशन') ||
                         lowerMsg.includes('दूध मंगा') ||
                         lowerMsg.includes('सामान मंगा') ||
                         lowerMsg.includes('grocery order');

    if (isGroceryReq) {
      setTimeout(() => {
        openGrocery();
      }, 1500);
    }

  } catch (err) {
    typingEl.remove();

    const errorMsg = err instanceof GeminiError
      ? err.message
      : t('error.generic');

    appendErrorBubble(errorMsg);
    announce(errorMsg, 'assertive');
    dispatchToast(errorMsg, 'error');
    console.error('[SINIcare Chat] Error:', err);
  }
}

/**
 * Injects a canned message from SINI (used by quick actions).
 * Does NOT call the API — just renders a pre-defined response.
 * Pass followUp=true to make it act as a conversation starter.
 *
 * @param {string} sinitText - Text from SINI
 * @param {boolean} [followUp=false]
 */
export function injectSiniMessage(sinitText, followUp = false) {
  hideWelcome();
  const el = createBubbleElement('model', sinitText, Date.now());
  chatArea.appendChild(el);
  scrollToBottom();
  if (followUp) {
    appendChatHistory({ role: 'model', content: sinitText, timestamp: Date.now() });
    conversationHistory.push({ role: 'model', content: sinitText });
  }
  speak(sinitText);
}

/**
 * Clears the chat UI and history.
 */
export function clearChat() {
  conversationHistory = [];
  clearChatHistory();

  while (chatArea.firstChild) {
    chatArea.removeChild(chatArea.firstChild);
  }

  showWelcome();
  dispatchToast(t('chat.cleared'), 'info');
  announce(t('chat.cleared'));
}

// ── Bubble rendering ──────────────────────────────────────────────────────────

/**
 * Formats SINI's response into high-contrast, structured senior-friendly HTML.
 * Parses "Here's what this means" and "What you should do", adds trust safeguards,
 * and includes a dedicated prominent listen button.
 *
 * @param {string} content
 * @param {'hi'|'en'} lang
 * @returns {string}
 */
function formatSeniorResponseHtml(content, lang) {
  const isHi = lang === 'hi' || isHindiText(content);
  const lower = (content || '').toLowerCase();

  // 1. Trust & Safeguards banner (for sensitive banking/OTP/password context)
  const isSensitive = lower.includes('otp') || lower.includes('pin') ||
                      lower.includes('password') || lower.includes('cvv') ||
                      lower.includes('पासवर्ड') || lower.includes('खाता');
  let trustHtml = '';
  if (isSensitive) {
    const trustTitle = isHi ? '🛡️ आगे बढ़ने से पहले ध्यान दें:' : '🛡️ Before you continue:';
    const trustDesc  = isHi
      ? 'अपना OTP, UPI PIN या बैंक पासवर्ड किसी को न बताएं। बैंक या SINI कभी इसे नहीं मांगते।'
      : 'Never share your OTP, UPI PIN, or bank passwords with anyone. SINI and banks will NEVER ask for them.';
    trustHtml = `
      <div class="trust-alert-card" role="alert">
        <span class="trust-alert-icon">🛡️</span>
        <div>
          <div class="trust-alert-title">${trustTitle}</div>
          <p class="trust-alert-desc">${trustDesc}</p>
        </div>
      </div>
    `;
  }

  // 2. Parse structured sections
  const hiMeaningMarker    = '**यहाँ इसका मतलब है:**';
  const hiActionMarker     = '**आपको क्या करना चाहिए:**';
  const enMeaningMarker    = "**Here's what this means:**";
  const enMeaningMarkerAlt = '**Here&#x2019;s what this means:**'; // curly quote fallback
  const enActionMarker     = '**What you should do:**';

  let meaningPart = '';
  let actionPart  = '';

  if (content.includes(hiMeaningMarker) && content.includes(hiActionMarker)) {
    const parts = content.split(hiActionMarker);
    meaningPart = parts[0].replace(hiMeaningMarker, '').trim();
    actionPart  = (parts[1] || '').trim();
  } else if ((content.includes(enMeaningMarker) || content.includes(enMeaningMarkerAlt)) && content.includes(enActionMarker)) {
    const marker = content.includes(enMeaningMarker) ? enMeaningMarker : enMeaningMarkerAlt;
    const parts = content.split(enActionMarker);
    meaningPart = parts[0].replace(marker, '').trim();
    actionPart  = (parts[1] || '').trim();
  }

  const listenLabel = isHi ? '🔊 इसे पूरा सुनें' : '🔊 Listen to this';

  if (meaningPart && actionPart) {
    const meaningLabel = isHi ? '💡 यहाँ इसका मतलब है:' : "💡 Here's what this means:";
    const actionLabel  = isHi ? '👉 आपको क्या करना चाहिए:' : '👉 What you should do:';

    return `
      ${trustHtml}
      <div class="senior-response-card">
        <div class="senior-block senior-block-meaning">
          <div class="senior-block-label">${meaningLabel}</div>
          <div class="senior-block-content">${renderMarkdownSafe(meaningPart)}</div>
        </div>
        <div class="senior-block senior-block-action">
          <div class="senior-block-label">${actionLabel}</div>
          <div class="senior-block-content">${renderMarkdownSafe(actionPart)}</div>
        </div>
        <button type="button" class="senior-listen-btn" aria-label="${listenLabel}">
          <span>${listenLabel}</span>
        </button>
      </div>
    `;
  }

  // Fallback if not split
  return `
    ${trustHtml}
    <div class="senior-response-card">
      <div class="senior-block senior-block-meaning">
        <div class="senior-block-content">${renderMarkdownSafe(content)}</div>
      </div>
      <button type="button" class="senior-listen-btn" aria-label="${listenLabel}">
        <span>${listenLabel}</span>
      </button>
    </div>
  `;
}

/**
 * Creates a chat message bubble element.
 *
 * @param {'user'|'model'} role
 * @param {string} content
 * @param {number} timestamp
 * @returns {HTMLElement}
 */
function createBubbleElement(role, content, timestamp) {
  const isSini = role === 'model';

  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${isSini ? 'sini' : 'user'}`;
  wrapper.setAttribute('role', 'article');
  wrapper.setAttribute('aria-label', `${isSini ? 'SINI' : t('welcome.greeting').includes('Hello') ? 'You' : 'आप'}`);

  // Avatar
  const avatar = document.createElement('div');
  avatar.className = `avatar ${isSini ? 'avatar-sini' : 'avatar-user'}`;
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = isSini ? 'S' : '👤';

  // Bubble container
  const bubbleContainer = document.createElement('div');
  bubbleContainer.style.display = 'flex';
  bubbleContainer.style.flexDirection = 'column';
  bubbleContainer.style.gap = '4px';
  bubbleContainer.style.maxWidth = '100%';

  // Bubble text
  const bubble = document.createElement('div');
  bubble.className = `bubble ${isSini ? 'bubble-sini' : 'bubble-user'}`;

  if (isSini) {
    bubble.innerHTML = formatSeniorResponseHtml(content, getLang());
    // Attach event listener to the prominent senior listen button
    const listenBtn = bubble.querySelector('.senior-listen-btn');
    if (listenBtn) {
      listenBtn.addEventListener('click', () => {
        speak(content, { force: true });
        const isHi = getLang() === 'hi' || isHindiText(content);
        const originalText = listenBtn.innerHTML;
        listenBtn.innerHTML = `<span>${isHi ? '🔊 बोल रहा हूँ...' : '🔊 Speaking...'}</span>`;
        setTimeout(() => {
          listenBtn.innerHTML = originalText;
        }, 3500);
      });
    }
  } else {
    // User input: textContent only (no HTML injection)
    bubble.textContent = content;
  }

  // Timestamp + actions row
  const metaRow = document.createElement('div');
  metaRow.style.display = 'flex';
  metaRow.style.alignItems = 'center';
  metaRow.style.gap = '8px';
  metaRow.style.justifyContent = isSini ? 'flex-start' : 'flex-end';

  const timeEl = document.createElement('span');
  timeEl.className = 'chat-timestamp';
  timeEl.textContent = formatTime(timestamp, getLang());
  timeEl.setAttribute('aria-label', `sent at ${timeEl.textContent}`);

  // Action buttons (copy + TTS per message)
  const actionsEl = document.createElement('div');
  actionsEl.className = 'bubble-actions';

  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'bubble-action-btn';
  copyBtn.textContent = '📋 Copy';
  copyBtn.setAttribute('aria-label', 'Copy this message');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(content);
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
      showToast(t('chat.copied'), 'success');
    } catch {
      showToast(t('error.generic'), 'error');
    }
  });

  actionsEl.appendChild(copyBtn);

  metaRow.appendChild(actionsEl);
  metaRow.appendChild(timeEl);

  bubbleContainer.appendChild(bubble);
  bubbleContainer.appendChild(metaRow);

  if (isSini) {
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubbleContainer);
  } else {
    wrapper.appendChild(bubbleContainer);
    wrapper.appendChild(avatar);
  }

  return wrapper;
}

/**
 * Appends a date divider to the chat area.
 * @param {string} label
 */
function appendDateDivider(label) {
  const divider = document.createElement('div');
  divider.className = 'chat-date-divider';
  divider.setAttribute('aria-hidden', 'true');

  const span = document.createElement('span');
  span.textContent = label;
  divider.appendChild(span);

  chatArea.appendChild(divider);
}

/**
 * Shows the typing indicator bubble.
 * @returns {HTMLElement} The indicator element (for removal)
 */
function showTypingIndicator() {
  const wrapper = document.createElement('div');
  wrapper.className = 'typing-message';
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-label', 'SINI is thinking...');

  const avatar = document.createElement('div');
  avatar.className = 'avatar avatar-sini';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = 'S';

  const bubble = document.createElement('div');
  bubble.className = 'bubble bubble-sini';
  bubble.style.padding = '16px 20px';

  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    dot.className = 'typing-dot';
    indicator.appendChild(dot);
  }

  bubble.appendChild(indicator);
  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatArea.appendChild(wrapper);

  scrollToBottom();
  announce('SINI is thinking...');

  return wrapper;
}

/**
 * Appends an error message bubble.
 * @param {string} message
 */
function appendErrorBubble(message) {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-message sini';

  const avatar = document.createElement('div');
  avatar.className = 'avatar avatar-sini';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = 'S';

  const bubble = document.createElement('div');
  bubble.className = 'error-bubble';
  bubble.textContent = '⚠️ ' + message;
  bubble.setAttribute('role', 'alert');

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatArea.appendChild(wrapper);
  scrollToBottom();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scrollToBottom(smooth = true) {
  if (!chatArea) return;
  chatArea.scrollTo({
    top:      chatArea.scrollHeight,
    behavior: smooth ? 'smooth' : 'instant',
  });
}

function hideWelcome() {
  if (welcomeMessage) welcomeMessage.classList.add('hidden');
}

function showWelcome() {
  if (welcomeMessage) welcomeMessage.classList.remove('hidden');
}
