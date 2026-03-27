# HouseholdOS — AI Architecture

**Author:** AI Specialist  
**Date:** 2026-03-28  
**Status:** Implementation-Ready

---

## Overview

HouseholdOS uses a layered AI stack:
- **Anthropic Claude** (via Vercel AI SDK `@ai-sdk/anthropic`) for all vision, OCR, extraction, Q&A, and coordination
- **OpenAI** (`openai` package) for text embeddings only
- All AI calls are server-side only; no API keys ever reach the client

---

## 1. Document Intelligence Pipeline

### Flow

```
User uploads file
  → Next.js API route: POST /api/documents/upload
  → Upload to Supabase Storage (private bucket: documents/{household_id}/{uuid}/{filename})
  → Insert row into documents table (status='uploading', file_path set)
  → Trigger async processing job (Vercel background function or Supabase Edge Function)
  → Set documents.status = 'processing'
  → Fetch file from Storage → generate signed URL (60s TTL)
  → Download file bytes → base64 encode
  → Claude Vision call → OCR text + structured extraction
  → Store ocr_text, extracted_data in documents row
  → OpenAI embedding call → store in documents.embedding (vector(1536))
  → Set documents.status = 'ready'
  → Supabase Realtime notifies client (documents channel, filter: id=eq.{doc_id})
```

### Claude Vision Call Pattern (OCR + Extraction)

```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const { text } = await generateText({
  model: anthropic('claude-opus-4-5'),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          image: base64ImageString,          // base64-encoded file bytes
          mimeType: mimeType as 'image/jpeg' | 'image/png' | 'application/pdf',
        },
        {
          type: 'text',
          text: `You are a document intelligence system. Perform two tasks:

TASK 1 — Full OCR: Extract every word from this document verbatim. Preserve layout where possible.

TASK 2 — Structured Extraction: Extract and return a JSON block at the end in this exact format:
\`\`\`json
{
  "document_type": "<contract|invoice|statement|receipt|policy|legal|municipal|other>",
  "dates": ["YYYY-MM-DD", ...],
  "amounts": [{ "value": 0.00, "currency": "ZAR", "label": "string" }, ...],
  "parties": ["string", ...],
  "key_terms": ["string", ...]
}
\`\`\`

Return the OCR text first, then the JSON block.`,
        },
      ],
    },
  ],
  maxTokens: 4096,
});
```

**Parsing the response:**
```typescript
const jsonMatch = text.match(/```json\n([\s\S]+?)\n```/);
const extractedData = jsonMatch ? JSON.parse(jsonMatch[1]) : null;
const ocrText = jsonMatch ? text.slice(0, text.indexOf('```json')).trim() : text;
```

**Extracted data format stored in `documents.extracted_data` (jsonb):**
```json
{
  "document_type": "contract",
  "dates": ["2025-01-15", "2026-01-15"],
  "amounts": [{ "value": 12500.00, "currency": "ZAR", "label": "monthly rental" }],
  "parties": ["John Smith", "Acme Property Management"],
  "key_terms": ["12-month lease", "2-month deposit", "30-day notice period"]
}
```

### OpenAI Embedding

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const embeddingInput = [
  ocrText.slice(0, 8000),                    // cap to avoid token limits
  JSON.stringify(extractedData),
].join('\n\n');

const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: embeddingInput,
});

const embedding = response.data[0].embedding; // float[] length 1536
```

**Store via Supabase:**
```typescript
await supabase
  .from('documents')
  .update({
    ocr_text: ocrText,
    extracted_data: extractedData,
    embedding: JSON.stringify(embedding),     // pgvector accepts JSON array
    status: 'ready',
  })
  .eq('id', documentId);
```

### Vector Similarity Search (for future cross-document retrieval)
```sql
SELECT id, filename, ocr_text, extracted_data,
       1 - (embedding <=> '[...vector...]') AS similarity
FROM documents
WHERE household_id = $1
  AND status = 'ready'
ORDER BY embedding <=> '[...vector...]'
LIMIT 5;
```

---

