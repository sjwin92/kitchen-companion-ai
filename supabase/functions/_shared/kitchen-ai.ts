import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const DEFAULT_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function allowedOrigins() {
  return [...DEFAULT_ORIGINS, ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean)];
}

export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins().includes(origin) ? origin : DEFAULT_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}

export function guardRequest(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins().includes(origin)) return json(req, { error: "Origin not allowed" }, 403);
  return null;
}

export async function authenticate(req: Request): Promise<{
  user: User;
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
}> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Server configuration is incomplete");
  }
  const authorization = req.headers.get("authorization");
  if (!authorization) throw new HttpError(401, "Authentication required");
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new HttpError(401, "Authentication required");
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  return { user, userClient, serviceClient };
}

export async function consumeQuota(serviceClient: SupabaseClient, userId: string, usageKind: "vision" | "text" | "image") {
  const { data: allowed, error: quotaError } = await serviceClient.rpc("consume_ai_quota", {
    p_user_id: userId,
    p_usage_kind: usageKind,
  });
  if (quotaError) throw quotaError;
  if (!allowed) throw new HttpError(429, `Daily ${usageKind} AI limit reached`);
}

export async function authenticateAndQuota(req: Request, usageKind: "vision" | "text" | "image") {
  const clients = await authenticate(req);
  await consumeQuota(clients.serviceClient, clients.user.id, usageKind);
  return clients;
}

async function safetyIdentifier(userId: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function outputText(payload: Record<string, unknown>): string | null {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
    }
  }
  return null;
}

export function validateImageDataUrl(value: unknown) {
  if (typeof value !== "string") throw new HttpError(400, "No image provided");
  if (!/^data:image\/(jpeg|png|webp);base64,/i.test(value)) throw new HttpError(415, "Unsupported image type");
  if (value.length > 14_000_000) throw new HttpError(413, "Image is too large");
  return value;
}

export async function structuredResponse(options: {
  userId: string;
  model: "gpt-5.6-terra" | "gpt-5.6-luna";
  instructions: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  imageDataUrl?: string;
  maxOutputTokens?: number;
}) {
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiKey) throw new Error("Server configuration is incomplete");
  const content: Array<Record<string, unknown>> = [{ type: "input_text", text: options.prompt }];
  if (options.imageDataUrl) content.push({ type: "input_image", image_url: options.imageDataUrl, detail: "high" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        store: false,
        safety_identifier: await safetyIdentifier(options.userId),
        instructions: options.instructions,
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: options.schemaName, strict: true, schema: options.schema } },
        max_output_tokens: options.maxOutputTokens ?? 1800,
      }),
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const providerError = await response.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
    const errorCode = providerError.error?.code ?? providerError.error?.type ?? "unknown";
    console.error("OpenAI request failed", { status: response.status, errorCode, requestId: response.headers.get("x-request-id"), schema: options.schemaName });
    if (errorCode === "credit_balance_exhausted" || errorCode === "insufficient_quota") {
      throw new HttpError(503, "AI features are temporarily unavailable");
    }
    if (response.status === 429) throw new HttpError(429, "AI is busy. Try again shortly.");
    throw new Error("AI request failed");
  }
  const payload = await response.json() as Record<string, unknown>;
  const text = outputText(payload);
  if (!text) throw new Error("AI returned no structured result");
  return JSON.parse(text) as unknown;
}

export function errorResponse(req: Request, error: unknown, fallback: string) {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error && error.name === "AbortError"
    ? "Request timed out. Try a clearer photo."
    : error instanceof Error
    ? error.message
    : fallback;
  console.error(fallback, { message, status });
  return json(req, { error: message }, status);
}
