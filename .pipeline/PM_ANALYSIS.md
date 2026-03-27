# HouseholdOS — PM Analysis & Expanded Specification
**Version:** 1.0  
**Author:** Product Manager  
**Date:** 2026-03-28  
**Status:** APPROVED FOR WAVE 1.5+

---

## 1. SCOPE CONFIRMATION

### All 25 Modules with Phase Assignment

| # | Module | Phase | Priority |
|---|--------|-------|----------|
| 1 | Document Intelligence Hub | **Phase 1** | Foundation |
| 2 | Dedicated Inbox System | **Phase 1** | Foundation |
| 3 | Warranties and Receipts Vault | **Phase 1** | Foundation |
| 4 | Basic Budget Tracking | **Phase 1** | Foundation |
| 5 | Web App (Next.js 14 PWA) | **Phase 1** | Foundation |
| 6 | Mobile App (React Native Expo) | **Phase 1** | Foundation |
| 7 | Onboarding Flow | **Phase 1** | Foundation |
| 8 | Banking and Financial Intelligence | Phase 2 | Core Intelligence |
| 9 | Insurance Intelligence Agent | Phase 2 | Core Intelligence |
| 10 | Credit Card Benefits Intelligence | Phase 2 | Core Intelligence |
| 11 | Municipal and Utilities Management | Phase 2 | Core Intelligence |
| 12 | Vehicle Management | Phase 2 | Core Intelligence |
| 13 | Medical Aid and Healthcare | Phase 2 | Core Intelligence |
| 14 | Home Maintenance Intelligence | Phase 2 | Core Intelligence |
| 15 | Grocery and Consumables Intelligence | Phase 3 | Lifestyle & Advanced |
| 16 | Lifestyle Booking Agent | Phase 3 | Lifestyle & Advanced |
| 17 | ISP and Connectivity Intelligence | Phase 3 | Lifestyle & Advanced |
| 18 | Technology and Device Management | Phase 3 | Lifestyle & Advanced |
| 19 | Energy Management | Phase 3 | Lifestyle & Advanced |
| 20 | Water Management | Phase 3 | Lifestyle & Advanced |
| 21 | Staff and Domestic Employee Module | Phase 3 | Lifestyle & Advanced |
| 22 | Legal Document Advisor | Phase 3 | Lifestyle & Advanced |
| 23 | Shopping Intelligence and Deal Finder | Phase 3 | Lifestyle & Advanced |
| 24 | Household Budget and Financial Planning | Phase 3 | Lifestyle & Advanced |
| 25 | Security System Management | Phase 3 | Lifestyle & Advanced |

### Phase 1 Scope Confirmation
**Phase 1 includes modules 1–7 ONLY.** No Phase 2 or Phase 3 modules will be built in Phase 1 implementation. Phase 2 and 3 modules will have placeholder UI routes and locked feature states in the navigation, visible but not functional, to signal product roadmap to early users.

---

## 2. USER STORIES — PHASE 1 (MODULES 1–7)

> **Convention:** Stories are written from the perspective of the Primary User unless otherwise noted.
> Each story follows: "As a [role], I want [goal] so that [benefit]."
> Acceptance Criteria (AC) are testable and binary.

---

### MODULE 7: Onboarding Flow

**Epic Goal:** Get a new user from zero to first value moment (document answered by AI) in under 5 minutes.

---

#### Story 7.1 — Account Creation
**As a new user, I want to create a HouseholdOS account with my email and password so that I have a secure, personal account.**

**Acceptance Criteria:**
1. User can register with email + password; email verification sent within 60 seconds.
2. Password must meet minimum requirements (8+ chars, 1 uppercase, 1 number); validation shown inline before submission.
3. Duplicate email registration is rejected with a clear "account already exists" message and sign-in link.
4. On successful verification, user is automatically signed in and redirected to household setup.
5. OAuth sign-in via Google is available as an alternative path and completes without requiring additional password setup.
6. Failed registration attempts (network error) surface a retry option without clearing form data.
7. All auth flows are POPIA-compliant: privacy policy and terms acceptance captured and stored with timestamp.

---

#### Story 7.2 — Household Profile Setup
**As a new user, I want to set up my household profile so that the platform understands my context.**

**Acceptance Criteria:**
1. After account creation, user is prompted to name their household (e.g., "The Joubert Household") — field is required.
2. User selects their primary bank (dropdown: FNB, ABSA, Standard Bank, Nedbank, Capitec, Investec, Other).
3. User can optionally add city/municipality (autocomplete from SA municipality list of 257).
4. Household profile is saved and associated with the user's account as Primary User.
5. User can skip optional fields and complete profile setup in under 60 seconds.
6. Household profile page shows a completion percentage and prompts for missing optional fields post-onboarding.
7. Profile data is stored with tenant_id RLS enforced — not accessible by other households.

---

#### Story 7.3 — First Value Moment (Document Upload in Onboarding)
**As a new user, I want to be guided to upload my first document and ask a question about it so that I experience immediate value.**

**Acceptance Criteria:**
1. After household setup, user is presented with an explicit "Upload your first document" prompt with examples (e.g., "Try your home insurance policy or a utility bill").
2. User can upload a PDF or image (JPG/PNG/HEIC) directly from the onboarding screen — no navigation required.
3. OCR processing begins immediately on upload with a visual progress indicator; first response arrives within 30 seconds.
4. System suggests 3 starter questions based on the detected document type (e.g., for insurance: "What is my sum insured?" / "When does this policy expire?" / "What is my excess?").
5. User can ask a custom natural language question and receive an accurate AI answer grounded in the uploaded document.
6. Time from account creation to first AI answer is tracked and must be achievable in under 5 minutes on a typical SA broadband connection.
7. After first Q&A, user is shown a "Setup complete" screen with next steps (email setup, receipt upload, invite partner).

---

