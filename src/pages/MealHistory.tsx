import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft,
  Loader2,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Camera,
  CalendarDays,
  TrendingUp,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, isToday, isYesterday, parseISO } from 'date-fns';

interface MealLogEntry {
  id: string;
  title: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  identified_ingredients: { name: string; amount: string }[];
  logged_at: string;
  image_url: string | null;
}

export default function MealHistory() {
  const navigate = useNavigate();
  const { session } = useApp();
  const [meals, setMeals] = useState<MealLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      const { data, error } = await supabase
        .from('meal_log')
        .select('id, title, calories, protein_g, carbs_g, fat_g, identified_ingredients, logged_at, image_url')
        .order('logged_at', { ascending: false })
        .limit(100);
      if (!error && data) setMeals(data as MealLogEntry[]);
      setLoading(false);
    })();
  }, [session]);

  // Weekly summary
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const thisWeekMeals = meals.filter(m => {
    const d = parseISO(m.logged_at);
    return d >= weekStart && d <= weekEnd;
  });

  const weekTotals = thisWeekMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      protein: acc.protein + (m.protein_g || 0),
      carbs: acc.carbs + (m.carbs_g || 0),
      fat: acc.fat + (m.fat_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const daysWithMeals = new Set(thisWeekMeals.map(m => format(parseISO(m.logged_at), 'yyyy-MM-dd'))).size;
  const avgCalories = daysWithMeals > 0 ? Math.round(weekTotals.calories / daysWithMeals) : 0;

  // Group meals by date
  const grouped: Record<string, MealLogEntry[]> = {};
  meals.forEach(m => {
    const key = format(parseISO(m.logged_at), 'yyyy-MM-dd');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  });

  const dateLabel = (dateStr: string) => {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEE, MMM d');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Meal History</h1>
          <p className="text-xs text-muted-foreground">Track your nutrition over time</p>
        </div>
        <Button size="sm" onClick={() => navigate('/meal-log')} className="gap-1.5">
          <Camera className="w-3.5 h-3.5" /> Log
        </Button>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : meals.length === 0 ? (
          <Card className="p-8 text-center">
            <Camera className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h2 className="font-semibold text-foreground mb-1">No meals logged yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Snap a photo of your meal to start tracking nutrition
            </p>
            <Button onClick={() => navigate('/meal-log')} className="gap-2">
              <Camera className="w-4 h-4" /> Log Your First Meal
            </Button>
          </Card>
        ) : (
          <>
            {/* Weekly summary card */}
            <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">This Week</h2>
                <span className="text-xs text-muted-foreground ml-auto">
                  {thisWeekMeals.length} meal{thisWeekMeals.length !== 1 ? 's' : ''} logged
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Avg Cal', value: avgCalories.toLocaleString(), icon: Flame, color: 'text-orange-500' },
                  { label: 'Protein', value: `${Math.round(weekTotals.protein)}g`, icon: Beef, color: 'text-red-500' },
                  { label: 'Carbs', value: `${Math.round(weekTotals.carbs)}g`, icon: Wheat, color: 'text-amber-500' },
                  { label: 'Fat', value: `${Math.round(weekTotals.fat)}g`, icon: Droplets, color: 'text-blue-500' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex flex-col items-center p-2 rounded-lg bg-background/60">
                    <Icon className={`w-3.5 h-3.5 ${color} mb-1`} />
                    <span className="text-sm font-bold text-foreground">{value}</span>
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Meal list grouped by date */}
            {Object.entries(grouped).map(([dateStr, dayMeals]) => {
              const dayTotals = dayMeals.reduce(
                (acc, m) => ({
                  cal: acc.cal + (m.calories || 0),
                  p: acc.p + (m.protein_g || 0),
                  c: acc.c + (m.carbs_g || 0),
                  f: acc.f + (m.fat_g || 0),
                }),
                { cal: 0, p: 0, c: 0, f: 0 }
              );

              return (
                <div key={dateStr} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">{dateLabel(dateStr)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {dayTotals.cal.toLocaleString()} cal
                    </span>
                  </div>

                  {dayMeals.map(meal => (
                    <Card key={meal.id} className="p-3">
                      <div className="flex items-start gap-3">
                        {meal.image_url ? (
                          <img
                            src={meal.image_url}
                            alt={meal.title}
                            className="w-14 h-14 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Camera className="w-5 h-5 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground truncate">{meal.title}</h3>
                            <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                              {format(parseISO(meal.logged_at), 'h:mm a')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <MacroPill icon={Flame} value={`${meal.calories || 0}`} color="text-orange-500" />
                            <MacroPill icon={Beef} value={`${meal.protein_g || 0}g`} color="text-red-500" />
                            <MacroPill icon={Wheat} value={`${meal.carbs_g || 0}g`} color="text-amber-500" />
                            <MacroPill icon={Droplets} value={`${meal.fat_g || 0}g`} color="text-blue-500" />
                          </div>
                          {meal.identified_ingredients && (meal.identified_ingredients as any[]).length > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-1.5 truncate">
                              {(meal.identified_ingredients as any[]).map((i: any) => i.name).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function MacroPill({ icon: Icon, value, color }: { icon: any; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <Icon className={`w-3 h-3 ${color}`} />
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}
