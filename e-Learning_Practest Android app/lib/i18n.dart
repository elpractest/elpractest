// PATCH 2 of 4 — the EN/हिं layer.
//
// Noto Sans Devanagari has been bundled since the font pass, but it is reachable
// only as a fontFamilyFallback: no Flutter surface ever asks for Hindi, so the
// bundle costs download size and buys nothing. The guide's sublines are
// Devanagari-FIRST — that is a large part of why the mockup reads as an Indian
// exam product and the app reads as a generic Material app.
//
// Scope, as agreed in docs/DESIGN-GUIDE-PORT.md: splash, welcome, login, nav and
// brand copy. API-sourced text stays as the server sends it.
//
// Strings are ported from app/src/lib/i18n.js so the phone and the browser say
// the same words.

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppLang { en, hi }

class I18n extends ChangeNotifier {
  I18n._();
  static final I18n instance = I18n._();

  static const _key = 'practest-lang';

  AppLang _lang = AppLang.en;
  AppLang get lang => _lang;
  bool get isHindi => _lang == AppLang.hi;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_key);
    if (saved == 'hi') _lang = AppLang.hi;
  }

  Future<void> toggle() async {
    _lang = _lang == AppLang.en ? AppLang.hi : AppLang.en;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, _lang == AppLang.hi ? 'hi' : 'en');
  }

  String t(String key) => (_strings[key] ?? const {})[_lang] ?? key;
}

/// Call as `context.t('welcome.headline')` once I18n is in the provider tree.
const Map<String, Map<AppLang, String>> _strings = {
  'brand.tagline': {
    AppLang.en: 'Practice to Success',
    AppLang.hi: 'अभ्यास से सफलता तक',
  },
  'welcome.badge': {
    AppLang.en: 'EXAM-ACCURATE CBT',
    AppLang.hi: 'परीक्षा जैसा CBT',
  },
  'welcome.headline': {
    AppLang.en: 'Crack it with mocks that feel like the real exam.',
    AppLang.hi: 'असली परीक्षा जैसे मॉक टेस्ट के साथ तैयारी करें।',
  },
  'welcome.subline': {
    AppLang.en: 'असली परीक्षा जैसे मॉक टेस्ट · All-India rank · हिंदी + English',
    AppLang.hi: 'असली परीक्षा जैसे मॉक टेस्ट · ऑल-इंडिया रैंक · हिंदी + English',
  },
  'welcome.claim1': {AppLang.en: 'Real CBT engine', AppLang.hi: 'असली CBT इंजन'},
  'welcome.claim2': {AppLang.en: 'Deep analytics', AppLang.hi: 'गहरा विश्लेषण'},
  'welcome.cta': {AppLang.en: 'Get Started', AppLang.hi: 'शुरू करें'},
  'welcome.haveAccount': {
    AppLang.en: 'I already have an account',
    AppLang.hi: 'मेरा खाता पहले से है',
  },
  'login.title': {AppLang.en: 'Welcome back', AppLang.hi: 'वापस स्वागत है'},
  'login.subtitle': {
    AppLang.en: 'Sign in to continue your exam preparation',
    AppLang.hi: 'अपनी तैयारी जारी रखने के लिए साइन इन करें',
  },
  'login.email': {AppLang.en: 'Email Address', AppLang.hi: 'ईमेल पता'},
  'login.password': {AppLang.en: 'Password', AppLang.hi: 'पासवर्ड'},
  'login.submit': {AppLang.en: 'Sign In', AppLang.hi: 'साइन इन'},
  'nav.home': {AppLang.en: 'Home', AppLang.hi: 'होम'},
  'nav.tests': {AppLang.en: 'Tests', AppLang.hi: 'टेस्ट'},
  'nav.study': {AppLang.en: 'Study', AppLang.hi: 'अध्ययन'},
  'nav.store': {AppLang.en: 'Store', AppLang.hi: 'स्टोर'},
  'nav.profile': {AppLang.en: 'Profile', AppLang.hi: 'प्रोफ़ाइल'},
};
