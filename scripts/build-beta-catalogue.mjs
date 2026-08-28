import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_DIR = path.resolve('catalogue/beta-200');
const SQL_OUTPUT = path.resolve('supabase/seed/catalogue-200-candidates.sql');
const BATCH = 'beta-200';

const pantry = {
  oats: ['Rolled oats', 'oat', 240, 'g', 'Cereal'],
  bread: ['Wholemeal bread', 'bread', 8, 'slices', 'Bakery'],
  tortilla: ['Large tortilla wraps', 'tortilla', 4, 'each', 'Bakery'],
  rice: ['Long-grain rice', 'rice', 280, 'g', 'Pasta and grains'],
  brown_rice: ['Brown rice', 'brown rice', 280, 'g', 'Pasta and grains'],
  quinoa: ['Quinoa', 'quinoa', 240, 'g', 'Pasta and grains'],
  couscous: ['Couscous', 'couscous', 280, 'g', 'Pasta and grains'],
  barley: ['Pearl barley', 'barley', 260, 'g', 'Pasta and grains'],
  pasta: ['Dried pasta', 'pasta', 320, 'g', 'Pasta and grains'],
  wholewheat_pasta: ['Wholewheat pasta', 'wholewheat pasta', 320, 'g', 'Pasta and grains'],
  noodles: ['Egg noodles', 'egg noodle', 300, 'g', 'World foods'],
  rice_noodles: ['Rice noodles', 'rice noodle', 300, 'g', 'World foods'],
  potato: ['Potatoes', 'potato', 800, 'g', 'Produce'],
  sweet_potato: ['Sweet potatoes', 'sweet potato', 800, 'g', 'Produce'],
  flour: ['Self-raising flour', 'wheat flour', 220, 'g', 'Baking'],
  granola: ['Low-sugar granola', 'granola', 160, 'g', 'Cereal'],
  chickpea: ['Tinned chickpeas', 'chickpea', 800, 'g', 'Tins'],
  lentil: ['Tinned green lentils', 'lentil', 800, 'g', 'Tins'],
  red_lentil: ['Dried red lentils', 'red lentil', 260, 'g', 'Pasta and grains'],
  black_bean: ['Tinned black beans', 'black bean', 800, 'g', 'Tins'],
  butter_bean: ['Tinned butter beans', 'butter bean', 800, 'g', 'Tins'],
  kidney_bean: ['Tinned kidney beans', 'kidney bean', 800, 'g', 'Tins'],
  tofu: ['Firm tofu', 'tofu', 500, 'g', 'Chilled'],
  tempeh: ['Tempeh', 'tempeh', 400, 'g', 'Chilled'],
  eggs: ['Large eggs', 'egg', 8, 'each', 'Eggs'],
  greek_yogurt: ['Greek-style yogurt', 'greek yogurt', 500, 'g', 'Dairy'],
  plant_yogurt: ['Unsweetened plant yogurt', 'plant yogurt', 500, 'g', 'Dairy alternatives'],
  cottage_cheese: ['Cottage cheese', 'cottage cheese', 300, 'g', 'Dairy'],
  cheddar: ['Mature cheddar', 'cheddar', 140, 'g', 'Dairy'],
  feta: ['Feta', 'feta', 160, 'g', 'Dairy'],
  chicken_breast: ['Chicken breast', 'chicken breast', 600, 'g', 'Meat'],
  chicken_thigh: ['Skinless chicken thighs', 'chicken thigh', 700, 'g', 'Meat'],
  turkey_mince: ['Turkey mince', 'turkey mince', 500, 'g', 'Meat'],
  beef_mince: ['Lean beef mince', 'beef mince', 500, 'g', 'Meat'],
  pork: ['Pork tenderloin', 'pork', 600, 'g', 'Meat'],
  salmon: ['Salmon fillets', 'salmon', 520, 'g', 'Fish'],
  cod: ['Cod fillets', 'cod', 560, 'g', 'Fish'],
  prawns: ['Raw king prawns', 'prawn', 450, 'g', 'Fish'],
  tuna: ['Tinned tuna in spring water', 'tuna', 320, 'g', 'Tins'],
  mackerel: ['Smoked mackerel fillets', 'mackerel', 360, 'g', 'Fish'],
  onion: ['Onion', 'onion', 1, 'each', 'Produce'],
  garlic: ['Garlic cloves', 'garlic', 3, 'cloves', 'Produce'],
  ginger: ['Fresh ginger', 'ginger', 20, 'g', 'Produce'],
  tomato: ['Tomatoes', 'tomato', 500, 'g', 'Produce'],
  tinned_tomato: ['Chopped tomatoes', 'tinned tomato', 800, 'g', 'Tins'],
  passata: ['Passata', 'passata', 700, 'ml', 'Tins'],
  spinach: ['Baby spinach', 'spinach', 200, 'g', 'Produce'],
  kale: ['Kale', 'kale', 250, 'g', 'Produce'],
  broccoli: ['Broccoli', 'broccoli', 400, 'g', 'Produce'],
  cauliflower: ['Cauliflower', 'cauliflower', 1, 'each', 'Produce'],
  pepper: ['Mixed peppers', 'pepper', 3, 'each', 'Produce'],
  courgette: ['Courgettes', 'courgette', 2, 'each', 'Produce'],
  carrot: ['Carrots', 'carrot', 4, 'each', 'Produce'],
  peas: ['Frozen peas', 'pea', 300, 'g', 'Frozen'],
  mushroom: ['Chestnut mushrooms', 'mushroom', 400, 'g', 'Produce'],
  corn: ['Sweetcorn', 'sweetcorn', 300, 'g', 'Tins'],
  cucumber: ['Cucumber', 'cucumber', 1, 'each', 'Produce'],
  lettuce: ['Romaine lettuce', 'lettuce', 1, 'each', 'Produce'],
  cabbage: ['White cabbage', 'cabbage', 500, 'g', 'Produce'],
  green_bean: ['Green beans', 'green bean', 300, 'g', 'Produce'],
  squash: ['Butternut squash', 'butternut squash', 800, 'g', 'Produce'],
  aubergine: ['Aubergines', 'aubergine', 2, 'each', 'Produce'],
  leek: ['Leeks', 'leek', 2, 'each', 'Produce'],
  celery: ['Celery sticks', 'celery', 4, 'sticks', 'Produce'],
  apple: ['Apples', 'apple', 2, 'each', 'Produce'],
  pear: ['Pears', 'pear', 2, 'each', 'Produce'],
  banana: ['Bananas', 'banana', 2, 'each', 'Produce'],
  berries: ['Frozen mixed berries', 'berry', 300, 'g', 'Frozen'],
  mango: ['Mango chunks', 'mango', 300, 'g', 'Frozen'],
  lemon: ['Lemon', 'lemon', 1, 'each', 'Produce'],
  lime: ['Limes', 'lime', 2, 'each', 'Produce'],
  orange: ['Orange', 'orange', 1, 'each', 'Produce'],
  plant_milk: ['Unsweetened plant milk', 'plant milk', 600, 'ml', 'Dairy alternatives'],
  milk: ['Semi-skimmed milk', 'milk', 600, 'ml', 'Dairy'],
  coconut_milk: ['Light coconut milk', 'coconut milk', 400, 'ml', 'Tins'],
  stock: ['Low-salt vegetable stock', 'vegetable stock', 900, 'ml', 'Stock'],
  chicken_stock: ['Low-salt chicken stock', 'chicken stock', 700, 'ml', 'Stock'],
  olive_oil: ['Olive oil', 'olive oil', 2, 'tbsp', 'Oils'],
  soy_sauce: ['Reduced-salt soy sauce', 'soy sauce', 3, 'tbsp', 'World foods'],
  tahini: ['Tahini', 'tahini', 3, 'tbsp', 'World foods'],
  peanut_butter: ['Peanut butter', 'peanut butter', 3, 'tbsp', 'Spreads'],
  almond_butter: ['Almond butter', 'almond butter', 3, 'tbsp', 'Spreads'],
  hummus: ['Hummus', 'hummus', 240, 'g', 'Chilled'],
  pesto: ['Basil pesto', 'pesto', 120, 'g', 'Jars'],
  curry_powder: ['Medium curry powder', 'curry powder', 2, 'tbsp', 'Spices'],
  cumin: ['Ground cumin', 'cumin', 2, 'tsp', 'Spices'],
  paprika: ['Smoked paprika', 'paprika', 2, 'tsp', 'Spices'],
  herbs: ['Dried mixed herbs', 'mixed herbs', 2, 'tsp', 'Spices'],
  cinnamon: ['Ground cinnamon', 'cinnamon', 2, 'tsp', 'Spices'],
  miso: ['White miso paste', 'miso', 2, 'tbsp', 'World foods'],
  mustard: ['Wholegrain mustard', 'mustard', 2, 'tbsp', 'Condiments'],
  maple: ['Maple syrup', 'maple syrup', 2, 'tbsp', 'Baking'],
  salsa: ['Tomato salsa', 'salsa', 240, 'g', 'Jars'],
  breadcrumbs: ['Wholemeal breadcrumbs', 'breadcrumb', 100, 'g', 'Bakery'],
  walnuts: ['Walnuts', 'walnut', 80, 'g', 'Baking'],
  seeds: ['Mixed seeds', 'seed mix', 80, 'g', 'Baking'],
};

