export interface InventoryMealPick {
  id: string;
  name: string;
  quantity: string;
}

type AddPlannedMeal = (
  recipeId: string,
  title: string,
  image?: string,
  options?: { planKind: 'inventory'; inventoryItemId: string },
) => Promise<unknown>;

export async function planInventoryMeal(
  addPlannedMeal: AddPlannedMeal,
  item: InventoryMealPick,
  now: () => number = Date.now,
): Promise<void> {
  await addPlannedMeal(item.id, item.name, undefined, {
    planKind: 'inventory',
    inventoryItemId: item.id,
  });
}
