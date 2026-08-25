import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChefHat, Loader2, Sparkles, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getRecipeMediaUrl, listRecipeBooks, type RecipeBookSummary } from '@/services/betaCatalog';

export default function RecipeBooks() {
  const [books, setBooks] = useState<RecipeBookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRecipeBooks().then(setBooks).catch(() => setError('Recipe books could not be loaded.')).finally(() => setLoading(false));
  }, []);

  return (
    <main className="p-4 md:px-8 md:py-10 pb-28 md:pb-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="section-title mb-2">Your recipe shelf</p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display">Recipe books that plan with you</h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl">Collect trusted recipes from Kitchen Companion and selected creators. Every recipe can feed your meal plan, shopping list and nutrition guidance.</p>
        </div>
        <Button asChild variant="outline" className="gap-2 shrink-0"><Link to="/meals"><Sparkles className="w-4 h-4" />Smart picks</Link></Button>
      </div>

      {loading && <div className="min-h-52 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
      {error && <Card className="p-5 text-sm text-destructive">{error}</Card>}
      {!loading && !error && books.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <BookOpen className="w-10 h-10 text-primary/50 mx-auto mb-3" />
          <h2 className="font-bold text-lg">The first collection is being reviewed</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">Only reviewed, original recipes appear here. AI-created and community recipes remain private until an editor approves them.</p>
        </Card>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {books.map(book => (
          <Link key={book.id} to={`/recipe-books/${book.id}`} className="group">
            <Card className="overflow-hidden h-full transition-transform group-hover:-translate-y-1">
              <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                {book.cover_path ? <img src={getRecipeMediaUrl(book.cover_path) ?? ''} alt="" className="w-full h-full object-cover" /> : <ChefHat className="w-10 h-10 text-muted-foreground/30" />}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  {book.creators?.verified && <BadgeCheck className="w-3.5 h-3.5 text-primary" />}
                  <span>{book.creators?.display_name ?? 'Kitchen Companion'}</span>
                </div>
                <h2 className="font-bold text-xl">{book.title}</h2>
                {book.subtitle && <p className="text-sm text-muted-foreground mt-1">{book.subtitle}</p>}
                <p className="text-[10px] uppercase tracking-wider font-bold text-primary mt-4">Included in beta · Edition {book.content_version}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
