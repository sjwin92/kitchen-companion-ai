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
import Inventory from "@/pages/Inventory";
import AddFood from "@/pages/AddFood";
import BarcodeScanner from "@/pages/BarcodeScanner";
import UseSoon from "@/pages/UseSoon";
import MealSuggestions from "@/pages/MealSuggestions";
import RecipeDetail from "@/pages/RecipeDetail";
import MissingIngredients from "@/pages/MissingIngredients";
import SavedLists from "@/pages/SavedLists";
import ShoppingList from "@/pages/ShoppingList";

import Settings from "@/pages/Settings";
import WasteTracker from "@/pages/WasteTracker";
import Favorites from "@/pages/Favorites";
import MealPlanner from "@/pages/MealPlanner";
import MealLog from "@/pages/MealLog";
import MealHistory from "@/pages/MealHistory";
import WeeklyInsights from "@/pages/WeeklyInsights";
import NotFound from "@/pages/NotFound";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

function AppContent() {
  const { preferences, session, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (!preferences.onboardingComplete) {
    return <Onboarding />;
  }

  return (
    <>
      <TopNav />
      <div className="md:pt-14">
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/add-food" element={<AddFood />} />
          <Route path="/barcode" element={<BarcodeScanner />} />
          <Route path="/use-soon" element={<UseSoon />} />
          <Route path="/meals" element={<MealSuggestions />} />
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
          <Route path="/weekly-insights" element={<WeeklyInsights />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
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
      <BrowserRouter>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
