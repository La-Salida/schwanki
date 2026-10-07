# Branch consolidation — 2026-10-07

All existing feature branches are merged into main at the user's request.
The two recording branches independently implemented the same extension and
PostgreSQL contracts. The class-recording-connector implementation is the
active version because it includes the verified real tab/microphone exports,
recovery manifests, auth handoff and PostgreSQL contract tests. The earlier
recorded-class implementation remains available in Git history; its conflicting
migration and duplicate extension entry points are superseded, rather than
applied alongside incompatible definitions of the same tables.

The earlier branch's independent media verification/benchmark helpers and
evidence remain. Its schema acceptance command now runs the active core schema
tests. Listening API/schema groundwork and design notes are preserved; the
listening feature remains unfinished. Japanese chat and recording remain deferred
in the working product scope. PDF class import and editable vocabulary cards are
the current focus. This merge does not deploy workers or apply production schema.
