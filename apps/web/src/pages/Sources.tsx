import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Source, SourceSyncProgress, Teacher } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { connectGoogleDrive } from "@/lib/auth";
import { DRIVE_PICK_PARAM } from "@/lib/googlePicker";
import { syncSource } from "@/lib/sync";
import { rowSync } from "@/lib/syncProgress";
import { SourceForm } from "@/components/SourceForm";
import { isCanvaRef } from "@/lib/detectSource";
import { useDialog } from "@/lib/useDialog";
import { classDate, groupByTeacher, languageName, LANGUAGE_NAMES, teacherKey, type TeacherGroup } from "@/lib/groupSources";
import { flagFor, SOURCE_ICON, SOURCE_LABEL } from "@/lib/meta";
import { TeacherAvatar } from "@/components/TeacherAvatar";
import { AnkiImport } from "@/components/AnkiImport";
import { prepareClassDocument } from "@/lib/classDocument";
import { DeckManager } from "@/components/DeckManager";

type RemoveMode = "keep" | "drop_pending" | "drop_all";
const LANGS = Object.entries(LANGUAGE_NAMES);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A sync that queued parsing: new lines found, or earlier failed parses retried. */
const SYNCABLE = new Set<Source["type"]>(["google_doc", "google_sheet", "pdf_upload"]);
const bringsNewWords = (result: string) => /^(diffed|requeued):[1-9]/.test(result);
/** Poll fast while a row is syncing or reading words, slowly otherwise to catch scheduled syncs. */
const ACTIVE_POLL_MS = 3000;
const IDLE_POLL_MS = 30000;

