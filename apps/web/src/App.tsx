import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { captureGoogleTokens } from "@/lib/auth";
import SignIn from "@/pages/SignIn";
import Sources from "@/pages/Sources";
import Triage from "@/pages/Triage";
import Review from "@/pages/Review";
import Settings from "@/pages/Settings";
import ExtensionAuth from "@/pages/ExtensionAuth";
import { NotificationPrime } from "@/components/NotificationPrime";

function Nav() {
  return (
    <header className="border-b border-ink/20">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <nav className="app-nav" aria-label="Main navigation">
        <NavLink to="/" className="text-2xl font-black tracking-tight">Schwanki</NavLink>
        <div className="nav-links">
          <NavLink to="/" end className="nav-link">Review</NavLink>
          <NavLink to="/inbox" className="nav-link">Inbox</NavLink>
          <NavLink to="/sources" className="nav-link">Sources</NavLink>
          <NavLink to="/settings" className="nav-link">Settings</NavLink>
        </div>
      </nav>
    </header>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void captureGoogleTokens();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) void captureGoogleTokens();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <main className="page-shell" role="status">Opening your notebook…</main>;
  if (!session) return <SignIn />;
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Nav />
      {session && <NotificationPrime />}
      <Routes>
        <Route path="/" element={<Review />} />
        <Route path="/inbox" element={<Triage />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/extension-auth" element={<ExtensionAuth />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
