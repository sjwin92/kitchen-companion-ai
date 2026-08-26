"""Parse cached USDA MyPlate Kitchen pages into structured recipe records.

Deterministic HTML parsing (no model inference) so every field is traceable to the
archived source page. Output: recipes.jsonl
"""
import os, gzip, html as htmllib, json, pathlib, re

# Working directory for downloaded source data and intermediates. Override
# with KC_IMPORT_WORKDIR; defaults to a gitignored folder beside this script.
_WORKDIR = pathlib.Path(os.environ.get("KC_IMPORT_WORKDIR")
                        or pathlib.Path(__file__).resolve().parent / "workdir")
_REPO = pathlib.Path(__file__).resolve().parents[2]


HTML_DIR = _WORKDIR / "html"
OUT = _WORKDIR / "recipes.jsonl"
TS = json.loads((_WORKDIR / "timestamps.json").read_text())

NUTRIENT_ROWS = {
    "total_calories": "calories",
    "total_fat": "fat_g",
    "saturated_fat": "saturated_fat_g",
    "cholesterol": "cholesterol_mg",
    "sodium": "sodium_mg",
    "carbohydrates": "carbs_g",
    "dietary_fiber": "fiber_g",
    "total_sugars": "sugar_g",
    "added_sugars": "added_sugar_g",
    "protein": "protein_g",
    "calcium": "calcium_mg",
    "iron": "iron_mg",
    "potassium": "potassium_mg",
    "vitamin_d": "vitamin_d_mcg",
}


def text(fragment):
    fragment = re.sub(r"<br\s*/?>", " ", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    fragment = htmllib.unescape(fragment).replace("\xa0", " ")
    return re.sub(r"\s+", " ", fragment).strip()


def first(pattern, source, group=1, flags=re.S | re.I):
    m = re.search(pattern, source, flags)
    return m.group(group) if m else None


def parse(slug, doc):
    title = first(r'<h1[^>]*>(.*?)</h1>', doc)
    title = text(title) if title else None
    if not title:
        return None

    block = first(
        r'field--name-field-ingredients.*?<ul[^>]*class="[^"]*ingredients[^"]*"[^>]*>(.*?)</ul>',
        doc,
    )
    ingredients = []
    if block:
        for item in re.findall(r"<li[^>]*>(.*?)</li>", block, re.S):
            note = first(r'<span[^>]*class="notes"[^>]*>(.*?)</span>', item)
            raw = text(re.sub(r'<span[^>]*class="notes"[^>]*>.*?</span>', "", item, flags=re.S))
            if raw:
                ingredients.append({"raw": raw, "note": text(note) if note else None})

    steps_block = first(
        r'field--name-field-instructions.*?<ol[^>]*>(.*?)</ol>', doc
    )
    instructions = []
    if steps_block:
        instructions = [
            text(s) for s in re.findall(r"<li[^>]*>(.*?)</li>", steps_block, re.S) if text(s)
        ]
    if not instructions:
        body = first(r'field--name-field-instructions.*?<div class="field__item">(.*?)</div>', doc)
        if body:
            instructions = [
                line.strip()
                for line in re.split(r"(?<=[.!?])\s+", text(body))
                if len(line.strip()) > 3
            ]

    nutrition = {}
    for cls, amount in re.findall(
        r'<tr class="np_row([^"]*)"[^>]*>\s*<td>[^<]*</td>\s*<td>([^<]*)</td>', doc
    ):
        tokens = set(cls.split())
        for token, key in NUTRIENT_ROWS.items():
            if token in tokens and key not in nutrition:
                value = first(r"(\d+(?:\.\d+)?)", amount or "")
                if value:
                    nutrition[key] = float(value)

    yield_text = first(
        r'mp-recipe-full__detail--yield.*?mp-recipe-full__detail--data"?>\s*(.*?)</span>', doc
    )
    servings = None
    if yield_text:
        value = first(r"(\d+(?:\.\d+)?)", text(yield_text))
        if value:
            servings = float(value)

    cost_block = first(r'<span class="mp-price-range">(.*?)</span>\s*</span>', doc) or ""
    cost_tier = len(re.findall(r'class="active"', cost_block)) or None

    serving_size = first(
        r'field--name-field-recipe-serving-size.*?<span class="field__item">\s*(.*?)</span>', doc
    )
    source = first(
        r'field--name-field-source.*?<span class="field__item">(.*?)</span>\s*</span>', doc
    )
    notes = first(
        r'field--name-field-notes.*?<div class="field__item">(.*?)</div>', doc
    )

    ld = first(r'<script type="application/ld\+json">(.*?)</script>', doc)
    image, rating, rating_count = None, None, None
    if ld:
        try:
            graph = json.loads(ld).get("@graph", [])
            for node in graph:
                if node.get("@type") == "Recipe":
                    image = (node.get("image") or {}).get("url")
                    agg = node.get("aggregateRating") or {}
                    rating = float(agg["ratingValue"]) if agg.get("ratingValue") else None
                    rating_count = int(agg["ratingCount"]) if agg.get("ratingCount") else None
        except (ValueError, TypeError, KeyError):
            pass
    if image:
        image = re.sub(r"^https://web\.archive\.org/web/\d+(?:im_)?/", "", image)

    return {
        "slug": slug,
        "title": title,
        "description": text(
            first(r'mp-recipe-full__description"[^>]*>\s*(.*?)\s*</div>', doc) or ""
        )
        or None,
        "servings": servings,
        "serving_size": text(serving_size) if serving_size else None,
        "cost_tier": cost_tier,
        "ingredients": ingredients,
        "instructions": instructions,
        "notes": text(notes) if notes else None,
        "nutrition_per_serving": nutrition,
        "usda_rating": rating,
        "usda_rating_count": rating_count,
        "image_url": image,
        "source_credit": text(source) if source else None,
        "source_url": f"https://www.myplate.gov/recipes/{slug}",
        "archive_url": f"https://web.archive.org/web/{TS.get(slug, '')}/https://www.myplate.gov/recipes/{slug}",
    }


def main():
    records, skipped = [], 0
    for path in sorted(HTML_DIR.glob("*.html.gz")):
        slug = path.name[: -len(".html.gz")]
        with gzip.open(path, "rt", encoding="utf-8", errors="replace") as fh:
            doc = fh.read()
        record = parse(slug, doc)
        if not record or len(record["ingredients"]) < 3 or len(record["instructions"]) < 2:
            skipped += 1
            continue
        records.append(record)

    with OUT.open("w") as fh:
        for record in records:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"parsed={len(records)} skipped={skipped}")
    if records:
        print(f"with_servings={sum(1 for r in records if r['servings'])}")
        print(f"with_calories={sum(1 for r in records if r['nutrition_per_serving'].get('calories'))}")
        print(f"with_description={sum(1 for r in records if r['description'])}")
        print(f"avg_ingredients={sum(len(r['ingredients']) for r in records)/len(records):.1f}")


main()
