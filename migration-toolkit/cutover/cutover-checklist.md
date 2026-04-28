# EstiClose V2 → V4 Cutover Runbook

Minute-by-minute migration playbook for switching production from V2 to V4.

---

## T-24h: Preflight

| # | Check | Command / Action | Pass Criteria |
|---|-------|-----------------|---------------|
| 1 | V4 branch pushed | `git log origin/wip/v4-stripe-multitenant --oneline -3` | Branch exists on remote |
| 2 | Migration toolkit tested | `node migrate-v2-to-v4.cjs staging.db --dry-run` | 0 errors |
| 3 | Integrity check passes | `node integrity-check.cjs staging.db` | 0 FAILs |
| 4 | V4 readiness validator | `node validate-v4-readiness.cjs /path/to/v4` | All PASS or WARN only |
| 5 | Stripe test mode verified | Create test subscription → webhook fires → usage price attaches | Logs confirm |
| 6 | DNS TTL lowered | Set esticlose.com A/CNAME TTL to 60s | Verify via `dig esticlose.com` |
| 7 | Backup V2 database | `node export-rollback.cjs prod-v2.db --export` | Export folder created |
| 8 | Notify stakeholders | "Maintenance window: [time] — 30 min estimated" | Acknowledged |

### Go / No-Go Gate 1

All 8 preflight checks must pass. Any FAIL → postpone.

---

## T-0: Cutover Execution

### Phase A: Freeze & Backup (5 min)

| Min | Action | Detail |
|-----|--------|--------|
| 0:00 | Stop V2 server | Render dashboard → Suspend service, or `render services suspend` |
| 0:01 | Download V2 database | `scp` or Render shell: copy `sqlite.db` locally |
| 0:02 | Create final backup | `node export-rollback.cjs v2-prod.db --export` |
| 0:03 | Verify backup | Check export folder has all tables + manifest.json |
| 0:04 | Snapshot confirmation | Record row counts: estimates, companies, users |

### Phase B: Migrate Database (5 min)

| Min | Action | Detail |
|-----|--------|--------|
| 0:05 | Dry-run migration | `node migrate-v2-to-v4.cjs v2-prod.db --dry-run` |
| 0:06 | Review dry-run output | Confirm expected changes, no errors |
| 0:07 | Apply migration | `node migrate-v2-to-v4.cjs v2-prod.db --apply` |
| 0:08 | Run integrity check | `node integrity-check.cjs v2-prod.db` |
| 0:09 | Confirm 0 FAILs | If any FAIL → ROLLBACK (see below) |

### Go / No-Go Gate 2

Integrity check must show 0 FAILs. WARNs acceptable (admin users, Stripe config).

### Phase C: Deploy V4 (10 min)

| Min | Action | Detail |
|-----|--------|--------|
| 0:10 | Upload migrated DB | Place `sqlite.db` in V4 deployment directory |
| 0:11 | Set environment variables | All keys from `.env` (see validate-v4-readiness.cjs) |
| 0:12 | Deploy V4 code | `git push` to Render, or manual deploy from `wip/v4-stripe-multitenant` |
| 0:13 | Wait for build | Monitor Render build log for success |
| 0:15 | Verify server starts | Check logs for `Server running on` + `[Stripe-Webhook] Registered` |
| 0:16 | Configure Stripe webhook | Dashboard → set endpoint to `https://esticlose.com/api/webhook/stripe` |
| 0:17 | Test webhook delivery | `stripe trigger customer.subscription.updated` or manual test |

### Phase D: DNS Switch (5 min)

| Min | Action | Detail |
|-----|--------|--------|
| 0:18 | Update DNS | Point esticlose.com to V4 Render service |
| 0:19 | Verify propagation | `curl -s https://esticlose.com/api/webhook/stripe -X POST` → `Missing stripe-signature` |
| 0:20 | SSL certificate | Verify HTTPS works (Render auto-provisions) |

### Phase E: Smoke Test (5 min)

| Min | Action | Detail |
|-----|--------|--------|
| 0:21 | Admin login | Navigate to esticlose.com → login with admin creds |
| 0:22 | Create test estimate | NewEstimate → fill form → submit |
| 0:23 | View public estimate | Open generated estimate link in incognito |
| 0:24 | Check dashboard | Verify estimate appears in Dashboard + AllJobs |
| 0:25 | Verify Stripe billing | Check usage meter event in Stripe Dashboard (if past free tier) |

### Go / No-Go Gate 3

Smoke tests must all pass. If any critical failure → ROLLBACK.

---

## T+5: Confirm Live

| Min | Action |
|-----|--------|
| 0:26 | Restore DNS TTL to 3600s |
| 0:27 | Notify stakeholders: "Migration complete" |
| 0:28 | Monitor logs for 30 min for unexpected errors |
| 0:30 | Archive V2 deployment (do not delete yet) |

---

## Rollback Triggers

Immediately rollback if:

- Integrity check shows any FAIL after migration
- V4 server fails to start
- Database corruption detected
- Stripe webhook endpoint unreachable after deploy
- Admin login broken
- Estimate creation throws errors

---

## Rollback Procedure (any point)

| Step | Action | Time |
|------|--------|------|
| 1 | Stop V4 server | 0:00 |
| 2 | Restore V2 database from backup | `cp sqlite.db.backup-v2-* sqlite.db` |
| 3 | Re-deploy V2 code | Resume suspended V2 Render service |
| 4 | Revert DNS to V2 | Update A/CNAME record |
| 5 | Verify V2 is live | `curl https://esticlose.com` |
| 6 | Notify stakeholders | "Rollback complete — investigating" |

**Total rollback time: ~5 minutes**

---

## Timeline Summary

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Freeze & Backup | 5 min | 0:05 |
| Migrate Database | 5 min | 0:10 |
| Deploy V4 | 10 min | 0:20 |
| DNS Switch | 5 min | 0:25 |
| Smoke Test | 5 min | 0:30 |
| **Total** | **30 min** | |
