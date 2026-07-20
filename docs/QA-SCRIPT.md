# Practest — End-to-End Manual QA Script

This script defines the official pre-launch and post-deployment manual acceptance testing checklist for **e-Learning Practest** (Laravel 11 API + React SPA + Astro site).

Execute all steps in order on local dev or staging/production environments.

---

## Pre-requisites & Environment Setup

- [ ] Local server running: `cd api; php artisan serve` (http://localhost:8000)
- [ ] React SPA running: `cd app; npm run dev` (http://localhost:3000)
- [ ] Astro Public Site running: `cd web; npm run dev` (http://localhost:4321)
- [ ] Log destination monitored: `api/storage/logs/laravel.log` (for email links & OTPs in dev mode)

---

## 1. Public Marketing Site (Astro)

- [ ] **1.1 Home Page (`/`)**: Verify Hero section, exam category cards (SSC, Banking, UPSC, Railway, State PCS), CTA buttons ("Browse Courses", "Student Portal").
- [ ] **1.2 Courses Listing (`/courses`)**: Verify course grid renders published courses and active batches with prices.
- [ ] **1.3 Course Detail Page (`/courses/[slug]`)**: Verify syllabus outline, FAQ accordion, CTA "Login to Request Activation", and check HTML source for `Course` & `FAQPage` schema.org JSON-LD tags.
- [ ] **1.4 About Us Page (`/about`)**: Verify mission, vision, trust signals, and navigation links.
- [ ] **1.5 Contact Us Page (`/contact`)**: Submit name, email, phone, message. Verify successful submission message and DB record in `contact_messages`.
- [ ] **1.6 SEO & Sitemap**: Verify `<link rel="canonical">` points to `https://www.pactest.live/page`, and `https://www.pactest.live/sitemap-index.xml` is accessible.

---

## 2. Student Onboarding & Auth Flow (React SPA)

- [ ] **2.1 Registration (`/register`)**:
  - Submit registration with Name, Email, Password, and Password Confirmation.
  - Verify 422 error when email is duplicate ("An account with this email already exists.").
  - Verify 422 error when password does not meet min 8 chars mixed case + numbers.
  - Submit valid registration → land on "Check Your Inbox" screen.
- [ ] **2.2 Email Verification**:
  - Open `api/storage/logs/laravel.log` and copy the verification link (`/verify-email?id=X&hash=Y`).
  - Open link in browser → verify "Email Verified!" page renders and XHR calls API successfully.
- [ ] **2.3 Login (`/login`)**:
  - Attempt login with unverified email (if any) → verify 403 response "Please verify your email address before logging in."
  - Log in with verified credentials → verify successful redirect to `/dashboard`.
- [ ] **2.4 Password Reset Flow**:
  - Go to `/forgot-password`, enter email, click "Send Reset Link".
  - Verify enumeration-safe message ("If an account exists...").
  - Check `laravel.log` for reset link (`/reset-password?token=X&email=Y`).
  - Open link, enter new password → verify successful password update and log in with new password.
- [ ] **2.5 Mobile OTP Verification (`/verify-otp`)**:
  - Verify top amber banner on `/dashboard`: "⚠️ Your phone number is unverified."
  - Click "Verify Phone Now" -> auto-sends 6-digit OTP (check `laravel.log` for `MSG91 OTP [DEV MODE]`).
  - Enter wrong OTP → verify 422 "Invalid or expired OTP."
  - Enter correct 6-digit OTP → verify success message and `phone_verified: true` flag update on user profile.

---

## 3. Course Activation & LMS Flow

- [ ] **3.1 Phone Gate Enforcement**:
  - Create a test account with unverified phone. Try submitting an activation request -> verify 403 "Please verify your phone number first."
- [ ] **3.2 Activation Request Submission**:
  - Log in as phone-verified student. Click "Request Activation / Redeem Code".
  - Select Batch, enter UTR payment reference, attach proof document (JPG/PNG/PDF ≤ 4MB).
  - Submit request → verify pending status chip appears on Dashboard.
- [ ] **3.3 Admin Approval & Code Generation**:
  - Log in as Admin (`thevinstitution@gmail.com` or seeded admin) with TOTP 2FA.
  - Navigate to Admin Dashboard -> Activation Requests -> view proof file -> click "Approve".
  - Or generate an 8-character bulk activation code under "Activation Codes".
- [ ] **3.4 Code Redemption**:
  - Log in as Student -> click "Request Activation / Redeem Code" -> "Redeem Activation Code" tab.
  - Enter 8-char code -> click Redeem -> verify instant course enrollment and unlocked dashboard access.
- [ ] **3.5 Course Outline & LMS Video Player**:
  - Click "Course Outline" on enrolled course card (`/courses/[id]/outline`).
  - Verify module tree, syllabus items, lesson duration, and completion checkboxes.
  - Click a video lesson (`/lessons/[id]`).
  - Verify `youtube-nocookie.com` embed plays, progress is posted every ~15 seconds, and watched seconds persist on refresh.
  - Verify lesson marks as completed once 90% watched threshold is reached.

---

## 4. Computer-Based Test Engine (CBT)

- [ ] **4.1 Available Tests**:
  - Verify enrolled courses show assigned mock tests with duration, total marks, and attempt counters.
- [ ] **4.2 Test Taking Experience (`/tests/[session]`)**:
  - Click "Start Exam" -> verify timer countdown (server-authoritative time remaining).
  - Verify Question Palette (Not Visited / Not Answered / Answered / Marked for Review / Answered & Marked for Review).
  - Select MCQ option -> verify instant debounced autosave.
  - Mark for review -> verify purple status on palette.
  - In sectional timing mode: verify switching sections before section timer expiry is restricted.
- [ ] **4.3 Auto-Submit at Expiry**:
  - Let test timer reach 0:00 (or run `php artisan test:auto-submit`).
  - Verify session automatically submits, locks writes, and dispatches queued analytics job `ComputeTestAnalytics`.
- [ ] **4.4 Results & Analytics (`/tests/[session]/result`)**:
  - Verify score, accuracy percentage, time taken per question, and question-by-question explanation key.
  - Verify batch-scoped percentile and rank calculation.
- [ ] **4.5 Results History (`/results`)**:
  - Navigate to `/results` -> verify past completed mock attempts listed with scores, accuracy %, rank, percentile, and direct link to full analysis.

---

## 5. Security, Resilience & Cross-Origin Check

- [ ] **5.1 Sanctum CORS / Stateful Domain Check**:
  - Access SPA directly from external origin without proxy -> verify `GET /sanctum/csrf-cookie` sets `XSRF-TOKEN` cookie and credentialed XHR calls succeed.
- [ ] **5.2 Rate Limiting**:
  - Attempt 6 consecutive invalid login requests -> verify 429 Too Many Requests response.
  - Attempt 4 consecutive OTP send requests within 10 min -> verify 429 response.
- [ ] **5.3 Network Drop / Autosave Recovery**:
  - Disconnect network during test taking -> answer selection queues or fails gracefully -> reconnect network -> resume session restores exact answered/visited palette state.

---

## Verification Sign-Off

| Tester Name | Role | Date | Pass / Fail | Notes |
|---|---|---|---|---|
| | Lead QA | | | |
| | Developer | | | |
