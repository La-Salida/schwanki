# App UI polish — October 20, 2026

Authenticated surfaces now follow the landing page's Archivo hierarchy, paper cream surfaces, leather black review treatment, acid word highlights, and orange actions. Today and completion copy describe decks and reviews; class notes remain a secondary entry path. Desktop ratings precede optional memory generation.

## Visual verification

Mounted the actual AppNav, Review, Sources, Triage, Settings, and Onboarding components in a temporary Vite fixture. Mocked API responses supplied a Japanese deck, one due card, credit balance, and empty Inbox. No production data or account was used. Removed both fixture files after verification.

Checked all five pages at 320×568, 390×844, and 1280×720. No document horizontal overflow. Inspected desktop hidden/revealed review and phone full-screen review. Also inspected populated Inbox at 320×568; vocabulary now occupies the left column with approve/discard stacked on the right instead of squeezing the word between controls.

Saved dashboard proof outside the repository as app-today-phone.png in the task's visualization directory.

## Checks and limits

Workspace tests and typechecking passed. Web suite: 151 tests across 31 files. Web production build and lint passed; existing lint and bundle-size warnings remain. Added coverage for navigation current-page/skip behavior, empty-collection import entry, and reveal/four-rating behavior.

Local auth has no running backend, so this pass does not certify live sign-in, paid generation, or remote import/sync. Scheduling and API implementations were not changed. Existing importer and review interaction tests remain the functional regression checks.
