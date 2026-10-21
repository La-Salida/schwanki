import { Link } from "react-router-dom";
import { accountName, useAccount } from "@/lib/account";
import { useState } from "react";

export default function Account() {
  const { user, signOut } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function logout() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await signOut(); }
    catch (failure) { setError((failure as Error).message); setBusy(false); }
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
  </main>;
}
