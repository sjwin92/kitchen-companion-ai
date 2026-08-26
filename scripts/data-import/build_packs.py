"""Convert parsed USDA recipes into Kitchen Companion catalogue packs.

- structures every ingredient line into quantity / unit / normalized_name / aisle
- converts US customary measures to metric, using USDA gram weights per household
  measure where a canonical ingredient match exists
- localises ingredient names and oven temperatures for a UK audience
- derives dietary, allergen and meal-type tags from the matched ingredient reference
- splits the result into the six collections named in docs/catalogue-operations.md

Outputs catalogue/collections/*.json inside the repo plus a review queue.
"""
import os, json, pathlib, re, unicodedata
from collections import defaultdict

# Working directory for downloaded source data and intermediates. Override
# with KC_IMPORT_WORKDIR; defaults to a gitignored folder beside this script.
_WORKDIR = pathlib.Path(os.environ.get("KC_IMPORT_WORKDIR")
                        or pathlib.Path(__file__).resolve().parent / "workdir")
_REPO = pathlib.Path(__file__).resolve().parents[2]


REPO = _REPO
DATA = _WORKDIR
OUT_DIR = REPO / "catalogue" / "collections"
REVIEW = DATA / "review_queue.json"

# ---------------------------------------------------------------- localisation

UK_NAMES = [
    (r"\bcilantro\b", "coriander"),
    (r"\bchili\b", "chilli"),
    (r"\bchilies\b", "chillies"),
    (r"\bchiles\b", "chillies"),
    (r"\bchile\b", "chilli"),
    (r"\bzucchinis\b", "courgettes"),
    (r"\bzucchini\b", "courgette"),
    (r"\beggplants\b", "aubergines"),
    (r"\beggplant\b", "aubergine"),
    (r"\bscallions?\b", "spring onion"),
    (r"\bgreen onions?\b", "spring onion"),
    (r"\bgarbanzo beans?\b", "chickpeas"),
    (r"\bbell peppers\b", "peppers"),
    (r"\bbell pepper\b", "pepper"),
    (r"\bshrimp\b", "prawns"),
    (r"\bground beef\b", "beef mince"),
    (r"\bground turkey\b", "turkey mince"),
    (r"\bground pork\b", "pork mince"),
    (r"\bground chicken\b", "chicken mince"),
    (r"\ball[- ]purpose flour\b", "plain flour"),
    (r"\bconfectioners.? sugar\b", "icing sugar"),
    (r"\bpowdered sugar\b", "icing sugar"),
    (r"\bheavy (whipping )?cream\b", "double cream"),
    (r"\bhalf[- ]and[- ]half\b", "single cream"),
    (r"\bmolasses\b", "black treacle"),
    (r"\bcornstarch\b", "cornflour"),
    (r"\bbaking soda\b", "bicarbonate of soda"),
    (r"\bsnow peas\b", "mangetout"),
    (r"\bsnap peas\b", "sugar snap peas"),
    (r"\brutabaga\b", "swede"),
    (r"\bbeets\b", "beetroot"),
    (r"\barugula\b", "rocket"),
    (r"\bsweet corn\b", "sweetcorn"),
    (r"\bcorn tortillas?\b", "corn tortilla"),
    (r"\bcanola oil\b", "rapeseed oil"),
    (r"\begg noodles\b", "egg noodles"),
    (r"\boatmeal\b", "porridge oats"),
    (r"\braisins\b", "raisins"),
    (r"\bjelly\b", "jam"),
    (r"\bgraham crackers?\b", "digestive biscuit"),
    (r"\bskillet\b", "frying pan"),
    (r"\bbroil\b", "grill"),
    (r"\bbroiler\b", "grill"),
]

# ---------------------------------------------------------------- units

VULGAR = {
    "¼": " 1/4", "½": " 1/2", "¾": " 3/4", "⅓": " 1/3", "⅔": " 2/3",
    "⅛": " 1/8", "⅜": " 3/8", "⅝": " 5/8", "⅞": " 7/8",
}

WEIGHT_G = {"ounce": 28.35, "oz": 28.35, "pound": 453.59, "lb": 453.59,
            "gram": 1.0, "g": 1.0, "kilogram": 1000.0, "kg": 1000.0}
VOLUME_ML = {"cup": 240.0, "tablespoon": 15.0, "tbsp": 15.0, "teaspoon": 5.0,
             "tsp": 5.0, "fluid ounce": 30.0, "fl oz": 30.0, "pint": 473.0,
             "quart": 946.0, "gallon": 3785.0, "milliliter": 1.0, "ml": 1.0,
             "liter": 1000.0, "litre": 1000.0}
COUNT_UNITS = {
    "serving": "portions", "servings": "portions",
    "clove": "cloves", "cloves": "cloves", "can": "can", "cans": "can",
    "jar": "jar", "package": "pack", "packages": "pack", "pkg": "pack",
    "slice": "slices", "slices": "slices", "sprig": "sprigs", "sprigs": "sprigs",
    "stalk": "stalks", "stalks": "stalks", "head": "each", "heads": "each",
    "bunch": "bunch", "bunches": "bunch", "loaf": "each", "ear": "each",
    "ears": "each", "handful": "handful", "pinch": "pinch", "dash": "pinch",
    "sheet": "sheets", "sheets": "sheets", "fillet": "fillets",
    "fillets": "fillets", "breast": "each", "breasts": "each", "tortilla": "each",
    "tortillas": "each", "leaf": "leaves", "leaves": "leaves",
}
# Grams per US cup for dry goods that USDA does not give a cup weight for.
DRY_CUP_GRAMS = {
    "chicken": 140, "turkey": 140, "beef": 140, "pork": 140, "ham": 140,
    "meat": 140, "tuna": 150, "fish": 145, "prawn": 145, "shrimp": 145,
    "macaroni": 105, "pasta": 105, "spaghetti": 100, "noodle": 100,
    "rice": 185, "flour": 125, "plain flour": 125, "oats": 90,
    "porridge oats": 90, "breadcrumb": 60, "sugar": 200, "icing sugar": 120,
    "lentil": 190, "bean": 180, "chickpea": 165, "pea": 145, "sweetcorn": 165,
    "cheese": 110, "couscous": 175, "quinoa": 170, "raisin": 145, "nut": 120,
    "coconut": 80, "cereal": 40, "cornflour": 120, "polenta": 160,
}

