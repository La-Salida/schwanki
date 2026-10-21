# Account, credits, and billing — October 21, 2026

## Reference study

Studied 20 Appllama account/settings screens as a local reference board. Relevant references:

| App | Screen ID | Pattern adopted |
| --- | --- | --- |
| Lightroom | 878783582/oth_yag5g | Signed-in name/email grouped with credit balance and an explicit add-credits action |
| Krea | 6742134132/oth_r8kz7 | Profile identity followed by account/billing rows; visible remaining credits; sign out separated |
| Simply Wall St | 1075614972/oth_z0woy | Compact account menu with identity first, billing/settings links, and logout last |
| Fits | 6447482321/oth_5c8up | Short account sheet with email and direct logout, without a long settings detour |
| Bunpo | 1279720052/oth_16b5i | Straightforward labeled account rows and a clear logout action |

The other screens studied were AMBOSS, Noom, Letterboxd, pump.fun, WNBA, Reports, Justin Guitar, Fits settings, CellarTracker, Regrid, EF Hello, Transkriptor, 1 Second Everyday, Routine Planner, and Bible Gateway. Reference images were viewed in the browser, not copied into the product. The temporary reference board was removed.

## Product structure

Navigation keeps the goose and approved neutral/orange palette. The credit balance and Buy credits CTA remain visible on every normal authenticated route, including onboarding. Account is a native disclosure with an initials avatar, name/email, account, billing/invoices, AI settings, and logout. Escape returns focus to its trigger; outside pointer and route changes dismiss it. Phone layout retains readable navigation and 44px controls.

`/account` shows provider-derived name, email, sign-in method, billing/settings links and local-browser logout. Queued reviews are flushed before logout. Unsynced reviews block logout with a specific recovery instruction; cached cards are cleared before ending the session. This avoids silently discarding offline work or leaving cached cards for the next login.

`/billing` shows actual credit balance, existing one-time packs, and paginated successful purchase history. No subscription is invented. Receipt, hosted invoice, and invoice-PDF links appear only when Stripe supplies them. Loading/error/unconfigured/empty and delayed payment confirmation are explicit. Query parameters never prove a payment succeeded.

## Data and API

The account provider shares balance across routes. It refreshes after generation, on focus/online/visibility, and every minute while visible. Late responses cannot overwrite a newer balance. Checkout returns to billing and refreshes balance/history while the webhook settles.

The existing JWT-authenticated `credits` Edge Function adds `history`. It selects positive ledger purchases for the verified user, 10 at a time. No user/customer/session identifier comes from the client. Stripe session ownership is checked again before exposing payment documents; only HTTPS Stripe document URLs are returned. Document lookup failure preserves ledger purchase rows with an unavailable state. New checkouts request a Stripe invoice; older purchases can remain receipt-only. No migration is required.

## Verification and release

Workspace tests and typechecks, web build/lint, and Deno tests/checks cover these changes. Browser QA used actual components with mocked identity, credits, and purchase history. Account/billing/settings fit at 320×568, 390×844, 768×1024, and 1280×720 without horizontal overflow. Menu identity/links, route dismissal, credit-pack scroll target, and receipt/invoice rows were inspected. Logout and offline-cache behavior are covered by tests; no real account was logged out and no real purchase was made.

The updated `credits` Edge Function needs a separate production deployment to enable history and new invoices. The production deployment requires explicit approval under the user's standing instructions. Existing payments remain compatible until that release; the new UI reports unavailable history with retry if the old function is still deployed.

Next separate scope: account export/deletion and help/support/legal links.
