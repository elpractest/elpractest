/* ============================================================
   DEMO / PLACEHOLDER DATA — populates the redesigned surfaces so the
   rich reference layouts are visible even before the API is seeded.
   ------------------------------------------------------------
   This is a *fallback only*. Every page keeps its real data-fetching
   code; a page falls back to these fixtures ONLY when the API returns
   an empty list AND USE_DEMO_DATA is true. To ship against real data,
   flip USE_DEMO_DATA to false (or set VITE_USE_DEMO_DATA=false).

   Content is ported verbatim from the design source (the standalone
   mockup). Colours are expressed as `hue` keys (gold/blue/violet/green/
   red/sky/neutral) + lucide icon `name`s; each page resolves them to
   concrete colours through tint(hue, isDark) so light mode is not
   washed out. `grad` strings are the card banner gradients from the
   mockup and are theme-independent by design (they sit under a scrim).
   ============================================================ */

const envFlag = import.meta?.env?.VITE_USE_DEMO_DATA;
export const USE_DEMO_DATA = envFlag === undefined ? true : envFlag !== 'false' && envFlag !== false;

/** Return `demo` when the real list is empty and demo mode is on, else `real`. */
export function withDemo(real, demo) {
  if (Array.isArray(real) && real.length > 0) return real;
  return USE_DEMO_DATA ? demo : real;
}

/* ---- gradients used by promo banners & course/store card headers ---- */
export const GRAD = {
  blue: 'linear-gradient(120deg,#10243F,#0B1830)',
  gold: 'linear-gradient(120deg,#3A2A08,#1A1206)',
  violet: 'linear-gradient(120deg,#241046,#140A2A)',
  green: 'linear-gradient(120deg,#0B3320,#052015)',
};

/* ---- Home: promo banner carousel ---- */
export const demoBanners = [
  { kicker: 'FREE SCHOLARSHIP', title: 'Win up to 100% off', subtitle: 'Take the free Practest test', cta: 'Attempt free', grad: GRAD.blue },
  { kicker: 'NEW · SSC CGL 2026', title: '120 exam-pattern mocks', subtitle: 'All-India rank + deep analytics', cta: 'Explore', grad: GRAD.gold },
  { kicker: 'PRO PASS', title: 'All test series, one pass', subtitle: 'Every exam · 1 year · save 60%', cta: 'Get Pro', grad: GRAD.violet },
];

/* ---- Home: 4 quick-mode tiles ---- */
export const demoQuickModes = [
  { label: 'Mock Tests', hue: 'gold', icon: 'target' },
  { label: 'Practice', hue: 'blue', icon: 'edit' },
  { label: 'Notes & PDF', hue: 'violet', icon: 'file' },
  { label: 'Analytics', hue: 'green', icon: 'chart' },
];

/* ---- Home / Tests: "Explore by exam" 8-icon grid (mono glyph tiles) ---- */
export const demoExamCats = [
  { k: 'SSC', hi: 'एसएससी', mono: 'SSC', hue: 'gold' },
  { k: 'Banking', hi: 'बैंकिंग', mono: '₹', hue: 'green' },
  { k: 'Railways', hi: 'रेलवे', mono: 'RRB', hue: 'red' },
  { k: 'UPSC', hi: 'यूपीएससी', mono: 'UP', hue: 'blue' },
  { k: 'State PCS', hi: 'राज्य', mono: 'PCS', hue: 'violet' },
  { k: 'NEET', hi: 'नीट', mono: 'N', hue: 'green' },
  { k: 'JEE', hi: 'जेईई', mono: 'JEE', hue: 'sky' },
  { k: 'Defence', hi: 'रक्षा', mono: 'DEF', hue: 'gold' },
];

