import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { captureGoogleTokens } from "@/lib/auth";
import SignIn from "@/pages/SignIn";
import Sources from "@/pages/Sources";
import Triage from "@/pages/Triage";
import Review from "@/pages/Review";
import { NotificationPrime } from "@/components/NotificationPrime";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) void captureGoogleTokens();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  if (!session) return <SignIn />;
  return (
    <BrowserRouter>
      {session && <NotificationPrime />}
      <Routes>
        <Route path="/" element={<Review />} />
        <Route path="/inbox" element={<Triage />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
