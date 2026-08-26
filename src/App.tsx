import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/context/AppContext";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import { AlertTriangle, Loader2 } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";

// Lazy-loaded routes — cut initial bundle size
const Inventory = lazy(() => import("@/pages/Inventory"));
const AddFood = lazy(() => import("@/pages/AddFood"));
const BarcodeScanner = lazy(() => import("@/pages/BarcodeScanner"));
const UseSoon = lazy(() => import("@/pages/UseSoon"));
const MealSuggestions = lazy(() => import("@/pages/MealSuggestions"));
const RecipeDetail = lazy(() => import("@/pages/RecipeDetail"));
const MissingIngredients = lazy(() => import("@/pages/MissingIngredients"));
const SavedLists = lazy(() => import("@/pages/SavedLists"));
const ShoppingList = lazy(() => import("@/pages/ShoppingList"));
const Settings = lazy(() => import("@/pages/Settings"));
const WasteTracker = lazy(() => import("@/pages/WasteTracker"));
const Favorites = lazy(() => import("@/pages/Favorites"));
const MealPlanner = lazy(() => import("@/pages/MealPlanner"));
const MealLog = lazy(() => import("@/pages/MealLog"));
const MealHistory = lazy(() => import("@/pages/MealHistory"));
const RecordOutcome = lazy(() => import("@/pages/RecordOutcome"));
const WeeklyInsights = lazy(() => import("@/pages/WeeklyInsights"));
const RecipeBooks = lazy(() => import("@/pages/RecipeBooks"));
const RecipeBookDetail = lazy(() => import("@/pages/RecipeBookDetail"));
const CatalogueReview = lazy(() => import("@/pages/CatalogueReview"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
}

function AppContent() {
  const { preferences, session, loading, profileError, retryProfile, signOut } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (window.location.pathname.endsWith("/reset-password")) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <ResetPassword />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Your profile did not load</h1>
          <p className="text-sm text-muted-foreground">{profileError}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={retryProfile}>Retry</Button>
            <Button variant="outline" onClick={() => void signOut()}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!preferences.onboardingComplete) {
    return <Onboarding />;
  }

  return (
    <>
      <TopNav />
      <div className="md:pt-14">
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/add-food" element={<AddFood />} />
              <Route path="/barcode" element={<BarcodeScanner />} />
              <Route path="/use-soon" element={<UseSoon />} />
              <Route path="/meals" element={<MealSuggestions />} />
              <Route path="/recipe-books" element={<RecipeBooks />} />
              <Route path="/recipe-books/:id" element={<RecipeBookDetail />} />
              <Route path="/admin/catalogue" element={<CatalogueReview />} />
              <Route path="/recipe/:id" element={<RecipeDetail />} />
              <Route path="/missing/:id" element={<MissingIngredients />} />
              <Route path="/saved-lists" element={<SavedLists />} />
              <Route path="/shopping-list" element={<ShoppingList />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/waste" element={<WasteTracker />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/meal-planner" element={<MealPlanner />} />
              <Route path="/meal-log" element={<MealLog />} />
              <Route path="/meal-history" element={<MealHistory />} />
              <Route path="/record" element={<RecordOutcome />} />
              <Route path="/weekly-insights" element={<WeeklyInsights />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
      <BottomNav />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