/* ---- Home / Tests: course / test-series cards ---- */
export const demoCourses = [
  { id: 'demo-ssc-cgl', exam: 'SSC CGL', lang: 'हिं+EN', tag: 'Bestseller', title: 'SSC CGL 2026 Tier-1 Test Pass', meta: '120 Mocks · 5000+ PYQs', price: '₹1,499', mrp: '₹2,999', off: '50% OFF', grad: GRAD.gold, rating: 4.8, ratingCount: '12.4k' },
  { id: 'demo-sbi-po', exam: 'SBI PO', lang: 'EN', tag: 'New', title: 'SBI PO 2026 Prelims + Mains', meta: '80 Mocks · sectional + full', price: '₹1,199', mrp: '₹2,499', off: '52% OFF', grad: GRAD.blue, rating: 4.7, ratingCount: '8.1k' },
  { id: 'demo-rrb-ntpc', exam: 'RRB NTPC', lang: 'हिं+EN', tag: 'Popular', title: 'RRB NTPC 2026 Complete Pack', meta: '100 Mocks · CBT-1 & CBT-2', price: '₹999', mrp: '₹1,999', off: '50% OFF', grad: GRAD.violet, rating: 4.6, ratingCount: '15.2k' },
  { id: 'demo-upsc', exam: 'UPSC', lang: 'EN', tag: 'Prelims', title: 'UPSC Prelims 2026 Test Series', meta: '60 Mocks · GS + CSAT', price: '₹1,799', mrp: '₹3,499', off: '48% OFF', grad: GRAD.green, rating: 4.9, ratingCount: '6.7k' },
];

/* ---- Tests: horizontal filter chips ---- */
export const demoFilterChips = ['All exams', 'SSC', 'Banking', 'Railways', 'UPSC'];

/* ---- Course detail: "What's inside" feature list ---- */
export const demoDetailFeatures = [
  { k: '120 full-length mocks', hue: 'gold', icon: 'target' },
  { k: '5,000+ previous-year questions', hue: 'blue', icon: 'book' },
  { k: 'All-India rank & percentile', hue: 'green', icon: 'chart' },
  { k: 'Bilingual — Hindi + English', hue: 'violet', icon: 'languages' },
  { k: 'Detailed video solutions', hue: 'red', icon: 'play' },
];

/* ---- Study zone: 6-tile grid + header stats ---- */
export const demoStudyTiles = [
  { label: 'My attempts', sub: '142 tests', hue: 'gold', icon: 'edit' },
  { label: 'Analytics', sub: 'Strength & weakness', hue: 'green', icon: 'chart' },
  { label: 'Notes & PDF', sub: '480 files', hue: 'violet', icon: 'file' },
  { label: 'PYQ bank', sub: '10 yrs papers', hue: 'blue', icon: 'book' },
  { label: 'Bookmarks', sub: '64 saved', hue: 'red', icon: 'bookmark' },
  { label: 'Downloads', sub: 'Offline ready', hue: 'sky', icon: 'download' },
];
export const demoStudyStats = [
  { label: 'Tests done', value: '142', hue: 'gold' },
  { label: 'Accuracy', value: '78%', hue: 'green' },
  { label: 'Best rank', value: '1,204', hue: 'blue' },
];

/* ---- Store: category chips + product cards ---- */
export const demoStoreCats = [
  { k: 'Books', hue: 'gold', icon: 'book' },
  { k: 'Modules', hue: 'blue', icon: 'grid' },
  { k: 'PYQ Papers', hue: 'violet', icon: 'file' },
  { k: 'Stationery', hue: 'green', icon: 'edit' },
];
export const demoStoreProducts = [
  { title: 'SSC CGL Tier-1 Module Set (4 books)', price: '₹899', mrp: '₹1,499', grad: GRAD.gold },
  { title: 'Banking Awareness 2026 Digest', price: '₹349', mrp: '₹599', grad: GRAD.blue },
  { title: 'Reasoning Master Practice Book', price: '₹499', mrp: '₹799', grad: GRAD.violet },
  { title: '10-Year SSC PYQ Solved Papers', price: '₹599', mrp: '₹999', grad: GRAD.green },
];

/* ---- Profile / menu ---- */
export const demoMenuItems = [
  { label: 'My purchases', hue: 'gold', icon: 'shopping-bag', badge: false },
  { label: 'Redeem activation code', hue: 'green', icon: 'key', badge: false },
  { label: 'Scholarship', hue: 'blue', icon: 'graduation-cap', badge: true },
  { label: 'Notes & downloads', hue: 'violet', icon: 'download', badge: false },
  { label: 'Help & support', hue: 'sky', icon: 'help-circle', badge: false },
  { label: 'Settings', hue: 'neutral', icon: 'settings', badge: false },
];

