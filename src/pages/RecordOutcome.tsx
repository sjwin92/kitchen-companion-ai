import { Link } from 'react-router-dom';
import { ArrowRight, ChartNoAxesColumnIncreasing, ClipboardCheck, History, Trash2, Utensils } from 'lucide-react';
import { Card } from '@/components/ui/card';

const OUTCOMES = [
  {
    title: 'We ate it',
    description: 'Log the meal, confirm nutrition and improve future recommendations.',
    path: '/meal-log',
    action: 'Log a meal',
    icon: Utensils,
    tone: 'bg-primary/10 text-primary',
  },
  {
    title: 'It was wasted',
    description: 'Record what was discarded and why so the next plan can avoid it.',
    path: '/waste',
    action: 'Log waste',
    icon: Trash2,
    tone: 'bg-destructive/10 text-destructive',
  },
] as const;

export default function RecordOutcome() {
  return (
    <main className="p-4 md:px-8 md:py-10 pb-28 md:pb-8 max-w-4xl mx-auto animate-fade-in">
      <div className="max-w-2xl mb-8">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <ClipboardCheck className="w-5 h-5" />
        </div>
        <p className="section-title mb-2">Close the kitchen loop</p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display">What happened to the food?</h1>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          Recording the outcome connects your inventory, calorie tracking, waste reduction and future meal suggestions.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {OUTCOMES.map(outcome => {
          const Icon = outcome.icon;
          return (
            <Link key={outcome.path} to={outcome.path} className="group">
              <Card className="h-full p-5 md:p-6 hover:-translate-y-0.5 transition-transform">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${outcome.tone}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold mt-6">{outcome.title}</h2>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{outcome.description}</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider mt-6">
                  {outcome.action} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        <Link to="/meal-history" className="glass-card p-4 flex items-center gap-3">
          <History className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">View meal history</span>
          <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
        </Link>
        <Link to="/weekly-insights" className="glass-card p-4 flex items-center gap-3">
          <ChartNoAxesColumnIncreasing className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Review weekly insights</span>
          <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
        </Link>
      </div>
    </main>
  );
}
