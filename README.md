# SINIcare 🌟

### Your Friendly AI-Powered Digital Companion for Senior Citizens

SINIcare is a warm, accessible, GenAI-powered web application that helps senior citizens navigate digital life with **ease, confidence, safety, and independence** — by simply typing or speaking.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎙️ **Hindi Voice Assistance (Core)** | Speak in Hindi or English; receive clear, warm spoken Hindi responses with native pronunciation |
| 🔄 **Hindi ↔ English Understanding** | Understands everyday conversational Hindi, Hinglish, and English without requiring technical terms |
| 🔘 **Hindi/English Quick Toggle** | High-contrast pill switcher in the header to switch voice and interface in one tap |
| 🔊 **Adjustable Speech Speed** | Tailor speech rate (0.75x Gentle, 0.88x Normal for Seniors, 1.1x Faster) for relaxed listening |
| 🛡️ **Senior-Friendly Error Handling** | Calming visual and spoken prompts if mic is silent or permission is needed |
| 🔑 **One-Time Setup Persistence** | Gemini API key is asked only once upon first login, with demo exploration mode available |
| 🤖 **AI Companion (SINI)** | Conversational AI powered by Google Gemini, engineered for patience, respect, and simplicity |
| 🛡️ **Scam Detector** | Paste any suspicious SMS/email for an instant traffic-light safety verdict |
| 📄 **Text Simplifier** | Complex documents explained in simple, everyday language |
| 📋 **Form Assistant** | Step-by-step guidance to fill out any form |
| 🌐 **Website Guide** | Help navigating any website, explained simply |
| ⏰ **Reminders** | Add, complete, and delete reminders with optional time-based notifications |
| 📞 **Family Contact** | One-tap access to call a trusted family member |
| ♿ **Accessible** | WCAG AA, large text, high contrast, keyboard nav, screen reader support |

---

## 🚀 Getting Started

### Prerequisites
- A modern browser (Chrome, Firefox, Edge, Safari)
- A free [Google Gemini API key](https://aistudio.google.com) (takes 2 minutes)
- No installation, no build step needed!

### Running the App

1. **Open the app** — simply open `index.html` in your browser.
2. **Add your API key** — paste your free Gemini API key when prompted. It stays on your device only.
3. **Start chatting!** — type or speak any question.

```
SINIcare/
├── index.html              ← Open this in your browser
├── css/
│   ├── main.css            ← Design tokens, typography, layout
│   ├── components.css      ← Buttons, chat bubbles, modals, forms
│   └── responsive.css      ← Mobile, tablet, dark mode, print
├── js/
│   ├── app.js              ← App bootstrap + module wiring
│   ├── gemini.js           ← Gemini API client (retry, error handling)
│   ├── chat.js             ← Chat UI rendering + history
│   ├── voice.js            ← STT + TTS (Web Speech API)
│   ├── i18n.js             ← English + Hindi translations
│   ├── storage.js          ← localStorage wrapper (typed, safe)
│   ├── security.js         ← Input sanitization, XSS prevention
│   ├── a11y.js             ← Accessibility helpers, focus management
│   └── features/
│       ├── quickActions.js ← Quick action button wiring
│       ├── scamDetector.js ← Scam analysis panel
│       ├── simplifier.js   ← Document simplification panel
│       ├── formHelper.js   ← Form assistant
│       └── reminders.js    ← Reminder CRUD + notifications
└── tests/
    ├── index.html          ← Open in browser to run tests
    ├── test-runner.js      ← Lightweight describe/test/expect
    ├── security.test.js    ← XSS, sanitization, scam scanner tests
    └── storage.test.js     ← localStorage, preferences, reminders tests
```

---

## 🔒 Security & Privacy

- **No backend** — entirely client-side. Nothing is stored on any server.
- **API key** — stored in your browser's localStorage. Never leaves your device except to call Google's Gemini API directly.
- **No analytics or tracking** — zero third-party telemetry.
- **XSS protection** — all user input uses `textContent` (never `innerHTML`). AI responses are rendered through a whitelist filter.
- **CSP header** — Content Security Policy blocks external script injection.
- **Input validation** — all inputs are sanitized and length-capped before processing.

---

## ♿ Accessibility

- **WCAG AA** compliant color contrast
- **Large typography** (20px base, scalable to 28px)
- **Large touch targets** (minimum 56×56px)
- **Keyboard navigation** with visible focus rings
- **Screen reader support** — semantic HTML, ARIA roles, live regions
- **Skip link** for keyboard users
- **Reduced motion** respected via `prefers-reduced-motion`
- **Dark mode** via `prefers-color-scheme` + manual high-contrast toggle

---

## 🧪 Running Tests

Open `tests/index.html` in a browser. No server or build step needed.

Tests cover:
- `security.js` — escapeHtml, sanitizeInput, renderMarkdownSafe, isValidApiKey, quickScamScan
- `storage.js` — setItem/getItem, preferences, reminders CRUD lifecycle

---

## 🛠️ Engineering Notes

### Design Decisions
- **No framework** — pure HTML/CSS/JS for maximum compatibility, speed, and zero build step. Senior citizens often have older devices and slower connections.
- **ES Modules** — Clean, testable, tree-shakeable code. Each feature is isolated.
- **Gemini 1.5 Flash** — Fast and cost-effective model, suitable for the interactive conversational use case.
- **Exponential backoff** — The Gemini client retries transient errors up to 2 times with doubling delays.
- **Typed localStorage wrapper** — Prevents runtime crashes from corrupt storage. All values are safely parsed with defaults.

### Extending SINIcare
- **Add a language** — Add a new key to the `TRANSLATIONS` object in `i18n.js`.
- **Add a quick action** — Add an entry to `QUICK_ACTIONS` array in `quickActions.js`.
- **Add a feature panel** — Create a new overlay in `index.html`, a new module in `js/features/`, and register it in `app.js`.
- **Deploy to production** — Drop the folder on any static host (GitHub Pages, Netlify, Vercel). No build step needed.

---

## 📝 License

Built with ❤️ for senior citizens everywhere.