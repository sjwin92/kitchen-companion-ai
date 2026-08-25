import { describe, expect, it } from 'vitest';
import {
  getSuggestedDislikes,
  removeRedundantDislikes,
  toggleDietaryPreference,
} from '@/lib/onboardingPreferences';

describe('onboarding preferences', () => {
  it('does not suggest animal products that a vegan diet already excludes', () => {
    const suggestions = getSuggestedDislikes(['Vegan']);

    expect(suggestions).not.toContain('Liver');
    expect(suggestions).not.toContain('Anchovies');
    expect(suggestions).not.toContain('Blue Cheese');
    expect(suggestions).toContain('Mushrooms');
  });

  it('makes None mutually exclusive with dietary restrictions', () => {
    expect(toggleDietaryPreference(['Vegan'], 'None')).toEqual(['None']);
    expect(toggleDietaryPreference(['None'], 'Vegan')).toEqual(['Vegan']);
  });

  it('removes a previously selected redundant dislike when diet changes', () => {
    expect(removeRedundantDislikes(['Liver', 'Cilantro', 'My custom item'], ['Vegan']))
      .toEqual(['Cilantro', 'My custom item']);
  });
});
