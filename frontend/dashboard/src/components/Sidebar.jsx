import { NavLink } from "react-router-dom";
import { C, navItems } from "../theme";
import rsiLogo from "../assets/rsi-logo.png";

function initials(email) {
  if (!email) return "?";
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

function NavButton({ item, onNavigate, iconOnly }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        iconOnly
          ? `w-full flex items-center justify-center py-3 rounded-lg transition-all duration-150 ${
              isActive ? "text-white shadow-lg" : "text-white/60 hover:text-white hover:bg-white/10"
            }`
          : `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 ${
              isActive ? "text-white font-semibold shadow-lg" : "text-white/60 hover:text-white hover:bg-white/10"
            }`
      }
      style={({ isActive }) => (isActive ? { background: C.btn } : {})}
      title={iconOnly ? item.label : undefined}
    >
      <span className={iconOnly ? "text-base leading-none" : "text-sm w-5 text-center flex-shrink-0"}>
        {item.icon}
      </span>
      {!iconOnly && (
        <span className="text-xs truncate" style={{ fontFamily: "Poppins,sans-serif" }}>
          {item.label}
        </span>
      )}
    </NavLink>
  );
}

/** Contenu complet (logo + nav + utilisateur) — utilisé par la sidebar desktop et le drawer mobile. */
function SidebarContent({ admin, onClose, onDeconnexion }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <img src={rsiLogo} alt="RSI" className="w-9 h-9 object-contain rounded-full flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight">RSI</p>
            <p className="text-white/50 text-[10px] leading-tight truncate">Présence — Badgeage QR</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/60 hover:text-white text-lg leading-none flex-shrink-0 p-1">
            ✕
          </button>
        )}
      </div>

      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto min-h-0">
        {navItems.map((item) => (
          <NavButton key={item.path} item={item} onNavigate={onClose} />
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: C.avatar }}
          >
            {initials(admin?.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate">{admin?.email || "…"}</p>
            <p className="text-white/50 text-[10px]">Administrateur</p>
          </div>
          <button
            onClick={onDeconnexion}
            title="Se déconnecter"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <span className="text-sm leading-none">⏻</span>
          </button>
        </div>
      </div>
    </>
  );
}

/** Sidebar fixe : icônes seules sur tablette (md→lg), complète sur desktop (lg+). */
export function Sidebar({ admin, onDeconnexion }) {
  return (
    <>
      <aside className="hidden md:flex lg:hidden flex-col h-full w-14 flex-shrink-0" style={{ background: C.sidebar }}>
        <div className="flex items-center justify-center pt-4 pb-3 border-b border-white/10 flex-shrink-0">
          <img src={rsiLogo} alt="RSI" className="w-8 h-8 object-contain rounded-full" />
        </div>
        <nav className="flex-1 py-2 space-y-0.5 overflow-y-auto px-1.5 min-h-0 mt-2">
          {navItems.map((item) => (
            <NavButton key={item.path} item={item} iconOnly />
          ))}
        </nav>
        <div className="py-3 border-t border-white/10 flex flex-col items-center gap-2 flex-shrink-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: C.avatar }}
          >
            {initials(admin?.email)}
          </div>
          <button
            onClick={onDeconnexion}
            title="Se déconnecter"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="text-sm leading-none">⏻</span>
          </button>
        </div>
      </aside>

      <aside className="hidden lg:flex flex-col h-full w-56 flex-shrink-0" style={{ background: C.sidebar }}>
        <SidebarContent admin={admin} onDeconnexion={onDeconnexion} />
      </aside>
    </>
  );
}

/** Tiroir plein écran (mobile), ouvert via le bouton hamburger de la TopBar. */
export function MobileDrawer({ admin, onClose, onDeconnexion }) {
  return (
    <>
      <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside
        className="md:hidden fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 flex flex-col"
        style={{ background: C.sidebar }}
      >
        <SidebarContent admin={admin} onClose={onClose} onDeconnexion={onDeconnexion} />
      </aside>
    </>
  );
}

/** Navigation basse (mobile uniquement). */
export function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-red-900/30"
      style={{ background: C.sidebarFooter, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === "/"}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] transition-colors min-w-0 ${
              isActive ? "text-yellow-300" : "text-white/50"
            }`
          }
        >
          <span className="text-sm leading-none">{item.icon}</span>
          <span
            className="text-[8px] leading-tight font-medium truncate w-full text-center px-0.5"
            style={{ fontFamily: "Poppins,sans-serif" }}
          >
            {item.short}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}