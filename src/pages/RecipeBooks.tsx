import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, BookOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getRecipeMediaUrl, listRecipeBooks, type RecipeBookSummary } from '@/services/betaCatalog';

const STARTER_COLLECTIONS = [
  { title: 'Plant-Forward Starters', emoji: '🌿', note: 'Everyday breakfasts, lunches and dinners' },
  { title: 'Five-Ingredient Weeknights', emoji: '⏱️', note: 'Low-fuss meals for busy evenings' },
  { title: 'Use It Up', emoji: '🥕', note: 'Flexible recipes built around what needs eating' },
];

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
        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="section-title mb-2">Coming to the beta shelf</p>
              <h2 className="text-xl font-extrabold">Three starter packs are in review</h2>
            </div>
            <span className="hidden rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:block">12 recipes being checked</span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STARTER_COLLECTIONS.map((collection, index) => (
              <article key={collection.title} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-card)]">
                <div className={`relative aspect-[4/3] overflow-hidden p-6 ${index === 0 ? 'bg-[#cbd8c4]' : index === 1 ? 'bg-[#ded1ba]' : 'bg-[#d7c3ad]'}`}>
                  <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full border border-white/40 bg-white/20" />
                  <span className="relative text-5xl" aria-hidden="true">{collection.emoji}</span>
                  <span className="absolute bottom-5 left-6 rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-bold text-[#35463d]">In editorial review</span>
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground">Kitchen Companion Test Kitchen</p>
                  <h3 className="mt-2 text-xl font-extrabold leading-tight">{collection.title}</h3>
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">{collection.note}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-5">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold">Why the shelf is not padded with filler</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Public recipes need cooking, allergen, nutrition and publishing-rights checks. Private generated drafts stay private until a human editor approves them.</p>
            </div>
          </div>
        </section>
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
