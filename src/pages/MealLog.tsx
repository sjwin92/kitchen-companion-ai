import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { getRecipeById } from '@/services/recipes/recipeProvider';
import { ingredientMatches } from '@/lib/mealMatching';
import { buildManualEstimate } from '@/lib/manualMealEstimate';
import { useInteractions } from '@/hooks/useInteractions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useMealPlans, MEAL_SLOTS } from '@/hooks/useMealPlans';
import {
  Camera,
  Upload,
  ArrowLeft,
  Loader2,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Check,
  X,
  UtensilsCrossed,
  CalendarDays,
  ChefHat,
  Star,
} from 'lucide-react';
import type { NutritionEstimate } from '@/types';

interface CombinedRecipe {
  id: string;
  title: string;
  image?: string;
  ingredients: string[];
  measures?: string[];
}

interface PlannedMealState {
  planId: string;
  recipeId: string;
  title: string;
}

function rangeAround(value: number, uncertainty: number) {
  return {
    low: Math.max(0, Math.round(value * (1 - uncertainty))),
    high: Math.round(value * (1 + uncertainty)),
  };
}

export default function MealLog() {
  const navigate = useNavigate();
  const location = useLocation();
  const plannedMeal = (location.state as { plannedMeal?: PlannedMealState } | null)?.plannedMeal;
  const { inventory, session, preferences, refreshInventory } = useApp();
  const { plans: todayPlans } = useMealPlans();
  const { track } = useInteractions();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [mealTitle, setMealTitle] = useState(plannedMeal?.title ?? '');
  const [mealNotes, setMealNotes] = useState('');
  const [mealRating, setMealRating] = useState<number>(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<NutritionEstimate | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualNutrition, setManualNutrition] = useState({
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
  });
  const [saving, setSaving] = useState(false);
  const [deductItems, setDeductItems] = useState<string[]>([]);
  const [linkedPlanId, setLinkedPlanId] = useState<string | null>(plannedMeal?.planId ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Combined recipes from Cook Together
  const combinedRecipes: CombinedRecipe[] | undefined = (location.state as any)?.combinedRecipes;
  const passedServings: number | undefined = (location.state as any)?.servings;
  const isCombinedMeal = combinedRecipes && combinedRecipes.length > 1;

  // Pre-fill meal title for combined meals
  const combinedTitle = isCombinedMeal
    ? combinedRecipes!.map(r => r.title).join(' + ')
    : '';

  useEffect(() => {
    if (!plannedMeal) return;
    let cancelled = false;
    const loadPlannedRecipe = async () => {
      try {
        const recipe = await getRecipeById(plannedMeal.recipeId);
        if (!recipe || cancelled) return;
        const nutrition = recipe.nutrition;
        const calories = Number(nutrition?.calories);
        const protein = Number(nutrition?.protein_g);
        const carbs = Number(nutrition?.carbs_g);
        const fat = Number(nutrition?.fat_g);
        if (![calories, protein, carbs, fat].every(Number.isFinite)) return;
        const uncertainty = recipe.provenance === 'catalogue' ? 0.1 : 0.2;
        const matchedIds = inventory
          .filter((item) => recipe.ingredients.some((ingredient) => ingredientMatches(item.name, ingredient)))
          .map((item) => item.id);
        setAnalysis({
          title: plannedMeal.title,
          calories: Math.round(calories),
          protein_g: protein,
          carbs_g: carbs,
          fat_g: fat,
          ranges: {
            calories: rangeAround(calories, uncertainty),
            protein_g: rangeAround(protein, uncertainty),
            carbs_g: rangeAround(carbs, uncertainty),
            fat_g: rangeAround(fat, uncertainty),
          },
          confidence: recipe.provenance === 'catalogue' ? 0.85 : 0.65,
          ingredients: recipe.ingredients.map((name, index) => ({
            name,
            amount: recipe.measures?.[index] || 'Included in recipe',
            confidence: 1,
          })),
          matched_inventory_ids: matchedIds,
          notes: ['Based on the saved recipe and serving estimate. Review quantities before confirming.'],
          model: recipe.provenance === 'catalogue' ? 'catalogue_nutrition_v1' : 'private_recipe_nutrition_v1',
          provenance: 'catalog_estimate',
          image_path: null,
        });
        setDeductItems(matchedIds);
      } catch {
        // Recipes without complete saved nutrition can still use Nutrition Scan.
      }
    };
    void loadPlannedRecipe();
    return () => { cancelled = true; };
  }, [plannedMeal, inventory]);

  const processImage = useCallback(async (file: File) => {
    try {
      const compressed = await compressImage(file, { maxDimension: 800, quality: 0.78 });
      setImagePreview(compressed.dataUrl);
      setImageFile(new File([compressed.blob], 'meal.jpg', { type: 'image/jpeg' }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not prepare this image');
    }
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const analyze = async () => {
    if (!imageFile || !session?.user) return;
    setAnalyzing(true);
    let uploadedPath = imagePath;
    try {
      if (!uploadedPath) {
        uploadedPath = `${session.user.id}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('meal-photos')
          .upload(uploadedPath, imageFile, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
        setImagePath(uploadedPath);
      }
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayOnly = todayPlans.filter(p => p.planned_date === todayStr);
      let recipeContext: { ingredients: string[]; measures: string[] } | undefined;

      // For combined meals, merge all recipe ingredients as context
      if (isCombinedMeal) {
        const allIngredients = combinedRecipes!.flatMap(r => r.ingredients);
        const allMeasures = combinedRecipes!.flatMap(r => r.measures || r.ingredients.map(() => ''));
        recipeContext = { ingredients: allIngredients, measures: allMeasures };
      } else {
        const hour = new Date().getHours();
        const currentSlot = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 20 ? 'dinner' : 'snack';
        const likelyPlan = todayOnly.find(p => p.meal_slot === currentSlot) || todayOnly[0];
        if (likelyPlan) {
          try {
            const recipe = await getRecipeById(likelyPlan.recipe_id);
            if (recipe?.measures && recipe.measures.length > 0) {
              recipeContext = {
                ingredients: recipe.ingredients,
                measures: recipe.measures,
              };
            }
          } catch { /* ignore */ }
        }
      }

      const { data, error } = await supabase.functions.invoke('log-meal', {
        body: {
          imagePath: uploadedPath,
          mealTitle: mealTitle || combinedTitle || undefined,
          inventoryItems: inventory.map(i => ({ id: i.id, name: i.name, quantity: i.quantity })),
          servings: passedServings || preferences.householdSize || 4,
          recipeContext,
        },
      });
      if (error) throw error;
      setAnalysis(data as NutritionEstimate);
      setDeductItems(data.matched_inventory_ids || []);
      const title = data.title || mealTitle || combinedTitle;
      if (data.title && !mealTitle) setMealTitle(data.title);

      if (todayOnly.length > 0) {
        const match = todayOnly.find(p =>
          p.title.toLowerCase().includes(title.toLowerCase()) ||
          title.toLowerCase().includes(p.title.toLowerCase())
        );
        if (match) {
          setLinkedPlanId(match.id);
        } else {
          const hour = new Date().getHours();
          const currentSlot = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 20 ? 'dinner' : 'snack';
          const likelyPlan = todayOnly.find(p => p.meal_slot === currentSlot) || todayOnly[0];
          if (likelyPlan) setLinkedPlanId(likelyPlan.id);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to analyze meal');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleDeduct = (id: string) => {
    setDeductItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const reviewManualEntry = () => {
    const title = mealTitle.trim();
    const nutrition = {
      calories: Number(manualNutrition.calories),
      protein_g: Number(manualNutrition.protein_g || 0),
      carbs_g: Number(manualNutrition.carbs_g || 0),
      fat_g: Number(manualNutrition.fat_g || 0),
    };
    if (!title) {
      toast.error('Add a meal name first.');
      return;
    }
    if (Object.values(nutrition).some((value) => !Number.isFinite(value) || value < 0)) {
      toast.error('Nutrition values must be zero or higher.');
      return;
    }
    setAnalysis(buildManualEstimate(title, nutrition));
  };

  const saveMealLog = async () => {
    if (!analysis || !session?.user) return;
    setSaving(true);
    try {
      const source = isCombinedMeal ? 'cook_together' : linkedPlanId ? 'planned' : 'manual';
      const title = mealTitle || analysis.title;
      const { error } = await supabase.rpc('confirm_meal_log' as never, {
        p_estimate: { ...analysis, title },
        p_inventory_item_ids: deductItems,
        p_meal_plan_id: linkedPlanId,
        p_image_path: imagePath,
        p_source: source,
        p_notes: mealNotes || null,
        p_rating: mealRating > 0 ? mealRating : null,
      } as never);
      if (error) throw error;

      // Track interaction
      const recipeId = linkedPlanId
        ? todayPlans.find(p => p.id === linkedPlanId)?.recipe_id
        : undefined;
      await track('meal_logged', {
        recipeId,
        recipeTitle: title,
        mealPlanId: linkedPlanId || undefined,
        metadata: { source, rating: mealRating > 0 ? mealRating : undefined },
      });

      await refreshInventory();
      toast.success('Meal logged! ' + (deductItems.length > 0 ? `${deductItems.length} inventory item${deductItems.length === 1 ? '' : 's'} marked consumed.` : ''));
      navigate('/meal-history');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save meal log');
    } finally {
      setSaving(false);
    }
  };

  const matchedItems = inventory.filter(i => deductItems.includes(i.id));
  const unmatchedInventory = inventory.filter(i => !deductItems.includes(i.id));

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-foreground">
            {isCombinedMeal ? 'Log Combined Meal' : 'Log a Meal'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isCombinedMeal
              ? 'Cook Together — track as one meal'
              : plannedMeal
              ? 'Review nutrition and inventory before confirming'
              : 'Snap your plate to track nutrition & usage'}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Combined recipes preview */}
        {isCombinedMeal && (
          <Card className="p-4 border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <UtensilsCrossed className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Combined Meal</h2>
            </div>
            <div className="space-y-3">
              {combinedRecipes!.map((r, idx) => (
                <div key={r.id} className="flex items-start gap-3">
                  {r.image ? (
                    <img src={r.image} alt={r.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <ChefHat className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-foreground truncate">{r.title}</h3>
                    <p className="text-[10px] text-muted-foreground">
                      {r.ingredients.length} ingredients
                      {idx === 0 ? ' · Main dish' : ' · Side dish'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Image capture */}
        {!imagePreview && !analysis && !manualMode ? (
          <Card className="p-6 flex flex-col items-center gap-4 border-dashed border-2 border-primary/30">
            <UtensilsCrossed className="w-12 h-12 text-primary/40" />
            <p className="text-sm text-muted-foreground text-center">
              {isCombinedMeal
                ? 'Take a photo of your combined plate'
                : plannedMeal && analysis
                ? 'Recipe nutrition is ready below. Add a photo only if you want a fresh estimate.'
                : 'Take a photo of your meal or upload one'}
            </p>
            <div className="flex gap-3">
              <Button onClick={() => cameraRef.current?.click()} className="gap-2">
                <Camera className="w-4 h-4" /> Camera
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload className="w-4 h-4" /> Upload
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setManualMode(true)}>
              Enter nutrition manually
            </Button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </Card>
        ) : imagePreview ? (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden">
              <img src={imagePreview} alt="Meal" className="w-full max-h-64 object-cover" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 w-8 h-8 rounded-full"
                onClick={async () => {
                  if (imagePath) await supabase.storage.from('meal-photos').remove([imagePath]);
                  setImagePreview(null);
                  setImageFile(null);
                  setImagePath(null);
                  setAnalysis(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <Input
              placeholder={isCombinedMeal ? combinedTitle : 'Meal name (optional — AI will guess)'}
              value={mealTitle}
              onChange={e => setMealTitle(e.target.value)}
            />

            {!analysis && (
              <Button onClick={analyze} disabled={analyzing} className="w-full gap-2">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                {analyzing ? 'Analyzing…' : 'Analyze Meal'}
              </Button>
            )}
          </div>
        ) : null}

        {manualMode && !analysis && (
          <Card className="p-4 space-y-4">
            <div>
              <h2 className="font-semibold text-foreground">Manual meal entry</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Use a label or package estimate. You can review it before saving.
              </p>
            </div>
            <Input
              aria-label="Meal name"
              placeholder="Meal name"
              value={mealTitle}
              onChange={(event) => setMealTitle(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              {[
                ['calories', 'Calories'],
                ['protein_g', 'Protein (g)'],
                ['carbs_g', 'Carbs (g)'],
                ['fat_g', 'Fat (g)'],
              ].map(([key, label]) => (
                <Input
                  key={key}
                  aria-label={label}
                  type="number"
                  min={0}
                  placeholder={label}
                  value={manualNutrition[key as keyof typeof manualNutrition]}
                  onChange={(event) => setManualNutrition((current) => ({ ...current, [key]: event.target.value }))}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setManualMode(false)} className="flex-1">Cancel</Button>
              <Button onClick={reviewManualEntry} className="flex-1">Review entry</Button>
            </div>
          </Card>
        )}

        {/* Analysis results */}
        {analysis && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Nutrition card — estimates become history only after review. */}
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-semibold text-foreground">{analysis.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analysis.provenance === 'user_estimate'
                      ? 'Manual entry'
                      : analysis.provenance === 'catalog_estimate'
                      ? 'Recipe estimate'
                      : 'Photo estimate'} · {Math.round(analysis.confidence * 100)}% confidence
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-primary">Review</span>
              </div>
              {isCombinedMeal && (
                <p className="text-[10px] text-muted-foreground mb-3 flex items-center gap-1">
                  <UtensilsCrossed className="w-2.5 h-2.5" />
                  Combined nutrition for entire meal
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'calories' as const, label: 'Calories', value: analysis.calories, range: analysis.ranges.calories, icon: Flame, color: 'text-orange-500', suffix: '' },
                  { key: 'protein_g' as const, label: 'Protein', value: analysis.protein_g, range: analysis.ranges.protein_g, icon: Beef, color: 'text-red-500', suffix: 'g' },
                  { key: 'carbs_g' as const, label: 'Carbs', value: analysis.carbs_g, range: analysis.ranges.carbs_g, icon: Wheat, color: 'text-amber-500', suffix: 'g' },
                  { key: 'fat_g' as const, label: 'Fat', value: analysis.fat_g, range: analysis.ranges.fat_g, icon: Droplets, color: 'text-blue-500', suffix: 'g' },
                ].map(({ key, label, value, range, icon: Icon, color, suffix }) => (
                  <div key={label} className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
                    <Icon className={`w-4 h-4 ${color} mb-1`} />
                    <Input
                      aria-label={`${label} estimate`}
                      type="number"
                      min={0}
                      value={value}
                      onChange={(event) => setAnalysis((current) => current ? { ...current, [key]: Number(event.target.value) } : current)}
                      className="h-8 px-1 text-center font-bold"
                    />
                    <span className="text-[10px] text-muted-foreground">{label}{suffix ? ` (${suffix})` : ''}</span>
                    <span className="text-[9px] text-muted-foreground">likely {Math.round(range.low)}–{Math.round(range.high)}</span>
                  </div>
                ))}
              </div>
              {analysis.notes.length > 0 && <p className="mt-3 text-[11px] text-muted-foreground">{analysis.notes.join(' ')}</p>}
              <p className="mt-2 text-[11px] text-muted-foreground">Guidance only, not medical advice. Your edits are what get saved.</p>
            </Card>

            {/* Ingredients — separate cards per dish for combined meals */}
            {isCombinedMeal ? (
              combinedRecipes!.map((recipe, rIdx) => {
                const recipeIngredients = analysis.ingredients.filter(ing =>
                  recipe.ingredients.some(ri =>
                    ri.toLowerCase().includes(ing.name.toLowerCase()) ||
                    ing.name.toLowerCase().includes(ri.toLowerCase())
                  )
                );
                // If no fuzzy match, show all for first, none for second
                const displayIngredients = recipeIngredients.length > 0
                  ? recipeIngredients
                  : rIdx === 0 ? analysis.ingredients : [];

                return (
                  <Card key={recipe.id} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {recipe.image ? (
                        <img src={recipe.image} alt={recipe.title} className="w-8 h-8 rounded-md object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                          <ChefHat className="w-3.5 h-3.5 text-muted-foreground/40" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{recipe.title}</h3>
                        <p className="text-[10px] text-muted-foreground">
                          {rIdx === 0 ? 'Main dish' : 'Side dish'} · {displayIngredients.length} items
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {displayIngredients.map((ing, i) => (
                        <div key={i} className="flex justify-between text-sm px-2 py-1.5 rounded bg-muted/30">
                          <span className="text-foreground">{ing.name}</span>
                          <span className="text-muted-foreground">{ing.amount}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })
            ) : (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Identified Ingredients</h3>
                <div className="space-y-1.5">
                  {analysis.ingredients.map((ing, i) => (
                    <div key={i} className="flex justify-between text-sm px-2 py-1.5 rounded bg-muted/30">
                      <span className="text-foreground">{ing.name}</span>
                      <span className="text-muted-foreground">{ing.amount}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Inventory deduction */}
            {(matchedItems.length > 0 || unmatchedInventory.length > 0) && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Deduct from Inventory
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Select items to remove after cooking this meal
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {matchedItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed="true"
                      onClick={() => toggleDeduct(item.id)}
                      className="flex min-h-11 items-center gap-2 w-full text-left text-sm px-3 py-2 rounded-lg bg-primary/10 text-foreground"
                    >
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span className="flex-1">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.quantity}</span>
                    </button>
                  ))}
                  {unmatchedInventory.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed="false"
                      onClick={() => toggleDeduct(item.id)}
                      className="flex min-h-11 items-center gap-2 w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-muted/50 text-foreground"
                    >
                      <div className="w-4 h-4 rounded border border-border shrink-0" />
                      <span className="flex-1">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.quantity}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Linked meal plan indicator */}
            {linkedPlanId && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-sm">
                <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                <span className="text-foreground">
                  Linked to planned meal: <strong>{todayPlans.find(p => p.id === linkedPlanId)?.title}</strong>
                </span>
                <button onClick={() => setLinkedPlanId(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Quick rating */}
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Quick Rating</h3>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    onClick={() => setMealRating(mealRating === s ? 0 : s)}
                    className="p-1 transition-colors"
                  >
                    <Star className={`w-6 h-6 ${s <= mealRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                  </button>
                ))}
                <span className="text-xs text-muted-foreground ml-2">
                  {mealRating === 0 ? 'Optional' : `${mealRating}/5`}
                </span>
              </div>
              <Textarea
                placeholder="Any notes about this meal? (optional)"
                value={mealNotes}
                onChange={e => setMealNotes(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </Card>

            {/* Save button */}
            <Button onClick={saveMealLog} disabled={saving} className="w-full gap-2" size="lg">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving…' : isCombinedMeal ? 'Log Combined Meal' : 'Log Meal'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
