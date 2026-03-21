import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/context/AppContext";
import BottomNav from "@/components/BottomNav";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import AddFood from "@/pages/AddFood";
import UseSoon from "@/pages/UseSoon";
import MealSuggestions from "@/pages/MealSuggestions";
import MissingIngredients from "@/pages/MissingIngredients";
import ShoppingList from "@/pages/ShoppingList";
import WasteTracker from "@/pages/WasteTracker";
import BarcodeScanner from "@/pages/BarcodeScanner";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import { Loader2 } from "lucide-react";

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
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/add-food" element={<AddFood />} />
        <Route path="/use-soon" element={<UseSoon />} />
        <Route path="/meals" element={<MealSuggestions />} />
        <Route path="/missing/:id" element={<MissingIngredients />} />
        <Route path="/shopping" element={<ShoppingList />} />
        <Route path="/waste" element={<WasteTracker />} />
        <Route path="/barcode" element={<BarcodeScanner />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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
