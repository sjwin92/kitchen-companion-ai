import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      inventoryItems,
      dietaryPreferences,
      allergies,
      dislikedIngredients,
      servings,
      cuisinePreferences,
      cookingTime,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const inventoryList = (inventoryItems || [])
      .map((i: { name: string; daysUntilExpiry?: number }) =>
        `${i.name}${i.daysUntilExpiry !== undefined ? ` (expires in ${i.daysUntilExpiry} days)` : ""}`
      )
      .join(", ");

    const constraints: string[] = [];
    if (dietaryPreferences?.length)
      constraints.push(`Dietary requirements: ${dietaryPreferences.join(", ")}. These are STRICT — never include ingredients that violate them.`);
    if (allergies?.length)
      constraints.push(`Allergies (MUST AVOID completely): ${allergies.join(", ")}`);
    if (dislikedIngredients?.length)
      constraints.push(`Disliked ingredients (avoid): ${dislikedIngredients.join(", ")}`);
    if (cuisinePreferences?.length)
      constraints.push(`Preferred cuisines: ${cuisinePreferences.join(", ")}`);
    if (cookingTime)
      constraints.push(`Target cooking time: ${cookingTime}`);

    const constraintBlock = constraints.length
      ? `\n\nCONSTRAINTS:\n${constraints.map(c => `- ${c}`).join("\n")}`
      : "";

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a creative chef and nutritionist. Generate a complete, original recipe that prioritizes using the provided pantry items (especially those expiring soon).

Return ONLY valid JSON with these fields:
- "title": creative recipe name
- "emoji": single emoji for the dish
- "description": 1-sentence description (max 20 words)
- "category": one of "breakfast", "lunch", "dinner", "snack", "dessert"
- "cuisine": cuisine type (e.g. "Italian", "Thai", "Mexican")
- "prep_time": string (e.g. "15 min")
- "cook_time": string (e.g. "30 min")
- "servings": number
- "ingredients": array of ingredient strings with quantities, scaled for ${servings || 4} servings
- "instructions": array of step-by-step cooking instructions (each step max 2 sentences)
- "pantry_items_used": array of pantry item names used from the provided list
- "nutrition": object with "calories", "protein_g", "carbs_g", "fat_g" per serving
- "dietary_tags": array of applicable tags like "vegan", "gluten-free", "dairy-free", etc.
- "tips": one short cooking tip

Return ONLY valid JSON, no markdown.${constraintBlock}`,
            },
            {
              role: "user",
              content: `My pantry contains: ${inventoryList || "No items specified — suggest a simple meal"}.\n\nGenerate a recipe for ${servings || 4} servings.`,
            },
          ],
          temperature: 0.7,
        }),
      }
    );

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const recipe = JSON.parse(cleaned);

    return new Response(JSON.stringify(recipe), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