# Aisles for things USDA files under a misleading category. First match wins,
# so the specific cases (fresh herbs, tinned goods) must come before the
# broad keyword buckets.
AISLE_OVERRIDES = [
    (r"^water$|^ice$|^tap water$", None),
    (r"\b(fresh|chopped)\b.*\b(coriander|parsley|basil|mint|dill|chive|thyme|"
     r"rosemary|sage|oregano|tarragon)\b|\b(coriander|parsley|basil|mint|dill|"
     r"chive)\b\s*(leaves|leaf|sprigs?)?$", "Produce"),
    (r"\b(lemon|lime|orange|grapefruit) juice\b", "Produce"),
    (r"\b(black|white|cayenne|chilli|chili|lemon) pepper\b|peppercorn|"
     r"\bpepper flakes?\b", "Spices"),
    (r"relish|pickle|gherkin|olive|caper", "Cooking ingredients"),
    (r"soy sauce|fish sauce|hoisin|teriyaki|miso|curry paste|coconut milk|tahini", "World foods"),
    (r"tortilla|pitta|pita|naan|bread|bun|roll|bagel|muffin", "Bakery"),
    (r"stock|broth|bouillon|passata|tomato (paste|puree|sauce)|vinegar|"
     r"mustard|ketchup|mayonnaise|jam|marmalade|syrup|honey|cornflour|baking", "Cooking ingredients"),
    (r"powder|seasoning|spice|paprika|cumin|oregano|basil|thyme|"
     r"cinnamon|nutmeg|chilli|chili|curry|turmeric|pepper flake|bay lea", "Spices"),
    (r"frozen", "Frozen"),
    (r"yogurt|yoghurt|milk|cheese|butter|cream|egg", "Dairy and eggs"),
    (r"tinned|canned|tin of", "Tins"),
]

# Aisle guesses for ingredients with no USDA match at all.
AISLE_FALLBACK = [
    (r"pepper|salt|cumin|paprika|oregano|basil|thyme|parsley|coriander|cilantro|"
     r"cinnamon|nutmeg|chilli|chili|curry|turmeric|ginger|garlic powder|seasoning|"
     r"spice|bay lea|dill|sage|rosemary|cardamom|clove|vanilla", "Spices"),
    (r"jalapeno|chilli pepper|onion|tomato|lettuce|cucumber|carrot|celery|potato|"
     r"lemon|lime|herb|greens|vegetable|fruit|salad|courgette|aubergine|mushroom|"
     r"cabbage|broccoli|cauliflower|spinach|kale|apple|banana|berry|berries|grape|"
     r"melon|mango|orange|pear|peach|plum|avocado|squash|pumpkin|leek|garlic", "Produce"),
    (r"oil|vinegar", "Oils"),
    (r"stock|broth|sauce|paste|syrup|honey|extract", "Cooking ingredients"),
    (r"tortilla|bread|bun|roll|wrap", "Bakery"),
    (r"cheese|milk|yogurt|yoghurt|cream|butter|egg", "Dairy and eggs"),
]

SIZE_WORDS = {"small", "medium", "large", "extra", "whole", "ripe", "fresh",
              "frozen", "dried", "canned", "cooked", "raw", "uncooked", "low-sodium",
              "reduced-sodium", "no-salt-added", "unsalted", "lean", "boneless",
              "skinless", "chopped", "diced", "sliced", "minced", "shredded",
              "grated", "peeled", "drained", "rinsed", "crushed", "halved",
              "quartered", "thawed", "optional", "divided", "packed", "trimmed"}
PREP_WORDS = {"chopped", "diced", "sliced", "minced", "shredded", "grated",
              "peeled", "drained", "rinsed", "crushed", "halved", "quartered",
              "thawed", "divided", "cubed", "julienned", "mashed", "beaten",
              "melted", "softened", "toasted", "trimmed", "seeded", "deveined",
              "finely chopped", "thinly sliced", "coarsely chopped", "pitted",
              "cored", "stemmed", "husked", "deseeded", "undrained", "rinsed and drained",
              "torn", "broken", "crumbled", "packed", "room temperature", "warmed",
              "cut into", "quarter", "strips", "wedges", "chunks", "florets"}

LIQUIDS = re.compile(
    r"\b(water|milk|stock|broth|juice|oil|vinegar|wine|sauce|cream|syrup|"
    r"yogurt|yoghurt|honey|puree|passata|coconut milk)\b"
)

# ---------------------------------------------------------------- tagging

MEAT = re.compile(
    r"\b(beef|steak|mince|pork|bacon|ham|sausage|lamb|veal|chicken|turkey|duck|"
    r"liver|gelatin|lard|chorizo|pepperoni|salami|prosciutto|venison)\b"
)
FISH = re.compile(
    r"\b(salmon|tuna|cod|haddock|mackerel|sardine|anchovy|trout|tilapia|pollock|"
    r"prawns?|shrimp|crab|lobster|mussel|clam|oyster|scallop|squid|fish)\b"
)
DAIRY = re.compile(r"\b(milk|cheese|butter|cream|yogurt|yoghurt|ghee|custard|paneer)\b")
EGG = re.compile(r"\begg")
HONEY = re.compile(r"\bhoney\b")
GLUTEN = re.compile(
    r"\b(wheat|flour|bread|pasta|spaghetti|macaroni|noodle|couscous|barley|rye|"
    r"cracker|breadcrumb|tortilla|bun|roll|pastry|pita|cereal|oats?|porridge oats|"
    r"soy sauce|beer|bulgur|semolina|farro)\b"
)
ALLERGEN_RULES = [
    ("gluten", GLUTEN),
    ("milk", DAIRY),
    ("eggs", EGG),
    ("fish", re.compile(r"\b(salmon|tuna|cod|haddock|mackerel|sardine|anchovy|trout|tilapia|pollock|fish)\b")),
    ("crustaceans", re.compile(r"\b(prawns?|shrimp|crab|lobster|crayfish)\b")),
    ("molluscs", re.compile(r"\b(mussel|clam|oyster|scallop|squid|octopus)\b")),
    ("peanuts", re.compile(r"\bpeanut")),
    ("tree nuts", re.compile(r"\b(almond|walnut|cashew|pecan|pistachio|hazelnut|macadamia|brazil nut)\b")),
    ("soy", re.compile(r"\b(soy|soya|tofu|edamame|tempeh|miso)\b")),
    ("sesame", re.compile(r"\b(sesame|tahini)\b")),
    ("mustard", re.compile(r"\bmustard\b")),
    ("celery", re.compile(r"\b(celery|celeriac)\b")),
]

