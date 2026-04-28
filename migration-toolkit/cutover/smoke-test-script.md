# EstiClose V4 — Post-Launch Smoke Tests

Run these in order immediately after cutover. Stop and rollback on any critical failure.

---

## Test 1: Server Health

**Action:** Open `https://esticlose.com` in browser

**Expected:** Page loads without errors. No blank screen.

**If fails:** Server didn't start or DNS not propagated. Check Render logs.

---

## Test 2: Admin Login

**Action:**
1. Navigate to `https://esticlose.com`
2. Enter admin email + password
3. Click Login

**Expected:** Redirected to Dashboard with company name visible in sidebar.

**If fails:** Check admin_users table has a row, JWT_SECRET is set, cookies are being set.

---

## Test 3: Dashboard Data

**Action:** After login, check Dashboard page.

**Expected:**
- Metric cards show counts (New Leads, Estimates Sent, Booked, Completed)
- Recent jobs list shows existing estimates (migrated from V2)
- Company name in sidebar matches config

**If fails:** companyId assignment may be wrong. Run `integrity-check.cjs`.

---

## Test 4: Create New Estimate

**Action:**
1. Click "New Estimate" in sidebar
2. Fill in:
   - Name: "Smoke Test"
   - Service: Tub
   - Price: $299
   - Upload any photo as "Before" image
3. Click Create / Generate

**Expected:**
- Image pipeline runs (loading indicator)
- After image generated, estimate link appears
- Link is copyable

**If fails:** Check GEMINI_API_KEY is set. Check server logs for image pipeline errors.

---

## Test 5: Image Pipeline

**Action:** During Test 4, monitor server logs.

**Expected logs:**
```
[estimates.create] Pipeline starting for serviceType: bathtub
```
Followed by successful image generation and S3 upload (if configured).

**If fails:** Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME.

---

## Test 6: Public Estimate Page

**Action:**
1. Copy the estimate link from Test 4
2. Open in incognito/private browser window

**Expected:**
- Estimate page loads with customer name greeting
- Before/After images display
- Standard and Gold package cards visible
- Price shows correctly
- "Book" button scrolls to calendar embed
- Company logo and phone number in header

**If fails:** Check config/bathtub-pros.ts has valid bookingLink and logoUrl.

---

## Test 7: Estimate Viewed Tracking

**Action:** After viewing the public estimate page, go back to admin Dashboard.

**Expected:** The estimate status changed from "New Lead" to "Estimate Sent".

**If fails:** Check markEstimateViewed endpoint in routers.ts.

---

## Test 8: Tenant Routing

**Action:** Create estimates for two different company slugs (if multi-tenant).

**Expected:** Each estimate page loads the correct company's config (logo, colors, copy, phone number).

**Single tenant (Bathtub Pros only):** Skip this test.

---

## Test 9: Stripe Webhook

**Action:**
1. Open Stripe Dashboard → Developers → Webhooks
2. Find the endpoint for `https://esticlose.com/api/webhook/stripe`
3. Click "Send test webhook" → select `customer.subscription.updated`

**Expected:** Stripe shows `200` response. Server logs show:
```
[Stripe-Webhook] Received customer.subscription.updated (evt_...)
```

**If fails:** Check STRIPE_WEBHOOK_SECRET matches the endpoint's signing secret.

---

## Test 10: Stripe Meter Event

**Action:** If company has 100+ estimates in current billing period, create one more estimate.

**Expected server logs:**
```
[Usage] Estimate #101 "slug-name" exceeds free tier — reporting to Stripe
[Stripe-Usage] Reported meter event for "slug-name"
```

**If under 100 estimates:** Expected log:
```
[Usage] Estimate #N "slug-name" — within free tier or already reported
```

**If fails:** Check company has stripeSubscriptionItemId populated. Run `integrity-check.cjs`.

---

## Test 11: Upsell Selection

**Action:** On public estimate page (Test 6):
1. Select Gold Package
2. Check Bathroom Sink upsell
3. Verify total updates

**Expected:** Running total at bottom updates correctly with each selection.

---

## Quick Summary Checklist

```
[ ] Server loads
[ ] Admin login works
[ ] Dashboard shows data
[ ] New estimate creates successfully
[ ] Image generation works
[ ] Public estimate page renders
[ ] View tracking updates status
[ ] Stripe webhook returns 200
[ ] Metering logs correctly
[ ] Upsells calculate correctly
```

**All pass → Cutover confirmed. Notify stakeholders.**

**Any critical fail → Rollback immediately. See cutover-checklist.md.**
