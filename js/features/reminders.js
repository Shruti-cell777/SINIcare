/**
 * SINIcare — features/reminders.js
 *
 * Reminder management UI.
 * Seniors can add, complete, and delete simple reminders.
 * Reminders are persisted in localStorage.
 * Browser notifications are requested when available.
 */

'use strict';

import {
  getReminders,
  addReminder,
  toggleReminder,
  deleteReminder,
} from '../storage.js';
import { t, getLang } from '../i18n.js';
import { announce, trapFocus, onEscapeClose } from '../a11y.js';
import { showToast } from '../toast.js';
import { escapeHtml } from '../security.js';

let modalEl      = null;
let listEl       = null;
let inputEl      = null;
let timeEl       = null;
let addBtn       = null;
let cleanupFns   = [];

/** @type {Map<string, NodeJS.Timeout>} Active notification timers by reminder ID */
const notifTimers = new Map();

/**
 * Initializes the reminders module.
 */
export function initReminders() {
  modalEl = document.getElementById('reminders-overlay');
  if (!modalEl) return;

  listEl  = document.getElementById('reminder-list');
  inputEl = document.getElementById('reminder-input');
  timeEl  = document.getElementById('reminder-time');
  addBtn  = document.getElementById('reminder-add-btn');

  addBtn?.addEventListener('click', handleAdd);
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  });

  document.getElementById('reminders-close-btn')?.addEventListener('click', closeModal);

  // Schedule notifications for existing reminders
  scheduleAllNotifications();
}

/**
 * Opens the reminders modal.
 */
export function openReminders() {
  if (!modalEl) return;
  modalEl.classList.remove('hidden');

  renderList();

  const releaseTrap = trapFocus(modalEl.querySelector('.modal'));
  const releaseEsc  = onEscapeClose(modalEl, closeModal);
  cleanupFns = [releaseTrap, releaseEsc];

  announce(t('reminders.title'), 'assertive');
  inputEl?.focus();
}

/**
 * Closes the reminders modal.
 */
export function closeModal() {
  modalEl?.classList.add('hidden');
  cleanupFns.forEach(fn => fn?.());
  cleanupFns = [];
  document.getElementById('qa-reminder')?.focus();
}

// ── CRUD handlers ─────────────────────────────────────────────────────────────

function handleAdd() {
  const text = inputEl?.value?.trim();
  if (!text) {
    showToast(t('reminders.placeholder'), 'warning');
    inputEl?.focus();
    return;
  }

  const time = timeEl?.value || null;
  const reminder = addReminder({ text, time });

  if (inputEl) inputEl.value = '';
  if (timeEl)  timeEl.value  = '';

  renderList();
  scheduleNotification(reminder);

  showToast(t('reminders.added'), 'success');
  announce(t('reminders.added') + ': ' + text);
  inputEl?.focus();
}

function handleToggle(id) {
  const completed = toggleReminder(id);
  renderList();

  if (completed) {
    showToast(t('reminders.done'), 'success');
    announce(t('reminders.done'));
    // Cancel notification if marked done
    clearReminderTimer(id);
  }
}

function handleDelete(id, text) {
  deleteReminder(id);
  clearReminderTimer(id);
  renderList();
  showToast(t('reminders.deleted'), 'info');
  announce(t('reminders.deleted') + ': ' + text);
}

// ── Rendering ──────────────────────────────────────────────────────────────────

/**
 * Renders the full reminders list.
 */
function renderList() {
  if (!listEl) return;
  const reminders = getReminders();
  listEl.innerHTML = '';

  if (reminders.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'reminder-empty';
    empty.textContent = t('reminders.empty');
    listEl.appendChild(empty);
    return;
  }

  reminders.forEach(r => {
    const item = renderReminderItem(r);
    listEl.appendChild(item);
  });
}

/**
 * Creates a single reminder item element.
 * @param {{ id: string, text: string, time: string|null, completed: boolean }} r
 * @returns {HTMLElement}
 */
function renderReminderItem(r) {
  const item = document.createElement('div');
  item.className = `reminder-item${r.completed ? ' completed' : ''}`;
  item.setAttribute('role', 'listitem');
  item.dataset.id = r.id;

  // Checkbox
  const check = document.createElement('button');
  check.className = 'reminder-check';
  check.setAttribute('aria-label', r.completed ? 'Mark as not done' : 'Mark as done');
  check.setAttribute('role', 'checkbox');
  check.setAttribute('aria-checked', String(r.completed));
  check.textContent = r.completed ? '✓' : '';
  check.addEventListener('click', () => handleToggle(r.id));

  // Content
  const content = document.createElement('div');
  content.className = 'reminder-content';

  const textEl = document.createElement('div');
  textEl.className = 'reminder-text';
  textEl.textContent = r.text; // safe: textContent

  content.appendChild(textEl);

  if (r.time) {
    const timeEl = document.createElement('div');
    timeEl.className = 'reminder-time';
    timeEl.textContent = formatReminderTime(r.time);
    content.appendChild(timeEl);
  }

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'reminder-delete';
  deleteBtn.setAttribute('aria-label', `Delete reminder: ${r.text}`);
  deleteBtn.textContent = '🗑️';
  deleteBtn.addEventListener('click', () => handleDelete(r.id, r.text));

  item.appendChild(check);
  item.appendChild(content);
  item.appendChild(deleteBtn);

  return item;
}

// ── Notifications ──────────────────────────────────────────────────────────────

/**
 * Schedules all non-completed reminders with a time set in the future.
 */
function scheduleAllNotifications() {
  const reminders = getReminders();
  reminders
    .filter(r => !r.completed && r.time)
    .forEach(r => scheduleNotification(r));
}

/**
 * Schedules a browser notification for a timed reminder.
 * @param {{ id: string, text: string, time: string }} reminder
 */
async function scheduleNotification(reminder) {
  if (!reminder.time || reminder.completed) return;

  const [h, m] = reminder.time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return;

  const now  = new Date();
  const fire = new Date();
  fire.setHours(h, m, 0, 0);

  if (fire <= now) fire.setDate(fire.getDate() + 1); // schedule for tomorrow if past

  const delay = fire.getTime() - now.getTime();
  if (delay > 24 * 60 * 60 * 1000) return; // more than 24h away

  const timer = setTimeout(async () => {
    await requestAndShowNotification(
      'SINIcare Reminder ⏰',
      reminder.text
    );
  }, delay);

  notifTimers.set(reminder.id, timer);
}

function clearReminderTimer(id) {
  const timer = notifTimers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    notifTimers.delete(id);
  }
}

async function requestAndShowNotification(title, body) {
  if (!('Notification' in window)) return;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  } else {
    // Fallback: show an in-app toast
    showToast(`⏰ ${body}`, 'info');
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatReminderTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(getLang() === 'hi' ? 'hi-IN' : 'en-IN', {
    hour: '2-digit', minute: '2-digit'
  });
}
