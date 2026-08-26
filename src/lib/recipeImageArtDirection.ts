export const RECIPE_IMAGE_STYLE_VERSION = 'kitchen-companion-editorial-v1';

export const RECIPE_IMAGE_SCENES = [
  'a matte dark forest-green stone table with restrained negative space',
  'a beautifully dressed contemporary table with natural linen, handmade ceramics and subtle glassware',
  'a warm pale-stone table with one folded linen napkin and soft tonal shadows',
  'a refined dark timber dining table with understated modern place settings',
] as const;

export const RECIPE_IMAGE_ANGLES = [
  'editorial overhead view',
  'gentle three-quarter tabletop view',
  'close overhead crop with the plate slightly off-centre',
] as const;

export interface RecipeImagePromptInput {
  title: string;
  description?: string;
  sceneIndex?: number;
  angleIndex?: number;
}

/**
 * Shared art direction for optional AI-generated recipe photography.
 * Keep the output labelled as generated and retain provider/model provenance.
 */
export function buildRecipeImagePrompt({
  title,
  description,
  sceneIndex = 0,
  angleIndex = 0,
}: RecipeImagePromptInput) {
  const scene = RECIPE_IMAGE_SCENES[Math.abs(sceneIndex) % RECIPE_IMAGE_SCENES.length];
  const angle = RECIPE_IMAGE_ANGLES[Math.abs(angleIndex) % RECIPE_IMAGE_ANGLES.length];

  return [
    'Premium recipe-card food photograph for Kitchen Companion.',
    `Dish: ${title}.`,
    description ? `Dish details: ${description}.` : '',
    `Setting: ${scene}.`,
    `Composition: ${angle}; vertical 4:5 crop; dish is the clear subject; leave calm negative space where natural.`,
    'Lighting: soft natural window light, gentle falloff, warm-neutral white balance and subtle photographic grain.',
    'Aesthetic: refined contemporary cookbook editorial, appetising real food texture, sophisticated, believable and quietly luxurious.',
    'Vary the ceramics, linen, surface, garnish restraint and framing while keeping the same editorial family.',
    'No text, logos, packaging, watermarks or branded tableware. No hands unless specifically requested.',
    'Avoid plastic-looking food, oversaturation, floating ingredients, excessive garnish, perfect symmetry, glossy stock-photo styling and rustic clichés.',
  ].filter(Boolean).join(' ');
}
