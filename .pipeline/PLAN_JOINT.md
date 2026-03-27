# HouseholdOS — PLAN_JOINT (Definitive)
**Authors:** plan-manager-claude + plan-manager-openai (synthesised)  
**Date:** 2026-03-28  
**Status:** AWAITING_SHAUN_APPROVAL  
**Debate Rounds:** 3 rounds · 29 issues resolved · 12 primary disagreements · 17 gap findings

---

## HEADER STATS

| Dimension | Count |
|-----------|-------|
| Phase 1 modules | 7 (of 25 total) |
| Phase 1 screens (web) | 42 |
| Phase 1 screens (mobile) | 14 |
| Phase 1 API endpoints | 58 |
| Database tables (Phase 1) | 19 |
| Edge cases resolved | 29 (20 Claude + 15 OpenAI, deduplicated) |
| Debate disagreements resolved | 12 primary + 17 gaps |
| SA-specific considerations | 13 |
| Onboarding target (P75) | < 5 minutes to first AI answer |

---

## 1. PHASE 1 SCOPE — MODULES 1–7

### MODULE 1: Document Intelligence Hub
**Purpose:** Core document storage, OCR, extraction, embedding, and per-document Q&A.

Key deliverables:
- Two-step signed URL upload (GET url → PUT to Storage → POST confirm) with TUS resumable protocol
- Per-page hybrid OCR: text density check per page; digital text extraction where available, Claude Vision where scanned; single Vision pass for pure image files
- Claude Opus 4.5 extraction: type detection, structured JSON output (dates, amounts, parties, policy/account numbers), Zod validation
- `text-embedding-3-small` embedding on `ocr_text[:8000] + extracted_data` → stored as `vector(1536)` in `documents.embedding`
- Confidence scoring (heuristic: OCR length vs file size, key field presence, garbled char ratio); < 50 = error; 50–70 = ready with review flag
- Per-document Q&A via Claude Sonnet 4.5 streaming (SSE), persisted to `document_qa_sessions` + `document_qa_messages`
- Server-side MIME type magic byte validation on confirm endpoint (blocks spoofed files)
- Password-protected PDF: detect → prompt user → in-memory decrypt (never stored) → re-process
- Soft delete only; nightly cleanup of stuck `uploading` rows after 24h
- Realtime subscription on `documents` channel → live status updates (uploading → processing → ready)
- Duplicate detection: SHA-256 hash at upload time (client-side via Web Crypto API); post-processing text similarity for concurrent uploads

### MODULE 2: Dedicated Inbox System
**Purpose:** Dedicated email addresses per household; automated statement and attachment ingestion via Postmark.

Key deliverables:
- Postmark inbound webhooks: HMAC-SHA256 verification, silent discard for inactive addresses, idempotency on `external_message_id`
- Inbox addresses: auto-generated as `{label-slug}@inbound.householdos.co.za`; tier-limited (5 Essential, 20 Household, unlimited Premium)
- Bank statement parser: 6 SA banks (ABSA, FNB, Standard, Nedbank, Capitec, Discovery); multi-signal bank detection (sender domain + account prefix + visual)
- Transaction normalisation: descriptions lowercased, branch codes stripped, reference numbers removed → normalised for dedup constraint
- Anomaly detection: new debit orders (not seen in 3 months), amount change >20%, unusual merchant (>R5k not in household history); uses Levenshtein distance for description matching
- Parsed data → `budget_transactions` with `ON CONFLICT DO NOTHING` on `(household_id, normalized_description, transaction_date, amount)`
- Inline Q&A on inbox messages (same streaming pattern as Module 1)
- Change detection on utility bills: >10% variance triggers `notifications` insert

### MODULE 3: Warranties and Receipts Vault
**Purpose:** Receipt capture, OCR extraction, automatic warranty tracking, expiry alerts.

Key deliverables:
- Receipt OCR via Claude Opus 4.5: retailer, purchase_date, total_amount (ZAR cents), line items, warranty candidates
- Warranty expiry computed server-side in SQL only: `purchase_date + ($months || ' months')::interval` — NEVER in JavaScript
- SA CPA minimum 6 months warranty as fallback when OCR returns 0 months
- Expiry alert CRON (daily 06:00 UTC): stages at 90d (in-app), 30d (push + in-app), 7d (push + email), 1d (push + email + HITL claim proposal)
- HITL warranty claim: inserts `hitl_actions (type='warranty_claim')`, returns `action_id` to client
- Transaction matching: `budget_transactions` fuzzy match by date ±3 days, amount ±R2 (Household tier+)
- `alert_sent` boolean Phase 1 — Phase 2 migrates to `alerts_sent_at[]` array for multi-stage tracking
- Notification + alert_sent update wrapped in a single transaction (prevents duplicate alerts on job restart)
- `UNIQUE (household_id, type, reference_id, DATE(created_at))` constraint on `notifications`

### MODULE 4: Basic Budget Tracking
**Purpose:** Transaction list, monthly summaries, AI categorisation, subscription detection.

Key deliverables:
- `budget_summaries` as materialised cache; recalculated on EVERY mutating event (statement ingested, transaction added/edited/deleted/re-categorised) — NOT batch-only
- Nightly CRON at 03:00 UTC reconciles ALL prior-month summaries (catches silently-failed event-driven jobs)
- AI categorisation: single Claude Haiku 3.5 batch call for up to 100 uncategorised transactions; SA merchant patterns hardcoded in prompt (Checkers, Pick n Pay, Dis-Chem, City of Johannesburg, etc.)
- Subscription detection: transactions matching same normalised description ±5 days, ±10% amount, recurring ≥3 months
- Month navigation with prior-month comparison (`expense_delta`, `income_delta`)
- Budget export PDF via `@react-pdf/renderer` (Household tier+)
- Custom budget categories (Premium tier+)
- `budget_transactions` soft delete: `deleted_at` timestamp — prevents re-import ghosts

### MODULE 5: Web App (Next.js 14 PWA)
**Purpose:** Full web application using Next.js 14 App Router with PWA capabilities.

Key deliverables:
- Route groups: `(marketing)` public, `(auth)` auth flows, `(app)` protected app
- AppLayout: responsive sidebar (desktop) + bottom tabs (mobile); `HouseholdSwitcher` in top bar
- `next-pwa` service worker: NetworkFirst for API, CacheFirst for assets, StaleWhileRevalidate for pages; offline banner
- Realtime subscriptions initialised in AppLayout: `documents`, `receipts`, `notifications`, `hitl_actions` channels
- Locked module placeholders for Phase 2/3 routes (shows `ComingSoonCard` with tier + upgrade CTA)
- Global Error Boundary → Sentry capture; no blank screens
- Session expiry: middleware redirects to `/auth/login?returnTo={path}`
- React Query `queryClient` at root; Supabase Realtime events call `queryClient.invalidateQueries(...)` (no dual-store patching)
- Shared TypeScript types package (`packages/api-types/`) — auto-generated via `openapi-typescript` from route definitions; CI fails on signature drift

### MODULE 6: Mobile App (React Native Expo)
**Purpose:** Native iOS/Android app with camera capture, push notifications, offline queue.

Key deliverables:
- Expo Router v3 file-based routing; identical API endpoints as web (no mobile-specific routes)
- Camera: `expo-camera` with document guide overlay; blur detection before upload; compression to 1500px / 85% JPEG; 150dpi minimum check
- Multi-page capture: separate pages uploaded, merged into single `documents` row server-side
- TUS resumable upload: critical for iOS background suspension; `expo-background-fetch` for upload queue processing
- Push tokens: `expo-notifications` registration; `DeviceNotRegistered` error → delete token from `user_preferences`
- Biometric auth on app foreground: FaceID/TouchID via `expo-local-authentication`
- Offline queue: Zustand `persist` + AsyncStorage; `NetInfo` listener triggers `processQueue()` on reconnect
- Shared `useOfflineQueue` store with queued action retry on reconnect (NOT WatermelonDB — Phase 2 consideration only)
- Bottom tab navigation: Home · Chat · Capture · Notifications · Profile