#### Story 7.4 — Invite Secondary User (Household Partner)
**As a Primary User, I want to invite my partner to my household so that we share access to household documents and data.**

**Acceptance Criteria:**
1. Primary User can invite via email from Settings > Household Members.
2. Invitee receives an email with a unique, expiring (48h) invite link.
3. Invitee can accept invite and either create a new account or sign in to an existing account.
4. On acceptance, invitee is added as Secondary User with default permissions (view + limited edit).
5. Primary User is notified when invite is accepted.
6. Primary User can revoke a pending invite before acceptance.
7. Household data is immediately accessible to Secondary User per their role permissions on acceptance.

---

### MODULE 1: Document Intelligence Hub

**Epic Goal:** User can upload any document (PDF, photo), have it OCR'd and understood by AI, and ask natural language questions to get accurate answers.

---

#### Story 1.1 — Document Upload
**As a user, I want to upload a PDF or photo of any household document so that it is stored securely and ready for AI analysis.**

**Acceptance Criteria:**
1. User can upload PDF, JPG, PNG, and HEIC files from web and mobile.
2. Maximum file size is 50MB per document; files exceeding limit show a clear error with size guidance.
3. Upload UI shows a progress bar; user receives confirmation when upload is complete.
4. Uploaded document is stored in Supabase Storage with a signed URL (never public).
5. Document is associated with the user's household via tenant_id RLS.
6. Duplicate detection: if the same file hash is uploaded twice, user is warned and asked to confirm or cancel.
7. Document appears in the Document Library with upload date, file name, and detected type (pending processing) within 5 seconds of upload.

---

#### Story 1.2 — OCR and Extraction
**As a user, I want my uploaded document to be automatically processed and have key facts extracted so that I don't have to manually read everything.**

**Acceptance Criteria:**
1. OCR processing begins automatically within 10 seconds of upload completion.
2. For image files, Claude Vision performs OCR and extracts full text; for PDFs, text layer is preferred with Vision fallback for scanned PDFs.
3. Extracted text is stored and linked to the document record.
4. AI extraction identifies and stores structured key facts: document type, issuer, dates (issue, expiry, due), amounts, account/policy numbers, and parties named.
5. Extracted facts are displayed on the document detail screen in a structured summary card.
6. Processing status is visible (pending → processing → complete / failed) with estimated completion time.
7. If extraction confidence is below threshold (<70%), user is flagged to review and optionally correct extracted fields.

---

#### Story 1.3 — Natural Language Q&A
**As a user, I want to ask natural language questions about any document in plain English (or Afrikaans) so that I can quickly find information without reading the full document.**

**Acceptance Criteria:**
1. From any document's detail screen, user can type a free-text question in the chat input.
2. AI response cites the specific section/page of the document it references.
3. Response is grounded in the document content — AI does not fabricate facts not present in the document.
4. Q&A context persists for the session — user can ask follow-up questions that reference prior answers.
5. Responses arrive in streaming format; first token appears within 3 seconds.
6. Questions in Afrikaans are understood and answered (multilingual support via Claude).
7. AI response includes a disclaimer for financial/legal documents: "This is information only, not advice."
8. Conversation history is saved and accessible on return to the document.

---

#### Story 1.4 — Document Library and Organisation
**As a user, I want to browse and organise my uploaded documents so that I can find them quickly.**

**Acceptance Criteria:**
1. Document Library lists all documents with thumbnail, name, type tag, upload date, and processing status.
2. User can filter by document type (Insurance, Banking, Municipal, Receipt, Contract, Other).
3. User can search documents by name, issuer, or extracted fact (e.g., searching "Nedbank" returns all Nedbank documents).
4. User can rename a document and add a custom category tag.
5. Documents can be soft-deleted; deleted documents move to a Trash with 30-day recovery window.
6. Library is paginated / virtualised — loads 20 documents at a time with infinite scroll.
7. Document count against subscription tier limit is visible (e.g., "14 / 20 documents used").

---

### MODULE 2: Dedicated Inbox System

**Epic Goal:** Each household gets dedicated email addresses; forwarded statements and documents are automatically ingested, parsed, and surfaced in the platform.

---

#### Story 2.1 — Dedicated Email Address Setup
**As a user, I want to get a dedicated email address for my household so that I can forward statements and documents directly into the platform.**

**Acceptance Criteria:**
1. During onboarding or from Settings, user can claim a household email subdomain (e.g., `joubert@household.xyz`).
2. User can create named email addresses for specific senders (e.g., `absa.joubert@household.xyz`), up to the tier limit.
3. Each email address is immediately active after creation (Postmark routing configured automatically).
4. User is shown clear setup instructions: "Forward your ABSA statements to this address."
5. A test email can be sent to the address and the system confirms receipt within 60 seconds.
6. Email addresses are listed in Settings > Inbox with status (active/paused) and last-received date.
7. Tier limits on number of addresses are enforced; attempting to exceed limit shows upgrade prompt.

---

#### Story 2.2 — Email Ingestion and Parsing
**As a user, I want emails received at my household addresses to be automatically parsed and relevant data extracted so that I don't have to manually process them.**

**Acceptance Criteria:**
1. Inbound email (via Postmark webhook) is ingested within 60 seconds of receipt.
2. System identifies the email type: bank statement, utility bill, insurance renewal, invoice, or unknown.
3. For bank statements (PDF attachment): AI extracts account number, statement period, opening/closing balance, and all transactions with date, description, amount, and category.
4. For utility bills: AI extracts billing period, account number, consumption figures, amount due, and due date.
5. Extracted data appears in the Inbox module and triggers a notification to the user.
6. Original email and any attachments are stored and linked to the parsed record.
7. If parsing fails or confidence is low, email is flagged as "Needs Review" with the raw content shown to the user.
8. Duplicate detection: same statement received twice shows a warning rather than creating duplicate records.

