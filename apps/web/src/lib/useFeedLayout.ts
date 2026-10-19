import { useEffect, useState } from "react";

/** Feed layout on phone-width screens; the desktop keeps the flashcard with its rating row. */
export function useFeedLayout(): boolean {
  const query = "(max-width: 639px)";
  const [phone, setPhone] = useState(() => typeof window.matchMedia === "function" && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}
