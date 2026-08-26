"""Build a Kitchen Companion ingredient reference dataset from USDA FoodData Central SR Legacy.

Source: USDA FoodData Central, SR Legacy (April 2018 release), public domain / CC0 1.0.
https://fdc.nal.usda.gov/download-datasets/

Outputs ingredient_reference.json
"""
import os, csv, json, pathlib, re, sys
from collections import defaultdict

# Working directory for downloaded source data and intermediates. Override
# with KC_IMPORT_WORKDIR; defaults to a gitignored folder beside this script.
_WORKDIR = pathlib.Path(os.environ.get("KC_IMPORT_WORKDIR")
                        or pathlib.Path(__file__).resolve().parent / "workdir")
_REPO = pathlib.Path(__file__).resolve().parents[2]


SRC = pathlib.Path(
    _WORKDIR / "sr_legacy/FoodData_Central_sr_legacy_food_csv_2018-04"
)
OUT = _WORKDIR / "ingredient_reference.json"

csv.field_size_limit(sys.maxsize)

NUTRIENTS = {
    "1008": "calories",
    "1003": "protein_g",
    "1005": "carbs_g",
    "1004": "fat_g",
    "1258": "saturated_fat_g",
    "1079": "fiber_g",
    "2000": "sugar_g",
    "1093": "sodium_mg",
    "1253": "cholesterol_mg",
    "1087": "calcium_mg",
    "1089": "iron_mg",
    "1092": "potassium_mg",
    "1162": "vitamin_c_mg",
}

# USDA food category -> UK supermarket aisle used by the existing catalogue packs.
AISLE_BY_CATEGORY = {
    "Dairy and Egg Products": "Dairy and eggs",
    "Spices and Herbs": "Spices",
    "Baby Foods": "Baby",
    "Fats and Oils": "Oils",
    "Poultry Products": "Meat and poultry",
    "Soups, Sauces, and Gravies": "Cooking ingredients",
    "Sausages and Luncheon Meats": "Chilled meats",
    "Breakfast Cereals": "Cereals",
    "Fruits and Fruit Juices": "Produce",
    "Pork Products": "Meat and poultry",
    "Vegetables and Vegetable Products": "Produce",
    "Nut and Seed Products": "Nuts and seeds",
    "Beef Products": "Meat and poultry",
    "Beverages": "Drinks",
    "Finfish and Shellfish Products": "Fish and seafood",
    "Legumes and Legume Products": "Pulses",
    "Lamb, Veal, and Game Products": "Meat and poultry",
    "Baked Products": "Bakery",
    "Sweets": "Sweets and baking",
    "Cereal Grains and Pasta": "Pasta and grains",
    "Fast Foods": "Prepared foods",
    "Meals, Entrees, and Side Dishes": "Prepared foods",
    "Snacks": "Snacks",
    "American Indian/Alaska Native Foods": "World foods",
    "Restaurant Foods": "Prepared foods",
    "Branded Food Products Database": "Packaged",
    "Quality Control Materials": "Excluded",
    "Alcoholic Beverages": "Drinks",
}

# Storage-location defaults, in days, keyed by aisle. Editorial defaults for the
# expiry engine; the reviewer confirms or overrides them per ingredient.
SHELF_LIFE_BY_AISLE = {
    "Produce": {"fridge": 7, "pantry": 5, "freezer": 240},
    "Dairy and eggs": {"fridge": 10, "pantry": 1, "freezer": 90},
    "Meat and poultry": {"fridge": 2, "pantry": 0, "freezer": 180},
    "Chilled meats": {"fridge": 5, "pantry": 0, "freezer": 60},
    "Fish and seafood": {"fridge": 2, "pantry": 0, "freezer": 120},
    "Pulses": {"fridge": 4, "pantry": 540, "freezer": 180},
    "Pasta and grains": {"fridge": 4, "pantry": 540, "freezer": 180},
    "Cereals": {"fridge": 0, "pantry": 270, "freezer": 0},
    "Bakery": {"fridge": 7, "pantry": 4, "freezer": 90},
    "Oils": {"fridge": 0, "pantry": 365, "freezer": 0},
    "Spices": {"fridge": 0, "pantry": 730, "freezer": 0},
    "Nuts and seeds": {"fridge": 180, "pantry": 180, "freezer": 365},
    "Cooking ingredients": {"fridge": 14, "pantry": 540, "freezer": 180},
    "Sweets and baking": {"fridge": 0, "pantry": 540, "freezer": 0},
    "Drinks": {"fridge": 5, "pantry": 365, "freezer": 0},
    "Snacks": {"fridge": 0, "pantry": 180, "freezer": 0},
    "World foods": {"fridge": 5, "pantry": 365, "freezer": 180},
    "Prepared foods": {"fridge": 3, "pantry": 180, "freezer": 90},
    "Packaged": {"fridge": 5, "pantry": 365, "freezer": 120},
    "Baby": {"fridge": 2, "pantry": 365, "freezer": 0},
}

