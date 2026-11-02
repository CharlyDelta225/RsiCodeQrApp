import { Calendar, LogOut } from "lucide-react";
import { C } from "../theme";

function initials(admin) {
  const complet = [admin?.prenom, admin?.nom].filter(Boolean).join(" ").trim();
  const base = complet || admin?.email?.split("@")[0] || "";
  if (!base) return "?";
  const mots = base.split(/\s+/).filter(Boolean);
  if (mots.length >= 2) {
    return `${mots[0].charAt(0)}${mots[1].charAt(0)}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

export default function TopBar({ title, subtitle, onMenuToggle, onDeconnexion, admin }) {
  const dateJour = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="app-topbar flex items-center gap-2 bg-white/95 backdrop-blur border-b border-red-100/60 px-3 md:px-4 py-2.5 flex-shrink-0 min-w-0">
      {/* hamburger — visible seulement sur mobile */}
      <button
        onClick={onMenuToggle}
        className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
        aria-label="Ouvrir le menu"
      >
        <span className="block w-4 h-0.5 bg-gray-700 rounded" />
        <span className="block w-4 h-0.5 bg-gray-700 rounded" />
        <span className="block w-4 h-0.5 bg-gray-700 rounded" />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-sm md:text-base font-semibold text-slate-900 truncate" style={{ fontFamily: "Poppins,sans-serif" }}>
          {title}
        </h1>
        {subtitle && <p className="text-[10px] text-slate-500 hidden sm:block truncate">{subtitle}</p>}
      </div>

      {/* Date : affichée une seule fois, ici (la page ne la répète plus). */}
      <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
        <Calendar size={14} aria-hidden="true" />
        <span>{dateJour}</span>
      </div>

      {/* Compte : uniquement sur mobile — dès md, la sidebar (ou le tiroir) affiche
          déjà l'email, le rôle et la déconnexion. */}
      <div className="flex md:hidden items-center gap-2 flex-shrink-0 pl-2 border-l border-slate-100">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ring-1 ring-white/40 shadow-sm"
          style={{ background: C.btn }}
          aria-hidden="true"
        >
          {initials(admin)}
        </div>
        <button
          onClick={onDeconnexion}
          title="Se déconnecter"
          aria-label="Se déconnecter"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-bordeaux-700 hover:bg-bordeaux-50 transition-colors flex-shrink-0"
        >
          <LogOut size={16} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