const glutenKeys = new Set(['bread', 'tortilla', 'couscous', 'barley', 'pasta', 'wholewheat_pasta', 'noodles', 'flour', 'granola', 'breadcrumbs']);
const meatKeys = new Set(['chicken_breast', 'chicken_thigh', 'turkey_mince', 'beef_mince', 'pork']);
const fishKeys = new Set(['salmon', 'cod', 'prawns', 'tuna', 'mackerel']);
const dairyEggKeys = new Set(['eggs', 'greek_yogurt', 'cottage_cheese', 'cheddar', 'feta', 'milk', 'pesto', 'noodles']);
const allergenByKey = {
  bread: ['gluten'], tortilla: ['gluten'], couscous: ['gluten'], barley: ['gluten'], pasta: ['gluten'], wholewheat_pasta: ['gluten'], noodles: ['gluten', 'egg'], flour: ['gluten'], granola: ['gluten'], breadcrumbs: ['gluten'],
  tofu: ['soy'], tempeh: ['soy'], soy_sauce: ['soy', 'gluten'], miso: ['soy'], eggs: ['egg'], greek_yogurt: ['milk'], cottage_cheese: ['milk'], cheddar: ['milk'], feta: ['milk'], milk: ['milk'], pesto: ['milk'], salmon: ['fish'], cod: ['fish'], tuna: ['fish'], mackerel: ['fish'], prawns: ['crustaceans'], tahini: ['sesame'], hummus: ['sesame'], peanut_butter: ['peanuts'], almond_butter: ['nuts'], walnuts: ['nuts'], granola: ['gluten', 'nuts'],
};

const minutes = {
  oats: [8, 0], toast: [10, 5], egg: [10, 15], hash: [12, 25], yogurt: [8, 0], pancake: [10, 18],
  wrap: [15, 5], sandwich: [12, 0], salad: [15, 15], soup: [15, 30], pasta: [12, 22], onepot: [12, 30],
  traybake: [15, 35], curry: [15, 30], stirfry: [15, 15], bowl: [15, 25], tacos: [15, 20], bake: [18, 40], stew: [18, 50], fishpan: [12, 22],
};

const equipment = {
  oats: ['mixing bowl'], toast: ['frying pan'], egg: ['frying pan'], hash: ['frying pan'], yogurt: ['mixing bowl'], pancake: ['frying pan'],
  wrap: ['frying pan'], sandwich: ['chopping board'], salad: ['saucepan', 'mixing bowl'], soup: ['large saucepan'], pasta: ['large saucepan'], onepot: ['large saucepan'],
  traybake: ['oven', 'large roasting tray'], curry: ['large saucepan'], stirfry: ['wok'], bowl: ['saucepan'], tacos: ['frying pan'], bake: ['oven', 'baking dish'], stew: ['large saucepan'], fishpan: ['frying pan'],
};

const baseNutrition = {
  oats: [430, 13, 67, 12], toast: [420, 18, 51, 16], egg: [410, 27, 24, 23], hash: [510, 21, 71, 17], yogurt: [390, 22, 48, 13], pancake: [460, 17, 69, 14],
  wrap: [520, 23, 67, 18], sandwich: [470, 24, 54, 17], salad: [500, 22, 64, 18], soup: [430, 22, 57, 13], pasta: [610, 27, 88, 18], onepot: [570, 28, 78, 17],
  traybake: [590, 32, 69, 20], curry: [620, 27, 83, 21], stirfry: [560, 30, 72, 17], bowl: [600, 28, 82, 19], tacos: [550, 27, 63, 20], bake: [630, 31, 76, 22], stew: [520, 31, 55, 18], fishpan: [560, 35, 58, 20],
};

