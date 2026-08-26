import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";
import { z } from "npm:zod@3.25.76";
import { findDietaryConflicts, foodTextMatchesTerm } from "../_shared/dietary-rules.ts";

const DEFAULT_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];

const recipeSchema = z.object({
  title: z.string().min(1).max(120),
  emoji: z.string().min(1).max(12),
  description: z.string().min(1).max(240),
  category: z.enum(["breakfast", "lunch", "dinner", "snack", "dessert"]),
  cuisine: z.string().min(1).max(80),
  prep_time: z.string().min(1).max(40),
  cook_time: z.string().min(1).max(40),
  servings: z.number().int().min(1).max(12),
  ingredients: z.array(z.object({
    name: z.string().min(1).max(100),
    quantity: z.number().positive().max(10000),
    unit: z.string().min(1).max(30),
    optional: z.boolean(),
  })).min(2).max(30),
  instructions: z.array(z.string().min(1).max(500)).min(1).max(20),
  pantry_items_used: z.array(z.string().min(1).max(100)).max(30),
  nutrition: z.object({
    calories: z.number().int().min(0).max(5000),
    protein_g: z.number().min(0).max(500),
    carbs_g: z.number().min(0).max(1000),
    fat_g: z.number().min(0).max(500),
  }),
  dietary_tags: z.array(z.string().min(1).max(60)).max(20),
  tips: z.string().min(1).max(300),
});

const recipeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "emoji", "description", "category", "cuisine", "prep_time", "cook_time", "servings", "ingredients", "instructions", "pantry_items_used", "nutrition", "dietary_tags", "tips"],
  properties: {
    title: { type: "string" }, emoji: { type: "string" }, description: { type: "string" },
    category: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack", "dessert"] },
    cuisine: { type: "string" }, prep_time: { type: "string" }, cook_time: { type: "string" },
    servings: { type: "integer", minimum: 1, maximum: 12 },
    ingredients: {
      type: "array", minItems: 2, maxItems: 30,
      items: {
        type: "object", additionalProperties: false,
        required: ["name", "quantity", "unit", "optional"],
        properties: {
          name: { type: "string" },
          quantity: { type: "number", exclusiveMinimum: 0, maximum: 10000 },
          unit: { type: "string" },
          optional: { type: "boolean" },
        },
      },
    },
    instructions: { type: "array", minItems: 1, maxItems: 20, items: { type: "string" } },
    pantry_items_used: { type: "array", maxItems: 30, items: { type: "string" } },
    nutrition: {
      type: "object", additionalProperties: false,
      required: ["calories", "protein_g", "carbs_g", "fat_g"],
      properties: {
        calories: { type: "integer", minimum: 0, maximum: 5000 },
        protein_g: { type: "number", minimum: 0, maximum: 500 },
        carbs_g: { type: "number", minimum: 0, maximum: 1000 },
        fat_g: { type: "number", minimum: 0, maximum: 500 },
      },
    },
    dietary_tags: { type: "array", maxItems: 20, items: { type: "string" } },
    tips: { type: "string" },
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function outputText(payload: Record<string, unknown>): string | null {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
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
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json(req, { error: "Authentication required" }, 401);

    const requestBody = await req.json() as Record<string, unknown>;
    const requestedServings = Number(requestBody.servings ?? 4);
    const servings = Number.isInteger(requestedServings) ? Math.min(12, Math.max(1, requestedServings)) : 4;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: quotaAllowed, error: quotaError } = await serviceClient.rpc("consume_ai_quota", {
      p_user_id: user.id,
      p_usage_kind: "text",
    });
    if (quotaError) throw quotaError;
    if (!quotaAllowed) return json(req, { error: "Daily AI recipe draft limit reached" }, 429);

    const [{ data: inventory, error: inventoryError }, { data: profile, error: profileError }] = await Promise.all([
      userClient.from("current_inventory").select("name,quantity,quantity_value,unit,expiry_date,freshness_state").limit(80),
      userClient.from("profiles").select("household_size,dietary_preferences,allergies,disliked_ingredients,preferred_cuisines,cooking_confidence,max_prep_time").single(),
    ]);
    if (inventoryError || profileError || !profile) throw new Error("Kitchen profile could not be loaded");

    const pantry = (inventory ?? []).map((item) => ({
      name: item.name,
      quantity: item.quantity_value ?? item.quantity,
      unit: item.unit,
      expires: item.expiry_date,
      freshness: item.freshness_state,
    }));
    const prompt = JSON.stringify({
      task: "Draft one original recipe only because the user explicitly requested an AI fallback.",
      servings,
      pantry,
      constraints: {
        dietary_requirements: profile.dietary_preferences ?? [],
        allergies_must_never_include: profile.allergies ?? [],
        disliked_ingredients_avoid: profile.disliked_ingredients ?? [],
        preferred_cuisines: profile.preferred_cuisines ?? [],
        cooking_confidence: profile.cooking_confidence ?? "intermediate",
        maximum_total_minutes: profile.max_prep_time ?? 60,
      },
      priorities: [
        "Use food marked expired, use_today, or use_soon only when it is safe and appropriate; never imply expired food is safe.",
        "Use as many suitable pantry ingredients as practical without inventing availability.",
        "List every missing ingredient explicitly in the full ingredients list.",
        "Nutrition values are rough per-serving estimates and must not be presented as medical advice.",
      ],
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          store: false,
          safety_identifier: await safetyIdentifier(user.id),
          instructions: "You are Kitchen Companion's recipe drafting assistant. Follow allergies and dietary restrictions strictly. Produce concise, practical recipes. This is an AI draft, not reviewed catalogue content.",
          input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
          text: { format: { type: "json_schema", name: "recipe_draft", strict: true, schema: recipeJsonSchema } },
          max_output_tokens: 2400,
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.error("OpenAI recipe draft failed", { status: response.status, requestId: response.headers.get("x-request-id") });
      if (response.status === 429) return json(req, { error: "Recipe drafting is busy. Try again shortly." }, 429);
      throw new Error("Recipe draft could not be created");
    }

    const payload = await response.json() as Record<string, unknown>;
    const text = outputText(payload);
    if (!text) throw new Error("Recipe draft returned no content");
    const recipe = recipeSchema.parse(JSON.parse(text));
    const recipeFoods = [recipe.title, ...recipe.ingredients.map((ingredient) => ingredient.name)];
    const dietaryConflicts = findDietaryConflicts(recipeFoods, profile.dietary_preferences ?? []);
    const allergyConflict = recipeFoods.some((food) =>
      (profile.allergies ?? []).some((allergy) => foodTextMatchesTerm(food, allergy))
    );
    const dislikeConflict = recipeFoods.some((food) =>
      (profile.disliked_ingredients ?? []).some((dislike) => foodTextMatchesTerm(food, dislike))
    );
    if (dietaryConflicts.length > 0 || allergyConflict || dislikeConflict) {
      throw new Error("Recipe draft did not satisfy your saved food requirements. Please try again.");
    }

    const { data: savedDraft, error: saveError } = await userClient
      .from("user_recipes")
      .insert({
        user_id: user.id,
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        nutrition: recipe.nutrition,
        provenance: "ai_assisted",
      })
      .select("id")
      .single();
    if (saveError) throw new Error("Recipe draft could not be saved");

    return json(req, {
      ...recipe,
      user_recipe_id: savedDraft.id,
      model: "gpt-5.6-luna",
      provenance: "ai_assisted",
      review_status: "private_draft",
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Recipe drafting timed out. Try again."
      : error instanceof z.ZodError
      ? "Recipe draft returned an invalid result"
      : error instanceof Error
      ? error.message
      : "Recipe drafting failed";
    console.error("Recipe drafting error", { message });
    return json(req, { error: message }, 500);
  }
});
