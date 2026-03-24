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
    const { productName } = await req.json();
    if (!productName) throw new Error("productName is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a nutritionist assistant. Given a food product name, return a JSON object with:
- "name": cleaned product name
- "emoji": a single emoji representing the food
- "tagline": a short 1-sentence health benefit (max 15 words)
- "benefits": array of 3 key health benefits (each max 8 words)
- "nutrients": object with keys "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g" — values are numbers for a typical single serving
- "serving_size": string describing the serving (e.g. "1 medium apple (182g)", "100g")
- "vitamins": array of up to 4 notable vitamins/minerals (e.g. ["Vitamin C", "Potassium"])
- "category": one of "fruit", "vegetable", "dairy", "grain", "protein", "snack", "beverage", "other"

Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: productName,
          },
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    
    // Parse JSON from response
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const info = JSON.parse(cleaned);

    return new Response(JSON.stringify(info), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
