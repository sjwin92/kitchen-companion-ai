import type { MealSlot } from '@/hooks/useMealPlans';

export interface CatalogItem {
  name: string;
  emoji: string;
  calories: number;
  serving: string;
  tags: MealSlot[];
}

export interface CatalogGroup {
  label: string;
  emoji: string;
  items: CatalogItem[];
}

export const MEAL_CATALOG: CatalogGroup[] = [
  {
    label: 'Toast & Bread',
    emoji: '🍞',
    items: [
      { name: 'Avocado on Toast', emoji: '🥑', calories: 280, serving: '2 slices', tags: ['breakfast', 'snack'] },
      { name: 'Beans on Toast', emoji: '🫘', calories: 310, serving: '2 slices + beans', tags: ['breakfast', 'lunch', 'snack'] },
      { name: 'Marmite on Toast', emoji: '🟤', calories: 170, serving: '2 slices', tags: ['breakfast', 'snack'] },
      { name: 'Peanut Butter Toast', emoji: '🥜', calories: 260, serving: '2 slices', tags: ['breakfast', 'snack'] },
      { name: 'Jam on Toast', emoji: '🍓', calories: 210, serving: '2 slices', tags: ['breakfast', 'snack'] },
      { name: 'Cheese on Toast', emoji: '🧀', calories: 290, serving: '2 slices', tags: ['breakfast', 'snack'] },
      { name: 'Egg on Toast', emoji: '🍳', calories: 250, serving: '2 slices + 1 egg', tags: ['breakfast'] },
    ],
  },
  {
    label: 'Cereal & Bowls',
    emoji: '🥣',
    items: [
      { name: 'Granola & Yogurt', emoji: '🥣', calories: 340, serving: '200g yogurt + 50g granola', tags: ['breakfast', 'snack'] },
      { name: 'Porridge with Honey', emoji: '🍯', calories: 270, serving: '1 bowl (250g)', tags: ['breakfast'] },
      { name: 'Overnight Oats', emoji: '🫙', calories: 310, serving: '1 jar', tags: ['breakfast'] },
      { name: 'Berries & Honey Bowl', emoji: '🫐', calories: 180, serving: '150g berries + drizzle', tags: ['breakfast', 'snack'] },
      { name: 'Muesli with Milk', emoji: '🥛', calories: 290, serving: '1 bowl', tags: ['breakfast'] },
      { name: 'Acai Bowl', emoji: '🍇', calories: 380, serving: '1 bowl', tags: ['breakfast', 'snack'] },
    ],
  },
  {
    label: 'Cooked Breakfasts',
    emoji: '🍳',
    items: [
      { name: 'Full English Breakfast', emoji: '🇬🇧', calories: 750, serving: '1 plate', tags: ['breakfast'] },
      { name: 'Scrambled Eggs', emoji: '🥚', calories: 220, serving: '2 eggs', tags: ['breakfast'] },
      { name: 'Boiled Eggs', emoji: '🥚', calories: 140, serving: '2 eggs', tags: ['breakfast', 'snack'] },
      { name: 'Pancakes', emoji: '🥞', calories: 350, serving: '3 pancakes', tags: ['breakfast'] },
      { name: 'French Toast', emoji: '🍞', calories: 320, serving: '2 slices', tags: ['breakfast'] },
      { name: 'Omelette', emoji: '🍳', calories: 280, serving: '2 egg omelette', tags: ['breakfast', 'lunch'] },
      { name: 'Eggs Benedict', emoji: '🥚', calories: 420, serving: '1 serving', tags: ['breakfast'] },
    ],
  },
  {
    label: 'Smoothies & Drinks',
    emoji: '🥤',
    items: [
      { name: 'Banana Smoothie', emoji: '🍌', calories: 220, serving: '1 glass (300ml)', tags: ['breakfast', 'snack'] },
      { name: 'Berry Smoothie', emoji: '🍓', calories: 190, serving: '1 glass (300ml)', tags: ['breakfast', 'snack'] },
      { name: 'Green Smoothie', emoji: '🥬', calories: 170, serving: '1 glass (300ml)', tags: ['breakfast', 'snack'] },
      { name: 'Protein Shake', emoji: '💪', calories: 250, serving: '1 scoop + milk', tags: ['breakfast', 'snack'] },
    ],
  },
  {
    label: 'Fruit & Fresh',
    emoji: '🍎',
    items: [
      { name: 'Apple', emoji: '🍎', calories: 95, serving: '1 medium', tags: ['snack', 'breakfast'] },
      { name: 'Banana', emoji: '🍌', calories: 105, serving: '1 medium', tags: ['snack', 'breakfast'] },
      { name: 'Orange', emoji: '🍊', calories: 62, serving: '1 medium', tags: ['snack'] },
      { name: 'Strawberries', emoji: '🍓', calories: 50, serving: '100g', tags: ['snack', 'breakfast'] },
      { name: 'Grapes', emoji: '🍇', calories: 70, serving: '100g', tags: ['snack'] },
      { name: 'Mixed Fruit Bowl', emoji: '🥗', calories: 120, serving: '1 bowl', tags: ['snack', 'breakfast'] },
      { name: 'Melon Slices', emoji: '🍈', calories: 60, serving: '1 cup', tags: ['snack', 'breakfast'] },
    ],
  },
  {
    label: 'Bars & Packaged',
    emoji: '📦',
    items: [
      { name: 'Granola Bar', emoji: '🍫', calories: 190, serving: '1 bar', tags: ['snack'] },
      { name: 'Protein Bar', emoji: '💪', calories: 220, serving: '1 bar', tags: ['snack'] },
      { name: 'Rice Cakes', emoji: '🍘', calories: 70, serving: '2 cakes', tags: ['snack'] },
      { name: 'Crisps', emoji: '🥔', calories: 160, serving: '1 bag (25g)', tags: ['snack'] },
      { name: 'Crackers & Cheese', emoji: '🧀', calories: 200, serving: '4 crackers + cheese', tags: ['snack'] },
      { name: 'Trail Mix', emoji: '🥜', calories: 175, serving: '30g', tags: ['snack'] },
      { name: 'Dark Chocolate', emoji: '🍫', calories: 170, serving: '30g', tags: ['snack'] },
    ],
  },
  {
    label: 'Dairy & Light',
    emoji: '🥛',
    items: [
      { name: 'Greek Yogurt', emoji: '🥛', calories: 130, serving: '150g', tags: ['snack', 'breakfast'] },
      { name: 'Cottage Cheese', emoji: '🧀', calories: 110, serving: '100g', tags: ['snack'] },
      { name: 'Hummus & Veg Sticks', emoji: '🥕', calories: 150, serving: '50g hummus + veg', tags: ['snack'] },
      { name: 'Cheese & Crackers', emoji: '🧀', calories: 200, serving: '30g cheese + 3 crackers', tags: ['snack'] },
    ],
  },
  {
    label: 'Mini Meals',
    emoji: '🥪',
    items: [
      { name: 'Wrap', emoji: '🌯', calories: 350, serving: '1 wrap', tags: ['snack', 'lunch'] },
      { name: 'Soup Cup', emoji: '🍵', calories: 150, serving: '1 mug', tags: ['snack', 'lunch'] },
      { name: 'Toast Soldiers & Egg', emoji: '🥚', calories: 200, serving: '1 egg + 2 soldiers', tags: ['snack', 'breakfast'] },
      { name: 'Crumpets with Butter', emoji: '🧈', calories: 210, serving: '2 crumpets', tags: ['snack', 'breakfast'] },
      { name: 'Bagel with Cream Cheese', emoji: '🥯', calories: 320, serving: '1 bagel', tags: ['breakfast', 'snack'] },
    ],
  },
];

/** Get catalog items filtered by meal slot, optionally filtered by search query */
export function getCatalogForSlot(slot: MealSlot, query?: string): CatalogGroup[] {
  return MEAL_CATALOG
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        const matchesSlot = item.tags.includes(slot);
        if (!matchesSlot) return false;
        if (!query?.trim()) return true;
        return item.name.toLowerCase().includes(query.toLowerCase());
      }),
    }))
    .filter(group => group.items.length > 0);
}
