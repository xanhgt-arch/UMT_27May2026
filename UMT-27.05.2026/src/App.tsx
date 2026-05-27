import { lazy, Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { AppShell } from "@/components/layout/AppShell";
import { routePreloaders } from "@/lib/route-preload";

const HomePage = lazy(routePreloaders["/"]);
const ReportsPage = lazy(routePreloaders["/reports"]);
const SessionsPage = lazy(routePreloaders["/sessions"]);
const VdiUsersPage = lazy(routePreloaders["/vdi"]);
const DomainsPage = lazy(routePreloaders["/domains"]);
const NotFoundPage = lazy(routePreloaders["*"]);

export function App() {
  return (
    <HashRouter>
      <Suspense fallback={<AppLoadingScreen />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/vdi" element={<VdiUsersPage />} />
            <Route path="/domains" element={<DomainsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default App;
