/**
 * Mock-day load test — the 9:00 a.m. synchronised start.
 *
 * A test series lives or dies on scheduled mocks: every candidate presses
 * Start inside the same couple of minutes. That is a very different load shape
 * from steady daily traffic, and it is the scenario most likely to embarrass a
 * young platform in front of its entire user base at once. This reproduces it.
 *
 * NEVER RUN THIS AGAINST PRODUCTION. It is a denial-of-service against your own
 * students. Point BASE_URL at a local or staging stack only; the script refuses
 * to run against practest.live.
 *
 * Usage (k6 needs no install if you have Docker):
 *
 *   # 1. Seed the target with load users + a published paper:
 *   php artisan load:seed-mock --candidates=500 --questions=100
 *
 *   # 2. Copy the tokens it wrote out of the container:
 *   docker cp <api-container>:/var/www/html/storage/app/load-tokens.json .
 *
 *   # 3. Run, ramping to 500 candidates all starting at once:
 *   docker run --rm -i --network host -v "$PWD:/data" -w /data \
 *     -e BASE_URL=http://localhost:8080 \
 *     -e TEST_ID=1 \
 *     grafana/k6 run - < api/tests/Load/mock-day-start.js
 *
 * What to watch: `http_req_duration` p(95) on the start call, and the error
 * rate. Query count per start is pinned separately by TestStartLoadTest — this
 * measures what the whole stack does when they all arrive together.
 *
 * ── Baseline, 2026-09-02 ────────────────────────────────────────────────────
 * Local stack (the production api image, PHP_FPM_PM_MAX_CHILDREN=20, MariaDB
 * 10.6, one laptop). Absolute numbers are NOT production numbers — the useful
 * parts are the shape and the before/after.
 *
 *   300 candidates, 100-question paper, all starting at once:
 *     before  p95 2.34s · median 1.30s · 120 starts/s · 0 errors
 *     after   p95 1.48s · median 0.81s · 182 starts/s · 0 errors
 *
 *   1,000 candidates, same paper, all in the same instant:
 *     p95 5.76s · median 3.14s · 162 starts/s · 0 errors · cleared in 6.2s
 *
 * "before" = one INSERT per answer row plus a redundant reload of the whole
 * paper; "after" = the batched insert this suite now pins in place.
 *
 * Read: the stack degrades by QUEUEING, not by failing — at 1,000 truly
 * simultaneous starts every candidate still got their paper. And real arrivals
 * are spread over a minute or two, not one instant: 2,000 candidates over 60s
 * is ~33/s against a measured ~162/s.
 */
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TEST_ID = __ENV.TEST_ID || '1';
const TOKENS_FILE = __ENV.TOKENS_FILE || 'load-tokens.json';

// Pre-minted bearer tokens, one per candidate (see `load:seed-mock`).
//
// The script deliberately does NOT log in. `/api/login` is throttled per IP,
// so 500 logins from one load generator only ever measures that limiter —
// while real candidates arrive already signed in from 500 different
// addresses. Skipping it isolates the endpoint actually under test.
const TOKENS = new SharedArray('tokens', () => JSON.parse(open(TOKENS_FILE)));
const CANDIDATES = parseInt(__ENV.CANDIDATES || String(TOKENS.length), 10);

if (/practest\.live/.test(BASE_URL)) {
  throw new Error('Refusing to load-test production. Point BASE_URL at a local or staging stack.');
}

const startFailures = new Rate('start_failures');
const startDuration = new Trend('start_duration_ms');

export const options = {
  scenarios: {
    // Every candidate starts the mock exactly ONCE, all of them inside the
    // same window — which is what a scheduled 9 a.m. start actually is.
    //
    // Deliberately not a looping executor: a VU hammering /start in a loop
    // measures the rate limiter and the resume path, not the expensive
    // first-start, and no real candidate does that.
    synchronised_start: {
      executor: 'per-vu-iterations',
      vus: CANDIDATES,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    // A candidate staring at a spinner assumes the exam is broken.
    'http_req_duration{name:start}': ['p(95)<3000'],
    start_failures: ['rate<0.01'],
  },
};

export default function () {
  // One VU per seeded candidate, so each start is a distinct student —
  // the same candidate restarting would just resume and skip the expensive path.
  const token = TOKENS[(__VU - 1) % TOKENS.length];

  const res = http.post(`${BASE_URL}/api/student/tests/${TEST_ID}/start`, null, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    tags: { name: 'start' },
  });

  startDuration.add(res.timings.duration);
  startFailures.add(res.status !== 200);

  check(res, {
    'start returned 200': (r) => r.status === 200,
    'paper came back': (r) => {
      try {
        return (r.json('sections') || []).length > 0;
      } catch (e) {
        return false;
      }
    },
  });
}
