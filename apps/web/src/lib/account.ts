import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export interface AccountState {
  user: User;
  balance: number | null;
  balanceError: boolean;
  refreshBalance: () => Promise<void>;
  signOut: () => Promise<void>;
}
export const AccountContext = createContext<AccountState | null>(null);

export function useAccount(): AccountState {
  const value = useContext(AccountContext);
  if (!value) throw new Error("Account controls require a signed-in account");
  return value;
}

export function accountName(user: User): string {
  return String(user.user_metadata.full_name || user.user_metadata.name || user.email?.split("@")[0] || "Your account");
}