CUISINES = [
    ("Mexican-inspired", r"\b(taco|burrito|enchilada|quesadilla|salsa|tortilla|fajita|chipotle|tostada)\b"),
    ("Italian-inspired", r"\b(pasta|spaghetti|lasagna|lasagne|risotto|marinara|pesto|parmesan|minestrone)\b"),
    ("East Asian-inspired", r"\b(stir[- ]fry|soy sauce|teriyaki|ginger|sesame oil|hoisin|fried rice|noodle bowl)\b"),
    ("South Asian-inspired", r"\b(curry|masala|lentil dal|dal|turmeric|garam|naan|tandoori)\b"),
    ("Mediterranean-inspired", r"\b(hummus|feta|olive|tabbouleh|couscous|tzatziki|pita)\b"),
    ("Caribbean-inspired", r"\b(jerk|plantain|black bean and rice)\b"),
    ("Creole-inspired", r"\b(creole|cajun|jambalaya|gumbo)\b"),
    ("American-inspired", r"\b(chili|cornbread|sloppy joe|meatloaf|barbecue|bbq|hash)\b"),
]

BREAKFAST = re.compile(
    r"\b(breakfast|porridge|oatmeal|pancake|waffle|smoothie|granola|muesli|"
    r"omelet|omelette|frittata|scrambled|french toast|muffin|overnight oats)\b"
)
LUNCHBOX = re.compile(r"\b(sandwich|wrap|salad|slaw|pinwheel|roll[- ]up|snack|dip|pita pocket)\b")
SNACK = re.compile(r"\b(dip|snack|bites|energy ball|trail mix|popcorn)\b")


def strip_accents(value):
    return "".join(
        c for c in unicodedata.normalize("NFKD", value) if not unicodedata.combining(c)
    )


def localise(value):
    out = value
    for pattern, replacement in UK_NAMES:
        out = re.sub(pattern, replacement, out, flags=re.I)
    return out


def fahrenheit_to_celsius(value):
    def repl(m):
        f = float(m.group(1))
        c = int(round((f - 32) * 5 / 9 / 5) * 5)
        return f"{c}°C ({int(f)}°F)"

    return re.sub(r"(\d{2,3})\s*°?\s*F\b", repl, value)


def singular_forms(token):
    """Candidate singular spellings for a token, widest sensible net."""
    forms = {token}
    if token.endswith("ies"):
        forms.add(token[:-3] + "y")
    if token.endswith("oes"):
        forms.add(token[:-2])
    if token.endswith(("ses", "xes", "zes", "ches", "shes")):
        forms.add(token[:-2])
    if token.endswith("ves"):
        forms.add(token[:-3] + "f")
        forms.add(token[:-1])
    if token.endswith("es"):
        forms.add(token[:-1])
        forms.add(token[:-2])
    if token.endswith("s"):
        forms.add(token[:-1])
    return [f for f in forms if f]


IRREGULAR_SINGULAR = {
    "leaves": "leaf", "loaves": "loaf", "halves": "half", "knives": "knife",
    "potatoes": "potato", "tomatoes": "tomato", "peas": "pea", "oats": "oats",
    "greens": "greens", "chives": "chives", "molasses": "molasses",
    "asparagus": "asparagus", "hummus": "hummus", "couscous": "couscous",
    "berries": "berry", "cherries": "cherry", "strawberries": "strawberry",
    "blueberries": "blueberry", "raspberries": "raspberry", "cranberries": "cranberry",
}


def singularise_word(word):
    if word in IRREGULAR_SINGULAR:
        return IRREGULAR_SINGULAR[word]
    if len(word) < 4 or not word.endswith("s"):
        return word
    if word.endswith(("ss", "us", "is", "os", "as")):
        return word
    if word.endswith("ies"):
        return word[:-3] + "y"
    if word.endswith("ves"):
        return word[:-3] + "f"
    if word.endswith(("ches", "shes", "sses", "xes", "zes")):
        return word[:-2]
    if word.endswith("oes"):
        return word[:-2]
    return word[:-1]


def singularise_phrase(phrase):
    words = phrase.split()
    if not words:
        return phrase
    words[-1] = singularise_word(words[-1])
    return " ".join(words)


def parse_amount(token):
    token = token.strip()
    m = re.match(r"^(\d+)\s+(\d+)/(\d+)$", token)
    if m:
        return int(m.group(1)) + int(m.group(2)) / int(m.group(3))
    m = re.match(r"^(\d+)/(\d+)$", token)
    if m:
        return int(m.group(1)) / int(m.group(2))
    m = re.match(r"^\d+(\.\d+)?$", token)
    if m:
        return float(token)
    return None


# ---------------------------------------------------------------- reference index

# USDA files many foods under a group head ("Spices, oregano, dried"), so the
# real name sits in the second segment. Register those under the second segment
# as well, otherwise every spice collapses onto one row.
GROUP_HEADS = {
    "spices", "herbs", "leavening agents", "oil", "fish", "crustaceans",
    "mollusks", "nuts", "seeds", "cereals ready-to-eat", "cereals", "snacks",
    "sweeteners", "syrups", "salad dressing", "soup", "sauce", "beverages",
    "vinegar", "vital wheat gluten", "gravy", "puddings", "candies",
}