### MODULE 7: Onboarding Flow
**Purpose:** Zero-friction path from signup to first AI answer in < 5 minutes.

Key deliverables:
- No email verification gate before onboarding; verification sent async, 14-day window to confirm; unverified at day 21 → read-only restriction
- Auto-create household (`${first_name}'s Household`), 14-day Household trial, `users` row, `subscriptions` row — all in one atomic server action
- POPIA consent screen: explicit checkboxes (a) process financial documents, (b) store email attachments, (c) use AI for extraction; `users.popia_consent_at` timestamp; WITHOUT consent, inbox parser MUST NOT process attachments
- 5-step wizard: Household Profile → Subscription (skip allowed) → First Document Upload → First Q&A → Complete
- Suggested questions per detected document type (3 pre-populated); streaming response starts within 3s of question
- `user_metrics (user_id, signup_at, first_upload_at, first_answer_at, time_to_value_secs)` — explicit onboarding KPI measurement
- Nudge schedule: Day 2 (inbox), Day 4 (receipt), Day 7 (Q&A reminder), Day 11 (trial warning), Day 13 (trial warning), Day 14 (trial end)
- Onboarding progress: `user_preferences (key='onboarding_progress')` as server-side source of truth; Zustand `useOnboardingStore` as optimistic cache

---

## 2. IMPLEMENTATION ORDER

Build tiers respect hard dependency chains. Do not start a tier until its prerequisites are complete.

### Tier 0 — Infrastructure (no internal dependencies)
1. Supabase project init: enable Auth (email + Google), configure JWT settings, SMTP
2. Database schema migrations — all 19 tables in FK-dependency order; add `global_chat_messages`, `user_metrics` tables
3. RLS policies on every table — verify with test users before any API work
4. Storage buckets: `documents`, `receipts`, `inbox-attachments`, `exports` — with RLS
5. Supabase Auth Hook Edge Function (`auth-claims-hook`): inject `household_id`, `role`, `subscription_tier` into JWT
6. Postmark inbound webhook: deploy Edge Function; configure inbound route to function URL
7. `vercel.json` cron definitions: warranty alert (daily 06:00 UTC), budget reconciliation (daily 03:00 UTC), orphaned upload cleanup (daily 02:00 UTC)

### Tier 1 — Auth & Household Core
_Depends on: Tier 0_

8. Next.js scaffold: App Router, Tailwind CSS, shadcn/ui, `@supabase/ssr`, React Query `QueryClientProvider`, Zustand
9. Auth flows: signup (email/password + Google OAuth), login, magic link toggle, `/auth/callback`, middleware session protection
10. POPIA consent capture during signup — `users.popia_consent_at` required before proceeding
11. Household creation: auto-create on signup; edit name; municipality constrained autocomplete (257 official SA codes only)
12. Member management: invite by email (pending invite flow), role assignment (primary/secondary/view_only), remove member with `supabase.auth.admin.signOut(userId, 'others')`
13. `HouseholdSwitcher` component + `POST /api/household/switch` endpoint (reads `user_preferences.active_household_id`)
14. Household slug: slugify on creation; 3-attempt retry loop with 4-digit random suffix on collision

### Tier 2 — Document Pipeline Core
_Depends on: Tier 0, Tier 1_

15. Two-step upload UI: dropzone + file picker; client-side SHA-256 duplicate check; `POST /api/documents/upload-url` → TUS upload to Storage → `POST /api/documents/confirm`
16. Server-side MIME type magic byte validation on confirm endpoint; reject with 415 + Storage delete
17. Background OCR job: per-page hybrid text extraction; Claude Opus 4.5 Vision call; Zod validation; confidence scoring
18. Embedding generation: `text-embedding-3-small` via OpenAI; store `vector(1536)` in `documents.embedding`
19. Document Library UI: grid/list, filter, search (FTS on `ocr_text`), processing status via Realtime subscription
20. Document Detail: PDF.js viewer with page navigation; `ExtractionCard`; per-document Q&A streaming chat
21. Password-protected PDF handling: detect → UI prompt → in-memory decrypt → re-process → NEVER store password

### Tier 3 — Specialist Parsers
_Depends on: Tier 2_

22. Bank statement parser: 6 SA bank formats; multi-signal detection; transaction normalisation; dedup constraint
23. Receipt parser: line items, VAT handling, warranty candidate detection, SA CPA 6-month fallback
24. Utility bill parser: municipality-aware extraction; amount due, consumption, due date, estimated vs actual reading flag
25. Insurance policy parser: Discovery, Momentum, OUTsurance, Santam; policy number, sum insured, excess, renewal date
26. Anomaly detection engine: new debit orders, amount change >20%, unusual merchants; Levenshtein description matching

### Tier 4 — Derived Features
_Depends on: Tier 3_

27. Warranty tracker: create from receipt OCR; manual entry; expiry timeline; alert CRON with transactional notify + update
28. Budget: transaction list, monthly summary, AI categorisation (Haiku batch), event-driven recalc + nightly CRON reconcile
29. Inbox: address management; Postmark webhook processing; statement → budget transaction pipeline; change detection
30. Global chat: `global_chat_messages` table (no embeddings Phase 1); Haiku routing → Sonnet response; SSE streaming; context window management (last 20 messages + summary of older)
31. Hybrid search endpoint: `GET /api/search?query=`; Supabase `hybrid_search` RPC (vector 0.7 + FTS 0.3 weighted fusion)

### Tier 5 — Subscriptions, Limits, Notifications
_Depends on: Tier 1, Tier 2_

32. Stripe integration: checkout session, webhook handler (`checkout.session.completed`, `subscription.updated`, `subscription.deleted`, `invoice.payment_failed`, `customer.subscription.trial_will_end`)
33. `TIER_LIMITS` constant + enforcement middleware: document count, inbox addresses, AI interactions per month, members, storage
34. Trial expiry: Day 11 + Day 13 + Day 14 reminder emails/push; trial end → downgrade to Essential if no payment
35. Downgrade UX: show count + list of impacted documents; never auto-delete; read-only enforcement until under limit
36. Notification centre: in-app bell, unread count, mark-read; push notifications via Expo Push; email via Postmark Send

### Tier 6 — Onboarding, Mobile, PWA Polish
_Depends on: Tier 1–5_

37. Onboarding wizard: 5 steps, POPIA consent gate, `user_metrics` recording, nudge schedule
38. Expo mobile app: camera capture, TUS upload, Zustand offline queue, push registration, biometric auth
39. PWA: `next-pwa` service worker, install prompt post-first-document, offline banner
40. OpenAPI-generated TypeScript SDK (`packages/api-types/`); CI validation

---

## 3. ONBOARDING FLOW

### Critical Path: Zero → First AI Answer in < 5 Minutes

