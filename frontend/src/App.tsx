import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./i18n";
import AppShell from "./components/AppShell";
import ChatPage from "./pages/ChatPage";
import AddDataPage from "./pages/AddDataPage";
import ForecastPage from "./pages/ForecastPage";
import WhatIfPage from "./pages/WhatIfPage";
import ReplayPage from "./pages/ReplayPage";
import MatchesPage from "./pages/MatchesPage";

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<ChatPage />} />
            <Route path="add" element={<AddDataPage />} />
            <Route path="forecast" element={<ForecastPage />} />
            <Route path="whatif" element={<WhatIfPage />} />
            <Route path="replay" element={<ReplayPage />} />
            <Route path="matches" element={<MatchesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}