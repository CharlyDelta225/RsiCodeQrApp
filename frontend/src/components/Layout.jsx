import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getAdmin } from "../lib/auth";
import rsiLogo from "../assets/rsi-logo.png";

const NAV_ITEMS = [
  { to: "/", label: "Tableau de bord", icon: "⊞" },
  { to: "/ouvriers", label: "Ouvriers", icon: "👤" },
  { to: "/pointages", label: "Historique", icon: "⊡", bientot: true },
  { to: "/parametres", label: "Paramètres", icon: "⚙", bientot: true },
];

const SIDEBAR_BG = "linear-gradient(180deg,#5A0A0A 0%,#7B1515 60%,#8B1A1A 100%)";

export default function Layout({ children, title }) {
  const location = useLocation();
  const navigate = useNavigate();
  const admin = getAdmin();

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen bg-red-50/30">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col h-full w-56 flex-shrink-0" style={{ background: SIDEBAR_BG }}>
        <div className="flex items-center gap-2 px-4 pt-5 pb-4 border-b border-white/10">
          <img src={rsiLogo} alt="RSI" className="w-9 h-9 object-contain rounded-full flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight">RSI</p>
            <p className="text-white/50 text-[10px] leading-tight truncate">Badge Présence</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.bientot ? "#" : item.to}
                onClick={(e) => item.bientot && e.preventDefault()}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                  active ? "text-white font-semibold shadow-lg bg-white/10" : "text-white/60 hover:text-white hover:bg-white/10"
                } ${item.bientot ? "opacity-40 cursor-not-allowed" : ""}`}
                style={{ fontFamily: "Poppins,sans-serif" }}
              >
                <span className="text-sm w-5 text-center flex-shrink-0">{item.icon}</span>
                <span className="text-xs truncate">{item.label}</span>
                {item.bientot && <span className="text-[9px] ml-auto">bientôt</span>}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/10">
          <div className="flex items-center gap-2 min-w-0 mb-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {admin?.email?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{admin?.email}</p>
              <p className="text-white/50 text-[10px]">{admin?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-white/60 hover:text-white text-xs">
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-2 bg-white border-b border-red-100/60 px-4 py-3 flex-shrink-0">
          <h1 className="text-base font-bold text-gray-900" style={{ fontFamily: "Poppins,sans-serif" }}>
            {title}
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
