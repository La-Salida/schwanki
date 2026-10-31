# Schwanki App Store listing draft

Prepared October 31, 2026. **Do not submit for review or publish.**

- App Store Connect app: `6829151082`
- Bundle ID: `io.lasalida.schwanki`
- Registered bundle resource: see App Store Connect / Certificates, Identifiers & Profiles.
- SKU: `schwanki-ios-001`
- Primary locale: `en-US`
- Draft version: `1.0.0`
- Version ID: `19d67d91-3d64-4982-82aa-71cfc333ff34`
- App info ID: `2304f5d7-b750-40a1-9aca-e3731266d525`
- Category: Education
- Release setting: **Manual**
- Listing: [App Store Connect](https://appstoreconnect.apple.com/apps/6829151082/distribution)

## Contents

- `metadata/`: canonical ASC JSON, saved to the remote draft.
- `keyword-strategy.md`: placement, editorial scores, evidence and uncertainty.
- `research/competitors.json`: ten public US competitor snapshots, keyword coverage and aggregate public review samples; no copied descriptions or reviewer identities.
- `research/competitor-matrix.md`: reproducible keyword coverage, ratings, visual-asset inventory and review limitations.
- `research/visual-audit.md`: inspected icon/first-screenshot treatments for all ten competitors and the resulting art direction.
- `screenshots/index.html`: local four-slide gallery; `contact-sheet.png` is its visual overview.
- `screenshots/iphone-69/`: 1320 × 2868 opaque PNG listing assets, in upload order.
- `screenshots/raw/`: unedited captures of the real native sample app on an isolated simulator, 1206 × 2622. No private card/deck/account content.

All four screenshot uploads completed in the remote draft. Screenshot 2 uses the existing Japanese sample; screenshot 3 illustrates the supported input routes with iPhone/web labels and the actual native import entry. The CLI's `IPHONE_69` alias maps to Apple's `APP_IPHONE_67` screenshot set; the accepted dimensions were checked against its current size catalog. App Store Connect also visibly displayed all four images as existing assets.

The copy distinguishes the iPhone review/import companion from the web creation tools, describes offline access as cached content, and states the native import cap. The existing privacy page contains the published support address and is the current support URL; a dedicated support page would be clearer before launch.

## Local validation and reproduction

From the repository root, prefix commands with the RTK executable specified in AGENTS.md:

```sh
asc metadata validate --dir apps/ios/app-store/metadata
node apps/ios/app-store/screenshots/render.mjs
asc screenshots validate --path apps/ios/app-store/screenshots/iphone-69 --device-type IPHONE_69
node apps/ios/app-store/research/collect.mjs
```

Rendering uses existing branded assets, bundled Archivo fonts, the installed `playwright-core` and the local Google Chrome executable. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can override that path. It generates no new AI artwork and calls no paid generation service.

Research refreshes only public Apple data. Missing/empty review feeds remain explicit; rating/review snapshots are not representative demand or sentiment estimates. Metadata/schema and screenshot validation are sufficient for these listing-only changes; product code is unchanged.

## Privacy, age rating and review draft — October 31, 2026

The 16+ age override and full content questionnaire are saved. Review contact and instructions are saved; Sign-in required is enabled and the owner will enter credentials directly. No credentials are stored in this repository.

App Privacy has all eight data types fully configured as linked to the user, for App Functionality, without tracking. The product-page preview was verified after the final save. The draft remains unpublished. Do not Publish or submit for review. See `privacy/audit.md`, `privacy/declaration.json`, `privacy/age-rating.json` and `review/README.md` for the evidence and precise handoff.

## Required before a future submission

These are release checks, not authorization to execute them in this listing task.

1. Produce a signed release build and align the native version with draft `1.0.0` (source is currently `0.1.0`). Verify Files import with real media and history on a test account, including the hosted atomic import RPC/migration that earlier setup docs mark pending. Verify offline review/reconnect and physical-device audio. This draft does not certify those flows.
2. Assess Google-only account login against guideline 4.8 and implement a qualifying alternative or substantiate an applicable exception. Check the companion/web credit model and external links against the applicable storefront rules. Do not assume an exception.
3. Re-audit the completed draft privacy labels against the final binary; age-rating questionnaire and 16+ override are saved. Confirm content rights from actual behavior. The current public privacy policy describes browser storage; review native Keychain/SQLite, local reminder and media-cache disclosures. Resolve the native `hello@schwankiapp.com` vs published `hello@elsueno.xyz` support address difference. The evidence-based labels remain an unpublished draft.
4. Decide pricing and territories, enter the dedicated reviewer credentials (contact and instructions are saved), confirm imported/generated-media rights and final screenshot accuracy against the release build. The third slide shows the real import entry, not proof of a completed hosted import. Recheck the support page and privacy/terms links.

No release binary was uploaded or selected. No App Review submission was created. The draft remains editable.
