import { describe, expect, it } from 'vitest';
import { buildManualEstimate } from '@/pages/MealLog';

describe('manual meal nutrition', () => {
  it('creates a user-confirmed estimate without AI or a photo', () => {
    const estimate = buildManualEstimate(' Spinach chickpea curry ', {
      calories: 540,
      protein_g: 21,
      carbs_g: 72,
      fat_g: 18,
    });

    expect(estimate).toMatchObject({
      title: 'Spinach chickpea curry',
      calories: 540,
      protein_g: 21,
      provenance: 'user_estimate',
      model: 'manual_entry_v1',
      confidence: 1,
      image_path: null,
    });
    expect(estimate.ranges.calories).toEqual({ low: 540, high: 540 });
  });
});
