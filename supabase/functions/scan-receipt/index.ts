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
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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
            {
              role: "system",
              content: `You are a grocery receipt parser. Extract food items from the receipt image. 
For each item return: name (clean product name, not brand), quantity (e.g. "1", "500g", "2 lbs"), and location (best guess: "fridge", "freezer", or "cupboard").

Rules:
- Only extract FOOD items, skip non-food products, taxes, totals, store info
- Clean up names: "BNLS CHKN BRST" → "Chicken Breast"
- Guess reasonable storage locations based on the item type
- Estimate days until expiry based on item type: fresh produce 5-7, dairy 7-14, meat 3-5, frozen 60, pantry 90

You MUST respond using the extract_items tool.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all food items from this grocery receipt.",
                },
                {
                  type: "image_url",
                  image_url: { url: imageBase64 },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_items",
                description: "Extract structured food items from a receipt",
                parameters: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", description: "Clean food item name" },
                          quantity: { type: "string", description: "Quantity with unit" },
                          location: {
                            type: "string",
                            enum: ["fridge", "freezer", "cupboard"],
                            description: "Suggested storage location",
                          },
                          daysUntilExpiry: {
                            type: "number",
                            description: "Estimated days until expiry",
                          },
                        },
                        required: ["name", "quantity", "location", "daysUntilExpiry"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["items"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_items" } },
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
    const items = (parsed.items || []).map((item: any) => ({
      name: item.name,
      quantity: item.quantity || "1",
      location: item.location || "fridge",
      dateAdded: new Date().toISOString().split("T")[0],
      daysUntilExpiry: item.daysUntilExpiry || 7,
      status: item.daysUntilExpiry <= 2 ? "use-today" : item.daysUntilExpiry <= 5 ? "use-soon" : "okay",
    }));

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-receipt error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
