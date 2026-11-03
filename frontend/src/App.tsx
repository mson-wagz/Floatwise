import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./i18n";
import AppShell from "./components/AppShell";
import RequireAuth from "./components/RequireAuth";
import { getToken } from "./auth";
import ChatPage from "./pages/ChatPage";
import AddDataPage from "./pages/AddDataPage";
import ForecastPage from "./pages/ForecastPage";
import WhatIfPage from "./pages/WhatIfPage";
import ReplayPage from "./pages/ReplayPage";
import MatchesPage from "./pages/MatchesPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

const qc = new QueryClient();

// Logged-in users skip the landing page.
function Home() {
  return getToken() ? <Navigate to="/chat" replace /> : <LandingPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          {/* public: no shop fetch, no token needed */}
          <Route index element={<Home />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />

          {/* private: only reached with a token */}
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="add" element={<AddDataPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="forecast" element={<ForecastPage />} />
              <Route path="whatif" element={<WhatIfPage />} />
              <Route path="replay" element={<ReplayPage />} />
              <Route path="matches" element={<MatchesPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}