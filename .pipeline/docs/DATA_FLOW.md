# HouseholdOS — Data Flow Reference
**Phase 1 | Generated from source audit of `/src/app/api/`**

---

## 1. Document Upload → OCR → Q&A

A user uploads a document (PDF, image) via the UI, which stores it in Supabase Storage under the `documents` bucket. The client then calls `POST /api/documents/[id]/process`, which downloads the file, encodes it as base64, and sends it to Claude Opus (`claude-opus-4-5`) via Vision — extracting both verbatim OCR text and a structured JSON block (document type, dates, amounts, parties, key terms). The OCR text + extracted JSON are then embedded via OpenAI `text-embedding-3-small` and all three outputs (`ocr_text`, `extracted_data`, `embedding`) are written back to the `documents` row with `status = ready`. When the user asks a question, `POST /api/documents/[id]/qa` loads the document's OCR text and extracted data, injects them as a system prompt, and streams a response via Claude Sonnet (`claude-sonnet-4-5`) — persisting both the user message and assistant reply to `document_qa_messages` under the active session.

**Steps:**
1. User uploads file → Supabase Storage (`documents` bucket, path `<household_id>/<filename>`)
2. UI calls `POST /api/documents/[id]/process`
3. API sets `documents.status = processing`
4. File downloaded from Storage → base64-encoded
5. Claude Opus Vision: full OCR text + structured JSON extraction (type, dates, amounts, parties, key terms)
6. JSON block parsed from model response; OCR text isolated
7. Combined text sent to OpenAI `text-embedding-3-small` → 1536-dim vector
8. `documents` row updated: `ocr_text`, `extracted_data`, `embedding`, `status = ready`
9. AI token usage logged to `ai_usage_logs`
10. User submits question → `POST /api/documents/[id]/qa`
11. API creates or reuses a `document_qa_sessions` record
12. Prior messages loaded from `document_qa_messages` (last 20)
13. System prompt built with full OCR text + extracted JSON
14. Claude Sonnet streams response to client
15. On finish: user + assistant messages persisted to `document_qa_messages`

---

## 2. Email Ingestion (Postmark Webhook)

Emails sent to a household's dedicated inbox address are received by Postmark, which fires a `POST /api/webhooks/postmark` webhook. The handler verifies the request using HMAC-SHA256 (`x-postmark-signature` against `POSTMARK_WEBHOOK_TOKEN`), looks up the destination address in `inbox_addresses`, inserts a row into `inbox_messages`, then iterates attachments — uploading each to Supabase Storage and recording it in `inbox_attachments`. For PDF/image attachments, Claude Opus attempts bank-statement parsing: if successful, `inbox_messages.parsed_data` is updated and any extracted transactions are bulk-inserted into `budget_transactions`.

**Steps:**
1. Email arrives at household inbox address (e.g. `household-abc@in.householdos.app`)
2. Postmark fires `POST /api/webhooks/postmark`
3. HMAC-SHA256 signature verified against `POSTMARK_WEBHOOK_TOKEN`
4. `inbox_addresses` queried by `To` address → resolved to `household_id`
5. `inbox_messages` row inserted (`status = processing`)
6. For each attachment:
   a. Decoded from base64 → uploaded to Storage (`documents` bucket, path `inbox/<household_id>/<message_id>/<filename>`)
   b. `inbox_attachments` row inserted
   c. If PDF or image: Claude Opus Vision parses as bank statement
   d. On success: `inbox_messages.parsed_data` updated, `status = parsed`
   e. Transactions bulk-inserted into `budget_transactions` (`source = statement`)
7. If no attachments: `inbox_messages.status = parsed` immediately

---

## 3. Receipt Upload → OCR → Warranty Detection

A user photographs a receipt and uploads it via the UI. The image is stored in Supabase Storage and a `receipts` row is created. The client calls `POST /api/receipts/[id]/process`, which downloads the image, sends it to Claude Opus Vision with a strict JSON schema requesting retailer, date, total, line items, and `warranty_candidates`. If `warranty_candidates` are returned and a purchase date is present, warranty expiry dates are calculated (purchase date + estimated warranty months) and inserted into the `warranties` table. The `receipts` row is updated with all extracted fields and `status = ready`.

