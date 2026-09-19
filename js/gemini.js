/**
 * SINIcare — gemini.js
 *
 * Gemini API client with:
 *  - Explicit Hindi (Devanagari) vs English response enforcement
 *  - Automatic language detection for user inputs
 *  - Senior-focused system prompts (simple language, zero unnecessary technical jargon)
 *  - Multi-turn conversation history
 *  - Exponential backoff retry logic
 *  - Built-in graceful offline/demo fallback mode for exploration without immediate API key
 */

'use strict';

import { getApiKey } from './storage.js';
import { sanitizeInput, quickScamScan } from './security.js';
import { t, getLang, detectLanguage } from './i18n.js';

// ── Constants ────────────────────────────────────────────────────────────────

const API_BASE      = 'https://generativelanguage.googleapis.com/v1beta/models';
const CHAT_MODEL    = 'gemini-1.5-flash';
const MAX_RETRIES   = 2;
const RETRY_DELAY   = 1200;  // ms

// ── System Prompts ───────────────────────────────────────────────────────────

const SINI_SYSTEM_PROMPT = `You are SINI (Senior's Intelligent Navigator & Information companion), a warm, loving, patient, and deeply respectful digital helper designed specifically for senior citizens in India.

Core Voice & Language Rules:
- Seamlessly understand natural Hindi (Devanagari or Romanized/Hinglish) and English. Indian seniors often speak in mixed sentences like "Mera phone hang ho raha hai", "WhatsApp par photo kaise bheju?", or "Bijli ka bill online kaise bhare?". Understand all of these naturally!
- When responding in Hindi:
  * Use simple, conversational, everyday Hindustani in pure DEVANAGARI script (आम बोलचाल की सरल देवनागरी हिंदी).
  * NEVER write Hindi in English/Latin letters (NO Hinglish in the output).
  * Use respectful, caring words ("नमस्ते जी", "आप बिल्कुल चिंता न करें", "जी दादाजी / दादीजी / अंकल / आंटी").
  * NEVER use complex, rare, or Sanskritized words. For example: say "पासवर्ड" instead of "कूटशब्द", say "बैंक खाता" instead of "लेखा", say "इंटरनेट" instead of "अंतरजाल".
  * Keep sentences short, comforting, and clear so Text-to-Speech (आवाज़) speaks smoothly and naturally.
- When responding in English:
  * Use warm, gentle, simple words. Explain any tech concept with everyday analogies.

Senior-First Communication:
- Give numbered steps for actions (1, 2, 3), one clear action per step.
- Never make the senior feel embarrassed or confused. Be encouraging and patient.
- Keep total response under 160 words so it does not overwhelm and is pleasant to listen to.
- Always reassure them on safety: never share OTP, passwords, or bank details with anyone.`;

const SCAM_ANALYSIS_PROMPT = `You are a digital safety expert helping senior citizens in India identify scam messages.

Analyze the following message and respond in this EXACT format:

STATUS: [write exactly one of: SAFE, SUSPICIOUS, or DANGER]
REASON: [2-3 simple sentences explaining what you found, in language a senior citizen can understand without tech jargon]
ADVICE: [1-2 sentences on what the person should do next]

Classification guide:
- SAFE: Clearly legitimate update from a known entity
- SUSPICIOUS: Unknown sender, unexpected urgency, or strange links
- DANGER: Clear scam — asking for OTP/password/bank account, threatening account block/electricity cut, fake prize/lottery
`;

const SIMPLIFY_PROMPT = `You are helping a senior citizen understand a complex document or message.

Simplify the following text:
- Use simple, everyday words that any senior can understand
- Break into very short sentences (under 15 words each)
- Use bullet points for key items
- Highlight the most important point first
- Explain any tricky terms simply
- Keep the key meaning intact
- Maximum 140 words
`;

// ── Smart Senior Fallback Generator (Demo & Offline) ──────────────────────────

function isDevanagari(text) {
  return /[\u0900-\u097F]/.test(text || '');
}

/**
 * Provides intelligent, warm responses when testing in demo mode or without live API connection.
 * @param {string} userMessage
 * @param {'hi'|'en'} [targetLang]
 */
