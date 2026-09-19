/**
 * SINIcare — app.js
 *
 * Application bootstrap and orchestrator.
 * Initializes all modules, wires up global UI interactions,
 * handles Hindi & English voice controls, speed adjustments,
 * persistent first-login setup, and toast notifications.
 */

'use strict';

import * as Storage from './storage.js';
import { setLang, getLang, applyTranslations, t } from './i18n.js';
import { initLiveRegion, announce, autoResizeTextarea, trapFocus, onEscapeClose } from './a11y.js';
import { initChat, sendMessage, clearChat } from './chat.js';
import {
  initStt,
  toggleRecording,
  cancelRecording,
  getIsRecording,
  switchSttLanguage,
  sttSupported,
  ttsSupported,
  waitForVoices,
  speak,
  stopSpeaking,
} from './voice.js';
import { initQuickActions } from './features/quickActions.js';
import { initScamDetector } from './features/scamDetector.js';
import { initSimplifier } from './features/simplifier.js';
import { initReminders } from './features/reminders.js';
import { isValidApiKey } from './security.js';
import { showToast } from './toast.js';

export { showToast };

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Restore user preferences
  const lang         = Storage.getLanguage();
  const fontSize     = Storage.getFontSize();
  const highContrast = Storage.getHighContrast();

  setLang(lang);
  applyFontSize(fontSize);
  if (highContrast) {
    document.documentElement.setAttribute('data-contrast', 'high');
  }

  // 2. Init accessibility live regions
  initLiveRegion();

  // 3. Apply translations to static DOM
  applyTranslations();

  // 4. Init all feature modules
  initChat();
  initQuickActions();
  initScamDetector();
  initSimplifier();
  initReminders();

  // 5. Voice / TTS
  await waitForVoices();
  if (sttSupported) {
    initStt({
      onStart:   handleRecordingStart,
      onEnd:     handleRecordingEnd,
      onResult:  handleVoiceResult,
      onInterim: handleVoiceInterim,
    });
  } else {
    // Hide mic button if STT is not supported
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.style.display = 'none';
  }

  // 6. Wire up global UI components
  wireInputArea();
  wireHeader();
  wireSettingsModal();
  wireSetupModal();

  // 7. Show setup modal ONLY ONCE on first login
  if (!Storage.hasCompletedSetup()) {
    openSetupModal();
  }

  // 8. Update TTS button and Language button states
  updateTtsBtn();
  updateLangButton(getLang());

  // 9. Global bridge: voice.js / other modules dispatch 'sini:toast' to avoid circular deps
  window.addEventListener('sini:toast', (e) => {
    const { message, type } = e.detail || {};
    if (message) showToast(message, type || 'info');
  });
});

// ── Hero Microphone State Machine & UI Controls ───────────────────────────────

let currentHeroState = 'idle'; // 'idle' | 'listening' | 'thinking' | 'speaking'

/**
 * Updates the Hero Microphone's visual state across the 4 stages:
 *  - idle: Tap to speak (Blue gradient)
 *  - listening: Listening... (Red pulsing ring + active transcript tray)
 *  - thinking: Understanding... (Amber glow)
 *  - speaking: Speaking... (Green glow + stop speaking tray)
 *
 * @param {'idle'|'listening'|'thinking'|'speaking'} state
 */