## 2. Document Q&A (Streaming)

### Route: `POST /api/documents/[id]/qa`

**Request body:**
```json
{
  "message": "What is the notice period in this lease?",
  "session_id": "uuid | null"
}
```

**Session management:**
1. If `session_id` is null → insert new row into `document_qa_sessions` (document_id, user_id, household_id)
2. Load prior messages from `document_qa_messages` for this session (ordered by created_at ASC, last 20)
3. Append new user message to history
4. Stream response from Claude
5. On stream complete → insert user + assistant messages into `document_qa_messages`

**Implementation:**
```typescript
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from('documents')
    .select('ocr_text, extracted_data, filename')
    .eq('id', params.id)
    .single();

  const { message, session_id } = await req.json();

  // Load session history
  const priorMessages = session_id
    ? await loadSessionMessages(supabase, session_id)
    : [];

  const systemPrompt = `You are a document assistant for HouseholdOS. Answer questions accurately based ONLY on the document provided.

DOCUMENT: ${doc.filename}

OCR TEXT:
${doc.ocr_text ?? '(no text extracted)'}

EXTRACTED DATA:
${JSON.stringify(doc.extracted_data ?? {}, null, 2)}

Rules:
- Answer only from the document content above
- If the answer is not in the document, say so clearly
- Quote relevant sections when helpful
- For amounts, always include currency
- For dates, use DD Month YYYY format`;

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: systemPrompt,
    messages: [
      ...priorMessages,
      { role: 'user', content: message },
    ],
    maxTokens: 1024,
    onFinish: async ({ text, usage }) => {
      // Persist messages
      await supabase.from('document_qa_messages').insert([
        { session_id, household_id: doc.household_id, role: 'user', content: message },
        { session_id, household_id: doc.household_id, role: 'assistant', content: text },
      ]);
      // Log usage
      await logAiUsage(supabase, {
        model: 'claude-sonnet-4-5',
        endpoint: `/api/documents/${params.id}/qa`,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      });
    },
  });

  return result.toDataStreamResponse();
}
```

**Client-side (React):**
```typescript
import { useChat } from 'ai/react';

const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: `/api/documents/${documentId}/qa`,
  body: { session_id: sessionId },
});
```

---

## 3. Receipt OCR

### Route: `POST /api/receipts/[id]/process`

**Triggered after upload to Supabase Storage. Updates `receipts` table.**

### Claude Vision Call Pattern

```typescript
const { text } = await generateText({
  model: anthropic('claude-opus-4-5'),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          image: base64ImageString,
          mimeType: 'image/jpeg',
        },
        {
          type: 'text',
          text: `Extract receipt data from this image. Return ONLY valid JSON in this exact format:
{
  "status": "ok" | "partial" | "error",
  "error_message": "string | null",
  "retailer": "string | null",
  "purchase_date": "YYYY-MM-DD | null",
  "total_amount": 0.00,
  "currency": "ZAR",
  "items": [
    { "name": "string", "price": 0.00, "qty": 1 }
  ],
  "warranty_candidates": [
    {
      "product_name": "string",
      "category": "electronics|appliance|other",
      "estimated_warranty_months": 24
    }
  ]
}

Warranty detection rules:
- Electronics (phones, laptops, TVs, cameras): 12-24 months typical
- Major appliances (fridge, washing machine, dishwasher): 12-24 months
- Small appliances (kettle, iron, toaster): 12 months
- Power tools: 12 months
- If image is blurry or unreadable, set status="error" and populate error_message
- If partially readable, set status="partial" and fill what you can

Return ONLY the JSON. No explanation.`,
        },
      ],
    },
  ],
  maxTokens: 1024,
});

const receiptData = JSON.parse(text);
```

### Writing to Database

