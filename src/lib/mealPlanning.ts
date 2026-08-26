export interface InventoryMealPick {
  id: string;
  name: string;
  quantity: string;
}

type AddPlannedMeal = (recipeId: string, title: string, image?: string) => Promise<void>;

export async function planInventoryMeal(
  addPlannedMeal: AddPlannedMeal,
  item: InventoryMealPick,
  now: () => number = Date.now,
): Promise<void> {
  await addPlannedMeal(`custom-${now()}`, item.name, undefined);
}