ALLERGENS = [
    ("gluten", r"\b(wheat|barley|rye|semolina|spelt|couscous|bulgur|farro|seitan|bread|pasta|noodle|flour|cracker|cereal|oats?)\b"),
    ("milk", r"\b(milk|cheese|butter|cream|yogurt|yoghurt|ghee|whey|casein|custard|curd)\b"),
    ("eggs", r"\begg"),
    ("fish", r"\b(salmon|tuna|cod|haddock|mackerel|sardine|anchovy|trout|halibut|tilapia|pollock|fish)\b"),
    ("crustaceans", r"\b(shrimp|prawn|crab|lobster|langoustine|crayfish)\b"),
    ("molluscs", r"\b(mussel|clam|oyster|scallop|squid|octopus|snail)\b"),
    ("peanuts", r"\bpeanut"),
    ("tree nuts", r"\b(almond|walnut|cashew|pecan|pistachio|hazelnut|macadamia|brazil nut|chestnut)\b"),
    ("soy", r"\b(soy|soya|tofu|edamame|tempeh|miso)\b"),
    ("sesame", r"\b(sesame|tahini)\b"),
    ("mustard", r"\bmustard\b"),
    ("celery", r"\bcelery\b|celeriac"),
    ("sulphites", r"\b(wine|dried apricot|dried fruit)\b"),
    ("lupin", r"\blupin\b"),
]

ANIMAL = re.compile(
    r"\b(beef|pork|lamb|veal|chicken|turkey|duck|goose|bacon|ham|sausage|salami|"
    r"gelatin|lard|tallow|anchovy|fish|salmon|tuna|cod|shrimp|prawn|crab|lobster|"
    r"mussel|clam|oyster|scallop|squid|liver|kidney|game|venison|rabbit|bison)\b"
)
DAIRY_OR_EGG = re.compile(
    r"\b(milk|cheese|butter|cream|yogurt|yoghurt|ghee|whey|casein|egg|honey|custard)\b"
)

# Household staples worth surfacing first in search and autocomplete. The head noun
# must be the whole name or be followed by a comma, so "Apple juice, bottled" is not
# treated as the staple "apple".
STAPLE_HEADS = (
    r"onions?|garlic|carrots?|potatoes?|sweet potatoes?|tomatoes?|celery|cucumbers?|"
    r"lettuce|spinach|kale|cabbage|broccoli|cauliflower|zucchini|eggplant|mushrooms?|"
    r"peas|green beans|snap beans|leeks?|beets|squash|pumpkin|apples?|bananas?|"
    r"oranges?|lemons?|limes?|strawberries|blueberries|raspberries|grapes|pears?|"
    r"peaches|plums?|avocados?|rice|pasta|spaghetti|macaroni|noodles|couscous|quinoa|"
    r"oats|bread|wheat flour|beans|lentils|chickpeas|milk|cheese|butter|yogurt|eggs?|"
    r"cream|chicken|beef|pork|lamb|turkey|salmon|tuna|fish|shrimp|oil|vinegar|salt|"
    r"spices|sugars?|honey|mustard|tofu|tempeh|stock|broth|soup|nuts|peanut butter|"
    r"coconut milk|tomato products|sauce"
)
STAPLE = re.compile(rf"^({STAPLE_HEADS})(,|\s*$)")


def read_csv(name):
    with (SRC / name).open(newline="", encoding="utf-8-sig") as fh:
        yield from csv.DictReader(fh)


