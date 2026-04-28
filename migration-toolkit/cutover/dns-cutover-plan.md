# EstiClose DNS Cutover Plan

## Current State

| Record | Value | TTL |
|--------|-------|-----|
| esticlose.com | Points to V2 Render service | 3600s (typical) |
| PUBLIC_URL env | `https://esticlose.com` | — |

## Pre-Cutover (T-24h)

### Step 1: Lower TTL

In your DNS provider (Cloudflare, Namecheap, Route53, etc.):

1. Find the A or CNAME record for `esticlose.com`
2. Change TTL from 3600 → **60 seconds**
3. Save and wait 1 hour for old TTL to expire

**Verify:**
```
dig esticlose.com +short
nslookup esticlose.com
```

Confirm the response shows your current V2 IP/CNAME and the TTL is now 60s.

### Step 2: Note Current Values

Record these for rollback:

```
Current record type: _____ (A or CNAME)
Current value:       _____ (IP or hostname)
Current TTL:         _____ (should now be 60)
```

## Cutover (T-0)

### Step 3: Get V4 Render Address

From Render Dashboard → V4 service → Settings:

```
Render hostname: _____.onrender.com
```

### Step 4: Update DNS Record

| Action | Detail |
|--------|--------|
| Record | `esticlose.com` |
| Type | CNAME (recommended) or A |
| Value | `your-v4-service.onrender.com` |
| TTL | 60 (keep low during cutover) |
| Proxy | OFF if using Render SSL, ON if using Cloudflare SSL |

### Step 5: Verify Propagation

Wait 1-2 minutes (TTL is 60s), then:

```
curl -s -o /dev/null -w "%{http_code}" https://esticlose.com
```

Expected: `200` (or `301`/`302` redirect if applicable)

```
curl -s -X POST https://esticlose.com/api/webhook/stripe \
  -H "Content-Type: application/json" -d '{}'
```

Expected: `{"error":"Missing stripe-signature header"}`

### Step 6: Verify SSL

```
curl -vI https://esticlose.com 2>&1 | grep "subject:"
```

Should show a valid certificate for `esticlose.com`.

## Post-Cutover (T+1h)

### Step 7: Restore TTL

Change TTL back to **3600** (1 hour) — standard production value.

## Rollback DNS

If V4 has issues, immediately revert:

| Action | Detail |
|--------|--------|
| Record | `esticlose.com` |
| Value | **(your noted V2 value from Step 2)** |
| TTL | 60 (keep low until stable) |

Propagation: ~60 seconds (because TTL was lowered).

After V2 is confirmed working, restore TTL to 3600.

## Render-Specific Notes

- Render auto-provisions SSL for custom domains
- After adding custom domain in Render Dashboard, it may take 2-5 min for SSL
- If using Cloudflare proxy (orange cloud), set SSL mode to "Full (Strict)"
- Render free tier spins down after 15 min inactivity — consider paid plan for production

## Estimate Link Impact

Existing estimate links use the format:
```
https://esticlose.com/estimate/{slug}
```

After DNS switch, these resolve to V4 automatically. No link rewriting needed — the slug-based routing is identical between V2 and V4.
