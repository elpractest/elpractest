# Phase 3B — Integration Notes

I don't have access to your actual repo in this session (only the plan doc), so
the files above are complete and ready to drop in, but the six files below need
a *human* (or Claude Code, which can see your repo) to merge these snippets in
— I don't want to guess-rewrite files I've never seen.

Also flagged inline as `ASSUMPTIONS` comments in the new files: exact column
names on `payments`/`enrollments` (`user_id` vs `student_id`, etc.) and how
`payment_gateway_enabled` is actually read. Grep for `ASSUMPTIONS` and true them
up against your schema before running the tests.

---

## 1. Composer

```bash
cd api
composer require razorpay/razorpay
```

## 2. `api/app/Models/Batch.php`

```php
protected $fillable = [
    // ...existing fields...
    'price_paise',
];

public function getPriceInRupeesAttribute(): ?float
{
    return $this->price_paise === null ? null : $this->price_paise / 100;
}
```

## 3. `api/routes/api.php`

Inside the `auth:sanctum` + `role:student` group:

```php
Route::post('checkout/create-order', [\App\Http\Controllers\Student\PaymentController::class, 'createOrder']);
Route::post('checkout/verify', [\App\Http\Controllers\Student\PaymentController::class, 'verifyPayment']);
Route::post('checkout/validate-coupon', [\App\Http\Controllers\Student\PaymentController::class, 'validateCoupon']);
```

Inside the `admin|super-admin` group:

```php
Route::get('payments', [\App\Http\Controllers\Admin\PaymentHistoryController::class, 'index']);
```

Outside all auth/CSRF groups (top level of the file):

```php
// Razorpay webhook — must be outside auth and CSRF
Route::post('/webhooks/razorpay', [\App\Http\Controllers\Webhook\RazorpayWebhookController::class, 'handle']);
```

## 4. `api/app/Http/Controllers/Admin/BatchController.php`

Add to the validation rules in `store()` and `update()`:

```php
'price_paise' => ['nullable', 'integer', 'min:0'],
```

## 5. `app/index.html`

Before the closing `</body>`:

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

## 6. `app/src/pages/Dashboard.jsx`

Add a "Browse Courses" section, shown only when `payment_gateway_enabled` is
true, listing published courses the student isn't enrolled in. Each batch card
needs a price + an "Enroll" button that opens `StudentCheckout`:

```jsx
import StudentCheckout from "./StudentCheckout";
// ...
const [checkoutBatch, setCheckoutBatch] = useState(null);
// ...
<button onClick={() => setCheckoutBatch(batch)}>Enroll — {formatRupees(batch.price_paise)}</button>
// ...
{checkoutBatch && (
  <StudentCheckout
    batch={checkoutBatch}
    onClose={() => setCheckoutBatch(null)}
    onEnrolled={() => { setCheckoutBatch(null); refreshCourses(); }}
  />
)}
```

## 7. `app/src/pages/AdminEnrollments.jsx`

- Add a "Payment History" tab that calls `GET /api/admin/payments` and renders
  status badges (`created` / `paid` / `failed` / `refunded`), amount (rupees),
  and coupon code if present.
- Add a "Price (₹)" field to the batch create/edit form; convert on
  submit/display with `price_paise / 100` and `Math.round(rupees * 100)`.

---

## What's still genuinely open

- **Coupon creation**: no admin UI this phase, per your call — codes go in via
  tinker/seeder for now.
- **Refunds**: no refund-initiation endpoint this phase — a refund issued from
  the Razorpay dashboard will still correctly flip local `Payment.status` and
  deactivate the enrollment via the `refund.processed` webhook handler above.
- **Enrollment model / Coupon model exact columns**: written to match the plan
  doc's spec (`isValid()`, `calculateDiscount()`, `times_used`, etc.) — quick
  find-and-replace if actual names differ.
