## Goal
Make the app measurably faster, cheaper to run, and more reliable — without adding new features or burning AI credits.

## Workstream 1 — Cut AI credit burn (biggest measurable win)

**Problem:** Every plan generation, pairing, and recipe call hits Gemini Flash even when the answer hasn't changed. `useShoppingDerivation` re-fetches MealDB ingredients on every derive. No request dedupe.

**Changes:**
1. **Edge-function response cache** — add a `ai_cache` table keyed by `(function_name, input_hash)` with a 7-day TTL. Wrap `generate-plan`, `suggest-pairings`, `generate-recipe`, `scan-expiry` to check cache first. Same prompt → 0 credits.
2. **Downgrade non-critical calls** to `google/gemini-2.5-flash-lite` (pairings, expiry parsing, simple suggestions). Keep `gemini-2.5-flash` for full plan generation.
3. **Client-side dedupe** — wrap fetches with an in-memory `Map<key, Promise>` so rapid re-renders don't fire duplicate calls.
4. **Skip AI when rules suffice** — pairing suggestions for "rice/pasta/salad" sides should come from a static list, not AI.
5. **MealDB ingredient cache** — cache `mealdb-proxy?lookup` results in `meal_library` automatically so derivation never re-hits the proxy for the same recipe twice.

## Workstream 2 — Performance & re-renders

1. **Route code-splitting** — convert page imports in `App.tsx` to `React.lazy` (Inventory, MealPlanner, ShoppingList, WeeklyInsights, etc.). Cuts initial bundle ~40%.
2. **Memoise hot lists** — `useSmartRecommendations`, `useMealLibrary` selectors, planner grid cells.
3. **Batch Supabase reads on Dashboard** — currently fires 6+ parallel queries on mount; use a single RPC or `Promise.all` with shared cache via `@tanstack/react-query` (already in deps).
4. **Debounce** taste-profile recompute and shopping-cost lookups (300ms).

## Workstream 3 — Reliability & graceful failure

1. **AI failure toasts + retry with backoff** — single helper `callAI(fn, body, {retries:2})` for all edge calls. Surface 429/402 with friendly copy ("Busy, try in 30s" / "Out of credits — top up in Settings").
2. **Image fallbacks** — `<MealImage>` component with skeleton → placeholder, never blank tiles.
3. **ErrorBoundary per route** (already exists at root — add per page so one crash doesn't blank the app).
4. **Offline read** — service worker (already present) cache current week's plan + shopping list JSON.

## Workstream 4 — Data correctness

1. **Inventory matching** — current substring match in `useShoppingDerivation` produces false positives ("egg" matches "eggplant"). Add singular/plural normalisation + word-boundary check.
2. **Nutrition validation guard** — enforce the `calories ≈ p*4+c*4+f*9` rule at edge-function boundary; reject/repair invalid payloads.
3. **Dedupe `meal_library`** by `lower(title)` per user via a migration + future-insert guard.
4. **Shopping list quantity merge** — when adding "2 onions" to a list that already has "1 onion", merge instead of duplicating.

## Workstream 5 — UX polish (no new features)

1. Empty states with CTA on Favorites, History, Saved Lists, Waste.
2. Loading skeletons on Dashboard cards (no layout shift).
3. Pull-to-refresh on mobile list pages.
4. Keyboard focus rings + aria-labels on icon buttons.

## Technical notes

- New table `ai_cache(id, function_name text, input_hash text, response jsonb, created_at, expires_at)` with unique index on `(function_name, input_hash)`. RLS: service_role only; edge functions write via service key.
- Add `src/lib/aiClient.ts` wrapping `fetch` to all edge functions: dedupe, retry, friendly errors.
- Add `src/lib/queryClient.ts` configured with sensible `staleTime` (60s) so React Query absorbs duplicate dashboard reads.
- Add `src/components/MealImage.tsx` with `onError` → placeholder.
- Migration to add a partial unique index `meal_library_user_title_unique` after dedup.

## Out of scope
- No new pages, no new AI features, no design overhaul, no budget mode (declined earlier).

## Rollout order (safe, incremental)
1. aiClient + dedupe + retry (instant credit savings, no schema change)
2. `ai_cache` table + wrap edge functions
3. Route lazy-loading + React Query cache
4. Inventory matching + nutrition guard
5. UX polish pass

Each step is independently shippable and reversible.