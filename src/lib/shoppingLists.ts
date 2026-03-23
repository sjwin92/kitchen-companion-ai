export type SavedShoppingList = {
  id: string;
  recipeId: string;
  recipeTitle: string;
  items: string[];
  createdAt: string;
};

const STORAGE_KEY = 'kitchen-companion-shopping-lists';

export function getSavedShoppingLists(): SavedShoppingList[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read saved shopping lists', error);
    return [];
  }
}

function writeSavedShoppingLists(lists: SavedShoppingList[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
}

export function saveShoppingList(input: {
  recipeId: string;
  recipeTitle: string;
  items: string[];
}): SavedShoppingList {
  const existing = getSavedShoppingLists();

  const next: SavedShoppingList = {
    id: `${input.recipeId}-${Date.now()}`,
    recipeId: input.recipeId,
    recipeTitle: input.recipeTitle,
    items: input.items,
    createdAt: new Date().toISOString(),
  };

  writeSavedShoppingLists([next, ...existing]);
  return next;
}

export function deleteSavedShoppingList(id: string) {
  const existing = getSavedShoppingLists();
  const updated = existing.filter(list => list.id !== id);
  writeSavedShoppingLists(updated);
}

export function clearSavedShoppingLists() {
  writeSavedShoppingLists([]);
}