/* ---- Notifications ---- */
export const demoNotifs = [
  { title: 'Result ready', body: 'Your SSC CGL Mock #24 result & analytics are ready. AIR 1,204.', time: '2m', hue: 'green', icon: 'check-circle' },
  { title: 'Activation approved', body: 'Your request for SBI PO 2026 Prelims was approved. Redeem your code now.', time: '1h', hue: 'gold', icon: 'key' },
  { title: 'New mock added', body: 'SSC CGL 2026 Tier-1 Mock #25 is live. Attempt before Sunday for rank.', time: '5h', hue: 'blue', icon: 'target' },
  { title: 'Scholarship test', body: 'Only 2 days left to attempt the free Practest Scholarship Test.', time: '1d', hue: 'violet', icon: 'graduation-cap' },
  { title: 'Streak: 7 days 🔥', body: 'You studied 7 days in a row. Keep it going for a bonus mock!', time: '2d', hue: 'red', icon: 'zap' },
];

/* ---- Search ---- */
export const demoTrending = ['SSC CGL Tier-1', 'SBI PO Prelims', 'RRB NTPC', 'Quant sectional', 'UPSC CSAT', 'Free scholarship'];
export const demoRecent = ['SSC CGL Mock #24', 'Banking awareness notes', 'Percentage shortcuts'];

/* ---- Continue-where-you-left (Home) ---- */
export const demoContinue = { pct: 62, title: 'SBI PO 2026 · Prelims', next: 'Next: Sectional — Quant · Simplification' };
export const demoGoal = 'SSC CGL 2026 · Tier-1';

/* ---- CBT engine (question templates → 20-question mock) ---- */
export const demoQuestionTemplates = [
  { subj: 'Quant', sec: 'Quantitative Aptitude', text: 'A train 240 m long crosses a pole in 12 seconds. Its speed (in km/h) is:', opts: ['54', '60', '72', '66'], correct: 2, exp: 'Speed = 240 ÷ 12 = 20 m/s = 20 × 18/5 = 72 km/h.' },
  { subj: 'Reasoning', sec: 'Reasoning', text: 'Find the odd one out: 3, 5, 11, 14, 17', opts: ['14', '11', '17', '5'], correct: 0, exp: 'All others are prime numbers; 14 is composite.' },
  { subj: 'English', sec: 'English', text: 'Choose the correctly spelt word:', opts: ['Occassion', 'Ocassion', 'Occasion', 'Occasionn'], correct: 2, exp: 'The correct spelling is “Occasion” — double-c, single-s.' },
  { subj: 'GA', sec: 'General Awareness', text: 'The Tropic of Cancer does NOT pass through which of these states?', opts: ['Gujarat', 'Rajasthan', 'Odisha', 'Jharkhand'], correct: 2, exp: 'The Tropic of Cancer passes through 8 Indian states; Odisha is not one of them.' },
  { subj: 'Quant', sec: 'Quantitative Aptitude', text: '20% of 250 + 15% of 200 = ?', opts: ['70', '80', '90', '85'], correct: 1, exp: '50 + 30 = 80.' },
];
export function buildDemoQuestions(n = 20) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ ...demoQuestionTemplates[i % demoQuestionTemplates.length], n: i + 1 });
  return out;
}

/* ---- Result & analysis ---- */
export const demoResultBars = [
  { k: 'Quantitative Aptitude', pct: 88, hue: 'gold' },
  { k: 'Reasoning', pct: 80, hue: 'blue' },
  { k: 'English', pct: 76, hue: 'green' },
  { k: 'General Awareness', pct: 72, hue: 'violet' },
];
export const demoResultSummary = {
  score: 172, total: 200, scorePct: 86,
  rank: '1,204', percentile: '96.4', accuracy: '82%',
  correct: 43, wrong: 5, skipped: 2, timeSpent: '48:12',
  title: 'SSC CGL 2026 Tier-1 · Mock #24',
};
