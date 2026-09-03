import { C } from "../theme";

function initials(email) {
  if (!email) return "?";
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

export default function TopBar({ title, subtitle, onMenuToggle, admin }) {
  return (
    <header className="flex items-center gap-2 bg-white border-b border-red-100/60 px-3 md:px-4 py-3 flex-shrink-0 min-w-0">
      {/* hamburger — visible seulement sur mobile (tablette+ a la sidebar icônes) */}
      <button
        onClick={onMenuToggle}
        className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
      >
        <span className="block w-4 h-0.5 bg-gray-700 rounded" />
        <span className="block w-4 h-0.5 bg-gray-700 rounded" />
        <span className="block w-4 h-0.5 bg-gray-700 rounded" />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-sm md:text-base font-bold text-gray-900 truncate" style={{ fontFamily: "Poppins,sans-serif" }}>
          {title}
        </h1>
        {subtitle && <p className="text-[10px] text-gray-400 hidden sm:block truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: C.btn }}
        >
          {initials(admin?.email)}
        </div>
      </div>
    </header>
  );
}
