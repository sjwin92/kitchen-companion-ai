import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, BookOpen, Search } from 'lucide-react';
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
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between mb-9">
        <div>
          <p className="section-title mb-2">Recipe books</p>
          <h1 className="max-w-3xl text-3xl font-extrabold tracking-[-0.035em] md:text-5xl">A shelf that cooks with you</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">Collect trusted recipe packs from Kitchen Companion and selected creators. Every dish can move straight into your weekly plan and shopping list.</p>
        </div>
        <Button asChild variant="outline" className="gap-2 shrink-0 rounded-xl"><Link to="/meals"><Search className="w-4 h-4" />Discover recipes</Link></Button>
      </div>

      {loading && <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(item => <div key={item} className="h-[440px] animate-pulse rounded-2xl bg-muted/60" />)}</div>}
      {error && <Card className="p-5 text-sm text-destructive">{error}</Card>}
      {!loading && !error && books.length === 0 && (
        <Card className="flex items-start gap-3 rounded-2xl p-6">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="text-lg font-bold">The recipe shelf is temporarily unavailable</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">The reviewed 200-recipe catalogue is still available from Discover recipes. Refresh this page to reload its collections.</p>
            <Button asChild className="mt-4 rounded-xl"><Link to="/meals">Browse all recipes</Link></Button>
          </div>
        </Card>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {books.map(book => (
          <Link key={book.id} to={`/recipe-books/${book.id}`} className="group">
            <Card className="overflow-hidden h-full rounded-2xl transition-all group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-card-hover)]">
              <div className="relative aspect-[4/3] bg-[#cbd8c4] flex items-center justify-center overflow-hidden">
                {book.cover_path ? <img src={getRecipeMediaUrl(book.cover_path) ?? ''} alt={book.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" /> : <span className="text-5xl" aria-hidden="true">📖</span>}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  {book.creators?.verified && <BadgeCheck className="w-3.5 h-3.5 text-primary" />}
                  <span>{book.creators?.display_name ?? 'Kitchen Companion'}</span>
                </div>
                <h2 className="font-bold text-xl">{book.title}</h2>
                {book.subtitle && <p className="text-sm text-muted-foreground mt-1">{book.subtitle}</p>}
                <p className="mt-5 flex items-center gap-1 text-xs font-bold text-primary">Open collection <ArrowRight className="h-3.5 w-3.5" /></p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