---

#### Story 2.3 — Statement Change Detection
**As a user, I want the system to alert me when something significant changes in a new statement compared to the last one so that I can spot anomalies.**

**Acceptance Criteria:**
1. On ingestion of a new bank statement or utility bill, system compares against the last statement for the same account.
2. Alerts generated for: new debit orders (first appearance), significant balance change (>20% vs prior period), new high-value transaction (>R5,000), and new fees/charges not present previously.
3. Alerts appear in the Notifications panel with plain-language explanation (e.g., "New debit order: InsureLife R499/month first appeared this month").
4. User can acknowledge or dismiss an alert; dismissed alerts are recorded.
5. Alert sensitivity can be adjusted in Settings (e.g., transaction threshold for "high value").
6. No false positives on regular salary credit (correctly identified as expected income, not flagged).
7. Change detection report is attached to the inbox item for the statement.

---

### MODULE 3: Warranties and Receipts Vault

**Epic Goal:** User can photograph a receipt; the system OCRs it, extracts product details, and tracks warranty expiry with proactive alerts.

---

#### Story 3.1 — Receipt Photo Capture and OCR
**As a user, I want to photograph a receipt on my phone and have it automatically processed so that I don't have to manually capture the details.**

**Acceptance Criteria:**
1. Mobile app provides an in-app camera capture flow specifically optimised for receipts (guidance overlay, auto-crop).
2. User can also upload a photo from their camera roll (iOS/Android gallery picker).
3. Web app supports file upload (JPG/PNG/PDF) for receipts.
4. OCR processing begins within 5 seconds of photo submission.
5. Extracted data includes: retailer name, date of purchase, total amount, itemised product list (name, quantity, price), and VAT amount (SA VAT at 15%).
6. Extracted data is shown to the user for quick review/confirmation before saving.
7. If OCR confidence is below threshold, user is prompted to retake the photo or manually enter missing fields.
8. Receipt is stored and linked to the household with full tenant_id RLS enforcement.

---

#### Story 3.2 — Warranty Tracking
**As a user, I want the system to automatically track warranty periods for products on my receipts so that I know when warranties expire.**

**Acceptance Criteria:**
1. After receipt OCR, user is prompted to confirm or select applicable products for warranty tracking (not all items need tracking, e.g., groceries are skipped automatically by category).
2. User can specify warranty period: 6 months, 1 year, 2 years, 5 years, or custom (from product manual or CPA statutory warranty).
3. System automatically applies SA Consumer Protection Act minimum warranty (6 months) if no warranty is specified.
4. Warranty record stores: product name, retailer, purchase date, purchase price, warranty expiry date, and linked receipt.
5. Warranties dashboard lists all tracked items with days-to-expiry colour coded (green >90 days, amber 31–90, red ≤30 days).
6. User can attach additional photos (product serial number, extended warranty certificate) to a warranty record.
7. HITL required to initiate a warranty claim (see Section 5).

---

#### Story 3.3 — Warranty Expiry Alerts
**As a user, I want to receive proactive alerts before a warranty expires so that I can take action in time.**

**Acceptance Criteria:**
1. Push notification sent 90 days before warranty expiry: "Your Samsung TV warranty expires in 90 days (2026-06-28)."
2. Push notification sent 30 days before warranty expiry with escalated urgency.
3. Push notification sent 7 days before warranty expiry.
4. Notifications link directly to the product warranty record in the app.
5. User can snooze an alert (24h, 7 days) or mark it as "Actioned."
6. Notification preferences are configurable per-module in Settings.
7. All alerts respect the user's notification opt-in (POPIA compliant).

---

#### Story 3.4 — Bank Transaction Matching
**As a user, I want receipts to be automatically matched to bank transactions so that I have a complete financial picture.**

**Acceptance Criteria:**
1. When a bank statement is ingested via Inbox, the system attempts to match transactions to existing receipts by date range (±3 days) and amount (exact match ±R2 tolerance for rounding).
2. Matched receipts show a "Verified" badge on the receipt and on the bank transaction.
3. Unmatched receipts older than 7 days are surfaced as "Unmatched" with a prompt to link manually.
4. User can manually link a receipt to a bank transaction via drag-and-drop or search.
5. Matching algorithm only processes within the same household — cross-household matching never occurs.
6. Match confidence score is logged (not shown to user) for future model improvement.

---

### MODULE 4: Basic Budget Tracking

**Epic Goal:** Income and expenses are automatically categorised from bank statements, with a monthly summary the user can understand at a glance.

---

#### Story 4.1 — Transaction Import and Categorisation
**As a user, I want my bank statement transactions to be automatically categorised so that I understand where my money goes.**

**Acceptance Criteria:**
1. When a bank statement is ingested (via Inbox or manual upload), all transactions are extracted and stored.
2. AI categorises each transaction into a standard category: Income, Housing, Transport, Food & Groceries, Insurance, Medical, Education, Entertainment, Subscriptions, Savings, Other.
3. SA-specific categorisations are applied correctly (e.g., Capitec "ATM withdrawal" → Cash, Checkers/Pick n Pay → Food & Groceries, Dis-Chem → Medical, Netflix/Showmax → Subscriptions).
4. User can re-categorise any transaction; the correction is stored and used to improve future categorisation for that user (per-household learning).
5. Categorised transactions are available immediately after statement ingestion — no separate import step required.
6. All transactions display: date, description (cleaned/shortened), amount (debit/credit), category, and balance.
7. Duplicate transaction detection prevents double-counting if the same statement is processed twice.

---

#### Story 4.2 — Monthly Budget Summary
**As a user, I want to see a monthly summary of my income and expenses so that I can understand my financial position at a glance.**

