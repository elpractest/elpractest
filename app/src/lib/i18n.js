/* ============================================================
   i18n — English + Hindi for the Practest student app.
   ------------------------------------------------------------
   Built on i18next + react-i18next. Language is detected from the
   `practest-lang` localStorage key (shared with the header pill) and
   the <html lang> attribute, falling back to English. Changing the
   language also updates <html lang> so the Devanagari font kicks in.

   Add keys here and consume with useTranslation(): t('nav.home').
   ============================================================ */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export const LANG_KEY = 'practest-lang';

const en = {
  common: {
    back: 'Back',
    soon: 'Soon',
    comingSoon: 'Coming soon',
    logout: 'Log out',
    seeAll: 'See all',
    viewAll: 'View all',
    retry: 'Retry',
    loading: 'Loading…',
  },
  nav: { home: 'Home', tests: 'Tests', study: 'Study', store: 'Store', profile: 'Profile' },
  header: {
    greeting: 'Hi, {{name}} 👋',
    search: 'Search tests, exams, notes…',
    notifications: 'Notifications',
  },
  login: {
    welcome: 'Welcome back',
    subtitle: 'Log in to continue your preparation',
    email: 'Email Address',
    emailPlaceholder: 'e.g. student@example.com',
    password: 'Password',
    forgot: 'Forgot password?',
    signIn: 'Sign In',
    signingIn: 'Authenticating…',
    orEmail: 'or sign in with email',
    noAccount: "Don't have an account?",
    create: 'Create Account',
  },
  study: {
    title: 'Study zone',
    subtitle: 'Everything for your prep, in one place',
    attempts: 'My attempts',
    attemptsSub: 'Past tests & scores',
    analytics: 'Analytics',
    analyticsSub: 'Strength & weakness',
    testSeries: 'Test series',
    testSeriesSub: 'Browse packs',
    notes: 'Notes & PDF',
    pyq: 'PYQ bank',
    bookmarks: 'Bookmarks',
  },
  store: {
    title: 'Store',
    subtitle: 'Books, modules & PYQ papers',
    comingTitle: 'Store is coming soon',
    comingBody: 'Printed books, module sets and previous-year papers will be available to buy here.',
  },
  profile: {
    aspirant: 'Aspirant',
    results: 'Results & analytics',
    testSeries: 'Test series',
    redeem: 'Redeem activation code',
    study: 'Study zone',
    help: 'Help & support',
    settings: 'Settings',
  },
  notif: {
    title: 'Notifications',
    emptyTitle: 'No notifications yet',
    emptyBody: 'Result alerts, new mocks and activation updates will appear here.',
  },
  search: {
    placeholder: 'Search tests, exams, notes…',
    popular: 'POPULAR EXAMS',
    hint: 'Full search is coming soon. Tap an exam above to browse its test series.',
  },
  vajini: {
    name: 'Vajini',
    status: 'Your 24×7 study buddy',
    hello: "Hi 👋 I'm Vajini. Ask me to explain a concept, solve a doubt, or plan your study — I answer from your course material.",
    placeholder: 'Ask Vajini anything…',
    thinking: 'Vajini is thinking…',
    error: 'Vajini could not answer just now. Please try again.',
    sources: 'Based on',
    disclaimer: 'Vajini can make mistakes — double-check important facts.',
  },
  verify: {
    banner: 'Verify your phone to request course activation.',
    verifyNow: 'Verify now',
  },
};

