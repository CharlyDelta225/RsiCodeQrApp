import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import OuvriersPage from "./pages/OuvriersPage.jsx";
import BadgesPage from "./pages/BadgesPage.jsx";
import PointagesJourPage from "./pages/PointagesJourPage.jsx";
import HistoriquePage from "./pages/HistoriquePage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
