import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppShell from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";
import BidUploadPage from "./pages/BidUploadPage";
import BidManagementPage from "./pages/BidManagementPage";
import BidDetailPage from "./pages/BidDetailPage";
import BidPreparationPage from "./pages/BidPreparationPage";
import SubcontractorsPage from "./pages/SubcontractorsPage";
import MarketIntelPage from "./pages/MarketIntelPage";
import PromptManagementPage from "./pages/PromptManagementPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/bids" element={<BidManagementPage />} />
            <Route path="/upload" element={<BidUploadPage />} />
            <Route path="/bid/:bidId" element={<BidDetailPage />} />
            <Route path="/bid/:bidId/preparation" element={<BidPreparationPage />} />
            <Route path="/subcontractors" element={<SubcontractorsPage />} />
            <Route path="/market" element={<MarketIntelPage />} />
            <Route path="/prompts" element={<PromptManagementPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
