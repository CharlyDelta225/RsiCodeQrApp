export default function ConfirmDialog({
  ouvert,
  titre,
  message,
  bouton = "Confirmer",
  enCours = false,
  surAnnuler,
  surConfirmer,
}) {
  if (!ouvert) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 text-rose-500 ring-1 ring-rose-100 flex items-center justify-center text-xl mb-3">
            ⚠
          </div>
          <h2 className="font-semibold text-slate-800 text-sm" style={{ fontFamily: "Poppins,sans-serif" }}>
            {titre}
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{message}</p>
        </div>
        <div className="px-6 pb-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={surAnnuler}
            disabled={enCours}
            className="text-sm font-medium text-slate-600 bg-slate-50 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-full px-5 py-2 transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={surConfirmer}
            disabled={enCours}
            className="text-sm font-medium text-white disabled:opacity-50 rounded-full px-5 py-2 shadow-sm transition"
            style={{ background: "linear-gradient(135deg,#fb7185,#f43f5e)" }}
          >
            {enCours ? "Traitement…" : bouton}
          </button>
        </div>
      </div>
    </div>
  );
}