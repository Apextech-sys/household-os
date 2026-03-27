# HouseholdOS Database Schema Report

**Project:** household-os
**Supabase Project ID:** `vzyeuxczwdpvlfwfzjih`
**Region:** eu-west-2
**Status:** ACTIVE_HEALTHY
**Generated:** 2026-03-27

---

## Extensions

| Extension | Status |
|-----------|--------|
| `vector` | Enabled |
| `pg_trgm` | Enabled |

---

## Tables (19 total)

### households

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| name | text | NOT NULL | — |
| slug | text | UNIQUE, NOT NULL | — |
| subscription_tier | text | NOT NULL, CHECK (essential/household/premium/enterprise) | `'essential'` |
| stripe_customer_id | text | nullable | — |
| created_at | timestamptz | NOT NULL | `now()` |
| updated_at | timestamptz | NOT NULL | `now()` |

### users

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| email | text | UNIQUE, NOT NULL | — |
| full_name | text | NOT NULL | — |
| role | text | NOT NULL, CHECK (primary/secondary/view_only/admin) | — |
| avatar_url | text | nullable | — |
| created_at | timestamptz | NOT NULL | `now()` |

### user_preferences

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| user_id | uuid | NOT NULL, FK -> users(id) CASCADE | — |
| household_id | uuid | NOT NULL | — |
| key | text | NOT NULL, UNIQUE(user_id, key) | — |
| value | jsonb | NOT NULL | `'{}'` |

### documents

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| uploaded_by | uuid | NOT NULL, FK -> users(id) | — |
| filename | text | NOT NULL | — |
| file_path | text | NOT NULL | — |
| file_size | integer | NOT NULL | — |
| mime_type | text | NOT NULL | — |
| status | text | NOT NULL, CHECK (uploading/processing/ready/error) | `'uploading'` |
| ocr_text | text | nullable | — |
| extracted_data | jsonb | nullable | — |
| embedding | vector(1536) | nullable | — |
| created_at | timestamptz | NOT NULL | `now()` |

### document_qa_sessions

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| document_id | uuid | NOT NULL, FK -> documents(id) CASCADE | — |
| user_id | uuid | NOT NULL, FK -> users(id) | — |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| created_at | timestamptz | NOT NULL | `now()` |

### document_qa_messages

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| session_id | uuid | NOT NULL, FK -> document_qa_sessions(id) CASCADE | — |
| household_id | uuid | NOT NULL | — |
| role | text | NOT NULL, CHECK (user/assistant) | — |
| content | text | NOT NULL | — |
| created_at | timestamptz | NOT NULL | `now()` |

### inbox_addresses

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| email_address | text | UNIQUE, NOT NULL | — |
| label | text | nullable | — |
| is_active | boolean | NOT NULL | `true` |
| created_at | timestamptz | NOT NULL | `now()` |

### inbox_messages

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| inbox_address_id | uuid | NOT NULL, FK -> inbox_addresses(id) CASCADE | — |
| from_email | text | NOT NULL | — |
| subject | text | nullable | — |
| body | text | nullable | — |
| raw_payload | jsonb | nullable | — |
| status | text | NOT NULL, CHECK (received/processing/parsed/error) | `'received'` |
| parsed_data | jsonb | nullable | — |
| received_at | timestamptz | NOT NULL | `now()` |
| created_at | timestamptz | NOT NULL | `now()` |

### inbox_attachments

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| message_id | uuid | NOT NULL, FK -> inbox_messages(id) CASCADE | — |
| household_id | uuid | NOT NULL | — |
| filename | text | NOT NULL | — |
| file_path | text | NOT NULL | — |
| file_size | integer | nullable | — |
| mime_type | text | nullable | — |
| created_at | timestamptz | NOT NULL | `now()` |

### receipts

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| uploaded_by | uuid | NOT NULL, FK -> users(id) | — |
| image_path | text | NOT NULL | — |
| ocr_text | text | nullable | — |
| retailer | text | nullable | — |
| purchase_date | date | nullable | — |
| total_amount | numeric(12,2) | nullable | — |
| currency | text | NOT NULL | `'ZAR'` |
| items | jsonb | nullable | — |
| status | text | NOT NULL, CHECK (uploading/processing/ready/error) | `'uploading'` |
| created_at | timestamptz | NOT NULL | `now()` |

