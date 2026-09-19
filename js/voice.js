/**
 * SINIcare — voice.js
 *
 * Core Hindi & English Voice Assistance:
 *  - High-accuracy Speech-to-Text (STT) for natural conversational Hindi (hi-IN) & English (en-IN)
 *  - Senior-friendly continuous speech recognition with generous pause tolerance
 *  - Natural Text-to-Speech (TTS) strictly using native Hindi voices (Google हिन्दी, Microsoft Hemant/Kalpana/Swara)
 *  - Automatic script detection ensuring Devanagari is always spoken in native Hindi
 *  - Real-time speech rate adjustments (0.75x slow, 0.88x gentle, 1.1x normal)
 *  - Senior-friendly, encouraging error feedback in Hindi and English
 *  - Dynamic language switching without restarting the app
 */

'use strict';

import { t, getLang } from './i18n.js';
import { announce } from './a11y.js';
import { getTtsEnabled, getSpeechRate } from './storage.js';

// ── Toast bridge (no circular dependency) ─────────────────────────────────────

function dispatchToast(message, type = 'warning') {
  window.dispatchEvent(new CustomEvent('sini:toast', { detail: { message, type } }));
}

// ── Feature detection ─────────────────────────────────────────────────────────

const SpeechRecognitionAPI =
  (typeof window !== 'undefined') &&
  (window.SpeechRecognition || window.webkitSpeechRecognition || null);

const synth = (typeof window !== 'undefined') ? (window.speechSynthesis || null) : null;

export const sttSupported = Boolean(SpeechRecognitionAPI);
export const ttsSupported = Boolean(synth);

// ── State ─────────────────────────────────────────────────────────────────────

let recognition       = null;
let isRecording       = false;
let accumulatedFinal  = '';
let silenceTimer      = null;

let _onResult         = null;   // callback(finalTranscript: string)
let _onInterim        = null;   // callback(interimTranscript: string)
let _onStart          = null;
let _onEnd            = null;

const SILENCE_TIMEOUT_MS = 2800; // 2.8s of silence after speaking auto-finalizes

/**
 * Returns true if text contains Devanagari (Hindi) characters.
 * @param {string} text
 * @returns {boolean}
 */
export function isHindiText(text) {
  return /[\u0900-\u097F]/.test(text || '');
}

// ── STT initialization ────────────────────────────────────────────────────────

/**
 * Stores callbacks for speech recognition.
 * @param {{ onResult: Function, onStart: Function, onEnd: Function, onInterim?: Function }} cbs
 */
export function initStt({ onResult, onStart, onEnd, onInterim } = {}) {
  _onResult  = onResult  || null;
  _onInterim = onInterim || null;
  _onStart   = onStart   || null;
  _onEnd     = onEnd     || null;
}

/**
 * Resets silence timer.
 */
function resetSilenceTimer() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => {
    if (isRecording && accumulatedFinal.trim()) {
      finishRecording();
    }
  }, SILENCE_TIMEOUT_MS);
}

/**
 * Creates a fresh SpeechRecognition instance for the given language.
 * @param {'hi'|'en'} [langCode]
 * @returns {SpeechRecognition|null}
 */
