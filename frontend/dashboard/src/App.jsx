import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RequireRole from "./components/RequireRole.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import Spinner from "./ui/Spinner.jsx";

const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const InscriptionPage = lazy(() => import("./pages/InscriptionPage.jsx"));
const OubliePage = lazy(() => import("./pages/OubliePage.jsx"));
const ReinitialisationPage = lazy(() => import("./pages/ReinitialisationPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const OuvriersPage = lazy(() => import("./pages/OuvriersPage.jsx"));
const BadgesPage = lazy(() => import("./pages/BadgesPage.jsx"));
const PointagesJourPage = lazy(() => import("./pages/PointagesJourPage.jsx"));
const HistoriquePage = lazy(() => import("./pages/HistoriquePage.jsx"));
const DepartementsPage = lazy(() => import("./pages/DepartementsPage.jsx"));
const GestionDepartementsPage = lazy(() => import("./pages/GestionDepartementsPage.jsx"));
const GestionAdminsPage = lazy(() => import("./pages/GestionAdminsPage.jsx"));
const RapportPage = lazy(() => import("./pages/RapportPage.jsx"));

function PageChargement() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#FDF6F0]">
      <Spinner />
      <p className="text-xs text-slate-400">Chargement…</p>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageChargement />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/inscription" element={<InscriptionPage />} />
        <Route path="/oublie" element={<OubliePage />} />
        <Route path="/reinitialisation" element={<ReinitialisationPage />} />

        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/ouvriers" element={<OuvriersPage />} />
          <Route path="/badges" element={<BadgesPage />} />
          <Route path="/pointages" element={<PointagesJourPage />} />
          <Route path="/historique" element={<HistoriquePage />} />
          <Route path="/departements" element={<DepartementsPage />} />
          <Route
            path="/gestion-departements"
            element={
              <RequireRole roles={["ADMIN", "SUPER_ADMIN"]}>
                <GestionDepartementsPage />
              </RequireRole>
            }
          />
          <Route path="/rapports" element={<RapportPage />} />
          <Route
            path="/gestion-admins"
            element={
              <RequireRole roles={["SUPER_ADMIN"]}>
                <GestionAdminsPage />
              </RequireRole>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}