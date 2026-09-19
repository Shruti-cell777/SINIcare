/**
 * SINIcare — a11y.js
 *
 * Accessibility helpers: ARIA live-region announcements,
 * focus management, and keyboard interaction utilities.
 */

'use strict';

let liveRegion = null;

/**
 * Initializes the ARIA live region element.
 * Must be called once during app bootstrap.
 */
export function initLiveRegion() {
  liveRegion = document.getElementById('live-region');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'live-region';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('role', 'status');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
  }
}

/**
 * Announces a message to screen readers via the live region.
 * Uses a brief delay trick to ensure the DOM mutation is picked up.
 *
 * @param {string} message - The message to announce
 * @param {'polite'|'assertive'} [priority='polite']
 */
export function announce(message, priority = 'polite') {
  if (!liveRegion) initLiveRegion();

  liveRegion.setAttribute('aria-live', priority);
  liveRegion.textContent = '';

  // Small delay so screen readers detect the change
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      liveRegion.textContent = message;
    });
  });
}

/**
 * Moves keyboard focus to a specified element.
 * Adds tabindex="-1" if needed so non-interactive elements can receive focus.
 *
 * @param {HTMLElement|string} target - Element or CSS selector
 * @param {boolean} [scroll=true] - Whether to scroll the element into view
 */
export function focusElement(target, scroll = true) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;

  if (!el.hasAttribute('tabindex')) {
    el.setAttribute('tabindex', '-1');
  }

  el.focus({ preventScroll: !scroll });
}

/**
 * Traps keyboard focus within a container element.
 * Useful for modals and dialogs.
 *
 * @param {HTMLElement} container - The trap container
 * @returns {() => void} Cleanup function to remove the trap
 */
export function trapFocus(container) {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  function getFocusable() {
    return Array.from(container.querySelectorAll(focusableSelectors));
  }

  function handleKeydown(event) {
    if (event.key !== 'Tab') return;

    const focusable = getFocusable();
    if (focusable.length === 0) { event.preventDefault(); return; }

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  container.addEventListener('keydown', handleKeydown);

  // Focus the first focusable element
  const focusable = getFocusable();
  if (focusable.length > 0) {
    requestAnimationFrame(() => focusable[0].focus());
  }

  // Return cleanup
  return () => container.removeEventListener('keydown', handleKeydown);
}

/**
 * Closes a modal when Escape is pressed.
 *
 * @param {HTMLElement} modalEl - The modal element
 * @param {() => void} closeCallback - Function to call on Escape
 * @returns {() => void} Cleanup function
 */
export function onEscapeClose(modalEl, closeCallback) {
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCallback();
    }
  }
  document.addEventListener('keydown', handleKeydown);
  return () => document.removeEventListener('keydown', handleKeydown);
}

/**
 * Returns a formatted timestamp string for chat messages.
 * Uses locale-appropriate short time format.
 *
 * @param {number} [timestamp=Date.now()]
 * @param {'en'|'hi'} [lang='en']
 * @returns {string}
 */
export function formatTime(timestamp = Date.now(), lang = 'en') {
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  return new Date(timestamp).toLocaleTimeString(locale, {
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a date for use as a chat date divider.
 *
 * @param {number} timestamp
 * @param {'en'|'hi'} [lang='en']
 * @returns {string}
 */
export function formatDate(timestamp, lang = 'en') {
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return lang === 'hi' ? 'आज' : 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return lang === 'hi' ? 'कल' : 'Yesterday';
  }
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Auto-resizes a textarea to fit its content.
 *
 * @param {HTMLTextAreaElement} textarea
 */
export function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
}
