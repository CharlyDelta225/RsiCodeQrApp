import { useId } from "react";
import Spinner from "../ui/Spinner";
import Modal from "../ui/Modal";
import { C } from "../theme";

export default function ConfirmDialog({
  ouvert,
  titre,
  message,
  bouton = "Confirmer",
  enCours = false,
  surAnnuler,
  surConfirmer,
}) {
  const idTitre = useId();

  if (!ouvert) return null;

  return (
    <Modal taille="sm" labelledBy={idTitre} onClose={surAnnuler} bloquee={enCours}>
      <div className="px-6 pt-6 pb-4 text-center">
        <div
          aria-hidden="true"
          className="mx-auto w-12 h-12 rounded-full bg-bordeaux-50 text-bordeaux-700 ring-1 ring-bordeaux-100 flex items-center justify-center text-xl mb-3"
        >
          ⚠
        </div>
        <h2
          id={idTitre}
          className="font-semibold text-slate-800 text-sm"
          style={{ fontFamily: "Poppins,sans-serif" }}
        >
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
          style={{ background: C.btn }}
        >
          {enCours ? (
            <span className="inline-flex items-center gap-1.5">
              <Spinner size="xs" light />
              Traitement…
            </span>
          ) : (
            bouton
          )}
        </button>
      </div>
    </Modal>
  );
}