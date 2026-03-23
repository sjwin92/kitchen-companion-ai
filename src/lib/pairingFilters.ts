import type { MealSuggestion } from '@/types';

const PROTEIN_KEYWORDS = [
  'chicken',
  'beef',
  'pork',
  'lamb',
  'turkey',
  'duck',
  'goat',
  'veal',
  'ham',
  'bacon',
  'salmon',
  'tuna',
  'cod',
  'haddock',
  'mackerel',
  'sardine',
  'anchovy',
  'trout',
  'fish',
  'prawn',
  'shrimp',
  'crab',
  'lobster',
  'mussel',
  'clam',
  'oyster',
  'squid',
  'octopus',
  'tofu',
  'tempeh',
] as const;

const SEAFOOD_KEYWORDS = [
  'fish',
  'salmon',
  'tuna',
  'cod',
  'haddock',
  'mackerel',
  'sardine',
  'anchovy',
  'trout',
  'prawn',
  'shrimp',
  'crab',
  'lobster',
  'mussel',
  'clam',
  'oyster',
  'squid',
  'octopus',
] as const;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasWholeWord = (text: string, word: string) =>
  new RegExp(`\\b${escapeRegex(word)}\\b`, 'i').test(text);

function recipeContainsBlockedProtein(recipe: MealSuggestion, blockedProteins: Set<string>): boolean {
  const searchable = `${recipe.title} ${recipe.category ?? ''} ${recipe.ingredients.join(' ')}`.toLowerCase();

  for (const protein of blockedProteins) {
    if (hasWholeWord(searchable, protein)) return true;
  }

  return false;
}

export function getBlockedProteins(category?: string, ingredients: string[] = []): string[] {
  const source = `${category ?? ''} ${ingredients.join(' ')}`.toLowerCase();
  const blocked = new Set<string>();

  for (const protein of PROTEIN_KEYWORDS) {
    if (hasWholeWord(source, protein)) blocked.add(protein);
  }

  if (hasWholeWord(source, 'seafood')) {
    for (const seafood of SEAFOOD_KEYWORDS) blocked.add(seafood);
  }

  return [...blocked];
}

export function chooseComplementaryRecipe(
  candidates: MealSuggestion[],
  blockedProteinNames: string[]
): MealSuggestion | undefined {
  const uniqueCandidates = Array.from(
    new Map(candidates.map((candidate) => [candidate.id, candidate])).values()
  );

  if (uniqueCandidates.length === 0) return undefined;
  if (blockedProteinNames.length === 0) return uniqueCandidates[0];

  const blockedSet = new Set(blockedProteinNames);
  return uniqueCandidates.find((candidate) => !recipeContainsBlockedProtein(candidate, blockedSet));
}