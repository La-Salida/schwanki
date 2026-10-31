# RevenueCat mobile credit setup

Schwanki sells the same four one-time credit packs on iPhone as on the web.
RevenueCat owns the App Store purchase flow and purchase reporting. The existing
Supabase credit ledger remains the shared spendable balance. No subscription or
access entitlement is needed for consumable credits. Superwall is not installed
in this native checkout; this implementation uses a native credit-pack sheet.

## Configured resources — October 31, 2026

- RevenueCat project: `proj51cd6309` (Schwanki).
- iOS app: `app6b277aa8f4`; bundle ID `io.lasalida.schwanki`.
- App Store Connect app: `6829151082`.
- Current offering: `credits` (`ofrng9df0ebea01`).
- Webhook: `whintgr7a2c2ead5d`, scoped to the iOS app and production
  non-renewing purchases, cancellations/refunds, and refund reversals.
- Saved Apple In-App Purchase and App Store Connect credentials were reused
  within RevenueCat and both passed its credential validation.

| Pack | Credits | US base price | Product ID suffix | Apple IAP ID |
| --- | ---: | ---: | --- | --- |
| Mini | 20 | $1 | `mini` | `6829160146` |
| Starter | 100 | $5 | `starter` | `6829160362` |
| Plus | 500 | $20 | `plus` | `6829160242` |
| Pro | 1,500 | $50 | `pro` | `6829160409` |

All product IDs begin `io.lasalida.schwanki.credits.`. All four are consumables,
have verified US prices and English localizations, and map to matching RevenueCat
packages. They remain App Store drafts; review screenshots, availability/review
readiness and Apple approval must be completed before release. No products were
submitted and no app release was uploaded as part of this integration.

## App behavior

`apps/ios/src/lib/purchases.ts` configures the SDK once after authentication has
resolved, with the stable Supabase UUID when signed in. Auth changes and purchases
are serialized, including logout. Native SDK 10.16.0 is pinned because SDK 11.0.0's
PurchasesHybridCommon 20.1.0 pod could not be resolved by CocoaPods during setup.
The optional `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` overrides the checked-in public
App Store SDK key. Never put RevenueCat secret API keys in the app or public env.

Settings → AI credits shows the server's shared balance and localized App Store
prices. It checks the authenticated server's `native-status` before loading
products and again immediately before opening Apple's purchase sheet. Unavailable
fulfillment disables purchases. Cancellations are silent. Successful checkout
does not mint local credits: the screen explains delayed fulfillment and offers
balance refresh. Consumed packs are not represented as restorable subscriptions.

The free sample, importing and reviewing remain available when billing fails.
Web preview does not initialize the native SDK. No Android billing is configured.

## Server fulfillment

`revenuecat-webhook` authenticates the exact `Authorization: Bearer <secret>`
header configured in RevenueCat. A missing server secret fails closed. It accepts
only the configured app, production App Store events, known product IDs, UUID
account IDs and bounded integer quantities; sandbox events never change the
production ledger. The client cannot choose credit quantities or credit an account.

`20261031090000_revenuecat_credit_purchases.sql` adds a canonical store transaction
table and the service-only `apply_revenuecat_purchase` RPC. A transaction has one
owner, rows lock during fulfillment, and ledger changes commit atomically with its
state. Redeliveries cannot mint credits again. Refunds remove their granted credits;
reversals restore them. Older state changes cannot undo newer ones. Spent refunded
credits can leave a negative balance; subsequent purchases offset that balance.
User deletion cascades through the store transaction table.

Stripe checkout stays separate and continues to work. The web's existing receipt
history lists Stripe purchases; App Store purchase documents live with Apple.

## Activation — production approval required

The webhook destination is registered, but its Authorization header and backend
secret still need to be configured. Production schema/functions have not been
deployed. `REVENUECAT_PURCHASES_ENABLED` defaults to disabled.

1. Review the pending migration list and apply only approved migrations. Do not
   blindly apply unrelated pending migrations. Use the commands in `RUNBOOK.md`.
2. Generate a dedicated random webhook secret. Configure it as
   `REVENUECAT_WEBHOOK_SECRET` on Supabase and the RevenueCat webhook's Authorization
   header as `Bearer <secret>`. Store secrets only in ignored files or secret
   managers. Keep `REVENUECAT_PURCHASES_ENABLED=false` during verification.
3. Deploy `revenuecat-webhook` and `credits` with the checked-in import map. Verify
   unauthorized deliveries fail and authenticated events reach the RPC. Use local
   or staging data for test grants; do not fabricate a production purchase.
4. Complete Apple product readiness and a sandbox purchase/cancellation exercise
   against an isolated staging ledger. The production webhook deliberately ignores
   sandbox; agree on an isolated review/test-account strategy before App Review.
   Update App Store privacy declarations and the privacy policy for RevenueCat
   before releasing a build that includes this integration.
5. After verified production delivery and Apple readiness, set
   `REVENUECAT_PURCHASES_ENABLED=true`. Build/release the new native binary
   separately; adding this SDK requires a native build.

## Verification limits

Unit tests cover identity changes, stale users, disabled fulfillment, cancellations,
and store errors. Webhook tests cover authentication, environment/app/store scope,
malformed payloads, quantity mapping and database retries. PGlite tests exercise
real PostgreSQL transaction rollback, duplicate delivery, refunds/reversals, owner
isolation and RPC permissions. PGlite does not prove multi-connection concurrency;
the SQL uses PostgreSQL conflict handling and row locks, which also need a local
Supabase concurrency check before enabling purchases.

App Store sandbox checkout, production delivery and signed-device release are
separate acceptance checks. Passing a Hermes export alone is not an Xcode build.