export function setHeroMicState(state) {
  currentHeroState = state;
  const isHi = getLang() === 'hi';

  const micBtn        = document.getElementById('hero-mic-btn');
  const micEmoji      = document.getElementById('hero-mic-emoji');
  const micLabel      = document.getElementById('hero-mic-label');
  const micRing       = document.getElementById('hero-mic-ring');
  const statePill     = document.getElementById('hero-state-pill');
  const stateLabel    = document.getElementById('hero-state-label');
  const promptQuote   = document.getElementById('hero-prompt-quote');
  const activeTray    = document.getElementById('hero-active-tray');
  const speakingTray  = document.getElementById('hero-speaking-tray');

  if (!micBtn) return;

  // Reset classes
  micBtn.className = `hero-mic-button state-${state}`;
  if (statePill) statePill.className = `hero-state-pill state-${state}`;

  switch (state) {
    case 'listening':
      if (micEmoji) micEmoji.textContent = '🎙️';
      if (micLabel) micLabel.textContent = isHi ? 'सुन रहा हूँ...' : 'Listening...';
      if (stateLabel) stateLabel.textContent = isHi ? '🔴 सुन रहा हूँ (हिंदी / English)' : '🔴 Listening (Hindi & English)';
      if (promptQuote) promptQuote.textContent = isHi ? '“साफ़ आवाज़ में अपनी बात बोलिए...”' : '“Speak clearly, I am listening...”';
      if (activeTray) activeTray.classList.remove('hidden');
      if (speakingTray) speakingTray.classList.add('hidden');
      if (micRing) micRing.style.display = 'block';
      micBtn.setAttribute('aria-pressed', 'true');
      break;

    case 'thinking':
      if (micEmoji) micEmoji.textContent = '⏳';
      if (micLabel) micLabel.textContent = isHi ? 'समझ रहा हूँ...' : 'Understanding...';
      if (stateLabel) stateLabel.textContent = isHi ? '⏳ समझ रहा हूँ...' : '⏳ Understanding...';
      if (promptQuote) promptQuote.textContent = isHi ? '“कृपया एक पल प्रतीक्षा करें...”' : '“Understanding your request...”';
      if (activeTray) activeTray.classList.add('hidden');
      if (speakingTray) speakingTray.classList.add('hidden');
      if (micRing) micRing.style.display = 'none';
      micBtn.setAttribute('aria-pressed', 'false');
      break;

    case 'speaking':
      if (micEmoji) micEmoji.textContent = '🔊';
      if (micLabel) micLabel.textContent = isHi ? 'बोल रहा हूँ...' : 'Speaking...';
      if (stateLabel) stateLabel.textContent = isHi ? '🔊 बोलकर बता रहा हूँ' : '🔊 Speaking aloud';
      if (promptQuote) promptQuote.textContent = isHi ? '“SINI बोलकर उत्तर दे रहा है”' : '“SINI is speaking aloud”';
      if (activeTray) activeTray.classList.add('hidden');
      if (speakingTray) speakingTray.classList.remove('hidden');
      if (micRing) micRing.style.display = 'none';
      micBtn.setAttribute('aria-pressed', 'false');
      break;

    case 'idle':
    default:
      if (micEmoji) micEmoji.textContent = '🎙️';
      if (micLabel) micLabel.textContent = isHi ? 'बोलने के लिए दबाएं' : 'Tap & Speak';
      if (stateLabel) stateLabel.textContent = isHi ? '🎙️ सुनने के लिए तैयार (हिंदी / English)' : '🎙️ Ready to listen (Hindi & English)';
      if (promptQuote) promptQuote.textContent = isHi ? '“आप हिंदी या अंग्रेज़ी में आसानी से बोल सकते हैं”' : '“You can speak naturally in Hindi or English”';
      if (activeTray) activeTray.classList.add('hidden');
      if (speakingTray) speakingTray.classList.add('hidden');
      if (micRing) micRing.style.display = 'none';
      micBtn.setAttribute('aria-pressed', 'false');
      break;
  }
}

/**
 * Updates dynamic greeting based on time of day (Morning/Afternoon/Evening/Night).
 */
function updateGreeting(lang = getLang()) {
  const hour = new Date().getHours();
  const isHi = lang === 'hi';
  let greetingText = '';
  let subText = '';

  if (hour >= 5 && hour < 12) {
    greetingText = isHi ? 'शुभ प्रभात 👋' : 'Good Morning 👋';
  } else if (hour >= 12 && hour < 17) {
    greetingText = isHi ? 'शुभ दोपहर 👋' : 'Good Afternoon 👋';
  } else if (hour >= 17 && hour < 21) {
    greetingText = isHi ? 'शुभ संध्या 👋' : 'Good Evening 👋';
  } else {
    greetingText = isHi ? 'शुभ रात्रि 🌙' : 'Good Night 🌙';
  }

  subText = isHi ? 'आज मैं आपकी क्या सहायता करूँ?' : 'How can I help you today?';

  const titleEl = document.getElementById('hero-greeting-title');
  const subEl   = document.getElementById('hero-greeting-sub');
  if (titleEl) titleEl.textContent = greetingText;
  if (subEl)   subEl.textContent   = subText;
}