# UK cook vocabulary that has no USDA spelling. Lookup only -- the recipe text
# keeps the UK name.
REFERENCE_ALIASES = {
    "courgette": "zucchini", "aubergine": "eggplant", "rocket": "arugula",
    "beetroot": "beets", "swede": "rutabagas", "sultana": "raisins",
    "sultanas": "raisins", "prawn": "shrimp", "prawns": "shrimp",
    "mangetout": "peas", "coriander": "cilantro", "coriander leaf": "cilantro",
    "coriander leaves": "cilantro", "plain flour": "wheat flour",
    "self-raising flour": "wheat flour", "strong white flour": "wheat flour",
    "cornflour": "cornstarch", "black treacle": "molasses",
    "porridge oats": "oats", "quick-cooking porridge oats": "oats",
    "quick cooking oats": "oats", "quick-cooking oats": "oats",
    "double cream": "cream", "single cream": "cream",
    "soured cream": "sour cream", "spring onion": "onions",
    "spring onions": "onions", "beef mince": "beef", "pork mince": "pork",
    "lamb mince": "lamb", "turkey mince": "turkey", "mince": "beef",
    "caster sugar": "sugars", "icing sugar": "sugars", "granulated sugar": "sugars",
    "bicarbonate of soda": "leavening agents", "tinned tomatoes": "tomatoes",
    "chopped tomatoes": "tomatoes", "passata": "tomato products",
    "tomato puree": "tomato products", "stock cube": "soup",
    "vegetable stock": "soup", "chicken stock": "soup", "beef stock": "soup",
    "greek yogurt": "yogurt", "natural yogurt": "yogurt",
    "cooking spray": "oil", "nonstick cooking spray": "oil",
    "chilli": "peppers", "chillies": "peppers", "jalapeno": "peppers",
    "bay leaf": "bay leaf", "mixed herbs": "herbs",
}


# Scoring alone cannot decide that plain "milk" means cow's milk rather than
# buttermilk, or that "cheese" in a family recipe means cheddar. These pin the
# staples a cook is most likely to have written down. Values are exact USDA
# SR Legacy descriptions.
CANONICAL_OVERRIDES = {
    "milk": "Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D",
    "whole milk": "Milk, whole, 3.25% milkfat, with added vitamin D",
    "skimmed milk": "Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)",
    "cheese": "Cheese, cheddar (Includes foods for USDA's Food Distribution Program)",
    "cheddar": "Cheese, cheddar (Includes foods for USDA's Food Distribution Program)",
    "egg": "Egg, whole, raw, fresh",
    "tomato": "Tomatoes, red, ripe, raw, year round average",
    "potato": "Potatoes, flesh and skin, raw",
    "black bean": "Beans, black turtle, mature seeds, canned",
    "bread": "Bread, white, commercially prepared (includes soft bread crumbs)",
    "sugar": "Sugars, granulated",
    "chicken": "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
    "chicken breast": "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
    "beef": "Beef, ground, 85% lean meat / 15% fat, crumbles, cooked, pan-browned",
    "beef mince": "Beef, ground, 85% lean meat / 15% fat, crumbles, cooked, pan-browned",
    "tuna": "Fish, tuna, light, canned in water, without salt, drained solids",
    "pepper": "Peppers, sweet, red, raw",
    "apple": "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)",
    "flour": "Wheat flour, white, all-purpose, enriched, unbleached",
    "plain flour": "Wheat flour, white, all-purpose, enriched, unbleached",
    "olive oil": "Oil, olive, salad or cooking",
    "rice": "Rice, white, long-grain, regular, raw, enriched",
    "yogurt": "Yogurt, plain, low fat",
    # USDA files these under a head noun a UK cook would never search for
    "courgette": "Squash, summer, zucchini, includes skin, raw",
    "zucchini": "Squash, summer, zucchini, includes skin, raw",
    "coriander leaf": "Coriander (cilantro) leaves, raw",
    "fresh coriander": "Coriander (cilantro) leaves, raw",
    "cilantro": "Coriander (cilantro) leaves, raw",
    "mangetout": "Peas, edible-podded, raw",
    "green beans": "Beans, snap, green, raw",
    "rocket": "Arugula, raw",
}


