/**
 * SINIcare — features/grocery.js
 *
 * AI-guided grocery ordering assistant.
 * - Collects what the senior wants to order
 * - Asks for quantity / brand preference
 * - Shows a clear confirmation summary
 * - Opens Blinkit search for the item
 * - Hands off to Blinkit — NEVER collects payment credentials
 */

'use strict';

import { getLang } from '../i18n.js';
import { buildBlinkitUrl } from '../gemini.js';
import { showToast } from '../toast.js';
import { trapFocus, onEscapeClose } from '../a11y.js';

// ── State ─────────────────────────────────────────────────────────────────────

let groceryState = {
  step: 'idle',        // idle | ask_item | ask_qty | confirm | done
  item: '',
  qty: '',
  brand: '',
};

// ── Panel bootstrap ───────────────────────────────────────────────────────────

/**
 * Opens the grocery ordering panel.
 */
export function openGrocery() {
  const overlay = document.getElementById('grocery-overlay');
  if (!overlay) return;

  resetGroceryState();
  renderStep();
  overlay.classList.remove('hidden');

  const releaseTrap = trapFocus(overlay.querySelector('.modal'));
  const releaseEsc  = onEscapeClose(overlay, () => closeGrocery(releaseTrap, releaseEsc));

  document.getElementById('grocery-close-btn')?.addEventListener('click', () => {
    closeGrocery(releaseTrap, releaseEsc);
  }, { once: true });
}

function closeGrocery(releaseTrap, releaseEsc) {
  document.getElementById('grocery-overlay')?.classList.add('hidden');
  releaseTrap?.();
  releaseEsc?.();
  document.getElementById('qa-grocery')?.focus();
}

function resetGroceryState() {
  groceryState = { step: 'ask_item', item: '', qty: '', brand: '' };
}

// ── Step renderer ─────────────────────────────────────────────────────────────

function renderStep() {
  const hi = getLang() === 'hi';
  const body = document.getElementById('grocery-body');
  if (!body) return;

  switch (groceryState.step) {
    case 'ask_item':
      renderAskItem(body, hi);
      break;
    case 'ask_qty':
      renderAskQty(body, hi);
      break;
    case 'confirm':
      renderConfirm(body, hi);
      break;
    case 'done':
      renderDone(body, hi);
      break;
    default:
      break;
  }
}

// ── Step: Ask what to order ───────────────────────────────────────────────────

function renderAskItem(body, hi) {
  body.innerHTML = `
    <div class="grocery-step">
      <div class="grocery-step-icon" aria-hidden="true">🛒</div>
      <h3 class="grocery-step-title">
        ${hi ? 'आप क्या मंगवाना चाहते हैं?' : 'What would you like to order?'}
      </h3>
      <p class="grocery-step-hint">
        ${hi
          ? 'जैसे: दूध, आटा, चावल, सब्ज़ियाँ, बिस्कुट...'
          : 'E.g.: Milk, Flour, Rice, Vegetables, Biscuits...'}
      </p>

      <div class="form-group" style="margin-top:16px;">
        <label class="form-label" for="grocery-item-input">
          ${hi ? 'सामान का नाम लिखें:' : 'Item name:'}
        </label>
        <input
          type="text"
          id="grocery-item-input"
          class="form-input"
          autocomplete="off"
          placeholder="${hi ? 'जैसे: अमूल दूध' : 'e.g., Amul Milk'}"
          style="font-size: var(--font-size-md);"
        >
      </div>

      <button id="grocery-next-item" class="btn btn-primary grocery-cta-btn">
        ${hi ? 'आगे बढ़ें →' : 'Next →'}
      </button>
    </div>
  `;

  const input = document.getElementById('grocery-item-input');
  input?.focus();

  document.getElementById('grocery-next-item')?.addEventListener('click', () => {
    const val = input?.value?.trim();
    if (!val) {
      showToast(hi ? 'कृपया सामान का नाम लिखें।' : 'Please enter an item name.', 'warning');
      input?.focus();
      return;
    }
    groceryState.item = val;
    groceryState.step = 'ask_qty';
    renderStep();
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('grocery-next-item')?.click();
  });
}

