# ADR-005: Email Ingestion Strategy — Postmark Inbound Webhooks

**Status:** Accepted  
**Date:** 2026-03-28  
**Author:** Docs

---

## Context

A core HouseholdOS capability is automatic ingestion of household communications — bank statements, municipal bills, insurance renewals, retailer receipts, and service provider notifications arrive by email. The platform needs a reliable, scalable mechanism to receive these emails, parse them, and route the content into the correct household's inbox and processing pipeline.

Each household requires the ability to create dedicated email addresses (e.g., `absa@xyz.household.app`, `municipal@xyz.household.app`) that forward incoming mail into the platform. The receiving infrastructure must handle variable volume (from 1–2 emails/day for small households to dozens for active households), survive email delivery retries, and process structured metadata (sender, subject, attachments) alongside raw body content.

The system must also resist abuse — per-household addresses must not be discoverable by other tenants, and webhook endpoints must be protected against replay and spoofing attacks.

---

## Decision

**Postmark inbound webhooks with per-household dedicated email addresses.**

Each household is assigned a unique inbound email domain path (e.g., `{household_slug}@inbound.householdos.app`). Postmark receives all inbound mail on the configured inbound domain and POSTs a structured JSON payload to a Vercel API route (`/api/email/inbound`) within seconds of receipt.

The webhook payload includes parsed headers, body (plain text and HTML), and base64-encoded attachments. Attachments are extracted, stored to Supabase Storage, and fed into the document processing pipeline. The email body is stored as an `inbox_messages` row and processed by the AI extraction pipeline.

Webhook signature verification (Postmark's `X-Postmark-Signature` header) is enforced on every request — unsigned or invalid requests are rejected with 401.

---

## Alternatives Considered

- **IMAP polling:** Connect to a shared mailbox via IMAP and poll for new messages. Simple to understand but requires a persistent long-running process (not viable on serverless Vercel), introduces polling latency (vs. near-instant webhook delivery), and is difficult to scale to per-household addresses without maintaining hundreds of mailbox connections.
- **SendGrid Inbound Parse:** Comparable feature set to Postmark. Postmark was selected for its superior deliverability reputation, more predictable pricing, and cleaner inbound webhook API. Either would work technically.
- **Custom MX records with self-hosted mail server:** Maximum control and lowest per-email cost at scale. Requires operating mail server infrastructure (Postfix, spam filtering, DKIM/SPF/DMARC management). Operational burden is disproportionate for Phase 1. Can be revisited at enterprise scale.
- **Gmail/Outlook forwarding rules:** Instruct users to set up forwarding rules in their existing email clients. Unreliable, requires user configuration, not automatable, and does not give the platform a stable inbound address.

---

## Consequences

**Positive:**
- Near-instant delivery — Postmark delivers webhooks within 1–3 seconds of email receipt
- Structured payload — Postmark parses headers, body, and attachments; no raw MIME parsing required
- Per-household routing — unique inbound addresses mean the platform always knows which household an email belongs to
- Fully serverless — webhook handler is a standard Vercel API route; no persistent processes required
- Retry handling — Postmark retries failed webhook deliveries automatically

**Negative:**
- Postmark dependency — platform email ingestion fails if Postmark has an outage
- Webhook endpoint must be publicly accessible — requires robust signature verification and rate limiting
- Per-address email volume counts against Postmark plan limits — high-volume households could drive costs

**Mitigations:**
- Webhook signature verification enforced on every inbound request
- Inbound address format is non-guessable (UUID-based slug) — minimises spam and address enumeration risk
- Postmark SLA is 99.99% uptime; failed deliveries during downtime are queued and retried by Postmark on recovery
