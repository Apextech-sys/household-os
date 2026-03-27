# HouseholdOS – Dual Planner Debate (OpenAI Perspective)
Planner: plan-manager-openai
Date: 2026-03-28
Status: DEBATE IN-PROGRESS

---

## Round 1 – Cross-Review

1. **Where we agree**
   • Same module breakdown (25 total, Phase 1 = modules 1–7).
   • Identical tech stack: Supabase Postgres + Storage, Next.js 14 App Router, React Native Expo, Vercel serverless, pgvector, Stripe, Postmark.
   • Shared security posture: RLS on every table, JWT claims (`household_id`, `role`, `subscription_tier`) injected by Auth hook.
   • Streaming Claude-based Q&A for docs + global chat; Haiku for routing.
   • Trial first, card-free onboarding with <5-minute time-to-value target.
   • Duplicate detection, tier-limit enforcement, resumable uploads, notification engine, edge-case philosophy (never auto-delete, user control).

2. **Where we disagree (+ which looks better)**
   | Topic | Claude Plan | OpenAI Plan | Which is stronger? |
   |------|-------------|-------------|--------------------|
   | **Onboarding order** | Starts plan with Module 7 first (argues entry-point) | Treats onboarding as module 7 but plans after core modules | Claude – better narrative emphasising critical path early. |
   | **Edge-case coverage** | 20 cases | 15 cases | Claude – broader list. |
   | **API contract depth** | Full verbatim route+SQL for every sub-module | Mostly high-level bullets | Claude – richer detail. |
   | **Subscription limits** | Explicit TIER_LIMITS constant & middleware examples | Mentioned but not codified | Claude. |
   | **SA-specific nuances** | POPIA consent screen, load-shedding mention, ZAR formatting | Multilingual OCR & VAT detection but misses POPIA | Tie: each covers different SA specifics (see below). |
   | **Duplicate ingestion race** | Detailed IC-04/14 strategies | Basic file-hash at upload | Claude. |
   | **Tech ordering** | 7-tier dependency ladder | Simple recommended order | Claude – clearer for Tech Lead. |
   | **Vision OCR strategy** | Hybrid per-page text-density swap | Single vision pass, fallback chunking | Claude – more efficient token usage. |
   | **Q&A conversation persistence** | Local storage Phase 1, DB Phase 2 | Persists per-doc chat only | OpenAI – lighter initial scope, but Claude’s escalation plan adds clarity. |
   | **POPIA/Data export** | Explicit endpoint `/api/popia/export` + delete request | Not mentioned | Claude. |

3. **What they have that we don’t**
   • 5 additional edge cases.
   • POPIA consent + data export endpoints.
   • Detailed Stripe webhook code, tier-limit constant, and enforcement middleware.
   • Municipality list constraint & typo prevention.
   • Per-page hybrid OCR algorithm.
   • Thorough implementation order tiers.

4. **What we have that they don’t**
   • Multilingual OCR templates (Afrikaans/Zulu) & VAT detection in documents.
   • Hybrid search (vector + trigram) weighting logic in document search.
   • Mobile offline SQLite (WatermelonDB) and queue details.
   • Chat SSE hook details (`useSSE`), UI state management specifics (React Query/Zustand stores).
   • Detailed PWA features (install prompt, next-pwa caching strategies).
   • Warranty claim HITL draft endpoint earlier in roadmap.

5. **Logic bugs / edge-case comparison**
   – Both address duplicate uploads; Claude extends to mixed-source duplicates and statement reuse.
   – OpenAI lists tier-downgrade hiding upload, Claude adds explicit preview of impacted docs.
   – Claude catches JWT stale role; OpenAI omits.
   – Both discuss Stripe webhook idempotency; parity.
   – Claude alone covers warranty date overflow, municipality typo, SA currency mismatch, POPIA consent.
   – OpenAI alone covers Expo push token revocation, iOS background resume, multi-language OCR fallback.

Summary: Claude plan is more verbose and surfaces more legal/compliance nuance; OpenAI plan is concise with stronger mobile/offline and search detail. No irreconcilable conflicts.

---

## Round 2 – Merge Proposal
For each disagreement we select the superior approach (or blend) and justify.

1. **Onboarding first vs later** → Adopt Claude’s strategy: lead with onboarding because it dictates data flow and first-value KPI. Keep our multilang OCR & mobile camera details in that flow.
2. **Edge-case catalogue** → Merge lists; retain all 20 Claude cases plus our 15 (deduplicate overlaps) for 25-case master list.
3. **API contract depth** → Use Claude’s exhaustive tables but enrich with our hybrid search and mobile-offline endpoints.
4. **Subscription enforcement** → Accept Claude’s `TIER_LIMITS` constant & middleware; add our UI gating notes and downgrade read-only behaviour.
5. **POPIA compliance** → Adopt Claude’s consent & export flows (legal must-have).
6. **OCR strategy** → Use Claude’s hybrid per-page density check; still keep our chunk-based fallback for >50-page docs.
7. **Duplicate detection** → Combine: keep our file-hash early check and add Claude’s text-similarity post-processing.
8. **Conversation persistence** → Follow Claude: localStorage Phase 1, DB Phase 2; lighter to ship yet roadmap clear.
9. **Mobile offline & queue** → Retain OpenAI detail; Claude plan references but lacks implementation; no conflict.
10. **Implementation order** → Adopt Claude’s 7-tier ladder; append mobile/offline subtasks in appropriate tiers.

Result: A joint plan that is legally robust (POPIA), technically efficient (hybrid OCR, tier limits), and mobile-friendly (offline queues). No critical item lost.

---

## Round 3 – Final Review Checklist
✅ All Phase 1 modules (1-7) now have:
   • Screens, API routes, DB ops, state mgmt, error handling, SA edge cases, compliance steps.
✅ Critical cross-cutting concerns covered: RLS, JWT claims, POPIA consent & export, tier limits, duplicate detection, Stripe idempotency, load-shedding resilience, offline handling.
✅ Implementation order clear; Tech Lead can start once PLAN_JOINT.md drafted.
✅ No unaddressed spec item discovered.

Conclusion: The merged approach resolves all discrepancies and strengthens weak spots. Ready for PLAN_JOINT drafting.


PLAN_MANAGER_OPENAI_APPROVED