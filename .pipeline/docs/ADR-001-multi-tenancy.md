# ADR-001: Multi-Tenancy Strategy — Shared Supabase with RLS

**Status:** Accepted  
**Date:** 2026-03-28  
**Author:** Docs

---

## Context

HouseholdOS is a SaaS platform serving multiple households on shared infrastructure. Each household holds sensitive financial documents, bank statements, insurance policies, and personal data covered by POPIA. Tenant isolation is a hard requirement — one household must never access another's data under any circumstances.

Three common multi-tenancy patterns were considered: dedicated database instances per tenant, schema-per-tenant within a shared cluster, and shared tables with Row Level Security (RLS). The choice directly impacts operational complexity, cost structure, onboarding speed, and the ability to run analytics and cross-household features in future.

At launch, HouseholdOS targets a consumer SaaS model with potentially thousands of households on the platform. Per-tenant database infrastructure at that scale is economically prohibitive without significant revenue. The platform needs a model that is safe from day one, affordable to operate, and upgradeable as the business grows.

---

## Decision

**Shared Supabase PostgreSQL instance with Row Level Security enforced on every table.**

Every table in the schema carries a `household_id` UUID foreign key. RLS policies are enabled at the database level and enforced by Supabase's PostgREST layer, ensuring all queries — regardless of source — are automatically scoped to the authenticated household. No application-layer filtering is trusted as the sole isolation mechanism.

The `household_id` is derived from the authenticated user's JWT via `auth.uid()` → `household_members` lookup, not passed as a client parameter. This prevents spoofing.

---

## Alternatives Considered

- **Dedicated Supabase project per household:** Strongest isolation, but requires provisioning automation, multiplies infrastructure cost, and makes cross-household operations (platform analytics, schema migrations) extremely complex. Viable at enterprise tier — designed as a future upgrade path.
- **Schema-per-tenant:** Moderate isolation, single cluster. Supabase does not natively support schema-per-tenant in PostgREST without significant custom configuration. Ruled out due to tooling friction.
- **Application-layer filtering only:** Rejected. Relies on developer discipline, not database enforcement. A single missing `WHERE household_id = ?` clause becomes a data breach.

---

## Consequences

**Positive:**
- Zero additional infrastructure per household — onboarding is instant
- RLS enforced at the database layer — defence in depth
- Supabase Realtime, Storage, and Auth all integrate natively with this model
- Single schema to migrate, single backup strategy, single monitoring target

**Negative:**
- RLS policies add complexity — every table needs a correct policy; incorrect policies are silent data leaks
- Large households sharing compute with others introduces noisy-neighbour risk
- Future migration to dedicated instances requires data extraction tooling

**Mitigations:**
- RLS policies are audited in the security review wave before each deployment
- Policy tests are included in the QA suite — queries are executed as different household users to verify isolation
- Architecture is designed so `household_id` columns and naming are consistent, making future migration scripts straightforward
