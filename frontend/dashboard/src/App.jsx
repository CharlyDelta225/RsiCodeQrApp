import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import OuvriersPage from "./pages/OuvriersPage.jsx";
import ComingSoonPage from "./pages/ComingSoonPage.jsx";
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
        <Route path="/badges" element={<ComingSoonPage label="Badges QR" />} />
        <Route path="/pointages" element={<ComingSoonPage label="Pointages du jour" />} />
        <Route path="/historique" element={<ComingSoonPage label="Historique" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
