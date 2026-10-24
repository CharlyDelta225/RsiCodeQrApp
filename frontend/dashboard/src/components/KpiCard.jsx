import { ArrowRight } from "lucide-react";

/**
 * Carte KPI — accents harmonisés sur l'identité RSI.
 * `onClick` rend la carte cliquable avec une élévation discrète.
 */
export default function KpiCard({ label, value, sub, accent = "bordeaux", icon, onClick }) {
  const accents = {
    bordeaux: { sub: "bg-bordeaux-50 text-bordeaux-700", pastille: "#B23A2B", bg: "bg-bordeaux-50/60" },
    gold: { sub: "bg-gold-50 text-gold-800", pastille: "#D4A017", bg: "bg-gold-50/60" },
    vert: { sub: "bg-emerald-50 text-emerald-700", pastille: "#059669", bg: "bg-emerald-50/60" },
    gris: { sub: "bg-slate-100 text-slate-600", pastille: "#64748b", bg: "bg-slate-50" },
    bleu: { sub: "bg-amber-50 text-amber-800", pastille: "#B45309", bg: "bg-amber-50/60" },
  };
  const a = accents[accent] || accents.bordeaux;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group relative overflow-hidden bg-white rounded-xl p-4 border transition text-left min-w-0 ${
        onClick
          ? "border-bordeaux-100 hover:border-bordeaux-300 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
          : "border-slate-200 cursor-default"
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${a.bg}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{label}</p>
          <p
            className="text-3xl font-semibold text-bordeaux-900 mb-1 truncate tabular-nums"
            style={{ fontFamily: "Poppins,sans-serif" }}
          >
            {value}
          </p>
          {sub && (
            <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.sub}`}>
              {sub}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-1 ring-black/5"
            style={{ background: `${a.pastille}1A`, color: a.pastille }}
          >
            {icon}
          </span>
          {onClick && (
            <span className="text-slate-300 group-hover:text-bordeaux-500 transition-colors flex-shrink-0">
              <ArrowRight size={14} aria-hidden="true" />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}