**Acceptance Criteria:**
1. Budget dashboard shows current month summary by default with ability to navigate to prior months.
2. Summary shows: total income, total expenses, net position (surplus/deficit), and top 5 spending categories.
3. Donut chart and bar chart visualisations are available (toggle between views).
4. Month-on-month comparison available: "Expenses up R1,245 vs last month — mainly in Food & Groceries (+R890)."
5. Recurring expenses are identified and shown separately (subscriptions, debit orders, regular transfers).
6. Summary exports to PDF for the selected month (basic formatting, household name, period).
7. No financial advice is provided — dashboard is informational only with disclaimer shown.

---

#### Story 4.3 — Subscription Creep Detection (Basic)
**As a user, I want to see all my recurring subscriptions in one place so that I can identify and cancel unwanted ones.**

**Acceptance Criteria:**
1. Subscriptions & Debit Orders tab lists all identified recurring transactions with: service name, monthly amount, frequency, first seen date, last charged date.
2. New subscriptions/debit orders detected in the current month are highlighted.
3. User can mark a subscription as "Intentional" or "Review" — "Review" items are flagged in next month's report.
4. Total monthly subscription spend is shown prominently.
5. Year-to-date subscription spend is calculated and shown.
6. This is Phase 1 basic version — Phase 2 Banking module adds anomaly detection and cancellation drafting.

---

### MODULE 5: Web App (Next.js 14 PWA)

**Epic Goal:** Full conversational thin client accessible from any browser, with module dashboards and PWA installability.

---

#### Story 5.1 — Conversational Interface (Coordinator Agent)
**As a user, I want to interact with my household data via natural language in a chat interface so that I can get answers and take actions without navigating menus.**

**Acceptance Criteria:**
1. Central chat interface is accessible from the home screen on web and mobile with a persistent input bar.
2. Messages are routed to the appropriate specialist module by the Coordinator Agent (e.g., "When does my home insurance expire?" routes to Document Intelligence).
3. Coordinator Agent synthesises multi-domain answers (e.g., "What's my total insurance spend?" pulls from Inbox + Budget).
4. Responses stream in real-time; typing indicator shown while AI processes.
5. Chat history is persisted per household and accessible across sessions.
6. Conversation can be initiated from within a specific module and automatically carries that module's context.
7. Coordinator Agent correctly declines out-of-scope requests with a helpful explanation (e.g., "I can't book restaurant reservations yet — that's coming in Phase 3.").

---

#### Story 5.2 — Module Dashboards
**As a user, I want dedicated dashboards for each active module so that I can see a structured overview of each area of my household.**

**Acceptance Criteria:**
1. Navigation sidebar/bottom-nav shows all Phase 1 modules as active, Phase 2/3 modules as "Coming Soon" (locked).
2. Each module has a dedicated dashboard screen accessible within 1 tap/click.
3. Dashboard widgets load independently (skeleton loaders shown while fetching); one slow module does not block others.
4. Each dashboard shows: last updated timestamp, key summary metrics, recent activity, and an "Ask a question" shortcut.
5. Dashboard layout is responsive (works on mobile browser, tablet, desktop).
6. Empty state UI is shown when a module has no data yet, with a clear CTA to add first data.
7. Dashboard state persists across sessions — user returns to the same dashboard view they left.

---

#### Story 5.3 — PWA Installation
**As a user, I want to install HouseholdOS as a PWA on my phone or desktop so that I can access it like a native app.**

**Acceptance Criteria:**
1. Web app meets all PWA requirements: service worker, web manifest, HTTPS, and responsive design.
2. Install prompt appears on eligible browsers (Chrome/Edge on Android/Desktop) after 2 visits.
3. PWA icon and splash screen match HouseholdOS branding.
4. Offline state shows a clear "You're offline" screen with cached data accessible (last-fetched documents and summaries).
5. PWA handles push notifications for warranty alerts and inbox ingestion events.
6. Installed PWA passes Lighthouse PWA audit with score ≥90.

---

### MODULE 6: Mobile App (React Native Expo)

**Epic Goal:** Native iOS and Android app with camera integration for receipt/document capture, built with Expo managed workflow.

---

#### Story 6.1 — Mobile App Core Experience
**As a user, I want a native mobile app so that I can access HouseholdOS on my phone with a fast, native experience.**

**Acceptance Criteria:**
1. App is available on both iOS App Store and Google Play Store.
2. App opens and reaches home screen in under 3 seconds on a mid-range device (iPhone 12 / Samsung A54).
3. All Phase 1 modules are accessible from the mobile app with feature parity to the web app.
4. App handles poor connectivity gracefully: queues uploads when offline and retries automatically when reconnected.
5. Push notifications are supported on both iOS and Android (Expo Notifications).
6. App passes App Store review requirements: privacy manifest, no web scraping UI, HITL for consequential actions.
7. App version is shown in Settings with in-app update prompt when a new version is available via OTA update.

---

#### Story 6.2 — Camera Integration for Documents and Receipts
**As a user, I want to use my phone camera to capture documents and receipts directly in the app so that upload is fast and easy.**

**Acceptance Criteria:**
1. In-app camera is accessible from Document Upload and Receipt Vault with a single tap.
2. Camera shows a guide overlay for document capture (rectangle guide) and receipt capture (portrait-optimised).
3. Auto-capture triggers when document edges are detected and in focus (optional — can be manually triggered).
4. Captured image is immediately previewed; user can retake before confirming upload.
5. Camera access permission prompt includes a clear explanation of why the permission is needed.
6. Gallery picker is available as an alternative to in-app camera (iOS Photos + Android Media Picker).
7. Multi-page document capture: user can capture multiple pages and they are combined into a single document record.

---

#### Story 6.3 — Biometric Authentication
**As a user, I want to use Face ID/fingerprint to unlock the app so that my household data is secure without re-entering my password.**