// ── Step: Ask quantity & brand ────────────────────────────────────────────────

function renderAskQty(body, hi) {
  body.innerHTML = `
    <div class="grocery-step">
      <div class="grocery-step-icon" aria-hidden="true">📦</div>
      <h3 class="grocery-step-title">
        ${hi
          ? `"${groceryState.item}" — कितना चाहिए?`
          : `"${groceryState.item}" — How much do you need?`}
      </h3>

      <div class="form-group" style="margin-top:16px;">
        <label class="form-label" for="grocery-qty-input">
          ${hi ? 'मात्रा / संख्या:' : 'Quantity:'}
        </label>
        <input
          type="text"
          id="grocery-qty-input"
          class="form-input"
          placeholder="${hi ? 'जैसे: 2 पैकेट, 1 kg, 6 नग' : 'e.g., 2 packets, 1 kg, 6 pieces'}"
          style="font-size: var(--font-size-md);"
        >
      </div>

      <div class="form-group">
        <label class="form-label" for="grocery-brand-input">
          ${hi ? 'कोई खास ब्रांड? (वैकल्पिक)' : 'Preferred brand? (optional)'}
        </label>
        <input
          type="text"
          id="grocery-brand-input"
          class="form-input"
          placeholder="${hi ? 'जैसे: अमूल, पतंजलि, Fortune' : 'e.g., Amul, Patanjali, Fortune'}"
          style="font-size: var(--font-size-md);"
        >
      </div>

      <div style="display:flex; gap:10px; margin-top:4px;">
        <button id="grocery-back-qty" class="btn btn-secondary" style="flex:1;">
          ${hi ? '← वापस' : '← Back'}
        </button>
        <button id="grocery-next-qty" class="btn btn-primary" style="flex:2;">
          ${hi ? 'पक्का करें →' : 'Confirm →'}
        </button>
      </div>
    </div>
  `;

  const qtyInput = document.getElementById('grocery-qty-input');
  qtyInput?.focus();

  document.getElementById('grocery-back-qty')?.addEventListener('click', () => {
    groceryState.step = 'ask_item';
    renderStep();
  });

  document.getElementById('grocery-next-qty')?.addEventListener('click', () => {
    const qty   = qtyInput?.value?.trim();
    const brand = document.getElementById('grocery-brand-input')?.value?.trim();

    if (!qty) {
      showToast(hi ? 'कृपया मात्रा बताएं।' : 'Please enter a quantity.', 'warning');
      qtyInput?.focus();
      return;
    }

    groceryState.qty   = qty;
    groceryState.brand = brand || '';
    groceryState.step  = 'confirm';
    renderStep();
  });
}

// ── Step: Confirm order ───────────────────────────────────────────────────────