**Steps:**
1. User uploads receipt photo → Supabase Storage (`documents` bucket, path `receipts/<household_id>/<filename>`)
2. `receipts` row created with `image_path` and `status = pending`
3. UI calls `POST /api/receipts/[id]/process`
4. API sets `receipts.status = processing`
5. Image downloaded from Storage → base64-encoded
6. Claude Opus Vision returns JSON: `{ retailer, purchase_date, total_amount, currency, items[], warranty_candidates[] }`
7. `receipts` row updated: `retailer`, `purchase_date`, `total_amount`, `currency`, `items`, `status = ready`
8. For each `warranty_candidate`:
   - Expiry = `purchase_date + estimated_warranty_months`
   - Row inserted into `warranties` (`receipt_id`, `household_id`, `product_name`, `warranty_months`, `expiry_date`)
9. AI token usage logged to `ai_usage_logs`

---

## 4. Budget Flow

Budget transactions enter the system via two paths: manual entry through `POST /api/budget/transactions` (user types in a description, amount, date, category, and income flag), or automated import from parsed bank statements (written directly by the Postmark webhook handler with `source = statement`). All transactions land in `budget_transactions`. Monthly summaries — total income, total expenses, and a per-category breakdown — are read from the `budget_summaries` view/table via `GET /api/budget/summary?month=YYYY-MM-DD`.

**Steps:**
1. **Manual entry:** User submits form → `POST /api/budget/transactions` → validated with Zod → inserted into `budget_transactions` (`source = manual`)
2. **Statement import:** Postmark webhook parses bank statement → transactions bulk-inserted into `budget_transactions` (`source = statement`)
3. `budget_transactions` stores: `description`, `amount`, `is_income`, `transaction_date`, `category`, `source`, `statement_ref`
4. `GET /api/budget/summary?month=YYYY-MM-01` → returns `{ total_income, total_expenses, by_category }` from `budget_summaries`
5. Chat coordinator also queries `budget_transactions` (last 5) for real-time context in `/api/chat`

---

## 5. Chat Coordinator

The chat endpoint acts as a single-entry AI router for all household queries. On `POST /api/chat`, the API first fetches a rich household context snapshot (documents, active warranties, recent transactions, recent inbox messages) in parallel via four concurrent Supabase queries. This context, along with module routing rules and POPIA compliance instructions, is injected into Claude Sonnet's system prompt. The model classifies the user's intent against six modules (`document_qa`, `receipt_lookup`, `budget`, `warranty_check`, `inbox`, `general`) and synthesises a response — streaming it directly to the client. For consequential actions (disputes, claims), the model is instructed to propose a HITL action rather than acting autonomously.

**Steps:**
1. User sends message → `POST /api/chat` with `{ messages[] }`
2. API resolves `household_id` from authenticated user profile
3. Household context built in parallel: 20 recent documents, active warranties, 5 recent transactions, 5 recent inbox messages
4. System prompt assembled: module list + household context + routing rules + POPIA constraints
5. Claude Sonnet (`claude-sonnet-4-5`) classifies intent → routes to appropriate module context
6. Response streamed via `streamText` → `toTextStreamResponse()`
7. On finish: token usage logged to `ai_usage_logs`

---

## 6. HITL Pipeline (Human-in-the-Loop)

When the AI identifies a consequential action (e.g. filing a warranty claim, disputing a charge), it creates an entry in `hitl_actions` with `status = proposed`. The frontend polls or subscribes to `GET /api/hitl` to surface pending actions as `ActionCard` components. The user reviews the proposed action and either approves or rejects it via `POST /api/hitl`. Approval sets `status = approved` and records `approved_at`; rejection sets `status = rejected`. Downstream execution logic reads approved actions — the current phase stores state only (no auto-execution wired in Phase 1).

