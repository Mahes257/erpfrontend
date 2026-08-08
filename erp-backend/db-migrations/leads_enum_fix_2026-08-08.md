# Leads enum root-cause fix - 2026-08-08

## Problem
`GET /v1/leads` (and `/clients`, `/followups`, `/contacts`) returned **HTTP 500**
`No enum constant com.vishatech.erp.entity.LeadStatus.DELETED`.

The `leads` table (MySQL `erp_db`) contained rows written by an older CRM whose
enum values no longer exist in the current Java enums:

- `status = 'DELETED'` (8 rows) - current `LeadStatus` is `ACTIVE/ARCHIVED/INACTIVE`
- `stage = 'HIGH'/'MEDIUM'/'LOW'` (33 rows) - current `LeadStage` is
  `HOT/WARM/COLD/NEW/QUALIFIED/NEGOTIATION/WON/LOST`

The columns' MySQL enum definitions were also stale: they included the legacy
values but **not** the current `HOT/WARM/COLD`, so even the new frontend's stage
writes (High->HOT via `mapStageToBackend`) were rejected (`Data truncated`).

## Root cause
`@Enumerated(EnumType.STRING)` on `Lead.stage` / `Lead.status` cannot deserialize
rows whose stored string is not a Java enum constant -> Hibernate throws on read ->
500 on any query whose result page touches such a row.

## Fix applied (database only - no Java / frontend changes)

```sql
-- 1. Widen stage column to a superset (old + new values) so remaps can be written
ALTER TABLE leads MODIFY COLUMN stage
  enum('COLD','HIGH','HOT','LOST','LOW','MEDIUM','NEGOTIATION','NEW','QUALIFIED','WARM','WON') NOT NULL;

-- 2. Remap legacy values to the current Java-enum vocabulary
--    (semantic mapping mirrors leadHelpers.js: High<->HOT, Medium<->WARM, Low<->COLD)
UPDATE leads SET status = 'ARCHIVED' WHERE status = 'DELETED';  -- 8 rows
UPDATE leads SET stage  = 'HOT'      WHERE stage  = 'HIGH';     -- 14 rows
UPDATE leads SET stage  = 'WARM'     WHERE stage  = 'MEDIUM';   -- 17 rows
UPDATE leads SET stage  = 'COLD'     WHERE stage  = 'LOW';      -- 2 rows

-- 3. Narrow columns to exactly match the Java enums
--    (ordering matches Hibernate's expected DDL -> zero 'Data truncated' warnings on startup)
ALTER TABLE leads MODIFY COLUMN stage
  enum('COLD','HOT','LOST','NEGOTIATION','NEW','QUALIFIED','WARM','WON') NOT NULL;
ALTER TABLE leads MODIFY COLUMN status
  enum('ACTIVE','ARCHIVED','INACTIVE') NOT NULL;
```

## Backup
Pre-fix table dump: `erp-backend/db-migrations/leads_table_backup_2026-08-08.sql`

## Verification
- `/v1/leads?page=0&size=1000` -> 200 (61 leads)
- `stage=QUALIFIED` -> 200 (3) - `stage=WON` -> 200 (2) - `stage=LOST` -> 200 (0)
- `stage=HOT/WARM/COLD` -> 200 (14/17/2)
- `/v1/followups?page=0&size=200` -> 200 (59) - `/v1/clients?page=0&size=10` -> 200 (2) - `/v1/contacts` -> 200 (61)
- POST `/v1/leads` with `pipelineStage=HOT` -> 201 (stage "Hot"), GET 200, PUT edit -> 200, DELETE -> 200
- Backend restart: `Started ErpApplication`, **0 "Data truncated" warnings** (previously 2)

## Notes
- `clients`, `lead_follow_ups`, `cpr_records` tables are orphaned (no Java entity
  maps them); left untouched.
- `cprs` / `cost_workouts` `DELETED` values are valid (their Java enums include
  `DELETED`); untouched.