/** Row title inside a teacher group: the class date for PDFs, otherwise the document type. */
function rowTitle(source: Source): string {
  const date = classDate(source.label);
  if (date) return `Class of ${new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  return source.type === "pdf_upload" ? source.label : SOURCE_LABEL[source.type];
}

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editLang, setEditLang] = useState("zh");
  const [removing, setRemoving] = useState<Source | null>(null);
  const [removeMode, setRemoveMode] = useState<RemoveMode>("keep");
  const navigate = useNavigate();
  const updateInput = useRef<HTMLInputElement>(null);
  const [updateTarget, setUpdateTarget] = useState<string | null>(null);
  const [pdfTeacher, setPdfTeacher] = useState<{ label: string; language: string }>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Back from Google's Drive consent: reopen the form so the picker can open straight away.
  const [arrivedToPick] = useState(() => new URLSearchParams(window.location.search).has(DRIVE_PICK_PARAM));
  const [adding, setAdding] = useState(arrivedToPick);
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [importingAnki, setImportingAnki] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [syncAll, setSyncAll] = useState<{ done: number; total: number } | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, SourceSyncProgress>>({});
  const [inboxCount, setInboxCount] = useState(0);

  /** Sources plus their sync progress; progress is extra detail, so the rows still render without it. */
  const refresh = useCallback(async () => {
    const [list, live] = await Promise.all([api.listSources(), api.listSyncProgress().catch(() => null)]);
    setSources(list);
    if (live) setProgress(live);
  }, []);
  const load = useCallback(async () => {
    try { await refresh(); setLoadError(null); }
    catch (error) { setLoadError(`Couldn't load your sources: ${(error as Error).message}`); }
    finally { setLoading(false); }
    api.listPendingCandidates().then((c) => setInboxCount(c.length)).catch(() => setInboxCount(0));
    // Photos are decoration: the page works without them.
    try { setTeachers(await api.listTeachers()); } catch { setTeachers([]); }
  }, [refresh]);
  useEffect(() => { void load(); }, [load]);

  const busy = syncing !== null || Object.values(progress).some((p) =>
    p.syncing || p.parseStatus === "pending" || p.parseStatus === "running");
  useEffect(() => {
    if (loading || loadError) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void refresh().catch(() => undefined);
    }, busy ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [busy, loading, loadError, refresh]);

  /** Sync one source; returns its result token, or null when it failed (error already surfaced). */
  async function syncNow(source: Source, thenNavigate = true): Promise<string | null> {
    setSyncing(source.id);
    setSyncError(null); setSyncNotice(null);
    try {
      const result = await syncSource(source);
      await load();
      // New words ARE the feedback: off to triage. Nothing new: say so here rather than
      // landing on an empty Inbox that reads like the sync didn't work.
      if (thenNavigate && bringsNewWords(result)) {
        navigate("/inbox", { state: { importingSourceId: source.id, importingLabel: source.label } });
      } else if (thenNavigate) {
        setSyncNotice(`${source.label} is up to date. No new words since the last sync.`);
      }
      return result;
    } catch (e) {
      await load(); // refresh the row's own status line
      setSyncError(`Sync failed: ${e instanceof Error ? e.message : "unknown"}`);
      return null;
    } finally {
      setSyncing(null);
    }
  }

  async function onAdded(added: Source[]) {
    setAdding(false);
    await load();
    let lastImport: Source | null = null;
    for (const source of added) {
      if (source.type !== "pdf_upload") continue; // first parse right away
      const result = await syncNow(source, added.length === 1);
      if (result && bringsNewWords(result)) lastImport = source;
    }
    if (added.length > 1 && lastImport) {
      navigate("/inbox", { state: { importingSourceId: lastImport.id, importingLabel: lastImport.label } });
    }
  }

  /** Sync every connected source in turn, then open the Inbox if any of them queued words. */
  async function syncEverything() {
    // Only these types have a sync function; recordings, chats and manual cards don't sync.
    const targets = sources.filter((s) => s.status !== "revoked" && SYNCABLE.has(s.type));
    let lastImport: Source | null = null;
    let failures = 0;
    setSyncNote(null);
    for (const [index, source] of targets.entries()) {
      setSyncAll({ done: index, total: targets.length });
      const result = await syncNow(source, false);
      if (result === null) failures++;
      else if (bringsNewWords(result)) lastImport = source;
    }
    setSyncAll(null);
    if (failures > 0) setSyncError(`${failures} of ${targets.length} sources couldn't sync. Their rows show what went wrong.`);
    else if (lastImport) navigate("/inbox", { state: { importingSourceId: lastImport.id, importingLabel: lastImport.label } });
    else setSyncNote("Everything is up to date. No new words since your last sync.");
  }

  async function saveEdit(id: string) {
    try {
      await api.updateSource(id, { label: editLabel, language: editLang });
      setEditing(null); await load();
    } catch (error) { setSyncError(`Couldn't save this source: ${(error as Error).message}`); }
  }

  async function confirmRemove() {
    if (!removing) return;
    await api.removeSource(removing.id, removeMode);
    setRemoving(null);
    setRemoveMode("keep");
    await load();
  }

  async function onUpdateFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const source = sources.find((s) => s.id === updateTarget);
    e.target.value = "";
    setUpdateTarget(null);
    if (!file || !source) return;
    setSyncError(null);
    setSyncing(source.id);
    setSyncNote(`Preparing ${file.name}…`);
    try {
      await api.uploadSourcePdf(source.id, await prepareClassDocument(file));
      setSyncNote(null);
      await syncNow(source);
    } catch (err) {
      setSyncError(`Update failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setSyncing(null);
      setSyncNote(null);
    }
  }

  // Imported decks are listed on their own; everything else is grouped by teacher.
  const decks = sources.filter((s) => s.type === "anki_deck");
  // Teachers added from Preply show up before they have any class notes.
  const groups = withTeachersWithoutNotes(groupByTeacher(sources.filter((s) => s.type !== "anki_deck")), teachers);
  const showForm = adding;
  const showAddTeacher = addingTeacher;
  const empty = !loading && !loadError && groups.length === 0 && decks.length === 0 && !adding && !addingTeacher && !importingAnki;
  const openPanel = (panel: "anki" | "teacher") => {
    setImportingAnki(panel === "anki");
    setAddingTeacher(panel === "teacher");
    setAdding(false);
    setPdfTeacher(undefined);
  };

  function addClassPdf(teacher: string, language: string) {
    setPdfTeacher({ label: teacher, language });
    setAddingTeacher(false);
    setAdding(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main id="main-content" className="page-shell space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="page-header mb-0"><p className="app-eyebrow">Your collection</p><h1>Decks &amp; notes</h1><p>Decks you've imported, and class notes Schwanki reads for new words. New words from your notes wait for you to check them before they reach your reviews.</p></div>
        {(groups.length > 0 || decks.length > 0) && !adding && !addingTeacher && !importingAnki && (
          <div className="flex flex-wrap gap-2">
            {groups.length > 0 && (
              <button onClick={() => void syncEverything()} disabled={syncAll !== null || syncing !== null} className="primary-button">
                {syncAll ? `Syncing ${syncAll.done + 1} of ${syncAll.total}…` : "Sync all"}
              </button>
            )}
            <button onClick={() => openPanel("anki")} className="secondary-button">Import Anki deck</button>
            <button onClick={() => openPanel("teacher")} className="secondary-button">Add new teacher</button>
          </div>
        )}
      </header>
      {empty && (
        <section className="paper-panel space-y-4" aria-label="Get started">
          <h2 className="text-xl font-black">Where are your words now?</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={() => openPanel("anki")} className="primary-button">Import an Anki deck</button>
            <button onClick={() => openPanel("teacher")} className="secondary-button">Add a teacher's class notes</button>
          </div>
        </section>
      )}
      {importingAnki && (
        <AnkiImport onImported={() => void load()} onClose={() => setImportingAnki(false)} />
      )}
      {showAddTeacher && (
        <AddTeacherPanel
          onFound={(found) => { setAddingTeacher(false); void load(); addClassPdf(found.name, found.language ?? "zh"); }}
          onManual={() => { setAddingTeacher(false); setPdfTeacher(undefined); setAdding(true); }}
          onClose={() => setAddingTeacher(false)} />
      )}
      {showForm && (
        <div className="space-y-2">
          <SourceForm onAdded={(s) => void onAdded(s)} pdfTeacher={pdfTeacher} autoPick={arrivedToPick}
            existing={sources} onReconnected={(s) => { setAdding(false); void syncNow(s); }}
            title={pdfTeacher ? `Add ${pdfTeacher.label}'s class notes` : "Add new teacher"} />
          <button onClick={() => { setAdding(false); setPdfTeacher(undefined); }} className="text-sm font-bold text-ink/60 underline">Close</button>
        </div>
      )}
      {inboxCount > 0 && (
        <Link to="/inbox" className="inbox-nudge">
          <span><strong>{inboxCount} new {inboxCount === 1 ? "word" : "words"}</strong> from your classes are waiting for you to check.</span>
          <span aria-hidden="true" className="font-black">→</span>
        </Link>
      )}
      <DeckManager sources={sources} teachers={teachers} />
      {loading && <p role="status">Loading your decks and notes…</p>}
      {loadError && <div className="error-notice" role="alert"><p>{loadError}</p><button className="underline font-bold" onClick={() => { setLoading(true); void load(); }}>Reload sources</button></div>}
      {syncError && <p role="alert" className="text-sm font-bold text-beak">{syncError}</p>}
      {syncNotice && <p role="status" className="text-sm font-bold text-ink/70">{syncNotice}</p>}
      {syncNote && <p role="status" className="notice">{syncNote}</p>}

      <input ref={updateInput} type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx" aria-label="Update class file"
        className="hidden" onChange={(e) => void onUpdateFile(e)} />

      {decks.length > 0 && (
        <section aria-label="Anki decks" className="teacher-group">
          <h2 className="text-2xl font-black tracking-tight"><span aria-hidden="true">{SOURCE_ICON.anki_deck}</span> Anki decks</h2>
          <ul className="source-list">
            {decks.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-bold">{s.label}</p>
                  <p className="text-sm text-ink/60"><span aria-hidden="true">{flagFor(s.language)}</span> {languageName(s.language)}</p>
                </div>
                <button aria-label={`Remove ${s.label}`} onClick={() => { setRemoving(s); setRemoveMode("keep"); }}
                  className="row-button text-beak">Remove</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.map((group) => (
        <section key={group.teacher} aria-label={group.teacher} className="teacher-group">
          <TeacherHeader name={group.teacher}
            subtitle={group.count === 0 ? "No class notes yet" : `${plural(group.count, "source")}${group.languages.length > 1 ? ` in ${group.languages.length} languages` : ""}`}
            channels={syncChannels(group.languages.flatMap((l) => l.items))}
            teacher={teachers.find((t) => teacherKey(t.name) === teacherKey(group.teacher))} onLinked={() => void load()} />
          {group.count === 0 && (
            <button onClick={() => addClassPdf(group.teacher, teachers.find((t) => teacherKey(t.name) === teacherKey(group.teacher))?.language ?? "zh")}
              className="primary-button">Add {group.teacher}'s class notes</button>
          )}
          {group.languages.map((lang) => (
            <div key={lang.language} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="language-label"><span aria-hidden="true">{flagFor(lang.language)}</span> {languageName(lang.language)} <span className="font-normal text-ink/50">· {plural(lang.items.length, "source")}</span></h3>
                <button onClick={() => addClassPdf(group.teacher, lang.language)} className="row-button">+ Add class notes</button>
              </div>
              <ul className="source-list">
                {lang.items.map((s) => { const sync = rowSync(s, progress[s.id], syncing === s.id); return (
          <li key={s.id} className="space-y-2">
            {editing === s.id ? (
              <div className="flex flex-wrap gap-3">
                <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} aria-label="Label"
                  className="flex-1 rounded-xl border border-ink/20 bg-cream px-3 py-2 outline-none focus:border-beak" />
                <select value={editLang} onChange={(e) => setEditLang(e.target.value)} aria-label="Language"
                  className="rounded-xl border border-ink/20 bg-cream px-2 py-2">
                  {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
                <button onClick={() => void saveEdit(s.id)}
                  className="rounded-xl bg-ink px-3 py-2 text-sm font-bold text-cream">Save</button>
                <button onClick={() => setEditing(null)}
                  className="rounded-xl bg-cream px-3 py-2 text-sm font-bold">Cancel</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-bold">{rowTitle(s)}</p>
                  {s.type === "pdf_upload" && isCanvaRef(s.externalRef) && (
                    <p className="text-sm">
                      <a href={s.externalRef} target="_blank" rel="noreferrer" className="break-all underline text-ink/70">
                        {s.externalRef.replace(/^https?:\/\//, "")}
                      </a>
                    </p>
                  )}
                  <p role={sync.phase === "idle" ? undefined : "status"}
                    className={`flex items-center gap-1.5 text-sm ${sync.phase === "idle" && sync.tone === "alert" ? "font-bold text-beak" : sync.phase === "idle" ? "text-ink/60" : "font-bold text-ink/80"}`}>
                    {sync.phase !== "idle" && <Spinner />}
                    {sync.text}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.status === "revoked" ? (
                    // Granting Drive access stores a fresh Google token; the next sync un-revokes the source.
                    <button onClick={() => void connectGoogleDrive().catch((e: Error) => setSyncError(`Couldn't connect Google Drive: ${e.message}`))}
                      className="row-button row-button-alert">
                      Connect Google Drive
                    </button>
                  ) : (
                    <button onClick={() => void syncNow(s)} disabled={sync.phase !== "idle"} aria-busy={sync.phase !== "idle"}
                      className={`gap-1.5 ${s.status === "active" || sync.phase !== "idle" ? "row-button" : "row-button row-button-alert"}`}>
                      {sync.phase !== "idle" && <Spinner />}
                      {sync.phase === "syncing" ? "Syncing…" : sync.phase === "parsing" ? "Reading…" : "Sync now"}
                    </button>
                  )}
                  {s.type === "pdf_upload" && (
                    <button disabled={syncing !== null} onClick={() => { setUpdateTarget(s.id); updateInput.current?.click(); }} className="row-button">
                      Update file
                    </button>
                  )}
                  <button aria-label={`Edit ${s.label}`}
                    onClick={() => { setEditing(s.id); setEditLabel(s.label); setEditLang(s.language); }}
                    className="row-button">Edit</button>
                  <button aria-label={`Remove ${s.label}`}
                    onClick={() => { setRemoving(s); setRemoveMode("keep"); }}
                    className="row-button text-beak">Remove</button>
                </div>
              </div>
            )}
          </li>
                ); })}
              </ul>
            </div>
          ))}
        </section>
      ))}

      {removing && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-6"
          role="dialog" aria-modal="true" aria-label={`Remove ${removing.label}`}>
          <RemoveSourceDialog source={removing} mode={removeMode} onMode={setRemoveMode} onClose={() => setRemoving(null)} onConfirm={confirmRemove} />
        </div>
      )}
    </main>
  );
}