```typescript
// Update receipts table
await supabase
  .from('receipts')
  .update({
    ocr_text: JSON.stringify(receiptData.items),
    retailer: receiptData.retailer,
    purchase_date: receiptData.purchase_date,
    total_amount: receiptData.total_amount,
    currency: receiptData.currency ?? 'ZAR',
    items: receiptData.items,
    status: receiptData.status === 'error' ? 'error' : 'ready',
  })
  .eq('id', receiptId);

// Create warranty records for detected candidates
if (receiptData.warranty_candidates?.length && receiptData.purchase_date) {
  const purchaseDate = new Date(receiptData.purchase_date);
  const warrantyInserts = receiptData.warranty_candidates.map((w) => {
    const expiry = new Date(purchaseDate);
    expiry.setMonth(expiry.getMonth() + w.estimated_warranty_months);
    return {
      receipt_id: receiptId,
      household_id: householdId,
      product_name: w.product_name,
      warranty_months: w.estimated_warranty_months,
      expiry_date: expiry.toISOString().split('T')[0],
    };
  });
  await supabase.from('warranties').insert(warrantyInserts);
}
```

### Fallback for Blurry Images

- `status: 'partial'` → save whatever was extracted, surface to UI with a banner: "Some details could not be read. Please review and correct."
- `status: 'error'` → set `receipts.status = 'error'`, show error_message in UI, offer retry option
- Never silently drop data — always write what exists

---

## 4. Email Statement Parsing

### Route: `POST /api/webhooks/postmark`

**Postmark inbound webhook payload → parse → process attachments → extract financial data**

### Webhook Handler

```typescript
export async function POST(req: Request) {
  const payload = await req.json();

  // 1. Verify the To address matches a known inbox_addresses.email_address
  const toAddress = payload.To?.toLowerCase();
  const { data: inboxAddr } = await supabase
    .from('inbox_addresses')
    .select('id, household_id')
    .eq('email_address', toAddress)
    .eq('is_active', true)
    .single();

  if (!inboxAddr) return new Response('Not found', { status: 404 });

  // 2. Insert inbox_messages row
  const { data: message } = await supabase
    .from('inbox_messages')
    .insert({
      household_id: inboxAddr.household_id,
      inbox_address_id: inboxAddr.id,
      from_email: payload.From,
      subject: payload.Subject,
      body: payload.TextBody ?? payload.HtmlBody,
      raw_payload: payload,
      status: 'processing',
    })
    .select()
    .single();

  // 3. Process attachments asynchronously
  for (const attachment of payload.Attachments ?? []) {
    await processStatementAttachment(message.id, inboxAddr.household_id, attachment);
  }

  return new Response('OK', { status: 200 });
}
```

### Attachment Processing

```typescript
async function processStatementAttachment(messageId, householdId, attachment) {
  // Upload to Supabase Storage
  const bytes = Buffer.from(attachment.Content, 'base64');
  const filePath = `inbox/${householdId}/${messageId}/${attachment.Name}`;
  await supabase.storage.from('documents').upload(filePath, bytes, {
    contentType: attachment.ContentType,
  });

  // Insert inbox_attachments row
  const { data: att } = await supabase
    .from('inbox_attachments')
    .insert({
      message_id: messageId,
      household_id: householdId,
      filename: attachment.Name,
      file_path: filePath,
      file_size: bytes.length,
      mime_type: attachment.ContentType,
    })
    .select()
    .single();

  // Run Claude Vision extraction
  const extractedStatement = await extractStatement(bytes, attachment.ContentType);

  // Update inbox_messages.parsed_data and status
  await supabase
    .from('inbox_messages')
    .update({
      parsed_data: extractedStatement,
      status: extractedStatement ? 'parsed' : 'error',
    })
    .eq('id', messageId);

  // Upsert budget_transactions from parsed transactions
  if (extractedStatement?.transactions?.length) {
    await insertBudgetTransactions(householdId, extractedStatement.transactions);
  }
}
```

### Claude Vision — Statement Extraction

