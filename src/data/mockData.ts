import { FoodItem, MealSuggestion } from '@/types';

export const MOCK_FOOD_ITEMS: FoodItem[] = [
  { id: '1', name: 'Chicken Breast', quantity: '500g', location: 'fridge', dateAdded: '2026-03-09', daysUntilExpiry: 1, status: 'use-today' },
  { id: '2', name: 'Spinach', quantity: '1 bag', location: 'fridge', dateAdded: '2026-03-08', daysUntilExpiry: 2, status: 'use-soon' },
  { id: '3', name: 'Milk', quantity: '1L', location: 'fridge', dateAdded: '2026-03-07', daysUntilExpiry: 3, status: 'use-soon' },
  { id: '4', name: 'Eggs', quantity: '6', location: 'fridge', dateAdded: '2026-03-06', daysUntilExpiry: 7, status: 'okay' },
  { id: '5', name: 'Cheddar Cheese', quantity: '200g', location: 'fridge', dateAdded: '2026-03-05', daysUntilExpiry: 5, status: 'okay' },
  { id: '6', name: 'Greek Yogurt', quantity: '500g', location: 'fridge', dateAdded: '2026-03-09', daysUntilExpiry: 2, status: 'use-soon' },
  { id: '7', name: 'Frozen Peas', quantity: '1 bag', location: 'freezer', dateAdded: '2026-02-15', daysUntilExpiry: 60, status: 'okay' },
  { id: '8', name: 'Frozen Salmon', quantity: '2 fillets', location: 'freezer', dateAdded: '2026-02-20', daysUntilExpiry: 45, status: 'okay' },
  { id: '9', name: 'Ice Cream', quantity: '1 tub', location: 'freezer', dateAdded: '2026-03-01', daysUntilExpiry: 30, status: 'okay' },
  { id: '10', name: 'Pasta', quantity: '500g', location: 'cupboard', dateAdded: '2026-02-01', daysUntilExpiry: 180, status: 'okay' },
  { id: '11', name: 'Rice', quantity: '1kg', location: 'cupboard', dateAdded: '2026-01-15', daysUntilExpiry: 365, status: 'okay' },
  { id: '12', name: 'Olive Oil', quantity: '500ml', location: 'cupboard', dateAdded: '2026-01-20', daysUntilExpiry: 180, status: 'okay' },
  { id: '13', name: 'Canned Tomatoes', quantity: '2 cans', location: 'cupboard', dateAdded: '2026-02-10', daysUntilExpiry: 365, status: 'okay' },
  { id: '14', name: 'Garlic', quantity: '1 bulb', location: 'cupboard', dateAdded: '2026-03-05', daysUntilExpiry: 14, status: 'okay' },
  { id: '15', name: 'Onions', quantity: '3', location: 'cupboard', dateAdded: '2026-03-04', daysUntilExpiry: 10, status: 'okay' },
];

export const MOCK_MEALS: MealSuggestion[] = [
  {
    id: '1',
    title: 'Creamy Chicken & Spinach Pasta',
    description: 'A quick, comforting pasta dish using chicken and fresh spinach in a creamy sauce.',
    prepTime: '25 min',
    ingredients: ['Chicken Breast', 'Spinach', 'Pasta', 'Garlic', 'Olive Oil', 'Cream', 'Parmesan'],
  },
  {
    id: '2',
    title: 'Spinach & Cheese Omelette',
    description: 'A simple, protein-packed breakfast or light dinner option.',
    prepTime: '10 min',
    ingredients: ['Eggs', 'Spinach', 'Cheddar Cheese', 'Olive Oil', 'Salt', 'Pepper'],
  },
  {
    id: '3',
    title: 'Chicken Stir-Fry with Rice',
    description: 'A fast and healthy stir-fry with whatever veggies you have on hand.',
    prepTime: '20 min',
    ingredients: ['Chicken Breast', 'Rice', 'Frozen Peas', 'Garlic', 'Onions', 'Soy Sauce', 'Sesame Oil'],
  },
  {
    id: '4',
    title: 'Salmon with Peas & Rice',
    description: 'Baked salmon served over fluffy rice with buttery peas.',
    prepTime: '30 min',
    ingredients: ['Frozen Salmon', 'Rice', 'Frozen Peas', 'Olive Oil', 'Lemon', 'Butter'],
  },
  {
    id: '5',
    title: 'Classic Tomato Pasta',
    description: 'A pantry-friendly staple — simple garlic tomato sauce over pasta.',
    prepTime: '15 min',
    ingredients: ['Pasta', 'Canned Tomatoes', 'Garlic', 'Onions', 'Olive Oil', 'Basil', 'Parmesan'],
  },
];

export const MOCK_RECEIPT_ITEMS: Omit<FoodItem, 'id'>[] = [
  { name: 'Avocados', quantity: '3', location: 'fridge', dateAdded: new Date().toISOString().split('T')[0], daysUntilExpiry: 4, status: 'use-soon' },
  { name: 'Sourdough Bread', quantity: '1 loaf', location: 'cupboard', dateAdded: new Date().toISOString().split('T')[0], daysUntilExpiry: 5, status: 'use-soon' },
  { name: 'Cherry Tomatoes', quantity: '1 punnet', location: 'fridge', dateAdded: new Date().toISOString().split('T')[0], daysUntilExpiry: 5, status: 'use-soon' },
  { name: 'Butter', quantity: '250g', location: 'fridge', dateAdded: new Date().toISOString().split('T')[0], daysUntilExpiry: 21, status: 'okay' },
  { name: 'Ground Beef', quantity: '500g', location: 'fridge', dateAdded: new Date().toISOString().split('T')[0], daysUntilExpiry: 2, status: 'use-soon' },
];
