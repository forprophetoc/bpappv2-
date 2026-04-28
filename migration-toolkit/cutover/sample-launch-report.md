# EstiClose V4 — Sample Launch Report

**Date:** 2026-04-28
**Operator:** [Name]
**Duration:** 27 minutes
**Result:** SUCCESS

---

## Preflight (T-24h)

| Check | Result |
|-------|--------|
| V4 branch pushed | PASS — `wip/v4-stripe-multitenant` on origin |
| Migration toolkit dry-run | PASS — 16 changes planned, 0 errors |
| Integrity check (staging) | PASS — 50 PASS, 2 WARN, 0 FAIL |
| V4 readiness validator | PASS — all critical vars present |
| Stripe test mode | PASS — webhook fires, usage price attaches |
| DNS TTL lowered | PASS — TTL set to 60s, verified via dig |
| V2 database backup | PASS — export folder created with 6 tables |
| Stakeholders notified | PASS — maintenance window acknowledged |

**Gate 1: GO**

---

## Cutover Execution

### Phase A: Freeze & Backup

| Time | Action | Result |
|------|--------|--------|
| 10:00 | V2 server suspended | Done |
| 10:01 | V2 database downloaded | 0.05 MB sqlite.db |
| 10:02 | Final backup created | `esticlose-export-2026-04-28T10-02-15-000Z/` |
| 10:03 | Row counts verified | estimates: 6, users: 0, companies: 0 |

### Phase B: Database Migration

| Time | Action | Result |
|------|--------|--------|
| 10:05 | Dry-run | 16 changes planned |
| 10:06 | Applied migration | 20 changes applied |
| 10:07 | Integrity check | 50 PASS, 2 WARN, 0 FAIL |

```
Post-migration state:
  Tables: 5 (estimates, users, companies, admin_users, usage_events)
  Estimates: 6 rows, 41 columns
  ghlContactId: preserved
  insertedAt: backfilled from createdAt
  Orphaned estimates: 0 (all assigned to bathtub-pros)
  Company: Bathtub Pros (id:1, slug:bathtub-pros)
```

**Gate 2: GO**

### Phase C: Deploy V4

| Time | Action | Result |
|------|--------|--------|
| 10:10 | Database uploaded | sqlite.db placed in V4 root |
| 10:11 | Env vars configured | 10 variables set |
| 10:12 | Deploy triggered | Render build started |
| 10:15 | Build complete | `npm run build` succeeded |
| 10:16 | Server started | `Server running on http://0.0.0.0:3000/` |
| 10:16 | Webhook registered | `[Stripe-Webhook] Registered POST /api/webhook/stripe` |
| 10:17 | Stripe endpoint updated | Dashboard → endpoint set to production URL |

### Phase D: DNS Switch

| Time | Action | Result |
|------|--------|--------|
| 10:18 | DNS updated | CNAME → v4-service.onrender.com |
| 10:19 | Propagation verified | `curl` returns 200 |
| 10:20 | SSL verified | Valid certificate for esticlose.com |

### Phase E: Smoke Tests

| Test | Result |
|------|--------|
| Server health | PASS — page loads |
| Admin login | PASS — dashboard visible |
| Dashboard data | PASS — 6 estimates visible |
| Create estimate | PASS — "Smoke Test" estimate created |
| Image pipeline | PASS — Gemini generated after image |
| Public estimate page | PASS — renders with BP branding |
| View tracking | PASS — status updated to "Estimate Sent" |
| Stripe webhook | PASS — 200 response on test event |
| Metering | PASS — logged "within free tier" (count: 7) |
| Upsells | PASS — Gold + sink prices calculate correctly |

**Gate 3: GO**

---

## Post-Cutover

| Time | Action |
|------|--------|
| 10:27 | DNS TTL restored to 3600s |
| 10:27 | Stakeholders notified: "V4 live" |
| 10:30 | Monitoring — no errors in 30 min window |
| 11:00 | V2 service archived (not deleted) |

---

## Final State

| Metric | Value |
|--------|-------|
| Downtime | ~18 minutes (10:00 → 10:18) |
| Data loss | None |
| Rollback needed | No |
| Estimates migrated | 6 |
| ghlContactId preserved | Yes |
| Billing active | Ready (Stripe mapping pending first subscription) |
| V2 backup | Archived, restorable |

---

**Status: CUTOVER COMPLETE**