```typescript
async function extractStatement(fileBytes: Buffer, mimeType: string) {
  const { text } = await generateText({
    model: anthropic('claude-opus-4-5'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: fileBytes.toString('base64'),
            mimeType: mimeType as 'image/jpeg' | 'image/png' | 'application/pdf',
          },
          {
            type: 'text',
            text: `Extract bank statement data from this document. Return ONLY valid JSON:
{
  "bank_name": "ABSA | Standard Bank | Nedbank | Capitec | FNB | Other",
  "account_number": "string (last 4 digits only for security)",
  "statement_period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "opening_balance": 0.00,
  "closing_balance": 0.00,
  "currency": "ZAR",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": 0.00,
      "is_debit": true,
      "balance_after": 0.00,
      "reference": "string | null"
    }
  ]
}

SA bank format notes:
- ABSA: debits shown as negative, date format DD Mon YYYY
- Standard Bank: "DR" suffix for debits, "CR" for credits
- Nedbank: separate debit/credit columns
- Capitec: transaction type column (Payment/Purchase/Deposit)
- FNB: amount column with +/- prefix
- All amounts in ZAR unless otherwise stated
- Return ONLY the JSON. No explanation.`,
          },
        ],
      },
    ],
    maxTokens: 4096,
  });

  return JSON.parse(text);
}
```

### Budget Transaction Insert

```typescript
async function insertBudgetTransactions(householdId: string, transactions: any[]) {
  const rows = transactions.map((t) => ({
    household_id: householdId,
    source: 'statement',
    description: t.description,
    amount: Math.abs(t.amount),
    transaction_date: t.date,
    is_income: !t.is_debit,
    statement_ref: t.reference ?? null,
    category: null,                          // AI categorisation is a separate pass
  }));

  await supabase
    .from('budget_transactions')
    .upsert(rows, { onConflict: 'household_id,description,transaction_date,amount' });
}
```

---

## 5. Coordinator Agent

### Route: `POST /api/chat`

The Coordinator is the central conversational AI. It classifies intent, routes to the correct module handler, and synthesises responses with full household context.

### Intent Classification + Routing

```typescript
import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const COORDINATOR_SYSTEM = `You are the HouseholdOS AI assistant. You have access to the following modules:

MODULES:
- document_qa: Questions about uploaded documents (leases, contracts, policies)
- receipt_lookup: Finding purchases, warranties, specific items bought
- budget: Income/expense questions, category summaries, spending trends
- warranty_check: Product warranty status and expiry
- inbox: Questions about received statements or emails
- general: General household advice, platform help

HOUSEHOLD CONTEXT:
{HOUSEHOLD_CONTEXT}

ROUTING RULES:
1. Classify the user's intent to one module
2. For document questions, identify which document (by filename or type)
3. For budget questions, identify the time period
4. Always respond in plain language — no JSON to the user
5. If multiple modules are needed, synthesise a single coherent answer
6. For consequential actions (disputes, claims, bookings), create a HITL action proposal

POPIA / FSCA COMPLIANCE:
- You provide information only — never financial advice
- Never reveal account numbers in full
- All data is private to this household`;

export async function POST(req: Request) {
  const { message, conversation_history, household_id, user_id } = await req.json();

  // Build household context snapshot
  const householdContext = await buildHouseholdContext(household_id);

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: COORDINATOR_SYSTEM.replace('{HOUSEHOLD_CONTEXT}', householdContext),
    messages: conversation_history,            // full multi-turn history from client
    maxTokens: 2048,
    onFinish: async ({ usage }) => {
      await logAiUsage(supabase, {
        householdId: household_id,
        userId: user_id,
        model: 'claude-sonnet-4-5',
        endpoint: '/api/chat',
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      });
    },
  });

  return result.toDataStreamResponse();
}
```

### Household Context Builder

