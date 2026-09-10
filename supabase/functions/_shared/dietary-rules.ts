export const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Gluten-Free',
  'Dairy-Free',
  'Keto',
  'High-Protein',
  'Halal',
  'Kosher',
  'None',
] as const;

export type DietaryOption = (typeof DIETARY_OPTIONS)[number];
export type DietaryRuleKey =
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'gluten-free'
  | 'dairy-free'
  | 'keto'
  | 'high-protein'
  | 'halal'
  | 'kosher'
  | 'none';

const MEAT = [
  'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'goose', 'venison',
  'bacon', 'ham', 'sausage', 'steak', 'mince', 'minced meat', 'meatball',
  'pepperoni', 'salami', 'chorizo', 'lard', 'suet', 'liver', 'gelatin', 'gelatine',
];

const FISH_AND_SEAFOOD = [
  'fish', 'salmon', 'tuna', 'cod', 'haddock', 'anchovy', 'seafood', 'shellfish',
  'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'squid', 'mussel', 'oyster',
];

const DAIRY_AND_EGGS = [
  'egg', 'cheese', 'cream', 'butter', 'milk', 'yogurt', 'yoghurt', 'honey',
  'whey', 'casein', 'lactose', 'mozzarella', 'parmesan', 'cheddar', 'brie',
  'feta', 'ricotta', 'mascarpone', 'creme fraiche', 'sour cream', 'ghee',
];

export const DIETARY_EXCLUSIONS: Record<DietaryRuleKey, readonly string[]> = {
  vegan: [...MEAT, ...FISH_AND_SEAFOOD, ...DAIRY_AND_EGGS],
  vegetarian: [...MEAT, ...FISH_AND_SEAFOOD],
  pescatarian: MEAT,
  'gluten-free': [
    'gluten', 'wheat', 'barley', 'rye', 'flour', 'bread', 'pasta', 'couscous',
    'noodle', 'spaghetti', 'penne', 'fettuccine', 'macaroni', 'linguine', 'orzo',
    'tortilla', 'pita', 'pitta', 'crouton', 'breadcrumb', 'soy sauce', 'bulgur',
    'semolina', 'spelt', 'kamut',
  ],
  'dairy-free': DAIRY_AND_EGGS.filter((item) => item !== 'egg' && item !== 'honey'),
  keto: [
    'bread', 'pasta', 'rice', 'potato', 'flour', 'sugar', 'honey', 'maple syrup',
    'tortilla', 'noodle', 'couscous', 'oat', 'cereal', 'corn', 'bean', 'lentil',
    'chickpea', 'pea', 'carrot', 'banana', 'apple', 'orange',
  ],
  'high-protein': [],
  halal: ['pork', 'bacon', 'ham', 'lard', 'gelatin', 'gelatine', 'alcohol', 'wine', 'beer', 'rum', 'bourbon', 'whiskey', 'whisky'],
  kosher: ['pork', 'bacon', 'ham', 'lard', 'shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'squid', 'mussel', 'oyster'],
  none: [],
};

const CANONICAL_LABELS: Record<DietaryRuleKey, DietaryOption> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
  'gluten-free': 'Gluten-Free',
  'dairy-free': 'Dairy-Free',
  keto: 'Keto',
  'high-protein': 'High-Protein',
  halal: 'Halal',
  kosher: 'Kosher',
  none: 'None',
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function dietaryRuleKey(value: string): DietaryRuleKey | null {
  const normalized = normalize(value);
  const aliases: Record<string, DietaryRuleKey> = {
    vegetarian: 'vegetarian',
    vegan: 'vegan',
    'plant based': 'vegan',
    pescatarian: 'pescatarian',
    'gluten free': 'gluten-free',
    'dairy free': 'dairy-free',
    keto: 'keto',
    ketogenic: 'keto',
    'high protein': 'high-protein',
    halal: 'halal',
    kosher: 'kosher',
    none: 'none',
    omnivore: 'none',
  };
  return aliases[normalized] ?? null;
}

export function canonicalizeDietaryPreferences(preferences: string[]): string[] {
  const canonical = preferences
    .map(dietaryRuleKey)
    .filter((key): key is DietaryRuleKey => key !== null)
    .map((key) => CANONICAL_LABELS[key]);
  const unique = [...new Set(canonical)];
  return unique.includes('None') && unique.length > 1 ? unique.filter((item) => item !== 'None') : unique;
}

function termPattern(term: string): RegExp {
  const normalized = normalize(term);
  const words = normalized.split(' ');
  const last = words.pop() ?? '';
  let lastPattern: string;
  if (last.endsWith('y') && last.length > 1) {
    lastPattern = `${last.slice(0, -1)}(?:y|ies)`;
  } else if (/(?:s|x|z|ch|sh)$/.test(last)) {
    lastPattern = `${last}(?:es)?`;
  } else {
    lastPattern = `${last}s?`;
  }
  const phrase = [...words, lastPattern].join(' ');
  return new RegExp(`(?:^| )${phrase}(?:$| )`);
}

export function foodTextMatchesTerm(foodText: string, term: string): boolean {
  return termPattern(term).test(normalize(foodText));
}

function isExplicitSubstitute(foodText: string, rule: DietaryRuleKey): boolean {
  const normalized = normalize(foodText);
  if (rule === 'vegan' || rule === 'vegetarian' || rule === 'pescatarian') {
    const labelledSubstitute = ['vegan', 'plant based', 'meat free']
      .some((marker) => foodTextMatchesTerm(normalized, marker));
    if (labelledSubstitute) return true;
    if (rule === 'vegan') {
      return [
        'plant milk', 'oat milk', 'soy milk', 'soya milk', 'almond milk',
        'coconut milk', 'rice milk', 'cashew milk', 'peanut butter',
        'almond butter', 'cashew butter', 'sunflower butter', 'cocoa butter',
        'butter bean',
      ].some((marker) => foodTextMatchesTerm(normalized, marker));
    }
    return false;
  }
  if (rule === 'gluten-free') return foodTextMatchesTerm(normalized, 'gluten free');
  if (rule === 'dairy-free') {
    return [
      'dairy free', 'vegan', 'plant based', 'plant milk', 'oat milk',
      'soy milk', 'soya milk', 'almond milk', 'coconut milk', 'rice milk',
      'cashew milk', 'peanut butter', 'almond butter', 'cashew butter',
      'sunflower butter', 'cocoa butter', 'butter bean',
    ].some((marker) => foodTextMatchesTerm(normalized, marker));
  }
  return false;
}

export interface DietaryConflict {
  preference: DietaryRuleKey;
  food: string;
  excludedTerm: string;
}

export function findDietaryConflicts(foods: string[], preferences: string[]): DietaryConflict[] {
  const rules = [...new Set(preferences.map(dietaryRuleKey).filter((key): key is DietaryRuleKey => key !== null))];
  const conflicts: DietaryConflict[] = [];

  for (const food of foods) {
    for (const rule of rules) {
      if (isExplicitSubstitute(food, rule)) continue;
      const excludedTerm = DIETARY_EXCLUSIONS[rule].find((term) => foodTextMatchesTerm(food, term));
      if (excludedTerm) conflicts.push({ preference: rule, food, excludedTerm });
    }
  }

  return conflicts;
}

export function dietExcludesFood(food: string, preferences: string[]): boolean {
  return findDietaryConflicts([food], preferences).length > 0;
}
