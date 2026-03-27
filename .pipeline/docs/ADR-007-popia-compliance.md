# ADR-007: POPIA Compliance — Privacy-First Design

**Status:** Accepted  
**Date:** 2026-03-28  
**Author:** Docs

---

## Context

HouseholdOS processes some of the most sensitive personal information a household holds: bank statements, tax documents, medical aid records, insurance policies, employment contracts, and domestic worker payroll data. As a South African platform, it operates under the Protection of Personal Information Act (POPIA, Act 4 of 2013), which came into full effect in July 2021.

POPIA establishes eight conditions for lawful processing of personal information: accountability, processing limitation, purpose specification, further processing limitation, information quality, openness, security safeguards, and data subject participation. Non-compliance carries fines of up to R10 million and criminal liability for responsible parties.

Beyond legal obligation, POPIA compliance is a product differentiator. Households are entrusting the platform with their most sensitive documents. Compliance signals that the platform takes this responsibility seriously. A privacy breach or regulatory sanction at any scale would be existential for a trust-based product.

---

## Decision

**POPIA compliance is designed in from day one, not retrofitted.**

The following controls are built into the core architecture:

| Control | Implementation |
|---------|----------------|
| Encrypted storage at rest | Supabase Storage with household-specific encryption; `documents` and `extracted_data` encrypted at the database level |
| No public file access | All document access via signed URLs with short TTL (60 seconds for processing, 15 minutes for user access) — no public bucket URLs ever |
| Purpose limitation | Data collected only for stated household intelligence purposes; no cross-household data use; no advertising use |
| Audit log | Every agent action, data access, and status change is logged to `audit_log` table with actor, timestamp, action type, and affected entity |
| Consent management | Explicit consent captured at onboarding per data category; consent records stored and queryable; users can withdraw consent per category |
| Data subject rights | Self-service data export (all household data as JSON/CSV) and account deletion (full data purge within 30 days) built into the settings flow |
| Security safeguards | RLS on all tables, server-side AI calls only, no client-side API key exposure, HITL for all consequential actions |
| Breach notification | Incident response runbook includes POPIA-mandated 72-hour notification to Information Regulator |

---

## Alternatives Considered

- **Bolt-on compliance after launch:** Implement features first, add POPIA controls in a later compliance sprint. Common in startups but carries significant risk — retrofitting encryption, audit logs, and consent flows into an existing data model is expensive and error-prone. A single data breach before controls are in place could end the business. Rejected categorically.
- **Minimum viable compliance (consent banner only):** Implement only the most visible POPIA requirement (consent) and treat deeper controls as optional. Does not meet the full conditions of POPIA, particularly security safeguards and data subject participation rights. Rejected — legal exposure is unacceptable.

---

## Consequences

**Positive:**
- Legal safety — platform meets all eight POPIA processing conditions from launch
- User trust — privacy controls are visible and verifiable; users can export or delete their data at any time
- FSCA alignment — HITL pipeline and audit log support the information-only (not advice) positioning required by FSCA
- Competitive advantage — most SA household apps do not meet POPIA fully; compliance is a differentiator when marketing to privacy-conscious households

**Negative:**
- Higher upfront development cost — encryption, audit logging, consent management, and data subject rights flows add significant scope to Phase 1
- Signed URL pattern adds latency — every document access requires a server-side signed URL generation step rather than a direct CDN link
- Consent management adds onboarding friction — users must actively consent before data is processed

**Mitigations:**
- Audit log writes are async and non-blocking — no impact on request latency
- Signed URL generation is cached per session where appropriate to reduce repeated round-trips
- Onboarding consent flow is designed for completion in under 60 seconds — progressive disclosure with plain-language explanations
- Legal counsel reviews consent language and data processing notices before launch