function Spinner() {
  return <span aria-hidden="true" className="inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />;
}

/** How a teacher's notes arrive, one chip per channel: PDF, Canva, Google Doc/Sheet, Preply chat, recording. */
type Channel = { key: string; icon: string; label: string; count: number };
function syncChannels(items: Source[]): Channel[] {
  const channels = new Map<string, Channel>();
  for (const source of items) {
    const canva = source.type === "pdf_upload" && isCanvaRef(source.externalRef);
    const key = canva ? "canva" : source.type;
    const channel = channels.get(key) ?? { key, icon: canva ? "🎨" : SOURCE_ICON[source.type], label: canva ? "Canva" : SOURCE_LABEL[source.type].replace(/^PDF upload$/, "PDF").replace(/^manual$/, "Manual"), count: 0 };
    channel.count++;
    channels.set(key, channel);
  }
  return [...channels.values()].sort((a, b) => b.count - a.count);
}

/** Add an empty group for every saved teacher who has no class notes yet. */
function withTeachersWithoutNotes(groups: TeacherGroup<Source>[], teachers: Teacher[]): TeacherGroup<Source>[] {
  const known = new Set(groups.map((g) => teacherKey(g.teacher)));
  const empty = teachers.filter((t) => !known.has(teacherKey(t.name)))
    .map((t) => ({ teacher: t.name, languages: [], count: 0 }));
  return [...groups, ...empty].sort((a, b) => a.teacher.localeCompare(b.teacher));
}