```
T+0:00  householdos.co.za landing page
        → CTA: "Start free — no credit card needed"

T+0:15  /auth/signup
        → Email + password OR Google OAuth
        → Terms of Service checkbox
        → POPIA consent (3 explicit checkboxes — required to proceed)
        → "Create account"

T+0:30  Server creates atomically:
        → Supabase Auth user
        → households (name="${first_name}'s Household", slug with collision retry)
        → users (role='primary', popia_consent_at=now())
        → subscriptions (tier='household', status='trialing', trial_end=now()+14d)
        → Verification email sent (NON-BLOCKING — user proceeds immediately)
        → Redirect to /onboarding/household

T+0:45  /onboarding/household
        → Household name (pre-filled, editable)
        → Primary bank (optional dropdown: ABSA, FNB, Standard, Nedbank, Capitec, Discovery)
        → Municipality (constrained autocomplete over 257 official SA codes — no free text)
        → "Continue" — skip allowed (2/3 fields optional)
        → PATCH /api/household

T+1:00  /onboarding/subscription
        → "14-day Household trial active — no card needed" banner
        → Pricing comparison (below fold)
        → Primary CTA: "Upload your first document →"
        → Secondary: "Remind me later"
        → 60% expected skip rate

T+1:15  /onboarding/first-document
        → Full-screen dropzone: PDF, JPG, PNG, HEIC up to 50MB
        → Examples: Insurance policy · Lease · Municipal bill · Bank statement
        → Mobile: "Take a photo" (routes to native camera)
        → On upload: progress bar + "We're reading your document..." animation
        → OCR runs immediately in background

T+1:45  OCR completes (target < 30s for 2-page PDF)
        → Document type detected
        → 3 suggested questions shown, type-appropriate:
          Insurance: "What is my sum insured?" / "When does my policy expire?" / "What is my excess?"
          Lease:     "What is my notice period?" / "What is the deposit?" / "Who is the managing agent?"
          Statement: "What is my closing balance?" / "Top spending categories?" / "Any new debit orders?"
          Other:     "Summarise this document" / "What are the key dates?" / "Who are the parties?"

T+2:00  User selects question or types their own
        → POST /api/documents/[id]/qa
        → Streaming begins; first token < 3s (Haiku routing 500ms + context 200ms + Sonnet 1s)

T+2:30  Answer streams in with FSCA disclaimer for financial/legal content
        ← THIS IS THE FIRST VALUE MOMENT — record in user_metrics.first_answer_at

T+3:00  /onboarding/complete
        → "Your household is ready!" animation
        → Next steps cards:
          1. "Set up your email inbox" → /inbox/addresses/new
          2. "Upload a receipt" → /receipts/upload
          3. "Invite your partner" → /settings/members/invite
        → NPS prompt: 0–10 scale

P75 target: 5 minutes achievable. Key removes: no email gate, auto-created household,
trial at full tier, suggested questions, streaming response.
```

---

## 4. SCREEN INVENTORY

### Authentication & Onboarding

| Route | Layout | Key Components |
|-------|--------|----------------|
| `/` | MarketingLayout | HeroSection, FeatureGrid, PricingTable, CTAButton |
| `/auth/signup` | AuthLayout | SignupForm, GoogleOAuthButton, POPIAConsentCheckboxes, TOSCheckbox |
| `/auth/verify` | AuthLayout | VerificationPending, ResendEmailButton |
| `/auth/login` | AuthLayout | LoginForm, GoogleOAuthButton, MagicLinkToggle |
| `/auth/callback` | None (server redirect) | — OAuth + magic link token exchange |
| `/onboarding` | OnboardingLayout | StepIndicator (5 steps), ProgressBar |
| `/onboarding/household` | OnboardingLayout | HouseholdNameInput, BankSelector, MunicipalityAutocomplete |
| `/onboarding/subscription` | OnboardingLayout | PricingCards, TrialBadge, UploadCTA |
| `/onboarding/first-document` | OnboardingLayout | DocumentUploadDropzone, CameraShortcut (mobile) |
| `/onboarding/first-qa` | OnboardingLayout | DocumentPreviewCard, SuggestedQuestions (3), ChatInput |
| `/onboarding/complete` | OnboardingLayout | SuccessAnimation, NextStepsCards, NPSPrompt |

### App (Protected)

| Route | Layout | Key Components |
|-------|--------|----------------|
| `/dashboard` | AppLayout | RecentActivityFeed, QuickUploadFAB, ActiveWarningsBanner, HouseholdSummaryCard |
| `/documents` | AppLayout | DocumentGrid, FilterBar, SearchBar, QuotaBanner, UploadFAB |
| `/documents/upload` | AppLayout (modal) | UploadDropzone, FileTypeGuide, ProgressBar, DuplicateWarning |
| `/documents/[id]` | DocumentDetailLayout | PDFViewer (PDF.js), ExtractionCard, QAChat, DocumentMetaPanel |
| `/documents/[id]/edit` | AppLayout | DocumentMetaForm (name, type, tags) |
| `/documents/trash` | AppLayout | TrashList, BulkRestoreButton |
| `/inbox` | AppLayout | InboxAddressList, InboxMessageFeed, InboxFilterBar |
| `/inbox/addresses` | AppLayout | AddressList, CreateAddressModal |
| `/inbox/addresses/new` | AppLayout (modal) | CreateAddressForm, EmailPreviewCard, SetupInstructions |
| `/inbox/messages/[id]` | AppLayout | EmailViewer, ParsedDataPanel, AttachmentList, AnomalyAlertBanner |
| `/receipts` | AppLayout | ReceiptGrid, WarrantyDashboard, ExpiryTimeline (90-day horizon), UploadFAB |
| `/receipts/upload` | AppLayout (modal) | ReceiptCaptureOrUpload, OCRProgressIndicator, ExtractedDataReview |
| `/receipts/[id]` | AppLayout | ReceiptDetailCard, ItemsList, MatchedTransactionBadge |
| `/receipts/[id]/warranty/new` | AppLayout (modal) | WarrantyForm (product, months, expiry preview) |
| `/warranties` | AppLayout | WarrantyList, ExpiryFilter (all/expiring/expired), SortControls |
| `/warranties/[id]` | AppLayout | WarrantyDetailCard, LinkedReceiptCard, ClaimHITLPanel, AlertHistory |
| `/budget` | AppLayout | MonthSummaryCard, SpendingDonutChart, CategoryBreakdown, MonthNavigator |
| `/budget/transactions` | AppLayout | TransactionList, CategoryFilter, SearchBar |
| `/budget/transactions/add` | AppLayout (modal) | ManualTransactionForm |
| `/budget/subscriptions` | AppLayout | SubscriptionList, TotalMonthlyBadge |
| `/budget/[year]/[month]` | AppLayout | Historical month view (same components) |
| `/chat` | AppLayout | ChatThread, MessageInput, ModuleContextBadge, SuggestedFollowUps |
| `/search` | AppLayout | HybridSearchResults, DocumentCitations |
| `/notifications` | AppLayout | NotificationList, MarkAllRead, FilterByType |
| `/settings` | AppLayout | SettingsNav |
| `/settings/household` | AppLayout | HouseholdForm, MunicipalityAutocomplete |
| `/settings/members` | AppLayout | MemberList, InviteForm, RemoveMemberDialog |
| `/settings/billing` | AppLayout | CurrentPlanCard, UsageMeters, UpgradeButton, InvoiceHistory |
| `/settings/notifications` | AppLayout | NotificationPrefs (email/push per type) |
| `/settings/popia` | AppLayout | POPIAExportButton, DeletionRequestButton, DataResidencyNote |
| `/settings/security` | AppLayout | SessionList, PasswordChange |

### Mobile Screens (Expo Router)

| Screen | Equivalent Web Route |
|--------|---------------------|
| Login / Signup + POPIA consent | `/auth/*` |
| Onboarding wizard | `/onboarding/*` |
| Dashboard (Home tab) | `/dashboard` |
| Documents list + detail | `/documents`, `/documents/[id]` |
| Inbox list + detail | `/inbox`, `/inbox/messages/[id]` |
| Receipts list + detail | `/receipts`, `/receipts/[id]` |
| Capture (smart camera tab) | Mobile-only |
| Budget overview + transactions | `/budget` |
| Chat tab | `/chat` |
| Notifications | `/notifications` |
| Profile + Settings | `/settings` |
| Warranties | `/warranties` |
| Onboarding POPIA gate | `/onboarding/household` |

---

## 5. API ROUTE INVENTORY

