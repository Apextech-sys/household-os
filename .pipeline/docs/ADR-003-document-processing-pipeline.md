# ADR-003: Document Processing Pipeline — Async Status-Driven Architecture

**Status:** Accepted  
**Date:** 2026-03-28  
**Author:** Docs

---

## Context

Document processing in HouseholdOS is expensive: a single document upload triggers storage, Claude Vision OCR (up to 4096 tokens), structured extraction, OpenAI embedding generation, and database writes. On a PDF with multiple pages, this pipeline can take 10–30 seconds or more.

Vercel serverless functions have execution time limits (60 seconds on Pro tier, 300 seconds on Enterprise). Synchronous processing — where the upload API route waits for OCR to complete before responding — would hit these limits for large or complex documents, fail on slow AI responses, and block the user's UI for an unacceptable duration.

The platform also runs on Supabase Realtime, which provides a native push channel from database to client. This enables a cleaner pattern: return immediately on upload, push a notification when processing completes.

---

## Decision

**Async processing with a four-state status field on the `documents` table.**

The `status` column drives the full document lifecycle:

```
uploading → processing → ready
                       ↘ error
```

**Upload flow:**
1. Client POSTs file to `/api/documents/upload`
2. File is stored in Supabase Storage immediately
3. Row is inserted with `status = 'uploading'`
4. API responds 202 Accepted immediately — client is unblocked
5. A background Vercel function (or Supabase Edge Function) is triggered async
6. Status set to `processing`, Claude Vision called, embedding generated
7. Status set to `ready` (or `error` on failure), OCR and embedding stored
8. Supabase Realtime pushes the status change to the client — UI updates automatically

---

## Alternatives Considered

- **Synchronous processing:** Simplest implementation — wait for OCR, return the result. Fails for large documents due to Vercel timeout limits. Produces poor UX (spinner for 30 seconds). Rejected.
- **External job queue (BullMQ + Redis):** Robust, with retries, backoff, dead-letter queues, and worker concurrency control. Significantly more infrastructure to operate — Redis cluster, worker processes, deployment complexity. Over-engineered for Phase 1. Can be adopted later if queue depth becomes a problem.
- **AWS SQS + Lambda:** Similar to BullMQ but fully managed. Introduces AWS as a third infrastructure dependency alongside Supabase and Vercel. Rejected to keep the vendor surface area small in Phase 1.
- **Supabase Edge Functions as dedicated workers:** Low-latency trigger, no external dependencies. Limited by Edge Function CPU time limits and memory constraints. Viable as a fallback if Vercel background functions prove insufficient.

---

## Consequences

**Positive:**
- Upload responds immediately — user experience is non-blocking
- Supabase Realtime provides push-based completion notification — no client polling required
- Simpler infrastructure — no Redis, no queue workers, no additional cloud services
- `status` field provides clear visibility into processing state for debugging and monitoring

**Negative:**
- Vercel background functions are not infinite — very large documents (100+ page PDFs) may still timeout
- Error recovery is manual — failed documents require a retry mechanism (re-trigger processing)
- No built-in retry backoff or dead-letter queue — failures are surfaced as `status = 'error'`, not automatically retried

**Mitigations:**
- Maximum file size enforced at upload (25MB initially) to keep processing within time budgets
- Error state surfaces a retry button in the UI — user-initiated re-processing calls the same pipeline
- Processing timeout is monitored via observability tooling; documents stuck in `processing` beyond 5 minutes trigger an alert
