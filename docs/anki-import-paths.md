# Anki import paths

Verified against the official documentation on October 20, 2026.

## Current supported path

The importer provides four device-specific guides before its existing file
preview. Computer and Android exports must include scheduling information and
media to preserve review history, pictures, and audio. AnkiMobile can export its
collection using Add/Export → Export/Share; the learner saves it to Files and
selects the decks to import in Schwanki’s preview.

Files are a one-time import, not continuing two-way synchronization. No AnkiWeb
password is requested or stored by Schwanki.

## Account connection

AnkiWeb’s published Access to the Service terms restrict direct service access
to browsers and approved synchronization clients. They explicitly disallow
browser extensions and other third-party clients, and recommend AnkiConnect
for local access. Do not implement a password-based AnkiWeb sync client or
advertise direct account connection as available.

A future desktop bridge could use AnkiConnect with Anki running on the
learner’s computer. It would require initial add-on setup and permission,
localhost/browser compatibility testing, and a verified way to transfer cards,
review history, scheduling, and media into the existing import pipeline. It
would not be one-click account connection on a new phone. This PR does not
implement that bridge.

## Primary sources

- Desktop export formats and scheduling/media options:
  https://docs.ankiweb.net/manual/exporting
- AnkiMobile deck export and collection transfer:
  https://docs.ankiweb.net/ankimobile/deck-list
  https://docs.ankiweb.net/ankimobile/collection-transfer
- AnkiDroid export instructions and options:
  https://docs.ankidroid.org/#exporting
- AnkiWeb access terms and the local AnkiConnect alternative:
  https://ankiweb.net/account/terms#access

## Acceptance checks

- Phone users see the matching guide initially; every platform remains selectable.
- Device selection works with native radio keyboard controls.
- The scheduling/media requirement is visible next to the picker.
- Existing-file users can still preview and select decks before import.
- An unreadable file leaves the guide and picker available for retry.
- Two importers do not share radio names, input IDs, or helper text IDs.