### Auth & Household

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/signup` | none | Create user, household, trial subscription, POPIA consent capture |
| POST | `/api/auth/google` | none | Initiate Supabase Google OAuth |
| GET | `/api/auth/callback` | none | Token exchange; create household if first sign-in |
| PUT | `/api/household` | auth | Update household name, primary_bank, municipality_code |
| POST | `/api/household/switch` | auth | Switch active household; update `user_preferences.active_household_id` |
| GET | `/api/household/members` | auth | List household members |
| POST | `/api/household/members/invite` | auth, secondary+ | Send invite email |
| DELETE | `/api/household/members/[id]` | auth, primary | Remove member + `signOut(userId, 'others')` |
| GET | `/api/onboarding/status` | auth | `{current_step, completed_steps, is_complete}` |
| POST | `/api/onboarding/complete` | auth | Record step completion |

### Documents

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/documents` | auth | Paginated list; FTS search on `ocr_text` |
| POST | `/api/documents/upload-url` | auth, quota | Signed URL + INSERT documents(status='uploading') |
| POST | `/api/documents/confirm` | auth | MIME magic byte check; `status='processing'`; enqueue job |
| GET | `/api/documents/[id]` | auth, RLS | Detail + signed file URL |
| GET | `/api/documents/[id]/signed-url` | auth | Refresh signed URL (1h TTL) |
| PATCH | `/api/documents/[id]` | auth, secondary+ | Update filename, tags, extracted_data corrections |
| DELETE | `/api/documents/[id]` | auth, primary | Soft delete (`status='deleted'`, `deleted_at`) |
| POST | `/api/documents/[id]/qa` | auth, quota | Streaming Q&A; persist to qa_sessions + qa_messages |
| GET | `/api/documents/[id]/qa/sessions` | auth | Q&A session history |
| GET | `/api/documents/[id]/qa/[sessionId]` | auth | Q&A message history |
| POST | `/api/search` | auth | Hybrid vector+FTS search via `hybrid_search` RPC |
| GET | `/api/documents/count` | auth | Count for tier limit display |

### Inbox

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/inbox/addresses` | auth | List inbox addresses |
| POST | `/api/inbox/addresses` | auth, secondary+, tier | Register Postmark route; INSERT inbox_addresses |
| PATCH | `/api/inbox/addresses/[id]` | auth, secondary+ | Update label, is_active |
| DELETE | `/api/inbox/addresses/[id]` | auth, primary | Deactivate Postmark route |
| GET | `/api/inbox/messages` | auth | Paginated message list with address context |
| GET | `/api/inbox/messages/[id]` | auth | Full message + parsed_data + attachments |
| GET | `/api/inbox/messages/[id]/attachments/[attId]/url` | auth | Signed URL (15min TTL) |
| POST | `/api/webhooks/postmark` | HMAC-sig | Receive inbound email; INSERT inbox_messages + attachments; enqueue parse |
| POST | `/api/inbox/messages/[id]/qa` | auth, quota | Q&A on parsed message content |

### Receipts & Warranties

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/receipts` | auth | Paginated receipts with warranty count |
| POST | `/api/receipts/upload-url` | auth, quota | Signed URL; INSERT receipts(status='uploading') |
| POST | `/api/receipts/confirm` | auth | MIME check; `status='processing'`; enqueue job |
| GET | `/api/receipts/[id]` | auth | Full receipt + warranties + matched transaction |
| PATCH | `/api/receipts/[id]` | auth, secondary+ | Update retailer, purchase_date, total_amount, items |
| DELETE | `/api/receipts/[id]` | auth, primary | Soft delete; cascade to warranties |
| GET | `/api/receipts/[id]/match-transactions` | auth, household+ | Fuzzy match ±3 days, ±R2 |
| GET | `/api/warranties` | auth | Sorted by expiry_date ASC; with days_remaining computed in SQL |
| GET | `/api/warranties/expiring` | auth | Due within 30 days |
| PATCH | `/api/warranties/[id]` | auth, secondary+ | Update product_name, warranty_months; recalculate expiry in SQL |
| POST | `/api/warranties/[id]/claim` | auth, secondary+, household+ | Insert hitl_actions(type='warranty_claim') |

### Budget

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/budget/summary/[month]` | auth | Summary row; compute on-the-fly if missing |
| GET | `/api/budget/transactions` | auth | Filtered list (month, category, search, income/expense) |
| POST | `/api/budget/transactions` | auth, secondary+ | Manual entry; triggers recalculate |
| PATCH | `/api/budget/transactions/[id]` | auth, secondary+ | Update category, description; triggers recalculate |
| DELETE | `/api/budget/transactions/[id]` | auth, secondary+ | Soft delete; triggers recalculate |
| GET | `/api/budget/categories` | auth | System + household categories |
| POST | `/api/budget/categories` | auth, secondary+, premium+ | Custom categories |
| GET | `/api/budget/subscriptions` | auth, household+ | Detected recurring transactions |
| GET | `/api/budget/summary/[month]/export` | auth, household+ | PDF export |

### Chat

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/chat` | auth, quota | Global coordinator: Haiku routing → Sonnet streaming; persist to global_chat_messages |
| GET | `/api/chat/sessions` | auth | List chat sessions |
| GET | `/api/chat/sessions/[id]` | auth | Message history for session |

### Notifications & Billing

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/notifications` | auth | Paginated notification list |
| PATCH | `/api/notifications/[id]/read` | auth | Mark read |
| PATCH | `/api/notifications/read-all` | auth | Mark all read |
| POST | `/api/notifications/register-push-token` | auth | Upsert `user_preferences(key='expo_push_token')` |
| POST | `/api/stripe/create-checkout` | auth | Stripe Checkout session (ZAR) |
| POST | `/api/webhooks/stripe` | sig | Handle subscription events |
| GET | `/api/billing/status` | auth | Current plan + usage summary |

### POPIA & CRON (internal)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/popia/export` | auth | JSON zip of all household data |
| POST | `/api/popia/delete-request` | auth | 24h grace → cascade delete |
| POST | `/api/cron/warranty-expiry-check` | cron-secret | Daily warranty alert job |
| POST | `/api/cron/budget-reconciliation` | cron-secret | Nightly budget_summaries reconcile |
| POST | `/api/cron/cleanup-orphaned-uploads` | cron-secret | Delete stuck uploading rows >24h |
| POST | `/api/internal/process-document` | service | OCR + extraction + embed job |
| POST | `/api/internal/process-receipt` | service | Receipt OCR + warranty creation job |
| POST | `/api/internal/parse-inbox-message` | service | Statement parse + budget insert |
| POST | `/api/internal/categorise-transactions` | service | Haiku batch categorisation |

---

## 6. KEY ARCHITECTURE DECISIONS (from Debate)

### Decision 1: State Management — React Query + Zustand Hybrid
**Winner: OpenAI plan**  
**Resolution:** Two distinct layers with no overlap:
- **React Query** (`@tanstack/react-query`): all server-fetched data (documents, inbox, transactions, warranties, summaries). Provides SWR semantics, automatic background refetch, retry, cache invalidation, devtools.
- **Zustand**: ephemeral UI state only — upload progress, active chat messages (pre-persistence), onboarding wizard steps, notification badge count, Realtime status overlays, offline queue.
- **Integration pattern:** Supabase Realtime events call `queryClient.invalidateQueries(...)` to trigger a refetch; they do NOT manually patch Zustand stores with the same data.
- Tech Lead must never use Zustand as a data-fetching layer.

### Decision 2: Document Upload — Two-Step Signed URL
**Winner: Claude plan**  
**Resolution:** Vercel has a 4.5MB default body limit (100MB on Pro with 60s timeout). Routing large PDFs through Next.js API routes is production-breaking on slow connections. Adopted flow:
1. `POST /api/documents/upload-url` → signed upload URL + documents row (status='uploading')
2. Client: TUS resumable PUT directly to Supabase Storage (bypasses Vercel entirely)
3. `POST /api/documents/confirm` → MIME magic byte validation → enqueue background job
4. OpenAI's multipart/busboy approach is **rejected** — it routes file bytes through the API route.
- TUS protocol added (from OpenAI, via debate) for mobile upload resume on iOS background suspension.

### Decision 3: Chat Persistence — global_chat_messages Phase 1, pgvector Phase 2
**Winner: Hybrid (OpenAI direction + Claude sequencing)**  
**Resolution:**
- Phase 1: `global_chat_messages (id, household_id, user_id, role, content, session_id, created_at)` — NO per-message embeddings yet. Session UUID in localStorage, sent with each request.
- Context window: last 20 messages sent to Claude; if >20, summarise oldest 10 into a system-level "context summary" block.
- Phase 2: add `embedding vector(1536)` column; background job computes embeddings; coordinator injects vector-retrieved memories.
- **Rejected:** Pure localStorage Phase 1 (loses cross-device continuity). **Also rejected:** Full pgvector per-message Phase 1 (expensive at scale).

