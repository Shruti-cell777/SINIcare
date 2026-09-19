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

const SINI_SYSTEM_PROMPT = `You are SINI (Senior's Intelligent Navigator & Information companion), a warm, patient, and deeply respectful digital helper designed specifically for senior citizens in India.

Senior-First Communication Rule (CRITICAL):
Every response MUST be ultra-simple, clear, and structured into two easy sections:

In English:
**Here’s what this means:**
[1-2 very simple sentences in plain language without any legal or technical jargon]

**What you should do:**
1. [First simple action step]
2. [Second action step]
3. [Third action step if needed]

In Hindi (pure Devanagari script):
**यहाँ इसका मतलब है:**
[1-2 बहुत सरल वाक्य आम बोलचाल में]

**आपको क्या करना चाहिए:**
1. [पहला आसान कदम]
2. [दूसरा आसान कदम]
3. [तीसरा आसान कदम]

Safety & Trust Safeguards:
- If a message asks for bank details, UPI PIN, OTP, CVV, or passwords, ALWAYS start with:
  🛡️ **Before you continue:** This message is asking you to share sensitive bank details. Never share your OTP or PIN with anyone.
- If you are ever unsure about a rule or detail, always add:
  💡 *I'm not completely sure about this. Would you like me to explain further?*
- Total length under 120 words for pleasant, smooth voice listening.`;

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
    // 1. Grocery & Essentials
    if (lower.includes('grocery') || lower.includes('order') || lower.includes('किराना') || lower.includes('राशन') || lower.includes('दूध') || lower.includes('सब्जी') || lower.includes('सामान') || lower.includes('मंगा')) {
      return `**यहाँ इसका मतलब है:**
आप Blinkit से घर बैठे दूध, राशन या सब्ज़ियाँ मँगवा सकते हैं। आपको बाज़ार जाने की ज़रूरत नहीं है।

**आपको क्या करना चाहिए:**
1. नीचे दिए गए **"🛒 राशन मंगाएं"** बटन पर टैप करें।
2. अपना सामान चुनें और समीक्षा करें।
3. Blinkit पर खुद सुरक्षित भुगतान करें — SINI कभी आपका PIN या OTP नहीं माँगता।`;
    }

    // 2. Health, Medicine, Doctor
    if (lower.includes('दवाई') || lower.includes('दवा') || lower.includes('डॉक्टर') || lower.includes('सिरदर्द') || lower.includes('तबीयत') || lower.includes('बीमार') || lower.includes('दर्द') || lower.includes('medicine') || lower.includes('health') || lower.includes('doctor')) {
      return `**यहाँ इसका मतलब है:**
आपकी सेहत सबसे महत्वपूर्ण है। जब भी तबीयत अस्वस्थ लगे, तुरंत सावधानी बरतना ज़रूरी है।

**आपको क्या करना चाहिए:**
1. थोड़ा गुनगुना पानी पिएं और आरामदायक जगह पर विश्राम करें।
2. डॉक्टर द्वारा बताई गई दवाई समय पर लें।
3. यदि तकलीफ़ ज़्यादा हो, तो तुरंत अपने परिवार के सदस्य या डॉक्टर को फ़ोन करें।`;
    }

    // 3. Greetings & SINI identity
    if (lower.includes('namaste') || lower.includes('नमस्ते') || lower.includes('प्रणाम') || lower.includes('कौन हो') || lower.includes('कौन हैं') || lower.includes('kaise ho') || lower.includes('कैसे हो') || lower.includes('hello') || lower.includes('hi')) {
      return `**यहाँ इसका मतलब है:**
नमस्ते जी! मैं SINI हूँ — वरिष्ठ नागरिकों के लिए बना आपका अपना सरल डिजिटल साथी।

**आपको क्या करना चाहिए:**
1. बड़े माइक बटन पर टैप करके अपनी बात बोलें।
2. आप मुझसे कोई भी मैसेज जाँचना, राशन मंगाना या रिमाइंडर लगाना कह सकते हैं।`;
    }

    // 4. Scams, Fraud, Safety
    if (lower.includes('scam') || lower.includes('धोखा') || lower.includes('otp') || lower.includes('सुरक्षित') || lower.includes('संदिग्ध') || lower.includes('लिंक') || lower.includes('link') || lower.includes('कागज़') || lower.includes('दस्तावेज़')) {
      return `**यहाँ इसका मतलब है:**
फ़ोन पर आने वाले कई मैसेज या लिंक धोखेबाज़ी (स्कैम) हो सकते हैं, जिनका मकसद पैसे चुराना होता है।

**आपको क्या करना चाहिए:**
1. अपना OTP, बैंक पासवर्ड या UPI PIN किसी को न बताएं।
2. अंजान नंबर से आए किसी भी लिंक पर कभी क्लिक न करें।
3. संदेह होने पर नीचे दिए गए **"🛡️ स्कैम चेक करें"** पर टैप करें या परिवार से पूछें।`;
    }

    // 5. Payment, UPI, Bank
    if (lower.includes('payment') || lower.includes('पैसे') || lower.includes('पेमेंट') || lower.includes('upi') || lower.includes('bank') || lower.includes('बैंक') || lower.includes('खाता')) {
      return `**यहाँ इसका मतलब है:**
डिजिटल पेमेंट सुरक्षित है, बशर्ते आप कुछ बुनियादी सुरक्षा नियमों का पालन करें।

**आपको क्या करना चाहिए:**
1. पैसे प्राप्त करने के लिए कभी UPI PIN दर्ज न करें।
2. पैसे भेजने से पहले दुकानदार का नाम स्क्रीन पर ज़रूर जाँचें।
3. बैंक से कॉल करने का दावा करने वाले किसी भी व्यक्ति को OTP न दें।`;
    }

    // 6. Phone, WhatsApp, Internet
    if (lower.includes('phone') || lower.includes('फ़ोन') || lower.includes('फोन') || lower.includes('whatsapp') || lower.includes('व्हाट्सएप') || lower.includes('फोटो') || lower.includes('internet') || lower.includes('धीमा') || lower.includes('slow') || lower.includes('hang')) {
      return `**यहाँ इसका मतलब है:**
स्मार्टफ़ोन बहुत सरल है और कुछ आसान चरणों से इसे ठीक से चलाया जा सकता है।

**आपको क्या करना चाहिए:**
1. यदि फ़ोन धीमा चल रहा है, तो पावर बटन दबाकर 'Restart' करें।
2. व्हाट्सएप पर फ़ोटो भेजने के लिए चैट में पेपरक्लिप (📎) आइकन दबाएं।
3. आवाज़ बढ़ाने के लिए फ़ोन के किनारे वाला ऊपरी बटन दबाएं।`;
    }

    // 7. Bills & Pension
    if (lower.includes('बिजली') || lower.includes('बिल') || lower.includes('bill') || lower.includes('पेंशन') || lower.includes('pension')) {
      return `**यहाँ इसका मतलब है:**
बिजली बिल का भुगतान और पेंशन जीवन प्रमाण पत्र अब बिना लाइन में लगे घर से हो सकते हैं।

**आपको क्या करना चाहिए:**
1. बिजली बिल के लिए अपने उपभोक्ता नंबर (CA No.) की रसीद साथ रखें।
2. पेंशन के लिए जीवन प्रमाण पोर्टल या नज़दीकी बैंक शाखा से मदद लें।
3. बिल भुगतान में सहायता के लिए अपने परिवार के किसी सदस्य को साथ रखें।`;
    }

    // 8. Reminders
    if (lower.includes('याद') || lower.includes('रिमाइंडर') || lower.includes('reminder') || lower.includes('अलार्म')) {
      return `**यहाँ इसका मतलब है:**
मैं आपके लिए दवाई, डॉक्टर से मिलने या टहलने जाने का अलार्म और रिमाइंडर लगा सकता हूँ।

**आपको क्या करना चाहिए:**
1. नीचे दिए गए **"📅 मेरे रिमाइंडर"** कार्ड पर टैप करें।
2. अपना काम और समय बताएं, जैसे: शाम 6 बजे दवाई।
3. समय होने पर मैं आपको बोलकर याद दिला दूँगा।`;
    }

    // Default warm Hindi conversational response
    return `**यहाँ इसका मतलब है:**
मैंने आपकी बात अच्छी तरह सुन ली है। मैं आपकी हर डिजिटल काम में मदद करने के लिए तैयार हूँ।

**आपको क्या करना चाहिए:**
1. आप ऊपर दिए गए बड़े माइक बटन को दबाकर कुछ भी पूछ सकते हैं।
2. या नीचे दिए गए 6 कार्ड में से अपनी पसंद का काम चुन सकते हैं।`;

  } else {
    // English responses
    if (lower.includes('grocery') || lower.includes('order') || lower.includes('milk') || lower.includes('bread') || lower.includes('vegetable') || lower.includes('blinkit')) {
      return `**Here’s what this means:**
You can safely order groceries, milk, and household essentials directly from Blinkit without leaving home.

**What you should do:**
1. Tap the **"🛒 Order Groceries"** card below.
2. Select your items and review the simple summary.
3. Complete payment directly on Blinkit — SINI will never ask for your UPI PIN or OTP.`;
    }

    if (lower.includes('medicine') || lower.includes('health') || lower.includes('doctor') || lower.includes('headache') || lower.includes('pain') || lower.includes('sick')) {
      return `**Here’s what this means:**
Your health is the highest priority. Taking rest and timely care is essential whenever you feel unwell.

**What you should do:**
1. Drink a warm glass of water and rest in a comfortable chair.
2. Take your prescribed medicines if it is time.
3. If the discomfort continues, call your doctor or family member immediately.`;
    }

    if (lower.includes('payment') || lower.includes('money') || lower.includes('upi') || lower.includes('bank') || lower.includes('google pay')) {
      return `**Here’s what this means:**
Online banking and UPI are safe as long as you follow key safety safeguards.

**What you should do:**
1. Never enter your UPI PIN to receive money.
2. Double-check the shopkeeper's real name on your screen before sending money.
3. Never share your bank OTP or card details with anyone over a call.`;
    }

    if (lower.includes('scam') || lower.includes('suspicious') || lower.includes('safe') || lower.includes('otp') || lower.includes('link') || lower.includes('document')) {
      return `**Here’s what this means:**
Scammers send urgent SMS messages or fake links claiming your account or electricity will be blocked.

**What you should do:**
1. Do not tap on any link inside unexpected text messages.
2. Never share the 6-digit OTP sent to your phone.
3. Tap **"🛡️ Check for Scam"** below or verify with a trusted family member.`;
    }

    if (lower.includes('phone') || lower.includes('whatsapp') || lower.includes('slow') || lower.includes('photo')) {
      return `**Here’s what this means:**
Smartphones can easily be managed with a few simple, repeatable steps.

**What you should do:**
1. Hold the power button and tap 'Restart' if your phone feels slow.
2. Tap the paperclip (📎) icon inside WhatsApp to attach and send photos.
3. Press the top button on the phone's side to raise the speaker volume.`;
    }

    if (lower.includes('reminder') || lower.includes('alarm') || lower.includes('medicine time')) {
      return `**Here’s what this means:**
SINI can keep track of all your medicine timings and daily appointments so you never miss them.

**What you should do:**
1. Tap the **"📅 My Reminders"** card below.
2. Enter your task and time (e.g., 5:00 PM evening walk).
3. SINI will speak aloud when it is time.`;
    }

    return `**Here’s what this means:**
I heard you clearly. I am SINI, your patient digital companion designed to make technology easy.

**What you should do:**
1. Tap the big central microphone to speak any question naturally.
2. Or choose one of the 6 quick task cards below to get started.`;
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