def build_reference_index():
    rows = json.loads((DATA / "ingredient_reference.json").read_text())
    by_head = defaultdict(list)
    for row in rows:
        segments = [s.strip().lower() for s in row["display_name"].split(",")]
        head = segments[0]
        by_head[head].append(row)
        if head in GROUP_HEADS and len(segments) > 1 and segments[1]:
            by_head[segments[1]].append(row)
            # "spices, cumin seed" should also answer to plain "cumin"
            bare = re.sub(r"\s+(seeds?|leaves|leaf|dried|whole)$", "",
                          segments[1]).strip()
            if bare and bare != segments[1]:
                by_head[bare].append(row)

    # Each head noun maps to many USDA rows (Carrot dehydrated, Carrots baby
    # raw, ...). Pick the plainest, most cook-like form.
    PENALTIES = [
        ("dehydrated", 300), ("baby food", 500), ("infant", 500), ("baby", 250),
        ("canned", 200), ("deli", 200), ("restaurant", 200), ("fast food", 200),
        ("school", 200), ("flavor", 150), ("dried", 150), ("frozen", 150),
        ("seasoned", 120), ("juice", 100), ("prepared", 80), ("mix", 80),
        ("sauce", 80), ("includes foods for usda", 60), ("boiled", 60),
        ("with salt", 40), ("low sodium", 40), ("unprepared", 60),
        ("reduced fat", 40), ("fat free", 40), ("imitation", 200),
        # non-cow dairy, concentrates and dry mixes are never what a recipe means
        ("sheep", 300), ("goat", 300), ("buffalo", 300), ("human", 600),
        ("camel", 300), ("reindeer", 400), ("soup", 200), ("dry", 150),
        ("evaporated", 200), ("condensed", 250), ("powder", 200),
        ("beverage", 150), ("substitute", 250), ("nonfat", 60),
    ]

    def score(row, head):
        desc = row["display_name"].lower()
        penalty = len(desc)
        segments = [s.strip() for s in desc.split(",")]
        # "onions, raw" must win the key "onion", so compare singular forms
        if singularise_phrase(segments[0]) == singularise_phrase(head) and (
            len(segments) == 1 or segments[1] in ("raw", "all types")
        ):
            penalty -= 1000
        if re.search(r"\braw\b", desc):
            penalty -= 60
        for word, cost in PENALTIES:
            if word in desc:
                penalty += cost
        return penalty

    # "onion" and "onions" are the same shelf, so they must choose from the same
    # candidate list -- otherwise plain "onion" ends up on a dried soup mix.
    merged = defaultdict(list)
    for head, candidates in by_head.items():
        merged[singularise_phrase(head)].extend(candidates)

    canonical = {}
    for head in sorted(by_head):
        key = singularise_phrase(head)
        best = sorted(merged[key], key=lambda row: score(row, key))[0]
        canonical[head] = best
        canonical.setdefault(key, best)
        canonical.setdefault(head + "s", best)
    by_desc = {row["display_name"].lower(): row for row in rows}
    for key, desc in CANONICAL_OVERRIDES.items():
        row = by_desc.get(desc.lower())
        if row is None:
            raise SystemExit(f"CANONICAL_OVERRIDES: no USDA row named {desc!r}")
        canonical[key] = row
        canonical[singularise_phrase(key)] = row
        canonical[key + "s"] = row

    for uk_name, usda_name in REFERENCE_ALIASES.items():
        target = canonical.get(usda_name) or canonical.get(singularise_phrase(usda_name))
        if target:
            canonical.setdefault(uk_name, target)
            canonical.setdefault(singularise_phrase(uk_name), target)
    return canonical


def _lookup(canonical, phrase):
    for candidate in (phrase, singularise_phrase(phrase), phrase + "s"):
        if candidate in canonical:
            return canonical[candidate]
    return None


def match_reference(name, canonical):
    """Match on the head noun: try the whole phrase, then drop leading words.

    Dropping leading words first matters because English food names put the
    head noun last -- "fat-free milk" must resolve to milk, not to "fat".
    """
    key = re.sub(r"\s+", " ", name.lower().strip())
    hit = _lookup(canonical, key)
    if hit:
        return hit
    tokens = [t for t in re.findall(r"[a-z]+", key) if t not in SIZE_WORDS]
    if not tokens:
        tokens = re.findall(r"[a-z]+", key)
    for start in range(len(tokens)):
        hit = _lookup(canonical, " ".join(tokens[start:]))
        if hit:
            return hit
    for end in range(len(tokens) - 1, 0, -1):
        hit = _lookup(canonical, " ".join(tokens[:end]))
        if hit:
            return hit
    return None


def resolve_aisle(name, reference):
    lowered = name.lower()
    for pattern, aisle in AISLE_OVERRIDES:
        if re.search(pattern, lowered):
            return aisle
    if reference and reference.get("aisle"):
        return reference["aisle"]
    for pattern, aisle in AISLE_FALLBACK:
        if re.search(pattern, lowered):
            return aisle
    return None


def grams_for_measure(reference, unit):
    if not reference:
        return None
    aliases = {
        "cup": ("cup",), "tablespoon": ("tablespoon", "tbsp"),
        "teaspoon": ("teaspoon", "tsp"), "fl oz": ("fl oz",), "pint": ("pint",),
        "quart": ("quart",),
    }.get(unit, (unit,))
    prefixed = None
    for portion in reference["portions"]:
        label = (portion["unit"] or "").lower().strip()
        if label in aliases:
            return portion["grams_per_unit"]
        # USDA writes measures like 'cup, sliced' or 'tbsp chopped'. Those are
        # usable when no bare measure exists, so keep the first as a fallback.
        if prefixed is None and any(
            label.startswith(alias + ",") or label.startswith(alias + " ")
            for alias in aliases
        ):
            prefixed = portion["grams_per_unit"]
    return prefixed


# ---------------------------------------------------------------- ingredient lines