def slugify(text, seen):
    # trim to a sane length, then strip again so the cut cannot leave a
    # trailing hyphen (which would break the kebab-case contract)
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80].strip("-") or "ingredient"
    slug, n = base, 2
    while slug in seen:
        slug = f"{base}-{n}"
        n += 1
    seen.add(slug)
    return slug


def main():
    categories = {r["id"]: r["description"] for r in read_csv("food_category.csv")}
    units = {r["id"]: r["name"] for r in read_csv("measure_unit.csv")}

    foods = {}
    for r in read_csv("food.csv"):
        if r["data_type"] != "sr_legacy_food":
            continue
        cat = categories.get(r["food_category_id"], "")
        if "juice" in r["description"].lower() and cat == "Fruits and Fruit Juices":
            cat_aisle_override = "Drinks"
        else:
            cat_aisle_override = None
        foods[r["fdc_id"]] = {
            "fdc_id": int(r["fdc_id"]),
            "description": r["description"],
            "category": cat,
            "aisle": cat_aisle_override or AISLE_BY_CATEGORY.get(cat, "Packaged"),
        }

    nutrition = defaultdict(dict)
    for r in read_csv("food_nutrient.csv"):
        key = NUTRIENTS.get(r["nutrient_id"])
        if not key or r["fdc_id"] not in foods or not r["amount"]:
            continue
        try:
            nutrition[r["fdc_id"]][key] = round(float(r["amount"]), 2)
        except ValueError:
            continue

    portions = defaultdict(list)
    for r in read_csv("food_portion.csv"):
        if r["fdc_id"] not in foods or not r["gram_weight"]:
            continue
        unit = units.get(r["measure_unit_id"], "")
        if unit in ("", "undetermined"):
            unit = (r["modifier"] or "").strip() or "portion"
        try:
            grams = round(float(r["gram_weight"]), 1)
            amount = float(r["amount"]) if r["amount"] else 1.0
        except ValueError:
            continue
        if amount <= 0 or grams <= 0:
            continue
        portions[r["fdc_id"]].append(
            {
                "unit": unit,
                "amount": amount,
                "modifier": (r["modifier"] or "").strip() or None,
                "grams_per_unit": round(grams / amount, 1),
            }
        )

    seen, rows, skipped = set(), [], 0
    for fdc_id, food in sorted(foods.items(), key=lambda kv: kv[1]["description"].lower()):
        if food["aisle"] == "Excluded":
            skipped += 1
            continue
        desc = food["description"]
        low = desc.lower()

        allergens = sorted({tag for tag, pattern in ALLERGENS if re.search(pattern, low)})
        has_animal = bool(ANIMAL.search(low))
        has_dairy_egg = bool(DAIRY_OR_EGG.search(low))
        dietary = []
        if not has_animal:
            dietary.append("vegetarian")
            if not has_dairy_egg:
                dietary.append("vegan")
        if "gluten" not in allergens:
            dietary.append("gluten-free-candidate")

        rows.append(
            {
                "slug": slugify(desc, seen),
                "display_name": desc,
                "category": food["category"],
                "aisle": food["aisle"],
                "nutrition_per_100g": nutrition.get(fdc_id, {}),
                "portions": sorted(
                    portions.get(fdc_id, []), key=lambda p: p["grams_per_unit"]
                )[:12],
                "allergen_tags": allergens,
                "dietary_tags": dietary,
                "shelf_life_days": SHELF_LIFE_BY_AISLE.get(food["aisle"], {}),
                "household_staple": bool(STAPLE.match(low)),
                "fdc_id": food["fdc_id"],
                "source": "usda_fdc_sr_legacy_2018_04",
                "source_url": f"https://fdc.nal.usda.gov/food-details/{food['fdc_id']}/nutrients",
                "rights_basis": "public_domain",
                "review_status": "draft",
            }
        )

    OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
    with_cal = sum(1 for r in rows if r["nutrition_per_100g"].get("calories") is not None)
    print(f"rows={len(rows)} skipped={skipped} with_calories={with_cal}")
    print(f"staples={sum(1 for r in rows if r['household_staple'])}")
    print(f"with_portions={sum(1 for r in rows if r['portions'])}")
    print(f"bytes={OUT.stat().st_size}")


main()