function generateDemoResponse(userMessage, targetLang = getLang()) {
  const inHindi = targetLang === 'hi' || isDevanagari(userMessage);
  const lower = (userMessage || '').toLowerCase();

  if (inHindi) {
    if (lower.includes('scam') || lower.includes('धोखा') || lower.includes('otp') || lower.includes('सुरक्षित')) {
      return `नमस्ते जी! डिजिटल सुरक्षा के लिए यह नियम हमेशा याद रखें:

1. **OTP कभी किसी को न दें**: बैंक कभी भी फोन पर OTP या पासवर्ड नहीं मांगता।
2. **अंजान लिंक पर न छुएं**: SMS या WhatsApp पर आए किसी अंजान लिंक को न खोलें।
3. **शंका हो तो परिवार से पूछें**: अगर कोई जल्दी करने को कहे, तो पहले रुकें और अपने परिवार को बताएं।

आप जब चाहें मुझसे किसी भी मैसेज की जांच करवा सकते हैं!`;
    }
    if (lower.includes('payment') || lower.includes('पैसे') || lower.includes('पेमेंट') || lower.includes('upi')) {
      return `नमस्ते जी! ऑनलाइन पेमेंट करते समय बस इन बातों का ध्यान रखें:

1. **पैसे प्राप्त करने के लिए PIN नहीं डालना होता**: अगर कोई कहे कि पैसे पाने के लिए PIN डालें, तो वह धोखा है।
2. **दुकानदार का नाम जांचें**: QR कोड स्कैन करने के बाद स्क्रीन पर सही नाम देखें।
3. **अपना UPI PIN किसी को न बताएं**।

क्या आप किसी खास ऐप (जैसे Google Pay या PhonePe) के बारे में जानना चाहते हैं?`;
    }
    return `नमस्ते जी! मैंने आपकी बात सुन ली है।

मैं आपका डिजिटल साथी हूँ। आप मुझसे कोई भी SMS या मैसेज जांचने को कह सकते हैं, फॉर्म भरने में मदद ले सकते हैं, या कोई भी सवाल पूछ सकते हैं।

बताइए, आज मैं आपकी क्या मदद करूँ?`;
  } else {
    if (lower.includes('payment') || lower.includes('money') || lower.includes('upi') || lower.includes('bank')) {
      return `Hello! Here is how to make online payments safely:

1. **Never enter your UPI PIN to receive money**: PIN is only used when YOU are sending money.
2. **Verify the receiver's name**: Always double-check the shopkeeper or person's name on your screen before paying.
3. **Never share OTPs**: Your bank will never call asking for your OTP or password.

Would you like step-by-step help with Google Pay, PhonePe, or Paytm?`;
    }
    if (lower.includes('scam') || lower.includes('suspicious') || lower.includes('safe') || lower.includes('otp')) {
      return `Hello! Here are 3 simple safety rules for your peace of mind:

1. **Keep your OTP secret**: Never share the 6-digit code sent to your phone with anyone.
2. **Don't click unknown links**: If a message claims your account or electricity will be blocked, don't tap the link.
3. **When in doubt, ask family**: Take a moment and call a trusted family member.

I am always here to check any message for you!`;
    }
    return `Hello! I heard you loud and clear.

I'm SINI, your patient digital companion. You can speak or type anything you need help with — checking messages, understanding bills, setting reminders, or using websites.

How can I help you today?`;
  }
}

// ── Core API caller ───────────────────────────────────────────────────────────

/**
 * Makes a Gemini generateContent API call.
 * Handles retries with exponential backoff and demo key fallback.
 *
 * @param {string} apiKey
 * @param {Array<{role: string, parts: Array<{text: string}>}>} contents
 * @param {string} systemPrompt
 * @param {number} [retries=MAX_RETRIES]
 * @param {'hi'|'en'} [targetLang='en']
 * @returns {Promise<string>} Model response text
 * @throws {GeminiError}
 */
