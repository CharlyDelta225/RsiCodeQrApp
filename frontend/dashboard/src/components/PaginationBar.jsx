const BTN_NAV =
  "px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition";
const BTN_NUM =
  "min-w-[28px] px-2 py-1 rounded-full text-xs text-slate-500 border border-slate-200 hover:bg-rose-50 transition";
const BTN_NUM_ACTIF = {
  className: "min-w-[28px] px-2 py-1 rounded-full text-xs font-semibold text-white shadow-sm transition",
  style: { background: "linear-gradient(135deg,#fb7185,#f43f5e)" },
};

export default function PaginationBar({ page, totalPages, onPage, total, label = "élément(s)" }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 text-sm">
      {total !== undefined && (
        <span className="text-xs text-slate-400 mr-2 whitespace-nowrap">
          {total} {label}
        </span>
      )}
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} className={BTN_NAV}>
        ←
      </button>
      {pages.map((p) =>
        p === page ? (
          <button key={p} onClick={() => onPage(p)} className={BTN_NUM_ACTIF.className} style={BTN_NUM_ACTIF.style}>
            {p}
          </button>
        ) : (
          <button key={p} onClick={() => onPage(p)} className={BTN_NUM}>
            {p}
          </button>
        )
      )}
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className={BTN_NAV}>
        →
      </button>
    </div>
  );
}