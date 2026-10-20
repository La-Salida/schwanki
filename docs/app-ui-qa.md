# App UI polish — October 20, 2026

Authenticated surfaces now follow the landing page's Archivo hierarchy, paper cream surfaces, leather black review treatment, acid word highlights, and orange actions. Today and completion copy describe decks and reviews; class notes remain a secondary entry path. Desktop ratings precede optional memory generation.

## Visual verification

Mounted the actual AppNav, Review, Sources, Triage, Settings, and Onboarding components in a temporary Vite fixture. Mocked API responses supplied a Japanese deck, one due card, credit balance, and empty Inbox. No production data or account was used. Removed both fixture files after verification.

Checked all five pages at 320×568, 390×844, and 1280×720. No document horizontal overflow. Inspected desktop hidden/revealed review and phone full-screen review. Also inspected populated Inbox at 320×568; vocabulary now occupies the left column with approve/discard stacked on the right instead of squeezing the word between controls.

Saved dashboard proof outside the repository as app-today-phone.png in the task's visualization directory.

## Checks and limits

Workspace tests and typechecking passed. Web suite: 151 tests across 31 files. Web production build and lint passed; existing lint and bundle-size warnings remain. Added coverage for navigation current-page/skip behavior, empty-collection import entry, and reveal/four-rating behavior.

Local auth has no running backend, so this pass does not certify live sign-in, paid generation, or remote import/sync. Scheduling and API implementations were not changed. Existing importer and review interaction tests remain the functional regression checks.

## Goose and palette correction — October 20

Restored the existing goose image beside the navigation wordmark. Removed the invented lime monogram, neon heading markers, lavender Inbox notice, green due badge, and decorative brown gradients. The authenticated app now scopes neutral paper/white, charcoal, and beak orange through `.app-surface` tokens. Desktop vocabulary uses a pale yellow marker; phone review keeps white vocabulary and yellow in example sentences. The landing palette is unchanged.

Rechecked all five surfaces at 320×568, 390×844, and 1280×720 with real components and mocked data: no horizontal overflow. Inspected both revealed review layouts and saved updated desktop/phone dashboard proofs plus desktop review. Confirmed the mobile Inbox layout actually computes to grid; removed a utility class that had overridden it.

Calculated text contrast: charcoal on orange 5.16:1 (hover 6.20:1), due labels 6.43:1, muted labels on canvas 5.49:1, and vocabulary on the pale yellow marker 13.87:1. Web tests (151), build/type compilation, lint, and whitespace checks passed. Existing warnings and the live-auth verification limit above still apply. Temporary preview files were removed.
