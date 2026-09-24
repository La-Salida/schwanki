import { supabase } from "./supabase";

export async function subscribePush(remindHour: number): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY as string,
  });
  const json = sub.toJSON();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
    remind_hour: remindHour,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }, { onConflict: "endpoint" });
  return !error;
}