**Acceptance Criteria:**
1. Biometric authentication (Face ID on iOS, Fingerprint on Android) is available and prompted during onboarding setup.
2. Biometric auth is used for app unlock after session timeout (configurable: 5 min / 15 min / 1 hour / never).
3. Fallback to PIN or password if biometric fails.
4. Biometric setup can be disabled in Settings > Security.
5. Biometric data never leaves the device — Expo LocalAuthentication only, no server-side biometric storage.
6. If biometric hardware is unavailable, the option is hidden (not shown as broken/greyed).

---

## 3. USER ROLES & PERMISSIONS MATRIX

### Role Definitions

| Role | Description |
|------|-------------|
| **Primary User** | Household administrator; owns the account and subscription; full access |
| **Secondary User** | Partner/spouse; view + edit access to shared household data; cannot manage billing or delete |
| **View-Only** | Other household member (e.g., teenager); read access only; cannot upload or delete |
| **Platform Admin** | Internal HouseholdOS staff; support access with full audit trail; cannot see document contents without explicit user consent |

---

### Permissions Matrix — Phase 1 Modules

| Action | Primary | Secondary | View-Only | Platform Admin |
|--------|---------|-----------|-----------|----------------|
| **ACCOUNT & HOUSEHOLD** | | | | |
| Create/delete household | ✅ | ❌ | ❌ | ❌ |
| Edit household profile | ✅ | ✅ | ❌ | ❌ |
| Invite members | ✅ | ❌ | ❌ | ❌ |
| Remove members | ✅ | ❌ | ❌ | ❌ |
| Manage subscription/billing | ✅ | ❌ | ❌ | ❌ |
| View household members | ✅ | ✅ | ✅ | ✅ |
| **DOCUMENT INTELLIGENCE** | | | | |
| Upload document | ✅ | ✅ | ❌ | ❌ |
| View document | ✅ | ✅ | ✅ | Support only¹ |
| Ask questions (Q&A) | ✅ | ✅ | ✅ | ❌ |
| Delete document | ✅ | ❌ | ❌ | ❌ |
| Edit document metadata | ✅ | ✅ | ❌ | ❌ |
| View extraction results | ✅ | ✅ | ✅ | ❌ |
| **INBOX SYSTEM** | | | | |
| Create email address | ✅ | ✅ | ❌ | ❌ |
| Delete email address | ✅ | ❌ | ❌ | ❌ |
| View inbox items | ✅ | ✅ | ✅ | ❌ |
| Dismiss/acknowledge alerts | ✅ | ✅ | ❌ | ❌ |
| Configure change alerts | ✅ | ✅ | ❌ | ❌ |
| **RECEIPTS VAULT** | | | | |
| Upload receipt | ✅ | ✅ | ❌ | ❌ |
| View receipts | ✅ | ✅ | ✅ | ❌ |
| Delete receipt | ✅ | ❌ | ❌ | ❌ |
| Initiate warranty claim (HITL) | ✅ | ✅ | ❌ | ❌ |
| Edit warranty details | ✅ | ✅ | ❌ | ❌ |
| **BUDGET TRACKING** | | | | |
| View budget summary | ✅ | ✅ | ✅ | ❌ |
| Re-categorise transaction | ✅ | ✅ | ❌ | ❌ |
| Export budget report | ✅ | ✅ | ❌ | ❌ |
| Configure alert thresholds | ✅ | ✅ | ❌ | ❌ |
| **SETTINGS** | | | | |
| View notification settings | ✅ | ✅ | ✅ | ❌ |
| Edit notification settings | ✅ | ✅ | ❌ | ❌ |
| View audit log | ✅ | ❌ | ❌ | ✅ |
| Manage API connections | ✅ | ❌ | ❌ | ❌ |
| Delete account | ✅ | ❌ | ❌ | Support only² |

¹ Platform Admin can only access document content with explicit user-raised support ticket; access is logged.  
² Platform Admin can initiate account deletion only on verified user request with identity confirmation.

---

## 4. SUBSCRIPTION TIER FEATURE MATRIX

### Tier Definitions (ZAR pricing, Stripe billing)