function wireInputArea() {
  const input    = document.getElementById('user-input');
  const sendBtn  = document.getElementById('send-btn');
  const heroMic  = document.getElementById('hero-mic-btn');
  const ttsBtn   = document.getElementById('tts-toggle');

  // Hero Mic Button Click
  heroMic?.addEventListener('click', () => {
    if (currentHeroState === 'speaking') {
      stopSpeaking();
      setHeroMicState('idle');
      return;
    }
    toggleRecording();
  });

  // Hero Active Tray Controls
  document.getElementById('hero-done-btn')?.addEventListener('click', () => {
    finishRecording();
  });

  document.getElementById('hero-cancel-btn')?.addEventListener('click', () => {
    cancelRecording();
    setHeroMicState('idle');
    const previewEl = document.getElementById('hero-transcript-text');
    if (previewEl) {
      previewEl.textContent = getLang() === 'hi' ? 'बोलें, आपकी आवाज़ यहाँ दिखेगी...' : 'Speak now, words will appear here...';
    }
    showToast(getLang() === 'hi' ? 'आवाज़ इनपुट रद्द किया' : 'Voice input cancelled', 'info', 1500);
  });

  // Hero Speaking Tray Control
  document.getElementById('hero-stop-speak-btn')?.addEventListener('click', () => {
    stopSpeaking();
    setHeroMicState('idle');
  });

  // Text send
  sendBtn?.addEventListener('click', handleSend);

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  input?.addEventListener('input', () => autoResizeTextarea(input));

  ttsBtn?.addEventListener('click', () => {
    const newVal = !Storage.getTtsEnabled();
    Storage.setTtsEnabled(newVal);
    updateTtsBtn();
    showToast(newVal ? (getLang() === 'hi' ? '🔊 बोलकर सुनाना: चालू' : '🔊 Read aloud: ON')
                     : (getLang() === 'hi' ? '🔇 बोलकर सुनाना: बंद' : '🔇 Read aloud: OFF'), 'info', 2000);
  });

  // Listen to TTS start and end events for Hero Mic state
  window.addEventListener('sini:tts-start', () => {
    setHeroMicState('speaking');
  });

  window.addEventListener('sini:tts-end', () => {
    if (currentHeroState === 'speaking') {
      setHeroMicState('idle');
    }
  });
}

function handleSend() {
  const input = document.getElementById('user-input');
  const text  = input?.value?.trim();
  if (!text) return;

  setHeroMicState('thinking');
  sendMessage(text).finally(() => {
    if (currentHeroState === 'thinking') {
      setHeroMicState('idle');
    }
  });

  if (input) {
    input.value = '';
    input.style.height = '';
  }
}

function handleVoiceInterim(interim) {
  const preview = document.getElementById('hero-transcript-text');
  if (preview && interim) {
    preview.textContent = interim;
  }
  const input = document.getElementById('user-input');
  if (input && interim) {
    input.value = interim;
    autoResizeTextarea(input);
  }
}

function handleVoiceResult(transcript) {
  const preview = document.getElementById('hero-transcript-text');
  if (preview) {
    preview.textContent = transcript;
  }

  const input = document.getElementById('user-input');
  if (input) {
    input.value = transcript;
    autoResizeTextarea(input);
  }

  // Submit voice message
  if (transcript) {
    setHeroMicState('thinking');
    setTimeout(() => {
      sendMessage(transcript).finally(() => {
        if (currentHeroState === 'thinking') {
          setHeroMicState('idle');
        }
      });
      if (input) input.value = '';
    }, 450);
  }
}

function handleRecordingStart() {
  setHeroMicState('listening');
  const previewEl = document.getElementById('hero-transcript-text');
  if (previewEl) {
    previewEl.textContent = getLang() === 'hi' ? 'बोलें, आपकी आवाज़ यहाँ दिखेगी...' : 'Speak now, words will appear here...';
  }
}

function handleRecordingEnd() {
  if (currentHeroState === 'listening') {
    setHeroMicState('idle');
  }
}

