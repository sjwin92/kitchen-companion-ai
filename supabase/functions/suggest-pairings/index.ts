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
    const { title, category, area, ingredients } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a culinary pairing expert. Given a main dish, suggest 2-3 complementary side dishes or accompaniments that would complete the meal. Think about what's traditionally served together and what balances the meal nutritionally (e.g., a protein dish needs a starch and/or vegetable side).

CRITICAL RULES:
- NEVER suggest a dish that contains the same primary protein as the main dish. For example, if the main dish is chicken, do NOT suggest another chicken dish.
- Focus on sides: starches (rice, bread, couscous, potatoes), vegetables, salads, or sauces.
- Return simple, common dish names that would be found in a recipe database (e.g., "steamed rice", "green salad", "garlic bread", "roasted vegetables").
- Keep suggestions practical and widely known.

You MUST respond using the suggest_pairings tool.`,
          },
          {
            role: "user",
            content: `Suggest side dishes to pair with: "${title}"${category ? ` (Category: ${category})` : ""}${area ? ` (Cuisine: ${area})` : ""}${ingredients?.length ? `\nMain ingredients: ${ingredients.slice(0, 6).join(", ")}` : ""}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_pairings",
              description: "Return complementary dish suggestions",
              parameters: {
                type: "object",
                properties: {
                  pairings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Simple dish name for recipe search" },
                        reason: { type: "string", description: "Why this pairs well (1 sentence)" },
                        search_term: { type: "string", description: "Single-word search term for TheMealDB (e.g. 'rice', 'salad', 'bread')" },
                      },
                      required: ["name", "reason", "search_term"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["pairings"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_pairings" } },
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

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-pairings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
