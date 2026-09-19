/**
 * SINIcare — i18n.js
 *
 * Internationalization support for English and Hindi.
 * All user-facing UI strings should come from this module.
 */

'use strict';

/** @type {{ en: Object.<string,string>, hi: Object.<string,string> }} */
const TRANSLATIONS = {
  en: {
    // App header
    'app.name':              'SINIcare',
    'app.title':             'SINIcare',
    'app.tagline':           'Your Digital Companion',

    // Welcome screen
    'welcome.greeting':      'Hello! I\'m SINI 👋',
    'welcome.subtitle':      'Your friendly digital companion',
    'welcome.hint':          'Type or speak anything you need help with — I\'m here!',
    'welcome.examples':      'Try: "Is this message safe?" or "Help me fill a form"',

    // Quick actions
    'qa.scam':               'Check Scam',
    'qa.simplify':           'Simplify Text',
    'qa.form':               'Fill a Form',
    'qa.reminder':           'Reminders',
    'qa.grocery':            'Order Groceries',
    'qa.website':            'Help with Website',
    'qa.help':               'Call Family',

    // Input area
    'input.placeholder':     'Type your message here...',
    'input.send':            'Send',
    'input.mic':             'Press to speak',
    'input.mic.recording':   'Listening... tap to stop',
    'input.tts':             'Read aloud',

    // Buttons
    'btn.close':             'Close',
    'btn.save':              'Save',
    'btn.cancel':            'Cancel',
    'btn.clear':             'Clear',
    'btn.analyze':           'Analyze Message',
    'btn.simplify':          'Simplify This',
    'btn.add':               'Add Reminder',
    'btn.clear_chat':        'Clear Chat',
    'btn.listen':            'Listen',
    'btn.send':              'Send',
    'chat.welcome.named':    'Hello {name}! How can I help you today?',

    // Scam detector
    'scam.title':            '🛡️ Scam Checker',
    'scam.label':            'Paste the suspicious message below:',
    'scam.placeholder':      'Paste SMS, email, or message here...',
    'scam.safe':             '✅ This looks safe',
    'scam.suspicious':       '⚠️ This looks suspicious',
    'scam.danger':           '🚨 This is likely a scam!',
    'scam.empty':            'Please paste a message to check.',
    'scam.analyzing':        'Analyzing message...',

    // Simplifier
    'simplify.title':        '📄 Simplify Text',
    'simplify.label':        'Paste the document or message to simplify:',
    'simplify.placeholder':  'Paste complex text here...',
    'simplify.empty':        'Please paste some text to simplify.',
    'simplify.analyzing':    'Simplifying...',

    // Reminders
    'reminders.title':       '⏰ My Reminders',
    'reminders.add.label':   'Add a new reminder:',
    'reminders.placeholder': 'e.g. Take medicine at 10 AM',
    'reminders.time.label':  'Time (optional):',
    'reminders.empty':       'No reminders yet.\nAdd one below!',
    'reminders.added':       'Reminder added!',
    'reminders.deleted':     'Reminder deleted.',
    'reminders.done':        'Marked as done!',

    // Settings
    'settings.title':        '⚙️ Settings',
    'settings.api.label':    'Gemini API Key',
    'settings.api.hint':     'Get your free key at aistudio.google.com',
    'settings.api.placeholder': 'Paste your API key here',
    'settings.contact.label':   'Trusted Family Member',
    'settings.contact.name':    'Their name',
    'settings.contact.phone':   'Their phone number',
    'settings.font.label':      'Text Size',
    'settings.font.normal':     'Normal',
    'settings.font.large':      'Large',
    'settings.font.xl':         'Extra Large',
    'settings.tts.label':       'Read responses aloud',
    'settings.tts.desc':        'SINI will speak responses automatically',
    'settings.contrast.label':  'High contrast mode',
    'settings.contrast.desc':   'For easier reading',
    'settings.saved':           'Settings saved!',
    'settings.api.required':    'Please enter your Gemini API key first.',

    // Setup
    'setup.title':           'Welcome to SINIcare! 🌟',
    'setup.subtitle':        'Let\'s get you set up in 2 simple steps.',
    'setup.step1.title':     'Get your free AI key',
    'setup.step1.desc':      'Visit aistudio.google.com, sign in, and click "Get API Key".',
    'setup.step2.title':     'Paste it below',
    'setup.step2.desc':      'Your key stays on your device only — it is never shared.',
    'setup.key.label':       'Your Gemini API Key:',
    'setup.start':           'Start Using SINIcare →',
    'setup.invalid':         'That doesn\'t look like a valid key. Please try again.',

    // Trusted contact call modal
    'contact.title':         '📞 Call Your Family',
    'contact.none':          'No contact saved yet.',
    'contact.none.hint':     'Go to ⚙️ Settings to add a trusted family member.',
    'contact.calling':       'Calling',
    'contact.call':          'Call Now',
    'contact.call.hint':     'This will open your phone\'s dialler.',

    // Voice controls & speed
    'voice.hero.title':         'Speak in Hindi or English',
    'voice.listening':          'Listening... Speak now',
    'voice.listening.hi':       'Listening in Hindi... बोलिए',
    'voice.stop':               'Done Speaking',
    'voice.cancel':             'Cancel',
    'voice.speed.label':        'Speaking Speed',
    'voice.speed.slow':         'Gentle (Slow)',
    'voice.speed.normal':       'Normal (Recommended)',
    'voice.speed.fast':         'Faster',

    // Setup & Demo mode
    'setup.demo':               'Try Demo Mode (Add key later)',
    'setup.demo.desc':          'Experience SINIcare right away with built-in assistance.',
    'lang.switch.to_hi':        'हिन्दी',
    'lang.switch.to_en':        'English',

    // Errors
    'error.api':                'SINI couldn\'t connect right now. Please check your internet and try again.',
    'error.api.key':            'Your API key seems incorrect. Please check it in Settings.',
    'error.voice':              'Voice input is not available on this browser. Please type instead.',
    'error.voice.permission':   'Microphone permission is needed to speak. Please tap Allow in your browser.',
    'error.voice.no_speech':    'I couldn\'t hear anything. Please tap the mic when ready and speak clearly.',
    'error.voice.network':      'Connection was slow. Please tap the mic and try again.',
    'error.tts':                'Read-aloud is not available on this device.',
    'error.generic':            'Something went wrong. Please try again.',

    // AI quick prompts (sent to Gemini)
    'prompt.scam.prefix':       'Please analyze this message for scam risks:',
    'prompt.website.prefix':    'Help me understand or use this website:',
    'prompt.form.prefix':       'Please help me fill out this form step by step:',

    // Chat cleared
    'chat.cleared':             'Chat cleared.',
    'chat.copied':              'Copied!',
  },

  hi: {
    // App header
    'app.name':              'SINIcare',
    'app.tagline':           'आपका डिजिटल साथी',

    // Welcome screen
    'welcome.greeting':      'नमस्ते! मैं SINI हूँ 👋',
    'welcome.subtitle':      'आपका दोस्ताना डिजिटल साथी',
    'welcome.hint':          'जो भी चाहिए टाइप करें या बोलें — मैं यहाँ हूँ!',
    'welcome.examples':      'जैसे: "क्या यह मैसेज सुरक्षित है?" या "फॉर्म भरने में मदद करो"',

    // Quick actions
    'qa.scam':               'धोखाधड़ी जाँचें',
    'qa.simplify':           'सरल करें',
    'qa.form':               'फॉर्म भरें',
    'qa.reminder':           'याददाश्त',
    'qa.grocery':            'किराना मंगाएं',
    'qa.website':            'वेबसाइट मदद',
    'qa.help':               'परिवार को कॉल',

    // Input area
    'input.placeholder':     'यहाँ टाइप करें...',
    'input.send':            'भेजें',
    'input.mic':             'बोलने के लिए दबाएँ',
    'input.mic.recording':   'सुन रहा हूँ... रोकने के लिए दबाएँ',
    'input.tts':             'पढ़कर सुनाएँ',

    // Buttons
    'btn.close':             'बंद करें',
    'btn.save':              'सहेजें',
    'btn.cancel':            'रद्द करें',
    'btn.clear':             'साफ़ करें',
    'btn.analyze':           'मैसेज जाँचें',
    'btn.simplify':          'सरल करें',
    'btn.add':               'याददाश्त जोड़ें',
    'btn.clear_chat':        'चैट साफ़ करें',
    'btn.listen':            'सुनें',

    // Scam detector
    'scam.title':            '🛡️ धोखाधड़ी जाँचकर्ता',
    'scam.label':            'संदिग्ध मैसेज नीचे चिपकाएँ:',
    'scam.placeholder':      'SMS, ईमेल या मैसेज यहाँ चिपकाएँ...',
    'scam.safe':             '✅ यह सुरक्षित लगता है',
    'scam.suspicious':       '⚠️ यह संदिग्ध लगता है',
    'scam.danger':           '🚨 यह शायद धोखा है!',
    'scam.empty':            'कृपया जाँचने के लिए कोई मैसेज चिपकाएँ।',
    'scam.analyzing':        'मैसेज जाँच रहा हूँ...',

    // Simplifier
    'simplify.title':        '📄 मैसेज सरल करें',
    'simplify.label':        'दस्तावेज़ या मैसेज यहाँ चिपकाएँ:',
    'simplify.placeholder':  'जटिल पाठ यहाँ चिपकाएँ...',
    'simplify.empty':        'कृपया कोई पाठ चिपकाएँ।',
    'simplify.analyzing':    'सरल कर रहा हूँ...',

    // Reminders
    'reminders.title':       '⏰ मेरी याददाश्त',
    'reminders.add.label':   'नई याददाश्त जोड़ें:',
    'reminders.placeholder': 'जैसे: सुबह 10 बजे दवाई लेनी है',
    'reminders.time.label':  'समय (वैकल्पिक):',
    'reminders.empty':       'अभी कोई याददाश्त नहीं।\nनीचे जोड़ें!',
    'reminders.added':       'याददाश्त जोड़ी गई!',
    'reminders.deleted':     'याददाश्त हटाई गई।',
    'reminders.done':        'पूरा हो गया!',

    // Settings
    'settings.title':        '⚙️ सेटिंग्स',
    'settings.api.label':    'Gemini API Key',
    'settings.api.hint':     'aistudio.google.com पर जाकर मुफ़्त में पाएँ',
    'settings.api.placeholder': 'API Key यहाँ चिपकाएँ',
    'settings.contact.label':   'विश्वसनीय परिवार के सदस्य',
    'settings.contact.name':    'उनका नाम',
    'settings.contact.phone':   'उनका फ़ोन नंबर',
    'settings.font.label':      'अक्षर का आकार',
    'settings.font.normal':     'सामान्य',
    'settings.font.large':      'बड़ा',
    'settings.font.xl':         'बहुत बड़ा',
    'settings.tts.label':       'जवाब पढ़कर सुनाएँ',
    'settings.tts.desc':        'SINI स्वचालित रूप से बोलेगा',
    'settings.contrast.label':  'उच्च कंट्रास्ट मोड',
    'settings.contrast.desc':   'आसान पढ़ाई के लिए',
    'settings.saved':           'सेटिंग्स सहेजी गई!',
    'settings.api.required':    'पहले अपनी Gemini API Key डालें।',

    // Setup
    'setup.title':           'SINIcare में आपका स्वागत है! 🌟',
    'setup.subtitle':        'आइए दो आसान कदमों में शुरू करते हैं।',
    'setup.step1.title':     'मुफ़्त AI Key लें',
    'setup.step1.desc':      'aistudio.google.com पर जाएँ, लॉगिन करें और "Get API Key" दबाएँ।',
    'setup.step2.title':     'नीचे चिपकाएँ',
    'setup.step2.desc':      'आपकी Key केवल आपके डिवाइस पर रहती है — कहीं नहीं जाती।',
    'setup.key.label':       'आपकी Gemini API Key:',
    'setup.start':           'SINIcare शुरू करें →',
    'setup.invalid':         'यह Key सही नहीं लगती। कृपया दोबारा कोशिश करें।',

    // Trusted contact
    'contact.title':         '📞 परिवार को कॉल करें',
    'contact.none':          'अभी कोई संपर्क नहीं है।',
    'contact.none.hint':     '⚙️ सेटिंग्स में जाकर परिवार का नंबर जोड़ें।',
    'contact.calling':       'कॉल कर रहा है',
    'contact.call':          'अभी कॉल करें',
    'contact.call.hint':     'यह आपके फ़ोन का डायलर खोलेगा।',

    // Voice controls & speed
    'voice.hero.title':         'हिंदी या अंग्रेज़ी में बोलें',
    'voice.listening':          'सुन रहा हूँ... बोलिए',
    'voice.listening.hi':       'हिंदी में सुन रहा हूँ... बोलिए',
    'voice.stop':               'बोलना पूरा हुआ',
    'voice.cancel':             'रद्द करें',
    'voice.speed.label':        'बोलने की गति (Speech Speed)',
    'voice.speed.slow':         'धीमी (आराम से)',
    'voice.speed.normal':       'सामान्य (सुझाया गया)',
    'voice.speed.fast':         'तेज़',

    // Setup & Demo mode
    'setup.demo':               'डेमो मोड आज़माएँ (Key बाद में जोड़ें)',
    'setup.demo.desc':          'बिना API Key के तुरंत SINIcare का अनुभव करें।',
    'lang.switch.to_hi':        'हिन्दी',
    'lang.switch.to_en':        'English',

    // Errors
    'error.api':                'SINI अभी जुड़ नहीं सका। इंटरनेट जाँचें और दोबारा कोशिश करें।',
    'error.api.key':            'API Key गलत लगती है। सेटिंग्स में जाँचें।',
    'error.voice':              'इस ब्राउज़र में आवाज़ उपलब्ध नहीं है। कृपया टाइप करें।',
    'error.voice.permission':   'बोलने के लिए माइक की अनुमति चाहिए। कृपया ब्राउज़र में Allow दबाएँ।',
    'error.voice.no_speech':    'मुझे कोई आवाज़ नहीं सुनाई दी। जब तैयार हों, माइक बटन दबाएँ।',
    'error.voice.network':      'इंटरनेट धीमा है। कृपया माइक दबाकर दोबारा बोलें।',
    'error.tts':                'इस डिवाइस पर पढ़ना उपलब्ध नहीं है।',
    'error.generic':            'कुछ गलत हो गया। कृपया फिर कोशिश करें।',

    // AI quick prompts
    'prompt.scam.prefix':       'कृपया इस मैसेज की धोखाधड़ी के लिए जाँच करें:',
    'prompt.website.prefix':    'इस वेबसाइट को समझने या उपयोग करने में मदद करें:',
    'prompt.form.prefix':       'कृपया इस फॉर्म को चरण-दर-चरण भरने में मेरी मदद करें:',

    // Chat
    'chat.cleared':             'चैट साफ़ हो गई।',
    'chat.copied':              'कॉपी हो गया!',
  },
};

