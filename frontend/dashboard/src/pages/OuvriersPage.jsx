import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../lib/api";

const DEPARTEMENTS_SUGGESTIONS = [
  "Chorale", "Sécurité", "Accueil", "Intercession", "Jeunesse", "Média", "Protocole", "Logistique",
];

function LibelleStatutImport({ statut }) {
  const style = {
    cree: "text-green-700",
    ignore: "text-slate-500",
    erreur: "text-red-700",
  }[statut] || "text-slate-600";
  const libelle = { cree: "créé", ignore: "ignoré (doublon)", erreur: "erreur" }[statut] || statut;
  return <span className={style}>[{libelle}]</span>;
}

export default function OuvriersPage() {
  const [ouvriers, setOuvriers] = useState([]);
  const [total, setTotal] = useState(0);
  const [recherche, setRecherche] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [modalOuvert, setModalOuvert] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", departement: "" });
  const [envoi, setEnvoi] = useState(false);

  const [importEnCours, setImportEnCours] = useState(false);
  const [resultatImport, setResultatImport] = useState(null);

  const [badgeUrl, setBadgeUrl] = useState(null);
  const [badgeOuvrier, setBadgeOuvrier] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const params = recherche ? { recherche } : {};
      const data = await api.getOuvriers(params);
      setOuvriers(data.ouvriers);
      setTotal(data.total);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, [recherche]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function handleCreer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api.createOuvrier(form);
      setModalOuvert(false);
      setForm({ nom: "", prenom: "", departement: "" });
      charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur lors de la création");
    } finally {
      setEnvoi(false);
    }
  }

  async function handleImport(e) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setImportEnCours(true);
    setResultatImport(null);
    setErreur(null);
    try {
      const data = await api.importOuvriers(fichier);
      setResultatImport(data);
      charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur lors de l'import");
    } finally {
      setImportEnCours(false);
      e.target.value = ""; // permet de réimporter le même fichier si besoin
    }
  }

  async function handleToggleActif(ouvrier) {
    try {
      await api.updateOuvrier(ouvrier.id, { actif: !ouvrier.actif });
      charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur lors du changement de statut");
    }
  }

  async function handleSupprimer(ouvrier) {
    if (!confirm(`Supprimer ${ouvrier.prenom} ${ouvrier.nom} et son historique de pointages ?`)) return;
    try {
      await api.deleteOuvrier(ouvrier.id);
      charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur lors de la suppression");
    }
  }

  async function handleVoirBadge(ouvrier) {
    try {
      const blob = await api.getOuvrierBadgeBlob(ouvrier.id);
      setBadgeUrl(URL.createObjectURL(blob));
      setBadgeOuvrier(ouvrier);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur lors du chargement du badge");
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700">{total} ouvrier(s)</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg px-3 py-2 cursor-pointer">
            {importEnCours ? "Import en cours…" : "Importer Excel (.xlsx)"}
            <input type="file" accept=".xlsx" className="hidden" onChange={handleImport} disabled={importEnCours} />
          </label>
          <button
            onClick={() => setModalOuvert(true)}
            className="text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg px-3 py-2"
          >
            + Ajouter un ouvrier
          </button>
        </div>
      </div>

      {erreur && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erreur}</p>
      )}

      {resultatImport && (
        <div className="text-sm bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <p className="font-medium text-slate-900">
            Import terminé : {resultatImport.creees} créé(s), {resultatImport.ignorees} ignoré(s),{" "}
            {resultatImport.erreurs} en erreur.
          </p>
          <ul className="text-xs text-slate-600 space-y-1 max-h-40 overflow-y-auto">
            {resultatImport.detail.map((d, i) => (
              <li key={i}>
                <span className="text-slate-400">{d.prenom} {d.nom} ({d.departement || "—"}) —</span>{" "}
                <LibelleStatutImport statut={d.statut} />
                {d.matricule ? ` ${d.matricule}` : ""}
                {d.raison ? ` (${d.raison})` : ""}
              </li>
            ))}
          </ul>
          <button onClick={() => setResultatImport(null)} className="text-xs text-slate-500 hover:text-slate-700">
            Fermer ce résumé
          </button>
        </div>
      )}

      <input
        type="text"
        placeholder="Rechercher par nom, prénom, département, matricule…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
      />

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
              <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">Aucun ouvrier trouvé</td></tr>
            )}
            {ouvriers.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{o.matricule}</td>
                <td className="px-3 py-2">{o.nom}</td>
                <td className="px-3 py-2">{o.prenom}</td>
                <td className="px-3 py-2">{o.departement}</td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      o.actif ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {o.actif ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => handleVoirBadge(o)} className="text-blue-700 hover:underline text-xs">
                    Badge
                  </button>
                  <button onClick={() => handleToggleActif(o)} className="text-amber-700 hover:underline text-xs">
                    {o.actif ? "Désactiver" : "Activer"}
                  </button>
                  <button onClick={() => handleSupprimer(o)} className="text-red-700 hover:underline text-xs">
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal ajout manuel */}
      {modalOuvert && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreer} className="bg-white rounded-xl p-6 w-full max-w-sm space-y-3">
            <h2 className="font-bold text-slate-900">Ajouter un ouvrier</h2>
            <input
              required
              placeholder="Nom"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
            <input
              required
              placeholder="Prénom"
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
            <input
              required
              list="departements"
              placeholder="Département"
              value={form.departement}
              onChange={(e) => setForm({ ...form, departement: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
            <datalist id="departements">
              {DEPARTEMENTS_SUGGESTIONS.map((d) => <option key={d} value={d} />)}
            </datalist>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOuvert(false)} className="text-sm text-slate-500 px-3 py-2">
                Annuler
              </button>
              <button
                type="submit"
                disabled={envoi}
                className="text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg px-3 py-2"
              >
                {envoi ? "Création…" : "Créer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal badge */}
      {badgeUrl && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 text-center space-y-3">
            <h2 className="font-bold text-slate-900">
              Badge — {badgeOuvrier?.prenom} {badgeOuvrier?.nom}
            </h2>
            <img src={badgeUrl} alt="QR code du badge" className="mx-auto w-64 h-64" />
            <p className="text-xs font-mono text-slate-500">{badgeOuvrier?.matricule}</p>
            <button
              onClick={() => { URL.revokeObjectURL(badgeUrl); setBadgeUrl(null); setBadgeOuvrier(null); }}
              className="text-sm text-slate-600"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
