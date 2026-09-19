/**
 * SINIcare — features/quickActions.js
 *
 * Quick action button grid.
 * Each button is a shortcut that either opens a feature panel
 * or injects a canned prompt into the chat.
 */

'use strict';

import { t, getLang } from '../i18n.js';
import { injectSiniMessage } from '../chat.js';
import { openScamDetector } from './scamDetector.js';
import { openSimplifier } from './simplifier.js';
import { openReminders } from './reminders.js';
import { openGrocery } from './grocery.js';
import { hasApiKey } from '../gemini.js';
import { getTrustedContact } from '../storage.js';
import { showToast } from '../toast.js';
import { trapFocus, onEscapeClose } from '../a11y.js';

/**
 * Quick action definitions.
 * Each action has an id, icon, i18n label key, and a handler.
 */
const QUICK_ACTIONS = [
  {
    id:      'qa-scam',
    icon:    '🛡️',
    labelKey:'qa.scam',
    handler: openScamDetector,
  },
  {
    id:      'qa-simplify',
    icon:    '📄',
    labelKey:'qa.simplify',
    handler: openSimplifier,
  },
  {
    id:      'qa-form',
    icon:    '📋',
    labelKey:'qa.form',
    handler: handleFormHelper,
  },
  {
    id:      'qa-reminder',
    icon:    '⏰',
    labelKey:'qa.reminder',
    handler: openReminders,
  },
  {
    id:      'qa-grocery',
    icon:    '🛒',
    labelKey:'qa.grocery',
    handler: openGrocery,
  },
  {
    id:      'qa-website',
    icon:    '🌐',
    labelKey:'qa.website',
    handler: handleWebsiteHelp,
  },
  {
    id:      'qa-help',
    icon:    '📞',
    labelKey:'qa.help',
    handler: handleCallFamily,
  },
];

/**
 * Initializes quick action buttons.
 * Wires up click and keyboard handlers.
 */
export function initQuickActions() {
  QUICK_ACTIONS.forEach(action => {
    const btn = document.getElementById(action.id);
    if (!btn) return;

    btn.addEventListener('click', () => action.handler());

    // Keyboard: Enter and Space activate
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        action.handler();
      }
    });
  });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleFormHelper() {
  if (!hasApiKey()) {
    showToast(t('settings.api.required'), 'warning');
    return;
  }

  injectSiniMessage(
    getLang() === 'en'
      ? `I can help you fill out any form step by step! 📋\n\nJust tell me:\n1. What form do you need to fill?\n2. Or paste the form's questions below\n\nI'll guide you through each part, one step at a time.`
      : `मैं आपको फॉर्म भरने में मदद करूँगा! 📋\n\nबताइए:\n1. कौन सा फॉर्म भरना है?\n2. या फॉर्म के सवाल नीचे चिपकाएँ\n\nमैं एक-एक कदम बताऊँगा।`
  );
}

function handleWebsiteHelp() {
  if (!hasApiKey()) {
    showToast(t('settings.api.required'), 'warning');
    return;
  }

  injectSiniMessage(
    getLang() === 'en'
      ? `I can help you use any website! 🌐\n\nJust tell me:\n• Which website do you want to use?\n• What do you want to do on it?\n\nFor example: "Help me book a train ticket on IRCTC" or "How do I pay my electricity bill online?"`
      : `मैं आपको कोई भी वेबसाइट इस्तेमाल करने में मदद करूँगा! 🌐\n\nबताइए:\n• कौन सी वेबसाइट?\n• क्या करना है?\n\nजैसे: "IRCTC पर ट्रेन टिकट बुक करना है"`
  );
}

/**
 * Handles the "Call Family" quick action.
 * Shows the trusted contact call modal.
 */
function handleCallFamily() {
  const contact = getTrustedContact();
  const overlay = document.getElementById('contact-overlay');
  if (!overlay) return;

  const nameEl  = document.getElementById('contact-call-name');
  const phoneEl = document.getElementById('contact-call-phone');
  const callBtn = document.getElementById('contact-call-btn');
  const noneEl  = document.getElementById('contact-none-msg');

  if (contact.name && contact.phone) {
    if (nameEl)  nameEl.textContent  = contact.name;
    if (phoneEl) phoneEl.textContent = contact.phone;
    if (noneEl)  noneEl.classList.add('hidden');
    if (callBtn) {
      callBtn.classList.remove('hidden');
      callBtn.onclick = () => {
        window.location.href = `tel:${contact.phone.replace(/\s/g, '')}`;
      };
    }
  } else {
    if (nameEl)  nameEl.textContent  = '';
    if (noneEl)  noneEl.classList.remove('hidden');
    if (callBtn) callBtn.classList.add('hidden');
  }

  overlay.classList.remove('hidden');

  const releaseTrap = trapFocus(overlay.querySelector('.modal'));
  const releaseEsc  = onEscapeClose(overlay, () => {
    overlay.classList.add('hidden');
    releaseTrap?.();
    releaseEsc?.();
    document.getElementById('qa-help')?.focus();
  });

  document.getElementById('contact-close-btn')?.addEventListener('click', () => {
    overlay.classList.add('hidden');
    releaseTrap?.();
    document.getElementById('qa-help')?.focus();
  }, { once: true });
}
