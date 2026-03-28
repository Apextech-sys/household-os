# HouseholdOS Phase 1 — Operational Runbook

**Last updated:** 2026-03-28  
**Maintained by:** CTO / DevOps

---

## Service URLs

| Service | URL |
|---------|-----|
| **Web App (production)** | https://household-os-phi.vercel.app |
| **Vercel dashboard** | https://vercel.com/apextechs-projects/household-os |
| **Vercel Functions / Logs** | https://vercel.com/apextechs-projects/household-os/logs |
| **Supabase dashboard** | https://supabase.com/dashboard/project/vzyeuxczwdpvlfwfzjih |
| **Supabase SQL Editor** | https://supabase.com/dashboard/project/vzyeuxczwdpvlfwfzjih/sql |
| **Supabase Auth** | https://supabase.com/dashboard/project/vzyeuxczwdpvlfwfzjih/auth/users |
| **Supabase Storage** | https://supabase.com/dashboard/project/vzyeuxczwdpvlfwfzjih/storage/buckets |
| **GitHub repo** | https://github.com/Apextech-sys/household-os |

---

## Environment Variables

All 5 production variables are set in Vercel project settings. Do **not** commit any of these to the repo.

| Variable | Purpose | Where to get |
|----------|---------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for client-side Supabase calls | Supabase dashboard → Project Settings → API |
| `ANTHROPIC_API_KEY` | Claude Opus (OCR) + Claude Sonnet (chat) | https://console.anthropic.com/keys |
| `OPENAI_API_KEY` | Text embeddings (`text-embedding-3-small`) | https://platform.openai.com/api-keys |
| `NEXT_PUBLIC_APP_URL` | Base URL for the deployed app | Set to `https://household-os-phi.vercel.app` |

> **Note:** A `POSTMARK_WEBHOOK_TOKEN` variable should also be present for webhook signature verification. If missing, the `/api/webhooks/postmark` route will accept unauthenticated POSTs.

To view current values:
```bash
vercel env ls --token $VERCEL_TOKEN --scope $VERCEL_SCOPE
```

---

## Deploy Process

### Standard deploy (push to main)
```bash
git add .
git commit -m "your message"
git push origin main
```
Vercel auto-deploys `main` to production. Build takes ~2 minutes. Monitor at https://vercel.com/apextechs-projects/household-os/deployments.

### Manual deploy (from local or CI)
```bash
vercel --prod \
  --token $VERCEL_TOKEN \
  --scope $VERCEL_SCOPE
```

### Preview deploy (for testing before merging)
```bash
vercel \
  --token $VERCEL_TOKEN \
  --scope $VERCEL_SCOPE
```
Vercel provides a unique preview URL per commit.

### Rollback
In the Vercel dashboard, go to **Deployments**, find the last good deployment, click **Promote to Production**.

---

## Supabase Access

- **Project ID:** `vzyeuxczwdpvlfwfzjih`
- **Region:** eu-west-2 (AWS Europe / Ireland)
- **PostgreSQL connection string:** Available in Supabase dashboard → Project Settings → Database → Connection string

### SQL Access (Dashboard)
1. Open https://supabase.com/dashboard/project/vzyeuxczwdpvlfwfzjih/sql
2. Run queries directly in the SQL Editor
3. Row Level Security is always active for anon/authenticated roles — use the service role for admin queries

### SQL Access (psql)
```bash
# Get connection string from Supabase dashboard → Settings → Database
psql "postgresql://postgres.[project-ref]:[password]@aws-0-eu-west-2.pooler.supabase.com:5432/postgres"
```

### Tables (19 total)
`households`, `users`, `user_preferences`, `documents`, `document_qa_sessions`, `document_qa_messages`, `inbox_addresses`, `inbox_messages`, `inbox_attachments`, `receipts`, `warranties`, `budget_transactions`, `budget_categories`, `budget_summaries`, `hitl_actions`, `notifications`, `ai_usage_log`, `audit_log`, `subscriptions`

