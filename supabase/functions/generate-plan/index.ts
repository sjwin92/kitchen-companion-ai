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
      slots,
      profile,
      slotSettings,
      inventory,
      existingPlans,
      ratings,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const inventoryList = (inventory || []).map((i: any) => i.name).join(", ");
    const existingList = (existingPlans || []).map((p: any) => p.title).join(", ");
    const ratedHighly = (ratings || []).filter((r: any) => r.rating >= 4 && r.would_repeat).map((r: any) => r.title).join(", ");
    const ratedPoorly = (ratings || []).filter((r: any) => r.rating <= 2 || !r.would_repeat).map((r: any) => r.title).join(", ");

    const slotSettingsText = (slotSettings || []).map((s: any) =>
      `${s.slot}: prep≤${s.target_prep_time}, complexity=${s.complexity}${s.cuisine_preference ? `, cuisine=${s.cuisine_preference}` : ''}${s.quick_bias ? ', quick' : ''}${s.family_friendly_bias ? ', family-friendly' : ''}${s.pantry_first_bias ? ', pantry-first' : ''}${s.budget_friendly_bias ? ', budget' : ''}`
    ).join('\n');

    const slotsToFill = (slots || []).map((s: any) => `${s.date} ${s.slot}`).join(', ');
    const totalSlots = (slots || []).length;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a meal planning assistant. Generate a weekly meal plan for a household.

RULES:
- You MUST generate exactly one meal for EVERY slot listed — all ${totalSlots} of them, no exceptions
- Each suggestion should be a real, recognizable dish name (not generic like "healthy salad")
- Use simple, common dish names that could be found in a recipe database
- For breakfast slots, suggest items like: porridge, scrambled eggs on toast, yogurt with granola, pancakes, avocado toast, cereal
- For lunch slots, suggest items like: sandwich, soup, salad, wraps, jacket potato
- For dinner slots, suggest proper meals: pasta, curry, stir fry, roast, casserole, grilled chicken etc.
- Respect ALL dietary restrictions and allergies strictly
- Avoid disliked ingredients
- Prefer dishes from preferred cuisines when specified
- Consider cooking time and complexity preferences
- If pantry-first bias: prioritize meals using available inventory
- Avoid repeating the same meal within the week
- Avoid meals the user rated poorly
- Include meals the user rated highly occasionally
- Keep variety across the week

You MUST respond using the generate_plan tool with all ${totalSlots} meals filled.`,
          },
          {
            role: "user",
            content: `Generate meals for ALL of these ${totalSlots} empty slots: ${slotsToFill}

Household: ${profile?.householdSize || 2} people
Diet: ${(profile?.dietaryPreferences || []).join(', ') || 'None'}
Allergies: ${(profile?.allergies || []).join(', ') || 'None'}
Disliked ingredients: ${(profile?.dislikedIngredients || []).join(', ') || 'None'}
Preferred cuisines: ${(profile?.preferredCuisines || []).join(', ') || 'Any'}
Max cooking time: ${profile?.cookingTime || '30 min'}
Cooking confidence: ${profile?.cookingConfidence || 'intermediate'}
Budget: ${profile?.budgetSensitivity || 'medium'}
Primary goal: ${profile?.primaryGoal || 'variety'}

${slotSettingsText ? `Slot-specific preferences:\n${slotSettingsText}` : ''}
${inventoryList ? `Available in pantry: ${inventoryList}` : ''}
${existingList ? `Already planned this week: ${existingList}` : ''}
${ratedHighly ? `User enjoyed: ${ratedHighly}` : ''}
${ratedPoorly ? `User didn't enjoy: ${ratedPoorly}` : ''}

Remember: return exactly ${totalSlots} meal entries, one for each slot listed above.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_plan",
              description: "Return meal suggestions for each empty slot",
              parameters: {
                type: "object",
                properties: {
                  meals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        date: { type: "string", description: "YYYY-MM-DD date" },
                        slot: { type: "string", description: "breakfast, lunch, dinner, or snack" },
                        title: { type: "string", description: "Simple dish name" },
                        search_term: { type: "string", description: "1-2 word search term for recipe lookup" },
                      },
                      required: ["date", "slot", "title", "search_term"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["meals"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No response from AI");

    const parsed = JSON.parse(toolCall.function.arguments);
    const meals = parsed.meals || [];

    return new Response(JSON.stringify({ meals }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
