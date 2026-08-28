# Catalogue operations

The beta launches from a reviewed database catalogue, not an endless AI meal feed. The database now contains 200 recipes: 12 founder-reviewed recipes are public and 188 structured candidates are private. Candidates remain invisible to ordinary users until they pass the existing review workflow.

## Beta-200 catalogue

The 188 candidates are split across 17 practical packs in `catalogue/beta-200`. They provide dietary and meal-type breadth while preserving provenance, deduplication hashes, structured ingredients, calorie ranges, cost ranges and storage guidance.

- Run `npm run catalogue:verify` after editing generated candidates.
- Run `npm run catalogue:build` only when intentionally regenerating the deterministic candidate set.
- Validate an individual pack with `npm run catalogue:validate -- /absolute/path/to/pack.json`.
- Treat the generated recipes as an editorial queue, not finished public content. Review wording, cooking results, quantities, allergens, nutrition and rights before approval.

## Safe import flow

1. Copy `catalogue/catalogue-template.json` to a working file outside the repository.
2. Enter original or permissioned recipes, structured ingredients, media attribution and rights evidence.
3. Point `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY` at staging.
4. Run `npm run catalogue:import -- /absolute/path/to/catalogue.json`.
5. Imported content remains `draft`; it cannot appear to ordinary users.
6. Review each recipe, then use `review_catalogue_recipe` as an authenticated admin with the complete checklist and the evidence-backed verification tier.
7. Promote the same reviewed content version to beta only after staging QA.

Never place the service-role key in a `VITE_` variable, browser code, committed file or creator form. The importer refuses to overwrite live recipes or live books; edits to published content require a new content version.

## Required approval evidence

Every approved recipe version records one reviewer and four baseline checks:

- ingredient quantities and units checked;
- allergens checked;
- publishing rights confirmed;
- nutrition source checked (or nutrition deliberately left blank).

`creator_verified` additionally requires creator attestation. `test_kitchen_verified` additionally requires a recorded test cook. `editorial_reviewed` means the structured content and evidence were checked; it must not imply the recipe was test-cooked.

The reviewer should also verify timings, servings, storage/reheating guidance, dietary tags, image rights and every linked YouTube/audio URL. AI may help normalise draft data, but it cannot be the human reviewer or silently publish a recipe.

## Post-beta catalogue production board

Continue growing useful collections rather than one undifferentiated list:

- fast weeknights;
- budget and batch cooking;
- use-it-up / low-waste meals;
- family and lunchbox meals;
- plant-forward staples;
- breakfasts, lunches and flexible foundations.

Track each item through `rights cleared → structured → nutrition/allergen checked → evidence tier confirmed → staged → approved`. A collection is beta-ready only when its recipes have complete structured ingredients, because pantry matching and shopping generation depend on them.
