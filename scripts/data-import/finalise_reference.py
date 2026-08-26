#!/usr/bin/env python3
"""Turn the raw USDA extract into the shipping ingredient-reference payload.

Reads data/ingredient_reference.json (built by build_ingredient_reference.py),
flattens the shelf-life object into the migration's columns, renames
household_staple to is_whole_food, attaches UK cook-facing aliases, and writes
a gzipped pack under catalogue/reference/ so the repo stays a sensible size.
"""

import gzip
import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from build_packs import REFERENCE_ALIASES, build_reference_index  # noqa: E402

# Working directory for downloaded source data and intermediates. Override
# with KC_IMPORT_WORKDIR; defaults to a gitignored folder beside this script.
_WORKDIR = pathlib.Path(os.environ.get("KC_IMPORT_WORKDIR")
                        or pathlib.Path(__file__).resolve().parent / "workdir")
_REPO = pathlib.Path(__file__).resolve().parents[2]


DATA = _WORKDIR
OUT = _REPO / "catalogue" / "reference"
OUT_FILE = OUT / "ingredient-reference-usda-sr-legacy.json.gz"

RIGHTS_NOTES = (
    "Food composition data from USDA FoodData Central, SR Legacy release "
    "2018-04 (https://fdc.nal.usda.gov/download-datasets). Produced by the "
    "U.S. Department of Agriculture, a work of the U.S. federal government "
    "released into the public domain under CC0 1.0, so it may be "
    "redistributed inside the app without a licence. Values are per 100 g as "
    "eaten. Shelf-life figures are Kitchen Companion editorial defaults, not "
    "USDA data, and need review before they drive any food-safety messaging."
)


def main():
    rows = json.loads((DATA / "ingredient_reference.json").read_text())

    # Map the cook-facing UK names onto the row each one resolves to, so the
    # app can look up "courgette" or "beef mince" directly.
    canonical = build_reference_index()
    aliases_by_slug = {}
    for uk_name, _ in REFERENCE_ALIASES.items():
        target = canonical.get(uk_name)
        if target:
            aliases_by_slug.setdefault(target["slug"], set()).add(uk_name)

    payload = []
    for row in rows:
        shelf = row.get("shelf_life_days") or {}
        payload.append(
            {
                "slug": row["slug"],
                "display_name": row["display_name"],
                "category": row.get("category"),
                "aisle": row.get("aisle"),
                "nutrition_per_100g": row.get("nutrition_per_100g") or {},
                # a handful of USDA rows carry a zero gram weight, which is
                # useless for conversion and fails validation
                "portions": [
                    p for p in (row.get("portions") or [])
                    if isinstance(p.get("grams_per_unit"), (int, float))
                    and p["grams_per_unit"] > 0
                ],
                "allergen_tags": row.get("allergen_tags") or [],
                "dietary_tags": row.get("dietary_tags") or [],
                "shelf_life_fridge_days": shelf.get("fridge"),
                "shelf_life_pantry_days": shelf.get("pantry"),
                "shelf_life_freezer_days": shelf.get("freezer"),
                "is_whole_food": bool(row.get("household_staple")),
                "fdc_id": row.get("fdc_id"),
                "source": row.get("source", "usda_fdc_sr_legacy_2018_04"),
                "source_url": row.get("source_url"),
                "rights_basis": "public_domain",
                "review_status": "draft",
                "aliases": sorted(aliases_by_slug.get(row["slug"], [])),
            }
        )

    OUT.mkdir(parents=True, exist_ok=True)
    document = {
        "dataset": {
            "slug": "usda-fdc-sr-legacy-2018-04",
            "title": "USDA FoodData Central, SR Legacy 2018-04",
            "source": "usda_fdc_sr_legacy_2018_04",
            "source_url": "https://fdc.nal.usda.gov/download-datasets",
            "licence": "Public domain (CC0 1.0)",
            "rights_basis": "public_domain",
            "rights_notes": RIGHTS_NOTES,
            "content_version": 1,
            "row_count": len(payload),
        },
        "ingredients": payload,
    }
    with gzip.open(OUT_FILE, "wt", encoding="utf-8") as handle:
        json.dump(document, handle, ensure_ascii=False)

    aliased = sum(1 for row in payload if row["aliases"])
    print(f"rows={len(payload)} aliased={aliased}")
    print(f"whole_foods={sum(1 for r in payload if r['is_whole_food'])}")
    print(f"with_portions={sum(1 for r in payload if r['portions'])}")
    print(f"written={OUT_FILE} ({OUT_FILE.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
