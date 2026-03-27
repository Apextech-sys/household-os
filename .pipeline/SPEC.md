# HouseholdOS — Full Product Specification
## Household Intelligence Platform

## WHAT WE ARE BUILDING
HouseholdOS is a household intelligence platform. An AI-powered operating system for household life that ingests, understands, monitors, and acts on every document, contract, account, and obligation a household holds.

## PLATFORM DECISIONS
- Multi-tenancy: Shared Supabase with strong RLS (tenant_id on every table), designed for future per-household dedicated instances
- Clients: Web app (Next.js 14 App Router, PWA-capable) + Mobile (React Native / Expo, iOS + Android, App Store ready)
- Backend: Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions) + Vercel (Next.js API routes)
- AI: Anthropic Claude via Vercel AI SDK (streaming) + OpenAI embeddings
- Document processing: Claude Vision for OCR/extraction from PDFs, photos, scanned documents
- Email ingestion: Postmark inbound webhooks — per-household email addresses (absa@household.xyz routes into platform)
- Billing: Stripe (ZAR)

## SOUTH AFRICAN CONTEXT
- Banks with APIs: FNB Open Banking, Investec API (read-only OAuth)
- Banks without APIs (statement parsing via AI): ABSA, Standard Bank, Nedbank, Capitec
- Legislation: POPIA (privacy), FSCA (platform informs — does not advise), NCA, Domestic Workers Sectoral Determination
- 257 municipalities with variable bill formats — AI extraction, not rigid parsers

## ALL 25 MODULES TO PLAN AND BUILD

### Phase 1 Foundation
1. Document Intelligence Hub — upload, OCR, extract key facts, natural language Q&A on any document
2. Dedicated Inbox System — per-household email addresses, auto-ingestion, statement parsing, change detection
3. Warranties and Receipts Vault — OCR receipts, warranty tracking, expiry alerts, bank transaction matching
4. Basic Budget Tracking — income/expense categorisation from statements, monthly summary
5. Web App (Next.js 14 PWA) — full conversational thin client + module dashboards
6. Mobile App (React Native Expo) — iOS and Android, App Store and Play Store ready
7. Onboarding Flow — first value moment under 5 minutes, progressive module activation

### Phase 2 Core Intelligence
8. Banking and Financial Intelligence — FNB and Investec API, subscription creep detection, debit order anomaly, cash flow projection
9. Insurance Intelligence Agent — policy Q&A, claim eligibility, claims drafting assistance, renewal comparison
10. Credit Card Benefits Intelligence — benefit extraction, purchase protection clock, warranty extension tracking
11. Municipal and Utilities Management — bill parsing, billing reconciliation, dispute drafting with bylaw references
12. Vehicle Management — service intervals, licence renewal, balloon payment alerts, traffic fines, accident management
13. Medical Aid and Healthcare — benefit balance tracking, provider network check, pre-auth management
14. Home Maintenance Intelligence — asset register, service scheduling, contractor coordination, predictive alerts

### Phase 3 Lifestyle and Advanced
15. Grocery and Consumables Intelligence — purchase history, depletion prediction, price comparison across SA retailers
16. Lifestyle Booking Agent — golf, padel, restaurants, events, kids activities, group coordination
17. ISP and Connectivity Intelligence — continuous speed monitoring, SLA tracking, fault logging, dispute management
18. Technology and Device Management — network device inventory, performance monitoring, repair vs replace analysis
19. Energy Management — smart meter ingestion, solar monitoring, load shedding integration, billing reconciliation
20. Water Management — consumption monitoring, overnight flow leak detection, billing reconciliation
21. Staff and Domestic Employee Module — UIF, payslips, employment contracts, leave tracking, minimum wage compliance
22. Legal Document Advisor — plain language summaries, CPA and NCA red flags, will management
23. Shopping Intelligence and Deal Finder — price comparison across SA retailers, price history, deal alerts
24. Household Budget and Financial Planning — net worth, financial goals, scenario modelling, retirement gap
25. Security System Management — armed response contract management, alarm service, electric fence certificates

## CORE ARCHITECTURE REQUIREMENTS

### Coordinator Agent
Central AI agent routing user messages to specialist agents, synthesising multi-domain answers, managing HITL action pipeline, maintaining household context.

### HITL Action Pipeline
For all consequential actions (dispute submission, claim lodging, booking, quote requests):
1. Agent proposes action with full reasoning shown to user
2. User approves, rejects, or modifies
3. System executes ONLY on explicit user approval
4. Result reported back to user

### Household Knowledge Graph
Structured, queryable facts extracted from documents and feeds — not raw storage but structured household reality.

### Notification Engine
Proactive alerts: warranty expiry, debit order changes, bill anomalies, policy renewal, vehicle licence expiry, maintenance reminders, unclaimed benefits, SLA breach, consumption anomalies.

## USER TYPES
- Primary User: household administrator
- Secondary User: partner/spouse (view + limited edit)
- View-Only: other household members
- Platform Admin: internal HouseholdOS staff

## SUBSCRIPTION TIERS (Stripe)
- Essential R99/month: 20 docs, 5 email addresses, 500 AI interactions, basic modules
- Household R199/month: 100 docs, 20 addresses, bank API, core modules, 2000 AI interactions
- Premium R349/month: unlimited docs, all modules, HITL pipeline, proactive monitoring
- White Label Enterprise: custom pricing

## SECURITY AND COMPLIANCE
- POPIA compliant from day one
- All data encrypted at rest with household-specific keys
- Bank API connections READ-ONLY — no transaction initiation ever
- RLS on every table: users access only their household data
- Document storage: Supabase Storage signed URLs only, no public access
- HITL required for all consequential external actions
- Audit log for all agent actions and data access
- No financial advice — information only

## APP STORE REQUIREMENTS
- iOS App Store: privacy manifest, ATT framework, no web scraping UI, HITL for all actions, guideline compliant
- Google Play: target API 34+, privacy policy, data safety section, Play Store guidelines
- React Native Expo managed workflow, EAS Build for production

## PHASE 1 ACCEPTANCE CRITERIA
- User creates account and household profile
- User uploads a document (PDF or photo) and asks natural language questions — gets accurate answers
- User sets up dedicated email address, receives forwarded statement, system parses and extracts data
- User uploads receipt photo — system OCRs it, extracts product, date, price, retailer, starts warranty tracking
- Web app live on Vercel with full conversational UI
- Mobile app Expo builds produced for iOS and Android
- Full test suite passing: unit, integration, functional (one per AC), regression, E2E Playwright, load test on AI endpoints
- Security review passed — SSRF protection, RLS verified, auth on all routes
- Documentation complete: 5+ ADRs, API docs, data flow, ExCo summary, runbook