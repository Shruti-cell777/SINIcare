/**
 * SINIcare — toast.js
 *
 * Reusable toast notification module.
 * Standalone module with no dependencies to avoid circular imports.
 */

'use strict';

/**
 * Shows a toast notification in #toast-container.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} [type='info']
 * @param {number} [duration=3500] ms
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
  toast.textContent = (icons[type] ?? 'ℹ️') + ' ' + message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

// Support custom event dispatch as well
if (typeof window !== 'undefined') {
  window.addEventListener('sini:toast', (event) => {
    const { message, type, duration } = event.detail || {};
    if (message) {
      showToast(message, type, duration);
    }
  });
}
