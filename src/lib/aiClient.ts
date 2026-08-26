/**
 * Centralized client for Supabase Edge Function calls.
 * - Dedupes concurrent identical calls (in-memory)
 * - Retries with exponential backoff on 5xx / network errors
 * - Surfaces friendly toasts for 429 (rate limit) and 402 (credits)
 */
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Json = Record<string, unknown>;
const inflight = new Map<string, Promise<any>>();

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface CallOptions {
  retries?: number;
  dedupe?: boolean;
  silent?: boolean;
}

export async function callEdge<T = any>(
  fnName: string,
  body: Json,
  opts: CallOptions = {},
): Promise<T> {
  const { retries = 2, dedupe = true, silent = false } = opts;
  const key = `${fnName}:${hash(JSON.stringify(body))}`;

  if (dedupe && inflight.has(key)) return inflight.get(key)!;

  const exec = (async (): Promise<T> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.access_token) throw new Error('authentication_required');
        const res = await fetch(
          `https://${PROJECT_ID}.supabase.co/functions/v1/${fnName}`,
          {
            method: 'POST',
            headers: {
              apikey: ANON_KEY,
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          },
        );

        if (res.status === 429) {
          if (!silent) toast.error('Too many requests — try again in a moment.');
          throw new Error('rate_limited');
        }
        if (res.status === 402) {
          if (!silent)
            toast.error('AI credits exhausted. Top up in Settings to continue.');
          throw new Error('credits_exhausted');
        }
        if (!res.ok) {
          // 5xx → retry
          if (res.status >= 500 && attempt < retries) {
            await sleep(400 * Math.pow(2, attempt));
            continue;
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Request failed (${res.status})`);
        }
        return (await res.json()) as T;
      } catch (err) {
        lastErr = err;
        const msg = (err as Error).message;
        if (msg === 'rate_limited' || msg === 'credits_exhausted') throw err;
        if (attempt < retries) {
          await sleep(400 * Math.pow(2, attempt));
          continue;
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Request failed');
  })();

  if (dedupe) {
    inflight.set(key, exec);
    exec.finally(() => inflight.delete(key));
  }
  return exec;
}