def parse_ingredient(raw, note, canonical):
    line = raw
    for symbol, replacement in VULGAR.items():
        line = line.replace(symbol, replacement)
    line = strip_accents(line).strip()
    line = re.sub(r"\s+", " ", line)

    optional = bool(re.search(r"\boptional\b", f"{line} {note or ''}", re.I))

    # container size, e.g. "1 can (14.5 ounces) diced tomatoes"
    container = re.search(
        r"\((\d+(?:\.\d+)?)\s*(ounces?|oz|pounds?|lb|grams?|g|ml|milliliters?|"
        r"fluid ounces?|fl oz)\.?\)",
        line,
        re.I,
    )
    container_grams = None
    if container:
        size = float(container.group(1))
        unit = container.group(2).lower().rstrip(".")
        weight_form = next((f for f in singular_forms(unit) if f in WEIGHT_G), None)
        if weight_form and "fluid" not in unit:
            container_grams = size * WEIGHT_G[weight_form]
        elif unit in ("fluid ounces", "fluid ounce", "fl oz"):
            container_grams = size * 30.0
        elif unit in ("ml", "milliliters", "milliliter"):
            container_grams = size
        line = line.replace(container.group(0), " ")

    line = re.sub(r"\s+", " ", line).strip()

    # leading quantity, possibly a range ("2 to 3", "2-3")
    qty_match = re.match(
        r"^(\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)"
        r"(?:\s*(?:-|–|to)\s*(\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?))?\s*",
        line,
    )
    quantity, rest = None, line
    if qty_match:
        low = parse_amount(qty_match.group(1))
        high = parse_amount(qty_match.group(2)) if qty_match.group(2) else None
        quantity = (low + high) / 2 if (low is not None and high is not None) else low
        rest = line[qty_match.end() :].strip()

    unit_match = re.match(
        r"^([a-zA-Z]+(?:\s+(?:ounces?|oz))?)\.?\s+", rest + " "
    )
    unit, name_part = None, rest
    if unit_match:
        token = unit_match.group(1).lower().rstrip(".")
        forms = singular_forms(token)
        weight_form = next((f for f in forms if f in WEIGHT_G), None)
        volume_form = next((f for f in forms if f in VOLUME_ML), None)
        if weight_form:
            unit = weight_form
        elif volume_form:
            unit = volume_form
        elif token in COUNT_UNITS:
            unit = token
        if unit:
            name_part = rest[unit_match.end(1) :].lstrip(". ").strip()

    if re.match(r"^(fluid ounces?|fl oz)\b", name_part, re.I):
        unit = "fl oz"
        name_part = re.sub(r"^(fluid ounces?|fl oz)\b\.?\s*", "", name_part, flags=re.I)

    # "1 ripe, fresh avocado, ..." starts with a descriptive fragment that would
    # otherwise be mistaken for the ingredient name.
    name_part = re.sub(r"^(?:(?:ripe|fresh|large|small|medium|whole)\s*,\s*)+", "",
                       name_part, flags=re.I).strip()

    # preparation trails the name after a comma
    preparation = None
    if "," in name_part:
        head, _, tail = name_part.partition(",")
        tail_clean = tail.strip().strip(".")
        tail_tokens = [t.strip() for t in re.split(r",|\band\b", tail_clean.lower()) if t.strip()]
        prep_like = [t for t in tail_tokens if any(p in t for p in PREP_WORDS)]
        known = [t for t in tail_tokens
                 if any(p in t for p in PREP_WORDS) or t in SIZE_WORDS]
        # If the tail is only prep/descriptive terms, or the head is already a
        # usable name and the tail mentions any prep verb, split it off.
        if tail_tokens and (
            len(known) == len(tail_tokens)
            or (prep_like and len(head.split()) <= 4)
        ):
            preparation = tail_clean or None
            name_part = head.strip()

    name = re.sub(r"\(.*?\)", " ", name_part)
    # a leading size adjective belongs to the quantity, not the name
    name = re.sub(r"^(?:small|medium|large|extra[- ]large|jumbo)\s+(?=\S)", "", name,
                  flags=re.I)
    # "1/2 head of cabbage" leaves "of cabbage"; a stray dimension ("8 inch flour
    # tortillas") belongs to the note, not the name.
    name = re.sub(r"^(?:of|a|an)\s+(?=\S)", "", name, flags=re.I)
    name = re.sub(r"^\d+(?:\.\d+)?\s*(?:-|\s)?\s*(?:inch|in|cm|mm)\b\.?\s*", "", name,
                  flags=re.I)
    name = re.sub(r"^(?:of|a|an)\s+(?=\S)", "", name, flags=re.I)
    name = re.sub(r"\s+", " ", name).strip(" .,")
    name = localise(name) or "ingredient"
    if preparation:
        preparation = localise(preparation)

    reference = match_reference(name, canonical)
    aisle = resolve_aisle(name, reference)
    if aisle == "Chilled meats":
        aisle = "Meat and poultry"
    if re.search(r"\b(can|cans|canned|tin|tinned|jar)\b", raw, re.I) and aisle not in (
        "Frozen", "Bakery", "Meat and poultry",
    ):
        # a canned ingredient sits on the tinned aisle whatever the food is:
        # "2 cans cream style corn" is not a trip to the dairy fridge
        aisle = "Tins"

    # convert to metric
    final_unit, final_qty = unit, quantity
    if container_grams and quantity:
        final_qty, final_unit = round(container_grams * quantity), "g"
    elif unit in WEIGHT_G and quantity:
        final_qty, final_unit = round(quantity * WEIGHT_G[unit]), "g"
    elif unit in VOLUME_ML and quantity:
        grams = grams_for_measure(reference, unit)
        lowered_name = name.lower()
        if grams is None:
            # derive from the cup weight where USDA only lists one measure
            cup_grams = grams_for_measure(reference, "cup") or next(
                (g for key, g in DRY_CUP_GRAMS.items()
                 if re.search(rf"\b{key}", lowered_name)),
                None,
            )
            if cup_grams:
                grams = {"cup": 1.0, "tablespoon": 1 / 16, "teaspoon": 1 / 48}.get(unit)
                grams = cup_grams * grams if grams else None
        if grams is None and unit in ("teaspoon", "tablespoon") and \
                resolve_aisle(name, reference) == "Spices":
            grams = 2.0 if unit == "teaspoon" else 6.0
        if grams and not LIQUIDS.search(name.lower()):
            final_qty, final_unit = round(quantity * grams), "g"
        else:
            final_qty, final_unit = round(quantity * VOLUME_ML[unit]), "ml"
    elif unit in COUNT_UNITS:
        final_unit = COUNT_UNITS[unit]
    elif unit is None and quantity is not None:
        final_unit = "each"

    if final_qty is not None:
        final_qty = round(float(final_qty), 2)
    if final_qty is not None and final_unit in ("g", "ml") and float(final_qty) < 10:
        # rounding a half teaspoon of dried oregano to "0 g" is worse than useless
        final_qty = round(float(final_qty), 1) or 0.5
        if final_qty == int(final_qty):
            final_qty = int(final_qty)

    # hyphens are word separators here: "low-sodium" must not become "lowsodium",
    # otherwise the descriptor survives the strip below and breaks pantry matching
    normalized = re.sub(r"[-/]", " ", name.lower())
    normalized = re.sub(r"[^a-z ]", "", normalized).strip()
    normalized = re.sub(r"\b(fresh|frozen|dried|canned|tinned|raw|cooked|low sodium|"
                        r"reduced sodium|no salt added|unsalted|lean|boneless|skinless)\b",
                        "", normalized).strip()
    normalized = re.sub(r"\s+", " ", normalized)
    normalized = singularise_phrase(normalized) or name.lower()

    return {
        "name": name[:1].upper() + name[1:] if name else "Ingredient",
        "normalized_name": normalized,
        "quantity": final_qty,
        "unit": final_unit,
        "preparation": preparation,
        "optional": optional,
        "aisle": aisle,
        "reference_slug": reference["slug"] if reference else None,
        "reference_fdc_id": reference["fdc_id"] if reference else None,
        "source_line": raw,
    }