---

## Checking Logs

### Vercel Function Logs (real-time)
```bash
vercel logs household-os --follow \
  --token $VERCEL_TOKEN \
  --scope $VERCEL_SCOPE
```

### Vercel Function Logs (dashboard)
1. Go to https://vercel.com/apextechs-projects/household-os/logs
2. Filter by function: `/api/documents`, `/api/chat`, `/api/webhooks/postmark`, etc.
3. Filter by status: 4xx / 5xx to surface errors quickly

### Supabase Logs
- Auth logs: Supabase dashboard → Auth → Logs
- Database slow queries: Supabase dashboard → Reports → Database
- API usage: Supabase dashboard → Reports → API

---

## Common Issues

### AI Timeout — Document OCR stalls or returns `status: error`

**Symptom:** Document stuck in `processing` status. User sees spinner; Realtime never fires `ready`.

**Cause:** Claude Vision call exceeded Vercel function timeout (60s on Pro tier) or Anthropic API returned a timeout.

**Fix:**
1. Check Vercel logs for the `/api/documents` or document processing function — look for `Error: Request timeout` or Anthropic 529/timeout errors.
2. If Anthropic is healthy, check document size — files >25MB may need chunking.
3. Manually reset the stuck document via SQL:
   ```sql
   UPDATE documents SET status = 'error' WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes';
   ```
4. The UI surfaces a retry button for `error` state documents — user can re-trigger processing without re-uploading.

**Prevention:** Monitor `documents` table for rows stuck in `processing` longer than 5 minutes.

---

### Document OCR Failure — Extraction returns empty or garbled data

**Symptom:** Document uploads, reaches `ready` status, but `ocr_text` is empty or extracted data is wrong.

**Cause:** File is corrupt, unsupported format, or Claude Vision failed to parse the layout.

**Fix:**
1. Check `documents.ocr_text` and `documents.extracted_data` in Supabase for the affected document ID.
2. Check Vercel logs for the processing call — Claude often returns a partial response with an explanation.
3. Ask the user to re-upload as a higher-resolution scan or different format.
4. For persistent failures, review whether MIME type validation passed (check `documents.file_type`).

---

### Postmark Webhook Failures — Emails not appearing in Inbox

**Symptom:** Emails sent to household inbox addresses don't show up in the platform.

**Causes and fixes:**

| Cause | Check | Fix |
|-------|-------|-----|
| Postmark webhook misconfigured | Postmark dashboard → Inbound → Webhook URL | Ensure URL points to `https://household-os-phi.vercel.app/api/webhooks/postmark` |
| Webhook token mismatch | `POSTMARK_WEBHOOK_TOKEN` env var vs Postmark config | Rotate and re-sync (see API Key Rotation) |
| Route throwing 500 | Vercel logs → `/api/webhooks/postmark` | Check for JSON parse errors or missing fields in payload |
| Inbox address not active | `inbox_addresses` table — `is_active` column | Verify `is_active = true` for the address |
| Email rejected by spam filter | Postmark activity log | Check bounce/spam reports in Postmark dashboard |

**Test the webhook manually:**
```bash
curl -X POST https://household-os-phi.vercel.app/api/webhooks/postmark \
  -H "Content-Type: application/json" \
  -H "X-Postmark-Signature: [token]" \
  -d '{"From":"test@example.com","Subject":"Test","TextBody":"Hello","To":"[address]@household.xyz"}'
```

---

## Monitoring

### Key metrics to watch

| What | Where | Alert threshold |
|------|-------|----------------|
| Documents stuck in `processing` | Supabase SQL: `SELECT count(*) FROM documents WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes'` | > 0 |
| API 5xx errors | Vercel logs → filter 5xx | Any spike |
| AI token usage | `ai_usage_log` table — `total_tokens` by day | Track trend; alert if > budget |
| Auth failures | Supabase Auth logs | Spike in failed logins |
| Inbox webhook failures | Vercel logs → `/api/webhooks/postmark` filtered for 4xx/5xx | Any |

