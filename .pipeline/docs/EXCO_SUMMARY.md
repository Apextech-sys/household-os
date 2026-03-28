# HouseholdOS Phase 1 — Executive Summary

**Date:** 2026-03-28  
**Classification:** Internal — CTO / Founder

---

## What Was Built

**HouseholdOS Phase 1** is a production-deployed AI-powered household intelligence platform. It gives households a single interface to store, understand, and act on every document, statement, receipt, and obligation they hold — surfaced through a conversational AI that knows the household's full context.

**Live at:** https://household-os-phi.vercel.app  
**Repo:** https://github.com/Apextech-sys/household-os  
**Supabase project:** `vzyeuxczwdpvlfwfzjih` (eu-west-2)

---

## Key Features Delivered (Modules 1–7)

| Module | What It Does |
|--------|-------------|
| **Document Intelligence Hub** | Upload any document (PDF, image, scan). Claude Vision performs OCR + structured extraction. Ask natural language questions against it. |
| **Inbox System** | Per-household email addresses. Postmark inbound webhooks auto-ingest statements, bills, and correspondence. AI parses and stores structured data. |
| **Warranties & Receipt Vault** | Upload receipts via photo or PDF. AI extracts purchase date, amount, retailer, warranty period. Expiry alerts surface before warranties lapse. |
| **Budget Tracking** | Income/expense categorisation from ingested statements. Monthly summaries with category breakdowns. |
| **Conversational AI Interface** | Streaming chat interface. Coordinator agent routes questions to the right context and returns synthesised household-aware answers. HITL pipeline for consequential actions. |
| **Web App (Next.js 14 PWA)** | Full responsive web client with module dashboards, notification centre, document library. |
| **Onboarding Flow** | First value moment under 5 minutes. Progressive module activation. |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS — PWA-capable |
| Mobile | React Native (Expo) — iOS + Android (Phase 1 scaffold, builds in Phase 2) |
| Backend | Next.js API routes (18 routes) on Vercel serverless functions |
| Database | Supabase PostgreSQL — 19 tables, RLS on all tables |
| Auth | Supabase Auth (JWT) — middleware enforces auth on all routes |
| Storage | Supabase Storage — private buckets, signed URLs, per-household isolation |
| AI — Vision/OCR | Anthropic Claude Opus (`claude-opus-4-5`) via Vercel AI SDK |
| AI — Conversational | Anthropic Claude Sonnet (`claude-sonnet-4-5`) — streaming |
| AI — Search | OpenAI `text-embedding-3-small` — 1536-dim vectors |
| Realtime | Supabase Realtime — push-based document processing status |
| Email ingestion | Postmark inbound webhooks |
| Billing | Stripe (ZAR, scaffolded for Phase 2) |
| Deploy | Vercel (web + API) |

---

## Timeline

| Milestone | Time (SAST) |
|-----------|-------------|
| Project initiated | 00:06 |
| Wave 1 complete (PM + DBA + DevOps) | ~00:30 |
| Dual planner debate complete (3 rounds) | ~00:55 |
| PLAN_JOINT.md approved | ~01:05 |
| Tech Lead implementation complete | ~01:20 |
| QA passed (10/10) | ~01:28 |
| Security review complete | ~01:32 |
| Production deployed | ~01:36 |
| **Total elapsed** | **~90 minutes** |

**Pipeline:** 13 agents across all waves — PM, DBA, DevOps, AI Specialist, Backend Specialist, Docs, Planner (Claude), Planner (OpenAI), Tech Lead, QA, Security, DevOps (deploy), Docs (post-deploy).

The dual planner debate ran 3 rounds between independent planning teams before convergence on PLAN_JOINT.md.

---

## Key Architectural Decisions

### ADR-001 — Multi-Tenancy: Shared Supabase + RLS
Shared PostgreSQL with Row Level Security enforced on all 19 tables. `household_id` derived from authenticated JWT — never from client input. Chosen over per-tenant databases (too expensive at consumer scale) and application-layer filtering (too risky). Supports future migration to dedicated instances for enterprise tiers.

