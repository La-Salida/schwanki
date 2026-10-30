# Continue locally

The cloud work is finished. Open this unpacked workspace in Codex on your Mac
and continue there. No cloud session is needed.

## Current state

- The native companion is implemented in `apps/ios`: Anki import, sample/review
  feed, offline ratings and sync, deck selection, Settings and local reminders.
- It follows the approved white/navy/blue direction. Notes and AI creation stay
  on the web; source/platform icons stay tiny and inline.
- `packages/anki` is shared by web and native. The new atomic Anki RPC is in
  `supabase/migrations/20261029100000_atomic_anki_import.sql`.
- Verification completed: 426 tests across native/core/web, workspace type
  checking, iOS Hermes export and browser sample-flow/visual checks.
- The source download includes `apps/ios/.env.local` with only the hosted web
  project's public client configuration. It is intentionally excluded from Git.
- No database migration, auth-setting change, deployment or App Store release
  was made. No native iPhone build has been run yet.

## Next local task

Get the existing implementation running on the connected iPhone. Start with
the bundled sample feed; fix actual build/device issues as they arise. Avoid
expanding scope or redesigning the app.

With Xcode, Node 24 and Corepack available, from this directory:

```sh
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @schwanki/ios ios:device
```

See [Mac/iPhone setup](docs/ios-mac-setup.md) for signing details. Google return
needs `schwanki://auth/callback` allowed on the shared Supabase project; native
Anki import needs the included migration. Those are separate backend steps,
not reasons to block trying the sample locally.

Further references: [implementation status](docs/ios-implementation.md),
[native README](apps/ios/README.md), [design QA](apps/ios/design-qa.md).
