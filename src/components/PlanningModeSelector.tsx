import { useApp } from '@/context/AppContext';
import type { PlanningStyle } from '@/types';
import { HandHelping, Wand2, Sparkles } from 'lucide-react';

const MODES: { value: PlanningStyle; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'pick-myself', label: 'Manual', desc: 'I choose', icon: <HandHelping className="w-4 h-4" /> },
  { value: 'help-choose', label: 'Guided', desc: 'Suggest to me', icon: <Wand2 className="w-4 h-4" /> },
  { value: 'do-it-for-me', label: 'Auto', desc: 'Plan for me', icon: <Sparkles className="w-4 h-4" /> },
];

export default function PlanningModeSelector() {
  const { preferences, setPreferences } = useApp();

  return (
    <div className="flex gap-2">
      {MODES.map(mode => (
        <button
          key={mode.value}
          onClick={() => setPreferences({ planningStyle: mode.value })}
          className={`flex-1 flex flex-col items-center gap-1 rounded-xl border-2 py-2.5 px-2 transition-all active:scale-95 ${
            preferences.planningStyle === mode.value
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-border bg-card hover:border-primary/30'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            preferences.planningStyle === mode.value ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {mode.icon}
          </div>
          <span className="text-xs font-semibold">{mode.label}</span>
          <span className="text-[10px] text-muted-foreground">{mode.desc}</span>
        </button>
      ))}
    </div>
  );
}