function AddTeacherPanel({ onFound, onManual, onClose }: {
  onFound: (teacher: { name: string; language: string | null }) => void; onManual: () => void; onClose: (() => void) | undefined;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function find(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { onFound(await api.linkTeacherPreply(null, url)); }
    catch (failure) { setError((failure as Error).message); setBusy(false); }
  }
  return (
    <section className="paper-panel space-y-4" aria-label="Add new teacher">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Add new teacher</h2>
          <p className="text-sm text-ink/60">Add their class notes: PowerPoint files, PDFs, Canva exports, Google Docs or Sheets.</p>
        </div>
        {onClose && <button type="button" onClick={onClose} disabled={busy} className="text-sm font-bold text-ink/60 underline">Close</button>}
      </div>
      <button type="button" onClick={onManual} disabled={busy} className="primary-button">Add class notes</button>
      <form onSubmit={(e) => void find(e)} className="space-y-2 border-t border-ink/15 pt-4">
        <p className="text-sm font-bold">Learning on Preply? Paste their profile link and Schwanki fills in their name, photo and language.</p>
        <div className="flex flex-wrap gap-2">
          <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy}
            aria-label="Teacher's Preply profile link" placeholder="https://preply.com/en/tutor/123456"
            className="min-w-0 flex-1 rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" />
          <button type="submit" disabled={busy} className="secondary-button">{busy ? "Finding teacher…" : "Find teacher"}</button>
        </div>
        {error && <p role="alert" className="text-sm font-bold text-beak">{error}</p>}
      </form>
    </section>
  );
}

