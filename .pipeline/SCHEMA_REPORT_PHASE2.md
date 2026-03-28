# HouseholdOS Schema Report — Phase 2 (Modules 8–14)

**Generated:** 2026-03-28
**Project:** vzyeuxczwdpvlfwfzjih
**Migration:** `phase2_modules_8_to_14`

---

## Summary

- **Phase 2 tables added:** 16
- **Total public tables:** 35
- **All tables:** RLS enabled, household_id indexed

---

## Module 8: Banking and Financial Intelligence

### `bank_connections`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| bank_name | text | NOT NULL |
| bank_code | text | NOT NULL, CHECK (fnb, investec, absa, standard_bank, nedbank, capitec) |
| connection_type | text | NOT NULL, CHECK (api, statement_import) |
| api_credentials_encrypted | jsonb | |
| last_synced_at | timestamptz | |
| status | text | NOT NULL, DEFAULT 'pending', CHECK (pending, active, error, disconnected) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_bank_connections_household(household_id)`

### `bank_accounts`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| connection_id | uuid | NOT NULL, FK → bank_connections(id) CASCADE |
| account_number_masked | text | NOT NULL |
| account_type | text | CHECK (cheque, savings, credit, investment, bond) |
| nickname | text | |
| balance | numeric(14,2) | |
| balance_updated_at | timestamptz | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_bank_accounts_household(household_id)`, `idx_bank_accounts_connection(connection_id)`

### `debit_orders`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| account_id | uuid | FK → bank_accounts(id) SET NULL |
| description | text | NOT NULL |
| amount | numeric(12,2) | NOT NULL |
| frequency | text | DEFAULT 'monthly', CHECK (weekly, monthly, quarterly, annual) |
| expected_day | integer | |
| last_seen_date | date | |
| is_anomalous | boolean | DEFAULT false |
| anomaly_reason | text | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_debit_orders_household(household_id)`

### `subscriptions_detected`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| name | text | NOT NULL |
| provider | text | |
| amount | numeric(12,2) | NOT NULL |
| frequency | text | DEFAULT 'monthly' |
| first_seen | date | |
| last_seen | date | |
| category | text | |
| is_active | boolean | DEFAULT true |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_subscriptions_detected_household(household_id)`

---

## Module 9: Insurance Intelligence

### `insurance_policies`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| document_id | uuid | FK → documents(id) |
| insurer | text | NOT NULL |
| policy_number | text | |
| policy_type | text | CHECK (life, short_term, vehicle, household, medical_gap, funeral, business) |
| premium_amount | numeric(12,2) | |
| premium_frequency | text | DEFAULT 'monthly' |
| cover_amount | numeric(14,2) | |
| start_date | date | |
| renewal_date | date | |
| status | text | DEFAULT 'active', CHECK (active, lapsed, cancelled, pending_renewal) |
| benefits | jsonb | |
| exclusions | jsonb | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_insurance_policies_household(household_id)`, `idx_insurance_policies_renewal(renewal_date)`

### `insurance_claims`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| policy_id | uuid | NOT NULL, FK → insurance_policies(id) CASCADE |
| claim_type | text | NOT NULL |
| description | text | |
| amount_claimed | numeric(12,2) | |
| amount_paid | numeric(12,2) | |
| status | text | DEFAULT 'draft', CHECK (draft, submitted, under_review, approved, rejected, paid) |
| submitted_at | timestamptz | |
| resolved_at | timestamptz | |
| hitl_action_id | uuid | FK → hitl_actions(id) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_insurance_claims_household(household_id)`, `idx_insurance_claims_policy(policy_id)`

---

## Module 10: Credit Card Benefits

### `credit_cards`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| bank_account_id | uuid | FK → bank_accounts(id) |
| card_name | text | NOT NULL |
| card_type | text | |
| benefits | jsonb | |
| purchase_protection_days | integer | |
| warranty_extension_months | integer | |
| travel_insurance | jsonb | |
| annual_fee | numeric(10,2) | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_credit_cards_household(household_id)`

### `purchase_protections`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| credit_card_id | uuid | NOT NULL, FK → credit_cards(id) CASCADE |
| receipt_id | uuid | FK → receipts(id) |
| item_description | text | NOT NULL |
| purchase_date | date | NOT NULL |
| protection_expiry | date | NOT NULL |
| amount | numeric(12,2) | |
| status | text | DEFAULT 'active', CHECK (active, expired, claimed) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_purchase_protections_household(household_id)`, `idx_purchase_protections_expiry(protection_expiry)`

---

## Module 11: Municipal and Utilities

### `utility_accounts`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| provider | text | NOT NULL |
| account_number | text | |
| utility_type | text | NOT NULL, CHECK (electricity, water, rates, refuse, sewerage, combined) |
| municipality | text | |
| property_address | text | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_utility_accounts_household(household_id)`

### `utility_bills`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| account_id | uuid | NOT NULL, FK → utility_accounts(id) CASCADE |
| document_id | uuid | FK → documents(id) |
| bill_date | date | NOT NULL |
| due_date | date | |
| total_amount | numeric(12,2) | NOT NULL |
| line_items | jsonb | |
| consumption | jsonb | |
| is_anomalous | boolean | DEFAULT false |
| anomaly_details | text | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_utility_bills_household(household_id)`, `idx_utility_bills_account(account_id)`

---

