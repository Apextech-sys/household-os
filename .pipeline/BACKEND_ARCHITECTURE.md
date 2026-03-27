# HouseholdOS — Backend Architecture
**Specialist:** Backend  
**Date:** 2026-03-28  
**Status:** Phase 1 Implementation-Ready

---

## Overview

HouseholdOS backend is a hybrid of Vercel API routes (Next.js 14 App Router) and Supabase infrastructure (PostgreSQL + Auth + Storage + Realtime + Edge Functions). All state lives in Supabase. Vercel handles HTTP ingress, webhook processing, AI orchestration, and background job dispatch. No custom server — fully serverless.

---

## 1. HITL Action Pipeline

### 1.1 Philosophy

Every consequential external action (drafting a warranty claim, submitting a dispute, requesting quotes) goes through HITL. The AI proposes; the human decides. The system executes only on explicit approval. This is non-negotiable — App Store compliance, FSCA information-only positioning, and user trust all depend on it.

### 1.2 State Machine

The `hitl_actions.status` column drives the entire lifecycle:

```
proposed → approved → executed
         ↘ rejected
                    ↘ failed
```

**State transitions:**

| From | To | Trigger | Side Effect |
|------|----|---------|-------------|
| `proposed` | `approved` | User taps Approve | Sets `approved_at`, enqueues execution job |
| `proposed` | `rejected` | User taps Reject | No execution, notifies user of cancellation |
| `approved` | `executed` | Execution engine completes | Sets `executed_at`, writes `result`, notifies user |
| `approved` | `failed` | Execution engine errors | Writes `result` with error details, notifies user |

No other transitions are valid. Guards enforced server-side — status changes via API only, never client-side direct Supabase writes.

### 1.3 Proposed Action Schema (JSON)

The `proposed_action` column stores a typed JSON payload. Every action type has a strict schema validated on write.

**Warranty Claim Draft:**
```json
{
  "type": "warranty_claim",
  "version": 1,
  "warranty_id": "uuid",
  "product_name": "Samsung 65\" QLED TV",
  "retailer": "Makro",
  "purchase_date": "2024-01-15",
  "expiry_date": "2026-01-15",
  "claim_reason": "Screen flickering on right side",
  "draft_email": {
    "to": "warranty@makro.co.za",
    "subject": "Warranty Claim — Samsung 65\" QLED TV (Invoice #INV-2024-001)",
    "body": "Dear Makro Warranty Department,\n\n..."
  },
  "supporting_docs": ["receipt_uuid", "document_uuid"],
  "reasoning": "Product is within 24-month warranty period. Issue qualifies as manufacturing defect under CPA Section 56."
}
```

**Dispute Draft:**
```json
{
  "type": "dispute_draft",
  "version": 1,
  "dispute_target": "municipality | service_provider | retailer",
  "reference_entity_id": "uuid",
  "dispute_reason": "Overcharged on water bill — actual reading 142 kL, billed for 289 kL",
  "bylaw_reference": "Water Services Act 108 of 1997, Section 21",
  "draft_letter": {
    "to": "billing@cityofjoburg.org.za",
    "subject": "Formal Billing Dispute — Account #12345678 — March 2026",
    "body": "..."
  },
  "evidence": ["inbox_message_uuid", "document_uuid"],
  "reasoning": "Consumption spike of 147 kL in 30 days is physically impossible for a 4-bedroom household. Meter reading error or billing system fault."
}
```

### 1.4 Phase 1 Action Types

| `action_type` | `module` | Description |
|---------------|----------|-------------|
| `warranty_claim` | `warranties` | Draft and send warranty claim email |
| `dispute_draft` | `documents` | Draft formal dispute letter |

### 1.5 API Endpoints

```
POST   /api/hitl/propose          — AI creates a proposed action (internal, from agent)
GET    /api/hitl/actions           — List pending actions for household
GET    /api/hitl/actions/[id]      — Get single action with full proposed_action payload
POST   /api/hitl/actions/[id]/approve  — Approve and enqueue execution
POST   /api/hitl/actions/[id]/reject   — Reject with optional reason
GET    /api/hitl/actions/[id]/result   — Poll execution result
```