export const SUPPORTED_LANGUAGES = {
  en: { code: 'en', name: 'English', nativeName: 'English' },
  hi: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  ta: { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  te: { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  bn: { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  mr: { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
};

/** @type {string} */
let currentLang = 'en';

/**
 * Sets the active language.
 * @param {string} lang
 */
export function setLang(lang) {
  if (!SUPPORTED_LANGUAGES[lang]) return;
  currentLang = lang;
  document.documentElement.setAttribute('lang', lang);
}

/**
 * Returns the current active language.
 * @returns {'en'|'hi'}
 */
export function getLang() { return currentLang; }

/**
 * Translates a key into the current language.
 * Falls back to English, then to the key itself.
 *
 * @param {string} key
 * @param {Object.<string,string>} [replacements={}] - Named replacements, e.g. { name: 'Sunita' }
 * @returns {string}
 */
export function t(key, replacements = {}) {
  let text = TRANSLATIONS[currentLang]?.[key]
          ?? TRANSLATIONS['en']?.[key]
          ?? key;

  for (const [placeholder, value] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
  }

  return text;
}

/**
 * Updates all elements with a `data-i18n` attribute to the current language.
 * The attribute value is a translation key.
 * Also handles `data-i18n-placeholder` for inputs.
 *
 * Call this after calling setLang().
 */
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    el.setAttribute('aria-label', t(key));
  });
}

/**
 * Automatically detects whether input text is in Hindi or English.
 * Returns 'hi' if Devanagari characters or common Hindi keywords are found.
 * Returns 'en' if English content is identified.
 * Returns null if indeterminate.
 *
 * @param {string} text
 * @returns {'hi'|'en'|null}
 */
export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. Direct Devanagari detection (\u0900-\u097F) -> 100% Hindi
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi';
  }

  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+/).map(w => w.replace(/[^\w]/g, '')).filter(Boolean);
  if (words.length === 0) return null;

  // 2. Common Hindi/Hinglish conversational keywords
  const hindiKeywords = [
    'namaste', 'namaskar', 'pranam',
    'kya', 'kaise', 'karo', 'karna', 'kijiye', 'batao', 'bataiye',
    'mera', 'meri', 'mere', 'mujhe', 'hum', 'humara',
    'hai', 'hain', 'ho', 'tha', 'thi', 'the', 'hoga', 'hogi',
    'nahi', 'nahin', 'mat', 'kyun', 'kaha', 'kahan', 'kab',
    'aap', 'tum', 'chahiye', 'kripya', 'madad',
    'paise', 'paisa', 'dhokha', 'bijli', 'dawai', 'dawaii',
    'suno', 'samjhao', 'padho', 'dekh', 'dekho',
    'bhai', 'betaji', 'beta', 'bache', 'dada', 'dadi',
    'kirana', 'rashan', 'doodh', 'sabji', 'sabzi'
  ];

  const hindiMatches = words.filter(w => hindiKeywords.includes(w)).length;
  if (hindiMatches >= 1) {
    return 'hi';
  }

  // 3. Clear English structural words / complete phrases
  const englishStructuralWords = [
    'the', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were',
    'have', 'has', 'had', 'can', 'could', 'should', 'would', 'will',
    'what', 'where', 'when', 'why', 'who', 'how', 'which',
    'please', 'tell', 'help', 'explain', 'order'
  ];

  const engMatches = words.filter(w => englishStructuralWords.includes(w)).length;
  if (engMatches >= 2 || (words.length <= 2 && engMatches >= 1 && hindiMatches === 0)) {
    return 'en';
  }

  return null;
}
