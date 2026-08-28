import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Clock, ExternalLink, Loader2, Play } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getRecipeBook, getRecipeMediaUrl, getRecipeMediaVariants, type BookRecipe, type RecipeBookSummary } from '@/services/betaCatalog';
import RecipeArtwork from '@/components/RecipeArtwork';

export default function RecipeBookDetail() {
  const { id } = useParams();
  const [book, setBook] = useState<RecipeBookSummary | null>(null);
  const [recipes, setRecipes] = useState<BookRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getRecipeBook(id).then(result => { setBook(result.book); setRecipes(result.recipes); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!book) return <main className="p-8 text-center">Recipe book not found.</main>;

  return (
    <main className="p-4 md:px-8 md:py-10 pb-28 md:pb-8 max-w-5xl mx-auto">
      <Button asChild variant="ghost" className="mb-5"><Link to="/recipe-books"><ArrowLeft className="w-4 h-4 mr-2" />Recipe shelf</Link></Button>
      <section className="grid md:grid-cols-[260px_1fr] gap-7 mb-10">
        <div className="aspect-[4/3] md:aspect-[3/4] rounded-2xl bg-muted overflow-hidden flex items-center justify-center">
          {book.cover_path ? <img src={getRecipeMediaUrl(book.cover_path) ?? ''} alt="" className="w-full h-full object-cover" /> : <span className="text-5xl">📖</span>}
        </div>
        <div className="self-end">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">{book.creators?.verified && <BadgeCheck className="w-4 h-4 text-primary" />}{book.creators?.display_name ?? 'Kitchen Companion'}</div>
          <h1 className="text-4xl font-extrabold font-display">{book.title}</h1>
          {book.subtitle && <p className="text-xl text-muted-foreground mt-2">{book.subtitle}</p>}
          <p className="text-sm leading-6 mt-5">{book.description}</p>
          <p className="text-[10px] uppercase tracking-wider font-bold text-primary mt-5">Included in beta · Content version {book.content_version}</p>
        </div>
      </section>

      <div className="space-y-3">
        {recipes.map(({ recipes: recipe, position, section_title: section }) => (
          <Card key={recipe.id} className="rounded-2xl p-3 md:p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link to={`/recipe/${recipe.id}`} className="shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-32">
                <RecipeArtwork title={recipe.title} image={getRecipeMediaUrl(recipe.image_path)} variants={getRecipeMediaVariants(recipe.image_path)} className="flex aspect-[16/9] h-full w-full items-center justify-center sm:aspect-auto" />
              </Link>
              <div className="min-w-0 flex-1">
                {section && <p className="text-[10px] uppercase tracking-wider font-bold text-primary">{section}</p>}
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {recipe.verification_tier === 'test_kitchen_verified' ? 'Test-kitchen verified' : recipe.verification_tier === 'creator_verified' ? 'Creator verified' : 'Editorially reviewed'}
                  {recipe.source_label ? ` · ${recipe.source_label}` : ''}
                </p>
                <h2 className="text-lg font-extrabold leading-snug">
                  <Link to={`/recipe/${recipe.id}`} className="hover:text-primary">
                    <span className="text-muted-foreground mr-2">{String(position + 1).padStart(2, '0')}</span>{recipe.title}
                  </Link>
                </h2>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{recipe.description}</p>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{recipe.prep_minutes + recipe.cook_minutes} min</span>
                  <span>{recipe.servings} servings</span>
                  <span>{recipe.recipe_ingredients.length} ingredients</span>
                </div>
              </div>
              {recipe.youtube_url && (
                <Button asChild variant="outline" size="sm" className="shrink-0 rounded-xl"><a href={recipe.youtube_url} target="_blank" rel="noreferrer"><Play className="w-3.5 h-3.5 mr-1" />Watch<ExternalLink className="w-3 h-3 ml-1" /></a></Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
