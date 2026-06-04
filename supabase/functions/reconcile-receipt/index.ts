import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You parse UK grocery receipts. Extract every purchasable item, the grand total in GBP, and the retailer name if visible.

RULES:
- Clean abbreviated names: "BNLS CHKN BRST" → "Chicken Breast"
- Include every food item line with its price in GBP (omit price if not legible)
- SKIP totals, subtotals, VAT/tax lines, savings, discounts, store info, payment method
- The total is the FINAL amount paid (post-discount, post-tax)
- Retailer: Tesco, Sainsbury's, Asda, Morrisons, Aldi, Lidl, M&S, Waitrose, Co-op, Iceland, etc.
- If you can't read the total clearly, return 0

You MUST respond using the parse_receipt tool.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Parse this grocery receipt." },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "parse_receipt",
            description: "Extract structured receipt data",
            parameters: {
              type: "object",
              properties: {
                retailer: { type: "string", description: "Supermarket name or empty" },
                total: { type: "number", description: "Final amount paid in GBP" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      price: { type: "number", description: "Item price in GBP, 0 if unknown" },
                    },
                    required: ["name", "price"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["retailer", "total", "items"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "parse_receipt" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No structured response");
    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      retailer: parsed.retailer || null,
      total: Number(parsed.total) || 0,
      items: (parsed.items || []).filter((i: any) => i?.name).map((i: any) => ({
        name: String(i.name).trim(),
        price: Number(i.price) || 0,
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("reconcile-receipt error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