async function callGemini(apiKey, contents, systemPrompt, retries = MAX_RETRIES, targetLang = 'en') {
  // Demo mode or mock test key
  if (!apiKey || apiKey === 'DEMO' || apiKey.startsWith('AIzaSyAbcdef')) {
    const lastUserMsg = contents[contents.length - 1]?.parts?.[0]?.text || '';
    return generateDemoResponse(lastUserMsg, targetLang);
  }

  const url = `${API_BASE}/${CHAT_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature:     0.7,
      maxOutputTokens: 1024,
      topP:            0.95,
      topK:            40,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY * Math.pow(2, attempt - 1));
    }

    try {
      const response = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(30_000), // 30s timeout
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 400) throw new GeminiError('invalid_key', t('error.api.key'));
        if (status === 429) {
          lastError = new GeminiError('rate_limit', t('error.api'));
          continue;
        }
        if (status >= 500) {
          lastError = new GeminiError('server_error', t('error.api'));
          continue;
        }
        throw new GeminiError('api_error', t('error.api'));
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      const finishReason = candidate?.finishReason;

      // Handle blocked/empty responses gracefully
      if (!text) {
        if (finishReason === 'SAFETY' || finishReason === 'OTHER' || finishReason === 'RECITATION') {
          // Return a safe, language-appropriate fallback rather than throwing
          const isHi = targetLang === 'hi';
          return isHi
            ? 'माफ़ करें जी, मैं इस सवाल का जवाब अभी नहीं दे सकता। क्या आप दूसरे शब्दों में पूछ सकते हैं?'
            : "I'm sorry, I couldn't process that request. Could you please rephrase your question?";
        }
        throw new GeminiError('empty_response', t('error.generic'));
      }

      return text.trim();

    } catch (err) {
      if (err instanceof GeminiError) throw err;

      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        lastError = new GeminiError('timeout', t('error.api'));
        continue;
      }

      if (err instanceof TypeError && err.message.includes('fetch')) {
        lastError = new GeminiError('network', t('error.api'));
        continue;
      }

      throw new GeminiError('unknown', t('error.generic'));
    }
  }

  throw lastError ?? new GeminiError('max_retries', t('error.api'));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Sends a chat message to SINI with guaranteed language matching.
 *
 * @param {Array<{role:'user'|'model', content: string}>} history
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
export async function sendChat(history, userMessage) {
  const apiKey = getApiKey();
  const safeMessage = sanitizeInput(userMessage, 4000);

  // Determine target language:
  // 1. Detect language from user input (Devanagari, Hindi keywords, or English)
  // 2. Default to active getLang() if input is indeterminate
  const detected = detectLanguage(safeMessage);
  const targetLang = detected || getLang() || 'en';

  if (!apiKey || apiKey === 'DEMO' || apiKey.startsWith('AIzaSyAbcdef')) {
    return generateDemoResponse(safeMessage, targetLang);
  }

  const languagePrompt = targetLang === 'hi'
    ? `\n\nCRITICAL LANGUAGE INSTRUCTION:
You MUST respond EXCLUSIVELY in natural, clear DEVANAGARI HINDI (देवनागरी लिपि).
- NEVER use Roman English alphabet for Hindi words (ABSOLUTELY NO Hinglish like 'aap kaise ho').
- Use simple, respectful, conversational Hindi suited for elders (e.g., 'नमस्ते जी', 'आप बिल्कुल चिंता न करें').
- Do not use complex Sanskritized terms.
- Keep instructions in short numbered steps (1, 2, 3) for clean text-to-speech pronunciation.`
    : `\n\nCRITICAL LANGUAGE INSTRUCTION:
You MUST respond EXCLUSIVELY in warm, simple, everyday ENGLISH.
- Avoid technical jargon.
- Keep instructions in short numbered steps (1, 2, 3) for clean text-to-speech pronunciation.`;

  const contents = [
    ...history.map(msg => ({
      role:  msg.role,
      parts: [{ text: sanitizeInput(msg.content, 4000) }],
    })),
    { role: 'user', parts: [{ text: safeMessage }] },
  ];

  return callGemini(apiKey, contents, SINI_SYSTEM_PROMPT + languagePrompt, 2, targetLang);
}

/**
 * Analyzes a message for scam indicators with language enforcement.
 *
 * @param {string} message
 * @returns {Promise<{ status: 'SAFE'|'SUSPICIOUS'|'DANGER', reason: string, advice: string }>}
 */
export async function analyzeScam(message) {
  const apiKey = getApiKey();
  const safeMessage = sanitizeInput(message, 2000);

  const detected = detectLanguage(safeMessage);
  const targetLang = detected || getLang() || 'en';

  // Local fallback if no key or demo key
  if (!apiKey || apiKey === 'DEMO' || apiKey.startsWith('AIzaSyAbcdef')) {
    const { score, flags } = quickScamScan(safeMessage);
    const inHi = targetLang === 'hi';
    if (score >= 0.4) {
      return {
        status: 'DANGER',
        reason: inHi
          ? `इस संदेश में धोखाधड़ी के लक्षण हैं (${flags.join(', ')}). बैंक या अधिकारी कभी भी ऐसे गोपनीय विवरण नहीं मांगते।`
          : `This message contains high-risk scam triggers (${flags.join(', ')}). Legitimate services never demand urgent action or OTPs like this.`,
        advice: inHi
          ? 'इस संदेश का जवाब न दें, किसी लिंक पर न छुएं और इसे तुरंत हटा दें।'
          : 'Do not click any link, do not reply, and block the sender immediately.',
      };
    } else if (score >= 0.2) {
      return {
        status: 'SUSPICIOUS',
        reason: inHi
          ? 'इस संदेश में कुछ संदिग्ध बातें हैं। सावधानी बरतने की आवश्यकता है।'
          : 'This message shows warning signs. Exercise caution before taking any action.',
        advice: inHi
          ? 'पहले अपने किसी विश्वसनीय परिवार के सदस्य से पूछें।'
          : 'Confirm with a family member before taking any action.',
      };
    }
    return {
      status: 'SAFE',
      reason: inHi
        ? 'इस संदेश में कोई सामान्य धोखाधड़ी का संकेत नहीं मिला।'
        : 'No obvious scam patterns were detected in this message.',
      advice: inHi
        ? 'फिर भी कभी भी अपना OTP या पासवर्ड किसी के साथ साझा न करें।'
        : 'Still, remember to never share passwords or OTPs with anyone.',
    };
  }

  const langSuffix = targetLang === 'hi'
    ? '\nRespond EXCLUSIVELY in simple Devanagari Hindi (देवनागरी).'
    : '\nRespond EXCLUSIVELY in simple English.';

  const prompt   = SCAM_ANALYSIS_PROMPT + langSuffix + '\n\nMessage to analyze:\n' + safeMessage;
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  const raw      = await callGemini(apiKey, contents, '', 1, targetLang);

  return parseScamResponse(raw);
}

/**
 * Simplifies a complex document or message with language enforcement.
 *
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function simplifyText(text) {
  const apiKey = getApiKey();
  const safeText = sanitizeInput(text, 3000);

  const detected = detectLanguage(safeText);
  const targetLang = detected || getLang() || 'en';

  if (!apiKey || apiKey === 'DEMO' || apiKey.startsWith('AIzaSyAbcdef')) {
    const inHi = targetLang === 'hi';
    if (inHi) {
      return `**सरल शब्दों में सारांश:**\n\n• **मुख्य बात:** यह संदेश आपको आवश्यक सूचना देने के लिए है।\n• **क्या करना है:** किसी भी भुगतान या हस्ताक्षर से पहले विवरण जांच लें।\n• **सावधानी:** अपनी व्यक्तिगत जानकारी सुरक्षित रखें।`;
    }
    return `**Simplified Summary:**\n\n• **Main Point:** This message contains important instructions.\n• **What to do:** Carefully check the details before making any payment or signing.\n• **Safety:** Always keep your personal information secure.`;
  }

  const langSuffix = targetLang === 'hi'
    ? '\nRespond EXCLUSIVELY in simple Devanagari Hindi (देवनागरी).'
    : '\nRespond EXCLUSIVELY in simple English.';

  const prompt   = SIMPLIFY_PROMPT + langSuffix + '\n\nText to simplify:\n' + safeText;
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  return callGemini(apiKey, contents, '', 1, targetLang);
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseScamResponse(raw) {
  const statusMatch = raw.match(/STATUS:\s*(SAFE|SUSPICIOUS|DANGER)/i);
  const reasonMatch = raw.match(/REASON:\s*(.+?)(?=ADVICE:|$)/is);
  const adviceMatch = raw.match(/ADVICE:\s*(.+?)$/is);

  const status = (statusMatch?.[1] ?? 'SUSPICIOUS').toUpperCase();
  const reason = reasonMatch?.[1]?.trim() ?? raw;
  const advice = adviceMatch?.[1]?.trim() ?? '';

  return {
    status: ['SAFE', 'SUSPICIOUS', 'DANGER'].includes(status) ? status : 'SUSPICIOUS',
    reason,
    advice,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export class GeminiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
  }
}

export function hasApiKey() {
  return Boolean(getApiKey()) || Boolean(localStorage.getItem('sinicare_setup_completed'));
}

// ── Grocery ordering intent detection ────────────────────────────────────────

const GROCERY_KEYWORDS_HI = [
  'सब्ज़ी', 'सब्जी', 'किराना', 'राशन', 'दूध', 'आटा', 'चावल', 'दाल', 'तेल', 'नमक',
  'ग्रॉसरी', 'grocery', 'groceries', 'order', 'ऑर्डर', 'मंगवाना', 'मंगाना',
  'खाना', 'सामान', 'blinkit', 'ब्लिंकिट', 'zepto', 'instamart',
];
const GROCERY_KEYWORDS_EN = [
  'order groceries', 'buy groceries', 'grocery', 'groceries', 'order food',
  'order milk', 'order vegetables', 'blinkit', 'zepto', 'instamart',
  'order online', 'buy online', 'shopping', 'order items',
];

/**
 * Detects if a user message is a grocery ordering intent.
 * @param {string} text
 * @returns {boolean}
 */
export function isGroceryIntent(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return [
    ...GROCERY_KEYWORDS_HI,
    ...GROCERY_KEYWORDS_EN,
  ].some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Builds a Blinkit search URL for a given item.
 * @param {string} item
 * @returns {string}
 */
export function buildBlinkitUrl(item) {
  return `https://blinkit.com/s/?q=${encodeURIComponent(item.trim())}`;
}