### Decision 4: Mobile Offline Storage — Zustand + AsyncStorage
**Winner: Claude plan**  
**Resolution:** WatermelonDB adds significant schema migration overhead, model definitions, and sync engine complexity for Phase 1 where offline is graceful degradation, not full offline-first. Zustand `persist` + AsyncStorage is sufficient. WatermelonDB is a Phase 2+ consideration if full offline-first is required.

### Decision 5: Budget Summary Recalculation — Event-Driven Primary + CRON Reconciliation
**Winner: Hybrid**  
**Resolution:**
- **Primary:** Recalculate `budget_summaries` on every mutating event (statement ingested, transaction added/edited/deleted/re-categorised). Ensures real-time accuracy.
- **Secondary:** Nightly CRON at 03:00 UTC recalculates ALL prior-month summaries as a reconciliation pass — catches any silently-failed event jobs.
- **Rejected:** CRON-only (24h stale data after statement ingestion is unacceptable UX).

### Decision 6: Search — Hybrid Vector + FTS Fusion
**Winner: OpenAI plan**  
**Resolution:** Vector-only search fails on exact keyword queries (policy number "JHB-12345" survives string matching but may not survive embedding compression). FTS catches exact matches; vectors catch semantic matches. Combined weighted score gives significantly better recall.
```sql
-- hybrid_search() RPC weights: vector 0.7 + FTS 0.3
combined_score = COALESCE(vector_similarity, 0) * 0.7 + COALESCE(fts_rank, 0) * 0.3
```

### Decision 7: Error Message Column — Dedicated Column
**Winner: OpenAI plan**  
**Resolution:** `documents.error_message TEXT` nullable for human-readable display and ops querying (`WHERE error_message IS NOT NULL`). Structured debug detail remains in `extracted_data->>'error_detail'` JSONB. DBA to add migration if column not already in schema.

### Decision 8: Password-Protected PDFs
**Winner: OpenAI (identified gap in Claude plan)**  
**Resolution:** SA banks (especially Nedbank) deliver password-protected PDFs. When PDF.js fails with password error → `status='needs_password'` → UI prompt → `PATCH /api/documents/[id]/password { password }` → in-memory decrypt using `pdf-lib`/`qpdf` → re-process → password is **NEVER stored or logged**.

### Decision 9: Multi-Language OCR
**Winner: OpenAI (identified gap in Claude plan)**  
**Resolution:** SA municipal bills and insurance documents appear in English and Afrikaans. Claude Vision handles multilingual text natively. Extraction prompt addition (no code changes required):
> "The document may be in English, Afrikaans, or bilingual. Municipal bills from the Western Cape are commonly in Afrikaans. Extract all text regardless of language. Return field values in their original language; field keys (JSON) always in English."

### Decision 10: OpenAPI-Generated TypeScript SDK
**Winner: OpenAI plan**  
**Resolution:** Shared `packages/api-types/` package generated from OpenAPI spec via `openapi-typescript`. Used by both Next.js web app and Expo mobile app. CI check: if route signature changes without SDK regeneration → build fails. This eliminates runtime web/mobile API contract drift. Phase 1 minimum: manually-maintained shared types; auto-generation in Phase 1.1.

### Decision 11: POPIA Compliance — Full Implementation
**Winner: Claude plan (OpenAI missed entirely)**  
**Resolution:** Legal requirement, not optional.
- POPIA consent screen in onboarding (3 explicit checkboxes)
- `users.popia_consent_at` timestamp stored
- `GET /api/popia/export` — JSON zip of all user/household data
- `POST /api/popia/delete-request` — 24h grace → cascade delete → `supabase.auth.admin.deleteUser`
- Without POPIA consent: inbox parser MUST NOT process attachments
- Privacy Policy must disclose EU hosting (Supabase `eu-west-2`, Ireland) with GDPR-equivalent protections under POPIA Section 72 (Ireland qualifies)

### Decision 12: JWT Revocation on Member Removal
**Winner: Claude plan (OpenAI missed)**  
**Resolution:** On member removal, call `supabase.auth.admin.signOut(userId, 'others')` immediately. This invalidates all sessions for the removed user at the infrastructure level. A removed secondary member MUST NOT retain API access for up to 1 hour (JWT natural expiry). No `revoked_jwt_claims` table needed — the signOut API handles it.

---

## 7. DOCUMENT INTELLIGENCE PLAN

### Full Pipeline: Upload → OCR → Extract → Embed → Q&A

```
PHASE 1: Upload
Client: file selected → SHA-256 hash (Web Crypto API, client-side)
  → duplicate check: GET /api/documents?hash={hash} (early abort)
  → POST /api/documents/upload-url
  Server: INSERT documents(status='uploading'); generate signed URL
  Client: TUS upload directly to Supabase Storage (bypasses Next.js/Vercel)
  Client: POST /api/documents/confirm { document_id, file_hash, actual_size }
  Server: magic byte MIME validation → reject if not in [pdf, jpeg, png, heic, webp]
  Server: UPDATE documents SET status='processing'; enqueue background job

PHASE 2: OCR + Extraction (async background job)
  1. Household existence check (prevent orphan jobs on POPIA deletion)
  2. Fetch file bytes via signed URL (60s TTL)

  For PDF:
    → Per-page: PDF.js text extraction attempt
    → If text density > 100 chars/page: use extracted text (cheaper)
    → If text density ≤ 100 chars/page (scanned): Claude Vision on that page
    → Hybrid pages: combined per-page approach

  For image (JPG/PNG/HEIC/WebP):
    → HEIC: convert to JPEG via sharp
    → Direct Claude Vision

  For >50-page documents:
    → Chunk into 10-page batches
    → Parallel extraction (max 3 concurrent per household)
    → Merge extracted_data arrays

  Claude Opus 4.5 Vision:
    → System prompt includes SA document templates (6 banks, insurance, municipal, SA VAT)
    → Multi-language note: English/Afrikaans extraction
    → Returns: ocr_text (verbatim), extracted_data (JSON per Zod schema)
    → Confidence score computed heuristically
    → Retry once with alternate prompt on JSON parse failure

PHASE 3: Embedding + Persistence
  → OpenAI text-embedding-3-small on ocr_text[:8000] + JSON.stringify(extracted_data)
  → UPDATE documents SET status='ready', ocr_text, extracted_data, embedding, confidence_score
  → INSERT notifications(type='document_ready')
  → Supabase Realtime: clients get live status update

PHASE 4: Q&A (on-demand, streaming)
  User question → POST /api/documents/[id]/qa
  → Auth + RLS (document.household_id == jwt.household_id)
  → Quota check (TIER_LIMITS.ai_interactions_per_month)
  → Load document (ocr_text, extracted_data, filename)
  → Load/create qa_session; load last 20 qa_messages
  → streamText(claude-sonnet-4.5, system + doc content + history + question)
  → toDataStreamResponse() — SSE to client
  → onFinish: INSERT qa_messages (user + assistant pair); logAiUsage()
  → Suggested follow-ups extracted from response; rendered as clickable chips
```

### Cross-Document Q&A (Coordinator)
For queries spanning multiple documents ("total insurance premium across all policies"):
- Generate query embedding via `text-embedding-3-small`
- Run `hybrid_search()` RPC: vector 70% + FTS 30%
- Inject top-5 relevant document excerpts into coordinator system prompt
- Similarity threshold: 0.7 minimum

### SA Document Templates (extraction profiles)
Specialised sub-prompts maintained for:
- ABSA, FNB, Standard Bank, Nedbank, Capitec, Discovery Bank (statement date formats, DR/CR indicators, branch code formats)
- Discovery, Momentum, OUTsurance, Santam (policy schedules, sum insured, excess, renewal dates)
- City of Johannesburg, Cape Town, eThekwini, Tshwane (municipal bills: account numbers, meter readings, consumption, arrears)
- SA insurance policies: extract exclusions, special conditions (geyser clauses, security requirements)

