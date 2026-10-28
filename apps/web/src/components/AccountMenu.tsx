import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { accountName, useAccount } from "@/lib/account";

export function AccountMenu() {
  const { user, signOut } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDetailsElement>(null);
  const location = useLocation();
  const name = accountName(user);
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [location]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  async function logout() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await signOut(); }
    catch (failure) { setError((failure as Error).message); setBusy(false); }
  }
  return (
    <details ref={ref} className="account-menu">
      <summary className="account-trigger" aria-label={`Account menu for ${user.email || name}`}>
        <span className="account-avatar" aria-hidden="true">{initials}</span><span className="account-trigger-label">Account</span><span aria-hidden="true">⌄</span>
      </summary>
      <div className="account-popover">
        <div className="account-identity"><p className="font-bold">{name}</p><p className="text-sm text-ink/70 break-all">{user.email || "No email on this account"}</p></div>
        <Link to="/account" className="account-menu-item">Your account <span aria-hidden="true">›</span></Link>
        <Link to="/billing" className="account-menu-item">Billing &amp; invoices <span aria-hidden="true">›</span></Link>
        <Link to="/settings" className="account-menu-item">AI settings <span aria-hidden="true">›</span></Link>
        <a href="/pricing" className="account-menu-item">Plans &amp; pricing <span aria-hidden="true">›</span></a>
        <div className="account-menu-footer"><button className="account-menu-item w-full" disabled={busy} onClick={() => void logout()}>{busy ? "Logging out…" : "Log out"}<span aria-hidden="true">↪</span></button></div>
        {error && <p role="alert" className="account-menu-error">{error}</p>}
      </div>
    </details>
  );
}
