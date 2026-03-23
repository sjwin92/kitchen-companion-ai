import { useNavigate } from 'react-router-dom';
import { useFavorites } from '@/hooks/useFavorites';
import { Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Favorites() {
  const navigate = useNavigate();
  const { favorites, loading } = useFavorites();

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Favorites</h1>
        <p className="text-sm text-muted-foreground">Your saved recipes</p>
      </div>

      {loading && (
        <div className="glass-card p-6 text-center text-sm text-muted-foreground shimmer">
          Loading favorites...
        </div>
      )}

      {!loading && favorites.length === 0 && (
        <div className="glass-card p-8 text-center space-y-3">
          <Heart className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No favorites yet</p>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate('/meals')}>
            Browse Meals
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {favorites.map((fav, i) => (
          <button
            key={fav.id}
            className="glass-card overflow-hidden w-full text-left animate-fade-in"
            style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}
            onClick={() => navigate(`/recipe/${fav.recipe_id}`)}
          >
            <div className="flex items-center gap-3">
              {fav.image && (
                <img src={fav.image} alt={fav.title} className="w-20 h-20 object-cover shrink-0" loading="lazy" />
              )}
              <div className="flex-1 min-w-0 p-3">
                <h3 className="font-semibold text-sm leading-tight truncate">{fav.title}</h3>
                {fav.category && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground mt-1 inline-block">
                    {fav.category}
                  </span>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mr-3" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