**Steps:**
1. AI (chat or processing agent) determines a consequential action is needed
2. `hitl_actions` row inserted: `{ household_id, action_type, description, payload, status = proposed }`
3. Frontend calls `GET /api/hitl` → list of pending actions returned
4. User sees `ActionCard` in UI for each `proposed` action
5. User approves → `POST /api/hitl { action_id, decision: "approve" }`
   - Updates `hitl_actions.status = approved`, sets `approved_at`
6. User rejects → `POST /api/hitl { action_id, decision: "reject" }`
   - Updates `hitl_actions.status = rejected`
7. Only rows with `status = proposed` can be transitioned (guarded by `.eq('status', 'proposed')` in update)

---

## Sequence Diagram — Document Upload → Q&A

```
User          UI/Client         /api/documents        Supabase Storage    Supabase DB        Claude (Opus)   OpenAI (Embed)
 |                |                    |                      |                 |                  |               |
 |-- upload file->|                    |                      |                 |                  |               |
 |                |-- PUT file ------->|                      |                 |                  |               |
 |                |                   |--- upload(file) ----->|                 |                  |               |
 |                |                   |<-- storage path -----||                 |                  |               |
 |                |                   |--- INSERT documents ------------------>|                  |               |
 |                |<-- doc.id --------|                      |                 |                  |               |
 |                |                   |                      |                 |                  |               |
 |-- click "Process"->               |                      |                 |                  |               |
 |                |-- POST /process -->|                      |                 |                  |               |
 |                |                   |--- UPDATE status=processing ---------->|                  |               |
 |                |                   |--- download(file_path) -------------->|                  |               |
 |                |                   |<-- file bytes ----------------------- |                  |               |
 |                |                   |-- base64 encode                       |                  |               |
 |                |                   |-- generateText(image+prompt) -------->|                  |               |
 |                |                   |<-- ocr_text + extracted_data JSON ----|                  |               |
 |                |                   |-- embeddings.create(text) -------------------------------->|              |
 |                |                   |<-- [1536-dim vector] ------------------------------------|              |
 |                |                   |--- UPDATE documents (ocr_text, extracted_data,           |               |
 |                |                   |    embedding, status=ready) -------->|                   |               |
 |                |<-- { success } ---|                      |                 |                  |               |
 |                |                   |                      |                 |                  |               |
 |-- ask question->|                  |                      |                 |                  |               |
 |                |-- POST /qa ------->|                      |                 |                  |               |
 |                |                   |--- SELECT documents (ocr_text, extracted_data) -------->|               |
 |                |                   |--- INSERT document_qa_sessions ------->|                 |               |
 |                |                   |--- SELECT document_qa_messages ------->|                 |               |
 |                |                   |-- build system prompt (doc context)   |                  |               |
 |                |                   |-- streamText(messages) --------------->|                  |               |
 |                |<-- stream chunks--|                      |                 |                  |               |
 |<-- answer ---  |                   |                      |                 |                  |               |
 |                |                   |  [on finish]         |                 |                  |               |
 |                |                   |--- INSERT qa_messages (user+assistant)>|                 |               |
 |                |                   |--- INSERT ai_usage_logs -------------->|                 |               |
```

---

## Key Tables Referenced

| Table | Written by | Read by |
|---|---|---|
| `documents` | upload handler, `/process` | `/qa`, `/chat` |
| `document_qa_sessions` | `/qa` | `/qa` |
| `document_qa_messages` | `/qa` | `/qa` |
| `inbox_messages` | Postmark webhook | `/chat` |
| `inbox_attachments` | Postmark webhook | — |
| `receipts` | upload handler, `/process` | `/chat` |
| `warranties` | `/receipts/[id]/process` | `/chat`, `/api/warranties` |
| `budget_transactions` | `/budget/transactions`, Postmark webhook | `/budget/summary`, `/chat` |
| `budget_summaries` | DB view/materialised | `/budget/summary` |
| `hitl_actions` | AI agents | `/api/hitl` |
| `ai_usage_logs` | all AI endpoints | monitoring |
