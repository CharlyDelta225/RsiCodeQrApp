import { Link, NavLink, useLocation } from "react-router-dom";
import { LogOut, X } from "lucide-react";
import { C, navItems } from "../theme";
import { roleAdmin, libelleRole } from "../lib/auth";
import Logo from "./Logo";

// Tolérance des menus par rôle (hiérarchie) : SUPER_ADMIN voit tout, ADMIN
// voit les pages ADMIN+, LECTEUR ne voit que les pages de lecture.
const HIERARCHIE = { LECTEUR: 0, ADMIN: 1, SUPER_ADMIN: 2 };

function voirMenu(item) {
  if (!item.minRole) return true;
  return (HIERARCHIE[roleAdmin()] ?? 0) >= HIERARCHIE[item.minRole];
}

// Recalculé à chaque rendu (le rôle vit dans localStorage et change au login).
function navAutorises() {
  return navItems.filter(voirMenu);
}

function initials(email) {
  if (!email) return "?";
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

const GROUPS = [
  { key: "pilotage", label: "Pilotage", paths: ["/", "/pointages", "/historique", "/rapports"] },
  { key: "gestion", label: "Gestion", paths: ["/ouvriers", "/badges", "/badges/atelier", "/departements", "/gestion-departements", "/migration-ouvrier"] },
  { key: "admin", label: "Administration", paths: ["/gestion-admins"] },
];

function getGroup(path) {
  for (const group of GROUPS) {
    if (group.paths.some((p) => (p === "/" ? path === "/" : path.startsWith(p) && p !== "/"))) return group.key;
    if (group.paths.includes(path)) {
      if (path === "/" && group.key === "pilotage") return group.key;
    }
  }
  if (path === "/") return "pilotage";
  if (path.startsWith("/badges")) return "gestion";
  if (path.startsWith("/departements")) return "gestion";
  if (path.startsWith("/ouvriers")) return "gestion";
  if (path.startsWith("/pointages") || path.startsWith("/historique") || path.startsWith("/rapports")) return "pilotage";
  if (path.startsWith("/gestion-admins")) return "admin";
  if (path.startsWith("/migration")) return "gestion";
  return null;
}

function NavButton({ item, onNavigate, iconOnly }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        iconOnly
          ? `w-full relative flex items-center justify-center py-2.5 rounded-lg transition-all duration-150 ${
              isActive ? "text-white" : "text-white/80 hover:text-white hover:bg-white/10"
            }`
          : `w-full relative flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-150 ${
              isActive ? "text-white font-semibold" : "text-white/85 hover:text-white hover:bg-white/10"
            }`
      }
      title={iconOnly ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full" style={{ background: "linear-gradient(180deg,#F5D16E 0%,#D4A017 100%)" }} />}
          <span className={iconOnly ? "leading-none" : "w-5 flex justify-center flex-shrink-0"}>
            <item.icon size={18} aria-hidden="true" />
          </span>
          {!iconOnly && (
            <span className="text-xs truncate" style={{ fontFamily: "Poppins,sans-serif" }}>
              {item.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/** Contenu complet (logo + nav + utilisateur) — utilisé par la sidebar desktop et le drawer mobile. */
function SidebarContent({ admin, onClose, onDeconnexion }) {
  const location = useLocation();
  const items = navAutorises();
  const grouped = GROUPS.map((g) => ({
    ...g,
    items: items.filter((it) => getGroup(it.path) === g.key),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Logo className="w-9 h-9 object-contain rounded-full flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight">RSI</p>
            <p className="text-white/80 text-[10px] leading-tight truncate">Présence — Badgeage QR</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/80 hover:text-white flex-shrink-0 p-1" aria-label="Fermer le menu">
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto min-h-0">
        {grouped.map((group) => (
          <div key={group.key} className="space-y-1">
            <p className="px-2 text-[10px] uppercase tracking-[0.25em] text-white/70">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavButton key={item.path} item={item} onNavigate={onClose} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-white/10 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2 min-w-0 rounded-lg px-2 py-1.5 bg-white/5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ring-1 ring-white/20"
            style={{ background: C.avatar }}
          >
            {initials(admin?.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate">{admin?.email || "…"}</p>
            <p className="text-white/85 text-[10px]">{libelleRole(admin?.role)}</p>
          </div>
          <button
            onClick={onDeconnexion}
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="text-[10px] flex flex-wrap gap-x-3 px-1">
          <Link to="/confidentialite" className="text-white/80 hover:text-white transition-colors">
            Confidentialité
          </Link>
          <Link to="/cgv-cgu" className="text-white/80 hover:text-white transition-colors">
            CGU
          </Link>
        </p>
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
          <Logo className="w-8 h-8 object-contain rounded-full" />
        </div>
        <nav className="flex-1 py-2 space-y-0.5 overflow-y-auto px-1.5 min-h-0 mt-2">
          {navAutorises().map((item) => (
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
            aria-label="Se déconnecter"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut size={15} aria-hidden="true" />
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
      <div className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-[1px] z-40" onClick={onClose} />
      <aside
        className="md:hidden fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 flex flex-col animate-in slide-in-from-left duration-200"
        style={{ background: C.sidebar }}
      >
        <SidebarContent admin={admin} onClose={onClose} onDeconnexion={onDeconnexion} />
      </aside>
    </>
  );
}