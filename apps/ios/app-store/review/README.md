# App Review information draft

Version: `1.0.0` (`19d67d91-3d64-4982-82aa-71cfc333ff34`).
Review detail: `b678305d-667e-40a8-ab29-894216cec4c0`.

The existing El Sueno LLC publisher review contact and `notes.txt` were saved in App Store Connect. Private contact details and credentials are deliberately absent from this repository.

**Reviewer sign-in is still incomplete.** The owner will enter a dedicated Google review account directly in App Store Connect. The three-card guest sample does not provide full signed-in library/import access. The CLI refuses an explicit `demoAccountRequired=true` without credentials; creating the contact/notes record without that flag nevertheless persisted the server default **true**. This was verified by a fresh read. Both credential fields are empty, so reviewer access remains incomplete until the owner fills them.

Open the version's App Review Information section, leave Sign-in required enabled, enter the dedicated account's username/password, and Save. Do not choose Add for Review or Submit for Review. Ensure the account can sign in from an unfamiliar device without an interactive challenge and contains appropriate sample decks; do not use a personal account. Validate those conditions without weakening a personal account's security settings.

Before release, reconcile these notes with the selected binary and test the hosted signed-in flows. No build has been uploaded or selected by this listing task, and no review submission has been created.
