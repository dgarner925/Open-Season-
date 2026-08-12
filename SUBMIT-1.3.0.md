# 1.3.0 Submission Runbook (build 26)

Preconditions (all must be true before submitting):
- [ ] Build 26 tested on TestFlight: password reset round-trip works
- [ ] `openseason://reset-password` in Supabase Auth redirect allow-list
- [ ] RevenueCat webhook configured (RC_WEBHOOK_SECRET set both sides)
- [ ] Demo/review account flipped free (SQL below) so the reviewer sees the paywall
- [ ] RevenueCat offering `os_annual` is CURRENT (✓ badge)

## Demo account flip (run in Supabase SQL editor, email = the ASC review demo account)

```sql
update public.profiles set is_premium = false, grandfathered = false
where id = (select id from auth.users where email = 'dgarner925+review2@gmail.com');
```

## ASC steps

1. My Apps → Open Season → ⊕ next to "iOS App" → **1.3.0** → Create
2. What's New (below) → paste
3. Build section → ⊕ → select **1.3.0 (26)**
4. **In-App Purchases and Subscriptions** section → ⊕ → attach **os_annual**
   (this is new this release — the subscription reviews WITH the app)
5. App Review Information → keep demo credentials, REPLACE the notes with the
   review notes below
6. Pricing: DO NOT change the $4.99 price yet — that flips only after release
7. Add for Review → Submit

## What's New

```
Open Season is going free-to-browse! This update introduces Open Season Pro.

• Browse every state's season dates and draw deadlines — free
• Open Season Pro ($9.99/year): opener and deadline reminders, draw results
  alerts, hunting parties, application tracking, and preference points
• Forgot-password: reset your password right from the sign-in screen
• Everyone who bought the app keeps full access — forever. Thank you for
  being early.
```

## Review notes (replace existing notes; keep the demo credentials fields)

```
PRICING MODEL CHANGE IN THIS VERSION: the app is moving from paid-up-front
to free with an auto-renewable subscription (Open Season Pro, $9.99/year —
product os_annual, submitted with this version). The app price will be set
to free once this version is approved. All prior purchasers are grandfathered
into full access via their original App Store receipt and a server-side flag.

TESTING THE SUBSCRIPTION with the demo account above (it is a FREE-tier
account):
1. Sign in with the demo account. Onboarding and all browsing are free.
2. The "Open Season Pro" card on the Home screen — or changing any reminder
   toggle under Settings > Alerts, or "Hunt with your party" on any draw —
   opens the paywall.
3. The paywall shows the $9.99/year subscription (fetched live from App
   Store Connect) with purchase and Restore Purchases options, auto-renewal
   disclosure, Terms of Service and Privacy Policy links.
4. Purchasing in sandbox unlocks reminders, parties, application tracking,
   and points immediately.

Hunting Parties (shipped in 1.2, unchanged): create from any draw ("Hunt
with your party"), share the invite code; a second account can join via
Settings > Hunting parties > Join with a code.
```

## After approval

1. Release the version
2. ASC → Pricing and Availability → set price to **Free ($0)**
3. Run `supabase/FLIP-DAY.sql` (dashboard SQL editor) — within minutes of step 2
4. Update marketing site from UPLOAD-TO-WEBSITE/ (freemium messaging)
5. Watch RevenueCat dashboard for the first real subscription + confirm the
   webhook fires (profiles.is_premium goes true for that user)
