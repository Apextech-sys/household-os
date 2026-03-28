# Schema Report: Phase 3 (Modules 15-25)

**Generated:** 2026-03-28
**Supabase Project:** vzyeuxczwdpvlfwfzjih
**Migration:** phase3_modules_15_25
**Status:** Applied successfully

## New Tables (15)

| Module | Table | RLS | Index |
|--------|-------|-----|-------|
| 15 - Grocery Intelligence | `grocery_purchases` | Enabled | `idx_grocery_purchases_household` |
| 15 - Grocery Intelligence | `grocery_items` | Enabled | `idx_grocery_items_household` |
| 16 - Lifestyle Booking | `bookings` | Enabled | `idx_bookings_household`, `idx_bookings_datetime` |
| 17 - ISP Intelligence | `isp_connections` | Enabled | `idx_isp_connections_household` |
| 17 - ISP Intelligence | `speed_tests` | Enabled | `idx_speed_tests_household` |
| 18 - Technology Management | `devices` | Enabled | `idx_devices_household` |
| 19 - Energy Management | `energy_readings` | Enabled | `idx_energy_readings_household` |
| 20 - Water Management | `water_readings` | Enabled | `idx_water_readings_household` |
| 21 - Staff Management | `domestic_employees` | Enabled | `idx_domestic_employees_household` |
| 21 - Staff Management | `payslips` | Enabled | `idx_payslips_household`, `idx_payslips_employee` |
| 22 - Legal Document Advisor | `legal_documents` | Enabled | `idx_legal_documents_household` |
| 23 - Shopping Intelligence | `price_watches` | Enabled | `idx_price_watches_household` |
| 24 - Financial Planning | `financial_goals` | Enabled | `idx_financial_goals_household` |
| 24 - Financial Planning | `net_worth_snapshots` | Enabled | `idx_net_worth_snapshots_household` |
| 25 - Security System | `security_systems` | Enabled | `idx_security_systems_household` |

## Foreign Key References

- `grocery_purchases.household_id` -> `households(id)` CASCADE
- `grocery_purchases.receipt_id` -> `receipts(id)`
- `grocery_items.household_id` -> `households(id)` CASCADE
- `bookings.household_id` -> `households(id)` CASCADE
- `bookings.hitl_action_id` -> `hitl_actions(id)`
- `isp_connections.household_id` -> `households(id)` CASCADE
- `speed_tests.household_id` -> `households(id)` CASCADE
- `speed_tests.connection_id` -> `isp_connections(id)` CASCADE
- `devices.household_id` -> `households(id)` CASCADE
- `devices.warranty_id` -> `warranties(id)`
- `energy_readings.household_id` -> `households(id)` CASCADE
- `water_readings.household_id` -> `households(id)` CASCADE
- `domestic_employees.household_id` -> `households(id)` CASCADE
- `domestic_employees.contract_document_id` -> `documents(id)`
- `payslips.household_id` -> `households(id)` CASCADE
- `payslips.employee_id` -> `domestic_employees(id)` CASCADE
- `legal_documents.household_id` -> `households(id)` CASCADE
- `legal_documents.document_id` -> `documents(id)` CASCADE
- `price_watches.household_id` -> `households(id)` CASCADE
- `financial_goals.household_id` -> `households(id)` CASCADE
- `net_worth_snapshots.household_id` -> `households(id)` CASCADE
- `security_systems.household_id` -> `households(id)` CASCADE

## Unique Constraints

- `net_worth_snapshots(household_id, snapshot_date)`

## Total Public Tables: 50

### Breakdown by Phase
- **Phase 1 (Modules 1-7):** 35 tables (pre-existing)
- **Phase 3 (Modules 15-25):** 15 tables (this migration)

## Indexes Created: 17

All 15 new tables have RLS enabled and `household_id` indexes for tenant isolation.