### Supabase table spot-checks
```sql
-- Recent documents
SELECT id, status, file_name, created_at FROM documents ORDER BY created_at DESC LIMIT 20;

-- AI usage last 24h
SELECT SUM(total_tokens), COUNT(*) FROM ai_usage_log WHERE created_at > NOW() - INTERVAL '24 hours';

-- Active inbox addresses
SELECT household_id, email_address, is_active FROM inbox_addresses WHERE is_active = true;

-- Recent HITL actions
SELECT action_type, status, created_at FROM hitl_actions ORDER BY created_at DESC LIMIT 10;
```

---

## API Key Rotation

### Anthropic API Key
1. Go to https://console.anthropic.com/keys → create new key
2. Update in Vercel: `vercel env rm ANTHROPIC_API_KEY production` → `vercel env add ANTHROPIC_API_KEY production`
3. Redeploy: `vercel --prod --token ... --scope ...`
4. Revoke old key in Anthropic console
5. Verify: check Vercel logs for a successful document OCR or chat request

### OpenAI API Key
1. Go to https://platform.openai.com/api-keys → create new key
2. Update in Vercel: same process as above for `OPENAI_API_KEY`
3. Redeploy and verify with a document upload (triggers embedding)
4. Revoke old key

### Supabase Anon Key
The anon key is designed to be public — rotation is rarely needed. If required:
1. Supabase dashboard → Project Settings → API → Rotate anon key
2. Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel
3. Redeploy — this is a breaking change that will log out all active sessions

### Postmark Webhook Token
1. Generate a new random token: `openssl rand -hex 32`
2. Update in Postmark dashboard → Inbound webhook → token/header config
3. Update `POSTMARK_WEBHOOK_TOKEN` in Vercel
4. Redeploy — any in-flight webhooks during the rotation window will fail; Postmark retries for up to 24 hours

---

## Database Backup

Supabase automatically runs daily backups on Pro tier (7-day retention). To access:
- Supabase dashboard → Project Settings → Database → Backups

### Manual snapshot (Point-in-Time)
```bash
# Via Supabase CLI
supabase db dump --project-ref vzyeuxczwdpvlfwfzjih -f backup-$(date +%Y%m%d).sql
```

### Critical tables (back up before schema changes)
- `documents` — OCR text and extracted data; expensive to re-generate
- `receipts` / `warranties` — user financial records
- `budget_transactions` — financial history
- `households` / `users` — account data

### Restore (disaster recovery)
1. Supabase dashboard → Backups → select point in time → Restore
2. Or from a SQL dump: `psql [connection-string] < backup.sql`

---

## Scaling Considerations for Phase 2

### Current limits (Phase 1)
- Vercel Pro: 60s function timeout, 10MB request body limit
- Supabase Free/Pro: shared compute, connection pooler required at >100 concurrent connections
- Anthropic: rate limits vary by tier — monitor `429` errors in Vercel logs

### Before Phase 2 launch
1. **Enable Supabase connection pooling (PgBouncer)** — required before Banking Intelligence module hits DB with high-frequency transaction polling.
2. **Add Zod validation** to all POST routes — MEDIUM security finding from Phase 1 review.
3. **Implement POPIA controls** — audit log writes, consent at onboarding, data export/erasure endpoints. Mandatory before Phase 2 marketing.
4. **Add a job queue** for document processing — BullMQ + Redis or Supabase Edge Functions — to handle concurrent uploads without Vercel timeout risk.
5. **Implement Postmark webhook signature verification** fully — `POSTMARK_WEBHOOK_TOKEN` must be set and validated on every inbound request.
6. **Upgrade Vercel to Enterprise** if function execution time >60s becomes a problem for large PDF batches.
7. **Separate AI usage budgets per household** using `ai_usage_log` aggregates — required for Stripe metered billing per subscription tier.

---

*Runbook generated post-deployment — 2026-03-28 by HouseholdOS pipeline docs agent.*
