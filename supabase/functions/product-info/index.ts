import { z } from "npm:zod@3.25.76";
import { authenticate, consumeQuota, errorResponse, guardRequest, HttpError, json, structuredResponse } from "../_shared/kitchen-ai.ts";

const infoSchema = z.object({
  name: z.string().min(1).max(120),
  emoji: z.string().min(1).max(12),
  tagline: z.string().min(1).max(180),
  benefits: z.array(z.string().min(1).max(100)).max(3),
  nutrients: z.object({
    calories: z.number().min(0).max(5000), protein_g: z.number().min(0).max(500),
    carbs_g: z.number().min(0).max(1000), fat_g: z.number().min(0).max(500),
    fiber_g: z.number().min(0).max(250), sugar_g: z.number().min(0).max(500),
  }),
  serving_size: z.string().min(1).max(100),
  vitamins: z.array(z.string().min(1).max(80)).max(4),
  category: z.enum(["fruit", "vegetable", "dairy", "grain", "protein", "snack", "beverage", "other"]),
});
const jsonSchema = {
  type: "object", additionalProperties: false,
  required: ["name", "emoji", "tagline", "benefits", "nutrients", "serving_size", "vitamins", "category"],
  properties: {
    name: { type: "string" }, emoji: { type: "string" }, tagline: { type: "string" },
    benefits: { type: "array", maxItems: 3, items: { type: "string" } },
    nutrients: {
      type: "object", additionalProperties: false,
      required: ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g"],
      properties: {
        calories: { type: "number", minimum: 0, maximum: 5000 }, protein_g: { type: "number", minimum: 0, maximum: 500 },
        carbs_g: { type: "number", minimum: 0, maximum: 1000 }, fat_g: { type: "number", minimum: 0, maximum: 500 },
        fiber_g: { type: "number", minimum: 0, maximum: 250 }, sugar_g: { type: "number", minimum: 0, maximum: 500 },
      },
    },
    serving_size: { type: "string" }, vitamins: { type: "array", maxItems: 4, items: { type: "string" } },
    category: { type: "string", enum: ["fruit", "vegetable", "dairy", "grain", "protein", "snack", "beverage", "other"] },
  },
};

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

Deno.serve(async (req) => {
  const guarded = guardRequest(req);
  if (guarded) return guarded;
  try {
    const { user, userClient, serviceClient } = await authenticate(req);
    const body = await req.json() as Record<string, unknown>;
    const productName = typeof body.productName === "string" ? body.productName.trim().slice(0, 120) : "";
    if (!productName) throw new HttpError(400, "productName is required");

    if (body.includeRecipe === true) {
      const { data: recipe, error } = await userClient
        .from("recipes")
        .select("title,description,servings,prep_minutes,cook_minutes,dietary_tags,nutrition,instructions,recipe_ingredients(name,quantity,unit,preparation)")
        .ilike("title", productName)
        .eq("review_status", "approved")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!recipe) throw new HttpError(404, "No reviewed catalogue recipe found. Use the optional AI draft action if you want a new recipe.");
      const nutrition = (recipe.nutrition ?? {}) as Record<string, unknown>;
      const instructions = Array.isArray(recipe.instructions)
        ? recipe.instructions.map((step: unknown) => typeof step === "string" ? step : String((step as { text?: unknown })?.text ?? "")).filter(Boolean)
        : [];
      const ingredients = Array.isArray(recipe.recipe_ingredients)
        ? recipe.recipe_ingredients.map((ingredient: { name: string; quantity: number | null; unit: string | null; preparation: string | null }) =>
          [ingredient.quantity, ingredient.unit, ingredient.name, ingredient.preparation].filter(Boolean).join(" "))
        : [];
      return json(req, {
        name: recipe.title,
        emoji: "🍽️",
        tagline: recipe.description ?? "A reviewed Kitchen Companion recipe.",
        benefits: [],
        nutrients: {
          calories: number(nutrition.calories), protein_g: number(nutrition.protein_g), carbs_g: number(nutrition.carbs_g),
          fat_g: number(nutrition.fat_g), fiber_g: number(nutrition.fiber_g), sugar_g: number(nutrition.sugar_g),
        },
        serving_size: "1 serving",
        vitamins: [],
        category: "other",
        ingredients,
        instructions,
        prep_time: `${recipe.prep_minutes} min`,
        cook_time: `${recipe.cook_minutes} min`,
        servings: Number(recipe.servings),
        provenance: "reviewed_catalogue",
      });
    }

    await consumeQuota(serviceClient, user.id, "text");
    const aiResult = await structuredResponse({
      userId: user.id,
      serviceClient,
      capability: "nutrition_estimate",
      instructions: "You provide concise, conservative general nutrition estimates. Do not make medical claims.",
      prompt: JSON.stringify({
        product_name: productName,
        task: "Estimate nutrition for a clearly stated typical single serving.",
        rules: ["Use a realistic serving size.", "Nutrition values are estimates.", "Benefits must be modest evidence-aligned statements, not treatment claims."],
      }),
      schemaName: "product_nutrition",
      schema: jsonSchema,
      maxOutputTokens: 1000,
    });
    const info = infoSchema.parse(aiResult.data);
    return json(req, {
      ...info,
      provider: aiResult.provider,
      model: aiResult.model,
      confidence: aiResult.confidence,
      provenance: "ai_estimate",
      usage: aiResult.usage,
      disclaimer: "General estimate only; packaging and preparation can differ.",
    });
  } catch (error) {
    return errorResponse(req, error, "Product information failed");
  }
});
