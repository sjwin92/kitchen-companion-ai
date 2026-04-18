import type { FoodItem } from '@/types';

export interface ReasonInputs {
  recipeId?: string;
  title: string;
  ingredients?: string[];
  prepTimeMinutes?: number;
  signals?: {
    likedRecipeIds: string[];
    topRatedRecipeIds: string[];
    stapleRecipeIds: string[];
    libraryRecipeIds: string[];
    libraryPromotedTitles: string[];
    frequentlyLoggedTitles: string[];
  } | null;
  inventory?: FoodItem[];
  preferredCuisines?: string[];
  cuisine?: string;
}

export interface Reason {
  text: string;
  /** semantic category — used for chip color */
  kind: 'expiry' | 'rating' | 'staple' | 'pantry' | 'cuisine' | 'quick' | 'frequent' | 'promoted';
}

/** Returns the single most compelling reason this meal is being suggested. */
export function explainSuggestion(input: ReasonInputs): Reason | null {
  const {
    recipeId, title, ingredients = [], prepTimeMinutes,
    signals, inventory = [], preferredCuisines = [], cuisine,
  } = input;

  const titleLower = title.toLowerCase();
  const ingLower = ingredients.map(i => i.toLowerCase());

  // 1. Expiring inventory match (highest priority — waste prevention)
  const expiring = inventory.filter(i => i.status === 'use-today' || i.status === 'use-soon');
  for (const item of expiring) {
    const n = item.name.toLowerCase();
    if (ingLower.some(ing => ing.includes(n) || n.includes(ing))) {
      const days = item.status === 'use-today' ? 'today' : `in ${item.daysUntilExpiry}d`;
      return { text: `Uses ${item.name} expiring ${days}`, kind: 'expiry' };
    }
  }

  // 2. Top-rated by user
  if (recipeId && signals?.topRatedRecipeIds.includes(recipeId)) {
    return { text: 'Matches your 4★+ ratings', kind: 'rating' };
  }

  // 3. Staple
  if (recipeId && signals?.stapleRecipeIds.includes(recipeId)) {
    return { text: 'One of your staples', kind: 'staple' };
  }

  // 4. Promoted from library
  if (signals?.libraryPromotedTitles.includes(titleLower)) {
    return { text: 'A proven hit in your library', kind: 'promoted' };
  }

  // 5. Frequently logged
  if (signals?.frequentlyLoggedTitles.some(t => titleLower.includes(t) || t.includes(titleLower))) {
    return { text: 'You cook this often', kind: 'frequent' };
  }

  // 6. Liked
  if (recipeId && signals?.likedRecipeIds.includes(recipeId)) {
    return { text: 'You liked this before', kind: 'rating' };
  }

  // 7. Preferred cuisine
  if (cuisine && preferredCuisines.some(c => c.toLowerCase() === cuisine.toLowerCase())) {
    return { text: `${cuisine} — your favourite`, kind: 'cuisine' };
  }

  // 8. Quick recipe
  if (prepTimeMinutes !== undefined && prepTimeMinutes <= 20) {
    return { text: `Quick — under ${prepTimeMinutes} min`, kind: 'quick' };
  }

  // 9. Pantry match (count overlap)
  if (inventory.length > 0 && ingLower.length > 0) {
    const inv = inventory.map(i => i.name.toLowerCase());
    const matches = ingLower.filter(ing => inv.some(n => ing.includes(n) || n.includes(ing)));
    if (matches.length >= 3) {
      return { text: `${matches.length} pantry items ready`, kind: 'pantry' };
    }
  }

  return null;
}

export function reasonChipClass(kind: Reason['kind']): string {
  switch (kind) {
    case 'expiry':   return 'bg-warning/15 text-warning';
    case 'rating':   return 'bg-primary/15 text-primary';
    case 'staple':   return 'bg-primary/10 text-primary';
    case 'pantry':   return 'bg-success/15 text-success';
    case 'cuisine':  return 'bg-accent/30 text-foreground';
    case 'quick':    return 'bg-secondary/40 text-foreground';
    case 'frequent': return 'bg-primary/10 text-primary';
    case 'promoted': return 'bg-primary/15 text-primary';
  }
}
