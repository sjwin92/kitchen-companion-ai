import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '@/hooks/useFavorites';
import { useStapleMeals } from '@/hooks/useStapleMeals';
import { Heart, ArrowRight, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Tab = 'favorites' | 'staples';

export default function Favorites() {
  const navigate = useNavigate();
  const { favorites, loading: favLoading } = useFavorites();
  const { staples, loading: stapleLoading } = useStapleMeals();
  const [tab, setTab] = useState<Tab>('favorites');

  const loading = tab === 'favorites' ? favLoading : stapleLoading;
  const items = tab === 'favorites'
    ? favorites.map(f => ({ id: f.id, recipe_id: f.recipe_id, title: f.title, image: f.image, category: f.category, extra: null }))
    : staples.map(s => ({ id: s.id, recipe_id: s.recipe_id, title: s.title, image: s.image, category: s.category, extra: s.meal_slot }));

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Saved</h1>
        <p className="text-sm text-muted-foreground">Your favorites & staples</p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('favorites')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'favorites' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <Heart className="w-3.5 h-3.5" /> Favorites ({favorites.length})
        </button>
        <button
          onClick={() => setTab('staples')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'staples' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <Pin className="w-3.5 h-3.5" /> Staples ({staples.length})
        </button>
      </div>

      {loading && (
        <div className="glass-card p-6 text-center text-sm text-muted-foreground shimmer">
          Loading...
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="glass-card p-8 text-center space-y-3">
          {tab === 'favorites' ? (
            <>
              <Heart className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No favorites yet</p>
            </>
          ) : (
            <>
              <Pin className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No staple meals yet</p>
              <p className="text-xs text-muted-foreground">Mark meals you cook regularly as staples from any recipe page</p>
            </>
          )}
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate('/meals')}>
            Browse Meals
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item, i) => (
          <button
            key={item.id}
            className="glass-card overflow-hidden w-full text-left animate-fade-in"
            style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}
            onClick={() => navigate(`/recipe/${item.recipe_id}`)}
          >
            <div className="flex items-center gap-3">
              {item.image && (
                <img src={item.image} alt={item.title} className="w-20 h-20 object-cover shrink-0" loading="lazy" />
              )}
              <div className="flex-1 min-w-0 p-3">
                <h3 className="font-semibold text-sm leading-tight truncate">{item.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {item.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">
                      {item.category}
                    </span>
                  )}
                  {item.extra && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                      {item.extra}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mr-3" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