| Feature | Essential R99/mo | Household R199/mo | Premium R349/mo | Enterprise (Custom) |
|---------|-----------------|-------------------|-----------------|---------------------|
| **LIMITS** | | | | |
| Documents | 20 | 100 | Unlimited | Unlimited |
| Inbox email addresses | 5 | 20 | Unlimited | Unlimited |
| AI interactions/month | 500 | 2,000 | Unlimited | Unlimited |
| Household members | 2 | 5 | Unlimited | Unlimited |
| Document storage | 1 GB | 5 GB | 25 GB | Custom |
| **MODULE 1: DOCUMENT INTELLIGENCE** | | | | |
| PDF/photo upload | ✅ | ✅ | ✅ | ✅ |
| OCR and text extraction | ✅ | ✅ | ✅ | ✅ |
| Natural language Q&A | ✅ (limited) | ✅ | ✅ | ✅ |
| Document library search | ✅ | ✅ | ✅ | ✅ |
| Batch upload | ❌ | ✅ | ✅ | ✅ |
| Document version history | ❌ | ❌ | ✅ | ✅ |
| **MODULE 2: INBOX SYSTEM** | | | | |
| Dedicated email addresses | ✅ (5) | ✅ (20) | ✅ (unlimited) | ✅ (unlimited) |
| Auto-ingestion | ✅ | ✅ | ✅ | ✅ |
| Statement parsing | ✅ | ✅ | ✅ | ✅ |
| Change detection alerts | Basic | Full | Full + Smart | Full + Smart |
| Attachment forwarding | ✅ | ✅ | ✅ | ✅ |
| **MODULE 3: RECEIPTS VAULT** | | | | |
| Receipt upload (photo/file) | ✅ | ✅ | ✅ | ✅ |
| OCR and extraction | ✅ | ✅ | ✅ | ✅ |
| Warranty tracking | ✅ (basic) | ✅ | ✅ | ✅ |
| Expiry alerts | ✅ | ✅ | ✅ | ✅ |
| Bank transaction matching | ❌ | ✅ | ✅ | ✅ |
| Warranty claim HITL | ❌ | ✅ | ✅ | ✅ |
| **MODULE 4: BUDGET TRACKING** | | | | |
| Transaction categorisation | ✅ | ✅ | ✅ | ✅ |
| Monthly summary | ✅ | ✅ | ✅ | ✅ |
| Month-on-month comparison | ❌ | ✅ | ✅ | ✅ |
| Subscription creep detection | ❌ | ✅ | ✅ | ✅ |
| Budget export (PDF) | ❌ | ✅ | ✅ | ✅ |
| Custom categories | ❌ | ❌ | ✅ | ✅ |
| **MODULE 5: WEB APP** | | | | |
| Full web app access | ✅ | ✅ | ✅ | ✅ |
| PWA installable | ✅ | ✅ | ✅ | ✅ |
| Conversational UI | ✅ | ✅ | ✅ | ✅ |
| Module dashboards | ✅ | ✅ | ✅ | ✅ |
| White-label branding | ❌ | ❌ | ❌ | ✅ |
| **MODULE 6: MOBILE APP** | | | | |
| iOS + Android app | ✅ | ✅ | ✅ | ✅ |
| Camera document capture | ✅ | ✅ | ✅ | ✅ |
| Push notifications | ✅ | ✅ | ✅ | ✅ |
| Biometric auth | ✅ | ✅ | ✅ | ✅ |
| **MODULE 7: ONBOARDING** | | | | |
| Self-serve onboarding | ✅ | ✅ | ✅ | ✅ |
| Guided setup wizard | ✅ | ✅ | ✅ | ✅ |
| Concierge onboarding | ❌ | ❌ | ❌ | ✅ |
| **PLATFORM** | | | | |
| POPIA data export | ✅ | ✅ | ✅ | ✅ |
| POPIA right to delete | ✅ | ✅ | ✅ | ✅ |
| Audit log access | ❌ | Basic | Full | Full + Export |
| Priority support | ❌ | ❌ | ✅ | ✅ |
| Dedicated account manager | ❌ | ❌ | ❌ | ✅ |
| SLA guarantee | ❌ | ❌ | 99.5% uptime | 99.9% uptime |
| **PHASE 2 MODULES** | ❌ | Partial¹ | ✅ | ✅ |
| **PHASE 3 MODULES** | ❌ | ❌ | ✅ | ✅ |

¹ Household tier gets Banking Intelligence (FNB/Investec API) and Insurance Q&A from Phase 2; other Phase 2 modules require Premium.

### Tier Enforcement Rules
- Limits checked at API level, not just UI — backend enforces hard limits.
- On limit breach: user is shown a non-blocking upgrade prompt; the current action is blocked with clear messaging.
- Tier changes take effect immediately (upgrades) or at end of billing period (downgrades).
- Free trial: 14 days at Household tier for all new accounts, no credit card required.

---

## 5. HITL ACTION PIPELINE SCENARIOS

### HITL Principle
**HITL (Human-In-The-Loop) is required for any action that has external consequences or cannot be fully reversed.** The system never autonomously sends emails, lodges claims, submits disputes, or makes external API calls on behalf of the user without explicit approval.

### Phase 1 HITL Classification

#### 5.1 — AUTO (No HITL Required)

| Action | Module | Why Auto |
|--------|--------|---------|
| Document OCR and text extraction | Module 1 | Internal processing, no external effect |
| Document storage to Supabase | Module 1 | Internal, reversible (can delete) |
| Natural language Q&A on a document | Module 1 | Read-only, informational response |
| Extraction of key facts from document | Module 1 | Internal, no external effect |
| Email ingestion (Postmark webhook) | Module 2 | Triggered by inbound email, no external call |
| Statement parsing and data extraction | Module 2 | Internal, no external effect |
| Change detection analysis | Module 2 | Internal analysis only |
| Receipt OCR and data extraction | Module 3 | Internal processing |
| Warranty record creation | Module 3 | Internal, no external effect |
| Transaction categorisation | Module 4 | Internal classification, user can correct |
| Monthly budget summary generation | Module 4 | Internal calculation |
| Push notification delivery (alerts) | All | Notification to own device, not external communication |

#### 5.2 — HITL REQUIRED (User Approval Before Execution)

| Action | Module | HITL Trigger | Steps |
|--------|--------|-------------|-------|
| **Warranty claim draft** | Module 3 | User requests "Help me make a warranty claim" | 1. Agent drafts claim letter with product details, purchase date, defect description placeholder. 2. Agent presents draft + recipient (retailer email). 3. User reviews, edits, approves. 4. User copies draft (Phase 1: no auto-send). Phase 2+ will add direct submission. |
| **Dispute draft for bank charge** | Module 2 | User requests "Help me dispute this charge" | 1. Agent identifies the charge and drafts a dispute letter with account number, transaction reference, amount, grounds. 2. User reviews and approves. 3. User copies/downloads draft. Phase 2: direct bank portal submission. |
| **Inbox forwarding rule changes** | Module 2 | User wants to auto-forward emails to external address | 1. Agent confirms target address and scope. 2. User explicitly approves forwarding rule. 3. System applies rule. |
| **Account deletion** | Platform | User requests delete account | 1. System shows full data deletion warning with list of what will be deleted. 2. Requires explicit typed confirmation ("delete my account"). 3. 24-hour grace period before permanent deletion. |
| **Member removal from household** | Platform | Primary User removes member | 1. System shows consequence (member loses all access). 2. Requires explicit confirmation. |
| **Subscription downgrade** | Platform | User downgrades tier | 1. System shows data that will be lost (e.g., docs above new limit). 2. User must confirm before downgrade applied at end of period. |

