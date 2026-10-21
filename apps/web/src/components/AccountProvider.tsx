import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { api, supabase } from "@/lib/supabase";
import { AccountContext } from "@/lib/account";
import { CREDITS_CHANGED } from "@/lib/creditEvents";
import { prepareSignOut } from "@/offline/signOut";

export function AccountProvider({ user, children }: { user: User; children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const requestSequence = useRef(0);
  const refreshBalance = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const next = await api.creditBalance();
      if (sequence === requestSequence.current) { setBalance(next); setBalanceError(false); }
    } catch { if (sequence === requestSequence.current) setBalanceError(true); }
  }, []);
  useEffect(() => {
    // Synchronize remote balance; setters run only after the network promise settles.
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshBalance();
    const refresh = () => { if (document.visibilityState === "visible") void refreshBalance(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener(CREDITS_CHANGED, refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener(CREDITS_CHANGED, refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, [refreshBalance]);
  const signOut = useCallback(async () => {
    await prepareSignOut();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  }, []);
  return <AccountContext.Provider value={{ user, balance, balanceError, refreshBalance, signOut }}>{children}</AccountContext.Provider>;
}

