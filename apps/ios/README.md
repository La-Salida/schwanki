# Schwanki for iPhone

Native Expo / React Native companion, under development. The approved flow is
**bring your Anki deck → review your words**. Notes, source connections, Inbox,
editing and AI creation stay on [the web](https://schwankiapp.com).

For the first physical iPhone installation, follow
[Mac and iPhone setup](../../docs/ios-mac-setup.md). The Mac source download
includes the same public hosted backend configuration as the published web app
in the ignored `apps/ios/.env.local` file.

## Run

Use Node 24 and the repository's pinned pnpm 9.15.0 through Corepack:

```sh
corepack pnpm install --frozen-lockfile
cp apps/ios/.env.example apps/ios/.env
# Fill in the two public Supabase values, or leave them unset for the sample feed.
corepack pnpm --filter @schwanki/ios dev
```

On a Mac with Xcode and its command line tools installed, create and run the
development build:

```sh
corepack pnpm --filter @schwanki/ios ios
```

Use a development build for OAuth and native acceptance testing. The app uses
Expo SDK 58, React Native 0.88 and React 19.3. `eas.json` has simulator, development-device,
internal-device and production build profiles; no EAS project, signing account,
device provisioning or App Store release has been created.

The three bundled sample cards work without credentials and never create real
reviews. `corepack pnpm --filter @schwanki/ios web` previews the shared screens in
a browser. This does not validate iOS Keychain, Files, audio, notifications,
SQLite or the native sign-in callback. Authenticated SQLite on web also requires
cross-origin isolation headers; the browser preview is intended for the sample.

## Connect a development backend

1. Set `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env`. The existing anon key is also
   accepted as `EXPO_PUBLIC_SUPABASE_ANON_KEY`. These are public client values;
   never embed a service-role key.
2. Use the same Supabase project and existing Google provider configuration as
   the web app. Add **`schwanki://auth/callback`** to its allowed redirect URLs.
   This app requests identity scopes only, without Google Drive access.
3. Apply the repository migrations to a development/staging database before
   importing. In particular,
   `supabase/migrations/20261029100000_atomic_anki_import.sql` adds the new
   `import_anki_batch` RPC. It commits cards, FSRS state and imported history
   together and safely returns existing IDs on retry. Production was not changed.
4. Deploy/configure the existing `delete-account` Edge Function and existing
   media storage policies in that environment. The app reuses them.
5. Sign in on iPhone with a test account. Verify the same cards and reviews on
   the web, including a failed upload followed by retry.

## Included behavior

- Google sign-in, Keychain-backed session storage and account-scoped offline
  identity. Expired authentication keeps cached review available; syncing needs
  a valid session for the original account.
- Native Files import for `.apkg` and `.colpkg`: preview decks, pick the language,
  preserve schedules/history and copy existing images/audio. Pending imports
  retain a durable local file and checkpoints. Failed media can be retried.
- Shared classic/modern Anki parsing in `packages/anki`, used by web and native;
  native uses Expo SQLite instead of browser WASM.
- Illustrated feed with answer reveal, audio, highlighted examples and all four
  named FSRS ratings. Swipe up reveals, then up = Good, left = Again, right = Easy.
  Long answers scroll; rating buttons remain available. Missing media is optional.
- SQLite commits a rating, updated card and remaining session in one transaction
  before advancing. A FIFO outbox retries stable event IDs on reconnect,
  foregrounding and active-app refresh. Sign-out requires pending reviews to sync.
- Deck selection, device-local daily new-card limit, optional local reminder,
  Settings, web handoff, privacy/terms/help and account deletion.
- RevenueCat App Store credit packs in Settings → AI credits, using the shared
  account balance. Purchases stay disabled until server fulfillment and store
  readiness are verified; see [billing setup](../../docs/revenuecat-mobile.md).
- Tiny inline format icons; Preply chat and italki are explicitly Coming soon.
  The Preply label currently uses a generic chat icon pending an official mark.

## Deliberate limits

- Initial native imports are capped at **30 MB compressed**, **64 MB collection
  data** and **16 MB per media file**, with ZIP/Zstd expansion checks. These are
  conservative implementation bounds, not certified device memory limits.
  Larger imports go through the web app. Images/audio codecs still depend on iOS.
- One language per import. Suspended cards and notes without a word/meaning are
  skipped. This is a one-time transfer, with no sync back to Anki.
- The due cache fetches up to 500 cards per batch and preloads media gradually.
  Only downloaded cards/media are available offline. A capped response never
  claims the whole library is caught up.
- Sync reuses the existing atomic review RPC. Stable IDs prevent duplicate retry
  events; full reconciliation of simultaneous offline reviews on multiple devices
  is not added here.
- No native source connections, note ingestion, Inbox editing, AI generation,
  tab bar, stats dashboard, iPad layout or Android release.

## Verify

```sh
corepack pnpm -r --if-present typecheck
corepack pnpm --filter @schwanki/ios test
corepack pnpm --filter @schwanki/core test
corepack pnpm --filter @schwanki/web test
corepack pnpm --filter @schwanki/ios exec expo export --platform ios --output-dir dist-ios
corepack pnpm --filter @schwanki/ios exec expo export --platform web
```

For a repeatable shared-UI smoke run, serve `apps/ios/dist` on port 4173, then
run `corepack pnpm --filter @schwanki/ios test:ui`. Install Chromium with
`corepack pnpm --filter @schwanki/ios exec playwright install chromium`, or set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a local Chromium binary. `PREVIEW_URL` and
`SCREENSHOT_DIR` can override the default URL and `qa/output` capture directory.

Native tests run real SQLite transactions (Node 24's `node:sqlite`) and exercise
restart, failed writes, stale refreshes, account changes, duplicate retries and
authentication failures. Core tests execute the import RPC with PostgreSQL RLS
using PGlite; parser tests cover both browser and native SQL adapters.

For a native simulator smoke run, build the app with `ios`, keep Metro running,
and open the entry screen with the Expo developer menu dismissed. With `fb-idb`
and `idb_companion` installed, run from this directory:

```sh
SIMULATOR_UDID=<booted-device-uuid> corepack pnpm test:simulator
```

`IDB_BIN` and `IDB_COMPANION` can select an isolated CLI and an already running
companion. The check uses native accessibility to find visible controls, taps
and swipes the simulator, and saves JPEG captures plus a JSON report to
`qa/output/native`. It uses only sample cards and leaves account data untouched.
To check large text separately, set the simulator to Accessibility Large,
restart the app and open a sample card, then run the same command with
`NATIVE_QA_MODE=large-text`. This checks all rating bounds and captures the feed.
Restore the simulator’s original text size after this manual setup.
Hosted sign-in, authenticated import, and physical-device checks remain separate.

See [design QA](design-qa.md) for captures and
[device acceptance](../../docs/ios-implementation.md) for remaining checks.
An iOS JavaScript/Hermes export is not an Xcode build or signed IPA.
