import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { useStapleMeals } from '@/hooks/useStapleMeals';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  TrendingUp,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Star,
  UtensilsCrossed,
  SkipForward,
  Check,
  Pin,
  CalendarDays,
  ChefHat,
  Loader2,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, subWeeks, parseISO } from 'date-fns';

interface WeeklyStats {
  mealsLogged: number;
  mealsPlanned: number;
  mealsCooked: number;
  mealsEaten: number;
  mealsSkipped: number;
  avgCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  topRated: { title: string; rating: number }[];
  completionRate: number;
}

export default function WeeklyInsights() {
  const navigate = useNavigate();
  const { session } = useApp();
  const { staples } = useStapleMeals();
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const now = new Date();
  const weekStart = startOfWeek(subWeeks(now, weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`;

  useEffect(() => {
    if (!session?.user) return;
    const userId = session.user.id;
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');

    (async () => {
      setLoading(true);

      // Meal logs
      const { data: logs } = await supabase
        .from('meal_log')
        .select('title, calories, protein_g, carbs_g, fat_g, logged_at, rating')
        .eq('user_id', userId)
        .gte('logged_at', `${startStr}T00:00:00`)
        .lte('logged_at', `${endStr}T23:59:59`)
        .order('logged_at', { ascending: false });

      const mealLogs = (logs || []) as any[];
      const mealsLogged = mealLogs.length;
      const totalCal = mealLogs.reduce((s, m) => s + (m.calories || 0), 0);
      const daysWithMeals = new Set(mealLogs.map(m => format(parseISO(m.logged_at), 'yyyy-MM-dd'))).size;
      const avgCalories = daysWithMeals > 0 ? Math.round(totalCal / daysWithMeals) : 0;
      const totalProtein = Math.round(mealLogs.reduce((s, m) => s + (m.protein_g || 0), 0));
      const totalCarbs = Math.round(mealLogs.reduce((s, m) => s + (m.carbs_g || 0), 0));
      const totalFat = Math.round(mealLogs.reduce((s, m) => s + (m.fat_g || 0), 0));

      // Meal plans with status
      const { data: plans } = await supabase
        .from('meal_plans')
        .select('id, title, status, meal_slot, planned_date')
        .eq('user_id', userId)
        .gte('planned_date', startStr)
        .lte('planned_date', endStr);

      const planData = (plans || []) as any[];
      const mealsPlanned = planData.length;
      const mealsCooked = planData.filter(p => p.status === 'cooked').length;
      const mealsEaten = planData.filter(p => p.status === 'eaten').length;
      const mealsSkipped = planData.filter(p => p.status === 'skipped').length;
      const completedMeals = mealsCooked + mealsEaten;
      const completionRate = mealsPlanned > 0 ? Math.round((completedMeals / mealsPlanned) * 100) : 0;

      // Top rated from meal_ratings this week
      const { data: ratings } = await supabase
        .from('meal_ratings')
        .select('title, rating')
        .eq('user_id', userId)
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`)
        .order('rating', { ascending: false })
        .limit(5);

      const topRated = (ratings || []).map((r: any) => ({ title: r.title, rating: r.rating }));

      setStats({
        mealsLogged,
        mealsPlanned,
        mealsCooked,
        mealsEaten,
        mealsSkipped,
        avgCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        topRated,
        completionRate,
      });
      setLoading(false);
    })();
  }, [session, weekStart.toISOString()]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Weekly Insights</h1>
          <p className="text-xs text-muted-foreground">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekOffset(w => w + 1)}>← Prev</Button>
          {weekOffset > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>This Week</Button>
          )}
          {weekOffset > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekOffset(w => w - 1)}>Next →</Button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : stats ? (
          <>
            {/* Plan completion */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold">Plan Completion</h2>
                <span className="text-xs text-muted-foreground ml-auto">{stats.completionRate}%</span>
              </div>
              <Progress value={stats.completionRate} className="h-2" />
              <div className="grid grid-cols-4 gap-2">
                <StatChip icon={CalendarDays} label="Planned" value={stats.mealsPlanned} color="text-primary" />
                <StatChip icon={UtensilsCrossed} label="Cooked" value={stats.mealsCooked} color="text-amber-500" />
                <StatChip icon={Check} label="Eaten" value={stats.mealsEaten} color="text-green-500" />
                <StatChip icon={SkipForward} label="Skipped" value={stats.mealsSkipped} color="text-muted-foreground" />
              </div>
            </Card>

            {/* Nutrition */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold">Nutrition</h2>
                <span className="text-xs text-muted-foreground ml-auto">{stats.mealsLogged} meals logged</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <NutritionChip icon={Flame} label="Avg Cal" value={stats.avgCalories.toLocaleString()} color="text-orange-500" />
                <NutritionChip icon={Beef} label="Protein" value={`${stats.totalProtein}g`} color="text-red-500" />
                <NutritionChip icon={Wheat} label="Carbs" value={`${stats.totalCarbs}g`} color="text-amber-500" />
                <NutritionChip icon={Droplets} label="Fat" value={`${stats.totalFat}g`} color="text-blue-500" />
              </div>
            </Card>

            {/* Top rated */}
            {stats.topRated.length > 0 && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold">Top Rated</h2>
                </div>
                <div className="space-y-1.5">
                  {stats.topRated.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: r.rating }).map((_, j) => (
                          <Star key={j} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className="text-xs font-medium truncate">{r.title}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Staple meals */}
            {staples.length > 0 && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Pin className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold">Your Staples</h2>
                  <span className="text-xs text-muted-foreground ml-auto">{staples.length} meals</span>
                </div>
                <div className="space-y-1.5">
                  {staples.slice(0, 5).map(s => (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/recipe/${s.recipe_id}`)}
                      className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      {s.image && (
                        <img src={s.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{s.title}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{s.meal_slot} · {s.frequency_hint}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Empty state */}
            {stats.mealsPlanned === 0 && stats.mealsLogged === 0 && (
              <Card className="p-8 text-center space-y-3">
                <ChefHat className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <h2 className="text-sm font-semibold">No activity this week</h2>
                <p className="text-xs text-muted-foreground">Start planning meals and logging what you eat to see insights here</p>
                <Button size="sm" onClick={() => navigate('/meal-planner')} className="rounded-xl gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> Plan Meals
                </Button>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
      <Icon className={`w-3.5 h-3.5 ${color} mb-1`} />
      <span className="text-sm font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function NutritionChip({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
      <Icon className={`w-3.5 h-3.5 ${color} mb-1`} />
      <span className="text-sm font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
