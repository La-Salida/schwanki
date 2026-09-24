import { createClient } from "@supabase/supabase-js";
import webpush from "npm:web-push@^3.6.7";

webpush.setVapidDetails(
  "mailto:honk@schwanki.app",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

// Goose voice, rotating by day (docs/brand/copy.md: smug, not angry)
const LINES = [
  "Your teacher wrote down words this week. I've seen them. You haven't.",
  "Cards are due. The notebook doesn't read itself.",
  "Five minutes. That's all I'm asking. — 🪿",
  "Streaks die quietly. Open the app.",
];

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  let sent = 0; const dead: string[] = [];

  for (const sub of subs ?? []) {
    const localHour = parseInt(
      new Date().toLocaleString("en-US", { timeZone: sub.tz, hour: "2-digit", hourCycle: "h23" }), 10,
    );
    if (localHour !== sub.remind_hour) continue;

    // Skip users with nothing due — check card_state
    const { count } = await supabase.from("card_state")
      .select("*", { count: "exact", head: true })
      .eq("user_id", sub.user_id).lte("due_at", new Date().toISOString());
    if (!count) continue;

    const body = LINES[new Date().getDate() % LINES.length]!;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
        JSON.stringify({ title: `${count} cards are waiting`, body }),
      );
      sent++;
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 410) dead.push(sub.id);
    }
  }
  if (dead.length) await supabase.from("push_subscriptions").delete().in("id", dead);
  return Response.json({ sent, pruned: dead.length });
});