### 1.6 Execution Engine

After approval, execution runs as a Vercel background function (`maxDuration: 300`).

**Execution flow:**
1. Load `hitl_actions` row, verify `status = 'approved'`
2. Parse `proposed_action` JSON, determine executor by `action_type`
3. Execute action (send email via Postmark, etc.)
4. On success: update `status = 'executed'`, set `executed_at`, write `result`
5. On failure: update `status = 'failed'`, write `result` with error + retry eligibility
6. Write to `audit_log` (action: `hitl_executed`, entity_type: `hitl_actions`)
7. Trigger notification to user: "Your warranty claim was submitted successfully"

**Executor registry (Phase 1):**
```typescript
const EXECUTORS: Record<string, ActionExecutor> = {
  warranty_claim: warrantyClaimExecutor,   // sends email via Postmark
  dispute_draft: disputeDraftExecutor,      // sends email via Postmark
}
```

### 1.7 UI Contract

The frontend renders each `hitl_actions` row as an action card. The API must return:

```json
{
  "id": "uuid",
  "title": "Warranty Claim — Samsung TV",
  "description": "Screen flickering reported. Within warranty period.",
  "action_type": "warranty_claim",
  "module": "warranties",
  "status": "proposed",
  "reasoning": "Product is within 24-month warranty period...",
  "proposed_action": { ... },
  "created_at": "2026-03-28T10:00:00Z"
}
```

The `reasoning` field (extracted from `proposed_action.reasoning`) is displayed prominently above the approve/reject buttons. Users must be able to read WHY the AI is proposing this action before approving.

**Action card states:**
- `proposed` → Show approve + reject buttons
- `approved` → Show spinner "Executing..."
- `executed` → Show success + result summary
- `rejected` → Show muted "You rejected this action"
- `failed` → Show error + option to retry (re-proposes)

---

## 2. Notification Engine

### 2.1 Notification Types (Phase 1)

| `type` | Urgency | Default Channel | Trigger |
|--------|---------|-----------------|---------|
| `warranty_expiry` | medium | push + in-app | Warranty expiring in 30/7/1 days |
| `bill_anomaly` | high | push + in-app + email | Statement differs >20% from prior month |
| `debit_order_change` | high | push + in-app + email | Debit order amount changed |
| `subscription_renewal` | low | in-app | Subscription renewing in 7 days |
| `hitl_executed` | high | push + in-app | HITL action completed/failed |
| `document_ready` | low | in-app | Document OCR processing complete |

### 2.2 Notification Row Lifecycle

1. **Create**: Write to `notifications` table with `is_read = false`
2. **Deliver**: Simultaneously dispatch to enabled channels for user
3. **Read**: Client marks `is_read = true` via API (real-time via Supabase Realtime)
4. **Expire**: Notification center shows last 90 days only (UI filter, not deleted)

```sql
-- RLS: users see only their own notifications
CREATE POLICY notifications_user_select ON notifications
  FOR SELECT USING (user_id = auth.uid());
```

### 2.3 Expo Push Notifications (Mobile)

**Token registration:**
```
POST /api/notifications/register-push-token
Body: { expo_push_token: "ExponentPushToken[xxx]" }
```

Token stored in `user_preferences` as `key = 'expo_push_token'`, `value = { token: "...", platform: "ios|android" }`.

**Dispatch logic:**
```typescript
async function sendPushNotification(userId: string, notification: Notification) {
  const prefs = await getUserPreference(userId, 'expo_push_token')
  if (!prefs?.token) return  // no token registered

  const notifPrefs = await getUserPreference(userId, 'notification_channels')
  if (!notifPrefs?.push_enabled) return

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: prefs.token,
      title: notification.title,
      body: notification.body,
      data: {
        type: notification.type,
        module: notification.module,
        reference_id: notification.reference_id,
        notification_id: notification.id,
      },
      sound: 'default',
      priority: isUrgent(notification.type) ? 'high' : 'normal',
    }),
  })
}
```