# ---------------------------------------------------------------- recipe mapping

def slugify(value, seen):
    base = re.sub(r"[^a-z0-9]+", "-", strip_accents(value).lower()).strip("-")[:70]
    base = base or "recipe"
    slug, n = base, 2
    while slug in seen:
        slug = f"{base}-{n}"
        n += 1
    seen.add(slug)
    return slug


def derive_tags(record, ingredients):
    blob = " ".join(
        [record["title"], record.get("description") or ""]
        + [i["normalized_name"] for i in ingredients]
    ).lower()

    allergens = sorted({tag for tag, pattern in ALLERGEN_RULES if pattern.search(blob)})

    has_meat = bool(MEAT.search(blob))
    has_fish = bool(FISH.search(blob))
    dietary = []
    if not has_meat and not has_fish:
        dietary.append("vegetarian")
        if not DAIRY.search(blob) and not EGG.search(blob) and not HONEY.search(blob):
            dietary.append("vegan")
    if "gluten" not in allergens:
        dietary.append("gluten-free")
    if not DAIRY.search(blob):
        dietary.append("dairy-free")

    cuisines = [name for name, pattern in CUISINES if re.search(pattern, blob)][:2]

    meal_types = []
    if BREAKFAST.search(blob):
        meal_types.append("breakfast")
    if LUNCHBOX.search(blob):
        meal_types += ["lunch", "lunchbox"]
    if SNACK.search(record["title"].lower()):
        meal_types.append("snack")
    if not meal_types or "dinner" in blob:
        meal_types.append("dinner")
    if "lunch" not in meal_types and "soup" in blob:
        meal_types.append("lunch")
    meal_types = sorted(set(meal_types) & {"breakfast", "lunch", "dinner", "snack", "lunchbox"})

    return allergens, sorted(set(dietary)), cuisines, meal_types or ["dinner"]


