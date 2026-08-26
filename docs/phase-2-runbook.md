# Phase 2 trusted catalogue growth

Phase 2 makes the reviewed Supabase catalogue the normal source for discovery, planning, recipe books and shopping. AI captures or drafts information; it never silently publishes a recipe or writes scanned items into inventory without confirmation.

## Release slices

1. **2.1 platform:** apply the Phase 2 migration, deploy functions, verify the end-to-end food loop and publish 12 rights-cleared starter recipes.
2. **2.2 proof:** reach 100 reviewed recipes and three permissioned creator packs, each with 8–15 recipes.
3. **Phase 2 complete:** reach 1,000 reviewed recipes and ten permissioned creator packs.

The content totals are editorial and partnership milestones, not generated fixtures. Never count an unreviewed draft, unlicensed image or unsigned creator collection as public inventory.

## Deployment order

1. Back up staging and apply migrations there first.
2. Set Edge Function secrets: `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `AI_OPENAI_FALLBACK_ENABLED=false` and `ALLOWED_ORIGINS`. Keep all provider keys out of Vite variables.
3. Deploy the updated capture, nutrition and private recipe functions.
4. Import candidate recipes with `npm run catalogue:import -- /absolute/path/catalogue.json`.
5. Use `/admin/catalogue` to inspect permissions, duplicates, provenance, ingredients, allergens and nutrition evidence before approval.
6. Test with five invited accounts, then 25. Open invitations only after 48 hours without a stop condition.

OpenAI can be enabled only as a short-lived server-side emergency fallback. It must not be the default route.

## AI budget behaviour

- `inventory_vision`, `receipt_extraction`, `expiry_extraction` and `nutrition_estimate` route to Gemini 3.5 Flash-Lite.
- `catalogue_enrichment` routes to DeepSeek V4 Flash and must contain no user inventory, profile, receipt or image data.
- Barcode scans stay outside the AI ledger.
- The database reserves spend atomically before each paid request.
- Normal vision use is budgeted to £7; the remaining £1 in the vision bucket is reserve capacity. Text/catalogue work is capped at £2.
- Private recipe drafting pauses above £9 total. Every paid request is rejected when the next reservation would exceed £10.
- Manual entry, barcode lookup and catalogue browsing remain available when paid AI is unavailable.

Provider results use `{ data, provider, model, confidence, provenance, usage }`. Captured items remain candidates until the user confirms them.

## Catalogue and community rules

- Only approved canonical `recipes` appear publicly.
- Private `user_recipes` remain owner-only. Submission is explicit and records a licence choice.
- Admin promotion creates a private catalogue draft; it does not publish it.
- An approved content version gets an immutable `recipe_versions` snapshot.
- Verification labels mean exactly `editorial_reviewed`, `creator_verified` or `test_kitchen_verified`.
- Recipe media must be owned, licensed or expressly permissioned. Do not generate generic AI food photography.
- MyPlate Kitchen may inform taxonomy and UX research only. Do not scrape it, import its recipes, use its branding or imply USDA endorsement.

## Creator controls

Creator packs remain free in Phase 2, while `recipe_book_access` records future-ready entitlements. A prospect must receive founder approval in the admin queue before any outreach is prepared. Outreach still requires approval of the exact recipient and message, through a public business route. `agreed` status requires a permission timestamp and agreement reference; recipe and media permission must also be recorded at content level.

Payments, checkout, refunds, payouts and revenue-share accounting are Phase 3 work.

## Stop conditions

Pause invitations immediately for cross-user data leakage, dietary or allergen recommendation failures, inventory writes before scan confirmation, unauthorized creator/community content, false provenance, immutable-version failures or a budget-cap bypass. Correct the fault in staging and repeat the full loop before resuming.

The acceptance loop is:

`add food → monitor expiry → choose recipe → plan → buy missing items → record consumption or waste`