### 2.4 In-App Notification Center

The notification center subscribes to the `notifications` table via Supabase Realtime:

```typescript
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    // Append to notification list, increment badge count
  })
  .subscribe()
```

**Notification center API:**
```
GET  /api/notifications              — List (last 90 days, paginated, unread first)
POST /api/notifications/[id]/read    — Mark single as read
POST /api/notifications/read-all     — Mark all as read
GET  /api/notifications/unread-count — Badge count for nav
```

### 2.5 Postmark Email Notifications

Used for high-importance notifications only (bill anomaly, debit order change, HITL result). Uses Postmark transactional API.

```typescript
async function sendEmailNotification(userId: string, notification: Notification) {
  const user = await getUser(userId)
  const prefs = await getUserPreference(userId, 'notification_channels')
  if (!prefs?.email_enabled) return

  await postmark.sendEmailWithTemplate({
    From: 'alerts@householdos.co.za',
    To: user.email,
    TemplateAlias: `notification-${notification.type}`,
    TemplateModel: {
      user_name: user.full_name.split(' ')[0],
      notification_title: notification.title,
      notification_body: notification.body,
      action_url: `https://app.householdos.co.za/notifications/${notification.id}`,
      household_name: notification.household_name,
    },
  })
}
```

### 2.6 Notification Preferences

Stored in `user_preferences` as `key = 'notification_channels'`:

```json
{
  "push_enabled": true,
  "email_enabled": true,
  "digest_enabled": false,
  "muted_types": [],
  "quiet_hours": { "enabled": false, "from": "22:00", "to": "07:00" }
}
```

**Preference API:**
```
GET  /api/notifications/preferences        — Get current preferences
PUT  /api/notifications/preferences        — Update preferences
```

### 2.7 Scheduling Strategy

| Urgency | Delivery | Channels |
|---------|----------|----------|
| High (bill anomaly, debit order change, HITL failure) | Real-time, immediate | Push + in-app + email |
| Medium (warranty expiry) | Real-time creation, respects quiet hours | Push + in-app |
| Low (document ready, subscription renewal) | Daily digest batch at 08:00 SAST | In-app only, optional email digest |

**Daily digest cron** (08:00 SAST = 06:00 UTC):
- Query `notifications` where `is_read = false` AND `created_at` >= yesterday AND `type` in low-urgency types
- Group by user
- Send single digest email per user if email digest enabled
- Do NOT re-send push — already delivered in-app

---

## 3. Postmark Email Ingestion

### 3.1 Inbound Webhook Endpoint

```
POST /api/webhooks/postmark
```

**No auth header required by Postmark** — verification via shared secret in payload or webhook signature header (`X-Postmark-Signature`).

**Processing pipeline:**

```
Postmark → POST /api/webhooks/postmark
         → Verify signature
         → Extract recipient address (e.g. absa@<household-slug>.householdos.co.za)
         → Lookup inbox_addresses by email_address
         → Create inbox_messages row (status: received)
         → For each attachment: stream to Supabase Storage at inbox/{household_id}/{message_id}/{filename}
         → Create inbox_attachments rows
         → Enqueue parse job (background)
         → Return 200 immediately
```

**Critical**: Return `200 OK` within 10 seconds or Postmark retries. All processing is async after the webhook responds.

### 3.2 Signature Verification

```typescript
import crypto from 'crypto'

function verifyPostmarkSignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', process.env.POSTMARK_WEBHOOK_SECRET!)
  hmac.update(payload)
  const expected = hmac.digest('base64')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
