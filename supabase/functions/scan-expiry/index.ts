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
    const { imageBase64, itemNames } = await req.json();
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

    const itemList = Array.isArray(itemNames) && itemNames.length > 0
      ? `\n\nThe user has these items in their scan: ${itemNames.join(", ")}. Try to match expiry dates to these specific items.`
      : "";

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
              content: `You are an expiry date scanner. Look at this photo of food product labels and extract any visible expiry dates, best-before dates, or use-by dates.

For each date found, return the product name and the expiry date in YYYY-MM-DD format.

Rules:
- Look for text like "Best Before", "Use By", "Exp", "BB", "BBE", dates printed on packaging
- Convert all dates to YYYY-MM-DD format
- If you see a date like "05/2026" with no day, use the last day of that month
- If you see "28 MAR 2026", convert to "2026-03-28"
- Only return dates you can clearly read — do not guess
- Try to identify which product each date belongs to${itemList}

You MUST respond using the extract_dates tool.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all visible expiry dates from this photo." },
                { type: "image_url", image_url: { url: imageBase64 } },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_dates",
                description: "Extract expiry dates from product labels",
                parameters: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          itemName: { type: "string", description: "Product name the date belongs to" },
                          expiryDate: { type: "string", description: "Expiry date in YYYY-MM-DD format" },
                        },
                        required: ["itemName", "expiryDate"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["results"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_dates" } },
        }),
      }
    );

    if (!response.ok) {
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

    return new Response(JSON.stringify({ results: parsed.results || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-expiry error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
