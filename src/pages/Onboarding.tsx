import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ChefHat, Users, Clock, Leaf, X } from 'lucide-react';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Halal', 'None'];
const TIME_OPTIONS = ['15 min', '30 min', '45 min', '60+ min'];
const COMMON_DISLIKES = ['Cilantro', 'Mushrooms', 'Olives', 'Anchovies', 'Blue Cheese', 'Liver', 'Eggplant'];

export default function Onboarding() {
  const { completeOnboarding, setPreferences } = useApp();
  const [step, setStep] = useState(0);
  const [householdSize, setHouseholdSize] = useState(2);
  const [dietary, setDietary] = useState<string[]>([]);
  const [cookingTime, setCookingTime] = useState('30 min');
  const [dislikes, setDislikes] = useState<string[]>([]);

  const toggleItem = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const handleFinish = () => {
    setPreferences({ householdSize, dietaryPreferences: dietary, cookingTime, dislikedIngredients: dislikes });
    completeOnboarding();
  };

  const steps = [
    // Welcome
    <div key="welcome" className="flex flex-col items-center text-center gap-6 animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
        <ChefHat className="w-10 h-10 text-primary" />
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CookBuddy</h1>
        <p className="text-muted-foreground mt-2 text-lg">Know what you have. Cook what makes sense.</p>
      </div>
      <div className="space-y-3 text-sm text-muted-foreground max-w-xs">
        <p>Track your kitchen inventory, reduce food waste, and get meal ideas based on what you already have.</p>
      </div>
      <Button onClick={() => setStep(1)} size="lg" className="w-full max-w-xs">
        Get Started
      </Button>
    </div>,

    // Household size
    <div key="household" className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Users className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Household Size</h2>
        <p className="text-muted-foreground mt-1">How many people do you usually cook for?</p>
      </div>
      <div className="flex items-center justify-center gap-6">
        <Button variant="outline" size="icon" onClick={() => setHouseholdSize(Math.max(1, householdSize - 1))}>−</Button>
        <span className="text-4xl font-bold w-12 text-center">{householdSize}</span>
        <Button variant="outline" size="icon" onClick={() => setHouseholdSize(Math.min(10, householdSize + 1))}>+</Button>
      </div>
    </div>,

    // Dietary preferences
    <div key="dietary" className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Leaf className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Dietary Preferences</h2>
        <p className="text-muted-foreground mt-1">Select any that apply</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {DIETARY_OPTIONS.map(opt => (
          <button
            key={opt}
            onClick={() => toggleItem(dietary, opt, setDietary)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              dietary.includes(opt) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:border-primary/40'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>,

    // Cooking time
    <div key="time" className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Cooking Time</h2>
        <p className="text-muted-foreground mt-1">How long do you usually want to spend cooking?</p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
        {TIME_OPTIONS.map(opt => (
          <button
            key={opt}
            onClick={() => setCookingTime(opt)}
            className={`px-4 py-3 rounded-xl text-sm font-medium border transition-colors ${
              cookingTime === opt ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:border-primary/40'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>,

    // Dislikes
    <div key="dislikes" className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <X className="w-7 h-7 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">Disliked Ingredients</h2>
        <p className="text-muted-foreground mt-1">Anything you'd rather avoid?</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {COMMON_DISLIKES.map(opt => (
          <button
            key={opt}
            onClick={() => toggleItem(dislikes, opt, setDislikes)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              dislikes.includes(opt) ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-card text-foreground border-border hover:border-destructive/40'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {step > 0 && (
          <div className="flex gap-1.5 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        )}

        {steps[step]}

        {step > 0 && (
          <div className="flex gap-3 mt-8">
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">Back</Button>
            <Button onClick={step === 4 ? handleFinish : () => setStep(step + 1)} className="flex-1">
              {step === 4 ? 'Start Cooking' : 'Next'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