```

If signature fails → return `403`, log to `audit_log`.

### 3.3 Household Routing

Email addresses follow the pattern: `{label}@{household-slug}.householdos.co.za`  
Alternatively: `{unique-token}@inbound.householdos.co.za` (preferred for privacy)

```typescript
async function routeToHousehold(recipient: string): Promise<InboxAddress | null> {
  return supabase
    .from('inbox_addresses')
    .select('*, households(*)')
    .eq('email_address', recipient.toLowerCase())
    .eq('is_active', true)
    .single()
}
```

If no match → return `200` (don't leak routing info), silently discard, log to `audit_log`.

### 3.4 Attachment Storage

Each attachment is stored to Supabase Storage under:
```
inbox/{household_id}/{message_id}/{sanitised_filename}
```

```typescript
async function storeAttachment(
  householdId: string,
  messageId: string,
  attachment: PostmarkAttachment
): Promise<string> {
  const filename = sanitiseFilename(attachment.Name)
  const path = `inbox/${householdId}/${messageId}/${filename}`
  
  const buffer = Buffer.from(attachment.Content, 'base64')
  
  await supabase.storage
    .from('documents')
    .upload(path, buffer, {
      contentType: attachment.ContentType,
      upsert: false,
    })
  
  return path
}
```

### 3.5 Parse Job (Background)

After attachment storage, enqueue a background parse job:

1. Load `inbox_messages` row
2. For each PDF attachment: run Claude Vision OCR → extract structured data
3. Detect document type: bank statement, municipal bill, insurance schedule, general correspondence
4. For bank statements: extract transactions → insert into `budget_transactions` (source: `statement`)
5. For bills: extract amount, period, consumption → store in `parsed_data` column
6. Update `inbox_messages.status = 'parsed'`, write `parsed_data`
7. Trigger notifications if anomalies detected (bill_anomaly, debit_order_change)

---

## 4. Auth & Authorization

### 4.1 Supabase Auth Configuration

**Enabled providers:**
- Email magic link (primary, lowest friction)
- Email + password (for users who prefer it)
- Google OAuth (for broad adoption)

**JWT custom claims** (set via Supabase Auth Hook on sign-in):
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "household_id": "household-uuid",
  "role": "primary",
  "subscription_tier": "household"
}
```

The Auth Hook is a Supabase Edge Function that queries `users` for the authenticated `auth.uid()` and injects `household_id`, `role`, and `subscription_tier` into the JWT on every session creation.

### 4.2 Role Definitions

| Role | Capabilities |
|------|-------------|
| `primary` | Full read/write, HITL approve, manage household members, billing |
| `secondary` | Full read/write on most modules, HITL approve for own actions, no billing |
| `view_only` | Read-only on all modules, no HITL, no uploads |
| `admin` | HouseholdOS staff — cross-household access via service role (never via JWT) |

### 4.3 RLS Pattern

**Universal pattern** — every table uses this as the base SELECT policy:

```sql
CREATE POLICY "{table}_household_select" ON {table}
  FOR SELECT
  USING (household_id = (auth.jwt() ->> 'household_id')::uuid);
```

**Write policies** check role in addition:

```sql
CREATE POLICY "hitl_actions_approve" ON hitl_actions
  FOR UPDATE
  USING (
    household_id = (auth.jwt() ->> 'household_id')::uuid
    AND (auth.jwt() ->> 'role') IN ('primary', 'secondary')
    AND status = 'proposed'  -- can only update proposed actions
  )
  WITH CHECK (status IN ('approved', 'rejected'));
```

**Webhook and background job access** use the Supabase service role key (never exposed to clients) and bypass RLS intentionally. All such access is logged to `audit_log`.