function updateTtsBtn() {
  const btn = document.getElementById('tts-toggle');
  if (!btn) return;
  const enabled = Storage.getTtsEnabled();
  btn.classList.toggle('active', enabled);
  btn.textContent = enabled ? '🔊' : '🔇';
  btn.setAttribute('aria-label', enabled ? 'Read aloud: ON' : 'Read aloud: OFF');
  btn.setAttribute('aria-pressed', String(enabled));
}

// ── Header & Language Switcher ────────────────────────────────────────────────

export function changeLanguage(nextLang) {
  Storage.setLanguage(nextLang);
  setLang(nextLang);
  applyTranslations();
  updateLangButton(nextLang);
  switchSttLanguage(nextLang);

  const msg = nextLang === 'hi'
    ? '🇮🇳 हिन्दी भाषा चुनी गई ✓ (Hindi Voice & Text Active)'
    : '🇬🇧 Switched to English ✓ (English Voice & Text Active)';
  showToast(msg, 'success', 2500);
  announce(nextLang === 'hi' ? 'भाषा हिंदी में बदली गई' : 'Language changed to English');
}

function wireHeader() {
  // Dual Segmented Language buttons (Top Header)
  document.getElementById('lang-btn-hi')?.addEventListener('click', () => changeLanguage('hi'));
  document.getElementById('lang-btn-en')?.addEventListener('click', () => changeLanguage('en'));

  // Persistent Bottom Language Bar Pills
  document.getElementById('bottom-lang-hi')?.addEventListener('click', () => changeLanguage('hi'));
  document.getElementById('bottom-lang-en')?.addEventListener('click', () => changeLanguage('en'));

  // Compat toggle pill
  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    changeLanguage(getLang() === 'en' ? 'hi' : 'en');
  });

  // Listen for auto-detected language change from voice or text
  window.addEventListener('sini:lang-change', (e) => {
    const lang = e.detail?.lang;
    if (lang) {
      updateLangButton(lang);
    }
  });

  updateLangButton(getLang());
  updateGreeting(getLang());

  // Settings button
  document.getElementById('settings-btn')?.addEventListener('click', openSettingsModal);

  // Clear chat button
  document.getElementById('clear-chat-btn')?.addEventListener('click', () => {
    const confirmMsg = getLang() === 'hi' ? 'क्या आप सारी चैट साफ़ करना चाहते हैं?' : 'Clear all chat history?';
    if (confirm(confirmMsg)) {
      clearChat();
    }
  });
}

function updateLangButton(lang) {
  const isHi = lang === 'hi';

  // Top Header buttons
  const btnHi = document.getElementById('lang-btn-hi');
  const btnEn = document.getElementById('lang-btn-en');
  if (btnHi && btnEn) {
    btnHi.classList.toggle('active', isHi);
    btnHi.setAttribute('aria-pressed', String(isHi));
    btnEn.classList.toggle('active', !isHi);
    btnEn.setAttribute('aria-pressed', String(!isHi));
  }

  // Bottom Persistent Bar pills
  const bottomHi = document.getElementById('bottom-lang-hi');
  const bottomEn = document.getElementById('bottom-lang-en');
  if (bottomHi && bottomEn) {
    bottomHi.classList.toggle('active', isHi);
    bottomHi.setAttribute('aria-pressed', String(isHi));
    bottomEn.classList.toggle('active', !isHi);
    bottomEn.setAttribute('aria-pressed', String(!isHi));
  }

  // Update greeting and hero prompt in new language
  updateGreeting(lang);
  setHeroMicState(currentHeroState);
}

// ── Settings Modal ────────────────────────────────────────────────────────────

let settingsCleanup = [];

