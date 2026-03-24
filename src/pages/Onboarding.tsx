import { useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChefHat, Users, Clock, Leaf, X, Heart, Globe, Wallet,
  Gauge, Target, Wand2, HandHelping, Sparkles, Timer,
  Salad, Recycle, Baby, Shuffle, AlertTriangle
} from 'lucide-react';
import type { PlanningStyle, BudgetSensitivity, CookingConfidence, PrimaryGoal } from '@/types';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Halal', 'Kosher', 'None'];
const TIME_OPTIONS = ['15 min', '30 min', '45 min', '60+ min'];
const COMMON_DISLIKES = ['Cilantro', 'Mushrooms', 'Olives', 'Anchovies', 'Blue Cheese', 'Liver', 'Eggplant'];
const COMMON_ALLERGIES = ['Peanuts', 'Tree Nuts', 'Shellfish', 'Dairy', 'Eggs', 'Soy', 'Wheat', 'Fish', 'Sesame'];
const CUISINE_OPTIONS = ['Italian', 'Mexican', 'Indian', 'Chinese', 'Japanese', 'Thai', 'Mediterranean', 'Middle Eastern', 'Korean', 'French', 'American', 'British'];

const GOAL_OPTIONS: { value: PrimaryGoal; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'save-time', label: 'Save Time', desc: 'Quick meals, less planning', icon: <Timer className="w-5 h-5" /> },
  { value: 'eat-healthier', label: 'Eat Healthier', desc: 'Balanced, nutritious meals', icon: <Salad className="w-5 h-5" /> },
  { value: 'reduce-waste', label: 'Reduce Waste', desc: 'Use what you have', icon: <Recycle className="w-5 h-5" /> },
  { value: 'family-friendly', label: 'Family-Friendly', desc: 'Meals everyone enjoys', icon: <Baby className="w-5 h-5" /> },
  { value: 'variety', label: 'More Variety', desc: 'Try new things often', icon: <Shuffle className="w-5 h-5" /> },
];

const PLANNING_OPTIONS: { value: PlanningStyle; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'pick-myself', label: 'Pick It Myself', desc: 'I like to choose my own meals', icon: <HandHelping className="w-6 h-6" /> },
  { value: 'help-choose', label: 'Help Me Choose', desc: 'Suggest options, I\'ll decide', icon: <Wand2 className="w-6 h-6" /> },
  { value: 'do-it-for-me', label: 'Do It For Me', desc: 'Plan my meals automatically', icon: <Sparkles className="w-6 h-6" /> },
];

const CONFIDENCE_OPTIONS: { value: CookingConfidence; label: string; desc: string }[] = [
  { value: 'beginner', label: '🍳 Beginner', desc: 'Simple recipes, few steps' },
  { value: 'intermediate', label: '👨‍🍳 Comfortable', desc: 'Most recipes are fine' },
  { value: 'advanced', label: '🔪 Confident', desc: 'Bring on the challenge' },
];

const BUDGET_OPTIONS: { value: BudgetSensitivity; label: string; desc: string }[] = [
  { value: 'low', label: 'Budget-Friendly', desc: 'Keep costs down' },
  { value: 'medium', label: 'Balanced', desc: 'Quality without overspending' },
  { value: 'high', label: 'No Limit', desc: 'Best ingredients, any price' },
];

