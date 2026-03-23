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
    const { imageBase64, mealTitle, inventoryItems } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inventoryContext = Array.isArray(inventoryItems) && inventoryItems.length > 0
      ? `\n\nThe user currently has these items in their inventory:\n${inventoryItems.map((i: any) => `- ${i.name} (${i.quantity})`).join("\n")}\nWhen identifying ingredients, try to match them to these inventory items by name. Return matched inventory item IDs in the matched_inventory_ids array.`
      : "";

    const systemPrompt = `You are a precise meal nutrition analyzer modeled after professional food-tracking apps. Analyze this photo of a meal for ONE SINGLE SERVING (what one person would eat in one sitting).

Steps:
1. Identify the dish and its visible ingredients
2. Estimate realistic single-serving portion sizes based on what is visible on the plate
3. Calculate nutritional content by summing per-ingredient macros using USDA-standard values

Critical rules for accuracy:
- This is ONE person's plate, not the whole recipe. A typical single serving of meat/protein is 120-180g (4-6oz), not the full recipe amount.
- Use USDA nutrient database reference values per 100g for each ingredient, then scale to the estimated portion
- Protein per 100g references: chicken breast ~31g, chicken thigh ~26g, beef ~26g, salmon ~20g, eggs ~13g, rice ~2.7g, pasta ~5g, tofu ~8g
- Do NOT inflate protein — a 150g chicken serving = ~39-45g protein, not 80g
- Calories should reflect the sum of (protein×4 + carbs×4 + fat×9) — verify your numbers are internally consistent
- When in doubt, estimate conservatively rather than generously
- If the meal title is provided, use it as context but still base portions on what's visible${inventoryContext}

You MUST respond using the analyze_meal tool.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userText = mealTitle
      ? `Analyze this meal photo. The dish is: ${mealTitle}`
      : "Analyze this meal photo and estimate its nutritional content.";

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { type: "image_url", image_url: { url: imageBase64 } },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "analyze_meal",
                description: "Return structured meal analysis with nutrition and ingredients",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Name of the dish" },
                    calories: { type: "number", description: "Estimated total calories" },
                    protein_g: { type: "number", description: "Estimated protein in grams" },
                    carbs_g: { type: "number", description: "Estimated carbs in grams" },
                    fat_g: { type: "number", description: "Estimated fat in grams" },
                    ingredients: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", description: "Ingredient name" },
                          amount: { type: "string", description: "Estimated amount used" },
                        },
                        required: ["name", "amount"],
                        additionalProperties: false,
                      },
                    },
                    matched_inventory_ids: {
                      type: "array",
                      items: { type: "string" },
                      description: "IDs of inventory items that match identified ingredients",
                    },
                  },
                  required: ["title", "calories", "protein_g", "carbs_g", "fat_g", "ingredients"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "analyze_meal" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured response from AI");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      title: parsed.title || mealTitle || "Logged Meal",
      calories: parsed.calories || 0,
      protein_g: parsed.protein_g || 0,
      carbs_g: parsed.carbs_g || 0,
      fat_g: parsed.fat_g || 0,
      ingredients: parsed.ingredients || [],
      matched_inventory_ids: parsed.matched_inventory_ids || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("log-meal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
