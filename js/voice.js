/**
 * SINIcare — voice.js
 *
 * Core Hindi & English Voice Assistance:
 *  - High-accuracy Speech-to-Text (STT) for natural conversational Hindi & English
 *  - Natural Text-to-Speech (TTS) with native Hindi voice selection (hi-IN)
 *  - Automatic script detection (speaks Hindi in native Hindi voice even in mixed mode)
 *  - Adjustable speaking rate tailored for senior comprehension
 *  - Senior-friendly, reassuring error handling with visual & spoken guidance
 */

'use strict';

import { t, getLang } from './i18n.js';
import { announce } from './a11y.js';
import { getTtsEnabled, getSpeechRate } from './storage.js';

/**
 * Dispatches a toast notification without creating a circular dependency.
 */
function dispatchToast(message, type = 'warning') {
  window.dispatchEvent(new CustomEvent('sini:toast', { detail: { message, type } }));
}

// ── Feature detection ────────────────────────────────────────────────────────

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const synth = typeof window !== 'undefined' ? (window.speechSynthesis || null) : null;

export const sttSupported = Boolean(SpeechRecognition);
export const ttsSupported = Boolean(synth);

// ── State ─────────────────────────────────────────────────────────────────────

let recognition    = null;
let isRecording    = false;
let onResultCb     = null;   // callback(finalTranscript: string)
let onInterimCb    = null;   // callback(interimTranscript: string)
let onStartCb      = null;
let onEndCb        = null;

/**
 * Checks if a string contains Hindi (Devanagari) characters.
 * @param {string} text
 * @returns {boolean}
 */
export function isHindiText(text) {
  return /[\u0900-\u097F]/.test(text || '');
}

// ── Speech-to-Text (STT) ─────────────────────────────────────────────────────

/**
 * Initializes STT recognition instance.
 * @param {{ onResult: Function, onStart: Function, onEnd: Function, onInterim?: Function }} callbacks
 */
export function initStt({ onResult, onStart, onEnd, onInterim } = {}) {
  if (!sttSupported) return;

  onResultCb  = onResult;
  onInterimCb = onInterim;
  onStartCb   = onStart;
  onEndCb     = onEnd;

  recognition = new SpeechRecognition();
  recognition.continuous      = false;
  recognition.interimResults  = true;
  recognition.maxAlternatives = 1;
  // Automatically configure speech recognition for Hindi or Indian English
  recognition.lang            = getLang() === 'hi' ? 'hi-IN' : 'en-IN';

  recognition.onstart = () => {
    isRecording = true;
    onStartCb?.();
    const listeningMsg = getLang() === 'hi' ? t('voice.listening.hi') : t('voice.listening');
    announce(listeningMsg, 'assertive');
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const trans = event.results[i][0]?.transcript || '';
      if (event.results[i].isFinal) {
        final += trans;
      } else {
        interim += trans;
      }
    }

    if (interim && onInterimCb) {
      onInterimCb(interim.trim());
    }

    if (final.trim()) {
      onResultCb?.(final.trim());
    }
  };

  recognition.onerror = (event) => {
    console.warn('[SINIcare Voice] STT error:', event.error);
    isRecording = false;
    onEndCb?.();

    if (event.error === 'not-allowed') {
      const msg = t('error.voice.permission');
      dispatchToast(msg, 'warning');
      announce(msg, 'assertive');
    } else if (event.error === 'no-speech') {
      const msg = t('error.voice.no_speech');
      dispatchToast(msg, 'info');
      announce(msg, 'polite');
    } else if (event.error === 'network') {
      const msg = t('error.voice.network');
      dispatchToast(msg, 'warning');
      announce(msg, 'assertive');
    }
  };

  recognition.onend = () => {
    isRecording = false;
    onEndCb?.();
  };
}

/**
 * Starts or stops voice recording.
 */
export function toggleRecording() {
  if (!sttSupported || !recognition) {
    dispatchToast(t('error.voice'), 'warning');
    return;
  }

  if (isRecording) {
    try {
      recognition.stop();
    } catch { /* ignore */ }
  } else {
    // Dynamically update speech recognition language before recording
    recognition.lang = getLang() === 'hi' ? 'hi-IN' : 'en-IN';
    try {
      recognition.start();
    } catch (err) {
      console.warn('[SINIcare Voice] Error starting STT:', err);
      try {
        recognition.stop();
        setTimeout(() => recognition.start(), 200);
      } catch { /* ignore */ }
    }
  }
}

