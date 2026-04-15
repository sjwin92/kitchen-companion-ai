import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractJsonFromResponse(response: string): any {
  let cleaned = response.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const jsonStart = cleaned.search(/[\{\[]/);
  if (jsonStart === -1) throw new Error("No JSON found in response");
  const startChar = cleaned[jsonStart];
  const endChar = startChar === '[' ? ']' : '}';
  const jsonEnd = cleaned.lastIndexOf(endChar);
  if (jsonEnd === -1) throw new Error("No closing bracket found");
  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, "");
    try {
      return JSON.parse(cleaned);
    } catch {
      let braces = 0, brackets = 0;
      for (const char of cleaned) {
        if (char === '{') braces++;
        if (char === '}') braces--;
        if (char === '[') brackets++;
        if (char === ']') brackets--;
      }
      let repaired = cleaned;
      while (brackets > 0) { repaired += ']'; brackets--; }
      while (braces > 0) { repaired += '}'; braces--; }
      return JSON.parse(repaired);
    }
  }
}

async function generateFoodImage(title: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `Generate a beautiful, appetizing overhead food photograph of "${title}". The dish should be plated on a simple ceramic plate, natural lighting, clean background, professional food photography style. No text or watermarks.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return imageUrl || null;
  } catch {
    return null;
  }
}

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
      cookingConfidence,
      maxPrepTime,
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
    if (maxPrepTime)
      constraints.push(`Maximum total prep+cook time: ${maxPrepTime} minutes. The recipe MUST be completable within this time.`);
    if (cookingConfidence) {
      const confMap: Record<string, string> = {
        beginner: "Keep this recipe SIMPLE. Use basic techniques only (boiling, frying, baking). No complex knife skills, no specialty equipment. Maximum 6 ingredients, maximum 5 steps.",
        intermediate: "This recipe can use standard cooking techniques. Keep ingredients reasonable (8-12). Clear instructions.",
        advanced: "This recipe can use advanced techniques, complex flavor profiles, and specialty ingredients. Be creative and ambitious.",
        master: "No restrictions on technique or complexity. Use professional-level methods, rare ingredients, multi-step preparations. Create a restaurant-quality dish.",
      };
      if (confMap[cookingConfidence]) constraints.push(`Cooking skill level: ${cookingConfidence}. ${confMap[cookingConfidence]}`);
    }

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

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI returned ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    console.log("AI response length:", content.length, "preview:", content.substring(0, 100));
    
    if (!content || content.length < 10) {
      throw new Error("AI returned empty or too-short response");
    }
    
    const recipe = extractJsonFromResponse(content);

    // Generate a food image for the recipe
    const imageUrl = await generateFoodImage(recipe.title, LOVABLE_API_KEY);
    if (imageUrl) {
      recipe.image = imageUrl;
    }

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
