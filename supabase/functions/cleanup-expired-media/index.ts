import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const cronSecret = Deno.env.get("REMINDER_CRON_SECRET");
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return new Response("Server configuration is incomplete", { status: 500 });
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const startedAt = new Date().toISOString();

  const { data: expiredImages, error: readError } = await db
    .from("meal_log")
    .select("id,image_path")
    .not("image_path", "is", null)
    .lte("image_delete_after", startedAt)
    .limit(500);
  if (readError) return new Response("Retention records unavailable", { status: 500 });

  const rows = expiredImages ?? [];
  const paths = rows.map((row) => row.image_path).filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error: removeError } = await db.storage.from("meal-photos").remove(paths);
    if (removeError) return new Response("Expired media could not be removed", { status: 500 });
    const { error: updateError } = await db
      .from("meal_log")
      .update({ image_path: null, image_delete_after: null })
      .in("id", rows.map((row) => row.id));
    if (updateError) return new Response("Retention records could not be finalized", { status: 500 });
  }

  await db.from("maintenance_events").insert({
    operation: "meal_photo_retention",
    status: "succeeded",
    affected_rows: paths.length,
    metadata: { batch_limit: 500 },
  });

  return new Response(JSON.stringify({ expired_images_removed: paths.length, ran_at: startedAt }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
