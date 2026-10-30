# First run on your Mac and iPhone

October 30, 2026. The iOS companion uses **the same hosted Supabase project as
Schwanki on the web**, `oiemotutqshdohmfhtdw`. No separate backend or account is
needed. The Mac source archive includes the public web client configuration in
`apps/ios/.env.local`; keep that file in place. A fresh Git checkout will need
the same public values supplied locally.

This is a development build from source, not an IPA or TestFlight download.
The source archive is a snapshot of the current work, including the whole pnpm
workspace. It excludes dependencies, build outputs, Git history and unrelated
local environment files.

## Install and open

1. Install the current Xcode from the Mac App Store, open it once and let it
   finish installing its components. In **Xcode → Settings → Accounts**, add
   your Apple ID. A personal development team can be used for local testing;
   this path does not require EAS or App Store submission.
2. Install Node.js 24 with Corepack available. Open Terminal in the unpacked
   `schwanki-ios` folder. Check `node --version` and `corepack --version`; if
   Corepack is absent, install it with `npm install --global corepack`.
3. Connect the iPhone by USB, unlock it and choose **Trust** if prompted. Enable
   **Settings → Privacy & Security → Developer Mode** on the iPhone if iOS asks
   for it; this may require restarting the phone.
4. From that folder, run:

   ```sh
   corepack enable
   corepack pnpm install --frozen-lockfile
   corepack pnpm --filter @schwanki/ios ios:device
   ```

   Select your iPhone and Apple development team when prompted. Expo generates
   the Xcode project, installs native dependencies, builds and installs Schwanki,
   then starts its development server. Allow local network access if prompted.
   Keep Terminal running. Allow the Mac and phone to communicate on the same
   Wi-Fi; a guest network or VPN can prevent the development connection.

If signing needs manual setup, open the generated
`apps/ios/ios/Schwanki.xcworkspace` in Xcode, choose the Schwanki app target,
then **Signing & Capabilities → Automatically manage signing → your Team**.
Select the iPhone and press Run. The development bundle ID is
`io.lasalida.schwanki`; if your personal team cannot provision that identifier,
use a unique bundle identifier in `apps/ios/app.json` and rerun the Expo command.
The login callback scheme remains `schwanki`.

After the first installation, restart only the development server with:

```sh
corepack pnpm --filter @schwanki/ios exec expo start --dev-client --lan
```

## Hosted backend setup

The local iOS configuration now targets the hosted web project, using the public
client key from the published web build. The repo's `apps/web/.env.local` points
to a local development server; copying it to iOS would make the phone connect
to itself. Preserve the hosted `apps/ios/.env.local` from the archive.

Two hosted changes are still pending. Neither was applied while preparing this
download:

- **Before Google sign-in:** in
  [Supabase Authentication → URL Configuration](https://supabase.com/dashboard/project/oiemotutqshdohmfhtdw/auth/url-configuration),
  add **`schwanki://auth/callback`** to Redirect URLs. Preserve the existing web
  redirects and Site URL. The app reuses the web Google provider and requests
  only identity scopes.
- **Before importing an Anki deck:** the new
  [atomic Anki import migration](../supabase/migrations/20261029100000_atomic_anki_import.sql)
  must be reviewed and applied to this shared project. It adds the
  `import_anki_batch` RPC used by native import; existing web import/review paths
  remain unchanged. This is an additive function migration, not a database
  reset. The backend migration remains a separate release step.

The sample feed can be tested before either hosted change. With Google return
enabled, existing-account reviews can be tested before the Anki migration.
Use a separate test account: imports and ratings on this project also appear in
the web app; this is not an isolated staging database.

## First useful checks

1. Tap **Try the feed**. Reveal and rate the three sample cards. Check that text,
   audio controls and ratings fit on the real phone. Samples do not create real
   reviews.
2. After adding the callback, sign in using the same Google account as the web.
   Check that the app returns from Google and shows that account's due cards.
3. On a test account with cached due cards, enable airplane mode, rate a few
   cards, close/reopen Schwanki, then reconnect. Check the pending count clears
   and the web shows the saved reviews.
4. Once the import migration is applied, import a small `.apkg` with pictures,
   audio and scheduling from Files. Start with a small export before testing the
   current 30 MB native limit.

Send back the first build error or the step where behavior differs. For a build
failure, the final Terminal error block is enough; a working build's first
screen and Google return are the most useful initial feedback.
