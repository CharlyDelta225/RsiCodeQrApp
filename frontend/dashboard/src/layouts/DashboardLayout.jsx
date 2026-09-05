import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar, MobileDrawer, BottomNav } from "../components/Sidebar";
import TopBar from "../components/TopBar";
import ConfirmDialog from "../components/ConfirmDialog";
import { pageTitles } from "../theme";
import { getAdmin, logout, startInactivityWatcher, stopInactivityWatcher } from "../lib/auth";

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmerDeconnexion, setConfirmerDeconnexion] = useState(false);
  const location = useLocation();
  const admin = getAdmin();
  const { title, subtitle } = pageTitles[location.pathname] || { title: "RsiCodeQrApp" };

  // Déconnexion auto après 10 min d'inactivité
  useEffect(() => {
    startInactivityWatcher();
    return () => stopInactivityWatcher();
  }, []);

  return (
    // 100svh : évite que la barre d'adresse mobile ne pousse le contenu.
    <div className="flex overflow-hidden" style={{ height: "100svh" }}>
      <Sidebar admin={admin} onDeconnexion={() => setConfirmerDeconnexion(true)} />
      {drawerOpen && (
        <MobileDrawer
          admin={admin}
          onClose={() => setDrawerOpen(false)}
          onDeconnexion={() => setConfirmerDeconnexion(true)}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          title={title}
          subtitle={subtitle}
          admin={admin}
          onMenuToggle={() => setDrawerOpen(true)}
          onDeconnexion={() => setConfirmerDeconnexion(true)}
        />
        <main className="flex-1 overflow-y-auto min-h-0 pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <ConfirmDialog
        ouvert={confirmerDeconnexion}
        titre="Se déconnecter ?"
        message="Vous serez redirigé vers la page de connexion. Aucune donnée ne sera perdue."
        bouton="Se déconnecter"
        surAnnuler={() => setConfirmerDeconnexion(false)}
        surConfirmer={() => {
          setConfirmerDeconnexion(false);
          logout();
        }}
      />
    </div>
  );
}