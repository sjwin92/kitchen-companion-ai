import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { getRecipeById } from '@/services/recipes/recipeProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
} from 'lucide-react';

interface MealAnalysis {
  title: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: { name: string; amount: string }[];
  matched_inventory_ids: string[];
}

export default function MealLog() {
  const navigate = useNavigate();
  const { inventory, removeItem, session, preferences } = useApp();
  const { plans: todayPlans } = useMealPlans();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mealTitle, setMealTitle] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [saving, setSaving] = useState(false);
  const [deductItems, setDeductItems] = useState<string[]>([]);
  const [linkedPlanId, setLinkedPlanId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 800;
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        setImagePreview(base64);
        setImageBase64(base64);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const analyze = async () => {
    if (!imageBase64) return;
    setAnalyzing(true);
    try {
      // If there's a planned meal for today, look up its recipe for better context
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayOnly = todayPlans.filter(p => p.planned_date === todayStr);
      let recipeContext: { ingredients: string[]; measures: string[] } | undefined;
      
      // Try to find a matching planned meal's recipe for ingredient/quantity context
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

      const { data, error } = await supabase.functions.invoke('log-meal', {
        body: {
          imageBase64,
          mealTitle: mealTitle || undefined,
          inventoryItems: inventory.map(i => ({ id: i.id, name: i.name, quantity: i.quantity })),
          servings: preferences.householdSize || 4,
          recipeContext,
        },
      });
      if (error) throw error;
      setAnalysis(data as MealAnalysis);
      setDeductItems(data.matched_inventory_ids || []);
      const title = data.title || mealTitle;
      if (data.title && !mealTitle) setMealTitle(data.title);

      // Auto-match to today's planned meals (reuse todayOnly from above)
      if (todayOnly.length > 0) {
        const match = todayOnly.find(p =>
          p.title.toLowerCase().includes(title.toLowerCase()) ||
          title.toLowerCase().includes(p.title.toLowerCase())
        );
        if (match) {
          setLinkedPlanId(match.id);
        } else if (likelyPlan) {
          setLinkedPlanId(likelyPlan.id);
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

  const saveMealLog = async () => {
    if (!analysis || !session?.user) return;
    setSaving(true);
    try {
      // Save meal log linked to planner
      const { error } = await supabase.from('meal_log').insert({
        user_id: session.user.id,
        title: mealTitle || analysis.title,
        calories: analysis.calories,
        protein_g: analysis.protein_g,
        carbs_g: analysis.carbs_g,
        fat_g: analysis.fat_g,
        identified_ingredients: analysis.ingredients as any,
        deducted_item_ids: deductItems as any,
        meal_plan_id: linkedPlanId,
        image_url: imagePreview,
      });
      if (error) throw error;

      // Deduct selected inventory items
      for (const id of deductItems) {
        await removeItem(id);
      }

      toast.success('Meal logged! ' + (deductItems.length > 0 ? `${deductItems.length} items removed from inventory.` : ''));
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
          <h1 className="text-lg font-bold text-foreground">Log a Meal</h1>
          <p className="text-xs text-muted-foreground">Snap your plate to track nutrition & usage</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Image capture */}
        {!imagePreview ? (
          <Card className="p-6 flex flex-col items-center gap-4 border-dashed border-2 border-primary/30">
            <UtensilsCrossed className="w-12 h-12 text-primary/40" />
            <p className="text-sm text-muted-foreground text-center">
              Take a photo of your meal or upload one
            </p>
            <div className="flex gap-3">
              <Button onClick={() => cameraRef.current?.click()} className="gap-2">
                <Camera className="w-4 h-4" /> Camera
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload className="w-4 h-4" /> Upload
              </Button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden">
              <img src={imagePreview} alt="Meal" className="w-full max-h-64 object-cover" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 w-8 h-8 rounded-full"
                onClick={() => { setImagePreview(null); setImageBase64(null); setAnalysis(null); }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <Input
              placeholder="Meal name (optional — AI will guess)"
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
        )}

        {/* Analysis results */}
        {analysis && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Nutrition card */}
            <Card className="p-4">
              <h2 className="font-semibold text-foreground mb-3">{analysis.title}</h2>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Calories', value: `${analysis.calories}`, icon: Flame, color: 'text-orange-500' },
                  { label: 'Protein', value: `${analysis.protein_g}g`, icon: Beef, color: 'text-red-500' },
                  { label: 'Carbs', value: `${analysis.carbs_g}g`, icon: Wheat, color: 'text-amber-500' },
                  { label: 'Fat', value: `${analysis.fat_g}g`, icon: Droplets, color: 'text-blue-500' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
                    <Icon className={`w-4 h-4 ${color} mb-1`} />
                    <span className="text-sm font-bold text-foreground">{value}</span>
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Ingredients identified */}
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
                      onClick={() => toggleDeduct(item.id)}
                      className="flex items-center gap-2 w-full text-left text-sm px-2 py-1.5 rounded bg-primary/10 text-foreground"
                    >
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span className="flex-1">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.quantity}</span>
                    </button>
                  ))}
                  {unmatchedInventory.map(item => (
                    <button
                      key={item.id}
                      onClick={() => toggleDeduct(item.id)}
                      className="flex items-center gap-2 w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted/50 text-foreground"
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

            {/* Save button */}
            <Button onClick={saveMealLog} disabled={saving} className="w-full gap-2" size="lg">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Log Meal'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
