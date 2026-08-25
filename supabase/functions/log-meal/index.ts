import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";
import { z } from "npm:zod@3.25.76";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];

function rangeSchema(type: "integer" | "number") {
  return { type: "object", additionalProperties: false, required: ["low", "high"], properties: { low: { type, minimum: 0 }, high: { type, minimum: 0 } } };
}

const nutritionSchema = z.object({
  title: z.string().min(1).max(120),
  calories: z.number().int().min(0).max(5000),
  protein_g: z.number().min(0).max(500),
  carbs_g: z.number().min(0).max(1000),
  fat_g: z.number().min(0).max(500),
  ranges: z.object({
    calories: z.object({ low: z.number().int().min(0), high: z.number().int().min(0) }),
    protein_g: z.object({ low: z.number().min(0), high: z.number().min(0) }),
    carbs_g: z.object({ low: z.number().min(0), high: z.number().min(0) }),
    fat_g: z.object({ low: z.number().min(0), high: z.number().min(0) }),
  }),
  confidence: z.number().min(0).max(1),
  ingredients: z.array(z.object({ name: z.string().min(1).max(100), amount: z.string().min(1).max(80), confidence: z.number().min(0).max(1) })).max(40),
  matched_inventory_ids: z.array(z.string().uuid()).max(40),
  notes: z.array(z.string().max(160)).max(8),
});

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "calories", "protein_g", "carbs_g", "fat_g", "ranges", "confidence", "ingredients", "matched_inventory_ids", "notes"],
  properties: {
    title: { type: "string" }, calories: { type: "integer", minimum: 0, maximum: 5000 },
    protein_g: { type: "number", minimum: 0, maximum: 500 }, carbs_g: { type: "number", minimum: 0, maximum: 1000 }, fat_g: { type: "number", minimum: 0, maximum: 500 },
    ranges: { type: "object", additionalProperties: false, required: ["calories", "protein_g", "carbs_g", "fat_g"], properties: { calories: rangeSchema("integer"), protein_g: rangeSchema("number"), carbs_g: rangeSchema("number"), fat_g: rangeSchema("number") } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    ingredients: { type: "array", maxItems: 40, items: { type: "object", additionalProperties: false, required: ["name", "amount", "confidence"], properties: { name: { type: "string" }, amount: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 } } } },
    matched_inventory_ids: { type: "array", maxItems: 40, items: { type: "string", format: "uuid" } },
    notes: { type: "array", maxItems: 8, items: { type: "string" } },
  },
};

function allowedOrigins() {
  return [...DEFAULT_ORIGINS, ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean)];
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins().includes(origin) ? origin : DEFAULT_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function getOutputText(payload: Record<string, unknown>): string | null {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
    }
  }
  return null;
}