#### 5.3 — HITL UI Flow (Standard Pattern)
For all HITL actions, the UI follows this pattern:
1. **Proposal screen:** Agent presents proposed action with full reasoning and content (e.g., full draft letter).
2. **Action bar:** Three options — ✅ Approve | ✏️ Edit | ❌ Cancel.
3. **Edit mode:** Inline editable text fields on the draft; agent can be asked to revise via follow-up message.
4. **Confirmation:** On Approve, system executes and shows success/result.
5. **Audit log:** Every HITL approval/rejection is logged with timestamp, user ID, action type, and outcome.

---

## 6. CRITICAL EDGE CASES

### 6.1 — OCR Failure on a Document

**Scenario:** User uploads a document (PDF or photo) and OCR/extraction fails or produces low-confidence output.

**Handling Strategy:**
- **Low confidence (50–70%):** Processing completes but extracted data is shown with a yellow "Review needed" badge. Individual extracted fields are flagged. User is prompted to verify or correct.
- **High confidence (<50% or complete failure):** Processing fails gracefully. Error message: "We had trouble reading this document. You can still ask questions about it, but extracted data may be limited."
- **Fallback options offered:**
  1. "Retake / re-upload" with image quality tips shown (lighting, focus, no glare).
  2. "Enter details manually" — form with the key fields for the document type.
  3. "Ask questions anyway" — AI still attempts Q&A on whatever text was extracted.
- **Background retry:** System queues a second OCR attempt 5 minutes later with different preprocessing (contrast enhancement, deskew).
- **Completely unreadable:** Document is stored as-is. User informed. Document remains in library as "Processing failed" — user can retry or manually tag.
- **KPI impact:** OCR failures are tracked. If failure rate exceeds 15% for a document type, flag for AI model review.

---

### 6.2 — Email Parsing Can't Extract Data

**Scenario:** An email is received at a household address but parsing fails to extract meaningful structured data.

**Handling Strategy:**
- **Unrecognised format:** Email is stored in full (raw HTML + attachments). Inbox item shows as "Unrecognised format" with raw content accessible.
- **Partial extraction:** Fields that were extracted are shown; missing fields flagged as "Not found."
- **User action:** "Help us improve — tell us what this is" CTA that allows user to tag the email type (bank statement, utility bill, etc.) — this feeds improvement loop.
- **AI fallback:** Even without structured extraction, user can ask questions about the email content via Q&A.
- **PDF attachment failure:** If email contains a PDF that fails to parse, it is automatically added to Document Library as "Unprocessed" for manual review.
- **Spam/irrelevant emails:** If email clearly is not a financial/household document (e.g., newsletter), it is auto-categorised as "Other" without error.
- **SLA:** Failed parsing items are flagged in an internal dashboard; patterns investigated within 48 hours for new SA bank/utility formats.

---

### 6.3 — Receipt Photo is Blurry

**Scenario:** User submits a receipt photo with insufficient quality for reliable OCR.

**Handling Strategy:**
- **Pre-upload quality check (mobile):** Expo camera implementation applies blur detection before confirming capture. If blur score exceeds threshold: "This photo may be too blurry. Retake for best results?" (Allow retake or proceed anyway).
- **Post-upload low quality detection:** If OCR confidence is below threshold on the submitted image: "Photo quality was low. We extracted what we could — please review and correct the details below."
- **Quality guidance shown contextually:**
  - Place receipt on a flat, dark surface.
  - Ensure even lighting — avoid glare from flash.
  - Keep phone steady — tap to focus before capturing.
- **Manual entry fallback:** Any failed OCR field becomes an editable field the user can complete manually.
- **Minimum viable receipt:** If at minimum the total amount, retailer name, and date are extractable, the receipt is marked as "Partially processed" and saved. All three fields can be manually entered as fallback.
- **Partial saves never lost:** Any uploaded receipt photo is stored regardless of OCR outcome; user's effort is never wasted.

---

### 6.4 — User Exceeds Subscription Limits

**Scenario:** User attempts an action that exceeds their tier's limits.

**Handling Strategy:**

| Limit Type | On Breach | Upgrade Prompt | Hard Block? |
|-----------|-----------|----------------|-------------|
| Document count | "You've used 20/20 documents on Essential. Upgrade to Household for 100." | Yes — inline | Yes — cannot upload more |
| Email addresses | "You've reached 5 email addresses. Upgrade for more." | Yes — inline | Yes — cannot create more |
| AI interactions | Soft warning at 80% ("You've used 400/500 AI interactions this month"). Hard block at 100%. | Yes — persistent banner | Yes at 100% |
| Storage (GB) | Warning at 80% with storage breakdown shown. | Yes | Yes at 100% |
| Household members | Cannot invite beyond tier limit. | Yes | Yes |

**User Experience Principles:**
- Upgrade prompt is non-dismissive until user clicks "Not now" — does not repeatedly annoy.
- After clicking "Not now," prompt does not re-appear for 7 days (exception: hard block at 100% — always shown).
- Upgrade path is in-app via Stripe Checkout (ZAR, card or EFT via Peach Payments integration for SA).
- Existing data is NEVER deleted when a limit is reached — user retains what they have; only new uploads are blocked.
- On downgrade: data above the new limit is retained but becomes read-only until user removes items or upgrades again.

---

### 6.5 — Multi-Household Scenarios