### warranties

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| receipt_id | uuid | NOT NULL, FK -> receipts(id) | — |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| product_name | text | NOT NULL | — |
| warranty_months | integer | NOT NULL | — |
| expiry_date | date | NOT NULL | — |
| alert_sent | boolean | NOT NULL | `false` |
| created_at | timestamptz | NOT NULL | `now()` |

### budget_transactions

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| source | text | NOT NULL, CHECK (manual/statement/bank_api) | — |
| description | text | NOT NULL | — |
| amount | numeric(12,2) | NOT NULL | — |
| category | text | nullable | — |
| transaction_date | date | NOT NULL | — |
| is_income | boolean | NOT NULL | `false` |
| statement_ref | text | nullable | — |
| created_at | timestamptz | NOT NULL | `now()` |

### budget_categories

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| name | text | NOT NULL, UNIQUE(household_id, name) | — |
| icon | text | nullable | — |
| is_income | boolean | NOT NULL | `false` |
| created_at | timestamptz | NOT NULL | `now()` |

### budget_summaries

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| month | date | NOT NULL, UNIQUE(household_id, month) | — |
| total_income | numeric(12,2) | NOT NULL | `0` |
| total_expenses | numeric(12,2) | NOT NULL | `0` |
| by_category | jsonb | nullable | — |
| created_at | timestamptz | NOT NULL | `now()` |

### hitl_actions

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| user_id | uuid | NOT NULL, FK -> users(id) | — |
| action_type | text | NOT NULL | — |
| module | text | NOT NULL | — |
| title | text | NOT NULL | — |
| description | text | nullable | — |
| proposed_action | jsonb | nullable | — |
| status | text | NOT NULL, CHECK (proposed/approved/rejected/executed/failed) | `'proposed'` |
| approved_at | timestamptz | nullable | — |
| executed_at | timestamptz | nullable | — |
| result | jsonb | nullable | — |
| created_at | timestamptz | NOT NULL | `now()` |

### notifications

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| user_id | uuid | NOT NULL, FK -> users(id) | — |
| type | text | NOT NULL | — |
| title | text | NOT NULL | — |
| body | text | nullable | — |
| module | text | nullable | — |
| reference_id | uuid | nullable | — |
| is_read | boolean | NOT NULL | `false` |
| created_at | timestamptz | NOT NULL | `now()` |

### ai_usage_log

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| user_id | uuid | NOT NULL, FK -> users(id) | — |
| model | text | NOT NULL | — |
| endpoint | text | NOT NULL | — |
| prompt_tokens | integer | NOT NULL | `0` |
| completion_tokens | integer | NOT NULL | `0` |
| total_tokens | integer | NOT NULL | `0` |
| latency_ms | integer | nullable | — |
| created_at | timestamptz | NOT NULL | `now()` |

### audit_log

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, FK -> households(id) CASCADE | — |
| user_id | uuid | nullable, FK -> users(id) | — |
| action | text | NOT NULL | — |
| entity_type | text | NOT NULL | — |
| entity_id | uuid | nullable | — |
| details | jsonb | nullable | — |
| ip_address | text | nullable | — |
| created_at | timestamptz | NOT NULL | `now()` |

### subscriptions

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | `gen_random_uuid()` |
| household_id | uuid | NOT NULL, UNIQUE, FK -> households(id) CASCADE | — |
| stripe_subscription_id | text | nullable | — |
| tier | text | NOT NULL, CHECK (essential/household/premium/enterprise) | `'essential'` |
| status | text | NOT NULL, CHECK (active/cancelled/past_due/trialing) | `'active'` |
| current_period_start | timestamptz | nullable | — |
| current_period_end | timestamptz | nullable | — |
| created_at | timestamptz | NOT NULL | `now()` |

---

## Indexes

