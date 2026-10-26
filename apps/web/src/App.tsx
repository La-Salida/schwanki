import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { captureGoogleTokens } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import SignIn from "@/pages/SignIn";
import Sources from "@/pages/Sources";
import Triage from "@/pages/Triage";
import Review from "@/pages/Review";
import ReviewSession from "@/pages/ReviewSession";
import Settings from "@/pages/Settings";
import ExtensionAuth from "@/pages/ExtensionAuth";
import Onboarding, { onboardingDismissed } from "@/pages/Onboarding";
import { api } from "@/lib/supabase";
import { AccountProvider } from "@/components/AccountProvider";
import Account from "@/pages/Account";
import Billing from "@/pages/Billing";

const BOOT_TIMEOUT_MS = 12_000;

function ServerUnreachable() {
  return (
    <main className="page-shell space-y-4" role="alert">
      <h1 className="text-2xl font-black tracking-tight">Schwanki can't reach its server</h1>
      <p className="text-ink/70">Your connection may be offline, or your network may be blocking supabase.co. Try Wi‑Fi or mobile data, then retry.</p>
      <button type="button" className="primary-button" onClick={() => window.location.reload()}>Try again</button>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | undefined>(undefined);
  const [bootStalled, setBootStalled] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void captureGoogleTokens();
    });
    // A phone that can't reach Supabase would otherwise sit on the loading screen forever.
    const stall = window.setTimeout(() => setBootStalled(true), BOOT_TIMEOUT_MS);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) void captureGoogleTokens();
      if (!s) setNeedsOnboarding(undefined);
    });
    return () => { window.clearTimeout(stall); sub.subscription.unsubscribe(); };
  }, []);
  // First login: users with no sources go straight into the setup funnel.
  useEffect(() => {
    if (!session) return;
    // Offline launches from the home screen: skip the check (it retries for seconds) and go to Today.
    if (!navigator.onLine) { setNeedsOnboarding(false); return; }
    let cancelled = false;
    const stall = window.setTimeout(() => { if (!cancelled) setNeedsOnboarding((v) => v ?? false); }, BOOT_TIMEOUT_MS);
    api.listSources()
      .then((sources) => { if (!cancelled) setNeedsOnboarding(sources.length === 0 && !onboardingDismissed()); })
      .catch(() => { if (!cancelled) setNeedsOnboarding(false); });
    return () => { cancelled = true; window.clearTimeout(stall); };
  }, [session]);
  if (session === undefined) {
    if (bootStalled) return <ServerUnreachable />;
    return <main className="page-shell" role="status">Opening your decks…</main>;
  }
  if (session && needsOnboarding === undefined) {
    return <main className="page-shell" role="status">Opening your decks…</main>;
  }
  if (!session) return <SignIn />;
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AccountProvider key={session.user.id} user={session.user}>
        <div className="app-surface">
          <AppNav />
          <Routes>
            <Route path="/" element={needsOnboarding ? <Onboarding onFinish={() => setNeedsOnboarding(false)} /> : <Review />} />
            <Route path="/review" element={<ReviewSession />} />
            <Route path="/inbox" element={<Triage />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/account" element={<Account />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/extension-auth" element={<ExtensionAuth />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </AccountProvider>
    </BrowserRouter>
  );
}
