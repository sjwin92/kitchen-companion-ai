import type { NutritionEstimate } from '@/types';

function exactRange(value: number) {
  return { low: value, high: value };
}

export function buildManualEstimate(
  title: string,
  nutrition: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
): NutritionEstimate {
  return {
    title: title.trim(),
    ...nutrition,
    ranges: {
      calories: exactRange(nutrition.calories),
      protein_g: exactRange(nutrition.protein_g),
      carbs_g: exactRange(nutrition.carbs_g),
      fat_g: exactRange(nutrition.fat_g),
    },
    confidence: 1,
    ingredients: [],
    matched_inventory_ids: [],
    notes: ['Nutrition entered manually and confirmed by the user.'],
    model: 'manual_entry_v1',
    provenance: 'user_estimate',
    image_path: null,
  };
}