```typescript
async function buildHouseholdContext(householdId: string): Promise<string> {
  const [docs, warranties, recentTx, inbox] = await Promise.all([
    supabase
      .from('documents')
      .select('filename, extracted_data->document_type')
      .eq('household_id', householdId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('warranties')
      .select('product_name, expiry_date, alert_sent')
      .eq('household_id', householdId)
      .gte('expiry_date', new Date().toISOString().split('T')[0])
      .order('expiry_date')
      .limit(10),
    supabase
      .from('budget_transactions')
      .select('description, amount, is_income, transaction_date, category')
      .eq('household_id', householdId)
      .order('transaction_date', { ascending: false })
      .limit(5),
    supabase
      .from('inbox_messages')
      .select('from_email, subject, received_at')
      .eq('household_id', householdId)
      .order('received_at', { ascending: false })
      .limit(5),
  ]);

  return JSON.stringify({
    document_count: docs.data?.length ?? 0,
    documents: docs.data,
    active_warranties: warranties.data,
    recent_transactions: recentTx.data,
    recent_inbox: inbox.data,
  });
}
```

### HITL Action Proposal

When the coordinator identifies a consequential action:

```typescript
await supabase.from('hitl_actions').insert({
  household_id: householdId,
  user_id: userId,
  action_type: 'dispute_draft',
  module: 'municipal',
  title: 'Draft dispute letter for incorrect water bill',
  description: 'Detected R1,450 water bill vs typical R320. Propose to draft a formal dispute.',
  proposed_action: {
    template: 'municipal_dispute',
    amounts: { billed: 1450, typical: 320, dispute_amount: 1130 },
    reference: billDocumentId,
  },
  status: 'proposed',
});
```

---

## 6. Models & SDK

### Dependencies

```json
{
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "openai": "^4.0.0"
  }
}
```

### Model Assignment

| Task | Model | Reason |
|------|-------|--------|
| Receipt OCR | `claude-opus-4-5` | Best vision accuracy for receipts |
| Document OCR + extraction | `claude-opus-4-5` | Best for complex documents |
| Statement parsing | `claude-opus-4-5` | Handles varied SA bank formats |
| Document Q&A (streaming) | `claude-sonnet-4-5` | Fast streaming, cost-effective |
| Coordinator chat | `claude-sonnet-4-5` | Multi-turn, good instruction following |
| Text embeddings | `text-embedding-3-small` | 1536 dims, matches `vector(1536)` schema |

### SDK Patterns

```typescript
// Non-streaming (OCR, extraction, parsing)
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const { text, usage } = await generateText({ model: anthropic('claude-opus-4-5'), ... });

// Streaming (Q&A, chat)
import { streamText } from 'ai';

const result = streamText({ model: anthropic('claude-sonnet-4-5'), ... });
return result.toDataStreamResponse();   // returns ReadableStream for client useChat()
```

### Token Tracking — `ai_usage_log`

Every AI call must log to `ai_usage_log`. Use a shared helper:

```typescript
// lib/ai/log-usage.ts
export async function logAiUsage(supabase, params: {
  householdId: string;
  userId: string;
  model: string;
  endpoint: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs?: number;
}) {
  await supabase.from('ai_usage_log').insert({
    household_id: params.householdId,
    user_id: params.userId,
    model: params.model,
    endpoint: params.endpoint,
    prompt_tokens: params.promptTokens,
    completion_tokens: params.completionTokens,
    total_tokens: params.promptTokens + params.completionTokens,
    latency_ms: params.latencyMs ?? null,
  });
}
```

**Usage log is the basis for:**
- Per-household subscription tier enforcement (e.g. Essential: 500 AI interactions/month)
- Cost tracking and billing reconciliation
- Anomaly detection (runaway loops, abuse)

### Subscription Tier Enforcement

Before every AI call, check usage against tier limits:

```typescript
async function checkAiQuota(supabase, householdId: string): Promise<boolean> {
  const { count } = await supabase
    .from('ai_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .gte('created_at', startOfCurrentMonth());

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('household_id', householdId)
    .single();

  const limits = { essential: 500, household: 2000, premium: Infinity, enterprise: Infinity };
  return (count ?? 0) < limits[sub?.tier ?? 'essential'];
}
```

---

## 7. Environment Variables

All AI credentials are **server-side only** — never in `NEXT_PUBLIC_*` variables.

```env
# Anthropic — Claude Vision, Q&A, Coordinator
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI — text-embedding-3-small only
OPENAI_API_KEY=sk-...
```

