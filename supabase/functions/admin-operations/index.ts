import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const DEFAULT_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];
const allowedOrigins = () => [...DEFAULT_ORIGINS, ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(value => value.trim()).filter(Boolean)];

function headers(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins().includes(origin) ? origin : DEFAULT_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

const respond = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headers(req) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: headers(req) });
  if (req.method !== "POST") return respond(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins().includes(origin)) return respond(req, { error: "Origin not allowed" }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("authorization");
  if (!supabaseUrl || !anonKey || !serviceKey) return respond(req, { error: "Server configuration is incomplete" }, 503);
  if (!authorization) return respond(req, { error: "Authentication required" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return respond(req, { error: "Authentication required" }, 401);
  if (user.app_metadata?.role !== "admin") return respond(req, { error: "Administrator access required" }, 403);
  const { data: assurance, error: assuranceError } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance.currentLevel !== "aal2") {
    return respond(req, { error: "Administrator MFA verification required" }, 403);
  }

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return respond(req, { error: "Invalid JSON body" }, 400);
  }

  const action = body.action;
  if (action === "review_recipe") {
    const { data, error } = await service.rpc("edge_review_catalogue_recipe", {
      p_reviewer_id: user.id,
      p_recipe_id: body.recipeId,
      p_decision: body.decision,
      p_checklist: body.checklist,
      p_notes: body.notes ?? null,
      p_verification_tier: body.verificationTier ?? "editorial_reviewed",
    });
    if (error) return respond(req, { error: error.message }, 400);
    return respond(req, { data });
  }

  if (action === "promote_submission") {
    const { data, error } = await service.rpc("edge_promote_recipe_submission", {
      p_reviewer_id: user.id,
      p_submission_id: body.submissionId,
      p_slug: body.slug,
      p_reviewer_notes: body.notes ?? null,
    });
    if (error) return respond(req, { error: error.message }, 400);
    return respond(req, { data });
  }

  if (action === "create_invite") {
    const { data, error } = await service.rpc("create_beta_invite", {
      p_email: body.email,
      p_code: body.code,
      p_expires_at: body.expiresAt,
    });
    if (error) return respond(req, { error: error.message }, 400);
    return respond(req, { data });
  }

  if (action === "approve_creator_outreach") {
    const { data, error } = await service.from("creator_partnerships")
      .update({ status: "approved_for_outreach", founder_approved_at: new Date().toISOString() })
      .eq("id", body.partnershipId)
      .eq("status", "prospect")
      .select("id")
      .maybeSingle();
    if (error || !data) return respond(req, { error: error?.message ?? "Partnership was not eligible for approval" }, 400);
    return respond(req, { data });
  }

  return respond(req, { error: "Unsupported admin action" }, 400);
});