function createRecognition(langCode = getLang()) {
  if (!SpeechRecognitionAPI) return null;

  const r = new SpeechRecognitionAPI();
  // Use continuous = true so seniors can speak naturally with short pauses
  r.continuous      = true;
  r.interimResults  = true;
  r.maxAlternatives = 1;
  r.lang            = langCode === 'hi' ? 'hi-IN' : 'en-IN';

  r.onstart = () => {
    isRecording = true;
    accumulatedFinal = '';
    _onStart?.();

    const msg = langCode === 'hi'
      ? '🎙️ हिंदी में सुन रहा हूँ... बोलिए'
      : '🎙️ Listening... Speak now';
    announce(msg, 'assertive');
  };

  r.onresult = (event) => {
    let interim = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const item = event.results[i];
      const text = item[0]?.transcript || '';
      if (item.isFinal) {
        accumulatedFinal += (accumulatedFinal ? ' ' : '') + text.trim();
      } else {
        interim += text;
      }
    }

    const currentCombined = (accumulatedFinal + (interim ? ' ' + interim : '')).trim();

    if (_onInterim && currentCombined) {
      _onInterim(currentCombined);
    }

    // Reset silence timer on receiving speech
    resetSilenceTimer();
  };

  r.onerror = (event) => {
    clearTimeout(silenceTimer);
    console.warn('[SINIcare Voice] STT error:', event.error, '| lang:', r.lang);

    // Don't treat user abort or routine no-speech as catastrophic
    if (event.error === 'aborted') return;

    switch (event.error) {
      case 'not-allowed':
      case 'permission-denied': {
        const msg = getLang() === 'hi'
          ? 'माइक्रोफ़ोन की अनुमति नहीं है। कृपया ब्राउज़र में माइक चालू करें।'
          : t('error.voice.permission');
        dispatchToast(msg, 'warning', 4000);
        announce(msg, 'assertive');
        break;
      }
      case 'no-speech': {
        // If we already accumulated text, don't show error
        if (!accumulatedFinal.trim()) {
          const msg = getLang() === 'hi'
            ? 'कुछ सुनाई नहीं दिया। माइक दबाकर दोबारा आराम से बोलें।'
            : t('error.voice.no_speech');
          dispatchToast(msg, 'info', 3000);
          announce(msg, 'polite');
        }
        break;
      }
      case 'network': {
        const msg = getLang() === 'hi'
          ? 'इंटरनेट धीमा है या संपर्क टूट गया है। दोबारा प्रयास करें।'
          : t('error.voice.network');
        dispatchToast(msg, 'warning', 3500);
        announce(msg, 'assertive');
        break;
      }
      case 'audio-capture': {
        const msg = getLang() === 'hi'
          ? 'माइक्रोफ़ोन नहीं मिला। कृपया अपना माइक जांचें।'
          : 'Microphone not found. Please check your device.';
        dispatchToast(msg, 'warning', 3500);
        announce(msg, 'assertive');
        break;
      }
      case 'language-not-supported': {
        console.warn('[SINIcare Voice] Language not supported on this browser:', r.lang);
        const msg = getLang() === 'hi'
          ? 'इस ब्राउज़र में हिंदी आवाज़ समर्थित नहीं है। अंग्रेज़ी पर स्विच किया जा रहा है।'
          : 'Selected language not supported by browser speech engine.';
        dispatchToast(msg, 'warning', 4000);
        break;
      }
      default:
        break;
    }

    isRecording = false;
    _onEnd?.();
  };

  r.onend = () => {
    clearTimeout(silenceTimer);
    const wasRecording = isRecording;
    isRecording = false;
    _onEnd?.();

    // If session ended naturally with accumulated text, deliver it
    if (wasRecording && accumulatedFinal.trim()) {
      const delivered = accumulatedFinal.trim();
      accumulatedFinal = '';
      _onResult?.(delivered);
    }
  };

  return r;
}

// ── Recording controls ────────────────────────────────────────────────────────

/**
 * Starts or stops recording.
 */
export function toggleRecording() {
  if (!sttSupported) {
    const msg = getLang() === 'hi'
      ? 'यह ब्राउज़र आवाज़ इनपुट का समर्थन नहीं करता। कृपया टाइप करें।'
      : t('error.voice');
    dispatchToast(msg, 'warning');
    return;
  }

  // Stop any active TTS so SINI doesn't speak over the user
  stopSpeaking();

  if (isRecording) {
    finishRecording();
  } else {
    startRecording();
  }
}

/**
 * Starts speech recognition session.
 * @param {'hi'|'en'} [langOverride]
 */