function renderConfirm(body, hi) {
  const { item, qty, brand } = groceryState;
  const brandLine = brand
    ? (hi ? `<li><strong>ब्रांड:</strong> ${brand}</li>` : `<li><strong>Brand:</strong> ${brand}</li>`)
    : '';

  const summaryLabel = hi ? 'आपका ऑर्डर सारांश' : 'Your Order Summary';
  const itemLabel    = hi ? 'सामान' : 'Item';
  const qtyLabel     = hi ? 'मात्रा' : 'Quantity';

  body.innerHTML = `
    <div class="grocery-step">
      <div class="grocery-step-icon" aria-hidden="true">✅</div>
      <h3 class="grocery-step-title">
        ${hi ? 'क्या यह सही है?' : 'Is this correct?'}
      </h3>

      <div class="grocery-summary-box">
        <div class="grocery-summary-title">${summaryLabel}</div>
        <ul class="grocery-summary-list">
          <li><strong>${itemLabel}:</strong> ${item}</li>
          <li><strong>${qtyLabel}:</strong> ${qty}</li>
          ${brandLine}
        </ul>
      </div>

      <div class="info-box grocery-safety-note">
        <span class="info-box-icon">🔒</span>
        <span>
          ${hi
            ? 'SINI आपका UPI PIN, OTP, या कोई भी बैंक जानकारी कभी नहीं मांगता। भुगतान आप खुद Blinkit पर करेंगे।'
            : 'SINI never asks for your UPI PIN, OTP, or banking details. You will complete payment yourself on Blinkit.'}
        </span>
      </div>

      <div style="display:flex; gap:10px; margin-top:8px; flex-wrap:wrap;">
        <button id="grocery-edit" class="btn btn-secondary" style="flex:1; min-width:120px;">
          ${hi ? '✏️ बदलें' : '✏️ Edit'}
        </button>
        <button id="grocery-open-blinkit" class="btn btn-primary grocery-cta-btn" style="flex:2; min-width:160px; background: linear-gradient(135deg, #f5a623, #e07b00); border-color: #e07b00;">
          ${hi ? '🛒 Blinkit पर ढूंढें' : '🛒 Search on Blinkit'}
        </button>
      </div>

      <p class="grocery-blinkit-hint">
        ${hi
          ? 'Blinkit खुलेगा — वहाँ आप सामान देखें, चुनें, और खुद भुगतान करें।'
          : 'Blinkit will open — browse the item, select it, and pay on your own.'}
      </p>
    </div>
  `;

  document.getElementById('grocery-edit')?.addEventListener('click', () => {
    groceryState.step = 'ask_item';
    renderStep();
  });

  document.getElementById('grocery-open-blinkit')?.addEventListener('click', () => {
    const searchTerm = groceryState.brand ? `${groceryState.brand} ${item}` : item;
    const url = buildBlinkitUrl(searchTerm);

    groceryState.step = 'done';
    renderStep();

    setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), 600);
  });
}

// ── Step: Done / handed off ───────────────────────────────────────────────────

function renderDone(body, hi) {
  const { item, qty } = groceryState;
  body.innerHTML = `
    <div class="grocery-step grocery-done-step">
      <div class="grocery-step-icon" aria-hidden="true">🎉</div>
      <h3 class="grocery-step-title">
        ${hi ? 'Blinkit खुल गया!' : 'Blinkit is Open!'}
      </h3>
      <p class="grocery-step-hint">
        ${hi
          ? `अब Blinkit पर <strong>${item}</strong> (${qty}) ढूंढें, चुनें, और खुद भुगतान करें।`
          : `Now find <strong>${item}</strong> (${qty}) on Blinkit, select it, and complete the payment yourself.`}
      </p>

      <div class="grocery-steps-guide">
        <div class="grocery-guide-step">
          <span class="grocery-guide-num">1</span>
          <span>${hi ? 'Blinkit में अपना सामान खोजें' : 'Find your item on Blinkit'}</span>
        </div>
        <div class="grocery-guide-step">
          <span class="grocery-guide-num">2</span>
          <span>${hi ? '"Add to Cart" दबाएं' : 'Tap "Add to Cart"'}</span>
        </div>
        <div class="grocery-guide-step">
          <span class="grocery-guide-num">3</span>
          <span>${hi ? '"Checkout" / "Pay Now" दबाएं' : 'Tap "Checkout" / "Pay Now"'}</span>
        </div>
        <div class="grocery-guide-step">
          <span class="grocery-guide-num">4</span>
          <span>${hi ? 'अपना UPI PIN खुद डालें — किसी को न बताएं' : 'Enter your UPI PIN yourself — never share it'}</span>
        </div>
      </div>

      <div class="info-box" style="margin-top:12px; border-color: var(--color-success);">
        <span class="info-box-icon">✅</span>
        <span>
          ${hi
            ? 'SINI ने Blinkit को जिम्मेदारी सौंप दी है। आपकी कोई भी भुगतान जानकारी SINI के पास नहीं है।'
            : 'SINI has handed control to Blinkit. No payment information is stored by SINI.'}
        </span>
      </div>

      <button id="grocery-new-order" class="btn btn-secondary" style="width:100%; margin-top:12px;">
        ${hi ? '🛒 कोई और सामान मंगवाएं' : '🛒 Order Another Item'}
      </button>
    </div>
  `;

  document.getElementById('grocery-new-order')?.addEventListener('click', () => {
    resetGroceryState();
    renderStep();
  });
}