def estimate_times(record):
    text_blob = " ".join(record["instructions"]).lower()
    minutes = [int(m) for m in re.findall(r"(\d{1,3})\s*(?:to\s*\d{1,3}\s*)?minutes", text_blob)]
    cook = min(sum(minutes), 180) if minutes else 0
    hours = re.findall(r"(\d)\s*hours?", text_blob)
    if hours:
        cook = min(cook + int(hours[0]) * 60, 240)
    title_minutes = re.findall(r"(\d{1,3})[- ]minute", record["title"].lower())
    if title_minutes:
        cook = int(title_minutes[0])
    steps = len(record["instructions"])
    prep = max(5, min(30, 5 * ((steps + 1) // 2)))
    return prep, cook


def difficulty_for(steps, ingredient_count, cook):
    if steps <= 5 and ingredient_count <= 8 and cook <= 30:
        return "easy"
    if steps <= 12 and (ingredient_count <= 16 or cook <= 45):
        return "medium"
    return "advanced"


COLLECTIONS = [
    {
        "slug": "fast-weeknights-usda-volume-1",
        "title": "Fast Weeknights",
        "subtitle": "Reviewed public-domain dinners on the clock",
        "description": "Quick main meals with short ingredient lists, imported from the USDA MyPlate Kitchen public-domain collection and converted to metric.",
        "test": lambda r: r["total_minutes"] <= 35 and "dinner" in r["meal_types"],
    },
    {
        "slug": "plant-forward-staples-usda-volume-1",
        "title": "Plant-Forward Staples",
        "subtitle": "Vegetable, bean and grain mains",
        "description": "Vegetarian and vegan mains built on pulses, grains and vegetables, imported from the USDA MyPlate Kitchen public-domain collection.",
        "test": lambda r: "vegetarian" in r["dietary_tags"] and "dinner" in r["meal_types"],
    },
    {
        "slug": "budget-and-batch-usda-volume-1",
        "title": "Budget and Batch Cooking",
        "subtitle": "Larger yields and store-cupboard mains",
        "description": "Higher-yield, pantry-led recipes for batch cooking and freezing, imported from the USDA MyPlate Kitchen public-domain collection.",
        "test": lambda r: r["servings"] >= 6,
    },
    {
        "slug": "family-and-lunchbox-usda-volume-1",
        "title": "Family and Lunchbox",
        "subtitle": "Portable lunches, wraps, salads and sandwiches",
        "description": "Lunchbox-friendly and family-shaped dishes, imported from the USDA MyPlate Kitchen public-domain collection.",
        "test": lambda r: bool({"lunch", "lunchbox", "snack"} & set(r["meal_types"])),
    },
    {
        "slug": "breakfast-foundations-usda-volume-1",
        "title": "Breakfast Foundations",
        "subtitle": "Porridge, eggs and morning plates",
        "description": "Breakfasts and flexible morning foundations, imported from the USDA MyPlate Kitchen public-domain collection.",
        "test": lambda r: "breakfast" in r["meal_types"],
    },
    {
        "slug": "use-it-up-usda-volume-2",
        "title": "Use It Up, Volume 2",
        "subtitle": "Flexible dishes for food that needs attention",
        "description": "Soups, traybakes, stir-fries and skillet dishes that absorb whatever is close to expiry, imported from the USDA MyPlate Kitchen public-domain collection.",
        "test": lambda r: True,
    },
]

PER_COLLECTION_CAP = 48

CREATOR = {
    "slug": "usda-myplate-kitchen",
    "display_name": "USDA MyPlate Kitchen",
    "bio": "Recipes published by the U.S. Department of Agriculture's MyPlate Kitchen. Works of the U.S. federal government are in the public domain. Imported, converted to metric and localised for UK kitchens by the Kitchen Companion test kitchen; each recipe still requires an editorial test cook and review before publication.",
    "website_url": "https://www.myplate.gov/myplate-kitchen",
    "social_links": {},
}


def main():
    canonical = build_reference_index()
    records = [json.loads(line) for line in (DATA / "recipes.jsonl").read_text().splitlines()]

    mapped, unmatched = [], defaultdict(int)
    for record in records:
        ingredients = []
        for position, item in enumerate(record["ingredients"]):
            parsed = parse_ingredient(item["raw"], item.get("note"), canonical)
            parsed["position"] = position
            if not parsed["reference_slug"]:
                unmatched[parsed["normalized_name"]] += 1
            ingredients.append(parsed)

        if len(ingredients) < 3:
            continue
        allergens, dietary, cuisines, meal_types = derive_tags(record, ingredients)
        prep, cook = estimate_times(record)
        servings = int(record["servings"] or 4)
        nutrition = {k: v for k, v in (record["nutrition_per_serving"] or {}).items() if v is not None}

        mapped.append(
            {
                "source_slug": record["slug"],
                "title": record["title"],
                "description": localise(record["description"]) if record.get("description") else None,
                "servings": max(1, servings),
                "prep_minutes": prep,
                "cook_minutes": cook,
                "total_minutes": prep + cook,
                "difficulty": difficulty_for(len(record["instructions"]), len(ingredients), cook),
                "cuisine_tags": cuisines,
                "dietary_tags": dietary,
                "allergen_tags": allergens,
                "meal_types": meal_types,
                "instructions": [fahrenheit_to_celsius(localise(s)) for s in record["instructions"]],
                "nutrition": nutrition,
                "ingredients": ingredients,
                "notes": record.get("notes"),
                "serving_size": record.get("serving_size"),
                "usda_rating": record.get("usda_rating"),
                "usda_rating_count": record.get("usda_rating_count"),
                "source_url": record["source_url"],
                "archive_url": record["archive_url"],
                "source_credit": record.get("source_credit"),
            }
        )

    # assign each recipe to exactly one collection, best fit first
    assigned, buckets = set(), {c["slug"]: [] for c in COLLECTIONS}
    mapped.sort(key=lambda r: (-(r["usda_rating"] or 0), r["title"]))
    for collection in COLLECTIONS:
        for recipe in mapped:
            if recipe["source_slug"] in assigned:
                continue
            if collection["test"](recipe) and len(buckets[collection["slug"]]) < PER_COLLECTION_CAP:
                buckets[collection["slug"]].append(recipe)
                assigned.add(recipe["source_slug"])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for path in OUT_DIR.glob("*.json"):
        path.unlink()

    seen_slugs, totals = set(), {}
    for collection in COLLECTIONS:
        chosen = buckets[collection["slug"]]
        if len(chosen) < 6:
            totals[collection["slug"]] = len(chosen)
            if not chosen:
                continue
        payload_recipes = []
        for recipe in chosen:
            slug = slugify(recipe["title"], seen_slugs)
            rights_notes = (
                "Imported from USDA MyPlate Kitchen, a work of the U.S. federal government "
                f"and therefore in the public domain. Source page: {recipe['source_url']} "
                f"(archived copy: {recipe['archive_url']})."
            )
            if recipe["source_credit"]:
                rights_notes += f" USDA credit line: {recipe['source_credit']}."
            rights_notes += (
                " Quantities were converted from US customary measures to metric and names "
                "localised for UK kitchens, so a reviewer must test cook the recipe and "
                "confirm quantities, timings, allergens and nutrition before publication."
            )
            payload_recipes.append(
                {
                    "slug": slug,
                    "title": recipe["title"],
                    "description": recipe["description"],
                    "servings": recipe["servings"],
                    "prep_minutes": recipe["prep_minutes"],
                    "cook_minutes": recipe["cook_minutes"],
                    "difficulty": recipe["difficulty"],
                    "cuisine_tags": recipe["cuisine_tags"],
                    "dietary_tags": recipe["dietary_tags"],
                    "allergen_tags": recipe["allergen_tags"],
                    "meal_types": recipe["meal_types"],
                    "instructions": recipe["instructions"],
                    "nutrition": recipe["nutrition"],
                    "source_type": "creator",
                    "source_url": recipe["source_url"],
                    "rights_basis": "public_domain",
                    "rights_notes": rights_notes,
                    "content_version": 1,
                    "ingredients": [
                        {
                            "name": i["name"],
                            "normalized_name": i["normalized_name"],
                            "quantity": i["quantity"],
                            "unit": i["unit"],
                            "preparation": i["preparation"],
                            "optional": i["optional"],
                            "aisle": i["aisle"],
                        }
                        for i in recipe["ingredients"]
                    ],
                    "import_metadata": {
                        "serving_size": recipe["serving_size"],
                        "usda_rating": recipe["usda_rating"],
                        "usda_rating_count": recipe["usda_rating_count"],
                        "usda_notes": recipe["notes"],
                        "archive_url": recipe["archive_url"],
                        "ingredient_source_lines": [i["source_line"] for i in recipe["ingredients"]],
                        "ingredient_reference_fdc_ids": [
                            i["reference_fdc_id"] for i in recipe["ingredients"]
                        ],
                    },
                }
            )

        payload = {
            "creator": CREATOR,
            "book": {
                "slug": collection["slug"],
                "title": collection["title"],
                "subtitle": collection["subtitle"],
                "description": collection["description"],
                "content_version": 1,
                "access_model": "included",
            },
            "recipes": payload_recipes,
        }
        (OUT_DIR / f"{collection['slug']}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        )
        totals[collection["slug"]] = len(payload_recipes)

    REVIEW.write_text(
        json.dumps(
            {
                "unmatched_ingredient_names": sorted(
                    unmatched.items(), key=lambda kv: -kv[1]
                )[:200],
                "unmatched_total": len(unmatched),
            },
            indent=2,
        )
    )

    print("collection totals:")
    for slug, count in totals.items():
        print(f"  {slug}: {count}")
    print(f"total recipes packaged: {sum(totals.values())} of {len(mapped)} parsed")
    print(f"distinct unmatched ingredient names: {len(unmatched)}")


if __name__ == "__main__":
    main()
