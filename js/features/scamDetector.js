/**
 * SINIcare — features/scamDetector.js
 *
 * Scam / suspicious message analyzer.
 * Opens a dedicated panel where users can paste a message
 * and get a clear, traffic-light safety verdict from the AI.
 */

'use strict';

import { analyzeScam } from '../gemini.js';
import { quickScamScan } from '../security.js';
import { t, getLang } from '../i18n.js';
import { announce, trapFocus, onEscapeClose } from '../a11y.js';
import { showToast, showToast as dispatchToast } from '../toast.js';
import { hasApiKey } from '../gemini.js';

let panelEl      = null;
let textareaEl   = null;
let analyzeBtn   = null;
let resultEl     = null;
let cleanupFns   = [];

/**
 * Initializes the scam detector panel (creates DOM once, then reuses).
 */
export function initScamDetector() {
  panelEl = document.getElementById('scam-overlay');
  if (!panelEl) return;

  textareaEl = document.getElementById('scam-input');
  analyzeBtn = document.getElementById('scam-analyze-btn');
  resultEl   = document.getElementById('scam-result');

  analyzeBtn?.addEventListener('click', handleAnalyze);
  document.getElementById('scam-close-btn')?.addEventListener('click', closePanel);
}

/**
 * Opens the scam detector panel.
 */
export function openScamDetector() {
  if (!panelEl) return;

  if (!hasApiKey()) {
    dispatchToast(t('settings.api.required'), 'warning');
    return;
  }

  panelEl.classList.remove('hidden');
  if (textareaEl) textareaEl.value = '';
  if (resultEl)   resultEl.innerHTML = '';

  const releaseTrap  = trapFocus(panelEl.querySelector('.modal'));
  const releaseEsc   = onEscapeClose(panelEl, closePanel);
  cleanupFns = [releaseTrap, releaseEsc];

  announce(t('scam.title'), 'assertive');
}

/**
 * Closes the scam detector panel.
 */
export function closePanel() {
  if (!panelEl) return;
  panelEl.classList.add('hidden');
  cleanupFns.forEach(fn => fn?.());
  cleanupFns = [];
  document.getElementById('qa-scam')?.focus();
}

/**
 * Handles the analyze button click.
 */
async function handleAnalyze() {
  const text = textareaEl?.value?.trim();

  if (!text) {
    dispatchToast(t('scam.empty'), 'warning');
    textareaEl?.focus();
    return;
  }

  // Show loading state
  setLoading(true);
  if (resultEl) resultEl.innerHTML = '';

  // Quick local scan for immediate feedback
  const { score } = quickScamScan(text);
  if (score > 0.5 && resultEl) {
    resultEl.innerHTML = buildResultHTML('SUSPICIOUS',
      '⚠️ This looks suspicious at first glance — analyzing in detail...',
      ''
    );
  }

  try {
    const result = await analyzeScam(text);
    renderResult(result);
    announce(`${result.status}: ${result.reason}`);
  } catch (err) {
    if (resultEl) {
      resultEl.innerHTML = `<div class="error-bubble" role="alert">
        ⚠️ ${err.message ?? t('error.generic')}
      </div>`;
    }
    dispatchToast(err.message ?? t('error.generic'), 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * Renders a structured scam result.
 * @param {{ status: string, reason: string, advice: string }} result
 */
function renderResult({ status, reason, advice }) {
  if (!resultEl) return;

  const classMap = { SAFE: 'safe', SUSPICIOUS: 'warning', DANGER: 'danger' };
  const iconMap  = { SAFE: '✅', SUSPICIOUS: '⚠️', DANGER: '🚨' };
  const labelKey = { SAFE: 'scam.safe', SUSPICIOUS: 'scam.suspicious', DANGER: 'scam.danger' };

  const cls  = classMap[status] ?? 'warning';
  const icon = iconMap[status]  ?? '⚠️';
  const label = t(labelKey[status] ?? 'scam.suspicious');

  resultEl.innerHTML = buildResultHTML(status, reason, advice, icon, label, cls);
}

function buildResultHTML(status, reason, advice, icon = '⚠️', label = '', cls = 'warning') {
  return `
    <div class="scam-result ${cls}" role="region" aria-live="polite" aria-label="Analysis result">
      <div class="scam-result-icon" aria-hidden="true">${icon}</div>
      <div class="scam-result-title">${label || status}</div>
      <p>${escapeForDisplay(reason)}</p>
      ${advice ? `<p><strong>What to do:</strong> ${escapeForDisplay(advice)}</p>` : ''}
    </div>
  `;
}

function setLoading(loading) {
  if (!analyzeBtn) return;
  analyzeBtn.disabled = loading;
  analyzeBtn.textContent = loading ? t('scam.analyzing') : t('btn.analyze');
}

/** Escapes text for safe display in innerHTML */
function escapeForDisplay(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