function TeacherHeader({ name, subtitle, channels, teacher, onLinked }: {
  name: string; subtitle: string; channels: Channel[]; teacher: Teacher | undefined; onLinked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(teacher?.preplyUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api.linkTeacherPreply(name, url); setOpen(false); onLinked(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <TeacherAvatar name={name} photoUrl={teacher?.photoUrl} size="lg" />
        {/* basis-40: on phones the photo button wraps below instead of squeezing the name to one letter per line. */}
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="break-words text-2xl font-black tracking-tight">{name}</h2>
          <p className="text-sm text-ink/60">
            {subtitle}
            {teacher?.preplyUrl && <> · <a href={teacher.preplyUrl} target="_blank" rel="noreferrer" className="underline">Preply profile</a></>}
          </p>
          {channels.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`How ${name}'s notes sync`}>
              {channels.map((c) => (
                <li key={c.key} className="sync-chip"><span aria-hidden="true">{c.icon}</span> {c.label}{c.count > 1 ? ` ×${c.count}` : ""}</li>
              ))}
            </ul>
          )}
        </div>
        {!open && (
          <button onClick={() => { setOpen(true); setUrl(teacher?.preplyUrl ?? ""); }} className="row-button">
            {teacher?.photoUrl ? "Change photo" : "Add Preply photo"}
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={(e) => void save(e)} className="flex flex-wrap gap-2">
          <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy}
            aria-label={`${name}'s Preply profile link`} placeholder="https://preply.com/en/tutor/123456"
            className="min-w-0 flex-1 rounded-lg border border-ink/30 bg-cream px-3 py-2 text-sm outline-none focus:border-beak" />
          <button type="submit" disabled={busy} className="row-button row-button-alert">{busy ? "Finding photo…" : "Use this photo"}</button>
          <button type="button" onClick={() => { setOpen(false); setError(null); }} disabled={busy} className="row-button">Cancel</button>
          {error && <p role="alert" className="w-full text-sm font-bold text-beak">{error}</p>}
        </form>
      )}
    </header>
  );
}

