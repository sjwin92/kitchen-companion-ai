# Public-domain data import pipeline

These scripts regenerate the two datasets in `catalogue/`:

- `catalogue/collections/*.json` — draft recipe packs from [USDA MyPlate
  Kitchen](https://www.myplate.gov/myplate-kitchen)
- `catalogue/reference/ingredient-reference-usda-sr-legacy.json.gz` — food
  composition reference from [USDA FoodData Central SR
  Legacy](https://fdc.nal.usda.gov/download-datasets)

Both sources are works of the U.S. federal government and are in the public
domain (FoodData Central is published under CC0 1.0), so the data can be
redistributed and adapted inside the app. Provenance is recorded on every row.

The committed JSON is the source of truth for imports. You only need these
scripts to refresh or extend the data.

## Working directory

Downloads and intermediates live outside the repo. Set `KC_IMPORT_WORKDIR`, or
they default to `scripts/data-import/workdir/` (which is gitignored).

```bash
export KC_IMPORT_WORKDIR="$HOME/.cache/kitchen-companion-import"
mkdir -p "$KC_IMPORT_WORKDIR"
```

## Recipes

1. `select_slugs.py` — reads `myplate_slugs.json` (the recipe slugs found in the
   Internet Archive index of myplate.gov) and picks meal-shaped candidates into
   `candidates.json`.
2. `fetch_recipes.py` — caches each archived page as gzipped HTML in
   `$KC_IMPORT_WORKDIR/html/`. Idempotent: it skips anything already cached, so
   re-run it until it reports `0 to fetch`. Honours `START`, `COUNT` and `BATCH`
   (default 4) so long runs can be split. Requires a fetcher — it currently
   imports `pplx_sdk`; swap in any HTTP client that can reach
   `web.archive.org`.
3. `parse_recipes.py` — deterministic HTML parsing into
   `$KC_IMPORT_WORKDIR/recipes.jsonl`. No language model is involved, so the
   output is reproducible.
4. `build_packs.py` — structures ingredients, converts to metric, localises for
   UK kitchens, derives tags, and writes the six packs plus
   `$KC_IMPORT_WORKDIR/review_queue.json` (ingredient names that matched no
   reference row and want a human eye).

## Ingredient reference

1. Download and unzip the SR Legacy CSV release into
   `$KC_IMPORT_WORKDIR/sr_legacy/`:

   ```bash
   curl -O https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
   unzip FoodData_Central_sr_legacy_food_csv_2018-04.zip -d "$KC_IMPORT_WORKDIR/sr_legacy"
   ```

2. `build_ingredient_reference.py` — joins foods, nutrients, portions and
   categories into `$KC_IMPORT_WORKDIR/ingredient_reference.json`.
3. `finalise_reference.py` — flattens shelf life, attaches UK aliases and writes
   the gzipped pack into `catalogue/reference/`.

## After regenerating

```bash
npm run catalogue:validate -- catalogue/collections/<pack>.json
npm run reference:validate
```

Everything imports as `draft`. See `docs/catalogue-operations.md` for what a
reviewer must still check before any of it can be published.
