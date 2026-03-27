# HouseholdOS — OpenAI Planner Master Plan
**Planner:** plan-manager-openai  
**Date:** 2026-03-28  
**Status:** DRAFT FOR DEBATE (Round 1)

---

## Reference Materials (not reproduced, see original docs)

* SPEC.md — full product specification with 25 module list
* PM_ANALYSIS.md — user stories, permissions, tier limits
* SCHEMA_REPORT.md — 19 tables (column names used below)
* AI_ARCHITECTURE.md — detailed pipelines for OCR, embeddings, Q&A
* BACKEND_ARCHITECTURE.md — serverless patterns, HITL pipeline, notification engine

---

# 1. Phase 1 Implementation Plan (Modules 1 – 7)

Below, each module shows all screens/routes, API endpoints, DB operations, state management, and error handling patterns.  Front-end assumes Next.js 14 App Router (web) and React Native + Expo (mobile).  API routes are serverless on Vercel (**/api/** prefix).  All tables and columns match SCHEMA_REPORT.md exactly.

### 1.1 Document Intelligence Hub (Module 1)

1.1.1 Screens / Routes (Web)
* `/documents` — Document Library  
  • Components: `<DocumentGrid>`, `<FilterBar>`, `<QuotaBanner>`  
  • SSR + Realtime subscription to `documents` table (`status =in ready`)  
* `/documents/upload` — Upload Wizard  
  • `<FileDropzone>`, `<UploadProgress>`  
* `/documents/[id]` — Document Detail  
  • `<PDFViewer|ImageViewer>`, `<ExtractionSummary>`, `<QAChat>`  
  • Child route `/documents/[id]/edit` for manual field corrections.

1.1.2 Screens (Mobile)
* `DocumentsTab` → `DocumentListScreen`, `DocumentDetailScreen`, `UploadModal` (uses Expo DocumentPicker & Camera)

1.1.3 API Endpoints
* `POST /api/documents/upload` (multer / busboy stream to Supabase Storage)  
  → inserts into `documents` (status=`uploading`) & queues Edge Function job.
* `GET /api/documents` — paginated list, filter, search (fts on `ocr_text` + trigram)
* `GET /api/documents/[id]` — detail payload incl. extraction & signed file URL
* `POST /api/documents/[id]/qa` — streaming Q&A (per AI_ARCHITECTURE.md)
* `PATCH /api/documents/[id]` — user corrections to `extracted_data`

1.1.4 DB Ops
* `INSERT documents` on upload
* Edge Function updates `ocr_text`, `extracted_data`, `embedding`, `status`
* `INSERT document_qa_sessions / document_qa_messages` per chat exchange
* RLS: `household_id = auth.jwt().household_id` on *every* table

1.1.5 State Management (Front-end)
* React Query (`@tanstack/react-query`) for REST calls, optimistic updates on edits
* Supabase Realtime channel `documents:id=eq.{uuid}` drives UI updates
* Zustand store `useChatStore` caches last 20 messages per document session

1.1.6 Error Handling
* Upload failures → toast + retry; status row in `documents` marked `error`
* OCR/extraction job errors captured in `documents.error_message` (nullable text)
* Q&A streaming errors surface inline with “Try again” CTA; assistant msg flagged `error=true` in local store
* 429 from AI endpoints → exponential backoff in Edge Function + user notification

---

### 1.2 Dedicated Inbox System (Module 2)

1.2.1 Screens / Routes
* `/inbox` — Inbox List  
  • `<InboxMessageCard>` (colour-coded by `parsed_data.type`)  
* `/inbox/addresses` — Manage Addresses  
  • `<AddressList>`, `<CreateAddressDialog>`  
* `/inbox/messages/[id]` — Message Detail  
  • `<EmailViewer>`, `<ParsedDataPanel>`, `<ChangeDetectionTimeline>`

1.2.2 API Endpoints
* `POST /api/inbox/addresses` — create address, enforce tier limits
* `PATCH /api/inbox/addresses/[id]` — pause / resume / rename
* Postmark webhook: `POST /api/webhooks/postmark` → validates token → stores in `inbox_messages` & `inbox_attachments`
* `GET /api/inbox/messages` & `/[id]` — list & detail

1.2.3 DB Ops
* `INSERT inbox_addresses`
* `INSERT inbox_messages` + `inbox_attachments` on webhook
* Edge Function parses attachments → updates `parsed_data`, `status`, writes alerts into `notifications`

1.2.4 State Management
* Realtime channel on `inbox_messages` for new mails
* React Query cache invalidation when address settings change

1.2.5 Error Handling
* Webhook signature failure → HTTP 403 logged to `audit_log`
* Parsing low confidence (<70%) → `status='parsed_needs_review'`, UI badge “Needs review”
* Duplicate detection via `UNIQUE (household_id, message_hash)` constraint; returns 200 OK but marks as duplicate

---

### 1.3 Warranties and Receipts Vault (Module 3)

1.3.1 Screens / Routes
* `/warranties` — Warranty Dashboard  
  • `<WarrantyTable>`, `<FilterChips>`  
* `/warranties/[id]` — Warranty Detail & Claim Drafting  
  • `<Timeline>`, `<ProposedActionCard>`  
* `/receipts` — Receipts Library (shares components with Documents)

1.3.2 API Endpoints
* `POST /api/receipts/upload` — similar to documents, bucket `receipts/…`
* `GET /api/receipts`, `/[id]` — list/detail
* `PATCH /api/warranties/[id]` — user edits (period, product name)
* `POST /api/warranties/[id]/claim-proposal` — triggers AI to draft HITL action (writes to `hitl_actions`)

1.3.3 DB Ops
* `INSERT receipts`, OCR job populates `ocr_text`, `retailer`, etc.
* `INSERT warranties` after user confirmation step
* `UPDATE warranties.alert_sent = true` in Notification Engine job

1.3.4 State Management
* Expo camera flow writes to local temp uri → uploads via resumable fetch; progress reported via `useUploadStore`

1.3.5 Error Handling
* Image quality < 150dpi triggers client-side warning before upload
* Warranty claim proposal errors logged to `hitl_actions.result` and surfaced to user

---

### 1.4 Basic Budget Tracking (Module 4)

1.4.1 Screens / Routes
* `/budget` — Monthly Overview  
  • `<IncomeExpenseChart>`, `<CategoryBreakdown>`, `<MonthPicker>`
* `/budget/transactions` — Transaction List (infinite scroll, grouped)  
  • `<TransactionRow>` editable category dropdown
* `/budget/categories` — Manage Categories

1.4.2 API Endpoints
* `GET /api/budget/summary?month=YYYY-MM` — returns `budget_summaries` row
* `GET /api/budget/transactions` — filters: date range, income/expense, category
* `PATCH /api/budget/transactions/[id]` — update `category`

1.4.3 DB Ops
* `INSERT budget_transactions` via Inbox parser or manual CSV upload
* Nightly CRON (Edge Function) aggregates → `budget_summaries`
* `INSERT budget_categories` on user-created categories

1.4.4 State Management
* React Query with stale-while-revalidate; charts memoised; WebSocket update on summaries

1.4.5 Error Handling
* Aggregation job failures push admin alert + retry with exponential backoff
* Manual category update failure rolls back optimistic UI change

---

### 1.5 Web App (Next.js PWA) (Module 5)

1.5.1 Global Routes & Layout
* Root layout `/` — `<MainShell>` with `<SidebarNav>` (modules) & `<TopBar>` (search, notifications)
* Auth routes: `/login`, `/signup`, `/callback`
* `/chat` — Global conversational UI (see §4)
* Placeholder locked routes for Phase 2/3 modules show `<ComingSoonBanner>` with upgrade CTA.

1.5.2 PWA Features
* `next-pwa` plugin, offline cache for static assets, background sync for uploads
* Install prompt after first document uploaded

1.5.3 Error Handling
* Top-level Error Boundary shows `ErrorDialog` with trace ID (logged to Sentry)

---

### 1.6 Mobile App (React Native Expo) (Module 6)

(Also see §6)

1.6.1 Navigation Structure
* Tab Navigator: Home, Documents, Inbox, Warranties, Budget, Chat, Settings
* Stack screens under each tab mirror web routes.

1.6.2 APIs identical to web; shared generated TypeScript SDK via `openapi-typescript`

1.6.3 Offline strategy: React Query persist to AsyncStorage; queued mutations (uploads) retry when online.

---

### 1.7 Onboarding Flow (Module 7)

1.7.1 Screens / Steps
1. `/signup` — Supabase Auth UI (email/pass + Google OAuth)  
2. `/onboarding/household` — Household profile form  
3. `/onboarding/upload` — First Document upload wizard  
4. `/onboarding/ask` — Starter Q&A (pre-filled suggestions)  
5. `/onboarding/finish` — Success summary + next steps

1.7.2 API Usage
* Uses existing endpoints (`/api/documents/upload`, etc.)
* Metrics stored in `user_metrics` table: `time_to_value_secs`

1.7.3 State & Error Handling
* Stateful wizard stored in URL search params (allows refresh) + localStorage backup
* Failures on doc upload auto-retry (3×) before showing fallback “Skip for now”

---

# 2. All 25 Modules Overview (Phases 2 & 3)

## 2.1 Phase 2 Modules (8 – 14)
* **Banking & Financial Intelligence** — depends on Inbox & Budget modules; requires bank API creds storage (`bank_connections` table) & background polling jobs.
* **Insurance Intelligence Agent** — builds on Document embeddings; needs policy schema & renewal scheduler.
* **Credit Card Benefits Intelligence** — consumes receipts + bank txns; cross-module links to Warranties.
* **Municipal & Utilities Management** — parses municipal bills; hooks into Notification Engine for anomaly alerts.
* **Vehicle Management** — new tables `vehicles`, `vehicle_events`; pulls licence renewal dates from Inbox docs.
* **Medical Aid & Healthcare** — needs OCR templates for SA medical aids; regulatory disclaimers enforced.
* **Home Maintenance Intelligence** — asset graph using `documents` + `warranties`; schedule generator.

## 2.2 Phase 3 Modules (15 – 25)
Focus on lifestyle, IoT, staff management; many build atop Phase 2 data (e.g., Energy uses Utilities ingestion).  Placeholder routes & locked feature flags delivered in Phase 1 to prevent navigation reshuffle.

## 2.3 Module Dependencies & Data Flow
```
Documents → Inbox → Budget
           ↘ Receipts → Warranties
Documents → Embeddings → Knowledge Graph → Coordinator Agent
Budget + BankAPI → Financial Intelligence → Credit/Insurance Insights
Utilities Inbox → Municipal Module → Energy/Water Mgmt
```
Graph maintained in `household_context` service for agent reasoning.

---

# 3. Onboarding Flow Details
1. **Signup** (`/signup`) — 30 sec goal; email/pass or Google OAuth.
2. **Household Profile** — collects `name`, `primary_bank`, `city`; writes to `households` table.
3. **Subscription** — Stripe Checkout (Essential tier default; upgrade later) using Supabase Subscriptions extension.
4. **First Document** — upload & process via Module 1.
5. **First Q&A** — three suggested questions auto-populated; timer measures time-to-answer (<5 min total from signup).
6. **Progressive Activation** — Feature flag service tracks completion %; unlocks Inbox wizard after first doc, Warranties after first receipt, etc.

---

# 4. Conversational UI
* **Coordinator Agent** (see SPEC) runs in `/api/chat` route; routes messages to specialist agents (document, budget, banking) based on embedded metadata.
* **Web Chat Interface** — `/chat` route with `<ChatThread>` + `<MessageInput>`; streams via SSE.
* **Mobile Chat** — identical TSX component in Expo using `expo-sse` polyfill.
* **Streaming Architecture** — Edge Function emits `text/event-stream`; client uses `useSSE` hook; messages persisted to `global_chat_messages` table (pgvector for memory retrieval).

---

# 5. Document Intelligence Deep-Dive
1. **Pipeline** already defined in AI_ARCHITECTURE.md — no divergence.
2. **SA-specific Handling** — Municipal bills template classifier; VAT detection; multi-language OCR (Afrikaans/Zulu PDFs).
3. **Cross-Document Search** — Hybrid search endpoint `GET /api/search?query=` performing:
   * pgvector similarity on `documents.embedding`
   * `plainto_tsquery` on `documents.ocr_text`
   * Results fused via weighted scoring, returned with citations.

---

# 6. Mobile App Specifics
* **Expo Project Structure**
  * `/app` — route-based file system (Expo Router v3)
  * `/components/shared` — UI shared with web via `react-native-web`
  * `/lib/api` — auto-generated SDK
* **Camera** — Expo Camera module with receipt overlay grid.
* **Push** — Expo Notifications; token registration endpoint (see Backend Architecture §2.3).
* **Offline** — SQLite cache via WatermelonDB for documents list & chat history.

---

# 7. Auth & Multi-tenancy
* Supabase Auth with email/pass + Google.
* JWT claims include `household_id`, `role`, `subscription_tier` (set via Edge Function after login).
* RLS policies already in SCHEMA_REPORT.md — ensure every new table includes `household_id` and a select policy.
* Client side gets anon Supabase key only; Row level security prevents cross-tenant leakage.

---

# 8. Stripe Billing
* Price IDs stored in ENV; Stripe Checkout session created in `/api/billing/checkout`.
* Webhook `/api/webhooks/stripe` updates `households.subscription_tier`, `stripe_customer_id`.
* Usage metering: `monthly_usage` materialised view counts docs, inbox addresses, AI interactions; cron pushes to Stripe metered items.
* Upgrade flow accessible in Settings; downgrade locked behind confirmation dialog listing module lockouts.

---

# 9. Logic Bugs & Edge Cases (15)
1. Uploading same document twice with different filename — hash collision detection.  
2. User downgrades tier below current doc count — UI hides upload button, but RLS must still allow read-only access.  
3. Household deleted while async OCR job still running — job must abort gracefully.  
4. Email alias paused but Postmark still forwards — webhook should discard when `is_active=false`.  
5. Expo push token revoked (Apple) — push fail removed from prefs.  
6. Receipt photo too large for mobile memory — downscale before upload.  
7. Bank statement PDF with password protection — prompt user for password, store encrypted.  
8. Duplicate bank transactions across overlapping statements — idempotency key `(account,date,amount,desc)`.  
9. Network drop during streaming answer — client resumes via message cursor.  
10. Stripe webhook delivered twice — sig verified idempotency on `event.id`.  
11. OCR low confidence returns no JSON block — extraction worker retries with different prompt variant.  
12. User invites partner with email already tied to another household — returns 409.  
13. iOS background upload suspended — resume via foreground task.  
14. Supabase rate limits (600 req/min) during vector search — implement server-side queueing.  
15. Handoff between web & mobile chat sessions causing duplicate assistant messages — de-dupe by `message_id` UUID.

---

# 10. Recommended Implementation Order
1. Auth & Multi-tenancy baseline (tables, RLS)  
2. Document upload pipeline end-to-end (without chat)  
3. Streaming Q&A endpoint + chat UI  
4. Dedicated Inbox webhook ingestion  
5. Receipt capture + Warranty tracking  
6. Budget aggregation  
7. Notification engine  
8. Onboarding wizard tying above features together  
9. Web PWA polish  
10. Mobile Expo app parity  
11. Stripe billing & tier gating  
12. HITL action pipeline (subset for warranties)  
13. Edge cases hardening & load testing

---

# 11. Self-Critique (Three Rapid Rounds)

**Round 1 – Completeness:**   Covered all requested headings; may need deeper API contracts for Inbox parsing and Budget categories.  Documented 15 edge cases.  Risk: plan length vs dev velocity.

**Round 2 – Feasibility:**   Serverless pattern acceptable; OCR latency might exceed 30s on large PDFs — include chunked upload & page-by-page processing fallback.  Stripe metering MVP may slip — flag for Phase 1.1.

**Round 3 – Clarity:**   Ensure separation between screens and endpoints is obvious; add ERD diagram link in future revision.  Provide exact request/response JSON in next draft for top 5 endpoints.

---

PLAN_MANAGER_OPENAI_APPROVED