function slugify(value) {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ingredient(key, overrides = {}) {
  const row = pantry[key];
  if (!row) throw new Error(`Unknown ingredient: ${key}`);
  return {
    key,
    name: row[0],
    normalized_name: row[1],
    quantity: overrides.quantity ?? row[2],
    unit: overrides.unit ?? row[3],
    preparation: overrides.preparation ?? null,
    optional: overrides.optional ?? false,
    aisle: row[4],
  };
}

function name(key) {
  return pantry[key][0].replace(/^(Tinned|Frozen|Mixed|Large|Low-salt|Reduced-salt|Unsweetened|Light|Dried|Fresh|Skinless|Lean|Raw|Smoked|Wholemeal|Semi-skimmed) /, '').toLowerCase();
}

function uniqueIngredients(rows) {
  return [...new Map(rows.map(row => [row.key, row])).values()].map(({ key: _key, ...row }) => row);
}

const builders = {
  oats: c => ({
    ingredients: [ingredient('oats'), ingredient(c.milk ?? 'plant_milk'), ingredient(c.fruit), ingredient(c.extra), ingredient('cinnamon')],
    instructions: [`Combine the oats, ${name(c.milk ?? 'plant_milk')} and cinnamon in a lidded container.`, `Fold through half the ${name(c.fruit)} and ${name(c.extra)}.`, 'Cover and chill for at least 6 hours.', `Stir well, then finish with the remaining ${name(c.fruit)} before serving.`],
  }),
  toast: c => ({
    ingredients: [ingredient('bread'), ingredient(c.primary), ingredient(c.second), ingredient(c.accent), ingredient(c.acid ?? 'lemon')],
    instructions: ['Toast the bread until crisp at the edges.', `Prepare the ${name(c.primary)} and ${name(c.second)} while the bread toasts.`, `Layer the ${name(c.primary)} and ${name(c.second)} over the toast.`, `Finish with ${name(c.accent)} and a squeeze of ${name(c.acid ?? 'lemon')}.`],
  }),
  egg: c => ({
    ingredients: [ingredient('eggs'), ingredient(c.veg1), ingredient(c.veg2), ingredient(c.accent), ingredient('olive_oil')],
    instructions: [`Slice the ${name(c.veg1)} and ${name(c.veg2)} into bite-sized pieces.`, `Soften the vegetables in olive oil over a medium heat for 6–8 minutes.`, 'Beat the eggs, season, and pour them evenly into the pan.', `Cook gently until just set, then scatter over the ${name(c.accent)}.`],
  }),
  hash: c => ({
    ingredients: [ingredient(c.starch), ingredient(c.protein), ingredient(c.veg), ingredient(c.spice ?? 'paprika'), ingredient('olive_oil')],
    instructions: [`Cut the ${name(c.starch)} into 2 cm pieces and simmer for 8 minutes; drain well.`, `Fry the ${name(c.veg)} in olive oil until starting to soften.`, `Add the ${name(c.starch)}, ${name(c.protein)} and ${name(c.spice ?? 'paprika')}; cook until crisp and piping hot.`, 'Taste, season and divide between warm plates.'],
  }),
  yogurt: c => ({
    ingredients: [ingredient(c.yogurt ?? 'greek_yogurt'), ingredient(c.fruit), ingredient('granola'), ingredient(c.extra), ingredient(c.sweetener ?? 'maple')],
    instructions: [`Divide the ${name(c.yogurt ?? 'greek_yogurt')} between four jars or bowls.`, `Layer with the ${name(c.fruit)} and ${name(c.extra)}.`, 'Keep chilled until ready to eat.', 'Add the granola and a small drizzle of maple syrup immediately before serving.'],
  }),
  pancake: c => ({
    ingredients: [ingredient('flour'), ingredient(c.milk ?? 'milk'), ingredient('eggs', { quantity: 2 }), ingredient(c.fruit), ingredient(c.extra)],
    instructions: [`Whisk the flour, ${name(c.milk ?? 'milk')} and eggs into a smooth batter.`, `Fold half the ${name(c.fruit)} through the batter.`, 'Cook small pancakes in a lightly oiled frying pan for 2 minutes on each side.', `Serve with the remaining ${name(c.fruit)} and ${name(c.extra)}.`],
  }),
  wrap: c => ({
    ingredients: [ingredient('tortilla'), ingredient(c.protein), ingredient(c.veg1), ingredient(c.veg2), ingredient(c.sauce), ingredient(c.acid ?? 'lemon')],
    instructions: [`Prepare the ${name(c.protein)}, ${name(c.veg1)} and ${name(c.veg2)}.`, `Warm the wraps briefly in a dry pan, then spread with the ${name(c.sauce)}.`, `Add the filling and squeeze over the ${name(c.acid ?? 'lemon')}.`, 'Fold in the sides, roll tightly and halve to serve.'],
  }),
  sandwich: c => ({
    ingredients: [ingredient('bread'), ingredient(c.protein), ingredient(c.veg1), ingredient(c.veg2), ingredient(c.sauce)],
    instructions: [`Prepare the ${name(c.protein)} and vegetables, keeping the pieces small enough for an even filling.`, `Spread the bread with the ${name(c.sauce)}.`, `Layer in the ${name(c.protein)}, ${name(c.veg1)} and ${name(c.veg2)}.`, 'Close, press gently and slice just before serving.'],
  }),
  salad: c => ({
    ingredients: [ingredient(c.base), ingredient(c.protein), ingredient(c.veg1), ingredient(c.veg2), ingredient(c.leaves ?? 'spinach'), ingredient(c.dressing), ingredient(c.acid ?? 'lemon')],
    instructions: [`Cook the ${name(c.base)} until tender, then drain and cool for 10 minutes.`, `Prepare the ${name(c.protein)}, ${name(c.veg1)} and ${name(c.veg2)}.`, `Toss everything with the ${name(c.leaves ?? 'spinach')}.`, `Loosen the ${name(c.dressing)} with ${name(c.acid ?? 'lemon')} and fold it through just before serving.`],
  }),
  soup: c => ({
    ingredients: [ingredient(c.protein), ingredient(c.veg1), ingredient(c.veg2), ingredient('onion'), ingredient(c.liquid ?? 'stock'), ingredient(c.spice ?? 'herbs'), ingredient('olive_oil')],
    instructions: [`Dice the onion, ${name(c.veg1)} and ${name(c.veg2)} evenly.`, `Soften the vegetables in olive oil for 8 minutes, then stir in the ${name(c.spice ?? 'herbs')}.`, `Add the ${name(c.protein)} and ${name(c.liquid ?? 'stock')}; simmer for 22 minutes.`, 'Blend partly if desired, then check the seasoning and serve piping hot.'],
  }),
  pasta: c => ({
    ingredients: [ingredient(c.base ?? 'pasta'), ingredient(c.protein), ingredient(c.veg), ingredient(c.sauce), ingredient('garlic'), ingredient('olive_oil')],
    instructions: [`Cook the ${name(c.base ?? 'pasta')} in well-salted water until just tender; reserve a mug of cooking water.`, `Cook the garlic and ${name(c.veg)} in olive oil until softened.`, `Stir in the ${name(c.protein)} and ${name(c.sauce)}, loosening with cooking water.`, 'Toss with the drained pasta, season and serve immediately.'],
  }),
  onepot: c => ({
    ingredients: [ingredient(c.base), ingredient(c.protein), ingredient(c.veg1), ingredient(c.veg2), ingredient(c.liquid ?? 'stock'), ingredient(c.spice ?? 'herbs'), ingredient('olive_oil')],
    instructions: [`Prepare the ${name(c.veg1)} and ${name(c.veg2)} in even pieces.`, `Cook the vegetables and ${name(c.spice ?? 'herbs')} in olive oil for 6 minutes.`, `Add the ${name(c.base)}, ${name(c.protein)} and ${name(c.liquid ?? 'stock')}; cover and simmer until the base is tender.`, 'Rest for 5 minutes, fluff or stir, and check the seasoning.'],
  }),
  traybake: c => ({
    ingredients: [ingredient(c.protein), ingredient(c.starch), ingredient(c.veg1), ingredient(c.veg2), ingredient('olive_oil'), ingredient(c.flavour ?? 'herbs'), ingredient(c.acid ?? 'lemon')],
    instructions: ['Heat the oven to 220°C/200°C fan.', `Cut the ${name(c.starch)}, ${name(c.veg1)} and ${name(c.veg2)} into even pieces.`, `Toss everything except the ${name(c.acid ?? 'lemon')} with olive oil and ${name(c.flavour ?? 'herbs')}; roast until browned and cooked through.`, `Finish with ${name(c.acid ?? 'lemon')} and rest for 5 minutes before serving.`],
  }),
  curry: c => ({
    ingredients: [ingredient('rice'), ingredient(c.protein), ingredient(c.veg), ingredient(c.sauce ?? 'coconut_milk'), ingredient('onion'), ingredient(c.spice ?? 'curry_powder'), ingredient('olive_oil')],
    instructions: ['Cook the rice according to the packet instructions.', `Soften the onion in olive oil, then stir in the ${name(c.spice ?? 'curry_powder')}.`, `Add the ${name(c.protein)}, ${name(c.veg)} and ${name(c.sauce ?? 'coconut_milk')}; simmer until tender and thickened.`, 'Taste, season and serve over the rice.'],
  }),
  stirfry: c => ({
    ingredients: [ingredient(c.base ?? 'noodles'), ingredient(c.protein), ingredient(c.veg1), ingredient(c.veg2), ingredient('soy_sauce'), ingredient('ginger'), ingredient('olive_oil')],
    instructions: [`Prepare the ${name(c.base ?? 'noodles')} according to the packet and drain.`, `Stir-fry the ${name(c.protein)} in a hot wok until cooked or crisp.`, `Add the ${name(c.veg1)}, ${name(c.veg2)} and ginger; cook for 4–5 minutes.`, 'Toss through the noodles and soy sauce, then serve at once.'],
  }),
  bowl: c => ({
    ingredients: [ingredient(c.base), ingredient(c.protein), ingredient(c.veg1), ingredient(c.veg2), ingredient(c.sauce), ingredient(c.acid ?? 'lemon')],
    instructions: [`Cook the ${name(c.base)} until tender.`, `Cook or warm the ${name(c.protein)} and prepare the ${name(c.veg1)} and ${name(c.veg2)}.`, 'Divide the grain, protein and vegetables between four bowls.', `Loosen the ${name(c.sauce)} with ${name(c.acid ?? 'lemon')} and spoon over the bowls.`],
  }),
  tacos: c => ({
    ingredients: [ingredient('tortilla'), ingredient(c.protein), ingredient(c.veg1), ingredient(c.veg2), ingredient('salsa'), ingredient('lime')],
    instructions: [`Cook the ${name(c.protein)} with the ${name(c.veg1)} until piping hot.`, `Prepare the ${name(c.veg2)} and warm the tortillas in a dry pan.`, 'Fill each tortilla with the hot mixture and vegetables.', 'Top with salsa and lime just before serving.'],
  }),
  bake: c => ({
    ingredients: [ingredient(c.base), ingredient(c.protein), ingredient(c.veg), ingredient(c.sauce), ingredient(c.topping), ingredient('herbs')],
    instructions: ['Heat the oven to 200°C/180°C fan.', `Cook or prepare the ${name(c.base)}, then combine with the ${name(c.protein)}, ${name(c.veg)} and ${name(c.sauce)}.`, `Transfer to a baking dish and scatter over the ${name(c.topping)} and herbs.`, 'Bake until bubbling and deeply golden, then rest for 8 minutes.'],
  }),
  stew: c => ({
    ingredients: [ingredient(c.protein), ingredient(c.veg1), ingredient(c.veg2), ingredient('onion'), ingredient(c.liquid ?? 'tinned_tomato'), ingredient(c.spice ?? 'herbs'), ingredient('olive_oil')],
    instructions: [`Brown or soften the ${name(c.protein)} in olive oil, then set aside if needed.`, `Cook the onion, ${name(c.veg1)} and ${name(c.veg2)} for 8 minutes.`, `Return the protein, add the ${name(c.liquid ?? 'tinned_tomato')} and ${name(c.spice ?? 'herbs')}, then simmer gently until tender.`, 'Check the seasoning and rest for 5 minutes before serving.'],
  }),
  fishpan: c => ({
    ingredients: [ingredient(c.protein), ingredient(c.base), ingredient(c.veg1), ingredient(c.veg2), ingredient(c.flavour ?? 'mustard'), ingredient(c.acid ?? 'lemon'), ingredient('olive_oil')],
    instructions: [`Cook the ${name(c.base)} until tender and keep warm.`, `Season the ${name(c.protein)} and cook in olive oil until opaque and flaky.`, `Cook the ${name(c.veg1)} and ${name(c.veg2)} in the same pan until just tender.`, `Stir together the ${name(c.flavour ?? 'mustard')} and ${name(c.acid ?? 'lemon')}, then spoon over everything to serve.`],
  }),
};

const pack = (slug, title, subtitle, mealTypes, recipes) => ({ slug, title, subtitle, mealTypes, recipes });
const r = (title, template, components, cuisine = 'British-inspired', extra = {}) => ({ title, template, components, cuisine, ...extra });

const packs = [
  pack('quick-breakfasts-volume-1', 'Quick Breakfasts', 'Twelve calm starts for busy mornings', ['breakfast'], [
    r('Berry Almond Overnight Oats', 'oats', { fruit: 'berries', extra: 'almond_butter' }), r('Pear & Walnut Overnight Oats', 'oats', { fruit: 'pear', extra: 'walnuts' }), r('Banana Peanut Butter Overnight Oats', 'oats', { fruit: 'banana', extra: 'peanut_butter' }), r('Apple Seed Bircher Oats', 'oats', { fruit: 'apple', extra: 'seeds' }),
    r('Mushroom Spinach Breakfast Toast', 'toast', { primary: 'mushroom', second: 'spinach', accent: 'mustard' }), r('Hummus Tomato Morning Toast', 'toast', { primary: 'hummus', second: 'tomato', accent: 'seeds' }, 'Mediterranean-inspired'), r('Tomato Spinach Egg Skillet', 'egg', { veg1: 'tomato', veg2: 'spinach', accent: 'feta' }), r('Mushroom Pepper Egg Skillet', 'egg', { veg1: 'mushroom', veg2: 'pepper', accent: 'cheddar' }),
    r('Sweet Potato Black Bean Breakfast Hash', 'hash', { starch: 'sweet_potato', protein: 'black_bean', veg: 'pepper' }, 'Mexican-inspired'), r('Potato Chickpea Breakfast Hash', 'hash', { starch: 'potato', protein: 'chickpea', veg: 'spinach', spice: 'cumin' }), r('Berry Yogurt Crunch Pots', 'yogurt', { fruit: 'berries', extra: 'seeds' }), r('Lemon Blueberry Pancakes', 'pancake', { fruit: 'berries', extra: 'lemon' }),
  ]),
  pack('packed-lunches-volume-1', 'Packed Lunches', 'Portable lunches that hold up well', ['lunch', 'lunchbox'], [
    r('Chickpea Crunch Hummus Wraps', 'wrap', { protein: 'chickpea', veg1: 'cucumber', veg2: 'pepper', sauce: 'hummus' }, 'Mediterranean-inspired'), r('Tuna Sweetcorn Yogurt Wraps', 'wrap', { protein: 'tuna', veg1: 'corn', veg2: 'lettuce', sauce: 'greek_yogurt' }), r('Tofu Cabbage Peanut Wraps', 'wrap', { protein: 'tofu', veg1: 'cabbage', veg2: 'carrot', sauce: 'peanut_butter', acid: 'lime' }, 'East Asian-inspired'),
    r('Lentil Cucumber Couscous Salad', 'salad', { base: 'couscous', protein: 'lentil', veg1: 'cucumber', veg2: 'tomato', dressing: 'tahini' }, 'Mediterranean-inspired'), r('Chicken Pepper Brown Rice Salad', 'salad', { base: 'brown_rice', protein: 'chicken_breast', veg1: 'pepper', veg2: 'corn', dressing: 'greek_yogurt', acid: 'lime' }), r('Quinoa Chickpea Lemon Salad', 'salad', { base: 'quinoa', protein: 'chickpea', veg1: 'cucumber', veg2: 'tomato', dressing: 'tahini' }),
    r('Cheddar Apple Mustard Sandwiches', 'sandwich', { protein: 'cheddar', veg1: 'apple', veg2: 'lettuce', sauce: 'mustard' }), r('Mackerel Cucumber Yogurt Sandwiches', 'sandwich', { protein: 'mackerel', veg1: 'cucumber', veg2: 'lettuce', sauce: 'greek_yogurt' }), r('Hummus Pepper Spinach Sandwiches', 'sandwich', { protein: 'hummus', veg1: 'pepper', veg2: 'spinach', sauce: 'mustard' }),
    r('Tomato Butter Bean Lunch Soup', 'soup', { protein: 'butter_bean', veg1: 'tomato', veg2: 'spinach', spice: 'herbs' }), r('Carrot Red Lentil Lunch Soup', 'soup', { protein: 'red_lentil', veg1: 'carrot', veg2: 'celery', spice: 'cumin' }),
  ]),
  pack('family-favourites-volume-1', 'Family Favourites', 'Approachable dinners for a shared table', ['dinner'], [
    r('Chicken Tomato Pasta Bake', 'bake', { base: 'pasta', protein: 'chicken_breast', veg: 'spinach', sauce: 'passata', topping: 'cheddar' }, 'Italian-inspired'), r('Lentil Shepherd’s Potato Bake', 'bake', { base: 'potato', protein: 'lentil', veg: 'carrot', sauce: 'tinned_tomato', topping: 'breadcrumbs' }), r('Tuna Sweetcorn Pasta Bake', 'bake', { base: 'pasta', protein: 'tuna', veg: 'corn', sauce: 'passata', topping: 'cheddar' }),
    r('Mild Chickpea Coconut Curry', 'curry', { protein: 'chickpea', veg: 'cauliflower' }, 'Indian-inspired'), r('Mild Chicken & Pea Curry', 'curry', { protein: 'chicken_thigh', veg: 'peas' }, 'Indian-inspired'), r('Turkey Pepper Rice Pot', 'onepot', { base: 'rice', protein: 'turkey_mince', veg1: 'pepper', veg2: 'peas', liquid: 'chicken_stock', spice: 'paprika' }),
    r('Black Bean Sweetcorn Tacos', 'tacos', { protein: 'black_bean', veg1: 'corn', veg2: 'lettuce' }, 'Mexican-inspired'), r('Chicken Pepper Tacos', 'tacos', { protein: 'chicken_breast', veg1: 'pepper', veg2: 'lettuce' }, 'Mexican-inspired'), r('Cheesy Broccoli Wholewheat Pasta', 'pasta', { base: 'wholewheat_pasta', protein: 'butter_bean', veg: 'broccoli', sauce: 'cheddar' }),
    r('Sausage-Free Bean & Potato Traybake', 'traybake', { protein: 'butter_bean', starch: 'potato', veg1: 'pepper', veg2: 'courgette', flavour: 'paprika' }), r('Lemon Chicken & Broccoli Traybake', 'traybake', { protein: 'chicken_thigh', starch: 'potato', veg1: 'broccoli', veg2: 'carrot' }),
  ]),
  pack('one-pot-dinners-volume-1', 'One-Pot Dinners', 'Fewer pans, complete meals', ['dinner'], [
    r('Tomato Chickpea Rice Pot', 'onepot', { base: 'rice', protein: 'chickpea', veg1: 'pepper', veg2: 'spinach', liquid: 'tinned_tomato', spice: 'paprika' }), r('Chicken Leek Barley Pot', 'onepot', { base: 'barley', protein: 'chicken_thigh', veg1: 'leek', veg2: 'carrot', liquid: 'chicken_stock' }), r('Lentil Mushroom Barley Pot', 'onepot', { base: 'barley', protein: 'lentil', veg1: 'mushroom', veg2: 'spinach' }),
    r('Turkey Tomato Brown Rice Pot', 'onepot', { base: 'brown_rice', protein: 'turkey_mince', veg1: 'courgette', veg2: 'pepper', liquid: 'tinned_tomato', spice: 'herbs' }), r('Butter Bean Courgette Couscous Pot', 'onepot', { base: 'couscous', protein: 'butter_bean', veg1: 'courgette', veg2: 'tomato', spice: 'herbs' }), r('Tofu Pea Miso Rice Pot', 'onepot', { base: 'rice', protein: 'tofu', veg1: 'peas', veg2: 'spinach', liquid: 'stock', spice: 'miso' }, 'East Asian-inspired'),
    r('Beef Mushroom Barley Pot', 'onepot', { base: 'barley', protein: 'beef_mince', veg1: 'mushroom', veg2: 'carrot', liquid: 'chicken_stock', spice: 'mustard' }), r('Red Lentil Squash Rice Pot', 'onepot', { base: 'rice', protein: 'red_lentil', veg1: 'squash', veg2: 'spinach', liquid: 'stock', spice: 'cumin' }), r('Chicken Pepper Couscous Pot', 'onepot', { base: 'couscous', protein: 'chicken_breast', veg1: 'pepper', veg2: 'courgette', liquid: 'chicken_stock', spice: 'paprika' }),
    r('Kidney Bean Tomato Rice Pot', 'onepot', { base: 'rice', protein: 'kidney_bean', veg1: 'corn', veg2: 'pepper', liquid: 'tinned_tomato', spice: 'cumin' }, 'Mexican-inspired'), r('Salmon Pea Brown Rice Pot', 'onepot', { base: 'brown_rice', protein: 'salmon', veg1: 'peas', veg2: 'spinach', liquid: 'stock', spice: 'herbs' }),
  ]),
  pack('budget-batch-cooking-volume-1', 'Budget Batch Cooking', 'Big pots that make tomorrow easier', ['dinner'], [
    r('Smoky Three-Bean Tomato Stew', 'stew', { protein: 'kidney_bean', veg1: 'pepper', veg2: 'corn', spice: 'paprika' }), r('Red Lentil Carrot Dal', 'curry', { protein: 'red_lentil', veg: 'carrot' }, 'Indian-inspired'), r('Butter Bean & Squash Stew', 'stew', { protein: 'butter_bean', veg1: 'squash', veg2: 'spinach', spice: 'herbs' }),
    r('Turkey & Lentil Tomato Stew', 'stew', { protein: 'turkey_mince', veg1: 'lentil', veg2: 'carrot', spice: 'paprika' }), r('Chickpea Aubergine Curry', 'curry', { protein: 'chickpea', veg: 'aubergine' }, 'Indian-inspired'), r('Kidney Bean Sweet Potato Stew', 'stew', { protein: 'kidney_bean', veg1: 'sweet_potato', veg2: 'pepper', spice: 'cumin' }),
    r('Chicken Vegetable Barley Stew', 'stew', { protein: 'chicken_thigh', veg1: 'barley', veg2: 'carrot', liquid: 'chicken_stock', spice: 'herbs' }), r('Lentil Mushroom Pasta Sauce', 'pasta', { protein: 'lentil', veg: 'mushroom', sauce: 'passata' }, 'Italian-inspired'), r('Black Bean Tomato Rice Pot', 'onepot', { base: 'rice', protein: 'black_bean', veg1: 'pepper', veg2: 'corn', liquid: 'tinned_tomato', spice: 'paprika' }),
    r('Pea Spinach Coconut Curry', 'curry', { protein: 'chickpea', veg: 'peas' }, 'Indian-inspired'), r('Beef Lentil Bolognese Pot', 'stew', { protein: 'beef_mince', veg1: 'lentil', veg2: 'carrot', liquid: 'passata', spice: 'herbs' }, 'Italian-inspired'),
  ]),
  pack('freezer-friendly-volume-1', 'Freezer-Friendly Favourites', 'Cook once, bank a future dinner', ['dinner'], [
    r('Spinach Chickpea Tomato Curry', 'curry', { protein: 'chickpea', veg: 'spinach', sauce: 'tinned_tomato' }, 'Indian-inspired'), r('Turkey & Vegetable Pasta Bake', 'bake', { base: 'pasta', protein: 'turkey_mince', veg: 'courgette', sauce: 'passata', topping: 'cheddar' }), r('Red Lentil Sweet Potato Soup', 'soup', { protein: 'red_lentil', veg1: 'sweet_potato', veg2: 'carrot', spice: 'cumin' }),
    r('Chicken & Barley Casserole', 'stew', { protein: 'chicken_thigh', veg1: 'barley', veg2: 'leek', liquid: 'chicken_stock' }), r('Mushroom Butter Bean Cottage Bake', 'bake', { base: 'potato', protein: 'butter_bean', veg: 'mushroom', sauce: 'stock', topping: 'breadcrumbs' }), r('Beef & Kidney Bean Chilli', 'stew', { protein: 'beef_mince', veg1: 'kidney_bean', veg2: 'pepper', spice: 'cumin' }, 'Mexican-inspired'),
    r('Cauliflower Chickpea Coconut Curry', 'curry', { protein: 'chickpea', veg: 'cauliflower' }, 'Indian-inspired'), r('Tomato Lentil Vegetable Soup', 'soup', { protein: 'lentil', veg1: 'tomato', veg2: 'courgette', spice: 'herbs' }), r('Chicken Spinach Tomato Pasta Bake', 'bake', { base: 'pasta', protein: 'chicken_breast', veg: 'spinach', sauce: 'passata', topping: 'breadcrumbs' }),
    r('Black Bean Sweet Potato Chilli', 'stew', { protein: 'black_bean', veg1: 'sweet_potato', veg2: 'corn', spice: 'paprika' }, 'Mexican-inspired'), r('Salmon Pea Potato Fish Bake', 'bake', { base: 'potato', protein: 'salmon', veg: 'peas', sauce: 'milk', topping: 'breadcrumbs' }),
  ]),
  pack('twenty-minute-meals-volume-1', 'Twenty-Minute Meals', 'Fast meals with a proper finish', ['lunch', 'dinner'], [
    r('Prawn Pepper Rice Noodles', 'stirfry', { base: 'rice_noodles', protein: 'prawns', veg1: 'pepper', veg2: 'cabbage' }, 'East Asian-inspired'), r('Tofu Broccoli Noodles', 'stirfry', { protein: 'tofu', veg1: 'broccoli', veg2: 'pepper' }, 'East Asian-inspired'), r('Tuna Tomato Wholewheat Pasta', 'pasta', { base: 'wholewheat_pasta', protein: 'tuna', veg: 'tomato', sauce: 'passata' }, 'Italian-inspired'),
    r('Chickpea Spinach Pesto Pasta', 'pasta', { protein: 'chickpea', veg: 'spinach', sauce: 'pesto' }, 'Italian-inspired'), r('Chicken Pea Couscous Bowls', 'bowl', { base: 'couscous', protein: 'chicken_breast', veg1: 'peas', veg2: 'cucumber', sauce: 'greek_yogurt' }), r('Butter Bean Tomato Toasts', 'toast', { primary: 'butter_bean', second: 'tomato', accent: 'mustard' }),
    r('Mackerel Potato Spinach Plates', 'fishpan', { protein: 'mackerel', base: 'potato', veg1: 'spinach', veg2: 'peas' }), r('Black Bean Pepper Tacos', 'tacos', { protein: 'black_bean', veg1: 'pepper', veg2: 'lettuce' }, 'Mexican-inspired'), r('Egg Mushroom Rice Stir-Fry', 'stirfry', { base: 'rice_noodles', protein: 'eggs', veg1: 'mushroom', veg2: 'peas' }, 'East Asian-inspired'),
    r('Hummus Chickpea Crunch Bowls', 'bowl', { base: 'couscous', protein: 'chickpea', veg1: 'cucumber', veg2: 'pepper', sauce: 'hummus' }, 'Mediterranean-inspired'), r('Salmon Broccoli Couscous', 'fishpan', { protein: 'salmon', base: 'couscous', veg1: 'broccoli', veg2: 'peas' }),
  ]),
  pack('traybakes-volume-1', 'The Traybake Collection', 'Hands-off dinners with crisp edges', ['dinner'], [
    r('Paprika Chickpea Sweet Potato Traybake', 'traybake', { protein: 'chickpea', starch: 'sweet_potato', veg1: 'pepper', veg2: 'courgette', flavour: 'paprika' }), r('Mustard Chicken Leek Traybake', 'traybake', { protein: 'chicken_thigh', starch: 'potato', veg1: 'leek', veg2: 'carrot', flavour: 'mustard' }), r('Salmon Broccoli Potato Traybake', 'traybake', { protein: 'salmon', starch: 'potato', veg1: 'broccoli', veg2: 'green_bean', flavour: 'herbs' }),
    r('Tofu Miso Vegetable Traybake', 'traybake', { protein: 'tofu', starch: 'sweet_potato', veg1: 'broccoli', veg2: 'pepper', flavour: 'miso', acid: 'lime' }, 'East Asian-inspired'), r('Cod Tomato Courgette Traybake', 'traybake', { protein: 'cod', starch: 'potato', veg1: 'tomato', veg2: 'courgette' }), r('Butter Bean Squash Kale Traybake', 'traybake', { protein: 'butter_bean', starch: 'squash', veg1: 'kale', veg2: 'pepper', flavour: 'cumin' }),
    r('Chicken Aubergine Tomato Traybake', 'traybake', { protein: 'chicken_breast', starch: 'potato', veg1: 'aubergine', veg2: 'tomato', flavour: 'herbs' }, 'Mediterranean-inspired'), r('Tempeh Cabbage Sweet Potato Traybake', 'traybake', { protein: 'tempeh', starch: 'sweet_potato', veg1: 'cabbage', veg2: 'carrot', flavour: 'paprika' }), r('Pork Apple Carrot Traybake', 'traybake', { protein: 'pork', starch: 'potato', veg1: 'apple', veg2: 'carrot', flavour: 'mustard' }),
    r('Feta Chickpea Pepper Traybake', 'traybake', { protein: 'chickpea', starch: 'potato', veg1: 'pepper', veg2: 'tomato', flavour: 'herbs' }, 'Mediterranean-inspired'), r('Turkey Meatball-Style Vegetable Traybake', 'traybake', { protein: 'turkey_mince', starch: 'potato', veg1: 'courgette', veg2: 'pepper', flavour: 'paprika' }),
  ]),
  pack('soups-and-stews-volume-1', 'Soups & Stews', 'Bowls for colder days and useful leftovers', ['lunch', 'dinner'], [
    r('Leek Potato Butter Bean Soup', 'soup', { protein: 'butter_bean', veg1: 'leek', veg2: 'potato' }), r('Miso Tofu Mushroom Soup', 'soup', { protein: 'tofu', veg1: 'mushroom', veg2: 'spinach', spice: 'miso' }, 'East Asian-inspired'), r('Chicken Sweetcorn Rice Soup', 'soup', { protein: 'chicken_breast', veg1: 'corn', veg2: 'rice', liquid: 'chicken_stock' }),
    r('Tomato Chickpea Kale Soup', 'soup', { protein: 'chickpea', veg1: 'tomato', veg2: 'kale', spice: 'paprika' }), r('Smoky Black Bean Pepper Soup', 'soup', { protein: 'black_bean', veg1: 'pepper', veg2: 'corn', spice: 'paprika' }, 'Mexican-inspired'), r('Salmon Leek Potato Chowder', 'soup', { protein: 'salmon', veg1: 'leek', veg2: 'potato', liquid: 'milk', spice: 'mustard' }),
    r('Turkey Lentil Vegetable Stew', 'stew', { protein: 'turkey_mince', veg1: 'lentil', veg2: 'carrot', liquid: 'tinned_tomato' }), r('Aubergine Butter Bean Stew', 'stew', { protein: 'butter_bean', veg1: 'aubergine', veg2: 'tomato', spice: 'herbs' }, 'Mediterranean-inspired'), r('Chicken Squash Spinach Stew', 'stew', { protein: 'chicken_thigh', veg1: 'squash', veg2: 'spinach', liquid: 'chicken_stock' }),
    r('Pork Apple Barley Stew', 'stew', { protein: 'pork', veg1: 'apple', veg2: 'barley', liquid: 'chicken_stock', spice: 'mustard' }), r('Red Lentil Cauliflower Soup', 'soup', { protein: 'red_lentil', veg1: 'cauliflower', veg2: 'carrot', spice: 'curry_powder' }),
  ]),
  pack('pasta-and-noodles-volume-1', 'Pasta & Noodles', 'Comforting bowls with useful vegetables', ['dinner'], [
    r('Broccoli Butter Bean Pesto Pasta', 'pasta', { protein: 'butter_bean', veg: 'broccoli', sauce: 'pesto' }, 'Italian-inspired'), r('Chicken Courgette Tomato Pasta', 'pasta', { protein: 'chicken_breast', veg: 'courgette', sauce: 'passata' }, 'Italian-inspired'), r('Lentil Aubergine Wholewheat Pasta', 'pasta', { base: 'wholewheat_pasta', protein: 'lentil', veg: 'aubergine', sauce: 'passata' }, 'Italian-inspired'),
    r('Tuna Pea Lemon Pasta', 'pasta', { protein: 'tuna', veg: 'peas', sauce: 'greek_yogurt' }, 'Italian-inspired'), r('Mushroom Spinach Cottage Cheese Pasta', 'pasta', { protein: 'cottage_cheese', veg: 'mushroom', sauce: 'spinach' }, 'Italian-inspired'), r('Chickpea Pepper Tomato Pasta', 'pasta', { protein: 'chickpea', veg: 'pepper', sauce: 'passata' }, 'Italian-inspired'),
    r('Prawn Broccoli Rice Noodles', 'stirfry', { base: 'rice_noodles', protein: 'prawns', veg1: 'broccoli', veg2: 'pepper' }, 'East Asian-inspired'), r('Tempeh Cabbage Egg Noodles', 'stirfry', { protein: 'tempeh', veg1: 'cabbage', veg2: 'carrot' }, 'East Asian-inspired'), r('Chicken Mushroom Egg Noodles', 'stirfry', { protein: 'chicken_breast', veg1: 'mushroom', veg2: 'green_bean' }, 'East Asian-inspired'),
    r('Tofu Pea Rice Noodles', 'stirfry', { base: 'rice_noodles', protein: 'tofu', veg1: 'peas', veg2: 'spinach' }, 'East Asian-inspired'), r('Beef Pepper Egg Noodles', 'stirfry', { protein: 'beef_mince', veg1: 'pepper', veg2: 'cabbage' }, 'East Asian-inspired'),
  ]),
  pack('rice-and-grains-volume-1', 'Rice & Grain Bowls', 'Layered bowls designed around the pantry', ['lunch', 'dinner'], [
    r('Tahini Chickpea Quinoa Bowls', 'bowl', { base: 'quinoa', protein: 'chickpea', veg1: 'cucumber', veg2: 'tomato', sauce: 'tahini' }, 'Mediterranean-inspired'), r('Lemon Chicken Couscous Bowls', 'bowl', { base: 'couscous', protein: 'chicken_breast', veg1: 'pepper', veg2: 'spinach', sauce: 'greek_yogurt' }), r('Miso Tofu Brown Rice Bowls', 'bowl', { base: 'brown_rice', protein: 'tofu', veg1: 'broccoli', veg2: 'carrot', sauce: 'miso', acid: 'lime' }, 'East Asian-inspired'),
    r('Salmon Pea Brown Rice Bowls', 'bowl', { base: 'brown_rice', protein: 'salmon', veg1: 'peas', veg2: 'cucumber', sauce: 'greek_yogurt' }), r('Black Bean Sweetcorn Rice Bowls', 'bowl', { base: 'rice', protein: 'black_bean', veg1: 'corn', veg2: 'pepper', sauce: 'salsa', acid: 'lime' }, 'Mexican-inspired'), r('Butter Bean Roast Pepper Couscous Bowls', 'bowl', { base: 'couscous', protein: 'butter_bean', veg1: 'pepper', veg2: 'courgette', sauce: 'hummus' }, 'Mediterranean-inspired'),
    r('Turkey Kale Quinoa Bowls', 'bowl', { base: 'quinoa', protein: 'turkey_mince', veg1: 'kale', veg2: 'carrot', sauce: 'mustard' }), r('Prawn Cucumber Rice Bowls', 'bowl', { base: 'rice', protein: 'prawns', veg1: 'cucumber', veg2: 'cabbage', sauce: 'peanut_butter', acid: 'lime' }, 'East Asian-inspired'), r('Lentil Squash Barley Bowls', 'bowl', { base: 'barley', protein: 'lentil', veg1: 'squash', veg2: 'spinach', sauce: 'tahini' }),
    r('Chicken Broccoli Brown Rice Bowls', 'bowl', { base: 'brown_rice', protein: 'chicken_thigh', veg1: 'broccoli', veg2: 'pepper', sauce: 'greek_yogurt' }), r('Tempeh Pea Quinoa Bowls', 'bowl', { base: 'quinoa', protein: 'tempeh', veg1: 'peas', veg2: 'cucumber', sauce: 'peanut_butter', acid: 'lime' }),
  ]),
  pack('plant-powered-volume-1', 'Plant-Powered Dinners', 'Filling vegan meals with everyday ingredients', ['dinner'], [
    r('Chickpea Spinach Coconut Curry', 'curry', { protein: 'chickpea', veg: 'spinach' }, 'Indian-inspired'), r('Tofu Aubergine Miso Bowl', 'bowl', { base: 'rice', protein: 'tofu', veg1: 'aubergine', veg2: 'spinach', sauce: 'miso', acid: 'lime' }, 'East Asian-inspired'), r('Butter Bean Tomato Pasta', 'pasta', { protein: 'butter_bean', veg: 'tomato', sauce: 'passata' }, 'Italian-inspired'),
    r('Red Lentil Cauliflower Dal', 'curry', { protein: 'red_lentil', veg: 'cauliflower' }, 'Indian-inspired'), r('Black Bean Sweet Potato Tacos', 'tacos', { protein: 'black_bean', veg1: 'sweet_potato', veg2: 'cabbage' }, 'Mexican-inspired'), r('Tempeh Broccoli Noodle Stir-Fry', 'stirfry', { base: 'rice_noodles', protein: 'tempeh', veg1: 'broccoli', veg2: 'pepper' }, 'East Asian-inspired'),
    r('Lentil Mushroom Barley Stew', 'stew', { protein: 'lentil', veg1: 'mushroom', veg2: 'carrot', liquid: 'stock' }), r('Chickpea Squash Traybake', 'traybake', { protein: 'chickpea', starch: 'squash', veg1: 'pepper', veg2: 'kale', flavour: 'cumin' }), r('Tofu Cabbage Rice Pot', 'onepot', { base: 'rice', protein: 'tofu', veg1: 'cabbage', veg2: 'peas', spice: 'miso' }, 'East Asian-inspired'),
    r('Kidney Bean Pepper Chilli', 'stew', { protein: 'kidney_bean', veg1: 'pepper', veg2: 'corn', spice: 'paprika' }, 'Mexican-inspired'), r('Butter Bean Broccoli Tahini Bowls', 'bowl', { base: 'quinoa', protein: 'butter_bean', veg1: 'broccoli', veg2: 'carrot', sauce: 'tahini' }),
  ]),
  pack('vegetarian-comforts-volume-1', 'Vegetarian Comforts', 'Cosy meat-free meals for repeat cooking', ['dinner'], [
    r('Mushroom Lentil Cottage Bake', 'bake', { base: 'potato', protein: 'lentil', veg: 'mushroom', sauce: 'stock', topping: 'cheddar' }), r('Broccoli Cheddar Pasta Bake', 'bake', { base: 'pasta', protein: 'butter_bean', veg: 'broccoli', sauce: 'milk', topping: 'cheddar' }), r('Spinach Feta Chickpea Rice', 'onepot', { base: 'rice', protein: 'chickpea', veg1: 'spinach', veg2: 'feta', liquid: 'stock', spice: 'herbs' }),
    r('Mushroom Pea Pesto Pasta', 'pasta', { protein: 'peas', veg: 'mushroom', sauce: 'pesto' }, 'Italian-inspired'), r('Cheddar Black Bean Tacos', 'tacos', { protein: 'black_bean', veg1: 'pepper', veg2: 'cheddar' }, 'Mexican-inspired'), r('Cottage Cheese Courgette Pasta', 'pasta', { protein: 'cottage_cheese', veg: 'courgette', sauce: 'passata' }, 'Italian-inspired'),
    r('Egg & Vegetable Noodle Stir-Fry', 'stirfry', { protein: 'eggs', veg1: 'broccoli', veg2: 'pepper' }, 'East Asian-inspired'), r('Feta Butter Bean Tomato Traybake', 'traybake', { protein: 'butter_bean', starch: 'potato', veg1: 'tomato', veg2: 'courgette', flavour: 'herbs' }, 'Mediterranean-inspired'), r('Mushroom Spinach Barley Pot', 'onepot', { base: 'barley', protein: 'lentil', veg1: 'mushroom', veg2: 'spinach', liquid: 'stock' }),
    r('Cauliflower Chickpea Cheddar Bake', 'bake', { base: 'potato', protein: 'chickpea', veg: 'cauliflower', sauce: 'milk', topping: 'cheddar' }), r('Sweet Potato Feta Quinoa Bowls', 'bowl', { base: 'quinoa', protein: 'feta', veg1: 'sweet_potato', veg2: 'spinach', sauce: 'greek_yogurt' }),
  ]),
  pack('chicken-weeknights-volume-1', 'Chicken Weeknights', 'Reliable chicken dinners without repetition', ['dinner'], [
    r('Lemon Chicken Vegetable Traybake', 'traybake', { protein: 'chicken_thigh', starch: 'potato', veg1: 'pepper', veg2: 'courgette' }), r('Chicken Broccoli Noodle Stir-Fry', 'stirfry', { protein: 'chicken_breast', veg1: 'broccoli', veg2: 'pepper' }, 'East Asian-inspired'), r('Chicken Spinach Coconut Curry', 'curry', { protein: 'chicken_thigh', veg: 'spinach' }, 'Indian-inspired'),
    r('Chicken Mushroom Wholewheat Pasta', 'pasta', { base: 'wholewheat_pasta', protein: 'chicken_breast', veg: 'mushroom', sauce: 'greek_yogurt' }, 'Italian-inspired'), r('Paprika Chicken Rice Pot', 'onepot', { base: 'rice', protein: 'chicken_thigh', veg1: 'pepper', veg2: 'peas', liquid: 'chicken_stock', spice: 'paprika' }), r('Chicken Black Bean Tacos', 'tacos', { protein: 'chicken_breast', veg1: 'black_bean', veg2: 'lettuce' }, 'Mexican-inspired'),
    r('Mustard Chicken Potato Traybake', 'traybake', { protein: 'chicken_thigh', starch: 'potato', veg1: 'green_bean', veg2: 'carrot', flavour: 'mustard' }), r('Chicken Tahini Quinoa Bowls', 'bowl', { base: 'quinoa', protein: 'chicken_breast', veg1: 'cucumber', veg2: 'tomato', sauce: 'tahini' }), r('Chicken Tomato Barley Stew', 'stew', { protein: 'chicken_thigh', veg1: 'barley', veg2: 'carrot', liquid: 'tinned_tomato' }),
    r('Chicken Pesto Pea Pasta', 'pasta', { protein: 'chicken_breast', veg: 'peas', sauce: 'pesto' }, 'Italian-inspired'), r('Chicken Sweet Potato Curry', 'curry', { protein: 'chicken_thigh', veg: 'sweet_potato' }, 'Indian-inspired'),
  ]),
  pack('fish-and-seafood-volume-1', 'Fish & Seafood', 'Straightforward fish dinners for the weekly plan', ['dinner'], [
    r('Mustard Salmon Potato Plates', 'fishpan', { protein: 'salmon', base: 'potato', veg1: 'green_bean', veg2: 'peas' }), r('Lemon Cod Couscous Plates', 'fishpan', { protein: 'cod', base: 'couscous', veg1: 'courgette', veg2: 'tomato' }, 'Mediterranean-inspired'), r('Prawn Broccoli Rice Stir-Fry', 'stirfry', { base: 'rice_noodles', protein: 'prawns', veg1: 'broccoli', veg2: 'pepper' }, 'East Asian-inspired'),
    r('Tuna Tomato Pasta', 'pasta', { protein: 'tuna', veg: 'spinach', sauce: 'passata' }, 'Italian-inspired'), r('Mackerel Cucumber Potato Bowls', 'bowl', { base: 'potato', protein: 'mackerel', veg1: 'cucumber', veg2: 'spinach', sauce: 'greek_yogurt' }), r('Salmon Spinach Coconut Curry', 'curry', { protein: 'salmon', veg: 'spinach' }, 'Indian-inspired'),
    r('Cod Chickpea Tomato Stew', 'stew', { protein: 'cod', veg1: 'chickpea', veg2: 'tomato', liquid: 'tinned_tomato', spice: 'paprika' }, 'Mediterranean-inspired'), r('Prawn Pea Couscous Bowls', 'bowl', { base: 'couscous', protein: 'prawns', veg1: 'peas', veg2: 'cucumber', sauce: 'greek_yogurt' }), r('Tuna Sweetcorn Rice Pot', 'onepot', { base: 'rice', protein: 'tuna', veg1: 'corn', veg2: 'peas', liquid: 'stock' }),
    r('Salmon Broccoli Traybake', 'traybake', { protein: 'salmon', starch: 'sweet_potato', veg1: 'broccoli', veg2: 'pepper' }), r('Mackerel Tomato Wholewheat Pasta', 'pasta', { base: 'wholewheat_pasta', protein: 'mackerel', veg: 'tomato', sauce: 'passata' }, 'Italian-inspired'),
  ]),
  pack('flexitarian-classics-volume-1', 'Flexitarian Classics', 'Vegetable-led versions of familiar meals', ['dinner'], [
    r('Beef & Lentil Tomato Pasta', 'pasta', { protein: 'beef_mince', veg: 'lentil', sauce: 'passata' }, 'Italian-inspired'), r('Turkey & Black Bean Tacos', 'tacos', { protein: 'turkey_mince', veg1: 'black_bean', veg2: 'lettuce' }, 'Mexican-inspired'), r('Chicken & Chickpea Coconut Curry', 'curry', { protein: 'chicken_breast', veg: 'chickpea' }, 'Indian-inspired'),
    r('Pork & Butter Bean Tomato Stew', 'stew', { protein: 'pork', veg1: 'butter_bean', veg2: 'carrot', liquid: 'tinned_tomato' }), r('Beef Mushroom Barley Bowls', 'bowl', { base: 'barley', protein: 'beef_mince', veg1: 'mushroom', veg2: 'spinach', sauce: 'mustard' }), r('Turkey Lentil Rice Pot', 'onepot', { base: 'brown_rice', protein: 'turkey_mince', veg1: 'lentil', veg2: 'pepper', liquid: 'chicken_stock' }),
    r('Chicken Butter Bean Traybake', 'traybake', { protein: 'chicken_thigh', starch: 'potato', veg1: 'butter_bean', veg2: 'courgette' }), r('Beef Kidney Bean Chilli Bowls', 'bowl', { base: 'rice', protein: 'beef_mince', veg1: 'kidney_bean', veg2: 'corn', sauce: 'salsa', acid: 'lime' }, 'Mexican-inspired'), r('Pork Apple Barley Pot', 'onepot', { base: 'barley', protein: 'pork', veg1: 'apple', veg2: 'leek', liquid: 'chicken_stock', spice: 'mustard' }),
    r('Turkey Chickpea Couscous Bowls', 'bowl', { base: 'couscous', protein: 'turkey_mince', veg1: 'chickpea', veg2: 'cucumber', sauce: 'greek_yogurt' }), r('Chicken Lentil Vegetable Soup', 'soup', { protein: 'chicken_breast', veg1: 'lentil', veg2: 'carrot', liquid: 'chicken_stock' }),
  ]),
  pack('weekend-cooking-volume-1', 'Weekend Cooking', 'Longer cooks that reward the extra time', ['dinner'], [
    r('Slow-Style Beef Mushroom Stew', 'stew', { protein: 'beef_mince', veg1: 'mushroom', veg2: 'carrot', liquid: 'chicken_stock', spice: 'mustard' }), r('Chicken Squash Barley Casserole', 'stew', { protein: 'chicken_thigh', veg1: 'squash', veg2: 'barley', liquid: 'chicken_stock' }), r('Aubergine Lentil Pasta Bake', 'bake', { base: 'pasta', protein: 'lentil', veg: 'aubergine', sauce: 'passata', topping: 'breadcrumbs' }, 'Italian-inspired'),
    r('Salmon Spinach Potato Bake', 'bake', { base: 'potato', protein: 'salmon', veg: 'spinach', sauce: 'milk', topping: 'breadcrumbs' }), r('Mushroom Butter Bean Barley Stew', 'stew', { protein: 'butter_bean', veg1: 'mushroom', veg2: 'barley', liquid: 'stock' }), r('Turkey Sweet Potato Chilli Bake', 'bake', { base: 'sweet_potato', protein: 'turkey_mince', veg: 'kidney_bean', sauce: 'tinned_tomato', topping: 'cheddar' }, 'Mexican-inspired'),
    r('Cauliflower Chickpea Rice Bake', 'bake', { base: 'rice', protein: 'chickpea', veg: 'cauliflower', sauce: 'coconut_milk', topping: 'breadcrumbs' }, 'Indian-inspired'), r('Pork Leek Potato Bake', 'bake', { base: 'potato', protein: 'pork', veg: 'leek', sauce: 'milk', topping: 'cheddar' }), r('Cod Tomato Butter Bean Stew', 'stew', { protein: 'cod', veg1: 'butter_bean', veg2: 'tomato', liquid: 'tinned_tomato' }, 'Mediterranean-inspired'),
    r('Chicken Aubergine Tomato Stew', 'stew', { protein: 'chicken_thigh', veg1: 'aubergine', veg2: 'pepper', liquid: 'tinned_tomato' }, 'Mediterranean-inspired'), r('Red Lentil Squash Coconut Stew', 'stew', { protein: 'red_lentil', veg1: 'squash', veg2: 'spinach', liquid: 'coconut_milk', spice: 'curry_powder' }, 'Indian-inspired'),
  ]),
];

function deriveTags(keys) {
  const hasMeat = keys.some(key => meatKeys.has(key));
  const hasFish = keys.some(key => fishKeys.has(key));
  const hasDairyEgg = keys.some(key => dairyEggKeys.has(key));
  const tags = [];
  if (!hasMeat && !hasFish && !hasDairyEgg) tags.push('vegan');
  else if (!hasMeat && !hasFish) tags.push('vegetarian');
  else if (!hasMeat && hasFish) tags.push('pescatarian');
  if (!keys.some(key => glutenKeys.has(key)) && !keys.includes('soy_sauce')) tags.push('gluten-free');
  return tags;
}

function createRecipe(packConfig, spec, index) {
  const built = builders[spec.template](spec.components);
  const ingredients = uniqueIngredients(built.ingredients);
  const keys = built.ingredients.map(item => item.key);
  const allergens = [...new Set(keys.flatMap(key => allergenByKey[key] ?? []))].sort();
  const dietary = deriveTags(keys);
  const [prep, cook] = minutes[spec.template];
  const [calories, protein, carbs, fat] = baseNutrition[spec.template];
  const animalCost = keys.some(key => fishKeys.has(key)) ? 10 : keys.some(key => meatKeys.has(key)) ? 8 : dietary.includes('vegetarian') ? 6 : 5;
  const recipeSlug = `${packConfig.slug.replace(/-volume-1$/, '')}-${slugify(spec.title)}`;
  const dedupeHash = createHash('sha256').update(JSON.stringify({ title: spec.title.toLowerCase(), ingredients: ingredients.map(item => item.normalized_name).sort() })).digest('hex');
  const freezerFriendly = ['soup', 'stew', 'curry', 'bake', 'onepot'].includes(spec.template);
  const descriptionEndings = [
    'designed to make good use of everyday ingredients.',
    'with a straightforward method that earns a place in the weekly rotation.',
    'balanced for an unfussy, satisfying home-cooked meal.',
    'made for practical planning without losing the pleasure of cooking.',
  ];
  const mealLabel = packConfig.mealTypes.includes('breakfast')
    ? 'breakfast'
    : packConfig.mealTypes.includes('lunch')
      ? 'lunch'
      : 'dinner';
  return {
    slug: recipeSlug,
    title: spec.title,
    description: `A practical ${mealLabel} ${descriptionEndings[index % descriptionEndings.length]}`,
    servings: 4,
    prep_minutes: prep,
    cook_minutes: cook,
    difficulty: ['stew', 'bake'].includes(spec.template) ? 'medium' : 'easy',
    cuisine_tags: [spec.cuisine],
    dietary_tags: dietary,
    allergen_tags: allergens,
    meal_types: spec.mealTypes ?? packConfig.mealTypes,
    instructions: built.instructions,
    nutrition: {
      calories,
      calories_low: Math.round(calories * 0.9),
      calories_high: Math.round(calories * 1.1),
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      basis: 'per serving',
    },
    nutrition_provenance: 'estimated',
    estimated_cost_low_gbp: Math.max(2.5, animalCost - 2),
    estimated_cost_high_gbp: animalCost + 2,
    price_estimate_as_of: '2026-08-28',
    source_type: 'ai_assisted',
    source_url: null,
    rights_basis: 'original_owned',
    rights_notes: 'Original Kitchen Companion beta candidate. Founder editorial review and recipe testing are required before publication.',
    source_label: 'Kitchen Companion editorial candidate',
    media_attribution: {},
    content_version: 1,
    equipment_tags: equipment[spec.template],
    season_tags: spec.seasonTags ?? ['all-year'],
    storage_guidance: {
      fridge_days: spec.template === 'sandwich' ? 1 : 3,
      freezer_months: freezerFriendly ? 3 : 0,
      reheat: ['salad', 'wrap', 'sandwich', 'yogurt', 'oats'].includes(spec.template) ? 'Serve cold or at room temperature.' : 'Reheat until piping hot throughout; only reheat once.',
      freezer_friendly: freezerFriendly,
    },
    swap_guidance: [],
    catalogue_batch: BATCH,
    dedupe_hash: dedupeHash,
    ingredients,
    position: index,
  };
}

const creator = {
  slug: 'kitchen-companion-test-kitchen',
  display_name: 'Kitchen Companion Test Kitchen',
  bio: 'Original and editorially developed recipes for practical home cooking.',
  website_url: null,
  social_links: {},
};

const payloads = packs.map(packConfig => ({
  creator,
  book: {
    slug: packConfig.slug,
    title: packConfig.title,
    subtitle: packConfig.subtitle,
    description: `${packConfig.title}: ${packConfig.subtitle}. Candidate recipes remain private until founder review.`,
    content_version: 1,
    access_model: 'included',
  },
  recipes: packConfig.recipes.map((spec, index) => createRecipe(packConfig, spec, index)),
}));

const recipes = payloads.flatMap(payload => payload.recipes);
if (recipes.length !== 188) throw new Error(`Expected 188 generated candidates; got ${recipes.length}`);
if (new Set(recipes.map(recipe => recipe.slug)).size !== recipes.length) throw new Error('Generated recipe slugs must be unique');
if (new Set(recipes.map(recipe => recipe.dedupe_hash)).size !== recipes.length) throw new Error('Generated recipes contain duplicate title/ingredient hashes');

const sqlEscape = value => JSON.stringify(value).replace(/'/g, "''");
const sql = `-- Generated by scripts/build-beta-catalogue.mjs. Do not edit by hand.\n` + payloads.map(payload => (
  `select private.import_catalogue_candidate_pack('${sqlEscape(payload)}'::jsonb);`
)).join('\n');

await rm(OUTPUT_DIR, { recursive: true, force: true });
await mkdir(OUTPUT_DIR, { recursive: true });
await mkdir(path.dirname(SQL_OUTPUT), { recursive: true });
for (const payload of payloads) {
  await writeFile(path.join(OUTPUT_DIR, `${payload.book.slug}.json`), `${JSON.stringify(payload, null, 2)}\n`);
}
await writeFile(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify({
  batch: BATCH,
  generated_at: '2026-08-28',
  candidate_count: recipes.length,
  existing_approved_count: 12,
  database_target: 200,
  packs: payloads.map(payload => ({ slug: payload.book.slug, title: payload.book.title, recipe_count: payload.recipes.length })),
}, null, 2)}\n`);
await writeFile(SQL_OUTPUT, `${sql}\n`);

console.log(`Built ${recipes.length} private recipe candidates across ${payloads.length} packs.`);