### Security Rules
- These keys must **never** appear in client bundles
- All AI routes must be in `app/api/` (Next.js server routes) — not in `app/` client components
- Validate `household_id` via Supabase RLS on every call — never trust client-supplied household_id directly
- Use `createClient()` (server-side Supabase client with user's JWT) not the anon key for AI routes

---

## 8. Error Handling & Resilience

### Vision Extraction Failures
```typescript
try {
  const result = JSON.parse(text);
  return result;
} catch (e) {
  // Claude returned non-JSON — try regex extraction
  const jsonMatch = text.match(/\{[\s\S]+\}/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);
  
  // Total failure — update status to 'error', log
  await supabase
    .from('documents')
    .update({ status: 'error' })
    .eq('id', documentId);
  return null;
}
```

### Retry Strategy
- OCR extraction: 1 automatic retry on JSON parse failure (re-prompt with stricter JSON instruction)
- Embedding: 2 retries with exponential backoff (500ms, 1000ms) for OpenAI rate limits
- Statement parsing: no retry — surface error in `inbox_messages.status = 'error'` for manual review

### Rate Limiting
- Anthropic: 1000 RPM on Sonnet, 100 RPM on Opus — serial processing for batch jobs
- OpenAI embeddings: 3000 RPM — safe for current scale, add queue if batch uploads exceed 50/min
- Postmark webhooks: respond 200 immediately, process async to avoid webhook timeout

---

## 9. Data Flow Diagram

```
                            ┌─────────────────────────────────┐
                            │         SUPABASE STORAGE         │
                            │  documents/{hh_id}/{uuid}/file   │
                            │  inbox/{hh_id}/{msg_id}/attach   │
                            └────────────┬────────────────────┘
                                         │
              ┌──────────────────────────▼────────────────────────────┐
              │              DOCUMENT PROCESSING (server-side)         │
              │                                                         │
              │  1. Fetch bytes from Storage (signed URL)              │
              │  2. base64 encode                                       │
              │  3. generateText(claude-opus-4-5, vision=true)         │
              │  4. Parse OCR text + extracted_data JSON               │
              │  5. openai.embeddings.create(text-embedding-3-small)   │
              │  6. Store ocr_text + extracted_data + embedding        │
              │  7. logAiUsage → ai_usage_log                          │
              └──────────────────────────┬────────────────────────────┘
                                         │
              ┌──────────────────────────▼────────────────────────────┐
              │              DOCUMENTS TABLE (Supabase)                │
              │                                                         │
              │  ocr_text: text                                         │
              │  extracted_data: jsonb                                  │
              │  embedding: vector(1536)                                │
              │  status: 'ready'                                        │
              └──────────────────────────┬────────────────────────────┘
                                         │
                  ┌──────────────────────▼───────────────────┐
                  │         POST /api/documents/[id]/qa        │
                  │                                             │
                  │  streamText(claude-sonnet-4-5)             │
                  │  system: ocr_text + extracted_data          │
                  │  messages: document_qa_messages history     │
                  │  → toDataStreamResponse()                   │
                  └─────────────────────────────────────────────┘
```

---

## 10. File Structure

```
app/
  api/
    documents/
      upload/route.ts           # Upload handler → Storage + db insert
      [id]/
        process/route.ts        # Async OCR + embedding trigger
        qa/route.ts             # Streaming Q&A
    receipts/
      [id]/process/route.ts     # Receipt OCR + warranty detection
    webhooks/
      postmark/route.ts         # Email ingestion + statement parsing
    chat/route.ts               # Coordinator agent (streaming)

lib/
  ai/
    anthropic.ts                # Configured anthropic() client
    openai.ts                   # Configured OpenAI() client
    log-usage.ts                # logAiUsage() helper
    quota.ts                    # checkAiQuota() helper
    extract-document.ts         # Claude Vision OCR + extraction
    extract-receipt.ts          # Receipt OCR + warranty detection
    extract-statement.ts        # Statement parsing (SA bank formats)
    embed-document.ts           # OpenAI embedding helper
    coordinator.ts              # System prompt + context builder
```
