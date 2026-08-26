import { describe, expect, it } from 'vitest';
import {
  buildRecipeImagePrompt,
  RECIPE_IMAGE_SCENES,
  RECIPE_IMAGE_STYLE_VERSION,
} from '@/lib/recipeImageArtDirection';

describe('recipe image art direction', () => {
  it('keeps generated meal imagery in the approved premium editorial family', () => {
    const prompt = buildRecipeImagePrompt({ title: 'Roasted tomato orzo' });

    expect(RECIPE_IMAGE_STYLE_VERSION).toBe('kitchen-companion-editorial-v1');
    expect(prompt).toContain('Roasted tomato orzo');
    expect(prompt).toContain('contemporary cookbook editorial');
    expect(prompt).toContain('vertical 4:5 crop');
    expect(prompt).toContain('Avoid plastic-looking food');
  });

  it('supports controlled table-setting variety without changing the style', () => {
    const prompts = RECIPE_IMAGE_SCENES.map((_, sceneIndex) =>
      buildRecipeImagePrompt({ title: 'Herby beans', sceneIndex }),
    );

    expect(new Set(prompts).size).toBe(RECIPE_IMAGE_SCENES.length);
    expect(prompts.some(prompt => prompt.includes('beautifully dressed contemporary table'))).toBe(true);
  });
});
