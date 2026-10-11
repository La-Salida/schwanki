import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Source, Teacher } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { syncSource } from "@/lib/sync";
import { SourceForm } from "@/components/SourceForm";
import { isCanvaRef } from "@/lib/detectSource";
import { useDialog } from "@/lib/useDialog";
import { classDate, groupByTeacher, languageName, LANGUAGE_NAMES, teacherKey, type TeacherGroup } from "@/lib/groupSources";
import { flagFor, SOURCE_ICON, SOURCE_LABEL } from "@/lib/meta";
import { TeacherAvatar } from "@/components/TeacherAvatar";

type RemoveMode = "keep" | "drop_pending" | "drop_all";
const LANGS = Object.entries(LANGUAGE_NAMES);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A sync that queued parsing: new lines found, or earlier failed parses retried. */
const SYNCABLE = new Set<Source["type"]>(["google_doc", "google_sheet", "pdf_upload"]);
const bringsNewWords = (result: string) => /^(diffed|requeued):[1-9]/.test(result);

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
  const [adding, setAdding] = useState(false);
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [syncAll, setSyncAll] = useState<{ done: number; total: number } | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setSources(await api.listSources()); setLoadError(null); }
    catch (error) { setLoadError(`Couldn't load your sources: ${(error as Error).message}`); }
    finally { setLoading(false); }
    // Photos are decoration: the page works without them.
    try { setTeachers(await api.listTeachers()); } catch { setTeachers([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  /** Sync one source; returns its result token, or null when it failed (error already surfaced). */
  async function syncNow(source: Source, thenNavigate = true): Promise<string | null> {
    setSyncing(source.id);
    setSyncError(null);
    try {
      const result = await syncSource(source);
      await load();
      // Success — the new words ARE the feedback. Off to triage.
      if (thenNavigate) {
        navigate("/inbox", bringsNewWords(result)
          ? { state: { importingSourceId: source.id, importingLabel: source.label } }
          : undefined);
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
    try {
      await api.uploadSourcePdf(source.id, file);
      await syncNow(source);
    } catch (err) {
      setSyncError(`Update failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  // Teachers added from Preply show up before they have any class notes.
  const groups = withTeachersWithoutNotes(groupByTeacher(sources), teachers);
  const showForm = adding;
  // With no teachers yet, the Preply link is the first thing offered.
  const showAddTeacher = addingTeacher || (!loading && !loadError && groups.length === 0 && !adding);

  function addClassPdf(teacher: string, language: string) {
    setPdfTeacher({ label: teacher, language });
    setAddingTeacher(false);
    setAdding(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main id="main-content" className="page-shell space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="page-header mb-0"><h1>Class notes</h1><p>Your teachers' notes, grouped by teacher and language. New vocabulary goes to the Inbox for you to check.</p></div>
        {groups.length > 0 && !adding && !addingTeacher && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void syncEverything()} disabled={syncAll !== null || syncing !== null} className="primary-button">
              {syncAll ? `Syncing ${syncAll.done + 1} of ${syncAll.total}…` : "Sync all"}
            </button>
            <button onClick={() => { setAddingTeacher(true); setAdding(false); setPdfTeacher(undefined); }} className="secondary-button">Add new teacher</button>
          </div>
        )}
      </header>
      {showAddTeacher && (
        <AddTeacherPanel
          onFound={(found) => { setAddingTeacher(false); void load(); addClassPdf(found.name, found.language ?? "zh"); }}
          onManual={() => { setAddingTeacher(false); setPdfTeacher(undefined); setAdding(true); }}
          onClose={groups.length > 0 ? () => setAddingTeacher(false) : undefined} />
      )}
      {showForm && (
        <div className="space-y-2">
          <SourceForm onAdded={(s) => void onAdded(s)} pdfTeacher={pdfTeacher}
            title={pdfTeacher ? `Add ${pdfTeacher.label}'s class notes` : "Add new teacher"} />
          {groups.length > 0 && <button onClick={() => { setAdding(false); setPdfTeacher(undefined); }} className="text-sm font-bold text-ink/60 underline">Close</button>}
        </div>
      )}
      {loading && <p role="status">Loading your class notes…</p>}
      {loadError && <div className="error-notice" role="alert"><p>{loadError}</p><button className="underline font-bold" onClick={() => { setLoading(true); void load(); }}>Reload sources</button></div>}
      {!loading && !loadError && groups.length === 0 && <p className="notice">No teachers yet. Paste your teacher's Preply link above, or add them by hand.</p>}
      {syncError && <p role="alert" className="text-sm font-bold text-beak">{syncError}</p>}
      {syncNote && <p role="status" className="notice">{syncNote}</p>}

      <input ref={updateInput} type="file" accept="application/pdf,.pdf" aria-label="Update PDF file"
        className="hidden" onChange={(e) => void onUpdateFile(e)} />

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
                {lang.items.some((s) => s.type === "pdf_upload") && (
                  <button onClick={() => addClassPdf(group.teacher, lang.language)} className="row-button">+ Add class PDF</button>
                )}
              </div>
              <ul className="source-list">
                {lang.items.map((s) => (
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
                  <p className={`text-sm ${s.status === "active" ? "text-ink/60" : "font-bold text-beak"}`}>
                    {s.status === "active" && (s.lastSyncedAt ? `Synced ${new Date(s.lastSyncedAt).toLocaleDateString()}` : "Never synced")}
                    {s.status === "error" && `Sync failed: ${s.errorDetail ?? "unknown"}. Try syncing again.`}
                    {s.status === "revoked" && "Google access was revoked. Reconnect your Google account."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => void syncNow(s)} disabled={syncing === s.id}
                    className={s.status === "active" ? "row-button" : "row-button row-button-alert"}>
                    {syncing === s.id ? "Syncing…" : "Sync now"}
                  </button>
                  {s.type === "pdf_upload" && (
                    <button onClick={() => { setUpdateTarget(s.id); updateInput.current?.click(); }} className="row-button">
                      Update PDF
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
                ))}
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
    <form onSubmit={(e) => void find(e)} className="paper-panel space-y-4">
      <div>
        <h2 className="text-xl font-black">Add new teacher</h2>
        <p className="text-sm text-ink/60">Paste their Preply profile link. Schwanki fills in their name, photo and language.</p>
      </div>
      <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy}
        aria-label="Teacher's Preply profile link" placeholder="https://preply.com/en/tutor/123456"
        className="w-full rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" />
      {error && <p role="alert" className="text-sm font-bold text-beak">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="primary-button">{busy ? "Finding teacher…" : "Find teacher"}</button>
        <button type="button" onClick={onManual} disabled={busy} className="text-sm font-bold text-ink/60 underline">Not on Preply? Add them by hand</button>
        {onClose && <button type="button" onClick={onClose} disabled={busy} className="ml-auto text-sm font-bold text-ink/60 underline">Close</button>}
      </div>
    </form>
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
        <div className="min-w-0 flex-1">
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