---

## 8. MOBILE APP PLAN

### Architecture
- Expo SDK 52+, Expo Router v3 (file-based routing)
- Shared API: identical endpoints as web; no mobile-specific backend routes
- Shared types via `packages/api-types/` (same SDK as web)
- Auth: Supabase JS client (`@supabase/supabase-js`); session stored in `expo-secure-store`

### Project Structure
```
household-os-mobile/
├── app/
│   ├── (auth)/             login.tsx, signup.tsx (+ POPIA consent)
│   ├── (tabs)/             _layout.tsx (5 tabs), index.tsx (home),
│   │                        chat.tsx, capture.tsx, notifications.tsx, profile.tsx
│   ├── documents/          index.tsx, [id].tsx
│   ├── inbox/              index.tsx, [id].tsx
│   ├── receipts/           index.tsx, [id].tsx, [id]/warranty/new.tsx
│   ├── budget/             index.tsx, transactions.tsx
│   └── warranties/         index.tsx
├── components/
│   ├── CameraOverlay.tsx   (document + receipt guide frame, blur check)
│   ├── ChatBubble.tsx
│   ├── DocumentCard.tsx
│   └── ...
├── lib/
│   ├── api/client.ts       (fetch wrapper with auth headers + BASE_URL)
│   ├── supabase/client.ts
│   ├── stores/             (shared Zustand stores)
│   └── notifications/expo-push.ts
└── eas.json
```

### Camera Integration
- `expo-camera` with document/receipt guide overlay (`CameraOverlay.tsx`)
- Pre-upload checks: blur score (image variance), 150dpi minimum
- Image compression: `expo-image-manipulator` → 1500px max width, 85% JPEG
- Multi-page capture: tap "Add page" → array of captured images → single `documents` row
- Blur alert before upload (not block); "Retake" vs "Use anyway"

### Upload (Mobile-Specific)
- TUS resumable upload via Supabase Storage (handles iOS background suspension)
- `expo-background-fetch` task processes offline queue on resume
- Upload progress in Zustand; persisted to AsyncStorage for resume after app kill

### Push Notifications
- `expo-notifications` token registration on app load → `POST /api/notifications/register-push-token`
- Notification tap handler routes to correct screen: warranty → `/warranties/[id]`, document_ready → `/documents/[id]`, hitl_executed → `/notifications`
- `DeviceNotRegistered` error on push send → delete token from `user_preferences` immediately

### Offline Strategy (Phase 1 — Graceful Degradation)
Works offline: previously cached document list, receipts, warranties, budget summary (React Query + AsyncStorage persistence)  
Requires connectivity: uploads (queued), AI chat, new inbox messages, Realtime updates

Offline queue (Zustand + AsyncStorage persist):
```
addToQueue(action) → persisted to AsyncStorage
NetInfo.addEventListener → on reconnect: processQueue()
Each queued action: retry → if success: remove from queue; if fail: leave for next attempt
```

### Biometric Auth
- `expo-local-authentication`: FaceID/TouchID prompt on app foreground from background
- App killed + reopened: requires biometric (sensitive financial data)
- If biometric unavailable/enrolled: fall through to PIN or skip

### Streaming Chat (Mobile)
- `fetch` with SSE via `ReadableStream` reader (no library dependency)
- Parse `data: {token}\n\n` format; append tokens to current message in Zustand
- `KeyboardAvoidingView` for iOS keyboard handling

---

## 9. AUTH & MULTI-TENANCY

### Signup Flow
1. `POST /api/auth/signup` → `supabase.auth.signUp()` + atomic creation of `households`, `users (role='primary')`, `subscriptions (trialing)`
2. POPIA consent captured and stored (`users.popia_consent_at = now()`)
3. Auth Hook fires: JWT claims injected (`household_id`, `role`, `subscription_tier`)
4. Verification email sent (non-blocking); user proceeds immediately to onboarding
5. Unverified at Day 14: reminder; Day 21: restrict to read-only

### JWT Claims Pattern
Auth Hook (`supabase/functions/auth-claims-hook`):
- Reads `users.household_id`, `users.role`, `households.subscription_tier`
- Checks `user_preferences.active_household_id` (for household switcher)
- Injects into `app_metadata` → available as `auth.jwt() ->> 'household_id'` in RLS

Claims accessed in API routes via `getAuthSession()` — parses JWT, returns `{ userId, householdId, role, subscriptionTier }` — avoids a DB query on every request.

### RLS Pattern
Every table with `household_id` gets these policies:
```sql
-- SELECT: any member
USING (household_id = (auth.jwt() ->> 'household_id')::uuid)
-- INSERT: primary or secondary
WITH CHECK (household_id = ... AND role IN ('primary', 'secondary'))
-- DELETE/sensitive UPDATE: primary only
USING (... AND (auth.jwt() ->> 'role') = 'primary')
```

**Critical:** RLS alone is insufficient. API-level role checks via `requireRole()` middleware are also required because the Supabase service role key bypasses RLS in all background jobs.

### Household Switching
- `HouseholdSwitcher` shown only when user is member of >1 household
- `POST /api/household/switch` → verify membership → `UPSERT user_preferences(active_household_id)` → return 200
- Client: call `supabase.auth.refreshSession()` → JWT updated → clear all React Query cache and Zustand stores → redirect to `/dashboard`
- Auth Hook reads `active_household_id` preference on every JWT refresh
- Coordinator Agent is ALWAYS single-household scoped — no cross-household queries

### Member Removal
1. API call: `DELETE /api/household/members/[id]`
2. `supabase.auth.admin.signOut(userId, 'others')` — immediately invalidates all sessions
3. `UPDATE users SET removed_at = now()` (soft remove; do not delete for audit trail)
4. INSERT `audit_log(action='member_removed')`

### Household Slug Collision
```typescript
async function createUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { count } = await supabase.from('households').select('*', { count: 'exact', head: true }).eq('slug', slug);
    if (count === 0) return slug;
  }
  throw new Error('Could not generate unique slug');
}
```

### POPIA Right to Access/Erasure
- `GET /api/popia/export` → generates ZIP containing all household data as JSON (documents metadata, transactions, warranties, receipts, inbox messages, chat history)
- `POST /api/popia/delete-request` → creates pending erasure request; 24h grace period email; on confirmation → cascade delete all household data → `supabase.auth.admin.deleteUser(userId)` 
- Statement OCR text retained 7 years (SARS requirement); disclosed to user at deletion with acknowledgment option
- Data residency: Ireland (`eu-west-2`) disclosed in Privacy Policy; GDPR-equivalent protection qualifies under POPIA Section 72

---

## 10. STRIPE BILLING

### Subscription Tiers
```typescript
export const TIER_LIMITS = {
  essential: {
    documents: 20,
    inbox_addresses: 5,
    ai_interactions_per_month: 500,
    members: 2,
    storage_gb: 1,
    bank_transaction_matching: false,
    budget_export: false,
    hitl: false,
  },
  household: {
    documents: 100,
    inbox_addresses: 20,
    ai_interactions_per_month: 2000,
    members: 5,
    storage_gb: 5,
    bank_transaction_matching: true,
    budget_export: true,
    hitl: true,
  },
  premium: {
    documents: Infinity,
    inbox_addresses: Infinity,
    ai_interactions_per_month: Infinity,
    members: Infinity,
    storage_gb: 25,
    custom_categories: true,
    audit_log_export: true,
  },
} as const;
```

### Checkout Flow
1. `POST /api/stripe/create-checkout { tier }` → create/retrieve Stripe customer → `stripe.checkout.sessions.create()` with `currency: 'zar'`, 14-day trial, `allow_promotion_codes: true`
2. Client redirects to Stripe-hosted checkout URL (ZAR pricing)
3. On completion: Stripe webhook fires → `POST /api/webhooks/stripe`