**Scenario:** A user has legitimate reasons to manage multiple households (e.g., property investor, managing parents' household, divorce scenario).

**Current Phase 1 Handling:**
- Each account can belong to **one household only** in Phase 1.
- A user can be invited to multiple households (e.g., as Secondary User in parents' household while Primary User of own household).
- If a user is in multiple households, a **household switcher** is shown in the app header — switching loads that household's complete context.
- All AI, storage, and interaction limits apply **per household**, not per user account.
- **Billing:** Each household requires its own subscription. A user invited to another household does not inherit that household's subscription costs.

**Edge Cases:**
- **Divorce/separation:** Primary User owns the household. Secondary User has view access. On separation, Primary User removes Secondary User (HITL confirmation required). Ex-partner retains their own account but loses access to household data. — Legal note: Data access disputes are outside platform scope; platform follows instructions of account owner.
- **Deceased member:** Primary User can be re-assigned only via support ticket with identity verification (Platform Admin HITL).
- **User invited to 5+ households:** Technically possible (each adds to invitee's household switcher). No hard limit on how many households a user can be a member of, but limits apply per household they administer.

---

## 7. PHASE 1 KPIs

### 7.1 — Primary KPIs (Success Criteria)

| KPI | Definition | Target | Measurement Method |
|-----|-----------|--------|-------------------|
| **First Value Moment (FVM)** | Time from account creation (email verified) to first AI answer received from an uploaded document | ≤ 5 minutes (P75) | Timestamp: account_created → first_qa_response for each user; tracked in analytics |
| **Onboarding Completion Rate** | % of users who complete all onboarding steps (account → household → first document → first Q&A) | ≥ 60% within 24h of registration | Funnel analysis: onboarding_step events in analytics |
| **Document OCR Success Rate** | % of uploaded documents that complete OCR with confidence ≥70% | ≥ 85% | OCR job results logged: success / partial / failed per document |
| **Email Ingestion Success Rate** | % of inbound emails that result in at least partial structured data extraction | ≥ 80% | Postmark webhook events → parsing_result stored per email |
| **Receipt OCR Success Rate** | % of uploaded receipts with successful extraction (retailer + date + amount) | ≥ 80% | Receipt processing results logged per upload |
| **AI Response Latency (P95)** | Time from user submitting a question to first token streamed | ≤ 5 seconds | API route timing logged per request |
| **App Crash-Free Sessions** | % of mobile app sessions without a crash | ≥ 99.5% | Expo/Sentry crash reporting |
| **7-Day Retention** | % of users who return to the app within 7 days of first session | ≥ 40% | Analytics: DAU/MAU tracking |

---

### 7.2 — Secondary KPIs (Health Indicators)

| KPI | Target | Notes |
|-----|--------|-------|
| Postmark webhook processing time | ≤ 60s P95 | From email receipt to inbox item visible |
| Statement parsing accuracy (transactions extracted vs ground truth) | ≥ 90% for ABSA, Standard Bank, FNB, Nedbank | Manual QA sample of 50 statements per bank |
| Warranty expiry alert delivery rate | ≥ 99% for push notifications | Expo notifications delivery receipt |
| Subscription upgrade conversion from limit prompt | ≥ 5% (awareness metric — not a blocker) | Stripe webhook: upgrade_from_prompt event |
| Support tickets per 100 active users/month | ≤ 5 | Baseline — reduce over time |
| NPS (end of onboarding survey) | ≥ 40 | Simple 0–10 in-app prompt after first value moment |

---

### 7.3 — KPI Instrumentation Requirements

All KPIs require instrumentation to be built during Phase 1:

1. **Analytics events to track:**
   - `account_created`, `household_created`, `onboarding_step_completed` (step 1–5), `onboarding_completed`
   - `document_uploaded`, `document_ocr_started`, `document_ocr_completed` (with confidence_score), `document_ocr_failed`
   - `qa_question_asked`, `qa_response_received` (with latency_ms)
   - `email_received` (Postmark webhook), `email_parsing_completed` (with status, fields_extracted count)
   - `receipt_uploaded`, `receipt_ocr_completed` (with fields_extracted), `warranty_created`
   - `subscription_limit_shown`, `subscription_upgraded`, `subscription_upgrade_dismissed`
   - `hitl_proposed`, `hitl_approved`, `hitl_rejected`, `hitl_edited`

2. **Analytics platform:** PostHog (self-hosted or Cloud) — POPIA compliant, EU data residency, no PII in event properties (use anonymised household_id only).

3. **KPI dashboard:** Internal ops dashboard showing all KPIs in real-time, accessible to Platform Admin role.

4. **Alerting thresholds:**
   - OCR success rate drops below 70%: PagerDuty alert.
   - Email ingestion failure rate exceeds 30% in any 1-hour window: PagerDuty alert.
   - AI response P95 exceeds 10 seconds: Vercel alert + PagerDuty.

---

## APPENDIX: OPEN QUESTIONS FOR WAVE 1.5 (DBA + AI Specialist)

The following questions must be resolved before Tech Lead starts:

### For DBA:
1. Document storage schema — how are extracted facts stored? Flexible JSONB vs typed columns per document type?
2. Transaction schema — should transactions be normalised with a `transactions` table shared across inbox and budget, or separate tables?
3. Warranty period logic — stored as `warranty_expiry_date` (absolute) or `purchase_date` + `warranty_months` (derived)?
4. Household knowledge graph — is this a separate `facts` table or embedded in document records?
5. Multi-household membership — junction table `household_members(user_id, household_id, role)` confirmed?

### For AI Specialist:
1. Coordinator Agent routing logic — rule-based intent classification or LLM-based routing? Latency implications?
2. OCR confidence scoring — Claude Vision returns confidence? Or must we implement our own heuristic?
3. Statement parsing for 257 municipality formats — few-shot prompting strategy or fine-tuned approach?
4. SA bank statement parsing accuracy — what example statements are available for testing each major bank?
5. Q&A grounding strategy — RAG with embeddings (OpenAI) or direct document context injection per query? Token cost implications?
6. Embedding storage — pgvector extension on Supabase, dimension confirmation for OpenAI `text-embedding-3-small` (1536)?

---

*End of PM Analysis — HouseholdOS Phase 1*  
*Next: DBA Schema Design + AI Architecture → Dual Planner Debate → Tech Lead Implementation*
