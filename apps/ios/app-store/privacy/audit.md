# iPhone privacy and age-rating audit

Audited October 31, 2026 against native source at `ba2a07b`. This is a draft for the current iPhone companion. Reconcile the final release binary, SDKs, and backend processors before publishing; concurrent RevenueCat/analytics work was outside this snapshot. No App Privacy publication or App Review submission is authorized by this record.

## Data inventory

All eight declared types use **App Functionality**, are **linked to the user**, and are **not used for tracking**.

| Apple type | Actual flow | Source evidence |
|---|---|---|
| Name; Email Address; User ID | Google/Supabase account identity and authentication | `src/lib/backend.ts` |
| Other User Content | Private deck/card text, examples, language and import content uploaded to the account | `src/lib/importer.ts` |
| Photos or Videos | Imported deck images uploaded to private storage; the category name does not imply video capture | `src/lib/importer.ts`, `media.ts` |
| Audio Data | Imported deck audio uploaded to private storage; no microphone recording | `src/lib/importer.ts`, `media.ts`, `app.json` |
| Customer Support | Optional user-initiated email support request; conservatively disclosed rather than relying on the optional-disclosure exception | `src/screens/Settings.tsx` |
| Product Interaction | Card ratings, timestamps, elapsed review time, scheduling state and imported review history for review/sync | `src/lib/useLibrary.ts`, `sync.ts`, `importer.ts` |

Local-only data: SecureStore authentication/session material, SQLite card cache and pending review queue (events later sync), cached media, preferences and local reminder scheduling. There is no remote push token registration in this snapshot. `app.json` disables microphone recording and remote notifications. No advertising, tracking/IDFA, analytics or crash-reporting SDK was present in the audited native package. No location, contacts or camera capture permission is used. Server request/security logging and final third-party SDK behavior must be checked against the shipped configuration; no unverified retention or anonymization promise is made here.

Private user decks are not broadly distributed. The age-rating questionnaire therefore answers user-generated content **false** under Apple's broad-distribution definition, while the privacy label correctly declares private user content. Website handoffs use fixed destinations in the system browser; there is no unrestricted embedded browsing or messaging/social network.

## Age rating

Questionnaire content frequencies are NONE and feature flags are false for the audited native experience. No Kids category is selected. A **SIXTEEN_PLUS** override is saved because the existing terms require age 16 in the EU/UK (13 elsewhere). Apple says an EULA minimum above the calculated content rating requires an override and that the override applies across regions. The higher rating is an eligibility choice, not a claim of mature content.

## Privacy policy follow-up before release

The saved policy URL is `https://schwankiapp.com/privacy`. Its existing browser-focused text should be expanded to explain native Keychain/SecureStore, SQLite/offline pending reviews and media caches, system Files imports and cloud media sync, and optional local reminders without remote push tokens. Align the native support email with the published working address. This task does not deploy a revised policy or change account access. Re-audit purchases, identifiers and diagnostics if RevenueCat or analytics is added before release.

## Apple sources

- https://developer.apple.com/app-store/app-privacy-details/
- https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions/
- https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/
- https://developer.apple.com/app-store/review/guidelines/

Definitions were checked on October 31, 2026. A draft label and a completed questionnaire do not certify the final release build.
