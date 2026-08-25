import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";
import webpush from "npm:web-push@3.6.7";

function localParts(timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey || req.headers.get("authorization") !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:privacy@kitchencompanion.app";
  if (!supabaseUrl || !vapidPublic || !vapidPrivate) return new Response("Server configuration is incomplete", { status: 500 });
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: preferences, error } = await db
    .from("notification_preferences")
    .select("user_id,notify_hour,timezone,last_expiry_sent_on")
    .eq("expiry_reminders", true);
  if (error) return new Response("Preferences unavailable", { status: 500 });

  let sent = 0;
  for (const preference of preferences ?? []) {
    const local = localParts(preference.timezone || "Europe/London");
    if (local.hour !== preference.notify_hour || local.date === preference.last_expiry_sent_on) continue;
    const { data: items } = await db
      .from("current_inventory")
      .select("name,freshness_state")
      .eq("user_id", preference.user_id)
      .in("freshness_state", ["expired", "use_today", "use_soon"])
      .limit(20);
    if (!items?.length) continue;
    const urgent = items.filter((item) => item.freshness_state === "expired" || item.freshness_state === "use_today").length;
    const body = urgent > 0
      ? `${urgent} item${urgent === 1 ? " needs" : "s need"} attention today; ${items.length} to use soon.`
      : `${items.length} item${items.length === 1 ? " is" : "s are"} coming up for use.`;
    const { data: subscriptions } = await db
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth_key")
      .eq("user_id", preference.user_id)
      .eq("enabled", true);
    for (const subscription of subscriptions ?? []) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
        }, JSON.stringify({ title: "Kitchen Companion", body, url: "/use-soon" }));
        sent += 1;
      } catch (pushError) {
        const status = Number((pushError as { statusCode?: number }).statusCode ?? 0);
        await db.from("push_subscriptions").update({
          enabled: ![404, 410].includes(status),
          last_error: `Push failed (${status || "unknown"})`,
          updated_at: new Date().toISOString(),
        }).eq("id", subscription.id);
      }
    }
    await db.from("notification_preferences").update({ last_expiry_sent_on: local.date }).eq("user_id", preference.user_id);
  }

  const { data: expiredImages } = await db
    .from("meal_log")
    .select("id,image_path")
    .not("image_path", "is", null)
    .lte("image_delete_after", new Date().toISOString())
    .limit(500);
  const paths = (expiredImages ?? []).map((row) => row.image_path).filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error: removeError } = await db.storage.from("meal-photos").remove(paths);
    if (!removeError) await db.from("meal_log").update({ image_path: null, image_delete_after: null }).in("id", (expiredImages ?? []).map((row) => row.id));
  }

  return new Response(JSON.stringify({ sent, expired_images_removed: paths.length }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