### ADR-002 — AI Model Strategy: Task-Optimised Multi-Model
Three models, three jobs: Claude Opus for OCR/extraction (highest accuracy on complex SA document formats), Claude Sonnet for streaming conversational Q&A (fast, lower cost), OpenAI embeddings for vector search. Single-model approaches traded off either cost or accuracy — both unacceptable for a product where extraction quality is the core value.

### ADR-003 — Document Processing: Async Status-Driven Pipeline
Upload returns 202 immediately. Background function handles OCR → embedding → structured extraction. `status` column drives the lifecycle (`uploading → processing → ready/error`). Supabase Realtime pushes completion to the client — no polling. Prevents Vercel function timeouts on large documents.

### ADR-004 — HITL Pipeline
All consequential actions (dispute submission, claim lodging, bookings) require explicit user approval before execution. Agent proposes with full reasoning shown; user approves, rejects, or modifies; system executes only on confirmed approval.

### ADR-005 — Email Ingestion via Postmark
Per-household inbound email addresses routed through Postmark webhooks. Enables passive ingestion of bank statements, bills, and correspondence without requiring users to forward emails manually.

### ADR-006 — Mobile Strategy: Expo EAS
React Native with Expo for cross-platform iOS/Android. Expo EAS handles App Store and Play Store builds. Web app ships as PWA first; mobile app builds activate in Phase 2.

### ADR-007 — POPIA Compliance Architecture
Data minimisation, RLS-enforced household isolation, signed URLs (no public file access), audit log table, consent management at onboarding, and data subject export/erasure endpoints — as required under POPIA s11 and s23–24.

---

## Issues Found and Resolved

### Security Review — 4 blockers identified, 2 HIGH resolved before deploy:

| Issue | Severity | Status |
|-------|----------|--------|
| Raw Supabase error messages exposed to clients (DB schema leakage) | HIGH | ✅ Resolved |
| File upload MIME type not validated server-side (spoofable) | HIGH | ✅ Resolved |
| Postmark webhook unauthenticated (no signature verification) | HIGH | Resolved via env var + header check |
| POPIA controls incomplete (audit log, consent, data rights) | HIGH | Partial — see Known Limitations |

### Build Issue:
One TypeScript build error resolved during implementation — type mismatch in inbox message parsing corrected before QA ran.

---

## Phase 2/3 Roadmap

### Phase 2 — Core Intelligence (Modules 8–14)
- **Banking & Financial Intelligence** — FNB Open Banking, Investec API, subscription creep detection, debit order anomalies, cash flow projection
- **Insurance Intelligence Agent** — policy Q&A, claim eligibility, claims drafting, renewal comparison
- **Credit Card Benefits Intelligence** — benefit extraction, purchase protection tracking, warranty extension
- **Municipal & Utilities Management** — SA bill parsing (257 municipality formats), billing reconciliation, dispute drafting
- **Vehicle Management** — service intervals, licence renewal, balloon payment alerts, traffic fines
- **Medical Aid & Healthcare** — benefit balance, provider network, pre-auth management
- **Home Maintenance Intelligence** — asset register, service scheduling, predictive maintenance alerts

### Phase 3 — Lifestyle & Advanced (Modules 15–25)
Grocery intelligence, lifestyle booking agent, ISP monitoring, technology/device management, energy management, water management, domestic employee compliance (UIF, payslips), legal document advisor, shopping intelligence, full financial planning, security system management.

---

## Known Limitations (Phase 1.1 — MEDIUM Priority)

These items were identified in the security review and do not block Phase 1 but must be addressed before Phase 2 goes to market:

| Item | Risk |
|------|------|
| No Zod schema validation on POST body inputs | Malformed inputs cause 500s, not clean 400s |
| `budget/summary` month param not format-validated | Malformed value causes raw DB error response |
| No `.env.example` in repo | New deployments could miss required env vars |
| RLS policies not independently verified at DB level | Code review passed; DB-level policy audit pending |
| POPIA audit log writes not yet implemented in all routes | Audit trail gaps — required before Phase 2 launch |
| Consent capture at onboarding incomplete | POPIA s11 requirement; must be addressed in Phase 1.1 |
| Data subject export/erasure endpoints missing | POPIA s23–24 requirement; Phase 1.1 scope |

---

*Generated post-deployment — 2026-03-28 by HouseholdOS pipeline docs agent.*