| Index Name | Table | Column(s) |
|------------|-------|-----------|
| idx_users_household_id | users | household_id |
| idx_users_email | users | email |
| idx_documents_household_id | documents | household_id |
| idx_documents_status | documents | status |
| idx_documents_uploaded_by | documents | uploaded_by |
| idx_documents_ocr_text_trgm | documents | ocr_text (trigram) |
| idx_document_qa_sessions_document_id | document_qa_sessions | document_id |
| idx_document_qa_sessions_household_id | document_qa_sessions | household_id |
| idx_document_qa_sessions_user_id | document_qa_sessions | user_id |
| idx_document_qa_messages_session_id | document_qa_messages | session_id |
| idx_document_qa_messages_household_id | document_qa_messages | household_id |
| idx_inbox_addresses_household_id | inbox_addresses | household_id |
| idx_inbox_messages_household_id | inbox_messages | household_id |
| idx_inbox_messages_status | inbox_messages | status |
| idx_inbox_messages_inbox_address_id | inbox_messages | inbox_address_id |
| idx_inbox_messages_received_at | inbox_messages | received_at |
| idx_inbox_messages_subject_trgm | inbox_messages | subject (trigram) |
| idx_inbox_attachments_message_id | inbox_attachments | message_id |
| idx_inbox_attachments_household_id | inbox_attachments | household_id |
| idx_receipts_household_id | receipts | household_id |
| idx_receipts_uploaded_by | receipts | uploaded_by |
| idx_receipts_status | receipts | status |
| idx_receipts_ocr_text_trgm | receipts | ocr_text (trigram) |
| idx_receipts_retailer_trgm | receipts | retailer (trigram) |
| idx_warranties_household_id | warranties | household_id |
| idx_warranties_expiry_date | warranties | expiry_date |
| idx_warranties_receipt_id | warranties | receipt_id |
| idx_budget_transactions_household_id | budget_transactions | household_id |
| idx_budget_transactions_transaction_date | budget_transactions | transaction_date |
| idx_budget_transactions_category | budget_transactions | category |
| idx_budget_categories_household_id | budget_categories | household_id |
| idx_budget_summaries_household_id | budget_summaries | household_id |
| idx_budget_summaries_month | budget_summaries | month |
| idx_hitl_actions_household_id | hitl_actions | household_id |
| idx_hitl_actions_status | hitl_actions | status |
| idx_hitl_actions_module | hitl_actions | module |
| idx_hitl_actions_user_id | hitl_actions | user_id |
| idx_notifications_household_id | notifications | household_id |
| idx_notifications_user_id | notifications | user_id |
| idx_notifications_is_read | notifications | is_read |
| idx_ai_usage_household_id | ai_usage_log | household_id |
| idx_ai_usage_log_user_id | ai_usage_log | user_id |
| idx_audit_log_household_id | audit_log | household_id |
| idx_audit_log_entity_type | audit_log | entity_type |
| idx_audit_log_user_id | audit_log | user_id |
| idx_subscriptions_household_id | subscriptions | household_id |
| idx_subscriptions_status | subscriptions | status |

Plus `*_created_at` indexes on every table and all primary key / unique constraint indexes.

---

## Row Level Security (RLS)

| Table | RLS Enabled |
|-------|-------------|
| households | Yes |
| users | Yes |
| user_preferences | Yes |
| documents | Yes |
| document_qa_sessions | Yes |
| document_qa_messages | Yes |
| inbox_addresses | Yes |
| inbox_messages | Yes |
| inbox_attachments | Yes |
| receipts | Yes |
| warranties | Yes |
| budget_transactions | Yes |
| budget_categories | Yes |
| budget_summaries | Yes |
| hitl_actions | Yes |
| notifications | Yes |
| ai_usage_log | Yes |
| audit_log | Yes |
| subscriptions | Yes |

**All 19 tables have RLS enabled.**

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://vzyeuxczwdpvlfwfzjih.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6eWV1eGN6d2Rwdmxmd2Z6amloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDkzMTUsImV4cCI6MjA5MDIyNTMxNX0.REFSCZs_sff17px2AAxz4-Cx3mkaA_jSy8qAXxZSCOw
SUPABASE_PUBLISHABLE_KEY=sb_publishable_Qin4eWwg5YtEnMfK8nCHqg_fghjTctS
SUPABASE_PROJECT_ID=vzyeuxczwdpvlfwfzjih
SUPABASE_DB_HOST=db.vzyeuxczwdpvlfwfzjih.supabase.co
```
