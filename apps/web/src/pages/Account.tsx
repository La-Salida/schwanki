import { Link } from "react-router-dom";
import { accountName, useAccount } from "@/lib/account";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { LegalLinks } from "@/components/LegalLinks";
import { SUPPORT_EMAIL } from "@/lib/legal";

const CONFIRM_WORD = "delete";

export default function Account() {
  const { user, signOut } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  async function logout() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await signOut(); }
    catch (failure) { setError((failure as Error).message); setBusy(false); }
  }
  async function deleteAccount() {
    if (deleting || typed.trim().toLowerCase() !== CONFIRM_WORD) return;
    setDeleting(true); setDeleteError(null);
    const { data, error: failure } = await supabase.functions.invoke("delete-account", { body: { confirm: true } });
    if (failure || !data?.deleted) {
      const detail = await (failure as { context?: Response } | null)?.context?.json?.().catch(() => null);
      setDeleteError(detail?.error ?? `Couldn't delete your account. Try again or email ${SUPPORT_EMAIL}.`);
      setDeleting(false);
      return;
    }
    // The session belongs to a user that no longer exists; clear it locally.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.assign("/");
  }
  return <main id="main-content" className="page-shell account-page space-y-8">
    <header className="page-header"><p className="app-eyebrow">Profile &amp; access</p><h1>Your account</h1><p>Your sign-in details, billing, and account controls.</p></header>
    <section className="paper-panel" aria-labelledby="account-details">
      <h2 id="account-details" className="text-xl font-black">Signed in as</h2>
      <dl className="account-details">
        <div><dt>Name</dt><dd>{accountName(user)}</dd></div>
        <div><dt>Email</dt><dd>{user.email || "No email on this account"}</dd></div>
        <div><dt>Sign-in method</dt><dd>{user.app_metadata.provider === "google" ? "Google" : user.app_metadata.provider || "Email"}</dd></div>
      </dl>
      <p className="text-sm text-ink/60">Your profile details come from your sign-in provider.</p>
    </section>
    <section className="paper-panel account-destinations" aria-label="Account settings">
      <Link to="/billing"><span><strong>Billing &amp; invoices</strong><small>Credit balance, purchases, receipts, and invoices</small></span><span aria-hidden="true">→</span></Link>
      <Link to="/settings"><span><strong>AI settings</strong><small>Provider keys and card generation preferences</small></span><span aria-hidden="true">→</span></Link>
    </section>
    <div><button onClick={() => void logout()} disabled={busy} className="secondary-button">{busy ? "Logging out…" : "Log out"}</button><p className="mt-2 text-sm text-ink/60">Log out of Schwanki on this browser.</p></div>
    {error && <p role="alert" className="error-notice">{error}</p>}
    <section className="paper-panel space-y-3" aria-labelledby="help-heading">
      <h2 id="help-heading" className="text-xl font-black">Help</h2>
      <p className="text-sm text-ink/70">Something broken, or a question about billing or your data? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">{SUPPORT_EMAIL}</a>.</p>
      <LegalLinks className="text-sm" />
    </section>
    <section className="paper-panel space-y-3 border-beak/40" aria-labelledby="delete-heading">
      <h2 id="delete-heading" className="text-xl font-black">Delete account</h2>
      <p className="text-sm text-ink/70">Permanently deletes your cards, decks, review history, imported files, generated pictures and audio, saved AI keys and remaining credits, and disconnects Google Drive. This can't be undone.</p>
      {!confirming ? (
        <button type="button" className="secondary-button" onClick={() => setConfirming(true)}>Delete my account…</button>
      ) : (
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void deleteAccount(); }}>
          <label htmlFor="delete-confirm" className="block text-sm font-bold">Type “{CONFIRM_WORD}” to confirm</label>
          <input id="delete-confirm" className="w-full max-w-xs rounded-xl border border-ink/20 bg-cream px-4 py-3 outline-none focus:border-beak" autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} disabled={deleting} />
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="primary-button" disabled={deleting || typed.trim().toLowerCase() !== CONFIRM_WORD}>{deleting ? "Deleting…" : "Delete everything"}</button>
            <button type="button" className="secondary-button" disabled={deleting} onClick={() => { setConfirming(false); setTyped(""); setDeleteError(null); }}>Cancel</button>
          </div>
        </form>
      )}
      {deleteError && <p role="alert" className="error-notice">{deleteError}</p>}
    </section>
  </main>;
}
