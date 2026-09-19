/**
 * SINIcare — features/simplifier.js
 *
 * Document / message simplification feature.
 * Users paste complex text (legal notices, medical reports, government letters)
 * and receive a simplified, easy-to-read summary.
 */

'use strict';

import { simplifyText } from '../gemini.js';
import { renderMarkdownSafe, sanitizeInput } from '../security.js';
import { t } from '../i18n.js';
import { announce, trapFocus, onEscapeClose } from '../a11y.js';
import { hasApiKey } from '../gemini.js';
import { speak } from '../voice.js';
import { showToast } from '../toast.js';

let panelEl    = null;
let inputEl    = null;
let simplifyBtn = null;
let resultEl   = null;
let cleanupFns = [];

/**
 * Initializes the simplifier panel.
 */
export function initSimplifier() {
  panelEl     = document.getElementById('simplify-overlay');
  if (!panelEl) return;

  inputEl     = document.getElementById('simplify-input');
  simplifyBtn = document.getElementById('simplify-btn');
  resultEl    = document.getElementById('simplify-result');

  simplifyBtn?.addEventListener('click', handleSimplify);
  document.getElementById('simplify-close-btn')?.addEventListener('click', closePanel);
}

/**
 * Opens the simplifier panel.
 */
export function openSimplifier() {
  if (!panelEl) return;

  if (!hasApiKey()) {
    showToast(t('settings.api.required'), 'warning');
    return;
  }

  panelEl.classList.remove('hidden');
  if (inputEl)  inputEl.value = '';
  if (resultEl) resultEl.innerHTML = '';

  const releaseTrap = trapFocus(panelEl.querySelector('.modal'));
  const releaseEsc  = onEscapeClose(panelEl, closePanel);
  cleanupFns = [releaseTrap, releaseEsc];

  announce(t('simplify.title'), 'assertive');
  inputEl?.focus();
}

/**
 * Closes the simplifier panel.
 */
export function closePanel() {
  panelEl?.classList.add('hidden');
  cleanupFns.forEach(fn => fn?.());
  cleanupFns = [];
  document.getElementById('qa-simplify')?.focus();
}

/**
 * Handles the simplify button click.
 */
async function handleSimplify() {
  const text = sanitizeInput(inputEl?.value ?? '', 3000);

  if (!text) {
    showToast(t('simplify.empty'), 'warning');
    inputEl?.focus();
    return;
  }

  setLoading(true);
  if (resultEl) resultEl.innerHTML = '';

  try {
    const simplified = await simplifyText(text);
    renderResult(simplified);
    announce('Simplified: ' + simplified);
    speak(simplified);
  } catch (err) {
    if (resultEl) {
      resultEl.innerHTML = `<div class="error-bubble" role="alert">⚠️ ${escapeForDisplay(err.message ?? t('error.generic'))}</div>`;
    }
    showToast(err.message ?? t('error.generic'), 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * Renders the simplified result with copy and listen buttons.
 * @param {string} text
 */
function renderResult(text) {
  if (!resultEl) return;

  const safeHtml = renderMarkdownSafe(text);

  resultEl.innerHTML = `
    <div class="card" role="region" aria-label="Simplified text" aria-live="polite">
      <div class="card-header">
        <div class="card-icon" aria-hidden="true">✅</div>
        <h3 style="font-size: var(--font-size-md); color: var(--color-safe);">Here is the simple version:</h3>
      </div>
      <div class="simplified-content" style="font-size: var(--font-size-chat); line-height: var(--line-height-body);">
        ${safeHtml}
      </div>
      <div style="display:flex; gap: var(--spacing-xs); margin-top: var(--spacing-md); flex-wrap: wrap;">
        <button class="btn btn-secondary" id="simplify-listen-btn" style="min-height: 44px; padding: 8px 16px; font-size: var(--font-size-sm);">
          🔊 Listen
        </button>
        <button class="btn btn-secondary" id="simplify-copy-btn" style="min-height: 44px; padding: 8px 16px; font-size: var(--font-size-sm);">
          📋 Copy
        </button>
      </div>
    </div>
  `;

  // Wire up buttons
  document.getElementById('simplify-listen-btn')?.addEventListener('click', () => {
    speak(text, { force: true });
  });

  document.getElementById('simplify-copy-btn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById('simplify-copy-btn');
      if (btn) btn.textContent = '✅ Copied!';
      setTimeout(() => {
        const b = document.getElementById('simplify-copy-btn');
        if (b) b.textContent = '📋 Copy';
      }, 2000);
    } catch { /* ignore */ }
  });
}

function setLoading(loading) {
  if (!simplifyBtn) return;
  simplifyBtn.disabled = loading;
  simplifyBtn.textContent = loading ? t('simplify.analyzing') : t('btn.simplify');
}

function escapeForDisplay(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