## Module 12: Vehicle Management

### `vehicles`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| make | text | NOT NULL |
| model | text | NOT NULL |
| year | integer | |
| registration | text | |
| vin | text | |
| licence_expiry | date | |
| next_service_date | date | |
| next_service_km | integer | |
| current_km | integer | |
| finance_type | text | CHECK (owned, financed, leased, balloon) |
| balloon_amount | numeric(12,2) | |
| balloon_date | date | |
| insurance_policy_id | uuid | FK → insurance_policies(id) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_vehicles_household(household_id)`, `idx_vehicles_licence_expiry(licence_expiry)`

### `vehicle_events`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| vehicle_id | uuid | NOT NULL, FK → vehicles(id) CASCADE |
| event_type | text | NOT NULL, CHECK (service, licence_renewal, fine, accident, fuel, toll, parking, wash) |
| description | text | |
| amount | numeric(12,2) | |
| event_date | date | NOT NULL |
| next_due_date | date | |
| provider | text | |
| document_id | uuid | FK → documents(id) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_vehicle_events_household(household_id)`, `idx_vehicle_events_vehicle(vehicle_id)`

---

## Module 13: Medical Aid

### `medical_aid_plans`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| scheme_name | text | NOT NULL |
| plan_name | text | NOT NULL |
| membership_number | text | |
| principal_member | text | |
| dependants | jsonb | |
| monthly_contribution | numeric(12,2) | |
| benefits | jsonb | |
| savings_balance | numeric(12,2) | |
| day_to_day_balance | numeric(12,2) | |
| renewal_date | date | |
| document_id | uuid | FK → documents(id) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_medical_aid_plans_household(household_id)`

### `medical_claims`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| plan_id | uuid | NOT NULL, FK → medical_aid_plans(id) CASCADE |
| provider_name | text | |
| claim_date | date | NOT NULL |
| amount_billed | numeric(12,2) | |
| amount_paid | numeric(12,2) | |
| shortfall | numeric(12,2) | |
| category | text | |
| status | text | DEFAULT 'pending', CHECK (pending, approved, partially_paid, rejected) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_medical_claims_household(household_id)`, `idx_medical_claims_plan(plan_id)`

---

## Module 14: Home Maintenance

### `home_assets`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| name | text | NOT NULL |
| category | text | CHECK (appliance, plumbing, electrical, hvac, structural, garden, pool, security, solar, geyser, other) |
| brand | text | |
| model | text | |
| purchase_date | date | |
| warranty_id | uuid | FK → warranties(id) |
| expected_lifespan_years | integer | |
| last_service_date | date | |
| next_service_date | date | |
| notes | text | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_home_assets_household(household_id)`

### `maintenance_tasks`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| household_id | uuid | NOT NULL, FK → households(id) CASCADE |
| asset_id | uuid | FK → home_assets(id) SET NULL |
| title | text | NOT NULL |
| description | text | |
| priority | text | DEFAULT 'medium', CHECK (low, medium, high, urgent) |
| status | text | DEFAULT 'pending', CHECK (pending, scheduled, in_progress, complete, cancelled) |
| scheduled_date | date | |
| completed_date | date | |
| contractor_name | text | |
| contractor_phone | text | |
| estimated_cost | numeric(12,2) | |
| actual_cost | numeric(12,2) | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:** `idx_maintenance_tasks_household(household_id)`, `idx_maintenance_tasks_asset(asset_id)`, `idx_maintenance_tasks_status(status)`

---

## Complete Table Inventory (35 tables)

| # | Table | Module |
|---|---|---|
| 1 | ai_usage_log | Phase 1 |
| 2 | audit_log | Phase 1 |
| 3 | bank_accounts | 8 — Banking |
| 4 | bank_connections | 8 — Banking |
| 5 | budget_categories | Phase 1 |
| 6 | budget_summaries | Phase 1 |
| 7 | budget_transactions | Phase 1 |
| 8 | credit_cards | 10 — Credit Cards |
| 9 | debit_orders | 8 — Banking |
| 10 | document_qa_messages | Phase 1 |
| 11 | document_qa_sessions | Phase 1 |
| 12 | documents | Phase 1 |
| 13 | hitl_actions | Phase 1 |
| 14 | home_assets | 14 — Home Maintenance |
| 15 | households | Phase 1 |
| 16 | inbox_addresses | Phase 1 |
| 17 | inbox_attachments | Phase 1 |
| 18 | inbox_messages | Phase 1 |
| 19 | insurance_claims | 9 — Insurance |
| 20 | insurance_policies | 9 — Insurance |
| 21 | maintenance_tasks | 14 — Home Maintenance |
| 22 | medical_aid_plans | 13 — Medical Aid |
| 23 | medical_claims | 13 — Medical Aid |
| 24 | notifications | Phase 1 |
| 25 | purchase_protections | 10 — Credit Cards |
| 26 | receipts | Phase 1 |
| 27 | subscriptions | Phase 1 |
| 28 | subscriptions_detected | 8 — Banking |
| 29 | user_preferences | Phase 1 |
| 30 | users | Phase 1 |
| 31 | utility_accounts | 11 — Utilities |
| 32 | utility_bills | 11 — Utilities |
| 33 | vehicle_events | 12 — Vehicles |
| 34 | vehicles | 12 — Vehicles |
| 35 | warranties | Phase 1 |