async function safetyIdentifier(userId: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins().includes(origin)) return json(req, { error: "Origin not allowed" }, 403);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !openAiKey) throw new Error("Server configuration is incomplete");

    const authorization = req.headers.get("authorization");
    if (!authorization) return json(req, { error: "Authentication required" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json(req, { error: "Authentication required" }, 401);

    const body = await req.json();
    const imagePath = typeof body.imagePath === "string" ? body.imagePath : "";
    if (!imagePath.startsWith(`${user.id}/`)) return json(req, { error: "Invalid meal image path" }, 400);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: quotaAllowed, error: quotaError } = await serviceClient.rpc("consume_ai_quota", { p_user_id: user.id, p_usage_kind: "vision" });
    if (quotaError) throw quotaError;
    if (!quotaAllowed) return json(req, { error: "Daily Nutrition Scan limit reached" }, 429);

    const { data: imageBlob, error: downloadError } = await serviceClient.storage.from("meal-photos").download(imagePath);
    if (downloadError || !imageBlob) return json(req, { error: "Meal image not found" }, 404);
    if (imageBlob.size > MAX_IMAGE_BYTES) return json(req, { error: "Meal image is too large" }, 413);
    if (!["image/jpeg", "image/png", "image/webp"].includes(imageBlob.type)) return json(req, { error: "Unsupported meal image type" }, 415);

    const bytes = new Uint8Array(await imageBlob.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    const imageDataUrl = `data:${imageBlob.type};base64,${btoa(binary)}`;

    const { data: inventory } = await userClient.from("current_inventory").select("id,name,quantity,quantity_value,unit").limit(80);
    const inventoryText = (inventory ?? []).map((item) => `- ${item.name} (${item.quantity_value ?? item.quantity}${item.unit ? ` ${item.unit}` : ""}) [${item.id}]`).join("\n");
    const mealTitle = typeof body.mealTitle === "string" ? body.mealTitle.trim().slice(0, 120) : "";
    const recipeContext = body.recipeContext && typeof body.recipeContext === "object" ? JSON.stringify(body.recipeContext).slice(0, 6000) : "none";
    const prompt = `Estimate nutrition for the single serving shown. Treat every number as an estimate, not medical advice. Return a point estimate and an honest low/high range for calories and each macro. Use the visible portion as primary evidence and recipe context only as supporting evidence. Match inventory IDs only when clear. Ensure low <= point <= high.\n\nMeal title: ${mealTitle || "not provided"}\nRecipe context: ${recipeContext}\nInventory:\n${inventoryText || "none"}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-5.6-terra", store: false, safety_identifier: await safetyIdentifier(user.id),
          instructions: "You are Kitchen Companion's nutrition estimation assistant. Be conservative, uncertainty-aware, and concise. Never claim medical or laboratory accuracy.",
          input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: imageDataUrl, detail: "high" }] }],
          text: { format: { type: "json_schema", name: "nutrition_estimate", strict: true, schema: jsonSchema } },
          max_output_tokens: 1800,
        }),
      });
    } finally { clearTimeout(timeout); }

    if (!response.ok) {
      const providerError = await response.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
      const errorCode = providerError.error?.code ?? providerError.error?.type ?? "unknown";
      console.error("OpenAI Nutrition Scan failed", { status: response.status, errorCode, requestId: response.headers.get("x-request-id") });
      if (errorCode === "credit_balance_exhausted" || errorCode === "insufficient_quota") {
        return json(req, { error: "Nutrition Scan is temporarily unavailable" }, 503);
      }
      if (response.status === 429) return json(req, { error: "Nutrition Scan is busy. Try again shortly." }, 429);
      throw new Error("Nutrition Scan could not analyze this image");
    }
    const payload = await response.json() as Record<string, unknown>;
    const outputText = getOutputText(payload);
    if (!outputText) throw new Error("Nutrition Scan returned no estimate");
    const parsed = nutritionSchema.parse(JSON.parse(outputText));
    const rangesValid = Object.entries(parsed.ranges).every(([key, range]) => {
      const point = parsed[key as "calories" | "protein_g" | "carbs_g" | "fat_g"];
      return range.low <= point && range.high >= point;
    });
    if (!rangesValid) throw new Error("Nutrition Scan returned inconsistent ranges");
    const macroCalories = parsed.protein_g * 4 + parsed.carbs_g * 4 + parsed.fat_g * 9;
    const mismatch = parsed.calories > 0 ? Math.abs(macroCalories - parsed.calories) / parsed.calories : 0;
    return json(req, {
      ...parsed,
      confidence: mismatch > 0.3 ? Math.min(parsed.confidence, 0.45) : parsed.confidence,
      notes: mismatch > 0.3 ? [...parsed.notes, "Calories and macro-derived energy differ; review before confirming."] : parsed.notes,
      model: "gpt-5.6-terra", provenance: "vision_estimate", image_path: imagePath,
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Nutrition Scan timed out. Try a clearer photo." : error instanceof z.ZodError ? "Nutrition Scan returned an invalid estimate" : error instanceof Error ? error.message : "Nutrition Scan failed";
    console.error("Nutrition Scan error", { message });
    return json(req, { error: message }, 500);
  }
});