/**
 * Explicitly cancels an ongoing recording.
 */
export function cancelRecording() {
  if (recognition && isRecording) {
    try {
      recognition.abort();
    } catch { /* ignore */ }
    isRecording = false;
    onEndCb?.();
  }
}

/** @returns {boolean} */
export function getIsRecording() { return isRecording; }

// ── Text-to-Speech (TTS) ──────────────────────────────────────────────────────

let currentUtterance = null;

/**
 * Finds the best voice for the target language (especially native Hindi).
 * Supports Chrome, Android, Windows, Mac, and iOS system voices.
 *
 * @param {'hi'|'en'} langCode
 * @returns {SpeechSynthesisVoice|null}
 */
export function getBestVoice(langCode = 'en') {
  if (!synth) return null;
  const voices = synth.getVoices();
  if (!voices || voices.length === 0) return null;

  if (langCode === 'hi') {
    // 1. Check for native Hindi voices (e.g. Google हिन्दी, Microsoft Hemant/Kalpana, Lekha, hi-IN)
    const hiVoice = voices.find(v => {
      const name = (v.name || '').toLowerCase();
      const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
      return lang.startsWith('hi') || name.includes('hindi') || name.includes('हिन्दी') || name.includes('hemant') || name.includes('kalpana') || name.includes('lekha');
    });
    if (hiVoice) return hiVoice;

    // Fallback: any Indian regional voice
    const inVoice = voices.find(v => (v.lang || '').toLowerCase().includes('-in'));
    if (inVoice) return inVoice;
  }

  // English: prefer Indian English voice (en-IN), fallback to any English
  const enInVoice = voices.find(v => (v.lang || '').toLowerCase().replace(/_/g, '-').startsWith('en-in'));
  if (enInVoice) return enInVoice;

  return voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || voices[0] || null;
}

/**
 * Speaks a text string aloud.
 * Respects user's TTS preference, auto-detects Hindi script, and uses user's chosen speech speed.
 *
 * @param {string} text - Text to speak
 * @param {{ force?: boolean, rate?: number }} [opts]
 */
export function speak(text, { force = false, rate } = {}) {
  if (!ttsSupported) return;
  if (!force && !getTtsEnabled()) return;

  // Cancel any ongoing speech
  stopSpeaking();

  // Clean text for speech (remove markdown symbols, URLs, asterisks)
  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/#+\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[•\-_*~`>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) return;

  // Detect whether text is Hindi (Devanagari) or English
  const containsDevanagari = isHindiText(cleanText);
  const targetLang = containsDevanagari || getLang() === 'hi' ? 'hi' : 'en';

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang  = targetLang === 'hi' ? 'hi-IN' : 'en-IN';

  // Senior-friendly speech rate (defaults to 0.88x for slow, gentle, clear delivery)
  utterance.rate  = typeof rate === 'number' ? rate : (getSpeechRate() || 0.88);
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Pick optimal native voice
  const bestVoice = getBestVoice(targetLang);
  if (bestVoice) {
    utterance.voice = bestVoice;
  }

  utterance.onerror = (err) => {
    console.warn('[SINIcare TTS] Error:', err.error);
  };

  currentUtterance = utterance;
  synth.speak(utterance);
}

/**
 * Stops any currently active speech synthesis.
 */
export function stopSpeaking() {
  if (!ttsSupported) return;
  synth?.cancel();
  currentUtterance = null;
}

/**
 * @returns {boolean} Whether TTS is currently speaking
 */
export function isSpeaking() {
  return synth?.speaking ?? false;
}

/**
 * Loads available TTS voices.
 * Voices may load asynchronously in some browsers.
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export function waitForVoices() {
  return new Promise(resolve => {
    if (!ttsSupported) { resolve([]); return; }
    const voices = synth.getVoices();
    if (voices && voices.length > 0) { resolve(voices); return; }
    synth.onvoiceschanged = () => resolve(synth.getVoices());
    // Timeout fallback
    setTimeout(() => resolve(synth.getVoices() || []), 2000);
  });
}
