import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar, MobileDrawer, BottomNav } from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { pageTitles } from "../theme";
import { getAdmin } from "../lib/auth";

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const admin = getAdmin();

  const { title, subtitle } = pageTitles[location.pathname] || { title: "RsiCodeQrApp" };

  return (
    // 100svh : évite que la barre d'adresse mobile ne pousse le contenu.
    <div className="flex overflow-hidden" style={{ height: "100svh" }}>
      <Sidebar admin={admin} />

      {drawerOpen && <MobileDrawer admin={admin} onClose={() => setDrawerOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar title={title} subtitle={subtitle} admin={admin} onMenuToggle={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto min-h-0 pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
