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

## Combined validation

All 269 workspace tests pass, including PostgreSQL ownership/approval contracts,
manual edits, PDF parsing and AI suggestion preview. Workspace type checking,
web and extension builds, web lint, and both parse-worker and suggestion-function
Deno checks pass. Existing web lint/build warnings remain. The standalone media
verification tests also pass.

Integration required migration 0012: the shared editor uses an ownership-checked
recorded-class RPC to save the example along with the other text fields. The
original RPC remains for existing clients and approval retries. Tests cover
ownership rejection, preserving the edited example on approval, and rejecting
changes to resolved candidates. No migrations have been applied remotely.

This validates the combined source; live PDF imports and AI assistance in the
learner's test account still need deployment and acceptance checks.