### 4.4 Middleware (Next.js)

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createMiddlewareClient({ req: request, res: NextResponse.next() })
  const { data: { session } } = await supabase.auth.getSession()

  // Protect all /api/* and /app/* routes
  if (!session && request.nextUrl.pathname.startsWith('/api/')) {
    if (isPublicEndpoint(request.nextUrl.pathname)) return NextResponse.next()
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}
```

Public endpoints (no auth): `/api/webhooks/*`, `/api/auth/*`, `/api/health`

---

## 5. Supabase Storage

### 5.1 Bucket Configuration

| Bucket | Path Pattern | Access | Purpose |
|--------|-------------|--------|---------|
| `documents` | `documents/{household_id}/{document_id}/{filename}` | Private | Uploaded documents, PDFs, contracts |
| `documents` | `receipts/{household_id}/{receipt_id}/{filename}` | Private | Receipt images |
| `documents` | `inbox/{household_id}/{message_id}/{filename}` | Private | Email attachments |

Single `documents` bucket, partitioned by path prefix. No public bucket — zero public files.

### 5.2 Signed URL Generation

All file access goes through signed URLs generated server-side:

```typescript
async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, expiresIn)
  
  if (error) throw new StorageError(`Failed to sign URL for ${path}`)
  return data.signedUrl
}
```

Clients never receive raw storage paths — only signed URLs with TTL. Long-lived signatures (24h) for document viewer; short signatures (15min) for download links.

### 5.3 Upload Flow

**Web (File API):**
```typescript
// Client → signed upload URL → direct to Supabase Storage
// 1. Client calls POST /api/documents/upload-url (returns signed upload URL)
// 2. Client PUTs file directly to Supabase Storage using signed URL
// 3. Client calls POST /api/documents/confirm (triggers processing job)
```

**Mobile (Expo ImagePicker):**
```typescript
// Same flow — Expo FileSystem.uploadAsync to signed URL
// For photos: compress to JPEG 85% quality before upload (reduces OCR cost)
```

**Max sizes:** Documents 50MB, Receipts 10MB per file. Enforced at upload URL generation, not storage level (Supabase enforces per bucket config).

### 5.4 Storage RLS

Supabase Storage bucket policies mirror table RLS — `household_id` in path must match JWT claim:

```sql
-- Storage policy: read own household's files only
CREATE POLICY "household_files_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[2] = (auth.jwt() ->> 'household_id')
  );
```

---

## 6. Stripe Integration

### 6.1 Subscription Tiers (ZAR)

| Tier | Price | Key Limits |
|------|-------|-----------|
| `essential` | R99/mo | 20 docs, 5 inbox addresses, 500 AI interactions |
| `household` | R199/mo | 100 docs, 20 addresses, bank API, 2000 AI interactions |
| `premium` | R349/mo | Unlimited docs, all modules, HITL pipeline, proactive monitoring |
| `enterprise` | Custom | White-label, dedicated infrastructure |

### 6.2 Stripe Products Setup

Each tier is a Stripe Product with a ZAR Price. Stored in env as:
```
STRIPE_PRICE_ID_ESSENTIAL=price_xxx
STRIPE_PRICE_ID_HOUSEHOLD=price_xxx
STRIPE_PRICE_ID_PREMIUM=price_xxx
```

### 6.3 Webhook Handlers

```
POST /api/webhooks/stripe
```

Stripe signature verification on every request (`stripe.webhooks.constructEvent`).

**Handled events:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/update `subscriptions` row, update `households.subscription_tier` |
| `customer.subscription.updated` | Sync tier and status in `subscriptions`, update `households.subscription_tier` |
| `customer.subscription.deleted` | Set `subscriptions.status = 'cancelled'`, downgrade to `essential` |
| `invoice.payment_failed` | Set `subscriptions.status = 'past_due'`, notify primary user |
| `invoice.payment_succeeded` | Ensure `subscriptions.status = 'active'` |

**Checkout flow:**
```
POST /api/stripe/create-checkout    — Returns Stripe Checkout URL
GET  /api/stripe/portal             — Returns Stripe Customer Portal URL (manage subscription)
```

### 6.4 Tier Enforcement Middleware

```typescript
async function requireTier(
  minTier: SubscriptionTier,
  handler: RouteHandler
): Promise<RouteHandler> {
  return async (req, ctx) => {
    const tier = req.jwt.subscription_tier
    if (!meetsMinimumTier(tier, minTier)) {
      return Response.json({
        error: 'upgrade_required',
        current_tier: tier,
        required_tier: minTier,
        upgrade_url: '/settings/billing',
      }, { status: 402 })
    }
    return handler(req, ctx)
  }
}

// Usage:
export const POST = requireTier('premium', hitlProposeHandler)
```

Tier hierarchy: `essential < household < premium < enterprise`

---

## 7. API Route Structure

All routes are Next.js 14 App Router route handlers under `/app/api/`. Auth required unless noted.

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | None | Create account + household |
| POST | `/api/auth/magic-link` | None | Send magic link email |
| POST | `/api/auth/callback` | None | OAuth + magic link callback |

### Household & Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/household` | Required | Get current household profile |
| PUT | `/api/household` | primary | Update household name/settings |
| GET | `/api/household/members` | Required | List household members |
| POST | `/api/household/invite` | primary | Invite new member (sends magic link) |
| PUT | `/api/household/members/[id]` | primary | Update member role |
| DELETE | `/api/household/members/[id]` | primary | Remove member |

### Documents
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/documents` | Required | List documents (paginated) |
| POST | `/api/documents/upload-url` | Required | Get signed upload URL |
| POST | `/api/documents/confirm` | Required | Confirm upload, trigger processing |
| GET | `/api/documents/[id]` | Required | Get document + extracted data |
| GET | `/api/documents/[id]/signed-url` | Required | Get signed download URL |
| DELETE | `/api/documents/[id]` | primary/secondary | Delete document |
| POST | `/api/documents/[id]/qa` | Required | Start or continue Q&A session |
| GET | `/api/documents/[id]/qa/[sessionId]` | Required | Get Q&A session history |

### Inbox
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/inbox/addresses` | Required | List inbox addresses |
| POST | `/api/inbox/addresses` | primary/secondary | Create inbox address |
| DELETE | `/api/inbox/addresses/[id]` | primary | Deactivate inbox address |
| GET | `/api/inbox/messages` | Required | List messages (paginated) |
| GET | `/api/inbox/messages/[id]` | Required | Get message + parsed data |
| GET | `/api/inbox/messages/[id]/attachments/[attId]/url` | Required | Signed URL for attachment |

### Receipts & Warranties
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/receipts` | Required | List receipts |
| POST | `/api/receipts/upload-url` | Required | Get signed upload URL for receipt image |
| POST | `/api/receipts/confirm` | Required | Confirm upload, trigger OCR |
| GET | `/api/receipts/[id]` | Required | Get receipt + extracted items |
| GET | `/api/warranties` | Required | List warranties (with expiry status) |
| GET | `/api/warranties/expiring` | Required | Warranties expiring in next 30 days |
| PUT | `/api/warranties/[id]` | primary/secondary | Update warranty details |

### Budget
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/budget/transactions` | Required | List transactions (filterable by month/category) |
| POST | `/api/budget/transactions` | primary/secondary | Add manual transaction |
| PUT | `/api/budget/transactions/[id]` | primary/secondary | Update category/description |
| DELETE | `/api/budget/transactions/[id]` | primary/secondary | Delete transaction |
| GET | `/api/budget/categories` | Required | List categories |
| POST | `/api/budget/categories` | primary/secondary | Create category |
| GET | `/api/budget/summary/[month]` | Required | Monthly summary (YYYY-MM) |

### HITL
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/hitl/actions` | Required | List actions (filterable by status) |
| GET | `/api/hitl/actions/[id]` | Required | Get action details + proposed_action |
| POST | `/api/hitl/actions/[id]/approve` | primary/secondary | Approve and execute |
| POST | `/api/hitl/actions/[id]/reject` | primary/secondary | Reject action |
| GET | `/api/hitl/actions/[id]/result` | Required | Execution result |
| POST | `/api/hitl/propose` | Service role | Internal: AI proposes action |

### Notifications
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | Required | List notifications (paginated) |
| GET | `/api/notifications/unread-count` | Required | Unread badge count |
| POST | `/api/notifications/[id]/read` | Required | Mark as read |
| POST | `/api/notifications/read-all` | Required | Mark all as read |
| GET | `/api/notifications/preferences` | Required | Get notification preferences |
| PUT | `/api/notifications/preferences` | Required | Update preferences |
| POST | `/api/notifications/register-push-token` | Required | Register Expo push token |

### Billing
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/billing/subscription` | Required | Current subscription details |
| POST | `/api/stripe/create-checkout` | primary | Create Stripe Checkout session |
| GET | `/api/stripe/portal` | primary | Stripe Customer Portal URL |

### Webhooks (No auth — signature verified internally)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhooks/postmark` | Signature | Inbound email webhook |
| POST | `/api/webhooks/stripe` | Signature | Stripe event webhook |

### Internal / Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Service health check |
| POST | `/api/internal/process-document` | Service role | Trigger document processing |
| POST | `/api/internal/process-receipt` | Service role | Trigger receipt processing |
| POST | `/api/internal/parse-inbox-message` | Service role | Trigger inbox message parsing |

---

## 8. Background Jobs

### 8.1 Document Processing Pipeline

**Trigger:** `POST /api/internal/process-document` after upload confirmed

```
documents.status = 'uploading'
  → Download from Storage
  → Claude Vision OCR (extract raw text)
  → Claude extract structured data (document type, key dates, parties, amounts)
  → OpenAI text-embedding-3-small → 1536-dim vector
  → UPDATE documents SET status='ready', ocr_text=..., extracted_data=..., embedding=...
  → Notification: document_ready (low urgency)
  → Write audit_log entry
```

**Error handling:** On any step failure → `status = 'error'`, write error details to `extracted_data.error`, notify user. Retryable via admin or user re-trigger.

**Claude OCR prompt strategy:**
- Pass document image(s) to Claude with structured extraction schema
- Request JSON response with: document_type, parties, key_dates, amounts, obligations, warnings
- For multi-page PDFs: split into pages, OCR each, merge extracted_data

### 8.2 Receipt Processing Pipeline

**Trigger:** `POST /api/internal/process-receipt` after upload confirmed

```
receipts.status = 'uploading'
  → Claude Vision OCR on receipt image
  → Extract: retailer, purchase_date, total_amount, line items (name, price, quantity)
  → UPDATE receipts SET status='ready', ocr_text=..., retailer=..., purchase_date=..., total_amount=..., items=...
  → Warranty check: for each item with warranty indicators, create warranties row
  → Schedule warranty expiry notification (30/7/1 day alerts)
  → Write audit_log entry
```

**Warranty detection:** Claude identifies warranty period from receipt text. If not explicit, apply SA Consumer Protection Act defaults (6 months implied warranty for goods).

### 8.3 Statement Parsing Pipeline

**Trigger:** Fired from inbox message parse job when document type = bank statement

```
inbox_messages.status = 'processing'
  → Identify bank from sender/subject/content
  → Claude Vision on PDF → extract all transactions
  → For each transaction: INSERT into budget_transactions (source: 'statement')
  → Detect anomalies: new debit orders, amount changes >20%, unusual merchants
  → If anomaly: INSERT notification (type: bill_anomaly or debit_order_change)
  → UPDATE inbox_messages.status = 'parsed', parsed_data = { transaction_count, period, bank }
  → Update budget_summaries for affected months
```

**Deduplication:** Match on `description + transaction_date + amount` before insert to prevent duplicate imports from forwarded statements.

### 8.4 Cron Jobs

Cron via Vercel Cron (defined in `vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/warranty-expiry-check",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/notification-digest",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Both run at 06:00 UTC = 08:00 SAST.

**Warranty Expiry Check (`/api/cron/warranty-expiry-check`):**
```
Query warranties WHERE:
  - expiry_date BETWEEN now() AND now() + 30 days
  - alert_sent = false (prevent duplicate alerts)
For each expiring warranty:
  - INSERT notification (type: warranty_expiry, urgency depends on days remaining)
  - If days ≤ 7: also send push + email
  - UPDATE warranties.alert_sent = true
  - If days ≤ 1: consider proposing HITL warranty_claim action
```

**Note:** `alert_sent` is a boolean — Phase 2 should extend to `alert_sent_at` and support multiple milestone alerts (30d, 7d, 1d).

**Notification Digest (`/api/cron/notification-digest`):**
```
Query users with digest_enabled = true
For each user:
  - Fetch unread low-urgency notifications from last 24h
  - If count > 0: send Postmark digest email (template: notification-digest)
  - Log send to audit_log
```

---

## 9. Environment Variables

### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=https://vzyeuxczwdpvlfwfzjih.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key — never exposed to client>
SUPABASE_PROJECT_ID=vzyeuxczwdpvlfwfzjih
SUPABASE_DB_HOST=db.vzyeuxczwdpvlfwfzjih.supabase.co
```

### Anthropic
```env
ANTHROPIC_API_KEY=<sk-ant-...>
ANTHROPIC_MODEL=claude-opus-4-5              # Primary reasoning + OCR
ANTHROPIC_FAST_MODEL=claude-haiku-3-5        # Fast extraction tasks
```

### OpenAI
```env
OPENAI_API_KEY=<sk-...>
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### Postmark
```env
POSTMARK_API_TOKEN=<server token>             # For sending
POSTMARK_WEBHOOK_SECRET=<webhook secret>      # For inbound verification
POSTMARK_FROM_EMAIL=noreply@householdos.co.za
POSTMARK_ALERTS_FROM=alerts@householdos.co.za
POSTMARK_INBOUND_DOMAIN=inbound.householdos.co.za
```

### Stripe
```env
STRIPE_SECRET_KEY=<sk_live_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>
STRIPE_PUBLISHABLE_KEY=<pk_live_...>          # NEXT_PUBLIC_ prefix on client
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<pk_live_...>
STRIPE_PRICE_ID_ESSENTIAL=<price_...>
STRIPE_PRICE_ID_HOUSEHOLD=<price_...>
STRIPE_PRICE_ID_PREMIUM=<price_...>
```

### App
```env
NEXT_PUBLIC_APP_URL=https://app.householdos.co.za
NEXT_PUBLIC_APP_NAME=HouseholdOS
CRON_SECRET=<random 32-char secret>           # Vercel cron auth header
INTERNAL_API_SECRET=<random 32-char secret>   # Internal job endpoint auth
```

### Feature Flags (Phase 1)
```env
NEXT_PUBLIC_FEATURE_HITL=true
NEXT_PUBLIC_FEATURE_BANK_API=false            # Phase 2
NEXT_PUBLIC_FEATURE_INSURANCE=false           # Phase 2
```

---

## 10. Security Considerations

### SSRF Protection
All external HTTP calls (Postmark sending, Expo Push API) go through a whitelist wrapper:
```typescript
const ALLOWED_EXTERNAL_HOSTS = [
  'exp.host',
  'api.postmarkapp.com',
  'api.stripe.com',
  'api.anthropic.com',
  'api.openai.com',
]
```
No user-supplied URLs are fetched server-side without strict validation.

### Webhook Security
- Postmark: HMAC-SHA256 signature verification before any processing
- Stripe: `stripe.webhooks.constructEvent` with webhook secret
- Cron endpoints: `Authorization: Bearer <CRON_SECRET>` header (Vercel injects this automatically)
- Internal endpoints: `X-Internal-Secret: <INTERNAL_API_SECRET>` header

### AI Usage Logging
Every Anthropic and OpenAI call writes to `ai_usage_log` (model, endpoint, token counts, latency). Enables:
- Per-household AI quota enforcement
- Cost attribution
- Anomaly detection (unusually large requests)

### Audit Trail
All consequential actions write to `audit_log`:
- HITL approve/reject/execute
- Document upload/delete
- Member invite/remove
- Webhook receive
- Billing changes

---

## 11. Realtime Subscriptions

Supabase Realtime channels used in Phase 1:

| Channel | Table | Event | Consumer |
|---------|-------|-------|----------|
| `notifications:{userId}` | `notifications` | INSERT | In-app notification bell |
| `documents:{householdId}` | `documents` | UPDATE | Document status polling → live processing indicator |
| `receipts:{householdId}` | `receipts` | UPDATE | Receipt status → live OCR indicator |
| `hitl:{householdId}` | `hitl_actions` | UPDATE | Action card status refresh |

All realtime channels filter by `household_id` or `user_id` to prevent cross-household data leakage. RLS on Realtime is enforced via Supabase's Realtime RLS (enabled for all 19 tables).
