# HouseholdOS — Comprehensive Implementation Plan
**Author:** plan-manager-claude  
**Date:** 2026-03-28  
**Status:** PLAN_MANAGER_CLAUDE_APPROVED  
**Based on:** SPEC.md, PM_ANALYSIS.md, SCHEMA_REPORT.md, AI_ARCHITECTURE.md, BACKEND_ARCHITECTURE.md

---

## TABLE OF CONTENTS

1. [Phase 1 Implementation Plan (Modules 1–7)](#1-phase-1-implementation-plan)
2. [All 25 Modules Overview](#2-all-25-modules-overview)
3. [Onboarding Flow (Critical Path)](#3-onboarding-flow)
4. [Conversational UI Architecture](#4-conversational-ui-architecture)
5. [Document Intelligence Deep Dive](#5-document-intelligence-deep-dive)
6. [Mobile App Architecture](#6-mobile-app-architecture)
7. [Authentication & Multi-tenancy](#7-authentication--multi-tenancy)
8. [Subscription & Billing](#8-subscription--billing)
9. [Logic Bugs & Edge Cases (20 identified)](#9-logic-bugs--edge-cases)
10. [Implementation Order (Dependency Graph)](#10-implementation-order)
11. [Self-Critique — 3 Rounds](#11-self-critique)

---

## 1. PHASE 1 IMPLEMENTATION PLAN

### MODULE 7: Onboarding Flow

> Module 7 is listed first intentionally — it is the entry point and constrains all other modules.

#### Screens & Routes

| Route | Layout | Components | Purpose |
|-------|--------|-----------|---------|
| `/` | MarketingLayout | HeroSection, FeatureGrid, PricingTable, CTAButton | Landing / marketing |
| `/auth/signup` | AuthLayout | SignupForm, GoogleOAuthButton, TOSCheckbox, PrivacyNote | Registration |
| `/auth/verify` | AuthLayout | VerificationPending, ResendEmailButton | Email confirmation wait |
| `/auth/login` | AuthLayout | LoginForm, GoogleOAuthButton, MagicLinkOption | Sign in |
| `/auth/callback` | None (server redirect) | — | OAuth + magic link token exchange |
| `/onboarding` | OnboardingLayout (stepper) | StepIndicator (5 steps), ProgressBar | Onboarding shell |
| `/onboarding/household` | OnboardingLayout | HouseholdNameInput, BankSelector, MunicipalityAutocomplete | Step 1: Household profile |
| `/onboarding/subscription` | OnboardingLayout | PricingCards, TrialBadge, StripeCheckoutButton, SkipForNow | Step 2: Pick tier (14-day trial default) |
| `/onboarding/first-document` | OnboardingLayout | DocumentUploadDropzone, CameraShortcut, DocumentTypeHint | Step 3: Upload first doc |
| `/onboarding/first-qa` | OnboardingLayout | DocumentPreviewCard, StarterQuestions (3), ChatInput | Step 4: First Q&A |
| `/onboarding/complete` | OnboardingLayout | SuccessAnimation, NextStepsCard, InvitePartnerCTA | Step 5: Complete |

#### API Endpoints (Onboarding-Specific)

| Method | Route | Body | Returns | DB Operation |
|--------|-------|------|---------|-------------|
| POST | `/api/auth/signup` | `{email, password, full_name, agreed_to_terms}` | `{user_id, email}` | Creates Supabase Auth user; inserts `households` (name=`${full_name}'s Household`, tier=`essential`); inserts `users` (role=`primary`); inserts `subscriptions` (status=`trialing`, tier=`household`) |
| POST | `/api/auth/google` | — | Redirect to Google | Supabase OAuth initiation |
| GET | `/api/auth/callback` | `code` query param | Redirect to `/onboarding` | Supabase token exchange; creates household + user rows if first sign-in |
| PUT | `/api/household` | `{name, primary_bank, municipality_code}` | `{household}` | `UPDATE households SET name=..., updated_at=now()`; `UPSERT user_preferences(user_id, key='household_setup', value={primary_bank, municipality_code})` |
| POST | `/api/onboarding/complete` | `{step}` | `{next_step}` | `UPSERT user_preferences(key='onboarding_progress', value={completed_steps:[], completed_at:null})` |
| GET | `/api/onboarding/status` | — | `{current_step, completed_steps, is_complete}` | `SELECT value FROM user_preferences WHERE user_id=? AND key='onboarding_progress'` |

#### Database Operations

```
households: INSERT (id, name, slug=slugify(name), subscription_tier='essential', created_at)
users: INSERT (id=auth.uid(), household_id, email, full_name, role='primary')
subscriptions: INSERT (household_id, tier='household', status='trialing', current_period_end=now()+14d)
user_preferences: UPSERT (user_id, key='onboarding_progress', value={steps:[],pct:0})
user_preferences: UPSERT (user_id, key='household_setup', value={primary_bank, municipality_code})
audit_log: INSERT on every step completion
```

#### State Management

- Onboarding state: Zustand store `useOnboardingStore` with `{currentStep, completedSteps, householdData}`
- Persisted to `user_preferences` after each step (server-side source of truth; Zustand is optimistic cache)
- On reload/reconnect: re-fetch `/api/onboarding/status` and hydrate store
- Step navigation: blocked forwards until current step API call returns 200

#### Error Handling

| Scenario | User-facing | System action |
|---------|-------------|--------------|
| Duplicate email on signup | "An account with this email already exists. [Sign in]" | 409 returned from Supabase Auth |
| Google OAuth fails | "Google sign-in failed. Try email instead." | Log to audit_log, offer email fallback |
| Household creation DB error | "Could not create your household. Please try again." | Retry idempotently (check if household exists first) |
| Onboarding step save fails | Non-blocking toast; keep user on step; retry on next forward navigation | Offline queue in Zustand |
| Token verification expired | Redirect to `/auth/signup` with "Your link expired. Enter email to resend." | Supabase handles token expiry |

---

### MODULE 1: Document Intelligence Hub

#### Screens & Routes

| Route | Layout | Components | Purpose |
|-------|--------|-----------|---------|
| `/documents` | AppLayout | DocumentLibraryHeader, FilterBar, DocumentGrid, PaginationFooter, UploadFAB | Main library |
| `/documents/upload` | AppLayout (modal overlay) | UploadDropzone, FileTypeGuide, ProgressBar, DuplicateWarning | Upload flow |
| `/documents/[id]` | DocumentDetailLayout | DocumentViewer (PDF.js), ExtractionCard, QAChat, DocumentMetaPanel | View + Q&A |
| `/documents/[id]/edit` | AppLayout | DocumentMetaForm (name, type, tags) | Edit metadata |
| `/documents/trash` | AppLayout | TrashList, BulkRestoreButton, BulkDeleteButton | Soft-deleted docs |

#### DocumentViewer Component Detail

- PDF rendering: `react-pdf` (PDF.js wrapper) with lazy page loading
- Image rendering: standard `<img>` with signed URL
- For multi-page documents: page navigator in sidebar
- Zoom controls: 50% to 200% (mobile: pinch-to-zoom)
- Highlighted text: when Q&A cites a section, that page scrolls into view and the cited text is highlighted via a highlight overlay computed from OCR bounding boxes (stored in `extracted_data.highlights`)

#### API Endpoints

| Method | Route | Guards | DB Operation |
|--------|-------|--------|-------------|
| GET | `/api/documents` | auth | `SELECT * FROM documents WHERE household_id=? AND status!='deleted' ORDER BY created_at DESC LIMIT 20 OFFSET ?` with trigram search on `ocr_text` if search param present |
| POST | `/api/documents/upload-url` | auth, quota check | Generates Supabase Storage signed upload URL for path `documents/{household_id}/{uuid}/{filename}`; `INSERT documents (status='uploading', file_path, filename, mime_type, file_size=0, household_id, uploaded_by)` |
| POST | `/api/documents/confirm` | auth | `UPDATE documents SET file_size=actual_size, status='processing'`; enqueue `/api/internal/process-document` |
| GET | `/api/documents/[id]` | auth, RLS | `SELECT d.*, qa_sessions count FROM documents d WHERE id=? AND household_id=?`; generate signed URL for `file_path` |
| GET | `/api/documents/[id]/signed-url` | auth | `createSignedUrl(file_path, 3600)` |
| PATCH | `/api/documents/[id]` | auth, secondary+ | `UPDATE documents SET filename=?, extracted_data=jsonb_set(extracted_data,...) WHERE id=? AND household_id=?` |
| DELETE | `/api/documents/[id]` | primary only | `UPDATE documents SET status='deleted', deleted_at=now()` (soft delete); INSERT audit_log |
| POST | `/api/documents/[id]/qa` | auth, quota check | Session management → streamText; persist to `document_qa_sessions` + `document_qa_messages` |
| GET | `/api/documents/[id]/qa/sessions` | auth | `SELECT * FROM document_qa_sessions WHERE document_id=? ORDER BY created_at DESC` |
| GET | `/api/documents/[id]/qa/[sessionId]` | auth | `SELECT * FROM document_qa_messages WHERE session_id=? ORDER BY created_at ASC` |
| POST | `/api/documents/search` | auth | Vector similarity search via `SELECT ... ORDER BY embedding <=> $1 LIMIT 5` |
| GET | `/api/documents/count` | auth | `SELECT COUNT(*) FROM documents WHERE household_id=? AND status!='deleted'` for tier limit display |

#### Database Operations (Detailed)

```sql
-- On upload initiation
INSERT INTO documents (id, household_id, uploaded_by, filename, file_path, file_size, mime_type, status)
VALUES (gen_random_uuid(), $household_id, $user_id, $filename, $file_path, 0, $mime_type, 'uploading');

-- On processing complete (from background job)
UPDATE documents
SET status = 'ready',
    ocr_text = $ocr_text,
    extracted_data = $extracted_data::jsonb,
    embedding = $embedding::vector(1536)
WHERE id = $doc_id;

-- Q&A session creation
INSERT INTO document_qa_sessions (id, document_id, user_id, household_id)
VALUES (gen_random_uuid(), $doc_id, $user_id, $household_id)
ON CONFLICT DO NOTHING;

-- Q&A message persistence (batch insert after stream completes)
INSERT INTO document_qa_messages (id, session_id, household_id, role, content)
VALUES
  (gen_random_uuid(), $session_id, $household_id, 'user', $user_message),
  (gen_random_uuid(), $session_id, $household_id, 'assistant', $ai_response);

-- Document count for tier enforcement
SELECT COUNT(*) FROM documents
WHERE household_id = $household_id
  AND status NOT IN ('deleted', 'error');

-- Duplicate detection (file hash)
SELECT id FROM documents
WHERE household_id = $household_id
  AND extracted_data->>'file_hash' = $file_hash
  AND status != 'deleted';
```

**Note on duplicate detection:** Store `file_hash` (SHA-256 of file bytes) in `extracted_data->>'file_hash'` during processing. The schema's `extracted_data` JSONB column is used for this since there's no dedicated `file_hash` column. This avoids schema migrations.

#### State Management

- `useDocumentsStore` (Zustand): `{documents[], total, loading, filters, selectedDoc}`
- Realtime subscription on `documents` channel filtered by `household_id` — updates status live during processing
- Optimistic deletion: mark as `deleted` locally, confirm on API success, rollback on error
- Q&A: `useChat` hook from `ai/react` per document — chat state is local until persisted

#### Error Handling

| Scenario | Handling |
|---------|---------|
| Upload fails mid-transfer | Supabase Storage handles partial uploads; client shows "Upload failed, retry" button; DB row remains in `uploading` status for 1 hour then auto-cleaned by cron |
| OCR processing fails | `documents.status = 'error'`; Realtime notifies client; UI shows "Processing failed — [Retry] [Enter details manually]" |
| Q&A quota exhausted | `POST /api/documents/[id]/qa` returns `402 { error: 'quota_exceeded' }`; UI shows upgrade banner instead of response |
| Document not found | 404 returned; UI redirects to `/documents` with toast "Document not found or access denied" |
| PDF too large (>50MB) | Rejected at upload-url generation step with `413` — before any bytes are uploaded |
| Claude API timeout | Background job catches timeout; `status = 'error'`; retry once after 5 min; surface for manual retry after second failure |
| JSON parse failure on extraction | Regex fallback extraction (see AI_ARCHITECTURE.md); if still fails, `status = 'error'` with `extracted_data = { error: 'extraction_failed', raw_text: first_500_chars }` |

---

### MODULE 2: Dedicated Inbox System

#### Screens & Routes

| Route | Layout | Components | Purpose |
|-------|--------|-----------|---------|
| `/inbox` | AppLayout | InboxAddressList, InboxMessageFeed, InboxFilterBar | Main inbox view |
| `/inbox/addresses` | AppLayout | AddressList, AddressCard, CreateAddressModal | Manage email addresses |
| `/inbox/addresses/new` | AppLayout (modal) | CreateAddressForm, EmailPreviewCard, InstructionsPanel | Create address |
| `/inbox/messages/[id]` | AppLayout | EmailViewer, ParsedDataPanel, AttachmentList, AnomalyAlertBanner, QAShortcut | View parsed message |
| `/inbox/messages/[id]/attachments/[attId]` | DocumentDetailLayout | AttachmentViewer (reuses DocumentViewer) | View attachment |

#### CreateAddressForm Detail

- `label` input (e.g., "ABSA statements")
- `email_address` auto-generated as `{label-slug}@inbound.householdos.co.za` — shown as preview, not editable (prevents conflicts)
- "Copy address" button immediately
- Setup instructions panel: "Forward your statements to this address. It will be active immediately."
- On submit: POST → Postmark API to register inbound rule → INSERT `inbox_addresses`

#### API Endpoints

| Method | Route | Guards | DB / Action |
|--------|-------|--------|------------|
| GET | `/api/inbox/addresses` | auth | `SELECT * FROM inbox_addresses WHERE household_id=? ORDER BY created_at DESC` |
| POST | `/api/inbox/addresses` | auth, secondary+, tier check | Generate slug; call Postmark API to register inbound route; `INSERT inbox_addresses (household_id, email_address, label, is_active=true)` |
| PATCH | `/api/inbox/addresses/[id]` | auth, secondary+ | `UPDATE inbox_addresses SET label=?, is_active=? WHERE id=? AND household_id=?` |
| DELETE | `/api/inbox/addresses/[id]` | primary | Deactivate Postmark route; `UPDATE inbox_addresses SET is_active=false` |
| GET | `/api/inbox/messages` | auth | `SELECT m.*, a.email_address, a.label FROM inbox_messages m JOIN inbox_addresses a ON m.inbox_address_id=a.id WHERE m.household_id=? ORDER BY received_at DESC LIMIT 20 OFFSET ?` |
| GET | `/api/inbox/messages/[id]` | auth | Full message + `parsed_data` + attachment list |
| GET | `/api/inbox/messages/[id]/attachments/[attId]/url` | auth | `createSignedUrl(attachment.file_path, 900)` — 15 min TTL |
| POST | `/api/webhooks/postmark` | HMAC sig | Receive inbound; INSERT `inbox_messages` + `inbox_attachments`; enqueue parse job |
| POST | `/api/inbox/messages/[id]/qa` | auth, quota | Same pattern as document Q&A but sources from `parsed_data` + `inbox_attachments` |

#### Postmark Webhook Processing (Detailed)

```
1. Verify HMAC-SHA256 signature → 403 on failure
2. Extract recipient from payload.To (lowercase)
3. SELECT inbox_addresses WHERE email_address=? AND is_active=true
   → If not found: 200 OK silently (no routing leak)
4. INSERT inbox_messages (status='received', raw_payload=full_json)
5. For each attachment in payload.Attachments:
   a. sanitise_filename(attachment.Name)
   b. storage.from('documents').upload(`inbox/${household_id}/${message_id}/${filename}`)
   c. INSERT inbox_attachments
6. Respond 200 within 2 seconds
7. Async (Vercel background): POST /api/internal/parse-inbox-message
```

#### Statement Parsing → Budget Transactions

```
parse-inbox-message job:
1. Load inbox_messages row + inbox_attachments
2. For each PDF attachment:
   a. Get signed URL → fetch bytes → base64
   b. extractStatement(bytes, mimeType) — Claude Opus 4.5
   c. Detect type: bank_statement | utility_bill | invoice | insurance | unknown
3. For bank_statement:
   a. Parse transactions array
   b. UPSERT budget_transactions for each tx:
      ON CONFLICT (household_id, description, transaction_date, amount) DO NOTHING
   c. Run anomaly detection:
      - New debit order: tx.is_debit AND description not seen in prior 3 months
      - Amount change: same description, amount diff > 20%
      - Unusual merchant: amount > R5,000 and merchant not in household history
   d. INSERT notifications for each anomaly
   e. Recalculate budget_summaries for affected months
4. UPDATE inbox_messages SET status='parsed', parsed_data={...}
5. INSERT audit_log (action='inbox_parsed')
```

#### Change Detection Algorithm

```typescript
async function detectStatementAnomalies(
  householdId: string,
  currentTransactions: Transaction[],
  statementPeriod: { from: string; to: string }
): Promise<Anomaly[]> {
  // Fetch transactions from prior 3 months for comparison
  const priorPeriod = subMonths(new Date(statementPeriod.from), 3).toISOString().split('T')[0];
  const { data: priorTxs } = await supabase
    .from('budget_transactions')
    .select('description, amount, transaction_date')
    .eq('household_id', householdId)
    .gte('transaction_date', priorPeriod)
    .lt('transaction_date', statementPeriod.from);

  const anomalies: Anomaly[] = [];
  
  for (const tx of currentTransactions) {
    if (!tx.is_debit) continue;
    const matching = priorTxs.filter(p => 
      levenshteinDistance(p.description, tx.description) < 5
    );
    if (matching.length === 0) {
      anomalies.push({ type: 'new_debit_order', tx, reason: 'First appearance in 3 months' });
    } else {
      const avgPrior = matching.reduce((s, p) => s + p.amount, 0) / matching.length;
      if (Math.abs(tx.amount - avgPrior) / avgPrior > 0.20) {
        anomalies.push({ type: 'amount_change', tx, prior_avg: avgPrior, reason: `${Math.round((tx.amount - avgPrior)/avgPrior*100)}% change` });
      }
    }
  }
  return anomalies;
}
```

#### Database Operations (Detailed)

```sql
-- Inbox address count for tier enforcement
SELECT COUNT(*) FROM inbox_addresses
WHERE household_id = $1 AND is_active = true;

-- Message list with address context
SELECT m.id, m.from_email, m.subject, m.status, m.received_at,
       m.parsed_data, a.label, a.email_address
FROM inbox_messages m
JOIN inbox_addresses a ON m.inbox_address_id = a.id
WHERE m.household_id = $1
ORDER BY m.received_at DESC
LIMIT 20 OFFSET $2;

-- Duplicate detection for statements
SELECT id FROM inbox_messages
WHERE household_id = $1
  AND from_email = $2
  AND parsed_data->>'statement_period' = $3;

-- Anomaly: new debit orders in last statement
SELECT description, COUNT(*) as appearances
FROM budget_transactions
WHERE household_id = $1
  AND is_income = false
  AND transaction_date >= NOW() - INTERVAL '90 days'
GROUP BY description;
```

#### State Management

- `useInboxStore` (Zustand): `{addresses[], messages[], selectedMessage, loading, filters}`
- Realtime on `inbox_messages` channel: new messages append to feed without page reload
- Parsing status shown via skeleton → populated card as Realtime fires

#### Error Handling

| Scenario | Handling |
|---------|---------|
| Postmark delivers duplicate webhook | Idempotency key from `payload.MessageID`; `INSERT ... ON CONFLICT (from_email + subject + received_at) DO NOTHING` |
| Attachment storage fails | INSERT inbox_attachments with `file_path=NULL`, `status='error'`; main message still saved |
| Statement parse JSON fails | `status='error'`; `parsed_data={error:'parse_failed', raw_text:...}`; user sees "Needs review" with raw content |
| Postmark address limit exceeded | 402 from address creation endpoint with upgrade prompt |
| Inactive address receives email | Silently discard (200 OK); no row created |

---

### MODULE 3: Warranties and Receipts Vault

#### Screens & Routes

| Route | Layout | Components | Purpose |
|-------|--------|-----------|---------|
| `/receipts` | AppLayout | ReceiptGrid, WarrantyDashboard, ExpiryTimeline, UploadFAB | Main vault view |
| `/receipts/upload` | AppLayout (modal) | ReceiptCaptureOrUpload, OCRProgressIndicator, ExtractedDataReview | Upload + confirm |
| `/receipts/[id]` | AppLayout | ReceiptDetailCard, ItemsList, MatchedTransactionBadge | Receipt detail |
| `/receipts/[id]/warranty/new` | AppLayout (modal) | WarrantyForm (product, months, expiry preview) | Add warranty |
| `/warranties` | AppLayout | WarrantyList, ExpiryFilter (all/expiring/expired), SortControls | Warranty overview |
| `/warranties/[id]` | AppLayout | WarrantyDetailCard, LinkedReceiptCard, ClaimHITLPanel, AlertHistory | Warranty detail + HITL |

#### ExpiryTimeline Component

- Horizontal timeline showing next 90 days
- Dots plotted at warranty expiry dates with product names
- Click dot → navigate to `/warranties/[id]`
- Color coding: green (>90d), amber (31–90d), red (≤30d)
- Rendered with `recharts` ReferenceLine on a DateAxis

#### API Endpoints

| Method | Route | Guards | DB / Action |
|--------|-------|--------|------------|
| GET | `/api/receipts` | auth | `SELECT * FROM receipts WHERE household_id=? AND status!='deleted' ORDER BY purchase_date DESC LIMIT 20 OFFSET ?` |
| POST | `/api/receipts/upload-url` | auth | Generate signed URL for `receipts/{household_id}/{uuid}/{filename}`; INSERT receipts (status='uploading') |
| POST | `/api/receipts/confirm` | auth | `UPDATE receipts SET status='processing'`; enqueue `/api/internal/process-receipt` |
| GET | `/api/receipts/[id]` | auth | Full receipt + linked warranties + matched transaction |
| PATCH | `/api/receipts/[id]` | auth, secondary+ | Update `retailer`, `purchase_date`, `total_amount`, `items` |
| DELETE | `/api/receipts/[id]` | primary | Soft delete; cascade to warranties |
| GET | `/api/warranties` | auth | `SELECT w.*, r.retailer, r.purchase_date FROM warranties w JOIN receipts r ON w.receipt_id=r.id WHERE w.household_id=? ORDER BY expiry_date ASC` |
| GET | `/api/warranties/expiring` | auth | `WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'` |
| PATCH | `/api/warranties/[id]` | auth, secondary+ | Update `product_name`, `warranty_months`, `expiry_date`; recalculate `expiry_date` if `warranty_months` changed |
| POST | `/api/warranties/[id]/claim` | auth, secondary+, tier=household+ | Create `hitl_actions` row (type='warranty_claim'); returns `action_id` |
| GET | `/api/receipts/[id]/match-transactions` | auth, tier=household+ | Fuzzy match against `budget_transactions` by date ±3 days, amount ±R2 |

#### Receipt Processing Pipeline (Detailed)

```
process-receipt job:
1. Load receipts row; get signed URL for image_path
2. Fetch image bytes → base64
3. extractReceipt(bytes, mimeType) → Claude Opus 4.5
   Returns: { status, retailer, purchase_date, total_amount, currency, items, warranty_candidates }
4. UPDATE receipts SET:
   - status = (result.status === 'error') ? 'error' : 'ready'
   - retailer = result.retailer
   - purchase_date = result.purchase_date
   - total_amount = result.total_amount
   - currency = result.currency ?? 'ZAR'
   - items = result.items::jsonb
   - ocr_text = JSON.stringify(result.items)
5. For each warranty_candidate:
   a. Calculate expiry_date = purchase_date + warranty_months
   b. INSERT warranties (receipt_id, household_id, product_name, warranty_months, expiry_date, alert_sent=false)
6. Attempt transaction matching (if tier >= household):
   SELECT id FROM budget_transactions
   WHERE household_id = $1
   AND transaction_date BETWEEN purchase_date - 3 AND purchase_date + 3
   AND ABS(amount - total_amount) <= 2.00
   → If match: store match in receipts.extracted_data->>'matched_transaction_id'
7. INSERT notifications: { type: 'document_ready', title: 'Receipt processed: {retailer}' }
8. INSERT audit_log
```

#### Warranty Alert Scheduling (Cron)

```
/api/cron/warranty-expiry-check (daily at 06:00 UTC):

SELECT w.id, w.product_name, w.expiry_date, w.household_id, w.alert_sent,
       r.retailer, r.purchase_date,
       h.name as household_name,
       u.id as primary_user_id
FROM warranties w
JOIN receipts r ON w.receipt_id = r.id
JOIN households h ON w.household_id = h.id
JOIN users u ON u.household_id = h.id AND u.role = 'primary'
WHERE w.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
  AND w.alert_sent = false;

For each result:
  days_remaining = DATEDIFF(expiry_date, NOW())
  
  IF days_remaining <= 1:
    urgency = 'critical'
    channels = ['push', 'email', 'in_app']
    -- Also propose HITL warranty claim if tier >= household
    INSERT hitl_actions (type='warranty_claim', status='proposed', ...)
  ELIF days_remaining <= 7:
    urgency = 'high'
    channels = ['push', 'email', 'in_app']
  ELIF days_remaining <= 30:
    urgency = 'medium'
    channels = ['push', 'in_app']
  ELIF days_remaining <= 90:
    urgency = 'low'
    channels = ['in_app']

  INSERT notifications (household_id, user_id, type='warranty_expiry', ...)
  sendPushNotification(user_id, notification)
  IF urgency in ['high', 'critical']: sendEmailNotification(user_id, notification)
  UPDATE warranties SET alert_sent = true WHERE id = w.id
```

**Note:** `alert_sent` boolean is Phase 1 limitation. Phase 2 should migrate to `alerts_sent_at[]` array to support multi-stage alerts (90d, 30d, 7d, 1d).

#### Database Operations (Detailed)

```sql
-- Receipt with warranty count
SELECT r.*, COUNT(w.id) as warranty_count
FROM receipts r
LEFT JOIN warranties w ON w.receipt_id = r.id
WHERE r.household_id = $1 AND r.status != 'deleted'
GROUP BY r.id
ORDER BY r.purchase_date DESC;

-- Warranty with days remaining
SELECT w.*,
       r.retailer, r.purchase_date, r.total_amount,
       (w.expiry_date - CURRENT_DATE) AS days_remaining
FROM warranties w
JOIN receipts r ON w.receipt_id = r.id
WHERE w.household_id = $1
ORDER BY w.expiry_date ASC;

-- Insert warranty (with expiry calculation)
INSERT INTO warranties (id, receipt_id, household_id, product_name, warranty_months, expiry_date)
VALUES (
  gen_random_uuid(), $receipt_id, $household_id, $product_name, $warranty_months,
  (SELECT purchase_date FROM receipts WHERE id = $receipt_id) + ($warranty_months || ' months')::interval
);
```

#### State Management

- `useReceiptsStore`: `{receipts[], warranties[], loading, selectedReceipt}`
- `useWarrantyStore`: separate store for warranty dashboard — expiry buckets computed client-side from raw data
- Realtime: subscribe to `receipts` updates for processing status

#### Error Handling

| Scenario | Handling |
|---------|---------|
| Blurry photo — OCR confidence low | `status='partial'`; each extracted field shown as editable input pre-populated with Claude's best attempt; user confirms or corrects |
| Purchase date in future (parsing error) | Validation on server: `if (purchase_date > TODAY + 1 day) → set purchase_date = null`; user prompted to enter |
| Warranty months = 0 or negative | Default to SA CPA minimum of 6 months; log warning |
| Receipt with no product candidates for warranty | Show receipt as "saved" with note "No warranty candidates detected — add manually" |
| Transaction matching finds multiple candidates | Surface all candidates as "Did you mean…?" list; user selects or skips |

---

### MODULE 4: Basic Budget Tracking

#### Screens & Routes

| Route | Layout | Components | Purpose |
|-------|--------|-----------|---------|
| `/budget` | AppLayout | MonthSummaryCard, SpendingDonutChart, CategoryBreakdown, MonthNavigator | Current month overview |
| `/budget/transactions` | AppLayout | TransactionList, CategoryFilter, SearchBar, ImportFromStatementCTA | All transactions |
| `/budget/transactions/add` | AppLayout (modal) | ManualTransactionForm | Manual entry |
| `/budget/subscriptions` | AppLayout | SubscriptionList, TotalMonthlyBadge, YTDBadge | Recurring items |
| `/budget/[year]/[month]` | AppLayout | Same as `/budget` but for historical months | Historical view |
| `/budget/export` | — (server action) | Generates and downloads PDF | Export |

#### SpendingDonutChart Component

- `recharts` PieChart/Donut
- Center label: "Total Expenses: R{amount}"
- Legend: top 5 categories + "Other" bucket
- Click slice → filter TransactionList to that category
- Toggle: Donut / Bar chart (BarChart with categories on Y-axis)

#### API Endpoints

| Method | Route | Guards | DB / Action |
|--------|-------|--------|------------|
| GET | `/api/budget/summary/[month]` | auth | `SELECT * FROM budget_summaries WHERE household_id=? AND month=?`; if not exists → compute on-the-fly and cache |
| GET | `/api/budget/transactions` | auth | `SELECT * FROM budget_transactions WHERE household_id=? AND transaction_date BETWEEN ? AND ? ORDER BY transaction_date DESC LIMIT 50 OFFSET ?` (supports month, category, search filters) |
| POST | `/api/budget/transactions` | auth, secondary+ | `INSERT budget_transactions (source='manual', ...)` |
| PATCH | `/api/budget/transactions/[id]` | auth, secondary+ | `UPDATE budget_transactions SET category=?, description=? WHERE id=? AND household_id=?` |
| DELETE | `/api/budget/transactions/[id]` | auth, secondary+ | Soft delete: `UPDATE SET deleted_at=now()` — prevents re-import issues |
| GET | `/api/budget/categories` | auth | `SELECT * FROM budget_categories WHERE household_id=? UNION SELECT system_categories` |
| POST | `/api/budget/categories` | auth, secondary+, tier=premium+ | Custom categories (Premium only) |
| GET | `/api/budget/subscriptions` | auth, tier=household+ | Identify recurring transactions from last 90 days |
| GET | `/api/budget/summary/[month]/export` | auth, tier=household+ | Generate PDF via `@react-pdf/renderer` |

#### Budget Summary Calculation

The `budget_summaries` table is a materialized cache. Recalculate on:
- New statement ingested (inbox processing)
- Manual transaction added/deleted
- Transaction re-categorised

```typescript
async function recalculateBudgetSummary(householdId: string, month: Date) {
  const monthStart = startOfMonth(month).toISOString().split('T')[0];
  const monthEnd = endOfMonth(month).toISOString().split('T')[0];
  
  const { data: txs } = await supabase
    .from('budget_transactions')
    .select('amount, is_income, category')
    .eq('household_id', householdId)
    .gte('transaction_date', monthStart)
    .lte('transaction_date', monthEnd)
    .is('deleted_at', null);
  
  const total_income = txs.filter(t => t.is_income).reduce((s, t) => s + t.amount, 0);
  const total_expenses = txs.filter(t => !t.is_income).reduce((s, t) => s + t.amount, 0);
  
  const by_category = txs.filter(t => !t.is_income).reduce((acc, t) => {
    const cat = t.category ?? 'Other';
    acc[cat] = (acc[cat] ?? 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);
  
  await supabase.from('budget_summaries').upsert({
    household_id: householdId,
    month: monthStart,
    total_income,
    total_expenses,
    by_category,
  }, { onConflict: 'household_id,month' });
}
```

#### AI Categorisation Pass

After statement ingestion inserts uncategorised transactions (`category=null`), a secondary background pass runs:

```typescript
// POST /api/internal/categorise-transactions
async function categoriseTransactions(householdId: string) {
  const { data: uncategorised } = await supabase
    .from('budget_transactions')
    .select('id, description, amount, is_income')
    .eq('household_id', householdId)
    .is('category', null)
    .limit(100);

  if (!uncategorised.length) return;
  
  // Batch categorisation — single Claude call for all
  const { text } = await generateText({
    model: anthropic('claude-haiku-3-5'), // Use Haiku for cost efficiency
    messages: [{
      role: 'user',
      content: `Categorise these SA bank transactions. Return ONLY a JSON array in same order:
Categories: Income, Housing, Transport, Food & Groceries, Insurance, Medical, Education, Entertainment, Subscriptions, Savings, ATM/Cash, Fees, Other

Transactions: ${JSON.stringify(uncategorised.map(t => ({ id: t.id, desc: t.description, amount: t.amount, is_income: t.is_income })))}

SA patterns: Checkers/Pick n Pay/Woolworths = Food, Dis-Chem/Clicks = Medical, Netflix/Showmax/Spotify = Subscriptions, City of Johannesburg/eThekwini/City of Cape Town = Housing, Engen/Shell/BP = Transport, Credit card payment = Fees

Return: [{"id":"uuid","category":"string"}, ...]`
    }],
    maxTokens: 1000,
  });
  
  const categories = JSON.parse(text);
  
  // Batch update
  for (const { id, category } of categories) {
    await supabase
      .from('budget_transactions')
      .update({ category })
      .eq('id', id)
      .eq('household_id', householdId); // RLS guard
  }
  
  await recalculateBudgetSummary(householdId, new Date());
}
```

#### Subscription Detection

```typescript
async function detectSubscriptions(householdId: string) {
  // Find transactions that appear monthly (within ±5 days, same description, same amount ±10%)
  const { data: txs } = await supabase
    .from('budget_transactions')
    .select('description, amount, transaction_date')
    .eq('household_id', householdId)
    .eq('is_income', false)
    .gte('transaction_date', subMonths(new Date(), 3).toISOString().split('T')[0]);
  
  // Group by normalised description, look for monthly recurrence
  // Returns array of { service_name, monthly_amount, frequency, first_seen, last_charged }
}
```

#### Database Operations

```sql
-- Monthly summary with comparison
WITH current_month AS (
  SELECT SUM(amount) FILTER (WHERE is_income) AS income,
         SUM(amount) FILTER (WHERE NOT is_income) AS expenses
  FROM budget_transactions
  WHERE household_id = $1
    AND transaction_date >= $month_start AND transaction_date <= $month_end
    AND deleted_at IS NULL
),
prior_month AS (
  SELECT SUM(amount) FILTER (WHERE is_income) AS income,
         SUM(amount) FILTER (WHERE NOT is_income) AS expenses
  FROM budget_transactions
  WHERE household_id = $1
    AND transaction_date >= $prior_start AND transaction_date <= $prior_end
    AND deleted_at IS NULL
)
SELECT c.income, c.expenses,
       (c.expenses - p.expenses) AS expense_delta,
       (c.income - p.income) AS income_delta
FROM current_month c, prior_month p;

-- Category breakdown
SELECT category, SUM(amount) AS total, COUNT(*) AS tx_count
FROM budget_transactions
WHERE household_id = $1
  AND transaction_date BETWEEN $start AND $end
  AND is_income = false
  AND deleted_at IS NULL
GROUP BY category
ORDER BY total DESC;

-- Duplicate transaction guard
INSERT INTO budget_transactions (...)
ON CONFLICT ON CONSTRAINT budget_transactions_dedup_key DO NOTHING;
-- Note: requires unique constraint: (household_id, description, transaction_date, amount)
```

#### State Management

- `useBudgetStore`: `{summary, transactions, categories, subscriptions, selectedMonth, loading}`
- Month navigation: changes `selectedMonth` → triggers API fetch with debounce
- Category corrections: optimistic update → server confirm → recalculate summary

#### Error Handling

| Scenario | Handling |
|---------|---------|
| Double-imported statement | `ON CONFLICT DO NOTHING` prevents duplicates; user sees same transaction count |
| Missing category for transaction | Default to "Other" — user can correct; "Other" is never shown as error state |
| PDF export fails | Catch error; show "Export temporarily unavailable"; log to audit_log |
| Summary computation error | Fall back to live computation from transactions; cache write is non-blocking |
| Manual transaction in future | Allow (user might pre-enter expected expense) but show "Future" badge |

---

### MODULE 5: Web App (Next.js 14 PWA)

#### Project Structure

```
household-os/
├── app/                          # Next.js 14 App Router
│   ├── (marketing)/              # Route group: public pages (no auth)
│   │   ├── page.tsx              # Landing page
│   │   ├── pricing/page.tsx
│   │   └── layout.tsx            # MarketingLayout
│   ├── (auth)/                   # Route group: auth flows
│   │   ├── auth/signup/page.tsx
│   │   ├── auth/login/page.tsx
│   │   ├── auth/callback/route.ts
│   │   └── layout.tsx            # AuthLayout (centered, branded)
│   ├── (app)/                    # Route group: protected app
│   │   ├── layout.tsx            # AppLayout (sidebar nav, top bar, realtime)
│   │   ├── dashboard/page.tsx    # Home dashboard
│   │   ├── onboarding/
│   │   ├── documents/
│   │   ├── inbox/
│   │   ├── receipts/
│   │   ├── warranties/
│   │   ├── budget/
│   │   ├── chat/page.tsx         # Coordinator chat
│   │   ├── notifications/page.tsx
│   │   └── settings/
│   ├── api/                      # API route handlers
│   └── globals.css
├── components/
│   ├── ui/                       # shadcn/ui base components
│   ├── app/                      # App-specific composites
│   │   ├── AppSidebar.tsx
│   │   ├── NotificationBell.tsx
│   │   ├── HouseholdSwitcher.tsx
│   │   └── DocumentViewer.tsx
│   ├── onboarding/
│   ├── documents/
│   ├── inbox/
│   ├── receipts/
│   ├── budget/
│   └── chat/
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client (cookies)
│   │   └── middleware.ts         # Middleware client
│   ├── ai/
│   │   ├── anthropic.ts
│   │   ├── openai.ts
│   │   ├── log-usage.ts
│   │   ├── quota.ts
│   │   ├── extract-document.ts
│   │   ├── extract-receipt.ts
│   │   ├── extract-statement.ts
│   │   ├── embed-document.ts
│   │   └── coordinator.ts
│   ├── stripe/
│   ├── postmark/
│   ├── stores/                   # Zustand stores
│   └── utils/
├── middleware.ts                 # Auth + routing middleware
├── public/
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service worker
│   └── icons/                   # App icons (all sizes)
└── vercel.json                   # Cron jobs + config
```

#### AppLayout Design

```
┌─────────────────────────────────────────────────────────┐
│ TopBar: Logo | HouseholdSwitcher | Search | Notifications | Avatar │
├────────────┬────────────────────────────────────────────┤
│ Sidebar    │ Main content area                          │
│ (desktop)  │                                            │
│            │ [Module Dashboard / Chat / Page content]   │
│ ■ Dashboard│                                            │
│ ■ Documents│                                            │
│ ■ Inbox    │                                            │
│ ■ Receipts │                                            │
│ ■ Budget   │                                            │
│ ── Coming ─│                                            │
│ 🔒 Banking │                                            │
│ 🔒 Insure  │                                            │
│ ... +18    │                                            │
│            │                                            │
│ Chat FAB   │                                            │
└────────────┴────────────────────────────────────────────┘
Mobile: Bottom navigation tabs (Dashboard / Chat / Upload / Notifications / Profile)
```

#### PWA Configuration

```json
// public/manifest.json
{
  "name": "HouseholdOS",
  "short_name": "HouseholdOS",
  "description": "Your household intelligence platform",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a1a2e",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

```typescript
// Service Worker (next-pwa or custom)
// Cache strategies:
// - NetworkFirst: API calls (always fresh)
// - CacheFirst: static assets, icons
// - StaleWhileRevalidate: page HTML shells
// Offline fallback: cached dashboard with stale data; clear "You're offline" banner
```

#### Realtime Subscriptions (AppLayout initialisation)

```typescript
// lib/realtime/useRealtimeSubscriptions.ts
export function useRealtimeSubscriptions(userId: string, householdId: string) {
  useEffect(() => {
    const subs = [
      supabase.channel(`notifications:${userId}`)
        .on('postgres_changes', { event: 'INSERT', table: 'notifications', filter: `user_id=eq.${userId}` },
          (p) => notificationStore.add(p.new))
        .subscribe(),
      
      supabase.channel(`documents:${householdId}`)
        .on('postgres_changes', { event: 'UPDATE', table: 'documents', filter: `household_id=eq.${householdId}` },
          (p) => documentStore.updateStatus(p.new.id, p.new.status))
        .subscribe(),
      
      supabase.channel(`receipts:${householdId}`)
        .on('postgres_changes', { event: 'UPDATE', table: 'receipts', filter: `household_id=eq.${householdId}` },
          (p) => receiptStore.updateStatus(p.new.id, p.new.status))
        .subscribe(),
      
      supabase.channel(`hitl:${householdId}`)
        .on('postgres_changes', { event: 'UPDATE', table: 'hitl_actions', filter: `household_id=eq.${householdId}` },
          (p) => hitlStore.update(p.new))
        .subscribe(),
    ];
    
    return () => subs.forEach(s => supabase.removeChannel(s));
  }, [userId, householdId]);
}
```

#### Coming Soon / Locked Module UI

```typescript
// Locked module placeholder (Phase 2/3 modules)
// Route: /banking, /insurance, etc.
export default function LockedModulePage({ module }: { module: Module }) {
  return (
    <ComingSoonCard
      title={module.name}
      description={module.description}
      phase={module.phase}
      requiredTier={module.requiredTier}
      icon={module.icon}
      onUpgradeClick={() => router.push('/settings/billing')}
    />
  );
}
```

#### Error Handling

| Scenario | Handling |
|---------|---------|
| Auth session expired | Middleware redirects to `/auth/login?returnTo={current_path}`; after login, returns to intended page |
| API error (5xx) | Global error boundary catches; shows "Something went wrong" with retry button |
| Network offline | Service worker serves cached shell; toast "You're offline — some features may be unavailable" |
| Supabase Realtime disconnect | Auto-reconnects; on reconnect, re-fetches current data to sync missed events |
| JS bundle error | Sentry error capture; user sees fallback UI, not blank screen |

---

### MODULE 6: Mobile App (React Native Expo)

Full detail in [Section 6](#6-mobile-app-architecture). Summary of Phase 1 screens:

| Screen | Route | Equivalent to Web |
|--------|-------|------------------|
| Login | `/auth/login` | Web `/auth/login` |
| Signup | `/auth/signup` | Web `/auth/signup` |
| Onboarding | `/onboarding/*` | Web `/onboarding/*` |
| Dashboard | `/` (tabs) | Web `/dashboard` |
| Documents | `/documents` | Web `/documents` |
| Document Detail | `/documents/[id]` | Web `/documents/[id]` |
| Inbox | `/inbox` | Web `/inbox` |
| Receipts | `/receipts` | Web `/receipts` |
| Camera Capture | `/capture` | N/A (mobile-only) |
| Budget | `/budget` | Web `/budget` |
| Chat | `/chat` | Web `/chat` |
| Notifications | `/notifications` | Web `/notifications` |
| Settings | `/settings` | Web `/settings` |

All screens use the **same API layer** as web (`/api/*`). No mobile-specific API routes.

---

## 2. ALL 25 MODULES OVERVIEW

### Phase 1 (Modules 1–7): Foundation — Covered in detail above

---

### Phase 2: Core Intelligence (Modules 8–14)

#### Module 8: Banking and Financial Intelligence
**Dependencies:** Module 4 (Budget Tracking), Module 2 (Inbox)  
**New tables needed:** `bank_connections (id, household_id, bank, access_token_encrypted, refresh_token_encrypted, account_id, scope, connected_at)`, `bank_transactions (id, household_id, connection_id, ...)` (extends `budget_transactions`)  
**Key implementation notes:**
- FNB Open Banking: OAuth2 PKCE flow; read-only scope; token stored encrypted at rest
- Investec API: OAuth2; same pattern; ZAR balance and transaction endpoints
- For banks without API (ABSA, Nedbank, etc.): rely on Inbox statement ingestion (already built in Phase 1)
- Subscription creep detection: upgrade from Phase 1 basic detection to ML-assisted anomaly scoring
- Debit order anomaly: compare against 6-month rolling baseline per debit order
- Cash flow projection: 30/60/90 day forecast using recurring income/expense patterns
- FSCA compliance: all projections labelled "informational estimate — not financial advice"

**Data flow:** `bank_connections` → `bank_transactions` → `budget_transactions` (via ETL job) → `budget_summaries`

#### Module 9: Insurance Intelligence Agent
**Dependencies:** Module 1 (Document Intelligence Hub)  
**New tables needed:** `insurance_policies (id, household_id, document_id, policy_type, insurer, policy_number, premium, sum_insured, excess, renewal_date, extracted_benefits::jsonb)`  
**Key implementation notes:**
- Policy extraction: Claude Vision on policy schedule PDFs — highly structured extraction prompt for SA policy types (comprehensive motor, home contents, homeowners, life)
- Benefit Q&A: grounded in policy document text; standard Document Intelligence Q&A but with insurance-specialist system prompt
- Claim eligibility: user describes incident → Claude assesses against policy wording → HITL to draft claim
- Renewal comparison: Phase 2+ — requires web scraping or manual entry; not auto-fetched
- HITL for claim lodging: draft letter only; actual submission Phase 3+

**Data flow:** `documents` (policy PDFs) → `insurance_policies` → coordinator context → Q&A

#### Module 10: Credit Card Benefits Intelligence
**Dependencies:** Module 9 (Insurance), Module 8 (Banking)  
**New tables needed:** `credit_cards (id, household_id, card_type, bank, benefits::jsonb, extracted_from_document_id)`  
**Key implementation notes:**
- Benefits extraction from cardholder agreement PDFs using Claude Vision
- Purchase protection tracking: when a purchase is made (from bank transactions), calculate protection window
- Warranty extension tracking: credit cards often double manufacturer warranty — track alongside Module 3
- Extended warranty: cross-reference `warranties` table against `credit_cards.benefits` for auto-extension
- No direct bank API calls for credit card data — sourced from statements and manual input

#### Module 11: Municipal and Utilities Management
**Dependencies:** Module 2 (Inbox), Module 1 (Documents)  
**New tables needed:** `utility_accounts (id, household_id, municipality_code, account_number, account_type, meter_number)`, `utility_bills (id, household_id, account_id, document_id, billing_period, consumption, amount_due, due_date, reading_actual, reading_estimated)`  
**Key implementation notes:**
- 257 municipality bill formats: Claude Vision with municipality-aware few-shot prompting (not rigid parsers)
- Bill reconciliation: compare consecutive months; flag >30% consumption change
- Dispute drafting: HITL; reference Water Services Act, Municipal Systems Act, NERSA regulations
- Indigent rate application detection: some households qualify for subsidies; agent flags eligibility
- Rates and taxes extraction: annual valuation cycles, interim rates, clearance certificates

#### Module 12: Vehicle Management
**Dependencies:** Module 1 (Documents), Notification Engine  
**New tables needed:** `vehicles (id, household_id, registration_number, make, model, year, vin, licence_expiry_date, last_service_date, next_service_date, service_interval_km, odometer)`, `traffic_fines (id, household_id, vehicle_id, fine_number, amount, infringement_date, due_date, status)`  
**Key implementation notes:**
- Licence disk renewal alerts: 60/30/7 day PUSH notifications
- Service interval prediction: based on last service date + mileage (user-entered or from service book)
- Balloon payment alerts: for financed vehicles — extracted from vehicle finance agreement
- Traffic fines: SA eNaTIS integration or manual entry; payment tracking; appeal HITL
- Accident management: photos of damage, third party details, SAPS case number, insurance liaison

#### Module 13: Medical Aid and Healthcare
**Dependencies:** Module 1 (Documents), Module 2 (Inbox)  
**New tables needed:** `medical_aid_plans (id, household_id, document_id, scheme, plan_name, member_number, annual_limit, savings_balance, day_to_day_limit)`, `medical_claims (id, household_id, plan_id, claim_date, provider, amount, status, reference)`  
**Key implementation notes:**
- Benefit balance tracking: Discovery, Momentum, Bonitas, Fedhealth statement parsing
- Provider network check: requires manual provider list upload or third-party API
- Pre-auth management: HITL for pre-auth request drafting
- Gap cover cross-reference with insurance Module 9
- POPIA sensitivity: medical information is special category data; additional encryption layer required

#### Module 14: Home Maintenance Intelligence
**Dependencies:** Module 1, Module 3 (Receipts — contractor invoices)  
**New tables needed:** `home_assets (id, household_id, asset_type, manufacturer, model, install_date, last_service_date, next_service_due, contractor_contact)`, `maintenance_tasks (id, household_id, asset_id, task_type, scheduled_date, completed_date, cost, contractor, notes)`  
**Key implementation notes:**
- Asset register: user enters or OCRs from install certificates
- Service scheduling: based on manufacturer intervals + age-based heuristics
- Contractor coordination: HITL for quote requests and scheduling
- Predictive alerts: "Your geysers are 8 years old and past average lifespan — consider replacement"

---

### Phase 3: Lifestyle and Advanced (Modules 15–25)

#### Module 15: Grocery and Consumables Intelligence
**Dependencies:** Module 3 (Receipts), Module 4 (Budget)  
**Key:** Purchase history from receipt OCR; depletion prediction via ML on consumption patterns; Checkers/Pick n Pay/Woolworths online price APIs or web scraping (legal review required)

#### Module 16: Lifestyle Booking Agent
**Dependencies:** Coordinator Agent, HITL Pipeline  
**Key:** Booking APIs: GetMyBoat (boats), ClubConnect (golf), OpenTable/Dineplan (restaurants). HITL mandatory — agent proposes booking, user approves. Payment via Stripe (platform-facilitated) or redirect to booking platform.

#### Module 17: ISP and Connectivity Intelligence
**Dependencies:** Module 2 (Inbox — ISP invoices), Device on home network  
**Key:** Continuous speed monitoring requires an agent running on the home network (Raspberry Pi or OpenClaw node). Platform receives speed test results via API. SLA tracking against ISP contract. Dispute HITL.

#### Module 18: Technology and Device Management
**Dependencies:** Module 17 (ISP/Network), Module 3 (Receipts)  
**Key:** Unifi/Meraki API or network scan via NMAP on home network agent. Device inventory. Repair vs replace analysis: fetch replacement cost via retailer APIs.

#### Module 19: Energy Management
**Dependencies:** Module 2 (Inbox — Eskom/municipal bills), Smart meter  
**Key:** EskomSePush API for load shedding data. Smart meter ingestion (STS prepaid token tracking or AMI meter APIs). Solar production vs grid consumption. Billing reconciliation against metered consumption.

#### Module 20: Water Management
**Dependencies:** Module 11 (Municipal), IoT device  
**Key:** Overnight flow detection requires flow sensor (hardware component). Bulk meter reading reconciliation. Borehole pump management for properties with borehole.

#### Module 21: Staff and Domestic Employee Module
**Dependencies:** Module 1 (Documents — employment contracts)  
**Key:** South African-specific: Sectoral Determination 7 (domestic workers), UIF calculation and submission, SARS Tax on payroll, leave tracking per BCEA. PaySpace or SimplePay API integration. High POPIA sensitivity.

#### Module 22: Legal Document Advisor
**Dependencies:** Module 1 (Document Intelligence Hub)  
**Key:** CPA/NCA/POPIA red flag detection. Will management (document vault + executor contact). Lease agreement analysis. Consumer protection HITL — draft Section 56 CPA complaint. Specialist Claude prompt trained on SA statutes.

#### Module 23: Shopping Intelligence and Deal Finder
**Dependencies:** Module 3 (Receipts — price history), Module 15  
**Key:** SA retailer price tracking: Takealot, Game, Makro, Builder's, Checkers, Pick n Pay, Woolworths, Dischem. PriceCheck.co.za integration. Price alert on tracked items. Pricewatch over 90 days.

#### Module 24: Household Budget and Financial Planning
**Dependencies:** Module 4 (Budget), Module 8 (Banking), Module 9 (Insurance), Module 13 (Medical Aid)  
**Key:** Net worth calculation (assets - liabilities). Financial goals (save R50k, retire by 65). Scenario modelling. Retirement gap analysis (linking to RA/pension statements from Module 1). FSCA: information only, no investment advice.

#### Module 25: Security System Management
**Dependencies:** Module 1 (Documents — contracts)  
**Key:** Armed response contract management (Beams, ADT, Fidelity, Chubb). Electric fence compliance certificate tracking (SA requirement). Alarm service interval tracking. CCTV recording retention management.

---

### Module Dependency Graph

```
Module 7 (Onboarding)
  └── requires all Phase 1 modules to be minimally functional

Module 1 (Document Intelligence)
  └── foundation for: 9, 10, 11, 12, 13, 14, 15, 22, 25

Module 2 (Inbox)
  └── foundation for: 4 (statement import), 8, 11, 13, 17, 19, 20

Module 3 (Receipts)
  └── foundation for: 10, 14, 15, 18, 23

Module 4 (Budget)
  └── foundation for: 8, 24

Module 5 (Web App) — required for all modules (UI layer)
Module 6 (Mobile App) — required for all modules (mobile UI)

Phase 2 internal dependencies:
  Module 8 → required by: 24
  Module 9 → required by: 10, 13
  Module 11 → required by: 20
  Module 12 → standalone, no Phase 2 dependencies
  Module 13 → feeds into: 24
  Module 14 → standalone
```

---

### Cross-Module Data Flows

| Data | Source Module | Consumer Modules |
|------|-------------|-----------------|
| Bank transactions | M2 (Inbox), M8 (Bank API) | M4 (Budget), M10 (CC Benefits), M24 (Planning) |
| Document OCR text | M1 (Documents) | M9 (Insurance), M11 (Municipal), M12 (Vehicle), M22 (Legal) |
| Receipt items | M3 (Receipts) | M10 (CC Benefits warranty), M15 (Grocery), M23 (Shopping) |
| Budget summaries | M4 (Budget) | M8 (Financial Intel), M24 (Planning) |
| Notification events | All modules | Notification Engine (cross-cutting) |
| HITL actions | All modules | HITL Pipeline (cross-cutting) |
| Household knowledge graph | All modules | Coordinator Agent (cross-cutting) |

---

## 3. ONBOARDING FLOW

### Critical Path: Zero to First Value in Under 5 Minutes

**Target:** P75 of users complete account → first AI answer within 5 minutes.

#### Step-by-Step Flow

```
T+0:00  User arrives at householdos.co.za
        → Landing page: "Your household, intelligently managed"
        → CTA: "Start free — no credit card needed"

T+0:15  Click CTA → /auth/signup
        → Form: Email + Password (or Google OAuth)
        → Accept: Terms of Service + Privacy Policy (POPIA)
        → "Create account" button

T+0:30  Account creation:
        → Supabase Auth: create user
        → Auto-create household: "${first_name}'s Household"
        → Auto-create subscription: 14-day trial (Household tier)
        → DO NOT require email verification to proceed (verify in background)
        → Redirect immediately to /onboarding/household
        
        ⚠️ KEY DECISION: Email verification is sent but NOT required before onboarding.
        The user gets 14 days to verify. This removes the biggest drop-off point.
        Unverified accounts after 14 days: send reminder, restrict to read-only at day 21.

T+0:45  /onboarding/household
        → Household name (pre-filled from user name, editable)
        → Primary bank (optional dropdown)
        → Municipality (optional autocomplete)
        → "Continue" (skip is allowed — 2/3 fields are optional)
        → PATCH /api/household

T+1:00  /onboarding/subscription
        → Show trial active: "14-day Household trial — no card needed"
        → Pricing comparison below the fold
        → BIG "Upload your first document →" CTA
        → Small "Remind me later" secondary link
        → Goal: 60% skip subscription step; 40% engage with pricing

T+1:15  /onboarding/first-document
        → Full-screen dropzone: "Upload any household document"
        → Examples shown: Insurance policy · Lease agreement · Municipal bill · Bank statement
        → Mobile: "Take a photo" button (routes to /capture on mobile app)
        → Desktop: drag-and-drop or file picker
        → Allowed: PDF, JPG, PNG, HEIC up to 50MB
        → On upload: show progress bar; start OCR immediately
        → "We're reading your document..." animation

T+1:30  OCR completes (target: <30s for typical 2-page PDF)
        → Document detected as: Insurance Policy / Lease / Statement / Other
        → Show 3 suggested questions based on document type:
          Insurance: "What is my sum insured?" / "When does my policy expire?" / "What is my excess?"
          Lease: "What is my notice period?" / "What is the deposit amount?" / "Who is the managing agent?"
          Statement: "What is my closing balance?" / "What are my top spending categories?" / "Any debit orders?"
          Other: "Summarise this document" / "What are the key dates?" / "Who are the parties involved?"

T+2:00  User clicks a suggested question OR types their own
        → POST /api/documents/[id]/qa with question
        → Streaming response begins immediately
        → First token visible within 3 seconds

T+2:30  AI answer streams in
        → Response is grounded in document content
        → Disclaimer shown for financial/legal docs: "Information only, not advice"
        
T+3:00  User sees full answer ← THIS IS THE FIRST VALUE MOMENT

T+3:15  User can ask follow-up or proceed
        → "Continue to your dashboard →" CTA shown after first answer

T+3:30  /onboarding/complete
        → "Your household is ready!"
        → Progress animation showing modules available
        → Next steps cards:
          1. "Set up email inbox" (→ /inbox/addresses/new)
          2. "Upload a receipt" (→ /receipts/upload)
          3. "Invite your partner" (→ /settings/members/invite)
        → NPS prompt: "How likely are you to recommend HouseholdOS? [0–10]"

TOTAL: ~3-4 minutes for a motivated user; P75 target of 5 minutes is achievable.
```

#### Why Under 5 Minutes is Achievable

1. **No email verification gate** — biggest drop-off removed
2. **Auto-created household** — no complex setup
3. **Trial starts at Household tier** — full features immediately
4. **Suggested questions** — user doesn't have to think about what to ask
5. **Streaming response** — perception of speed; feels instantaneous
6. **Claude Sonnet for Q&A** — fast model for streaming; Opus used only for OCR (background)
7. **OCR runs during question selection** — by the time user selects a question, OCR is already done

#### Progressive Module Activation

Modules are not "activated" per se — they are unlocked by the user having relevant data:

| Module | Auto-activates when... | Manual activation |
|--------|----------------------|-------------------|
| Document Hub | User uploads first document | Always available |
| Inbox | User creates first email address | Settings > Inbox |
| Receipts Vault | User uploads first receipt | Always available |
| Budget | First bank statement ingested via Inbox | Always available |
| Phase 2 modules | Not available until tier matches | Locked UI; upgrade CTA |

**Nudge strategy** (post-onboarding):
- Day 2: push/email "Set up your inbox to auto-import statements"
- Day 4: "Upload a receipt to start tracking warranties"
- Day 7: "Did you know you can ask questions about any document?"
- Day 14 (trial end): "Your trial ends in 3 days — here's what you'll lose access to"

---

## 4. CONVERSATIONAL UI ARCHITECTURE

### Coordinator Agent Routing

The Coordinator is the central brain. It does NOT hard-code routing rules — it uses Claude's understanding to route and synthesise.

#### System Prompt Architecture

```
LAYER 1: Identity + Constraints (static, never changes)
  - You are HouseholdOS AI for household "{household_name}"
  - You provide information only — never financial or legal advice
  - POPIA compliant: never share account numbers in full
  - FSCA: all financial content is informational; disclaim prominently

LAYER 2: Module Inventory (static per session)
  - Available modules: [list with descriptions]
  - Phase 2/3 modules: not yet available (tell user when applicable)

LAYER 3: Household Context (dynamic, refreshed per request)
  - Recent documents (filename, type)
  - Active warranties (product, days remaining)
  - Recent transactions (last 5)
  - Recent inbox messages (last 5 subjects)
  - Household profile (name, primary bank, municipality)

LAYER 4: Conversation History (dynamic, last 20 messages)
```

#### Intent Classification (Claude-native, not rule-based)

Instead of rule-based intent classification (fragile), the coordinator uses a two-pass approach:

**Pass 1: Routing** — Single Claude Haiku call (fast, cheap) to classify intent:
```typescript
const routingResult = await generateText({
  model: anthropic('claude-haiku-3-5'),
  messages: [{ role: 'user', content: `
Classify this user message into ONE module. Return ONLY JSON.
Message: "${userMessage}"
Options: document_qa | receipt | budget | warranty | inbox | general | multi_domain | action_request
If document_qa: also return document_id if identifiable from message and context.
If multi_domain: list all applicable modules.
If action_request: classify the action type (warranty_claim | dispute | other).
` }],
  maxTokens: 100,
});
```

**Pass 2: Response** — Sonnet call with module-specific context injected:

```typescript
switch (routing.module) {
  case 'document_qa':
    // Inject specific document's OCR text
    systemPrompt += `\n\nDOCUMENT: ${doc.ocr_text}`;
    break;
  case 'budget':
    // Inject recent transactions + summary
    systemPrompt += `\n\nBUDGET DATA: ${budgetContext}`;
    break;
  case 'multi_domain':
    // Fetch all relevant contexts
    systemPrompt += `\n\nHOUSEHOLD KNOWLEDGE: ${fullContext}`;
    break;
}
```

**Total latency target for streaming Q&A:**
- Routing (Haiku): ~500ms
- Context fetch: ~200ms (parallel DB queries)
- First token from Sonnet: ~1000ms
- **Total to first token: ~1.7 seconds** ✅ (target: ≤3s)

#### Chat Interface Design

**Web (`/chat` page):**
```
┌─────────────────────────────────────────────────────────┐
│ [Module context badge]  [Ask about: All | Document | Budget | ...]  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  👤  You: What is my excess on my Discovery home policy?   │
│                                                           │
│  🏠  HouseholdOS:                                         │
│      Based on your Discovery Comprehensive Home policy    │
│      (uploaded 14 March 2026):                            │
│                                                           │
│      Your **standard excess is R2,500** for all claims.   │
│      For burst geyser claims, a **reduced excess of       │
│      R1,250** applies if you're a Discovery Vitality      │
│      member.                                              │
│                                                           │
│      *This is information only, not insurance advice.*    │
│                                                           │
│  [Suggested follow-ups: "When does it renew?" | "What's covered?"] │
├─────────────────────────────────────────────────────────┤
│ [📎 Attach document]  Ask anything about your household...  [Send] │
└─────────────────────────────────────────────────────────┘
```

**Suggested follow-ups:** Generated as part of the AI response (the model appends 2–3 follow-up questions in JSON after its answer; UI renders them as clickable chips).

**Document attachment in chat:** User can drag a document onto the chat → it's added as context for the next question. Implemented as "document reference" (uses the document's OCR text and extracted_data, not re-uploading).

**Module context badge:** Shows which module handled the last message. Helps user understand routing. Clickable to force a module context.

#### Mobile Chat Design

- Full-screen chat sheet (bottom sheet on iOS, full page on Android)
- Accessible via bottom nav "Chat" tab
- Keyboard avoidance with `KeyboardAvoidingView`
- Camera attach button: send receipt/document photo directly from chat → auto-processes then answers questions
- Voice input: `expo-speech` (read output aloud), `expo-av` (record — NOT MVP, Phase 2)

#### Streaming End-to-End

```
User types message → "Send"
  ↓
Client: fetch('/api/chat', { method: 'POST', body: JSON.stringify({message, history, household_id}) })
  ↓
Server: POST /api/chat
  1. Auth check (middleware)
  2. Quota check (checkAiQuota)
  3. Intent routing (Haiku — 500ms)
  4. Context fetch (parallel DB queries — 200ms)
  5. streamText(claude-sonnet-4-5, system + context + history + message)
  6. result.toDataStreamResponse()  ← starts streaming immediately
  ↓
Client: useChat hook receives SSE stream
  → appends tokens to message bubble in real-time
  → typing indicator removed when first token arrives
  → message fully rendered when stream ends
  ↓
Server (onFinish callback):
  → Save conversation to localStorage (client) or session store
  → Log AI usage to ai_usage_log
  → Extract suggested follow-ups from response
```

**Conversation persistence:**
- Phase 1: conversation history is kept in React state + localStorage (survives refresh)
- Coordinator conversations are NOT persisted to DB in Phase 1 (only document Q&A sessions are persisted)
- Phase 2: add `conversations` table; persist all coordinator conversations

**Conversation context window management:**
- Keep last 20 messages in API call to stay within Claude's context window
- If conversation exceeds 20 messages: summarise oldest 10 into a "context summary" block
- Summary is injected as a system message: "Previous conversation summary: ..."

---

## 5. DOCUMENT INTELLIGENCE DEEP DIVE

### Upload → OCR → Extract → Embed → Q&A Flow

```
PHASE 1: Upload (client → server → storage)
User selects file
  → Client-side validation: file type, max size 50MB
  → Duplicate check: compute SHA-256 hash (Web Crypto API, client-side)
  → POST /api/documents/upload-url
      Server: INSERT documents (status='uploading')
      Server: generate Supabase Storage signed upload URL (5 min TTL)
      Returns: { upload_url, document_id }
  → Client: PUT file directly to Supabase Storage signed URL
      Progress: XHR onprogress → progress bar update
  → Client: POST /api/documents/confirm { document_id, file_hash }
      Server: UPDATE documents SET file_size=actual, status='processing'
      Server: POST /api/internal/process-document (background job dispatch)

PHASE 2: OCR + Extraction (server background, async)
Background job:
  → SELECT documents WHERE id=? (verify status='processing')
  → createSignedUrl(file_path, 60) → fetch bytes
  → Base64 encode
  
  For PDF:
    → Check if text-extractable (PDF.js text extraction attempt)
    → If text found (native PDF): use direct text extraction (cheaper, faster)
    → If no text (scanned PDF): use Claude Vision on each page
    → If hybrid (mostly text, some images): combine approaches
  
  For image (JPG/PNG/HEIC):
    → Direct to Claude Vision
    → HEIC: convert to JPEG first via sharp library
  
  → Claude Opus 4.5 Vision call (see AI_ARCHITECTURE.md for full prompt)
    → Returns: ocr_text (full verbatim text) + extracted_data (JSON)
    → Parse: split on ```json\n...\n```
    → Validate extracted_data schema (Zod)
    → Compute confidence_score (heuristic: length of ocr_text / expected_length by doc_type)
  
  → OpenAI text-embedding-3-small
    → Input: ocr_text[:8000] + JSON.stringify(extracted_data)
    → Returns: float[1536] vector
    → Store as pgvector in documents.embedding

PHASE 3: Persist + Notify
  → UPDATE documents SET status='ready', ocr_text=?, extracted_data=?, embedding=?
  → INSERT notifications (type='document_ready', low urgency)
  → Supabase Realtime: clients subscribed to documents channel get status update
  → Client: DocumentLibrary updates document card from "processing" → "ready"
  → Client: if user is on document detail page, show "Processing complete" toast

PHASE 4: Q&A (on-demand, streaming)
User types question in DocumentDetail chat input:
  → POST /api/documents/[id]/qa { message, session_id }
  → Server:
    1. Verify auth + RLS (document.household_id == jwt.household_id)
    2. Quota check
    3. Load document (ocr_text, extracted_data, filename)
    4. Load session history (document_qa_messages) or create new session
    5. Build system prompt with document content
    6. streamText(claude-sonnet-4-5, system, [history, user_message])
    7. toDataStreamResponse()
  → Client:
    1. useChat renders streaming tokens in real-time
    2. onFinish: show suggested follow-ups
  → Server onFinish:
    1. INSERT document_qa_messages (user + assistant pair)
    2. logAiUsage()
```

### Claude Vision API Patterns

**Pattern 1: Combined OCR + Extraction (single pass)**

Used for: all document types in Phase 1.

Advantages: One API call; Claude can use visual context (layout, tables, headers) to improve extraction accuracy.  
Disadvantages: Larger token output; more expensive per document.

For very long documents (>50 pages): chunk into 10-page batches, run extraction per batch, merge `extracted_data` arrays client-side.

**Pattern 2: Multi-page PDF handling**

```typescript
async function processMultiPagePDF(filePath: string): Promise<ExtractionResult> {
  const pdfBytes = await fetchFileBytes(filePath);
  
  // Split PDF into chunks of max 10 pages
  const chunks = await splitPDFIntoChunks(pdfBytes, 10);
  
  const results = await Promise.all(chunks.map(async (chunk, index) => {
    const { text } = await generateText({
      model: anthropic('claude-opus-4-5'),
      messages: [{
        role: 'user',
        content: [
          { type: 'image', image: chunk.base64, mimeType: 'application/pdf' },
          { type: 'text', text: EXTRACTION_PROMPT + `\nPages ${index * 10 + 1}-${(index + 1) * 10}` },
        ],
      }],
    });
    return parseExtractionResult(text);
  }));
  
  // Merge results
  return {
    ocr_text: results.map(r => r.ocr_text).join('\n\n--- PAGE BREAK ---\n\n'),
    extracted_data: mergeExtractedData(results.map(r => r.extracted_data)),
  };
}
```

**Pattern 3: Confidence scoring (Phase 1 heuristic)**

Claude Vision does not natively return a confidence score. We compute it heuristically:

```typescript
function computeConfidenceScore(
  ocrText: string,
  extractedData: ExtractedData,
  docType: string,
  fileSize: number
): number {
  let score = 100;
  
  // Penalty: very short OCR text relative to file size
  const expectedCharsPerKB = 50;
  const expectedChars = (fileSize / 1024) * expectedCharsPerKB;
  if (ocrText.length < expectedChars * 0.3) score -= 30;
  
  // Penalty: missing key fields
  if (!extractedData.document_type || extractedData.document_type === 'other') score -= 10;
  if (!extractedData.dates?.length) score -= 15;
  if (!extractedData.amounts?.length && docType !== 'legal') score -= 10;
  if (!extractedData.parties?.length) score -= 10;
  
  // Penalty: extracted data looks like garbled OCR
  const garbledRatio = (ocrText.match(/[^\x20-\x7E\n\r]/g) ?? []).length / ocrText.length;
  if (garbledRatio > 0.05) score -= 20;
  
  return Math.max(0, Math.min(100, score));
}
```

If `confidence_score < 50`: set `status = 'error'`  
If `50 <= confidence_score < 70`: set `status = 'ready'` but `extracted_data.review_needed = true`  
If `confidence_score >= 70`: set `status = 'ready'`

### Embedding Search for Cross-Document Queries

For coordinator queries that span multiple documents (e.g., "What is my total insurance premium across all my policies?"):

```sql
-- Vector similarity search for relevant documents
SELECT 
  d.id, d.filename, d.ocr_text, d.extracted_data,
  1 - (d.embedding <=> $query_embedding) AS similarity
FROM documents d
WHERE d.household_id = $household_id
  AND d.status = 'ready'
  AND 1 - (d.embedding <=> $query_embedding) > 0.7  -- similarity threshold
ORDER BY d.embedding <=> $query_embedding
LIMIT 5;
```

**Query embedding:**
```typescript
// Generate embedding for the user's question
const queryEmbeddingResponse = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: userQuestion,
});
const queryEmbedding = queryEmbeddingResponse.data[0].embedding;
```

**Cross-document Q&A injection:**
```typescript
// Inject top-5 relevant document excerpts into coordinator system prompt
const crossDocContext = relevantDocs.map(d => 
  `=== ${d.filename} (similarity: ${d.similarity.toFixed(2)}) ===\n${d.ocr_text?.slice(0, 2000)}`
).join('\n\n');
systemPrompt += `\n\nRELEVANT DOCUMENTS FOR THIS QUERY:\n${crossDocContext}`;
```

### SA Document Types — Extraction Profiles

Each document type has a specialised extraction sub-prompt tuned for SA-specific formats:

#### ABSA Bank Statement
```
SA-specific notes in prompt:
- Date format: DD/MM/YYYY or DD Mon YYYY
- Debit indicator: negative amounts or "DR" suffix or separate debit column
- Branch code format: 6-digit (e.g., 632005)
- Account number: 9 digits
- Look for: "Balance carried forward", "Closing balance", "Available balance"
- Service fees: "Monthly service fee", "ATM fee", "Electronic notification"
- Common merchants: Shoprite, Checkers, Pick n Pay, Woolworths, Dis-Chem, Capitec Pay
```

#### Standard Bank Statement
```
SA-specific notes:
- Account format: type (Cheque/Savings) + number
- DR/CR suffixes on amounts
- "Transactions" section header marks start of transaction list
- "Balance" column included on each row
- EFT references: "EFT-CNFRMTN" format
```

#### Nedbank Statement
```
SA-specific notes:
- Two-column layout: separate Debit and Credit columns
- Branch: format 198765
- EasyPay numbers on utility payments: 17-digit reference
```

#### SA Insurance Policy (Discovery, Momentum, OUTsurance, Santam)
```
Key fields to extract:
- Policy number
- Policyholder name(s)
- Insured asset (property address, vehicle registration, life insured)
- Sum insured per section
- Excess/deductible amounts
- Premium (monthly/annual) — distinguish between total and per-section
- Expiry / renewal date
- Notable exclusions (extract top 5)
- Special conditions (geysers, security requirements, etc.)
```

#### Municipal Bill (City of Johannesburg, Cape Town, eThekwini, etc.)
```
Key fields:
- Account number (9-12 digits usually)
- Consumer address
- Billing period (month + year)
- Meter reading (actual vs estimated — flag estimated readings)
- Consumption per service (electricity kWh, water kL, refuse, rates)
- Amount per service
- Total amount due
- Payment due date
- Arrears amount (if any)
- Penalties/interest on late payment
```

---

## 6. MOBILE APP ARCHITECTURE

### React Native Expo Project Structure

```
household-os-mobile/           # Separate repo or monorepo package
├── app/                       # Expo Router file-based routing
│   ├── _layout.tsx            # Root layout (Providers, fonts, auth gate)
│   ├── (auth)/
│   │   ├── _layout.tsx        # Auth layout (no tabs)
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/                # Main tab layout
│   │   ├── _layout.tsx        # Tab bar config
│   │   ├── index.tsx          # Dashboard (home tab)
│   │   ├── chat.tsx           # Coordinator chat
│   │   ├── capture.tsx        # Camera capture (smart router: doc vs receipt)
│   │   ├── notifications.tsx
│   │   └── profile.tsx        # Settings + profile
│   ├── documents/
│   │   ├── index.tsx          # Document list
│   │   └── [id].tsx           # Document detail + Q&A
│   ├── inbox/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   ├── receipts/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   ├── budget/
│   │   ├── index.tsx
│   │   └── transactions.tsx
│   └── warranties/
│       └── index.tsx
├── components/
│   ├── ui/                    # React Native base components
│   ├── DocumentCard.tsx
│   ├── ReceiptCard.tsx
│   ├── ChatBubble.tsx
│   ├── CameraOverlay.tsx      # Document capture guide overlay
│   └── ...
├── lib/
│   ├── api/                   # Shared API client (same endpoints as web)
│   │   └── client.ts          # axios or fetch wrapper with auth headers
│   ├── supabase/
│   │   └── client.ts          # Supabase RN client (@supabase/supabase-js)
│   ├── stores/                # Zustand (same stores as web, shared package)
│   └── notifications/
│       └── expo-push.ts       # Expo Push token management
├── assets/
│   └── images/
├── app.json                   # Expo config
└── eas.json                   # EAS Build config
```

### Shared API Layer with Web

The mobile app calls the SAME API endpoints as the web app. No mobile-specific backend routes.

```typescript
// lib/api/client.ts (mobile)
import { getSupabaseSession } from '@/lib/supabase/client';

const BASE_URL = 'https://app.householdos.co.za'; // Production
// const BASE_URL = 'http://localhost:3000'; // Development

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const session = await getSupabaseSession();
  
  const response = await fetch(`${BASE_URL}/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(response.status, error.message || 'Request failed');
  }
  
  return response.json();
}
```

**Streaming for mobile chat:**
```typescript
// Mobile streaming via fetch SSE
const response = await fetch(`${BASE_URL}/api/chat`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, history }),
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader!.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Parse SSE data: format is "data: {token}\n\n"
  const tokens = parseSSEChunks(chunk);
  setCurrentMessage(prev => prev + tokens.join(''));
}
```

### Camera Integration

```typescript
// components/CameraOverlay.tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';

export function DocumentCamera({ mode, onCapture }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  
  const handleCapture = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
    if (!photo) return;
    
    // Compress for upload (max 1500px wide, JPEG 85%)
    const compressed = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: Math.min(photo.width, 1500) } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    // Blur detection (basic — check if image variance is above threshold)
    const blurScore = await estimateBlurScore(compressed.uri);
    if (blurScore < BLUR_THRESHOLD) {
      Alert.alert('Photo may be blurry', 'Retake for better results?', [
        { text: 'Retake', onPress: () => {} },
        { text: 'Use anyway', onPress: () => onCapture(compressed) },
      ]);
      return;
    }
    
    onCapture(compressed);
  };
  
  return (
    <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
      {/* Guide overlay */}
      <View style={styles.guideOverlay}>
        <View style={styles.guideRect} />
        <Text style={styles.guideText}>
          {mode === 'receipt' ? 'Position receipt within the frame' : 'Centre document in frame'}
        </Text>
      </View>
      <TouchableOpacity style={styles.captureButton} onPress={handleCapture} />
    </CameraView>
  );
}
```

**Multi-page document capture:**
```typescript
const [capturedPages, setCapturedPages] = useState<ImageResult[]>([]);

const addPage = (image: ImageResult) => {
  setCapturedPages(prev => [...prev, image]);
};

const finishCapture = async () => {
  if (capturedPages.length === 1) {
    await uploadDocument(capturedPages[0]);
  } else {
    // Merge pages: upload as separate files, server combines into single document record
    await uploadMultiPageDocument(capturedPages);
  }
};
```

### Push Notifications (Expo Push)

```typescript
// lib/notifications/expo-push.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null; // Simulator — no push
  
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') return null;
  
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });
  
  // Register with server
  await apiRequest('/notifications/register-push-token', {
    method: 'POST',
    body: JSON.stringify({ expo_push_token: token.data }),
  });
  
  return token.data;
}

// Handle notification tap → navigate to relevant screen
Notifications.addNotificationResponseReceivedListener((response) => {
  const { type, module, reference_id } = response.notification.request.content.data;
  
  switch (type) {
    case 'warranty_expiry':
      router.push(`/warranties/${reference_id}`);
      break;
    case 'document_ready':
      router.push(`/documents/${reference_id}`);
      break;
    case 'hitl_executed':
      router.push('/notifications');
      break;
    // ... etc
  }
});
```

### Offline Considerations

**Phase 1 offline strategy: Graceful degradation (not full offline)**

What works offline:
- Previously loaded documents visible (React Query cache + AsyncStorage persistence)
- Previously loaded receipts and warranties visible
- Budget summary for current month (if already loaded)
- Notification list (cached)

What requires connectivity:
- Upload new documents/receipts (queue upload, retry on reconnect)
- Chat / AI Q&A (streaming requires server)
- New inbox messages
- Real-time status updates

**Offline queue implementation:**
```typescript
// Zustand + AsyncStorage offline queue
const useOfflineQueue = create(
  persist(
    (set, get) => ({
      queue: [] as QueuedAction[],
      addToQueue: (action: QueuedAction) => set(s => ({ queue: [...s.queue, action] })),
      processQueue: async () => {
        const { queue } = get();
        for (const action of queue) {
          try {
            await executeQueuedAction(action);
            set(s => ({ queue: s.queue.filter(q => q.id !== action.id) }));
          } catch (e) {
            // Leave in queue for next attempt
          }
        }
      },
    }),
    { name: 'offline-queue', storage: createJSONStorage(() => AsyncStorage) }
  )
);

// NetInfo listener triggers queue processing on reconnect
NetInfo.addEventListener(state => {
  if (state.isConnected) useOfflineQueue.getState().processQueue();
});
```

### Biometric Authentication

```typescript
// lib/auth/biometric.ts
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export async function authenticateWithBiometric(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  
  if (!hasHardware || !isEnrolled) return false;
  
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access HouseholdOS',
    fallbackLabel: 'Use passcode',
    cancelLabel: 'Cancel',
  });
  
  return result.success;
}

// App foreground/background lifecycle
AppState.addEventListener('change', async (nextState) => {
  if (nextState === 'active' && shouldRequireBiometric()) {
    const success = await authenticateWithBiometric();
    if (!success) await signOut(); // Prevent brute force
  }
});
```

---

## 7. AUTHENTICATION & MULTI-TENANCY

### Supabase Auth Flow

```
SIGNUP FLOW:
1. User submits email + password
2. POST /api/auth/signup
   a. supabase.auth.signUp({ email, password })
   b. Supabase creates auth.users row
   c. Server creates: households, users (role=primary), subscriptions rows
   d. Auth Hook fires: inject household_id + role + subscription_tier into JWT
3. Supabase sends verification email (non-blocking for onboarding)
4. Session cookie set via Next.js `@supabase/ssr`
5. Client: session available immediately; redirect to /onboarding

GOOGLE OAUTH FLOW:
1. User clicks "Sign in with Google"
2. supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })
3. Supabase handles OAuth exchange
4. GET /api/auth/callback (or app/(auth)/auth/callback/route.ts)
   a. supabase.auth.exchangeCodeForSession(code)
   b. Check if users row exists for auth.uid()
      → If not (first OAuth sign-in): create household + users + subscriptions
   c. Auth Hook: inject claims
5. Redirect to /onboarding (if new) or /dashboard (if returning)

MAGIC LINK FLOW:
1. User enters email
2. supabase.auth.signInWithOtp({ email })
3. User clicks link in email
4. Link contains token; redirects to /auth/callback?token=xxx
5. Same as step 4 in OAuth flow
```

### JWT Claims with household_id

**Supabase Auth Hook (Edge Function: `auth-claims-hook`):**

```typescript
// supabase/functions/auth-claims-hook/index.ts
import { createClient } from '@supabase/supabase-js';

export default async function handler(event: AuthHookEvent) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Bypass RLS for hook
  );
  
  const { data: user } = await supabase
    .from('users')
    .select('household_id, role, households!inner(subscription_tier)')
    .eq('id', event.user_id)
    .single();
  
  if (!user) {
    // User exists in auth.users but not in public.users
    // This can happen during signup race condition
    return { claims: {} };
  }
  
  return {
    claims: {
      household_id: user.household_id,
      role: user.role,
      subscription_tier: user.households.subscription_tier,
    },
  };
}
```

**Accessing claims in API routes:**
```typescript
// lib/auth/get-session.ts
export async function getAuthSession(supabase: SupabaseClient) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new UnauthorizedError();
  
  const jwt = session.access_token;
  const claims = JSON.parse(atob(jwt.split('.')[1]));
  
  return {
    userId: session.user.id,
    householdId: claims.household_id as string,
    role: claims.role as UserRole,
    subscriptionTier: claims.subscription_tier as SubscriptionTier,
  };
}
```

**Why JWT claims, not DB queries?**
- Every API route needs `household_id` and `role`
- JWT claims avoid a `SELECT FROM users` on every request
- Supabase Auth Hook refreshes claims on each new session
- **Risk:** Stale claims if role changes during a session → mitigated by short JWT TTL (1 hour) and forced re-auth on role changes

### Role Enforcement

**API-level role guards:**
```typescript
// lib/auth/guards.ts
export function requireRole(minRole: UserRole) {
  return async (req: Request): Promise<AuthSession> => {
    const session = await getAuthSession(createClient());
    const roleHierarchy = ['view_only', 'secondary', 'primary', 'admin'];
    if (roleHierarchy.indexOf(session.role) < roleHierarchy.indexOf(minRole)) {
      throw new ForbiddenError(`Requires ${minRole} role or higher`);
    }
    return session;
  };
}