const hi = {
  common: {
    back: 'वापस',
    soon: 'जल्द',
    comingSoon: 'जल्द आ रहा है',
    logout: 'लॉग आउट',
    seeAll: 'सभी देखें',
    viewAll: 'सभी देखें',
    retry: 'पुनः प्रयास',
    loading: 'लोड हो रहा है…',
  },
  nav: { home: 'होम', tests: 'टेस्ट', study: 'अध्ययन', store: 'स्टोर', profile: 'प्रोफ़ाइल' },
  header: {
    greeting: 'नमस्ते, {{name}} 👋',
    search: 'टेस्ट, परीक्षाएँ, नोट्स खोजें…',
    notifications: 'सूचनाएँ',
  },
  login: {
    welcome: 'वापसी पर स्वागत है',
    subtitle: 'अपनी तैयारी जारी रखने के लिए लॉग इन करें',
    email: 'ईमेल पता',
    emailPlaceholder: 'जैसे student@example.com',
    password: 'पासवर्ड',
    forgot: 'पासवर्ड भूल गए?',
    signIn: 'साइन इन करें',
    signingIn: 'प्रमाणित किया जा रहा है…',
    orEmail: 'या ईमेल से साइन इन करें',
    noAccount: 'खाता नहीं है?',
    create: 'खाता बनाएँ',
  },
  study: {
    title: 'अध्ययन क्षेत्र',
    subtitle: 'आपकी तैयारी के लिए सब कुछ, एक ही जगह',
    attempts: 'मेरे प्रयास',
    attemptsSub: 'पिछले टेस्ट और स्कोर',
    analytics: 'विश्लेषण',
    analyticsSub: 'मज़बूती और कमज़ोरी',
    testSeries: 'टेस्ट सीरीज़',
    testSeriesSub: 'पैक ब्राउज़ करें',
    notes: 'नोट्स और PDF',
    pyq: 'PYQ बैंक',
    bookmarks: 'बुकमार्क',
  },
  store: {
    title: 'स्टोर',
    subtitle: 'किताबें, मॉड्यूल और PYQ पेपर',
    comingTitle: 'स्टोर जल्द आ रहा है',
    comingBody: 'छपी हुई किताबें, मॉड्यूल सेट और पिछले वर्षों के पेपर यहाँ खरीदने के लिए उपलब्ध होंगे।',
  },
  profile: {
    aspirant: 'अभ्यर्थी',
    results: 'परिणाम और विश्लेषण',
    testSeries: 'टेस्ट सीरीज़',
    redeem: 'एक्टिवेशन कोड रिडीम करें',
    study: 'अध्ययन क्षेत्र',
    help: 'सहायता और समर्थन',
    settings: 'सेटिंग्स',
  },
  notif: {
    title: 'सूचनाएँ',
    emptyTitle: 'अभी कोई सूचना नहीं',
    emptyBody: 'परिणाम अलर्ट, नए मॉक और एक्टिवेशन अपडेट यहाँ दिखेंगे।',
  },
  search: {
    placeholder: 'टेस्ट, परीक्षाएँ, नोट्स खोजें…',
    popular: 'लोकप्रिय परीक्षाएँ',
    hint: 'पूर्ण खोज जल्द आ रही है। ब्राउज़ करने के लिए ऊपर किसी परीक्षा पर टैप करें।',
  },
  vajini: {
    name: 'Vajini',
    status: 'आपकी 24×7 पढ़ाई साथी',
    hello: 'नमस्ते 👋 मैं Vajini हूँ। किसी भी अवधारणा को समझने, संदेह हल करने या पढ़ाई की योजना बनाने के लिए पूछें — मैं आपके कोर्स सामग्री से उत्तर दूँगी।',
    placeholder: 'Vajini से कुछ भी पूछें…',
    thinking: 'Vajini सोच रही है…',
    error: 'Vajini अभी उत्तर नहीं दे पाई। कृपया फिर से प्रयास करें।',
    sources: 'स्रोत',
    disclaimer: 'Vajini से गलतियाँ हो सकती हैं — महत्वपूर्ण तथ्य जाँच लें।',
  },
  verify: {
    banner: 'कोर्स एक्टिवेशन के लिए अपना फ़ोन सत्यापित करें।',
    verifyNow: 'अभी सत्यापित करें',
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, hi: { translation: hi } },
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi'],
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'htmlTag', 'navigator'],
      lookupLocalStorage: LANG_KEY,
      caches: ['localStorage'],
    },
  });

// Keep <html lang> in sync so the Devanagari font stack applies.
function applyHtmlLang(lng) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = (lng || 'en').startsWith('hi') ? 'hi' : 'en';
  }
}
applyHtmlLang(i18n.language);
i18n.on('languageChanged', applyHtmlLang);

export default i18n;
