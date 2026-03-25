import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Flame,
  Beef,
  Wheat,
  Droplets,
  ChevronRight,
  Camera,
  CalendarDays,
  Pencil,
  Check,
  UtensilsCrossed,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';

interface MealLogEntry {
  id: string;
  title: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  logged_at: string;
  image_url: string | null;
  source: string | null;
}

interface PlannedMeal {
  id: string;
  title: string;
  meal_slot: string;
  status: string;
  image: string | null;
}

export default function CalorieTracker() {
  const { session } = useApp();
  const navigate = useNavigate();
  const [meals, setMeals] = useState<MealLogEntry[]>([]);
  const [planned, setPlanned] = useState<PlannedMeal[]>([]);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('2000');

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  useEffect(() => {
    if (!session?.user) return;
    const uid = session.user.id;

    // Load calorie goal from profile
    supabase
      .from('profiles')
      .select('daily_calorie_goal')
      .eq('id', uid)
      .single()
      .then(({ data }) => {
        const goal = (data as any)?.daily_calorie_goal ?? 2000;
        setCalorieGoal(goal);
        setGoalInput(String(goal));
      });

    // Load today's logged meals
    const dayStart = startOfDay(today).toISOString();
    const dayEnd = endOfDay(today).toISOString();
    supabase
      .from('meal_log')
      .select('id, title, calories, protein_g, carbs_g, fat_g, logged_at, image_url, source')
      .gte('logged_at', dayStart)
      .lte('logged_at', dayEnd)
      .order('logged_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMeals(data as MealLogEntry[]);
      });

    // Load today's planned meals
    supabase
      .from('meal_plans')
      .select('id, title, meal_slot, status, image')
      .eq('planned_date', todayStr)
      .order('meal_slot', { ascending: true })
      .then(({ data }) => {
        if (data) setPlanned(data as PlannedMeal[]);
      });
  }, [session?.user?.id]);

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories || 0),
        protein: acc.protein + (m.protein_g || 0),
        carbs: acc.carbs + (m.carbs_g || 0),
        fat: acc.fat + (m.fat_g || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [meals]);

  const progress = calorieGoal > 0 ? Math.min((totals.calories / calorieGoal) * 100, 100) : 0;
  const remaining = Math.max(calorieGoal - totals.calories, 0);

  // SVG ring params
  const size = 140;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  const saveGoal = async () => {
    const val = Math.max(500, Math.min(10000, parseInt(goalInput) || 2000));
    setCalorieGoal(val);
    setGoalInput(String(val));
    setEditingGoal(false);
    if (session?.user) {
      await supabase
        .from('profiles')
        .update({ daily_calorie_goal: val } as any)
        .eq('id', session.user.id);
    }
  };

  const slotOrder = ['breakfast', 'lunch', 'snack', 'dinner'];
  const sortedPlanned = [...planned].sort(
    (a, b) => slotOrder.indexOf(a.meal_slot) - slotOrder.indexOf(b.meal_slot)
  );

  const unloggedPlanned = sortedPlanned.filter(
    p => !['eaten', 'cooked'].includes(p.status) && p.status === 'planned'
  );

  return (
    <div className="space-y-3">
      <h2 className="section-title px-1">Calorie Tracker</h2>

      {/* Main ring card */}
      <Card className="p-5 animate-fade-in">
        <div className="flex items-center gap-5">
          {/* Progress ring */}
          <div className="relative shrink-0">
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={stroke}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={progress >= 100 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{totals.calories}</span>
              <span className="text-[10px] text-muted-foreground">eaten</span>
            </div>
          </div>

          {/* Right side info */}
          <div className="flex-1 space-y-3">
            {/* Goal */}
            <div className="flex items-center gap-2">
              {editingGoal ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    className="w-20 h-7 text-xs"
                    onKeyDown={e => e.key === 'Enter' && saveGoal()}
                    autoFocus
                  />
                  <span className="text-xs text-muted-foreground">cal</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveGoal}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingGoal(true)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>Goal: {calorieGoal.toLocaleString()} cal</span>
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="text-sm">
              <span className="font-semibold text-foreground">{remaining.toLocaleString()}</span>
              <span className="text-muted-foreground text-xs ml-1">remaining</span>
            </div>

            {/* Macros */}
            <div className="grid grid-cols-3 gap-2">
              <MacroBar
                icon={Beef}
                label="Protein"
                value={Math.round(totals.protein)}
                color="bg-red-500"
                textColor="text-red-500"
              />
              <MacroBar
                icon={Wheat}
                label="Carbs"
                value={Math.round(totals.carbs)}
                color="bg-amber-500"
                textColor="text-amber-500"
              />
              <MacroBar
                icon={Droplets}
                label="Fat"
                value={Math.round(totals.fat)}
                color="bg-blue-500"
                textColor="text-blue-500"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Today's logged meals */}
      {meals.length > 0 && (
        <Card className="p-4 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold">Today's Meals</h3>
            </div>
            <button
              onClick={() => navigate('/meal-history')}
              className="text-xs text-primary flex items-center gap-0.5 hover:underline"
            >
              History <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1.5">
            {meals.map(meal => (
              <div key={meal.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 bg-muted/30">
                {meal.image_url ? (
                  <img src={meal.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <Camera className="w-3.5 h-3.5 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-foreground">{meal.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(parseISO(meal.logged_at), 'h:mm a')}
                  </p>
                </div>
                <span className="text-xs font-semibold text-foreground shrink-0">
                  {meal.calories || 0} cal
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Planned but not yet eaten */}
      {unloggedPlanned.length > 0 && (
        <Card className="p-4 space-y-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Planned Today</h3>
            <span className="text-xs text-muted-foreground ml-auto">{unloggedPlanned.length} remaining</span>
          </div>
          <div className="space-y-1.5">
            {unloggedPlanned.map(p => (
              <div
                key={p.id}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 bg-muted/30"
              >
                {p.image ? (
                  <img src={p.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-foreground">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{p.meal_slot}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quick actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-xl gap-1.5 text-xs"
          onClick={() => navigate('/meal-log')}
        >
          <Camera className="w-3.5 h-3.5" /> Log Meal
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-xl gap-1.5 text-xs"
          onClick={() => navigate('/meal-history')}
        >
          <Flame className="w-3.5 h-3.5" /> View History
        </Button>
      </div>
    </div>
  );
}

function MacroBar({
  icon: Icon,
  label,
  value,
  color,
  textColor,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  textColor: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <Icon className={`w-3 h-3 ${textColor} mb-0.5`} />
      <span className="text-xs font-bold text-foreground">{value}g</span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}