export default function Onboarding() {
  const { completeOnboarding, setPreferences } = useApp();
  const [step, setStep] = useState(0);

  // State for all fields
  const [displayName, setDisplayName] = useState('');
  const [householdSize, setHouseholdSize] = useState(2);
  const [dietary, setDietary] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState('');
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [customDislike, setCustomDislike] = useState('');
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [cookingTime, setCookingTime] = useState('30 min');
  const [budget, setBudget] = useState<BudgetSensitivity>('medium');
  const [confidence, setConfidence] = useState<CookingConfidence>('intermediate');
  const [goal, setGoal] = useState<PrimaryGoal>('reduce-waste');
  const [planningStyle, setPlanningStyle] = useState<PlanningStyle>('help-choose');

  const customInputRef = useRef<HTMLInputElement>(null);
  const allergyInputRef = useRef<HTMLInputElement>(null);

  const toggleItem = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const handleFinish = () => {
    setPreferences({
      displayName,
      householdSize,
      dietaryPreferences: dietary,
      cookingTime,
      dislikedIngredients: dislikes,
      preferredCuisines: cuisines,
      budgetSensitivity: budget,
      cookingConfidence: confidence,
      primaryGoal: goal,
      planningStyle: planningStyle,
      allergies,
    });
    completeOnboarding();
  };

  const TOTAL_STEPS = 9;

  const chipClass = (active: boolean, variant: 'primary' | 'destructive' = 'primary') => {
    const base = 'px-4 py-2.5 rounded-xl text-sm font-medium border transition-all active:scale-95';
    if (variant === 'destructive') {
      return `${base} ${active ? 'bg-destructive text-destructive-foreground border-destructive shadow-sm' : 'bg-card text-foreground border-border hover:border-destructive/40'}`;
    }
    return `${base} ${active ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card text-foreground border-border hover:border-primary/40'}`;
  };

  const cardClass = (active: boolean) =>
    `w-full p-4 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
      active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/30'
    }`;

  const steps = [
    // 0: Welcome
    <div key="welcome" className="flex flex-col items-center text-center gap-6 animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
        <ChefHat className="w-10 h-10 text-primary" />
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kitchen Companion</h1>
        <p className="text-muted-foreground mt-2 text-lg">Let's set up your food system</p>
      </div>
      <p className="text-sm text-muted-foreground max-w-xs">
        A few quick questions so we can personalise your experience — meal ideas, shopping, and waste tracking tailored to you.
      </p>
      <Button onClick={() => setStep(1)} size="lg" className="w-full max-w-xs rounded-xl">
        Let's Go
      </Button>
    </div>,

    // 1: Name + Household
    <div key="name" className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Users className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Who's cooking?</h2>
        <p className="text-muted-foreground mt-1">Tell us about your household</p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Your name</label>
        <Input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="e.g. Alex"
          className="rounded-xl"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Cooking for how many?</label>
        <div className="flex items-center justify-center gap-6 py-2">
          <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setHouseholdSize(Math.max(1, householdSize - 1))}>−</Button>
          <span className="text-4xl font-bold w-12 text-center">{householdSize}</span>
          <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setHouseholdSize(Math.min(10, householdSize + 1))}>+</Button>
        </div>
      </div>
    </div>,

    // 2: Diet
    <div key="dietary" className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Leaf className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Dietary Preferences</h2>
        <p className="text-muted-foreground mt-1">We'll filter recipes to match</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {DIETARY_OPTIONS.map(opt => (
          <button key={opt} onClick={() => toggleItem(dietary, opt, setDietary)} className={chipClass(dietary.includes(opt))}>
            {opt}
          </button>
        ))}
      </div>
    </div>,

    // 3: Allergies
    <div key="allergies" className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">Allergies</h2>
        <p className="text-muted-foreground mt-1">Safety first — we'll keep these out</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {COMMON_ALLERGIES.map(opt => (
          <button key={opt} onClick={() => toggleItem(allergies, opt, setAllergies)} className={chipClass(allergies.includes(opt), 'destructive')}>
            {opt}
          </button>
        ))}
        {allergies.filter(a => !COMMON_ALLERGIES.includes(a)).map(opt => (
          <button key={opt} onClick={() => setAllergies(prev => prev.filter(i => i !== opt))}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border bg-destructive text-destructive-foreground border-destructive">
            {opt} ×
          </button>
        ))}
      </div>
      <div className="flex gap-2 max-w-xs mx-auto">
        <Input
          ref={allergyInputRef}
          value={customAllergy}
          onChange={e => setCustomAllergy(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { const v = customAllergy.trim(); if (v && !allergies.includes(v)) setAllergies(p => [...p, v]); setCustomAllergy(''); }}}
          placeholder="Add other..."
          className="flex-1 rounded-xl"
        />
        <Button variant="outline" size="sm" className="rounded-xl"
          onClick={() => { const v = customAllergy.trim(); if (v && !allergies.includes(v)) setAllergies(p => [...p, v]); setCustomAllergy(''); }}
          disabled={!customAllergy.trim()}>Add</Button>
      </div>
    </div>,

    // 4: Dislikes
    <div key="dislikes" className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
          <X className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Disliked Ingredients</h2>
        <p className="text-muted-foreground mt-1">Not allergic, just… no thanks</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {COMMON_DISLIKES.map(opt => (
          <button key={opt} onClick={() => toggleItem(dislikes, opt, setDislikes)} className={chipClass(dislikes.includes(opt), 'destructive')}>
            {opt}
          </button>
        ))}
        {dislikes.filter(d => !COMMON_DISLIKES.includes(d)).map(opt => (
          <button key={opt} onClick={() => setDislikes(prev => prev.filter(i => i !== opt))}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border bg-destructive text-destructive-foreground border-destructive">
            {opt} ×
          </button>
        ))}
      </div>
      <div className="flex gap-2 max-w-xs mx-auto">
        <Input
          ref={customInputRef}
          value={customDislike}
          onChange={e => setCustomDislike(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { const v = customDislike.trim(); if (v && !dislikes.includes(v)) setDislikes(p => [...p, v]); setCustomDislike(''); }}}
          placeholder="Add other..."
          className="flex-1 rounded-xl"
        />
        <Button variant="outline" size="sm" className="rounded-xl"
          onClick={() => { const v = customDislike.trim(); if (v && !dislikes.includes(v)) setDislikes(p => [...p, v]); setCustomDislike(''); }}
          disabled={!customDislike.trim()}>Add</Button>
      </div>
    </div>,

    // 5: Cuisines
    <div key="cuisines" className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Globe className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Favourite Cuisines</h2>
        <p className="text-muted-foreground mt-1">Pick as many as you like</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {CUISINE_OPTIONS.map(opt => (
          <button key={opt} onClick={() => toggleItem(cuisines, opt, setCuisines)} className={chipClass(cuisines.includes(opt))}>
            {opt}
          </button>
        ))}
      </div>
    </div>,

    // 6: Cooking time + confidence + budget
    <div key="prefs" className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">How You Cook</h2>
        <p className="text-muted-foreground mt-1">Time, skill, and budget</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max cooking time</label>
        <div className="grid grid-cols-4 gap-2">
          {TIME_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setCookingTime(opt)}
              className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${cookingTime === opt ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:border-primary/40'}`}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cooking confidence</label>
        <div className="space-y-2">
          {CONFIDENCE_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setConfidence(opt.value)} className={cardClass(confidence === opt.value)}>
              <p className="font-semibold text-sm">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Budget</label>
        <div className="grid grid-cols-3 gap-2">
          {BUDGET_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setBudget(opt.value)}
              className={`py-2.5 px-2 rounded-xl text-center border transition-all ${budget === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:border-primary/40'}`}>
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-[10px] text-primary-foreground/70">{budget === opt.value ? opt.desc : ''}</p>
            </button>
          ))}
        </div>
      </div>
    </div>,

    // 7: Primary goal
    <div key="goal" className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Target className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">What Matters Most?</h2>
        <p className="text-muted-foreground mt-1">We'll prioritise this in your suggestions</p>
      </div>
      <div className="space-y-2">
        {GOAL_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => setGoal(opt.value)} className={cardClass(goal === opt.value)}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${goal === opt.value ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {opt.icon}
              </div>
              <div>
                <p className="font-semibold text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>,

    // 8: Planning style
    <div key="planning" className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Wand2 className="w-7 h-7 text-accent" />
        </div>
        <h2 className="text-2xl font-bold">Your Planning Style</h2>
        <p className="text-muted-foreground mt-1">How much help do you want?</p>
      </div>
      <div className="space-y-3">
        {PLANNING_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => setPlanningStyle(opt.value)}
            className={`w-full p-5 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
              planningStyle === opt.value ? 'border-accent bg-accent/5 shadow-md' : 'border-border bg-card hover:border-accent/30'
            }`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                planningStyle === opt.value ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'
              }`}>
                {opt.icon}
              </div>
              <div>
                <p className="font-bold">{opt.label}</p>
                <p className="text-sm text-muted-foreground">{opt.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {step > 0 && (
          <div className="flex gap-1 mb-8">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i + 1 <= step ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        )}

        <div className="max-h-[70vh] overflow-y-auto px-1">
          {steps[step]}
        </div>

        {step > 0 && (
          <div className="flex gap-3 mt-8">
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 rounded-xl">Back</Button>
            <Button onClick={step === TOTAL_STEPS ? handleFinish : () => setStep(step + 1)} className="flex-1 rounded-xl">
              {step === TOTAL_STEPS ? '🎉 Start Cooking' : 'Next'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