export function startRecording(langOverride) {
  if (!sttSupported) return;

  stopSpeaking();
  clearTimeout(silenceTimer);
  accumulatedFinal = '';

  try {
    if (recognition) {
      recognition.abort();
    }
  } catch { /* ignore */ }

  const lang = langOverride || getLang();
  recognition = createRecognition(lang);
  if (!recognition) return;

  try {
    recognition.start();
  } catch (err) {
    console.warn('[SINIcare Voice] start() failed, retrying once:', err);
    setTimeout(() => {
      try {
        recognition = createRecognition(lang);
        recognition?.start();
      } catch (e) {
        console.error('[SINIcare Voice] Recognition restart failed:', e);
      }
    }, 150);
  }
}

/**
 * Finishes speech recognition and delivers final result.
 */
export function finishRecording() {
  clearTimeout(silenceTimer);
  if (recognition && isRecording) {
    try {
      recognition.stop();
    } catch { /* ignore */ }
  }
}

/**
 * Cancels recording immediately without sending.
 */
export function cancelRecording() {
  clearTimeout(silenceTimer);
  accumulatedFinal = '';
  if (recognition && isRecording) {
    try {
      recognition.abort();
    } catch { /* ignore */ }
    isRecording = false;
    _onEnd?.();
  }
}

/**
 * Seamlessly switches speech recognition language while in use or ready.
 * @param {'hi'|'en'} newLang
 */
export function switchSttLanguage(newLang) {
  if (isRecording) {
    const currentText = accumulatedFinal;
    cancelRecording();
    setTimeout(() => {
      startRecording(newLang);
      if (currentText && _onInterim) {
        _onInterim(currentText);
      }
    }, 200);
  }
}

/** @returns {boolean} */
export function getIsRecording() { return isRecording; }

// ── TTS – Voice selection ─────────────────────────────────────────────────────

let _voicesLoaded   = false;
let _voiceLoadTimer = null;

/**
 * Waits for the browser's voice list to load (Chrome/Edge load async).
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export function waitForVoices() {
  return new Promise(resolve => {
    if (!ttsSupported) { resolve([]); return; }

    const voices = synth.getVoices();
    if (voices && voices.length > 0) {
      _voicesLoaded = true;
      resolve(voices);
      return;
    }

    const onChanged = () => {
      clearTimeout(_voiceLoadTimer);
      _voicesLoaded = true;
      resolve(synth.getVoices());
    };

    synth.onvoiceschanged = onChanged;
    _voiceLoadTimer = setTimeout(() => {
      _voicesLoaded = true;
      resolve(synth.getVoices() || []);
    }, 2500);
  });
}

/**
 * Selects the highest-quality native voice for target language.
 *
 * CRITICAL RULE:
 * For Hindi ('hi'), ONLY voices with language 'hi', 'hi-IN', 'hi_IN' are returned!
 * We NEVER return an English voice (like Microsoft Ravi / en-IN) for Hindi text,
 * because English synthesizers cannot pronounce Devanagari phonemes and fail silently.
 *
 * @param {'hi'|'en'} langCode
 * @returns {SpeechSynthesisVoice|null}
 */
export function getBestVoice(langCode = 'en') {
  if (!synth) return null;
  const voices = synth.getVoices();
  if (!voices || voices.length === 0) return null;

  if (langCode === 'hi') {
    // Filter strictly to Hindi-capable voices
    const hiVoices = voices.filter(v => {
      const l = (v.lang || '').toLowerCase().replace(/_/g, '-');
      return l === 'hi' || l.startsWith('hi-');
    });

    if (hiVoices.length > 0) {
      // Preferred Hindi voices in order of quality & naturalness
      const preferredHi = [
        'google हिन्दी',
        'google hindi',
        'swara online',
        'madhur online',
        'hemant',
        'kalpana',
        'swara',
        'lekha'
      ];

      for (const pref of preferredHi) {
        const match = hiVoices.find(v => (v.name || '').toLowerCase().includes(pref));
        if (match) return match;
      }
      return hiVoices[0];
    }

    // If no voice explicitly matches hi-IN, return null so browser's native engine
    // handles hi-IN directly rather than giving Devanagari to an English voice!
    return null;
  }

  // English: prefer Indian English (en-IN)
  const enInVoices = voices.filter(v => {
    const l = (v.lang || '').toLowerCase().replace(/_/g, '-');
    return l === 'en-in';
  });

  if (enInVoices.length > 0) {
    const preferredEn = ['google', 'heera', 'ravi', 'neerja', 'prabhat'];
    for (const pref of preferredEn) {
      const match = enInVoices.find(v => (v.name || '').toLowerCase().includes(pref));
      if (match) return match;
    }
    return enInVoices[0];
  }

  // Any English voice
  const anyEn = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
  return anyEn || voices[0] || null;
}

