# ADR-004: Human-in-the-Loop (HITL) Action Pipeline

**Status:** Accepted  
**Date:** 2026-03-28  
**Author:** Docs

---

## Context

HouseholdOS AI agents can propose consequential external actions on behalf of households: drafting a warranty claim email to a retailer, submitting a formal dispute to a municipality, requesting insurance quotes, lodging a complaint with a service provider. These actions have real-world consequences — they send communications on behalf of the user, involve legal and financial obligations, and may be difficult or impossible to reverse.

The platform operates in a regulated South African context. The Financial Sector Conduct Authority (FSCA) requires that HouseholdOS remain strictly in the "information and tools" category — it must never provide financial advice or autonomously execute financial decisions on a user's behalf. App Store guidelines (both Apple and Google) similarly require that AI-initiated external actions go through explicit user approval flows. User trust is the core product differentiator — a single autonomous action that goes wrong could destroy it.

---

## Decision

**All consequential external actions require explicit user approval via the HITL pipeline before execution.**

The `hitl_actions` table drives a strict state machine:

```
proposed → approved → executed
         ↘ rejected
                    ↘ failed
```

**Pipeline:**
1. AI agent proposes an action with full reasoning, draft content, and supporting evidence
2. Action is stored as `status = 'proposed'` — nothing is sent externally
3. User receives a notification and reviews the full proposed action
4. User explicitly taps Approve or Reject
5. On approval only: execution engine runs the action, updates status to `executed` or `failed`
6. Result is reported back to the user

Status transitions are enforced server-side only. Client-side direct writes to `hitl_actions.status` are blocked by RLS. There is no auto-approval path, no timeout approval, and no confidence threshold that bypasses user review.

---

## Alternatives Considered

- **Auto-execute with undo:** Execute immediately, offer a time-limited undo window. Common in consumer apps (Gmail "undo send"). Rejected for HouseholdOS because some actions (sent emails, submitted forms) cannot be reliably undone, and regulatory positioning requires explicit approval, not retroactive undo.
- **AI confidence threshold auto-approval:** Auto-execute when AI confidence exceeds a threshold (e.g., >95%). Rejected — FSCA compliance and App Store guidelines require human sign-off regardless of AI confidence. No confidence score is reliable enough to remove human oversight for consequential actions.
- **Approval by default, opt-out per action type:** Allow users to configure "always approve warranty claims automatically." Rejected for Phase 1 — introduces complexity, creates liability if misconfigured, and undermines the trust model. Can be revisited post-launch with legal review.

---

## Consequences

**Positive:**
- FSCA compliance — platform never autonomously executes financial or legal actions
- App Store compliance — Apple and Google explicitly require human approval for AI-initiated external actions
- User trust — users remain in control; the AI advises, humans decide
- Audit trail — every proposed and executed action is logged with full reasoning and timestamps
- Reversibility — proposed actions can always be rejected before any external effect

**Negative:**
- Execution speed — actions require human availability to approve; time-sensitive disputes or claims may be delayed
- UX friction — approval flow adds steps compared to one-tap execution
- Notification fatigue — households with many active agents may receive frequent approval requests

**Mitigations:**
- Approval notifications are consolidated and prioritised by urgency
- Draft content is shown in full at proposal time — user can approve in seconds if the draft is correct
- Phase 2 roadmap includes smart notification grouping and approval history for recurring action types