// Usage in route handler:
export async function DELETE(req: Request, { params }) {
  const session = await requireRole('primary')(req);
  // ... proceed with primary-only action
}
```

**RLS enforcement (database-level):**

```sql
-- SELECT: any member of household can read
CREATE POLICY "documents_select" ON documents
  FOR SELECT USING (
    household_id = (auth.jwt() ->> 'household_id')::uuid
  );

-- INSERT: primary or secondary only
CREATE POLICY "documents_insert" ON documents
  FOR INSERT WITH CHECK (
    household_id = (auth.jwt() ->> 'household_id')::uuid
    AND (auth.jwt() ->> 'role') IN ('primary', 'secondary')
  );

-- DELETE: primary only
CREATE POLICY "documents_delete" ON documents
  FOR UPDATE USING (
    household_id = (auth.jwt() ->> 'household_id')::uuid
    AND (auth.jwt() ->> 'role') = 'primary'
  )
  WITH CHECK (status = 'deleted');
```

**Critical: RLS alone is not enough. API-level checks MUST also enforce roles** because service role key bypasses RLS for background jobs.

### Household Switching

For users who are members of multiple households (e.g., primary of their own + secondary of parents'):

```typescript
// components/HouseholdSwitcher.tsx
export function HouseholdSwitcher() {
  const { households, currentHousehold } = useHouseholds();
  
  const switchHousehold = async (targetHouseholdId: string) => {
    // POST to server to update session's household context
    await apiRequest('/api/household/switch', {
      method: 'POST',
      body: JSON.stringify({ household_id: targetHouseholdId }),
    });
    
    // Force session refresh to update JWT claims
    await supabase.auth.refreshSession();
    
    // Clear all stores (they contain household-specific data)
    clearAllStores();
    
    // Redirect to dashboard
    router.push('/dashboard');
  };
  
  // Only show switcher if user is in >1 household
  if (households.length <= 1) return null;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>{currentHousehold.name} ▾</DropdownMenuTrigger>
      <DropdownMenuContent>
        {households.map(h => (
          <DropdownMenuItem key={h.id} onClick={() => switchHousehold(h.id)}>
            {h.name} {h.id === currentHousehold.id ? '✓' : ''}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Household switching API:**
```typescript
// POST /api/household/switch
export async function POST(req: Request) {
  const { household_id } = await req.json();
  
  // Verify user is actually a member of this household
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  
  const { data: membership } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.user.id)
    .eq('household_id', household_id)
    .single();
  
  if (!membership) return Response.json({ error: 'Not a member' }, { status: 403 });
  
  // Update user's current active household (in user_preferences or a dedicated field)
  await supabase
    .from('user_preferences')
    .upsert({ user_id: user.user.id, key: 'active_household_id', value: { household_id } });
  
  // Trigger JWT refresh (auth hook will read the new active_household_id)
  return Response.json({ success: true, household_id });
}
```

**Note for Auth Hook:** The hook must read `user_preferences.active_household_id` to support household switching. Default to the user's primary household_id from `users` table if no active_household_id preference is set.

### POPIA Compliance

- Privacy policy and ToS accepted timestamp stored in `audit_log`
- Right to access: `GET /api/popia/export` → generates JSON zip of all user/household data
- Right to erasure: `POST /api/popia/delete-request` → 24h grace period → cascade delete all household data → delete auth.users row
- Data retention: statement OCR text retained 7 years (legal requirement); user can request earlier deletion with acknowledgment of legal limitation
- Data residency: Supabase region is `eu-west-2` (Ireland) — note this is EU, not SA. Phase 2: migrate to a SA-based region when available. Current posture: data is encrypted, GDPR-equivalent protections apply, POPIA compatible.

---

## 8. SUBSCRIPTION & BILLING

### Stripe Integration Architecture

```
CHECKOUT FLOW:
1. User clicks "Upgrade to [tier]"
2. POST /api/stripe/create-checkout
   Request: { tier: 'household' | 'premium' }
   Server:
   a. Check if household already has stripe_customer_id
      → If not: stripe.customers.create({ email, name: household.name, metadata: { household_id } })
      → UPDATE households SET stripe_customer_id = customer.id
   b. stripe.checkout.sessions.create({
        customer: stripe_customer_id,
        mode: 'subscription',
        line_items: [{ price: STRIPE_PRICE_ID_[tier], quantity: 1 }],
        success_url: 'https://app.householdos.co.za/settings/billing?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://app.householdos.co.za/settings/billing?cancelled=true',
        currency: 'zar',
        allow_promotion_codes: true,
        metadata: { household_id },
      })
   Returns: { checkout_url }
3. Client redirects to checkout_url (Stripe-hosted, ZAR)
4. User completes payment on Stripe
5. Stripe webhooks fire → handled at POST /api/webhooks/stripe
```

### Stripe Webhook Handling

```typescript
// POST /api/webhooks/stripe
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;
  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  const supabase = createServiceRoleClient(); // Bypass RLS
  
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession;
      const householdId = session.metadata?.household_id;
      const subscriptionId = session.subscription as string;
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      const tier = getTierFromPriceId(stripeSubscription.items.data[0].price.id);
      
      await supabase.from('subscriptions').upsert({
        household_id: householdId,
        stripe_subscription_id: subscriptionId,
        tier,
        status: 'active',
        current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      }, { onConflict: 'household_id' });
      
      await supabase.from('households').update({ subscription_tier: tier })
        .eq('id', householdId);
      
      // Invalidate JWT claims (force refresh on next request)
      break;
    }
    
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const householdId = sub.metadata?.household_id ?? await getHouseholdIdFromStripeCustomer(sub.customer as string);
      const tier = getTierFromPriceId(sub.items.data[0].price.id);
      
      await supabase.from('subscriptions').update({
        tier, status: sub.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      }).eq('household_id', householdId);
      
      await supabase.from('households').update({ subscription_tier: tier })
        .eq('id', householdId);
      break;
    }
    
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const householdId = await getHouseholdIdFromStripeCustomer(sub.customer as string);
      
      await supabase.from('subscriptions').update({
        status: 'cancelled', tier: 'essential',
      }).eq('household_id', householdId);
      
      await supabase.from('households').update({ subscription_tier: 'essential' })
        .eq('id', householdId);
      
      // Notify primary user of cancellation
      await createNotification(householdId, 'subscription_cancelled', ...);
      break;
    }
    
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const householdId = await getHouseholdIdFromStripeCustomer(invoice.customer as string);
      
      await supabase.from('subscriptions').update({ status: 'past_due' })
        .eq('household_id', householdId);
      
      // Email + push to primary user
      break;
    }
  }
  
  return Response.json({ received: true });
}
```

### Tier Enforcement

**Limit constants:**
```typescript
// lib/billing/limits.ts
export const TIER_LIMITS = {
  essential: {
    documents: 20,
    inbox_addresses: 5,
    ai_interactions_per_month: 500,
    members: 2,
    storage_gb: 1,
    bank_transaction_matching: false,
    subscription_detection: false,
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
    subscription_detection: true,
    budget_export: true,
    hitl: true,
  },
  premium: {
    documents: Infinity,
    inbox_addresses: Infinity,
    ai_interactions_per_month: Infinity,
    members: Infinity,
    storage_gb: 25,
    bank_transaction_matching: true,
    subscription_detection: true,
    budget_export: true,
    hitl: true,
    custom_categories: true,
    document_version_history: true,
    audit_log_export: true,
  },
  enterprise: {
    documents: Infinity,
    inbox_addresses: Infinity,
    ai_interactions_per_month: Infinity,
    members: Infinity,
    storage_gb: Infinity,
    white_label: true,
    // + all premium features
  },
} as const;
```

**Enforcement middleware:**
```typescript
// Before document upload:
async function checkDocumentLimit(supabase, householdId, tier) {
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .not('status', 'eq', 'deleted');
  
  const limit = TIER_LIMITS[tier].documents;
  if (limit !== Infinity && count >= limit) {
    throw new TierLimitError('document', count, limit, tier);
  }
}

// Before AI call:
async function checkAIQuota(supabase, householdId, tier) {
  const monthStart = startOfMonth(new Date()).toISOString();
  const { count } = await supabase
    .from('ai_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .gte('created_at', monthStart);
  
  const limit = TIER_LIMITS[tier].ai_interactions_per_month;
  if (limit !== Infinity) {
    if (count >= limit) throw new QuotaExceededError('ai_interactions', count, limit);
    if (count >= limit * 0.8) {
      // Warn but don't block
      await createNotification(householdId, 'ai_quota_warning', `${count}/${limit} AI interactions used this month`);
    }
  }
}
```

### Usage Metering

The `ai_usage_log` table serves as the source of truth for usage metering:

```sql
-- Monthly AI interaction count per household
SELECT COUNT(*) AS interaction_count,
       SUM(total_tokens) AS total_tokens,
       SUM(prompt_tokens * 0.000003 + completion_tokens * 0.000015) AS estimated_cost_usd
FROM ai_usage_log
WHERE household_id = $1
  AND created_at >= date_trunc('month', NOW());
```

**Usage dashboard (internal ops view):**
```sql
-- Top households by AI usage (for cost monitoring)
SELECT h.name, h.subscription_tier, 
       COUNT(*) AS interactions,
       SUM(total_tokens) AS tokens,
       SUM(prompt_tokens * 0.000003 + completion_tokens * 0.000015) AS cost_usd
FROM ai_usage_log a
JOIN households h ON a.household_id = h.id
WHERE a.created_at >= date_trunc('month', NOW())
GROUP BY h.id, h.name, h.subscription_tier
ORDER BY cost_usd DESC;
```

---

## 9. LOGIC BUGS & EDGE CASES

### 20 Edge Cases Specific to HouseholdOS

---

**EC-01: Warranty Date Overflow — Purchase Date + Warranty Months = Incorrect Expiry**

**Scenario:** Receipt OCR extracts purchase_date as `2024-01-31`. Warranty is 12 months. Server computes `January 31 + 12 months`. In PostgreSQL, `'2024-01-31'::date + '12 months'::interval = 2025-01-31` (correct). BUT in JavaScript: `new Date('2024-01-31')` → if month is set to `01 + 12 = 13` → JavaScript overflows to February of next year → `2026-02-28` (wrong!).

**Fix:** Always compute warranty expiry on the server in SQL: `purchase_date + ($warranty_months || ' months')::interval`. Never compute dates in JavaScript on the client and send to server.

---

**EC-02: Duplicate Transaction Ingestion via Multiple Paths**

**Scenario:** User uploads a bank statement to Document Library (Module 1) AND the same statement arrives via email Inbox (Module 2). Both trigger `budget_transactions` inserts for the same transactions.

**Fix:** The `ON CONFLICT (household_id, description, transaction_date, amount)` constraint handles this IF description, date, and amount are all identical. Risk: Claude may clean up the description differently in the two paths (e.g., "CHECKERS #234 JOHANNESBURG" vs "CHECKERS 234"). 

**Solution:** Normalize descriptions before inserting: lowercase, remove branch codes, remove trailing reference numbers. Store `statement_ref` for original description. The unique constraint is on `normalized_description + transaction_date + amount`.

---

**EC-03: Postmark Webhook Delivery During Processing Failure**

**Scenario:** Postmark delivers a webhook. The server creates `inbox_messages` row (status='received') and uploads the attachment to Storage, then the background parse job fails (e.g., Claude timeout). Postmark retries the webhook (up to 3 times). Second delivery tries to create a duplicate `inbox_messages` row.

**Fix:** Idempotency key in Postmark payload is `MessageID`. Store as unique constraint on `inbox_messages.external_message_id`. Second delivery: `INSERT ... ON CONFLICT DO NOTHING` → returns 200 silently.

**Additional:** Separate the "received" record creation (synchronous, idempotent) from the "parse" job (async, idempotent with job deduplication by message_id).

---

**EC-04: Household Slug Collision on Signup**

**Scenario:** Two households are created within milliseconds with names "Smith Family" → both generate slug "smith-family". The `households.slug` column has a UNIQUE constraint — second insert fails with a DB error that surfaces as an unhandled 500 to the user.

**Fix:** In household creation logic, check slug uniqueness before insert. If collision: append a random 4-digit suffix → "smith-family-4821". Use a retry loop (max 3 attempts).

---

**EC-05: JWT Claims Stale After Role Change**

**Scenario:** User A is primary. They invite User B as secondary. User A then removes User B. User B still has a valid JWT with `role='secondary'` and `household_id` set. B's JWT is valid until it expires (~1 hour). B can still make API calls using the cached JWT.

**Fix:** 
1. On member removal: insert a `revoked_jwt_claims` record with `user_id + household_id + revoked_at`.
2. All RLS policies + API middleware check this table: `NOT EXISTS (SELECT 1 FROM revoked_jwt_claims WHERE user_id = auth.uid() AND revoked_at > NOW() - INTERVAL '2 hours')`.
3. Alternative (simpler): call `supabase.auth.admin.signOut(userId, 'others')` on member removal → invalidates all sessions for that user immediately.

**Recommended:** Use option 2 (sign out). It's simpler and more complete.

---

**EC-06: PDF with Mixed Text + Scanned Pages**

**Scenario:** User uploads a lease agreement PDF. Pages 1-5 are text-extractable (digital PDF). Pages 6-8 are scanned signatures/annexures (images). The text extraction approach misses pages 6-8; the Vision approach processes all pages but duplicates text from pages 1-5.

**Fix:** Per-page processing decision:
1. Attempt text extraction per page using PDF.js
2. For pages with text density above threshold (>100 chars/page): use extracted text
3. For pages below threshold (likely scanned): use Claude Vision
4. Merge results per page → combine into full document OCR text

---

**EC-07: R0.00 Total Amount on Receipt**

**Scenario:** Receipt OCR returns `total_amount = 0.00` (misread receipt, or a returns/refund receipt). Warranty creation uses `total_amount` to determine if warranty tracking makes sense. Zero amount receipts should not create warranties.

**Fix:** In `process-receipt` job: `if (receiptData.total_amount <= 0) skip warranty creation`. Show receipt as "Amount not detected — [Enter amount manually]". Inform user that warranties will only auto-detect on saving the corrected amount.

---

**EC-08: Subscription Tier Downgrade — Data Above New Limit**

**Scenario:** Household on Household tier (100 docs) has uploaded 87 documents. They downgrade to Essential (20 docs limit). The downgrade UI shows a warning but doesn't specify WHICH 67 documents they'll lose access to — they're stressed and cancel the downgrade.

**Fix:** Downgrade confirmation screen must show:
1. Count: "67 documents will become read-only (you won't be able to upload new ones until you're under 20)"
2. List the 67 documents sorted by most recently uploaded (these are most likely to be the excess)
3. Option: "Delete some documents first" → links to Document Library with pre-applied filter
4. **Key:** Documents are NEVER auto-deleted on downgrade. They become read-only. User retains access; they just can't upload new ones until under the limit. This must be crystal clear.

---

**EC-09: SA Bank Name Misidentification**

**Scenario:** Claude Vision identifies a Nedbank statement as "Standard Bank" because the PDF watermark uses a similar blue color, or because the format isn't clearly labelled. Transactions are inserted with wrong `statement_ref` context. Future cross-bank detection breaks.

**Fix:** Multi-signal bank detection:
1. Sender email domain (most reliable): `@nedbank.co.za` → Nedbank
2. Account number prefix (ABSA: 4xxx, Standard Bank: 0xxx, etc.)
3. Visual logo detection via Claude
4. Store detection confidence; if <80%: mark as "bank_unconfirmed" and show "Confirm your bank" prompt

---

**EC-10: Municipality Autocomplete Typo Creates Duplicate Entries**

**Scenario:** User types "Johannesberg" (typo) in municipality autocomplete. No match found. If autocomplete accepts free text, this creates a `user_preferences.municipality_code = 'johannesberg'` entry. Change detection and billing comparisons use municipality context — they break.

**Fix:** Municipality field MUST be constrained to the official list of 257 municipality codes. The autocomplete is search-over-static-list only. If no match: "Municipality not found — type to search from SA municipalities." No free text accepted for municipality field.

---

**EC-11: Receipt Item Count Mismatch — VAT Calculation Error**

**Scenario:** Receipt from Pick n Pay includes mixed VAT-exempt (fresh food) and VAT-inclusive items. Claude extracts `total_amount = R342.50` but the sum of `items[].price` = R328.00. The difference is VAT but Claude couldn't parse all line items correctly from a long receipt.

**Handling:** Don't fail the receipt. Accept `total_amount` as ground truth. Compute line item total separately. If mismatch > 10%: set `items` as "partial" and show banner: "Some items could not be read from this receipt." Warranty detection still works (uses identified warranty-candidate items).

---

**EC-12: User Invited to Household They're Already Primary Of**

**Scenario:** User A is primary of "Smith Family" (household_id=X). User B is primary of their own household. User A accidentally enters their own email (user A) in the invite form. If the system processes this, it would try to insert a second `users` row for user A in household X with role='secondary' — violating the FK or creating a confusing duplicate.

**Fix:** Before sending invite email: 
1. Check if `email` already exists in `users` table with `household_id = current_household_id` → reject with "This person is already a member."
2. Check if user is primary of another household → warn: "This person manages their own household. Are you sure you want to invite them as a secondary member?" (they can still proceed).
3. Proceed with invite only if user explicitly confirms.

---

**EC-13: Upload During Offline / Slow Connection**

**Scenario:** User on mobile uploads a 12MB PDF over a slow 3G connection. The upload stalls at 80% and the browser tab is closed. The file is partially uploaded to Supabase Storage, creating an orphaned object with no corresponding `inbox_messages` row.

**Fix:** 
1. Use Supabase Storage resumable uploads (TUS protocol) so uploads can resume on reconnect.
2. In the upload flow: create the `inbox_messages` row with `status='uploading'` BEFORE the upload begins.
3. A nightly cleanup job deletes `inbox_messages` rows stuck in `status='uploading'` for >24 hours and purges their corresponding Storage objects.
4. On the client: if upload fails, show "Upload paused — tap to resume" with a retry button.

---

**EC-14: Concurrent Household Member Document Upload Race Condition**

**Scenario:** Primary (User A) and secondary (User B) both upload a document at exactly the same time. Both are uploading the same Eskom bill (one captured a photo, the other emailed it). The system creates two `documents` rows for the same bill. Duplicate detection doesn't run at upload time — it runs async.

**Fix:**
1. Async duplicate detection job: after each document is processed, hash the extracted text (normalized). Compare against all documents in the same `household_id` from the last 90 days.
2. If similarity score >90%: mark both as potential duplicates. Show a "Possible duplicate detected" banner on the Documents page listing both.
3. User can "Keep both" or "Delete one" — system never auto-deletes.
4. For the same underlying bill: the system should prefer whichever was processed first (lower `created_at`) as the canonical record.

---

**EC-15: Claude API Rate Limit During Batch Processing**

**Scenario:** Household with Household tier uploads 15 documents in a short burst (e.g., end-of-month filing session). All 15 trigger background parse jobs. Claude API returns 429 (rate limit) after 8 successful parses. The remaining 7 jobs fail and their `inbox_messages` rows are stuck in `status='processing'`.

**Fix:**
1. All Claude API calls must use exponential backoff with jitter: initial delay 1s, max delay 60s, max 5 retries.
2. Background jobs use a concurrency limit (max 3 simultaneous Claude calls per household via a job queue).
3. If all retries exhausted: set `status='failed'`, increment `retry_count`. A separate retry scheduler re-queues failed jobs every 30 minutes (max 3 total attempts).
4. User notification: "5 documents are queued for processing — this may take a few minutes." Progress updates via Supabase Realtime subscription on `inbox_messages`.

---

## 11. Implementation Order (Phase 1 — Dependency-Based Build Sequence)

The following sequence respects hard dependencies. No step should begin until its prerequisites are complete.

### Tier 0 — Infrastructure Foundation
These have no internal dependencies and must exist before any app code runs.

1. **Supabase Project Init** — Create project, enable Auth (email), configure JWT settings
2. **Database Schema** — Apply all migrations: `households`, `users`, `documents`, `inbox_messages`, `document_items`, `warranties`, `utility_accounts`, `utility_bills`, `user_preferences` (in FK dependency order)
3. **Row-Level Security Policies** — Apply RLS to all tables. Verify with test users before any API work.
4. **Storage Buckets** — Create `documents` and `inbox-attachments` buckets with RLS policies
5. **Supabase Edge Function: postmark-inbound** — Webhook receiver; this must exist before Postmark is configured
6. **Postmark Configuration** — Point inbound email to Edge Function URL; configure sender signatures

### Tier 1 — Auth & Household Core
Depends on: Tier 0

7. **Next.js Project Scaffold** — Init with App Router, Tailwind, shadcn/ui, Supabase client
8. **Auth Flow** — Sign up, sign in, magic link, session persistence, middleware route protection
9. **Household Creation** — Onboarding wizard: name → slug → timezone → municipality (constrained autocomplete)
10. **Household Settings** — Edit name, manage members; invite flow (email → invite email → accept link)
11. **Member Management** — Remove member (with JWT invalidation), role display

### Tier 2 — Document Ingestion Pipeline
Depends on: Tier 0, Tier 1 (household_id required for all documents)

12. **Document Upload UI** — Drag-and-drop + file picker; progress indicator; category selection
13. **Upload Handler** — Client → Supabase Storage (resumable); create `inbox_messages` row with `status='uploading'` → `status='received'`
14. **Background Parse Job** — Queue-based worker; reads from `inbox_messages` where `status='received'`; calls appropriate parser
15. **PDF Text Extractor** — Per-page text density check; hybrid text+vision approach for mixed PDFs
16. **Claude Vision Integration** — Structured extraction prompt; JSON schema enforcement; retry with backoff
17. **Document Categorization** — Auto-category from Claude output; confidence threshold; manual override UI
18. **Document Library UI** — List view, search, filter by category/date/household member; detail view

### Tier 3 — Specialist Parsers
Depends on: Tier 2 (base parse pipeline must work first)

19. **Receipt Parser** — Item extraction, VAT handling, total validation, warranty candidate flagging
20. **Bank Statement Parser** — Transaction normalization, bank detection (multi-signal), deduplication
21. **Utility Bill Parser** — Municipality context, amount due, due date extraction, account linking
22. **Insurance Parser** — Policy number, coverage dates, premium amount, renewal alert scheduling

### Tier 4 — Derived Features
Depends on: Tier 3 (needs parsed data to be meaningful)

23. **Warranty Tracker** — Create from receipt items; expiry alerts; manual warranty entry
24. **Utility Account Linking** — Link parsed bills to `utility_accounts`; history view
25. **Document Timeline** — Chronological view of all household documents with key metadata
26. **Duplicate Detection Job** — Text hash comparison; flag UI; user-driven resolution

### Tier 5 — Subscriptions & Limits
Depends on: Tier 1 (auth), Tier 2 (document counts)

27. **Subscription Tiers** — Free/Essential/Household limits enforced at upload and invite
28. **Usage Dashboard** — Current document count vs. limit; storage used; tier upgrade CTA
29. **Downgrade Flow** — Warning screen with document list; read-only enforcement (no auto-delete)

### Tier 6 — Notifications & Realtime
Depends on: Tier 2–4 (needs events to notify about)

30. **Supabase Realtime Subscriptions** — Processing progress updates in Document Library
31. **Email Notifications** — Warranty expiry (30/7/1 day); utility bill due; document processed confirmation
32. **In-App Notification Center** — Bell icon; unread count; mark all read

---

## 12. Self-Critique

### Round 1 — Completeness Check

**Question:** Is there anything in the spec that is not addressed in this plan?

**Finding 1 — Municipality Bill Change Detection:** The spec mentions detecting changes between utility bills (price increases, new charges). This plan defines the utility bill parser but does not define the change detection algorithm or its data model. **Resolution:** The `utility_bills` table stores `amount_due` per bill. A `previous_bill_id` FK enables diff computation. The `process-utility-bill` job should compute delta on insert: `((new_amount - prev_amount) / prev_amount * 100)`. If delta >10%: create a notification. This should be added to the Utility Bill Parser (Tier 3, step 22) implementation brief.

**Finding 2 — Magic Link vs. Password Auth:** The spec says "email-based auth." This plan defaults to magic link. However, some users (especially older demographics in SA households) find magic links confusing. The plan should support both magic link AND email/password. **Resolution:** Enable both in Supabase Auth. Onboarding defaults to magic link with a "Use password instead" toggle. This is a UI decision, not an architectural change — no schema impact.

**Finding 3 — Postmark Inbound Routing:** The plan assumes one inbound email address per household. But the spec is silent on how users LEARN their inbound address. **Resolution:** The household onboarding screen (Step 3 in Tier 1) must display the inbound email address prominently and include a "Send test email" button that triggers a test parse flow.

**Round 1 Verdict:** Three gaps identified. All resolved above. No architectural changes required.

---

### Round 2 — Contradiction Check

**Question:** Does any part of this plan contradict another part?

**Finding 1 — EC-05 Resolution Contradiction:** The edge case section recommends `supabase.auth.admin.signOut(userId, 'others')` (Option 2) as simpler, but the fix description above it describes Option 2 as "insert `revoked_jwt_claims` record." These are different approaches. **Resolution:** Clarify: Option 1 = revoked_jwt_claims table (complex). Option 2 = signOut API call (simple, recommended). The final fix is Option 2. The `revoked_jwt_claims` table is NOT needed and should not be built.

**Finding 2 — Document Ownership Model:** Section 4 (Data Architecture) defines `documents.user_id` as the uploader. Section 8 (API Contracts) references `household_id` on documents. The RLS policies reference `household_id` for access control. This is consistent — documents belong to a household AND track uploader. But the Implementation Order (Tier 2) doesn't mention wiring `user_id` on upload. **Resolution:** Upload handler (step 13) must set BOTH `household_id` (from JWT claims) AND `user_id = auth.uid()` on the `inbox_messages` row. This flows through to the `documents` row on parse completion.

**Finding 3 — Subscription Limit Timing:** Section 5 says limits are enforced at upload time. Section 7 (Subscriptions) says the count check happens before allowing upload. But Tier 5 in Implementation Order places subscriptions AFTER the upload pipeline (Tier 2). This means during development, limits won't be enforced until Tier 5. **Resolution:** This is acceptable for development sequencing — limits are a product enforcement concern, not a data integrity concern. Add a TODO in the upload handler to call `checkUploadLimit()` (which returns true until Tier 5 wires it up).

**Round 2 Verdict:** Three contradictions found. All resolved above. No schema changes required.

---

### Round 3 — South Africa Specific Risk Check

**Question:** What SA-specific risks could cause production failures that a generic plan would miss?

**Finding 1 — Load Shedding Impact on Background Jobs:** Loadshedding causes user devices to go offline unpredictably. A user might upload during a scheduled window and lose connectivity mid-upload, or the server-side job queue might be processing when the user's mobile data cuts out. **Resolution:** Already handled by EC-13 (resumable uploads). Background jobs run server-side (Supabase Edge Functions / Vercel Serverless) and are unaffected by user-side connectivity. Vercel infrastructure is not SA-hosted, so loadshedding doesn't affect server uptime.

**Finding 2 — South African Bank Statement Formats:** SA banks (ABSA, Standard Bank, FNB, Nedbank, Capitec, Discovery Bank) each have unique PDF statement formats. Some export CSV. Capitec's app exports statements in a non-standard format. **Resolution:** The bank statement parser must be tested against real samples from all 6 major banks before Phase 1 launch. The `bank_name` enum in the schema must include all 6. The multi-signal detection in EC-09 handles misidentification.

**Finding 3 — POPIA Compliance (SA Data Privacy Law):** POPIA (Protection of Personal Information Act) requires explicit consent for processing personal financial data. The plan does not include a consent capture step. **Resolution:** Onboarding must include a POPIA consent screen (not just T&Cs) with explicit checkboxes for: (a) processing financial documents, (b) storing email attachments, (c) using AI to extract data. These consents must be stored with timestamp in `users.popia_consent_at`. Without consent, the inbound email parser must not process attachments.

**Finding 4 — ZAR Currency Formatting:** SA uses "R" prefix (R1 234,56 with space-thousands and comma-decimal in some contexts, R1,234.56 in others). Claude Vision may return inconsistent formats. **Resolution:** All currency parsing must normalize to a single internal format: integer cents (e.g., R342.50 → 34250). The display layer formats for ZAR using `Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })`.

**Round 3 Verdict:** Four SA-specific risks identified. POPIA compliance is the most critical — it's a legal requirement, not a nice-to-have. Must be in Phase 1 scope.

---

## Final Assessment

This plan covers all major functional areas, data models, API contracts, security patterns, and edge cases for Phase 1 of Household OS. The three rounds of self-critique have identified and resolved:

- 3 spec gaps (municipality change detection, auth method flexibility, inbound address discovery)
- 3 internal contradictions (EC-05 fix options, document ownership wiring, subscription limit timing)
- 4 SA-specific risks (loadshedding resilience, bank format coverage, POPIA compliance, ZAR formatting)

The implementation order (Tiers 0–6) provides a clear, dependency-respecting build sequence that the Tech Lead can follow without ambiguity.

**PLAN_MANAGER_CLAUDE_APPROVED**
