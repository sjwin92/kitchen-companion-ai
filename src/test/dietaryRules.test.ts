import { describe, expect, it } from 'vitest';
import {
  canonicalizeDietaryPreferences,
  dietExcludesFood,
  findDietaryConflicts,
  foodTextMatchesTerm,
} from '../../supabase/functions/_shared/dietary-rules';
import { passesUserDietaryFilters } from '@/lib/dietaryFilter';

const basePreferences = {
  dislikedIngredients: [] as string[],
  allergies: [] as string[],
};

describe('shared dietary rules', () => {
  it.each([
    ['Vegan', 'liver pate'],
    ['Vegetarian', 'anchovy fillets'],
    ['Pescatarian', 'beef mince'],
    ['Gluten-Free', 'wheat pasta'],
    ['Dairy-Free', 'blue cheese'],
    ['Keto', 'white rice'],
    ['Halal', 'pork sausage'],
    ['Kosher', 'prawn curry'],
  ])('treats %s and %s as a hard conflict', (preference, food) => {
    expect(dietExcludesFood(food, [preference])).toBe(true);
  });

  it.each([
    ['Vegan', 'eggplant'],
    ['Pescatarian', 'salmon'],
    ['Halal', 'beef liver'],
    ['Kosher', 'anchovies'],
    ['High-Protein', 'wholegrain rice'],
    ['None', 'pork sausage'],
  ])('does not invent a conflict between %s and %s', (preference, food) => {
    expect(dietExcludesFood(food, [preference])).toBe(false);
  });

  it('recognises explicitly labelled substitutes', () => {
    expect(findDietaryConflicts(['vegan cheddar cheese'], ['Vegan'])).toHaveLength(0);
    expect(findDietaryConflicts(['gluten-free flour'], ['Gluten-Free'])).toHaveLength(0);
    expect(findDietaryConflicts(['plant-based milk'], ['Dairy-Free'])).toHaveLength(0);
  });

  it('uses word boundaries so egg does not reject eggplant', () => {
    expect(foodTextMatchesTerm('roasted eggplant', 'egg')).toBe(false);
    expect(foodTextMatchesTerm('two eggs', 'egg')).toBe(true);
  });

  it.each([
    'butter beans',
    'peanut butter',
    'unsweetened plant milk',
    'light coconut milk',
  ])('recognises %s as a vegan ingredient rather than dairy', (ingredient) => {
    expect(dietExcludesFood(ingredient, ['Vegan'])).toBe(false);
  });

  it('maps legacy settings values into the canonical choices', () => {
    expect(canonicalizeDietaryPreferences(['Plant-Based', 'High Protein']))
      .toEqual(['Vegan', 'High-Protein']);
    expect(canonicalizeDietaryPreferences(['Omnivore'])).toEqual(['None']);
  });

  it('applies the same rules to recipe results', () => {
    expect(passesUserDietaryFilters('Liver and onions', ['beef liver'], {
      ...basePreferences,
      dietaryPreferences: ['Vegan'],
    })).toBe(false);
    expect(passesUserDietaryFilters('Roasted eggplant', ['eggplant', 'olive oil'], {
      ...basePreferences,
      dietaryPreferences: ['Vegan'],
    })).toBe(true);
  });
});
