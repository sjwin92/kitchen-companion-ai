import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const DEFAULT_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];

function origins() {
  return [...DEFAULT_ORIGINS, ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(value => value.trim()).filter(Boolean)];
}

function headers(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": origins().includes(origin) ? origin : DEFAULT_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function respond(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: headers(req) });
  if (req.method !== "POST") return respond(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin");
  if (origin && !origins().includes(origin)) return respond(req, { error: "Origin not allowed" }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return respond(req, { error: "Server configuration is incomplete" }, 503);
  if (!authorization) return respond(req, { error: "Authentication required" }, 401);

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return respond(req, { error: "Authentication required" }, 401);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: usage, error: usageError } = await service
    .from("ai_usage_events")
    .select("capability,estimated_cost_gbp,actual_cost_gbp,status")
    .in("status", ["reserved", "succeeded"])
    .gte("created_at", monthStart.toISOString());
  if (usageError) return respond(req, { error: "AI budget status is unavailable" }, 503);
  const spent = (usage ?? []).reduce((total, event) => total + Number(event.actual_cost_gbp ?? event.estimated_cost_gbp ?? 0), 0);
  const visionCapabilities = new Set(["inventory_vision", "receipt_extraction", "expiry_extraction", "nutrition_estimate"]);
  const visionSpent = (usage ?? []).filter(event => visionCapabilities.has(event.capability)).reduce((total, event) => total + Number(event.actual_cost_gbp ?? event.estimated_cost_gbp ?? 0), 0);
  const textSpent = Math.max(0, spent - visionSpent);
  const remaining = Math.max(0, Number((10 - spent).toFixed(4)));
  const paidAvailable = spent < 10;
  const visionAvailable = paidAvailable && visionSpent < 7;
  const privateDraftAvailable = paidAvailable && spent < 9 && textSpent < 2;
  const gemini = Boolean(Deno.env.get("GEMINI_API_KEY"));
  const pricing = Boolean(Deno.env.get("PRICING_API_URL"));
  const monitoring = Deno.env.get("MONITORING_ENABLED") === "true";

  const paid = (capability: string, budgetAvailable = visionAvailable) => ({
    capability,
    available: gemini && budgetAvailable,
    reason: !gemini ? "provider_not_configured" : !budgetAvailable ? "budget_exhausted" : "ready",
    ...(gemini ? { provider: "gemini" } : {}),
    budgetRemainingGbp: remaining,
  });

  return respond(req, {
    capabilities: [
      paid("inventory_vision"),
      paid("receipt_extraction"),
      paid("expiry_extraction"),
      paid("nutrition_estimate"),
      paid("private_recipe_draft", privateDraftAvailable),
      { capability: "live_pricing", available: pricing, reason: pricing ? "ready" : "integration_not_configured" },
      { capability: "barcode_lookup", available: true, reason: "available_without_ai" },
      { capability: "monitoring", available: monitoring, reason: monitoring ? "ready" : "monitoring_not_configured" },
    ],
  });
});
