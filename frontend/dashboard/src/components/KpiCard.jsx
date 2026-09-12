/**
 * Carte KPI — accents harmonisés sur l'identité RSI (bordeaux total, or actifs,
 * vert sémantique présents, neutre absents, bleu départements).
 * `onClick` rend la carte cliquable avec une élévation discrète.
 */
export default function KpiCard({ label, value, sub, accent = "bordeaux", icon, onClick }) {
  const accents = {
    bordeaux: { sub: "bg-bordeaux-50 text-bordeaux-700", pastille: "#B23A2B" },
    gold: { sub: "bg-gold-50 text-gold-800", pastille: "#D4A017" },
    vert: { sub: "bg-emerald-50 text-emerald-700", pastille: "#059669" },
    gris: { sub: "bg-slate-100 text-slate-600", pastille: "#64748b" },
    bleu: { sub: "bg-sky-50 text-sky-700", pastille: "#0369a1" },
  };
  const a = accents[accent] || accents.bordeaux;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group bg-white rounded-xl p-3 border transition text-left min-w-0 ${
        onClick
          ? "border-bordeaux-100 hover:border-bordeaux-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
          : "border-bordeaux-50 cursor-default"
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-2">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: `${a.pastille}1A`, color: a.pastille }}
        >
          {icon}
        </span>
        {onClick && (
          <span className="text-xs text-slate-300 group-hover:text-bordeaux-500 transition-colors flex-shrink-0">
            →
          </span>
        )}
      </div>
      <p
        className="text-xl font-bold text-bordeaux-900 mb-1 truncate tabular-nums"
        style={{ fontFamily: "Poppins,sans-serif" }}
      >
        {value}
      </p>
      <div className="flex items-center gap-1.5 min-w-0">
        <p className="text-[11px] text-slate-500 leading-tight truncate">{label}</p>
        {!onClick && sub && (
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${a.sub}`}>
            {sub}
          </span>
        )}
      </div>
    </button>
  );
}