function openSettingsModal() {
  const overlay = document.getElementById('settings-overlay');
  if (!overlay) return;

  // Pre-fill current values
  const keyInput = document.getElementById('settings-api-key');
  if (keyInput) keyInput.value = Storage.getApiKey();

  const contact = Storage.getTrustedContact();
  const nameInput  = document.getElementById('settings-contact-name');
  const phoneInput = document.getElementById('settings-contact-phone');
  if (nameInput)  nameInput.value  = contact.name  ?? '';
  if (phoneInput) phoneInput.value = contact.phone ?? '';

  const ttsToggle      = document.getElementById('settings-tts-toggle');
  const contrastToggle = document.getElementById('settings-contrast-toggle');
  if (ttsToggle)      ttsToggle.checked     = Storage.getTtsEnabled();
  if (contrastToggle) contrastToggle.checked = Storage.getHighContrast();

  updateActiveFontBtn(Storage.getFontSize());
  updateActiveSpeedBtn(Storage.getSpeechRate());

  overlay.classList.remove('hidden');

  const releaseTrap = trapFocus(overlay.querySelector('.modal'));
  const releaseEsc  = onEscapeClose(overlay, closeSettingsModal);
  settingsCleanup   = [releaseTrap, releaseEsc];
}

function closeSettingsModal() {
  document.getElementById('settings-overlay')?.classList.add('hidden');
  settingsCleanup.forEach(fn => fn?.());
  settingsCleanup = [];
  document.getElementById('settings-btn')?.focus();
}

function updateActiveSpeedBtn(currentRate) {
  const rate = Number(currentRate) || 0.88;
  const speeds = [
    { id: 'speed-slow',   val: 0.75 },
    { id: 'speed-normal', val: 0.88 },
    { id: 'speed-fast',   val: 1.1  },
  ];

  speeds.forEach(s => {
    const el = document.getElementById(s.id);
    if (el) {
      const isClosest = Math.abs(rate - s.val) < 0.08;
      el.classList.toggle('active', isClosest);
      el.setAttribute('aria-pressed', String(isClosest));
    }
  });
}

function wireSettingsModal() {
  document.getElementById('settings-close-btn')?.addEventListener('click', closeSettingsModal);

  document.getElementById('settings-save-btn')?.addEventListener('click', () => {
    // API key
    const keyInput = document.getElementById('settings-api-key');
    const apiKey   = keyInput?.value?.trim() ?? '';
    if (apiKey && !isValidApiKey(apiKey)) {
      showToast(t('setup.invalid'), 'warning');
      keyInput?.focus();
      return;
    }
    Storage.setApiKey(apiKey);
    if (apiKey) {
      Storage.setCompletedSetup(true);
    }

    // Trusted contact
    const name  = document.getElementById('settings-contact-name')?.value?.trim() ?? '';
    const phone = document.getElementById('settings-contact-phone')?.value?.trim() ?? '';
    Storage.setTrustedContact({ name, phone });

    // TTS toggle
    const ttsEnabled = document.getElementById('settings-tts-toggle')?.checked ?? true;
    Storage.setTtsEnabled(ttsEnabled);
    updateTtsBtn();

    // High contrast
    const hc = document.getElementById('settings-contrast-toggle')?.checked ?? false;
    Storage.setHighContrast(hc);
    if (hc) {
      document.documentElement.setAttribute('data-contrast', 'high');
    } else {
      document.documentElement.removeAttribute('data-contrast');
    }

    closeSettingsModal();
    showToast(t('settings.saved'), 'success');
    announce(t('settings.saved'));
  });

  // Font size buttons
  ['normal', 'large', 'xl'].forEach(size => {
    document.getElementById(`font-${size}`)?.addEventListener('click', () => {
      Storage.setFontSize(size);
      applyFontSize(size);
      updateActiveFontBtn(size);
    });
  });

  // Speech speed buttons
  [
    { id: 'speed-slow',   val: 0.75 },
    { id: 'speed-normal', val: 0.88 },
    { id: 'speed-fast',   val: 1.1  },
  ].forEach(({ id, val }) => {
    document.getElementById(id)?.addEventListener('click', () => {
      Storage.setSpeechRate(val);
      updateActiveSpeedBtn(val);
      const testMsg = getLang() === 'hi' ? 'नमस्ते जी, आवाज़ की गति सहेजी गई।' : 'Hello, voice speed updated.';
      showToast(testMsg, 'info', 1800);
      speak(testMsg, { force: true, rate: val });
    });
  });

  // Show/hide API key
  document.getElementById('toggle-key-visibility')?.addEventListener('click', () => {
    const keyInput = document.getElementById('settings-api-key');
    if (!keyInput) return;
    keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    const btn = document.getElementById('toggle-key-visibility');
    if (btn) btn.textContent = keyInput.type === 'password' ? '👁️' : '🙈';
  });
}

