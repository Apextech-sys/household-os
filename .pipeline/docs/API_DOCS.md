# HouseholdOS Phase 1 — API Documentation

> Generated: 2026-03-28  
> Base URL: `https://<domain>/api`  
> Auth: Supabase session cookie (HTTP-only, set via `/auth/callback`). All authenticated routes return `401 Unauthorized` if no valid session exists.

---

## Authentication

All routes (except `/api/webhooks/postmark`) require a valid Supabase session cookie obtained after OAuth/email login via `/auth/callback`. The server reads the session via `createClient()` from `@/lib/supabase/server` on every request.

**Auth error response (all protected routes):**
```json
{ "error": "Unauthorized" }
```
HTTP `401`

---

## Table of Contents

1. [Documents](#1-documents)
2. [Receipts](#2-receipts)
3. [Warranties](#3-warranties)
4. [Budget](#4-budget)
5. [Inbox](#5-inbox)
6. [Chat](#6-chat)
7. [HITL](#7-hitl-human-in-the-loop)
8. [Notifications](#8-notifications)
9. [Webhooks](#9-webhooks)

---

## 1. Documents

### `GET /api/documents`

List all documents for the authenticated user's household.

**Auth required:** Yes  
**Query params:** None  

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "household_id": "uuid",
    "uploaded_by": "uuid",
    "filename": "lease-agreement.pdf",
    "file_path": "documents/{household_id}/{uuid}/lease-agreement.pdf",
    "file_size": 204800,
    "mime_type": "application/pdf",
    "status": "ready",
    "ocr_text": "Full extracted text...",
    "extracted_data": {
      "document_type": "contract",
      "dates": ["2025-01-01"],
      "amounts": [{ "value": 15000.00, "currency": "ZAR", "label": "Monthly Rent" }],
      "parties": ["Landlord Name", "Tenant Name"],
      "key_terms": ["12-month lease", "no pets"]
    },
    "embedding": null,
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `500` | Database error |

---

### `POST /api/documents`

Upload a new document to the household's storage bucket and create a DB record. Does **not** trigger OCR — call `/process` next.

**Auth required:** Yes  
**Content-Type:** `multipart/form-data`  

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | `File` | ✓ | The document file (PDF, image, etc.) |

**Response `201`:**
```json
{
  "id": "uuid",
  "household_id": "uuid",
  "uploaded_by": "uuid",
  "filename": "lease-agreement.pdf",
  "file_path": "documents/{household_id}/{uuid}/lease-agreement.pdf",
  "file_size": 204800,
  "mime_type": "application/pdf",
  "status": "uploading",
  "ocr_text": null,
  "extracted_data": null,
  "embedding": null,
  "created_at": "2025-01-01T00:00:00Z"
}
```

**Error codes:**
| Code | Condition |
|------|-----------|
| `400` | `No file provided` or `No household` |
| `401` | No valid session |
| `500` | Storage upload failed or DB insert failed |

---

### `GET /api/documents/:id`

Fetch a single document by ID.

**Auth required:** Yes  
**Path params:** `id` — document UUID

**Response `200`:** Same shape as individual document object above.

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `404` | Document not found |

---

### `DELETE /api/documents/:id`

Delete a document record. (Storage file is not deleted in Phase 1.)

**Auth required:** Yes  
**Path params:** `id` — document UUID

**Response `200`:**
```json
{ "success": true }
```

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `500` | DB delete failed |

---

### `POST /api/documents/:id/process`

Trigger OCR and structured data extraction on an uploaded document using Claude Vision (claude-opus-4-5). Generates a text embedding via OpenAI `text-embedding-3-small`. Updates document status to `processing` → `ready` or `error`.

**Auth required:** Yes  
**Path params:** `id` — document UUID  
**Request body:** None  

**Processing pipeline:**
1. Sets `status = 'processing'`
2. Downloads file from Supabase Storage
3. Sends base64-encoded file to Claude Vision for full OCR + structured JSON extraction
4. Parses `document_type`, `dates`, `amounts`, `parties`, `key_terms` from response
5. Generates embedding via OpenAI `text-embedding-3-small`
6. Updates document with `ocr_text`, `extracted_data`, `embedding`, `status = 'ready'`
7. Logs AI token usage to `ai_usage_logs`

**Response `200`:**
```json
{ "success": true, "status": "ready" }
```

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `404` | Document not found |
| `500` | File download failed, Claude call failed, JSON parse failed — sets status `error` |

**AI models used:**
- `claude-opus-4-5` — OCR + extraction (max 4096 output tokens)
- `text-embedding-3-small` — vector embedding

---

### `POST /api/documents/:id/qa`

Ask a question about a specific document. Uses `claude-sonnet-4-5` with full document context. Returns a **streaming** text response. Persists conversation in `document_qa_sessions` / `document_qa_messages`.

**Auth required:** Yes  
**Path params:** `id` — document UUID  
**Content-Type:** `application/json`

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "What is the monthly rent amount?" }
  ],
  "session_id": "uuid | null"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | `Array<{role, content}>` | ✓ | Conversation messages (latest last) |
| `session_id` | `string \| null` | — | Existing QA session ID to continue; omit to start new |

**Response `200`:** `text/plain` stream (Vercel AI SDK `toTextStreamResponse()`)  
**Response header:** `x-session-id: <uuid>` — use this to continue the session

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session (plain text) |
| `404` | Document not found (plain text) |

**AI model used:** `claude-sonnet-4-5` (max 1024 output tokens)

---

## 2. Receipts

### `GET /api/receipts`

List all receipts for the household, ordered newest first.

**Auth required:** Yes  

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "household_id": "uuid",
    "uploaded_by": "uuid",
    "image_path": "receipts/{household_id}/{uuid}/receipt.jpg",
    "ocr_text": "[{\"name\":\"Samsung TV\",\"price\":8999.00,\"qty\":1}]",
    "retailer": "Makro",
    "purchase_date": "2025-01-15",
    "total_amount": 8999.00,
    "currency": "ZAR",
    "items": [{ "name": "Samsung TV", "price": 8999.00, "qty": 1 }],
    "status": "ready",
    "created_at": "2025-01-15T10:30:00Z"
  }
]
```

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `500` | DB query failed |

---

### `POST /api/receipts`

Upload a receipt image. Does **not** trigger OCR — call `/process` next.

**Auth required:** Yes  
**Content-Type:** `multipart/form-data`

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | `File` | ✓ | Receipt image (JPEG, PNG) |

**Response `201`:**
```json
{
  "id": "uuid",
  "household_id": "uuid",
  "uploaded_by": "uuid",
  "image_path": "receipts/{household_id}/{uuid}/receipt.jpg",
  "status": "uploading",
  "ocr_text": null,
  "retailer": null,
  "purchase_date": null,
  "total_amount": null,
  "currency": "ZAR",
  "items": null,
  "created_at": "2025-01-15T10:30:00Z"
}
```

**Error codes:**
| Code | Condition |
|------|-----------|
| `400` | No file or no household |
| `401` | No valid session |
| `500` | Storage upload or DB insert failed |

---

### `GET /api/receipts/:id`

Fetch a single receipt by ID.

**Auth required:** Yes  
**Path params:** `id` — receipt UUID

**Response `200`:** Same shape as individual receipt object above.

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `404` | Receipt not found |

---

### `DELETE /api/receipts/:id`

Delete a receipt record.

**Auth required:** Yes  

**Response `200`:**
```json
{ "success": true }
```

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `500` | DB delete failed |

---

### `POST /api/receipts/:id/process`

Run OCR on a receipt image using Claude Vision. Extracts line items, retailer, date, totals, and automatically creates warranty records for eligible products.

**Auth required:** Yes  
**Path params:** `id` — receipt UUID  
**Request body:** None  

**Processing pipeline:**
1. Sets `status = 'processing'`
2. Downloads image from Supabase Storage
3. Sends base64 image to Claude Vision (claude-opus-4-5)
4. Parses: `retailer`, `purchase_date`, `total_amount`, `currency`, `items[]`, `warranty_candidates[]`
5. Updates receipt with extracted fields, sets `status = 'ready'`
6. For each `warranty_candidate`: creates a `warranties` row with computed `expiry_date`
7. Logs AI token usage

**Response `200`:**
```json
{ "success": true }
```

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `404` | Receipt not found |
| `500` | File download, AI call, or JSON parse failed — sets status `error` |

**AI model used:** `claude-opus-4-5` (max 1024 output tokens)

---

## 3. Warranties

### `GET /api/warranties`

List all active warranties for the household, ordered by expiry date (soonest first).

**Auth required:** Yes  

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "receipt_id": "uuid",
    "household_id": "uuid",
    "product_name": "Samsung 65\" QLED TV",
    "warranty_months": 24,
    "expiry_date": "2027-01-15",
    "alert_sent": false,
    "created_at": "2025-01-15T10:30:00Z",
    "receipts": {
      "retailer": "Makro",
      "purchase_date": "2025-01-15"
    }
  }
]
```

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `500` | DB query failed |

---

## 4. Budget

### `GET /api/budget/transactions`

List up to 100 transactions for the household, newest first.

**Auth required:** Yes  

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "household_id": "uuid",
    "source": "manual",
    "description": "Grocery shopping",
    "amount": 1250.00,
    "category": "Food",
    "transaction_date": "2025-01-20",
    "is_income": false,
    "statement_ref": null,
    "created_at": "2025-01-20T14:00:00Z"
  }
]
```

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `500` | DB query failed |

---

### `POST /api/budget/transactions`

Create a budget transaction manually.

**Auth required:** Yes  
**Content-Type:** `application/json`

**Request body:**
```json
{
  "description": "Grocery shopping",
  "amount": 1250.00,
  "transaction_date": "2025-01-20",
  "is_income": false,
  "category": "Food",
  "source": "manual",
  "statement_ref": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | ✓ | Transaction description |
| `amount` | `number` | ✓ | Absolute amount (always positive) |
| `transaction_date` | `string` | ✓ | ISO date `YYYY-MM-DD` |
| `is_income` | `boolean` | — | `false` = expense (default) |
| `category` | `string \| null` | — | Category name |
| `source` | `"manual" \| "statement" \| "bank_api"` | — | Defaults to `"manual"` |
| `statement_ref` | `string \| null` | — | Bank statement reference |

**Response `201`:** Full `BudgetTransaction` object

**Error codes:**
| Code | Condition |
|------|-----------|
| `400` | No household for user |
| `401` | No valid session |
| `500` | DB insert failed |

---

### `GET /api/budget/categories`

List all budget categories for the household, alphabetical.

**Auth required:** Yes  

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "household_id": "uuid",
    "name": "Food",
    "icon": "🛒",
    "is_income": false,
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

---

### `POST /api/budget/categories`

Create a new budget category.

**Auth required:** Yes  

**Request body:**
```json
{
  "name": "Groceries",
  "icon": "🛒",
  "is_income": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✓ | Category name |
| `icon` | `string \| null` | — | Emoji or icon identifier |
| `is_income` | `boolean` | — | `false` = expense category |

**Response `201`:** Full `BudgetCategory` object

---

### `GET /api/budget/summary`

Retrieve a pre-computed monthly budget summary from the `budget_summaries` materialised view/table.

**Auth required:** Yes  
**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `month` | `string` | Current month | ISO date of first day: `YYYY-MM-01` |

**Example:** `GET /api/budget/summary?month=2025-01-01`

**Response `200`:**
```json
{
  "id": "uuid",
  "household_id": "uuid",
  "month": "2025-01-01",
  "total_income": 45000.00,
  "total_expenses": 28750.00,
  "by_category": {
    "Food": 5200.00,
    "Utilities": 3100.00,
    "Transport": 2800.00
  },
  "created_at": "2025-02-01T00:00:00Z"
}
```

Returns `{ total_income: 0, total_expenses: 0, by_category: {} }` if no summary exists for the requested month.

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `500` | DB query failed (non-PGRST116 error) |

---

## 5. Inbox

### `GET /api/inbox/addresses`

List all inbound email addresses provisioned for the household.

**Auth required:** Yes  

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "household_id": "uuid",
    "email_address": "absa-a1b2c3d4@inbound.householdos.co.za",
    "label": "ABSA",
    "is_active": true,
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

---

### `POST /api/inbox/addresses`

Provision a new inbound email address for the household. The address is auto-generated as `{label-slug}-{8-char-uuid}@inbound.householdos.co.za`.

**Auth required:** Yes  

**Request body:**
```json
{ "label": "ABSA Bank" }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | `string` | ✓ | Human-readable label (e.g. "ABSA") |

**Response `201`:**
```json
{
  "id": "uuid",
  "household_id": "uuid",
  "email_address": "absa-bank-a1b2c3d4@inbound.householdos.co.za",
  "label": "ABSA Bank",
  "is_active": true,
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

### `GET /api/inbox/messages`

List up to 50 inbox messages for the household, newest first. Includes the `inbox_addresses` join (label + email address).

**Auth required:** Yes  

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "household_id": "uuid",
    "inbox_address_id": "uuid",
    "from_email": "noreply@absa.co.za",
    "subject": "Your January 2025 Statement",
    "body": "Please find your statement attached.",
    "raw_payload": null,
    "status": "parsed",
    "parsed_data": { "bank_name": "ABSA", "transactions": [] },
    "received_at": "2025-02-01T06:00:00Z",
    "created_at": "2025-02-01T06:00:01Z",
    "inbox_addresses": {
      "label": "ABSA Bank",
      "email_address": "absa-bank-a1b2c3d4@inbound.householdos.co.za"
    }
  }
]
```

---

### `GET /api/inbox/messages/:id`

Fetch a single inbox message with address details and all attachments.

**Auth required:** Yes  
**Path params:** `id` — message UUID

**Response `200`:** Same shape as above plus `inbox_attachments: InboxAttachment[]`

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `404` | Message not found |

---

## 6. Chat

### `POST /api/chat`

The household AI coordinator. Routes questions across all modules (documents, receipts, budget, warranties, inbox) using a rich household context snapshot. Returns a **streaming** text response.

**Auth required:** Yes  
**Content-Type:** `application/json`

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "What's my total spending on food this month?" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | `Array<{role: "user"\|"assistant", content: string}>` | ✓ | Full conversation history |

**Household context injected automatically:**
- Up to 20 ready documents (filename + extracted_data)
- Up to 10 active warranties (product + expiry)
- 5 most recent budget transactions
- 5 most recent inbox messages

**Modules:** `document_qa`, `receipt_lookup`, `budget`, `warranty_check`, `inbox`, `general`

**Response `200`:** `text/plain` stream (Vercel AI SDK)

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session (plain text) |
| `400` | No household for user (plain text) |

**AI model used:** `claude-sonnet-4-5` (max 2048 output tokens)

**Compliance note:** All responses are informational only — not financial advice. Account numbers are never returned in full (POPIA/FSCA compliance).

---

## 7. HITL (Human-in-the-Loop)

### `GET /api/hitl`

List all HITL action proposals for the household, newest first.

**Auth required:** Yes  

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "household_id": "uuid",
    "user_id": "uuid",
    "action_type": "dispute",
    "module": "budget",
    "title": "Dispute Debit Order — R1,200",
    "description": "Unrecognised debit order from XYZ Ltd on 2025-01-20.",
    "proposed_action": {
      "bank": "ABSA",
      "amount": 1200.00,
      "reference": "XYZ LTD 20JAN"
    },
    "status": "proposed",
    "approved_at": null,
    "executed_at": null,
    "result": null,
    "created_at": "2025-01-21T08:00:00Z"
  }
]
```

**Status values:** `proposed` → `approved` | `rejected` → `executed` | `failed`

---

### `POST /api/hitl`

Approve or reject a HITL action proposal. Only actions in `proposed` status can be actioned.

**Auth required:** Yes  
**Content-Type:** `application/json`

**Request body:**
```json
{
  "action_id": "uuid",
  "decision": "approve"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action_id` | `string` | ✓ | UUID of the `hitl_actions` row |
| `decision` | `"approve" \| "reject"` | ✓ | User's decision |

**Response `200`:**
```json
{ "success": true }
```

**Error codes:**
| Code | Condition |
|------|-----------|
| `400` | Invalid decision value |
| `401` | No valid session |
| `500` | DB update failed |

---

## 8. Notifications

### `GET /api/notifications`

List up to 50 notifications for the authenticated user, newest first.

**Auth required:** Yes  

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "household_id": "uuid",
    "user_id": "uuid",
    "type": "warranty_expiry",
    "title": "Warranty expiring soon",
    "body": "Samsung 65\" QLED TV warranty expires in 30 days.",
    "module": "receipts",
    "reference_id": "uuid",
    "is_read": false,
    "created_at": "2025-12-15T08:00:00Z"
  }
]
```

---

### `PATCH /api/notifications`

Mark a notification as read.

**Auth required:** Yes  

**Request body:**
```json
{ "id": "uuid" }
```

**Response `200`:**
```json
{ "success": true }
```

**Error codes:**
| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `500` | DB update failed |

---

## 9. Webhooks

### `POST /api/webhooks/postmark`

Inbound email webhook called by Postmark when an email arrives at a `@inbound.householdos.co.za` address. **Not authenticated via session** — routing security is by matching `To` against active `inbox_addresses`.

**Auth required:** No (Postmark server-to-server)  
**Content-Type:** `application/json`

**Request body (Postmark inbound payload):**
```json
{
  "To": "absa-bank-a1b2c3d4@inbound.householdos.co.za",
  "From": "noreply@absa.co.za",
  "Subject": "January 2025 Statement",
  "TextBody": "Please find your statement attached.",
  "HtmlBody": "<p>Please find...</p>",
  "Attachments": [
    {
      "Name": "statement-jan-2025.pdf",
      "Content": "<base64>",
      "ContentType": "application/pdf"
    }
  ]
}
```

**Processing pipeline:**
1. Matches `To` address against `inbox_addresses` (must be `is_active = true`)
2. Inserts `inbox_messages` row with `status = 'processing'`
3. For each attachment: uploads to Supabase Storage, inserts `inbox_attachments` row
4. For PDF/image attachments: sends to Claude Vision for bank statement extraction
5. Inserts parsed transactions into `budget_transactions` (source = `'statement'`)
6. Updates message `status = 'parsed'` (or `'error'` on failure)
7. If no attachments: marks message `status = 'parsed'` immediately

**Response `200`:** `OK` (plain text)  
**Response `404`:** Address not found or inactive

**AI model used:** `claude-opus-4-5` (max 4096 output tokens)

---

## Summary Table

| # | Method | Path | Auth | AI | Stream |
|---|--------|------|------|----|--------|
| 1 | `GET` | `/api/documents` | ✓ | — | — |
| 2 | `POST` | `/api/documents` | ✓ | — | — |
| 3 | `GET` | `/api/documents/:id` | ✓ | — | — |
| 4 | `DELETE` | `/api/documents/:id` | ✓ | — | — |
| 5 | `POST` | `/api/documents/:id/process` | ✓ | Claude Opus + OpenAI Embed | — |
| 6 | `POST` | `/api/documents/:id/qa` | ✓ | Claude Sonnet | ✓ |
| 7 | `GET` | `/api/receipts` | ✓ | — | — |
| 8 | `POST` | `/api/receipts` | ✓ | — | — |
| 9 | `GET` | `/api/receipts/:id` | ✓ | — | — |
| 10 | `DELETE` | `/api/receipts/:id` | ✓ | — | — |
| 11 | `POST` | `/api/receipts/:id/process` | ✓ | Claude Opus | — |
| 12 | `GET` | `/api/warranties` | ✓ | — | — |
| 13 | `GET` | `/api/budget/transactions` | ✓ | — | — |
| 14 | `POST` | `/api/budget/transactions` | ✓ | — | — |
| 15 | `GET` | `/api/budget/categories` | ✓ | — | — |
| 16 | `POST` | `/api/budget/categories` | ✓ | — | — |
| 17 | `GET` | `/api/budget/summary` | ✓ | — | — |
| 18 | `GET` | `/api/inbox/addresses` | ✓ | — | — |
| 19 | `POST` | `/api/inbox/addresses` | ✓ | — | — |
| 20 | `GET` | `/api/inbox/messages` | ✓ | — | — |
| 21 | `GET` | `/api/inbox/messages/:id` | ✓ | — | — |
| 22 | `POST` | `/api/chat` | ✓ | Claude Sonnet | ✓ |
| 23 | `GET` | `/api/hitl` | ✓ | — | — |
| 24 | `POST` | `/api/hitl` | ✓ | — | — |
| 25 | `GET` | `/api/notifications` | ✓ | — | — |
| 26 | `PATCH` | `/api/notifications` | ✓ | — | — |
| 27 | `POST` | `/api/webhooks/postmark` | — | Claude Opus | — |

> **Note:** The task brief specified 18 routes; the implemented codebase has 27 route handlers across the 18 route files.