### Webhook Handling (Idempotent)
All handlers check `event.id` for idempotency before processing.

| Event | Action |
|-------|--------|
| `checkout.session.completed` | UPSERT `subscriptions`; UPDATE `households.subscription_tier`; trigger JWT refresh |
| `customer.subscription.updated` | UPDATE `subscriptions` status + tier; UPDATE `households.subscription_tier` |
| `customer.subscription.deleted` | SET `subscriptions.status='cancelled'`, `tier='essential'`; notify primary user |
| `invoice.payment_failed` | SET `subscriptions.status='past_due'`; push + email to primary user |
| `customer.subscription.trial_will_end` | Fires 3 days before trial end → send upgrade CTA email + push notification |

### Trial Lifecycle
- Signup: 14-day Household trial starts immediately; no card required
- Day 11: `trial_will_end` webhook → "3 days left" reminder
- Day 13: `trial_will_end` check → "1 day left" reminder
- Day 14 (trial end): if no payment → Stripe downgrades to Essential; `subscription.updated` webhook received → features restricted
- Trial-to-paid conversion: `subscription.updated` with `previous_attributes.status: 'trialing'` + `status: 'active'` → welcome email

### Tier Enforcement Middleware
```typescript
// Before document upload
await checkDocumentLimit(supabase, householdId, tier);   // 402 if at limit

// Before AI call
await checkAIQuota(supabase, householdId, tier);          // 402 if exhausted; 80% → warning notification

// Feature-gated
if (!TIER_LIMITS[tier].hitl) return 403;
```

### Downgrade UX
- Never auto-delete documents on downgrade
- Show confirmation dialog: count of impacted documents (excess over new limit) + list sorted by most-recent
- Documents beyond limit become read-only; no new uploads until under limit
- Message to user: "Your X documents are safe. You can't upload new ones until you're under the Y-document limit or upgrade."

---

## 11. EDGE CASES RESOLVED (Top 20)

| # | Name | Source | Resolution |
|---|------|--------|------------|
| EC-01 | Warranty Date Overflow in JavaScript | Claude | All expiry dates computed server-side in SQL using `(purchase_date + ($months || ' months')::interval)`. Never in JS. |
| EC-02 | Duplicate Transaction via Multiple Paths | Claude | Normalise descriptions (lowercase, strip branch codes/references) before insert. Unique constraint on `(household_id, normalized_description, transaction_date, amount_cents)`. |
| EC-03 | Postmark Webhook Duplicate Delivery | Claude | Unique constraint on `inbox_messages.external_message_id`. Second delivery: `ON CONFLICT DO NOTHING` → 200 OK. |
| EC-04 | Household Slug Collision | Claude | 3-attempt retry loop with 4-digit random suffix. |
| EC-05 | JWT Stale After Member Removal | Claude | `supabase.auth.admin.signOut(userId, 'others')` on member removal — immediate session invalidation. |
| EC-06 | Mixed PDF (Text + Scanned Pages) | Claude | Per-page processing: text density check; digital extraction where possible, Claude Vision for low-density pages; merge per page. |
| EC-07 | R0.00 or Negative Receipt Amount | Claude | Skip warranty creation on `total_amount ≤ 0`; show "Amount not detected" banner with manual entry prompt. |
| EC-08 | Tier Downgrade — Data Above New Limit | Claude | Show count + list of impacted documents; never auto-delete; read-only enforcement. |
| EC-09 | Network Drop During Streaming | OpenAI | Stream includes `message_id` header. Client sends `resume_from: message_id` on reconnect. Server: return full persisted response if complete; restart stream if incomplete. |
| EC-10 | Municipality Free Text / Typo | Claude | Municipality field is constrained autocomplete over 257 official SA codes only. No free text accepted. |
| EC-11 | Password-Protected PDF | OpenAI | Detect → prompt → in-memory decrypt → reprocess. Password NEVER stored or logged. |
| EC-12 | Household Deleted During OCR Job | OpenAI | Every background job checks household existence at start: `SELECT id FROM households WHERE id=?; if (!household) return;` |
| EC-13 | Expo Push Token Revoked | OpenAI | `DeviceNotRegistered` error on push send → `DELETE user_preferences WHERE key='expo_push_token'` |
| EC-14 | Concurrent Member Upload Duplicate | Claude | Async post-processing hash comparison; "Possible duplicate" banner; user resolves (never auto-delete). |
| EC-15 | Claude API Rate Limit During Burst | Claude | Exponential backoff (1s→60s, max 5 retries); max 3 concurrent Claude calls per household; failed jobs retry every 30min (max 3 total); user notified via Realtime. |
| EC-16 | SA Bank Name Misidentification | Claude | Multi-signal detection: sender email domain (primary) + account number prefix + Claude visual. Confidence <80% → `bank_unconfirmed` flag. |
| EC-17 | Notification Duplicate on Cron Restart | Claude | Wrap notification INSERT + `alert_sent` UPDATE in a transaction. `UNIQUE (household_id, type, reference_id, DATE(created_at))` constraint on `notifications`. |
| EC-18 | File Type Spoofing | Claude | Server-side magic byte validation via `file-type` npm package on `/api/documents/confirm`. Reject non-allowlisted MIME types; delete from Storage; set `status='error'`. |
| EC-19 | Web/Mobile Chat Session Deduplication | OpenAI | Each message UUID assigned client-side before sending. On Realtime event, check if `message.id` exists in local store — if so, skip. |
| EC-20 | Trial Expiry UX Failure | Claude/Debate | `trial_will_end` Stripe webhook (Day 11, Day 13) → reminder emails/push. Day 14 end → downgrade to Essential automatically. |

---

## 12. SA-SPECIFIC CONSIDERATIONS

| # | Area | Detail |
|---|------|--------|
| SA-01 | ZAR Currency Storage | All monetary values stored as integer cents (e.g., R342.50 → 34250). Display layer uses `Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })`. No floating-point arithmetic on currency amounts. |
| SA-02 | Bank Statement Formats | 6 major banks: ABSA, FNB, Standard Bank, Nedbank, Capitec, Discovery Bank. Each has unique PDF format, DR/CR notation, date format, branch code format. Multi-signal bank detection. All 6 must be tested with real samples before Phase 1 launch. |
| SA-03 | Municipality Codes | 257 official SA municipality codes (Local Municipalities + Metropolitan Municipalities). Autocomplete-over-static-list only. No free text. Updates to list tracked against COGTA Municipal Demarcation Board. |
| SA-04 | Multi-Language OCR | SA documents appear in English and Afrikaans (municipal bills, Western Cape especially). Claude Vision handles natively; extraction prompt instructs language-agnostic field extraction with English JSON keys. |
| SA-05 | POPIA Compliance | Protection of Personal Information Act (Act 4 of 2013). Explicit consent at signup (3 checkboxes). `popia_consent_at` timestamp. Right to access: `GET /api/popia/export`. Right to erasure: `POST /api/popia/delete-request`. Without consent, inbox parser must not process attachments. |
| SA-06 | POPIA Data Residency (Section 72) | Supabase region `eu-west-2` (Ireland). Cross-border transfer is permissible under POPIA Section 72 as Ireland is GDPR-compliant (adequate equivalent protection). Disclosed explicitly in Privacy Policy. Phase 2: evaluate SA-hosted region when available. |
| SA-07 | FSCA Disclaimers | All coordinator responses on financial topics include: "This is informational only — not financial advice. For regulated financial advice, consult a licensed FSP." This is embedded in the coordinator system prompt. |
| SA-08 | SA CPA Warranty Minimum | Consumer Protection Act: minimum 6-month warranty on goods. If OCR returns `warranty_months = 0`: default to 6 months and flag for user confirmation. |
| SA-09 | SA Insurance Types | Discovery, Momentum, OUTsurance, Santam, Hollard, MiWay as primary extraction templates. Policy schedules, sectional title clauses, geyser clauses, security requirement clauses extracted and surfaced in Q&A. |
| SA-10 | SA Medical Aid Schemes | Phase 2 scope. Discovery Health, Momentum Medical Scheme, Bonitas, Fedhealth are the major schemes. Special category (sensitive) data under POPIA — additional encryption layer required in Phase 2. |
| SA-11 | BCEA / Domestic Workers (Phase 3) | Sectoral Determination 7 governs domestic workers. Module 21 (Phase 3): UIF calculation, SARS compliance, leave per BCEA. High POPIA sensitivity (employee personal data). |
| SA-12 | Loadshedding Resilience | Server-side jobs (Supabase Edge Functions, Vercel Serverless) run on non-SA infrastructure — unaffected by loadshedding. Client-side offline queue (Zustand + AsyncStorage) handles user-side connectivity drops. Resumable TUS uploads persist across connectivity loss. |
| SA-13 | VAT Handling | SA VAT at 15%. Receipt OCR must distinguish VAT-exclusive vs VAT-inclusive line items (especially Pick n Pay, Woolworths: mixed exempt fresh produce + VAT-inclusive items). `total_amount` from OCR is ground truth; line item sum mismatch > 10% shows "partial extraction" banner. |