function applyFontSize(size) {
  const validSizes = { normal: 'normal', large: 'large', xl: 'xl' };
  const s = validSizes[size] ?? 'normal';
  document.documentElement.setAttribute('data-font-size', s);
}

function updateActiveFontBtn(size) {
  ['normal', 'large', 'xl'].forEach(s => {
    document.getElementById(`font-${s}`)?.classList.toggle('active', s === size);
  });
}

// ── Setup Modal (First login only) ────────────────────────────────────────────

let setupCleanup = [];

function openSetupModal() {
  const overlay = document.getElementById('setup-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');

  const releaseTrap = trapFocus(overlay.querySelector('.modal'));
  const releaseEsc  = onEscapeClose(overlay, () => {
    Storage.setCompletedSetup(true);
    closeSetupModal();
  });
  setupCleanup = [releaseTrap, releaseEsc];
}

function closeSetupModal() {
  document.getElementById('setup-overlay')?.classList.add('hidden');
  setupCleanup.forEach(fn => fn?.());
  setupCleanup = [];
}

function wireSetupModal() {
  // Close button
  document.getElementById('setup-close-btn')?.addEventListener('click', () => {
    Storage.setCompletedSetup(true);
    closeSetupModal();
  });

  // Start with API key
  document.getElementById('setup-start-btn')?.addEventListener('click', () => {
    const keyInput = document.getElementById('setup-api-key');
    const apiKey   = keyInput?.value?.trim() ?? '';

    if (!apiKey || !isValidApiKey(apiKey)) {
      showToast(t('setup.invalid'), 'warning');
      keyInput?.focus();
      return;
    }

    Storage.setApiKey(apiKey);
    Storage.setCompletedSetup(true);
    closeSetupModal();

    const welcomeMsg = getLang() === 'hi'
      ? '🎉 SINIcare में आपका स्वागत है! मैं SINI हूँ, आपकी सहायता के लिए तैयार।'
      : '🎉 Welcome to SINIcare! I\'m SINI, and I\'m ready to help you.';
    showToast(welcomeMsg, 'success', 5000);
    announce('Setup complete. SINIcare is ready.');

    sendInitialGreeting();
  });

  // Try Demo Mode (adds key later, never asks again on reload)
  document.getElementById('setup-demo-btn')?.addEventListener('click', () => {
    Storage.setCompletedSetup(true);
    localStorage.setItem('sinicare_demo_mode', 'true');
    closeSetupModal();

    const demoMsg = getLang() === 'hi'
      ? '✨ SINIcare में आपका स्वागत है! आप बोलकर या लिखकर सहायता ले सकते हैं।'
      : '✨ Welcome to SINIcare! You can type or speak what you need help with.';
    showToast(demoMsg, 'info', 4000);

    sendInitialGreeting();
  });

  // Show/hide key
  document.getElementById('setup-toggle-key')?.addEventListener('click', () => {
    const keyInput = document.getElementById('setup-api-key');
    if (!keyInput) return;
    keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    const btn = document.getElementById('setup-toggle-key');
    if (btn) btn.textContent = keyInput.type === 'password' ? '👁️' : '🙈';
  });
}

function sendInitialGreeting() {
  setTimeout(() => {
    import('./chat.js').then(({ injectSiniMessage }) => {
      injectSiniMessage(
        getLang() === 'hi'
          ? 'नमस्ते जी! 🙏 मैं SINI हूँ — आपका अपना डिजिटल साथी।\n\nआप मुझसे हिंदी या अंग्रेज़ी में बोलकर या लिखकर कुछ भी पूछ सकते हैं — जैसे कोई SMS जाँचना हो, बिल भरना हो, या फॉर्म समझना हो। बताइए, आज मैं आपकी क्या मदद करूँ? 😊'
          : 'Hello! 🙏 I\'m SINI — your patient digital companion.\n\nYou can speak or type in Hindi or English anytime! Whether checking a suspicious message, understanding a document, or setting reminders — I\'m here to help you every step of the way. 😊',
        true
      );
    });
  }, 400);
}
