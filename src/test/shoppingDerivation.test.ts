import { describe, expect, it } from 'vitest';
import { aggregateIngredients, subtractInventory } from '@/lib/shoppingDerivation';

describe('shopping derivation', () => {
  it('aggregates compatible structured quantities and keeps meal provenance', () => {
    expect(aggregateIngredients([
      { name: 'Red onion', normalizedName: 'red onion', quantity: 1, unit: 'each', mealTitle: 'Curry' },
      { name: 'Red onions', normalizedName: 'red onion', quantity: 2, unit: 'each', mealTitle: 'Tacos' },
      { name: 'Coriander', quantity: 1, unit: 'bunch', optional: true, mealTitle: 'Tacos' },
    ])).toEqual([{
      name: 'Red onion',
      normalizedName: 'red onion',
      quantity: '3 each',
      fromMeals: ['Curry', 'Tacos'],
    }]);
  });

  it('subtracts inventory without treating egg as eggplant', () => {
    const ingredients = aggregateIngredients([
      { name: 'Eggs', normalizedName: 'egg', quantity: 2, unit: 'each', mealTitle: 'Breakfast' },
      { name: 'Eggplant', normalizedName: 'eggplant', quantity: 1, unit: 'each', mealTitle: 'Dinner' },
    ]);
    expect(subtractInventory(ingredients, ['Eggs'])).toEqual([
      expect.objectContaining({ normalizedName: 'eggplant' }),
    ]);
  });
});
