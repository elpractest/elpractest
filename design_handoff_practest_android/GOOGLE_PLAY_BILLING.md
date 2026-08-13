# Store tab → Google Play Billing

The Store tab is now a real storefront wired to `/student/purchasable-courses`
and transacting through **Google Play Billing**. The code is complete across the
app, the API and the DB, but it is **inert by design** until you create the two
things only you can create in Google's consoles. Until then the Store tab shows
the same "use an activation code" message the old stub did — it never fakes a
sale.

## What was built

**App (`e-Learning_Practest Android app/`)**
- `lib/screens/store_screen.dart` — the storefront. Lists purchasable courses,
  shows Play's own localized price, Buy → Play Billing. Degrades to the
  activation-code message when billing is unavailable or no products resolve.
- `lib/purchase_service.dart` — the `in_app_purchase` client. Buy → Play token →
  **server verify** → only then complete the purchase and grant. Idempotent,
  handles pending/restore/cancel/error.
- `in_app_purchase` added to `pubspec.yaml`; `Batch.playProductId` added to the model.
- `lib/shell.dart` — Store tab now renders `StoreScreen` (the stub is deleted).

**API (`api/`)**
- `POST /student/checkout/google-play/verify` (`GooglePlayController`) — validates
  the purchase token against the Play Developer API, grants the **same** enrolment
  the Razorpay path grants, then acknowledges the purchase. Idempotent on the token.
- `App\Services\GooglePlayVerifier` — dependency-free service-account OAuth2
  (RS256 JWT via `openssl_sign`) + Play Developer API calls over Laravel's HTTP
  client. No composer install required.
- `config/googleplay.php` — package name + service-account credentials.
- Migrations: `play_product_id` on `batches`; `google_play_*` columns on `payments`.

## What YOU must do to switch it on

1. **Run the migrations** on the API host:
   ```bash
   php artisan migrate
   ```
2. **Create managed products in the Google Play Console** (Monetize → Products →
   In-app products), one per purchasable batch. Note each **product ID**.
3. **Map each batch to its product ID** — set `batches.play_product_id` to the
   Console product ID (via the admin UI once a field is added, or directly:
   `UPDATE batches SET play_product_id = '...' WHERE id = ...`). A batch with no
   product id simply is not offered in the store.
4. **Create a Google service account** with Play Developer API access
   (Play Console → Setup → API access), grant it the "View financial data" /
   "Manage orders" permissions, download the JSON key, and point the API at it:
   ```
   GOOGLE_PLAY_PACKAGE_NAME=com.practest.practest_app
   GOOGLE_PLAY_SERVICE_ACCOUNT_PATH=/secure/path/service-account.json
   # or, inline:
   # GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={...}
   ```
   With neither set, `verify` answers 503 and the store stays inert.
5. **Upload a signed AAB to an internal testing track** and add license-test
   accounts. Play Billing cannot be exercised on a debug build or an emulator
   without the Play Store — real purchases only flow on a track build.

## Notes / decisions

- **Razorpay is untouched.** It stays for the web / non-Play builds. On a Play
  build digital goods must use Play Billing (Play policy) — that is why this
  replaces the store's rail rather than sitting beside it.
- **Prices come from the Play Console, not the DB.** The store shows Play's
  localized price; the DB `price_paise` is only a pre-load fallback label.
  Coupons (`validate-coupon`) do **not** apply to the Play rail — use Play's own
  promo codes / offers.
- **Nothing is trusted client-side.** Enrolment is granted only after the server
  validates the token. A failed verify leaves the purchase pending so Play
  redelivers it and the idempotent verify retries — money is never lost.
- **Not testable here.** No Play Store on the dev emulator; verify against an
  internal-testing track build with a license-test account.