---

## 13. DEBATE RESOLUTION SUMMARY

### What Was Taken from Claude's Plan

| Item | Why |
|------|-----|
| Two-step signed URL upload | Vercel body limits make direct multipart uploads production-breaking on large PDFs |
| Event-driven budget recalculation | Nightly CRON alone means 24h stale data; unacceptable UX |
| Zustand + AsyncStorage for mobile offline | WatermelonDB is overengineered for Phase 1 graceful degradation |
| POPIA consent screen + export/erasure endpoints | Legal requirement in South Africa; completely absent from OpenAI plan |
| JWT revocation via signOut on member removal | Security gap; removed members must not retain API access |
| ZAR as integer cents | Prevents floating-point currency bugs in all monetary calculations |
| Municipality constrained to 257 official codes | Prevents free-text garbage; binds to official SA administrative structure |
| Household slug collision retry | Prevents unhandled 500 errors on simultaneous signups |
| Warranty date computed in SQL only | JavaScript date arithmetic on month-boundary dates produces incorrect expiry dates |
| 20 edge cases (EC-01 to EC-20) | Broader coverage; 5 additional cases OpenAI missed |
| Per-page hybrid OCR algorithm | More token-efficient than full Vision pass on text-extractable PDFs |
| HITL warranty claim detail | Specific `hitl_actions` insert pattern and CRON logic |
| Anomaly detection pseudocode | Levenshtein distance, 3-month lookback, 20% amount change threshold |
| FSCA disclaimer in coordinator system prompt | Regulatory requirement for financial information |
| Conversation context window management | Summarise oldest 10 messages when >20 — prevents token overflow |
| 7-tier implementation order | Clearest dependency-respecting build sequence for Tech Lead |
| Household switcher component + API | Multi-household membership is a real user scenario |

### What Was Taken from OpenAI's Plan

| Item | Why |
|------|-----|
| React Query + Zustand hybrid | React Query is industry standard for server state; Zustand-as-fetcher is a reimplementation of React Query at lower quality |
| Hybrid search (vector 0.7 + FTS 0.3) | Exact keyword matches (policy numbers, account numbers) fail with vector-only search |
| `global_chat_messages` table (Phase 1) | Cross-session continuity; localStorage loses chat history on device change |
| Password-protected PDF handling | SA banks (Nedbank especially) deliver password-protected statements — a real production scenario |
| Multi-language OCR prompt addition | Western Cape municipal bills commonly in Afrikaans |
| OpenAPI-generated TypeScript SDK | Eliminates web/mobile API contract drift at compile time |
| `error_message TEXT` nullable column on documents | More queryable for ops than embedded JSONB error field |
| DPI minimum check (150dpi) before mobile upload | Prevents low-quality uploads that will fail OCR |
| iOS background upload via Expo background tasks | Prevents silent upload failures on iOS app suspension |
| Expo push token revocation cleanup | `DeviceNotRegistered` errors must clean up stale tokens |
| Household-deleted-during-OCR guard | Jobs must check household existence at start; prevents data leakage after POPIA erasure |
| `user_metrics` table with `time_to_value_secs` | Explicit measurement of the 5-minute onboarding KPI |
| Chat SSE hook details (`useSSE`) | Specific streaming implementation for mobile |
| Web/mobile chat message deduplication by UUID | Prevents double-render on Realtime + optimistic state |
| Hybrid approach to conversation persistence | `global_chat_messages` Phase 1 (no embeddings) + pgvector Phase 2 is the correct sequencing |

### How Disagreements Were Resolved

1. **State management:** OpenAI won because React Query provides battle-tested patterns (SWR, cache invalidation, retry) that would need to be reimplemented from scratch in Zustand.

2. **Upload method:** Claude won because Vercel body limits make large file uploads through API routes unreliable in production. TUS resumable protocol added from OpenAI debate.

3. **Chat persistence:** Neither plan was fully right. Hybrid adopted: `global_chat_messages` table (Claude direction was too minimal; OpenAI's pgvector per-message Phase 1 was too expensive). pgvector deferred to Phase 2.

4. **Mobile offline:** Claude won because WatermelonDB is overengineered for graceful degradation. Full offline-first is Phase 2+.

5. **Budget recalculation:** Both plans had valid points. Hybrid: event-driven as primary (Claude) + nightly CRON as reconciliation (OpenAI). Neither approach alone was sufficient.

6. **Search:** OpenAI won because FTS and vector search are complementary, not competing. Exact-match queries (common in SA document queries) fail vector-only search.

7. **POPIA, ZAR, municipality, JWT revocation, warranty date safety, slug collision:** All from Claude. OpenAI's plan lacked awareness of SA-specific legal and technical requirements.

8. **Password PDFs, multilingual OCR, push token cleanup, household-delete guard, OpenAPI SDK, DPI check:** All from OpenAI. Claude's plan had genuine gaps in these areas.

**Net result:** The joint plan is materially stronger than either individual plan. This is why the dual-planner debate process exists.

---

## JOINT PLAN CHECKLIST (29 items — all resolved ✅)

- [x] React Query + Zustand hybrid state management
- [x] Two-step signed URL upload (NOT multipart through Next.js)
- [x] TUS resumable uploads for mobile
- [x] `global_chat_messages` table Phase 1, pgvector Phase 2
- [x] Hybrid search (vector + FTS) SQL function with weighted fusion
- [x] `error_message` column on `documents` (verify schema, add migration if needed)
- [x] Password-protected PDF handling (in-memory decrypt, never persist)
- [x] Multi-language OCR prompt addition (Afrikaans/Zulu)
- [x] OpenAPI-generated TypeScript SDK (or shared types package as Phase 1 minimum)
- [x] POPIA consent screen in onboarding with explicit checkboxes
- [x] `users.popia_consent_at` timestamp column
- [x] POPIA data export + erasure endpoints
- [x] JWT revocation on member removal (`supabase.auth.admin.signOut`)
- [x] Household slug collision retry (3 attempts with 4-digit suffix)
- [x] ZAR as integer cents internally; `en-ZA` locale for display
- [x] Municipality constrained to 257 official SA codes
- [x] Household switcher component + API endpoint
- [x] Event-driven budget recalculation + nightly reconciliation CRON
- [x] Household existence check in all background jobs
- [x] Expo push token revocation cleanup on `DeviceNotRegistered`
- [x] Chat stream resume from cursor on network drop
- [x] Web/mobile chat message deduplication by UUID
- [x] Warranty cron: transactional notification insert + alert_sent update
- [x] `UNIQUE` constraint on notifications to prevent duplicates
- [x] Server-side MIME type magic byte validation on confirm
- [x] `user_metrics` table with `time_to_value_secs`
- [x] Trial expiry: `trial_will_end` Stripe webhook → Day 11/13 reminder emails/push
- [x] POPIA Section 72 cross-border transfer disclosure in Privacy Policy
- [x] Coordinator always single-household scoped (no cross-household queries)

---

PLAN_JOINT_APPROVED