function RemoveSourceDialog({ source, mode, onMode, onClose, onConfirm }: {
  source: Source; mode: RemoveMode; onMode: (mode: RemoveMode) => void;
  onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useDialog(() => { if (!busy) onClose(); });
  async function remove() {
    setBusy(true); setError(null);
    try { await onConfirm(); }
    catch (failure) { setError(`Couldn't remove this source: ${(failure as Error).message}`); setBusy(false); }
  }
  return <div ref={ref} tabIndex={-1} className="dialog-panel space-y-4">
            <h2 className="text-xl font-black">Remove “{source.label}”?</h2>
            <div className="space-y-2 text-sm">
              <label className="flex gap-2">
                <input type="radio" name="remove-mode" checked={mode === "keep"} disabled={busy}
                  onChange={() => onMode("keep")} />
                <span><strong>Keep everything it produced.</strong> Accepted cards and Inbox candidates stay.</span>
              </label>
              <label className="flex gap-2">
                <input type="radio" name="remove-mode" checked={mode === "drop_pending"} disabled={busy}
                  onChange={() => onMode("drop_pending")} />
                <span><strong>Remove its Inbox candidates too.</strong> Accepted cards stay.</span>
              </label>
              <label className="flex gap-2">
                <input type="radio" name="remove-mode" checked={mode === "drop_all"} disabled={busy}
                  onChange={() => onMode("drop_all")} />
                <span><strong>Remove everything.</strong> Accepted cards and candidates are deleted.</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} disabled={busy} className="secondary-button">Cancel</button>
              <button onClick={() => void remove()} disabled={busy} className="primary-button">{busy ? "Removing…" : "Remove"}</button>
            </div>
            {error && <p role="alert" className="error-notice">{error}</p>}
          </div>;
}