// ── TTS – Speaking ────────────────────────────────────────────────────────────

let _currentUtterance = null;
let _chromePingTimer  = null;

/**
 * Speaks text aloud using clear, senior-friendly speech synthesis.
 *
 * @param {string} text
 * @param {{ force?: boolean, rate?: number, lang?: 'hi'|'en' }} [opts]
 */
export function speak(text, { force = false, rate, lang } = {}) {
  if (!ttsSupported) return;
  if (!force && !getTtsEnabled()) return;

  stopSpeaking();

  // Clean markdown, links, hashtags, bullet characters
  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g,     '$1')
    .replace(/__(.*?)__/g,     '$1')
    .replace(/#{1,6}\s/g,      '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[•\-_*~`>|]/g,   ' ')
    .replace(/\s+/g,            ' ')
    .trim();

  if (!cleanText) return;

  // Determine target language:
  // If Devanagari script is present -> ALWAYS 'hi'
  // Else if explicit lang override given -> use it
  // Else use current UI lang
  const targetLang = (isHindiText(cleanText) ? 'hi' : null)
    || lang
    || getLang()
    || 'en';

  const utterance   = new SpeechSynthesisUtterance(cleanText);
  utterance.lang    = targetLang === 'hi' ? 'hi-IN' : 'en-IN';

  // Senior-friendly speech rate (defaults to 0.88x for slow, clear, gentle delivery)
  utterance.rate    = typeof rate === 'number' ? rate : (getSpeechRate() || 0.88);
  utterance.pitch   = 1.0;
  utterance.volume  = 1.0;

  // Assign optimal native voice
  const bestVoice = getBestVoice(targetLang);
  if (bestVoice) {
    utterance.voice = bestVoice;
  }

  utterance.onstart = () => {
    window.dispatchEvent(new CustomEvent('sini:tts-start', { detail: { lang: targetLang } }));
  };

  utterance.onend = () => {
    clearInterval(_chromePingTimer);
    _currentUtterance = null;
    window.dispatchEvent(new CustomEvent('sini:tts-end'));
  };

  utterance.onerror = (e) => {
    clearInterval(_chromePingTimer);
    _currentUtterance = null;
    window.dispatchEvent(new CustomEvent('sini:tts-end'));
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
      console.warn('[SINIcare TTS] Error:', e.error, '| lang:', utterance.lang);
    }
  };

  // Resume synth in case Chrome paused it
  if (synth.paused) {
    synth.resume();
  }

  _currentUtterance = utterance;
  synth.speak(utterance);

  // Chrome bug workaround: speechSynthesis pauses after ~15s without activity
  _chromePingTimer = setInterval(() => {
    if (synth.speaking) {
      synth.pause();
      synth.resume();
    } else {
      clearInterval(_chromePingTimer);
    }
  }, 14000);
}

/**
 * Stops all speech output immediately.
 */
export function stopSpeaking() {
  if (!ttsSupported) return;
  clearInterval(_chromePingTimer);
  try {
    synth.cancel();
  } catch { /* ignore */ }
  _currentUtterance = null;
  window.dispatchEvent(new CustomEvent('sini:tts-end'));
}

/** @returns {boolean} */
export function isSpeaking() {
  return synth?.speaking ?? false;
}
