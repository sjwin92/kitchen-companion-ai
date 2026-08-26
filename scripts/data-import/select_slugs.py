"""Pick candidate MyPlate Kitchen recipe slugs biased toward real meals."""
import os, json, pathlib, re

# Working directory for downloaded source data and intermediates. Override
# with KC_IMPORT_WORKDIR; defaults to a gitignored folder beside this script.
_WORKDIR = pathlib.Path(os.environ.get("KC_IMPORT_WORKDIR")
                        or pathlib.Path(__file__).resolve().parent / "workdir")
_REPO = pathlib.Path(__file__).resolve().parents[2]


slugs = json.loads((_WORKDIR / "myplate_slugs.json").read_text())

EXCLUDE = re.compile(
    r"cake|cookie|brownie|frosting|icing|pudding|candy|fudge|popsicle|smoothie|"
    r"punch|lemonade|milkshake|shake$|cupcake|pie-crust|pastry|donut|doughnut|"
    r"truffle|toffee|caramel|marshmallow|sorbet|ice-cream|gelatin|jello|"
    r"cobbler|crisp-dessert|tart|sundae|whipped|syrup|jam|jelly|pickle|"
    r"seasoning|spice-mix|rub$|dressing$|vinaigrette|marinade|sauce$|salsa$|"
    r"dip$|hummus$|guacamole$|butter$|mayonnaise|ketchup|playdough|craft"
)

MEAL = re.compile(
    r"chicken|beef|pork|turkey|fish|salmon|tuna|shrimp|bean|lentil|chickpea|"
    r"pasta|noodle|rice|quinoa|barley|couscous|soup|stew|chili|curry|stir-fry|"
    r"casserole|bake$|traybake|skillet|taco|burrito|enchilada|quesadilla|"
    r"sandwich|wrap|burger|pizza|salad|omelet|omelette|frittata|egg|scramble|"
    r"oatmeal|porridge|pancake|waffle|toast|hash|bowl|pilaf|risotto|"
    r"lasagna|meatball|meatloaf|sloppy|goulash|jambalaya|paella|"
    r"veggie|vegetable|tofu|potato|sweet-potato|squash|greens|slaw|"
    r"breakfast|lunch|dinner|supper|one-pot|sheet-pan"
)

candidates = []
for s in slugs:
    if EXCLUDE.search(s):
        continue
    score = 2 if MEAL.search(s) else 0
    candidates.append((score, s))

candidates.sort(key=lambda x: (-x[0], x[1]))
selected = [s for score, s in candidates if score == 2][:260]
# top up with neutral entries if needed
if len(selected) < 260:
    selected += [s for score, s in candidates if score == 0][: 260 - len(selected)]

(_WORKDIR / "candidates.json").write_text(json.dumps(selected, indent=0))
print(f"total slugs={len(slugs)} candidates={len(candidates)} selected={len(selected)}")
print(selected[:20])
