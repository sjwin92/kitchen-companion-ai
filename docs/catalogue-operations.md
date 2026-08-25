# Catalogue operations

The beta launches from a reviewed database catalogue, not an endless AI meal feed. The target of 300 recipes is an editorial workload and must not be represented as complete until 300 distinct content versions have a recorded human approval.

## Safe import flow

1. Copy `catalogue/catalogue-template.json` to a working file outside the repository.
2. Enter original or permissioned recipes, structured ingredients, media attribution and rights evidence.
3. Point `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY` at staging.
4. Run `npm run catalogue:import -- /absolute/path/to/catalogue.json`.
5. Imported content remains `draft`; it cannot appear to ordinary users.
6. Cook and review each recipe, then use `review_catalogue_recipe` as an authenticated admin with the complete checklist.
7. Promote the same reviewed content version to beta only after staging QA.

Never place the service-role key in a `VITE_` variable, browser code, committed file or creator form. The importer refuses to overwrite live recipes or live books; edits to published content require a new content version.

## Required approval evidence

Every approved recipe version records one reviewer and all five checks:

- recipe cooked/tested;
- ingredient quantities and units checked;
- allergens checked;
- publishing rights confirmed;
- nutrition source checked (or nutrition deliberately left blank).

The reviewer should also verify timings, servings, storage/reheating guidance, dietary tags, image rights and every linked YouTube/audio URL. AI may help normalise draft data, but it cannot be the human reviewer or silently publish a recipe.

## 300-recipe production board

Build six useful collections of roughly 50 recipes rather than one undifferentiated list:

- fast weeknights;
- budget and batch cooking;
- use-it-up / low-waste meals;
- family and lunchbox meals;
- plant-forward staples;
- breakfasts, lunches and flexible foundations.

Track each item through `rights cleared → structured → test cooked → nutrition/allergen checked → staged → approved`. A collection is beta-ready only when its recipes have complete structured ingredients, because pantry matching and shopping generation depend on them.
