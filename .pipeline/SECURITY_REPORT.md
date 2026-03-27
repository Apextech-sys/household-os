# HouseholdOS Phase 1 — Security Report

**Date:** 2026-03-28  
**Reviewer:** Security Subagent  
**Scope:** `/home/shaun/projects/household-os/src` + `.env.local`  
**Overall Verdict:** ⛔ FAIL — 4 blockers must be resolved before production deployment

---

## Check Results

### 1. Secret / Credential Exposure — ⚠️ CONDITIONAL PASS

**Finding:** `.env.local` contains real credentials:
```
ANTHROPIC_API_KEY=sk-ant-api03-_dt57yol...
OPENAI_API_KEY=sk-proj-DE8-hd4M...
NEXT_PUBLIC_SUPABASE_URL=https://vzyeuxczwdpvlfwfzjih.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

**Assessment:**
- No secrets are hardcoded in source files (`.ts`/`.tsx`) — the `grep` returned empty. ✅
- `.gitignore` correctly excludes `.env*.local`. ✅
- However, there is **no `.env.example`** file documenting which variables are required. This is a deployment safety issue — developers could push without necessary vars or with wrong values.
- The live Supabase URL and anon key are in `.env.local` and should be treated as low-sensitivity (anon key is public by design), but the Anthropic and OpenAI keys are high-value and must never enter version control.

**Action required:** Create `.env.example` with placeholder values before launch (see Check 9).

---

### 2. SSRF (Server-Side Request Forgery) — ✅ PASS

**Finding:** No routes accept user-supplied URLs and fetch them server-side. All `fetch()` calls in the codebase originate from client-side components hitting `/api/*` routes (no arbitrary URL targets). External HTTP calls go only to Supabase, Anthropic, and OpenAI — all via SDK clients using env-var endpoints.

---

### 3. Input Validation — ⚠️ PARTIAL PASS / BLOCKER

**Findings:**
- Most routes parse `request.json()` directly without schema validation (no Zod or equivalent). If the JSON body is malformed or missing fields, routes rely on DB constraints rather than API-layer validation.
- **`/api/inbox/addresses` (POST):** `label` is taken directly from request body and passed into a `.toLowerCase().replace()` chain — if `label` is not a string this will throw a 500.
- **`/api/budget/transactions` (POST):** `amount`, `transaction_date`, `description` are passed directly to the DB insert without type/format checking.
- **`/api/hitl` (POST):** `action_id` is used in a DB query without UUID format validation — not a critical risk given RLS, but still sloppy.
- **`/api/budget/summary` (GET):** `month` query param from URL is passed directly to DB `.eq('month', month)` without format validation. A malformed value will cause a DB error, returned as `error.message` to the client.

**Blocker:** No schema validation layer. Recommend adding Zod validation to all POST body and query param inputs before production.

---

### 4. Error Leakage — ❌ FAIL (BLOCKER)

**Finding:** Raw Supabase error messages are returned directly to clients in multiple routes:

```ts
// Pattern seen in: documents, receipts, warranties, budget, hitl, notifications routes
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
```

Supabase error messages can expose:
- Table names and column names
- Database constraint details
- Query structure hints useful for enumeration attacks

**Affected routes (all):**
- `/api/documents`
- `/api/receipts`
- `/api/budget/transactions`
- `/api/budget/categories`
- `/api/budget/summary`
- `/api/warranties`
- `/api/hitl`
- `/api/notifications`
- `/api/inbox/addresses`
- `/api/inbox/messages`

**Action required:** Replace `error.message` with generic messages (`"Internal server error"`) and log the real error server-side only.

---

### 5. RLS Bypass — ✅ PASS

**Finding:** No service role key is used anywhere in the codebase. The Supabase client is created using the anon key in all routes (server and client). The Postmark webhook route's `createServiceClient()` function — despite its name — also uses the anon key, not a service role key. All data access is therefore subject to Supabase Row Level Security policies.

**Note:** This means RLS policies in the database are load-bearing and must be verified to be correctly configured (out of scope for this code review, but critical).

---

### 6. Auth Checks — ✅ PASS

**Finding:** All API routes call `supabase.auth.getUser()` and return 401 if no user is found. The middleware also enforces authentication for all routes except `/`, `/auth/*`, and `/api/webhooks/*`. Coverage is complete and consistent.

---

### 7. File Upload Security — ❌ FAIL (BLOCKER)

**Finding:** Neither `/api/documents` nor `/api/receipts` validates the uploaded file type before storing it.

```ts
// documents/route.ts — no type check
const file = formData.get('file') as File
if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
// File is uploaded immediately without mime type validation
```

The `contentType` is set to `file.type`, but `file.type` is a client-provided value and **can be spoofed**. An attacker could upload an executable (`.exe`, `.sh`, `.php`) with a spoofed MIME type.

**Risks:**
- Malicious files stored in Supabase Storage
- If stored files are ever served back (even via signed URL), a browser may execute or render unexpected content
- The receipt processing route hardcodes `'image/jpeg'` regardless of actual file type — this could cause Claude to receive non-image content

**Action required:** Whitelist allowed MIME types server-side using a magic-byte check (e.g., `file-type` npm package), not relying on `file.type`. For documents: allow `application/pdf`, `image/jpeg`, `image/png`. For receipts: allow `image/jpeg`, `image/png`.

---

### 8. POPIA Compliance — ⚠️ PARTIAL PASS / BLOCKER

**ADR-007 documents intent well**, but the following gaps exist in the implementation:

| Control | Status | Finding |
|---------|--------|---------|
| Encrypted storage at rest | ✅ Designed | Supabase handles this; acceptable |
| No public file access / signed URLs | ✅ Designed | No public bucket URLs in code |
| Purpose limitation | ✅ | Data scoped to household only |
| Audit log | ❌ **Missing** | ADR specifies `audit_log` table, but zero audit log writes found in any API route |
| Consent management | ❌ **Missing** | No consent capture at onboarding found in codebase |
| Data subject rights (export/erasure) | ❌ **Missing** | No data export or deletion endpoints implemented |
| Security safeguards | ⚠️ Partial | RLS ✅, HITL ✅, but file upload validation missing (see #7) |
| Breach notification runbook | ✅ Documented | ADR references runbook |

**Blockers:**
1. **Audit log** — not a single `audit_log` write exists in the codebase. This is a hard POPIA requirement and was committed to in ADR-007.
2. **Consent management** — no onboarding consent flow. Required before processing personal information under POPIA s11.
3. **Data subject rights** — no export or erasure endpoints. Required under POPIA s23-24.

These are not minor gaps — they are the difference between a POPIA-compliant product and one that is legally exposed.

---

### 9. Environment Variables — ❌ FAIL (BLOCKER)

**Finding:** There is no `.env.example` file. The project documents its env vars only in `.env.local` (which is gitignored and should never be committed).

**Required variables that need documentation:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_APP_URL=
```

A `POSTMARK_WEBHOOK_TOKEN` or equivalent is also absent — the Postmark webhook has **no signature verification**, meaning any actor who discovers the webhook URL can inject arbitrary emails and attachments into any household's inbox. This is a critical missing control.

**Action required:**
1. Create `.env.example` with all required variables and brief descriptions
2. Add `POSTMARK_WEBHOOK_TOKEN` env var and implement webhook signature verification in `/api/webhooks/postmark/route.ts`

---

## Summary Table

| # | Check | Status |
|---|-------|--------|
| 1 | Secret/credential exposure | ⚠️ CONDITIONAL PASS — no `.env.example`, no hardcoded secrets in src |
| 2 | SSRF | ✅ PASS |
| 3 | Input validation | ⚠️ WARN — no schema validation layer |
| 4 | Error leakage | ❌ FAIL — raw DB errors exposed |
| 5 | RLS bypass | ✅ PASS |
| 6 | Auth checks | ✅ PASS |
| 7 | File upload security | ❌ FAIL — no mime type validation |
| 8 | POPIA compliance | ❌ FAIL — audit log, consent, and data rights missing |
| 9 | Environment variables | ❌ FAIL — no .env.example, no webhook secret |

---

## Blockers (Must Fix Before Production)

1. **[BLOCKER-1] Error leakage** — Replace `error.message` with generic errors + server-side logging across all routes.
2. **[BLOCKER-2] File upload type validation** — Add magic-byte MIME whitelist to `/api/documents` and `/api/receipts`.
3. **[BLOCKER-3] Postmark webhook unauthenticated** — Add `POSTMARK_WEBHOOK_TOKEN` env var and verify `X-Postmark-Signature` header on every inbound webhook request. Without this, any attacker can inject emails/attachments into any household inbox.
4. **[BLOCKER-4] POPIA missing controls** — Implement audit log writes, consent capture at onboarding, and data subject export/erasure endpoints as committed to in ADR-007.

## Warnings (Should Fix, Not Blockers)

- Add Zod schema validation to all POST body inputs
- Add `input validation` to `month` param in budget summary
- Create `.env.example` documenting all required variables
- Verify RLS policies are correctly defined in Supabase dashboard (code review can't cover DB-level policies)
- `document_qa` route fetches a doc by `params.id` without checking `household_id` ownership — relies entirely on RLS. Should add an explicit ownership check as defence-in-depth.
