# Catalogue operations

The beta launches from a reviewed database catalogue, not an endless AI meal feed. The bootstrap launch target is 12 strong recipes across three mini-packs. Scale the catalogue only after the loop proves useful.

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

## Post-beta catalogue production board

Grow toward six useful collections rather than one undifferentiated list:

- fast weeknights;
- budget and batch cooking;
- use-it-up / low-waste meals;
- family and lunchbox meals;
- plant-forward staples;
- breakfasts, lunches and flexible foundations.

Track each item through `rights cleared → structured → test cooked → nutrition/allergen checked → staged → approved`. A collection is beta-ready only when its recipes have complete structured ingredients, because pantry matching and shopping generation depend on them.

## USDA public-domain import (August 2026)

`catalogue/collections/` holds 244 draft recipes imported from [USDA MyPlate
Kitchen](https://www.myplate.gov/myplate-kitchen). MyPlate Kitchen recipes are
works of the U.S. federal government and therefore in the public domain, so
they can be redistributed and adapted without a licence. The retired myplate.gov
pages were read from the Internet Archive; every recipe records both its
original `source_url` and the archived capture it was read from, plus the USDA
credit line where one was published.

The six packs map onto the production board above:

| Pack | Book slug | Drafts |
| --- | --- | --- |
| Fast Weeknights | `fast-weeknights-usda-volume-1` | 48 |
| Budget and Batch Cooking | `budget-and-batch-usda-volume-1` | 48 |
| Family and Lunchbox | `family-and-lunchbox-usda-volume-1` | 48 |
| Plant-Forward Staples | `plant-forward-staples-usda-volume-1` | 44 |
| Use It Up, Volume 2 | `use-it-up-usda-volume-2` | 45 |
| Breakfast Foundations | `breakfast-foundations-usda-volume-1` | 11 |

Validate then import a pack one at a time, smallest first:

```
npm run catalogue:validate -- catalogue/collections/breakfast-foundations-usda-volume-1.json
npm run catalogue:import -- catalogue/collections/breakfast-foundations-usda-volume-1.json
```

### What the import did automatically, and what a reviewer must still check

Automated: US customary quantities converted to metric using USDA gram weights
for household measures; ingredient names localised for UK kitchens (cilantro →
coriander, zucchini → courgette, ground beef → beef mince, all-purpose flour →
plain flour); oven temperatures converted from °F to °C; dietary, allergen and
meal-type tags derived from the ingredient list; per-serving nutrition taken
from the USDA nutrition panel as published.

Not automated, and blocking for approval:

- **Quantities.** Conversions are arithmetic, not tested. Cup-to-gram weights
  come from USDA portion data or a standard table; anything the matcher could
  not resolve stayed in millilitres and needs a cook's judgement.
- **Allergen tags.** Derived from ingredient keywords only. Check every one.
- **Cost.** USDA cost tiers are US retail and were deliberately not imported.
  No GBP estimate exists on these drafts.
- **Ingredient names.** `import_metadata.ingredient_source_lines` keeps the
  original USDA line next to each parsed ingredient so a reviewer can compare.
- **Voice.** The instructions are USDA's wording, including "wash hands with
  soap and water" as step one. Rewrite before publishing if that is off-brand.

The normal five-check approval evidence still applies to every recipe.

## Ingredient reference library

`public.ingredient_reference` is shared, read-only food composition data used
for nutrition estimates, unit conversion and shelf-life defaults. It is
separate from `public.food_items`, which is each user's own pantry.

The shipped pack, `catalogue/reference/ingredient-reference-usda-sr-legacy.json.gz`,
contains 7,793 foods from [USDA FoodData Central SR Legacy
2018-04](https://fdc.nal.usda.gov/download-datasets), public domain under
CC0 1.0: per-100 g nutrition, household-measure gram weights, allergen and
dietary hints, an `is_whole_food` flag for single-ingredient staples, and
UK aliases so "courgette" and "beef mince" resolve to the right row.

```
npm run reference:validate
npm run reference:import
```

Rows import as `draft` and only `service_role` can write them. Shelf-life
figures are Kitchen Companion editorial defaults rather than USDA data, so they
need review before they drive any food-safety messaging.
