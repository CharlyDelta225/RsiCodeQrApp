import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../lib/api";
import { telechargerBlob } from "../lib/download";
import { libelleDepartement } from "../lib/departement";
import { usePagination } from "../lib/pagination";
import PaginationBar from "../components/PaginationBar";

export default function BadgesPage() {
  const [ouvriers, setOuvriers] = useState([]);
  const [total, setTotal] = useState(0);
  const [recherche, setRecherche] = useState("");
  const [filtreActif, setFiltreActif] = useState("tous"); // tous | actifs | desactives
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [telechargementZip, setTelechargementZip] = useState(false);

  const [badgeUrl, setBadgeUrl] = useState(null);
  const [badgeOuvrier, setBadgeOuvrier] = useState(null);
  const [telechargementUnite, setTelechargementUnite] = useState(false);

  const pagination = usePagination(ouvriers);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const params = { limit: 200 };
      if (recherche) params.recherche = recherche;
      if (filtreActif === "actifs") params.actif = "true";
      if (filtreActif === "desactives") params.actif = "false";
      const data = await api.getOuvriers(params);
      setOuvriers(data.ouvriers);
      setTotal(data.total);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, [recherche, filtreActif]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function handleTelechargerZip() {
    setTelechargementZip(true);
    setErreur(null);
    try {
      const params = {};
      if (filtreActif === "actifs") params.actif = "true";
      if (filtreActif === "desactives") params.actif = "false";
      const blob = await api.getBadgesZipBlob(params);
      const date = new Date().toISOString().slice(0, 10);
      telechargerBlob(blob, `badges-qr-${date}.zip`);
    } catch (err) {
      setErreur(
        err instanceof ApiError
          ? err.code === "AUCUN_OUVRIER"
            ? "Aucun ouvrier ne correspond au filtre sélectionné."
            : err.message
          : "Erreur lors du téléchargement du ZIP"
      );
    } finally {
      setTelechargementZip(false);
    }
  }

  async function handleVoirBadge(ouvrier) {
    setErreur(null);
    try {
      const blob = await api.getOuvrierBadgeBlob(ouvrier.id);
      setBadgeUrl(URL.createObjectURL(blob));
      setBadgeOuvrier(ouvrier);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur lors du chargement du badge");
    }
  }

  async function handleTelechargerUnBadge() {
    if (!badgeOuvrier) return;
    setTelechargementUnite(true);
    try {
      const blob = await api.getOuvrierBadgeBlob(badgeOuvrier.id);
      telechargerBlob(blob, `${badgeOuvrier.matricule}_${badgeOuvrier.nom}_${badgeOuvrier.prenom}.png`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur lors du téléchargement du badge");
    } finally {
      setTelechargementUnite(false);
    }
  }

  function fermerModal() {
    if (badgeUrl) URL.revokeObjectURL(badgeUrl);
    setBadgeUrl(null);
    setBadgeOuvrier(null);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700">{total} badge(s)</h2>
        <button
          onClick={handleTelechargerZip}
          disabled={telechargementZip}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100 disabled:opacity-50 transition"
        >
          {telechargementZip ? "Préparation du ZIP…" : "⬇ Télécharger tous les QR (ZIP)"}
        </button>
      </div>

      {erreur && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erreur}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Rechercher par nom, prénom, département, matricule…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
        <select
          value={filtreActif}
          onChange={(e) => setFiltreActif(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
        >
          <option value="tous">Tous les badges</option>
          <option value="actifs">Actifs uniquement</option>
          <option value="desactives">Désactivés uniquement</option>
        </select>
      </div>

      <p className="text-xs text-slate-500">
        Le ZIP respecte le filtre sélectionné ci-dessus et nomme chaque fichier
        <span className="font-mono"> matricule_NOM_Prenom.png</span> pour l'attribution précise à chaque ouvrier.
      </p>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2">Matricule</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Prénom</th>
              <th className="px-3 py-2">Département</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {chargement && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">Chargement…</td></tr>
            )}
            {!chargement && ouvriers.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">Aucun badge trouvé</td></tr>
            )}
            {pagination.elementsPage.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{o.matricule}</td>
                <td className="px-3 py-2">{o.nom}</td>
                <td className="px-3 py-2">{o.prenom}</td>
                <td className="px-3 py-2">{libelleDepartement(o)}</td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      o.actif ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {o.actif ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => handleVoirBadge(o)}
                    className="text-xs font-medium px-2.5 py-1 rounded-full bg-sky-50 text-sky-600 border border-sky-100 hover:bg-sky-100 transition"
                  >
                    Voir le badge
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPage={pagination.setPage}
        total={ouvriers.length}
        label="badge(s)"
      />

      {/* Modal badge individuel */}
      {badgeUrl && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 text-center space-y-3">
            <h2 className="font-bold text-slate-900">
              Badge — {badgeOuvrier?.prenom} {badgeOuvrier?.nom}
            </h2>
            <img src={badgeUrl} alt="QR code du badge" className="mx-auto w-64 h-64" />
            <p className="text-xs font-mono text-slate-500">{badgeOuvrier?.matricule}</p>
            {badgeOuvrier && (
              <p className="text-xs text-slate-500">{libelleDepartement(badgeOuvrier)}</p>
            )}
            <div className="flex justify-center gap-3 pt-1">
              <button
                onClick={handleTelechargerUnBadge}
                disabled={telechargementUnite}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100 disabled:opacity-50 transition"
              >
                {telechargementUnite ? "Téléchargement…" : "⬇ Télécharger ce badge"}
              </button>
              <button
                onClick={fermerModal}
                className="text-sm font-medium px-4 py-2 rounded-full bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}