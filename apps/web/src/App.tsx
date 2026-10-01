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
import { NotificationPrime } from "@/components/NotificationPrime";

function Nav() {
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1 text-sm font-bold ${isActive ? "bg-ink text-cream" : "text-ink/60 hover:text-ink"}`;
  return (
    <nav className="mx-auto flex max-w-xl items-center gap-2 p-4">
      <span className="mr-auto text-lg font-black">🪿 Schwanki</span>
      <NavLink to="/" end className={link}>Review</NavLink>
      <NavLink to="/inbox" className={link}>Inbox</NavLink>
      <NavLink to="/sources" className={link}>Sources</NavLink>
      <NavLink to="/settings" className={link}>Settings</NavLink>
    </nav>
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
  if (session === undefined) return null;
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
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
