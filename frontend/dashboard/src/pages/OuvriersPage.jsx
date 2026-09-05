import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../lib/api";
import { libelleDepartement } from "../lib/departement";
import { getAdmin } from "../lib/auth";
import { usePagination } from "../lib/pagination";
import PaginationBar from "../components/PaginationBar";

const ROLE_ECRITURE = ["ADMIN", "SUPER_ADMIN"];

function peutEcrire() {
  return ROLE_ECRITURE.includes(getAdmin()?.role);
}

// Raison courte et compréhensible d'un échec, basée sur le code machine de
// l'API (cf. api-contrat.md : le front se branche sur les codes, pas les messages).
function raisonEchec(err, fallback) {
  const raisons = {
    DOUBLON_DEPARTEMENT: "Un ouvrier avec ce nom et ce prénom existe déjà dans ce département",
    MATRICULE_EXISTANT: "Ce matricule existe déjà",
    CHAMPS_MANQUANTS: "Des champs obligatoires sont manquants",
    DEPARTEMENT_INCONNU: "Un ou plusieurs départements ne sont pas dans la liste. Veuillez choisir des départements corrects.",
    ROLE_INVALIDE: "Poste invalide",
    POSTE_DEJA_PRIS: "Ce poste est déjà occupé dans le département",
    ACCES_REFUSE: "Vous n'avez pas les droits pour cette action",
    EMAIL_EXISTANT: "Un compte existe déjà avec cet email",
    ROLE_REQUIS: "Réseau non autorisé à effectuer cette action",
    FICHIER_INVALIDE: "Le fichier fourni est invalide (formats acceptés : .csv ou .xlsx)",
  };
  if (err instanceof ApiError && raisons[err.code]) return raisons[err.code];
  return fallback;
}

export default function OuvriersPage() {
  const [ouvriers, setOuvriers] = useState([]);
  const [total, setTotal] = useState(0);
  const [recherche, setRecherche] = useState("");
  const [chargement, setChargement] = useState(true);
  const [alerte, setAlerte] = useState(null);
  const [succes, setSucces] = useState(null);

  const [modalOuvert, setModalOuvert] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", departement: "" });
  const [envoi, setEnvoi] = useState(false);

  const [importEnCours, setImportEnCours] = useState(false);

  const [badgeUrl, setBadgeUrl] = useState(null);
  const [badgeOuvrier, setBadgeOuvrier] = useState(null);

  const [departements, setDepartements] = useState([]);

  const pagination = usePagination(ouvriers);

  const charger = useCallback(async () => {
    setChargement(true);
    setAlerte(null);
    try {
      const params = { limit: 500 };
      if (recherche) params.recherche = recherche;
      const [data, dataDepts] = await Promise.all([
        api.getOuvriers(params),
        api.getDepartements({ limit: 200 }),
      ]);
      setOuvriers(data.ouvriers);
      setTotal(data.total);
      setDepartements((dataDepts.departements || []).map((d) => d.nom));
    } catch (err) {
      setAlerte({ titre: "Une erreur est survenue", message: err instanceof ApiError ? err.message : "Erreur de chargement" });
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
    setAlerte(null);
    try {
      await api.createOuvrier({
        nom: form.nom,
        prenom: form.prenom,
        departementNom: form.departement,
      });
      setModalOuvert(false);
      setForm({ nom: "", prenom: "", departement: "" });
      setSucces({ titre: "Ajout réussi", message: `L'ouvrier ${form.prenom} ${form.nom} a bien été ajouté(e).` });
      charger();
    } catch (err) {
      setAlerte({ titre: "Échec de l'ajout", message: raisonEchec(err, "La création de l'ouvrier a échoué") });
    } finally {
      setEnvoi(false);
    }
  }

  async function handleImport(e) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setImportEnCours(true);
    setAlerte(null);
    try {
      const data = await api.importOuvriers(fichier);
      const { creees = 0, ignorees = 0, erreurs = 0 } = data;
      if (creees > 0) {
        let message = `Import réussi : ${creees} nouvel(s) ouvrier(s) ajouté(s)${ignorees > 0 ? `, ${ignorees} doublon(s) déjà en base ignoré(s)` : ""}.`;
        if (erreurs > 0) message += ` ${erreurs} ligne(s) en erreur.`;
        setSucces({ titre: "Import réussi", message });
      } else if (ignorees > 0) {
        let message = "Import refusé : des doublons ont été trouvés en base.";
        if (erreurs > 0) message += ` ${erreurs} ligne(s) en erreur.`;
        setAlerte({ titre: "Import refusé", message });
      } else {
        setAlerte({ titre: "Import terminé", message: "Aucun ouvrier ajouté." });
      }
      charger();
    } catch (err) {
      setAlerte({ titre: "Échec de l'import", message: raisonEchec(err, "L'import du fichier a échoué") });
    } finally {
      setImportEnCours(false);
      e.target.value = "";
    }
  }

  async function handleToggleActif(ouvrier) {
    try {
      await api.updateOuvrier(ouvrier.id, { actif: !ouvrier.actif });
      charger();
    } catch (err) {
      setAlerte({ titre: "Une erreur est survenue", message: err instanceof ApiError ? err.message : "Erreur lors du changement de statut" });
    }
  }

  async function handleSupprimer(ouvrier) {
    if (!confirm(`Supprimer ${ouvrier.prenom} ${ouvrier.nom} et son historique de pointages ?`)) return;
    try {
      await api.deleteOuvrier(ouvrier.id);
      charger();
    } catch (err) {
      setAlerte({ titre: "Une erreur est survenue", message: err instanceof ApiError ? err.message : "Erreur lors de la suppression" });
    }
  }

  async function handleVoirBadge(ouvrier) {
    try {
      const blob = await api.getOuvrierBadgeBlob(ouvrier.id);
      setBadgeUrl(URL.createObjectURL(blob));
      setBadgeOuvrier(ouvrier);
    } catch (err) {
      setAlerte({ titre: "Une erreur est survenue", message: err instanceof ApiError ? err.message : "Erreur lors du chargement du badge" });
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700">{total} ouvrier(s)</h2>
        <div className="flex items-center gap-2">
          {peutEcrire() && (
            <label className="text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg px-3 py-2 cursor-pointer">
              {importEnCours ? "Import en cours…" : "Importer (.csv / .xlsx)"}
              <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImport} disabled={importEnCours} />
            </label>
          )}
          {peutEcrire() && (
            <button
              onClick={() => setModalOuvert(true)}
              className="text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg px-3 py-2"
            >
              + Ajouter un ouvrier
            </button>
          )}
        </div>
      </div>

      {alerte && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl text-white"
              style={{ background: "linear-gradient(135deg,#fb7185,#f43f5e)", boxShadow: "0 8px 20px rgba(244,63,94,.3)" }}
            >
              !
            </div>
            <div>
              <h2 className="font-semibold text-slate-800" style={{ fontFamily: "Poppins,sans-serif" }}>
                {alerte.titre}
              </h2>
              <p className="text-sm text-slate-500 mt-1">{alerte.message}</p>
            </div>
            <button
              onClick={() => setAlerte(null)}
              className="w-full text-sm font-medium text-white px-4 py-2 rounded-xl shadow-sm transition"
              style={{ background: "linear-gradient(135deg,#fb7185,#f43f5e)" }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {succes && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl text-white"
              style={{ background: "linear-gradient(135deg,#34d399,#10b981)", boxShadow: "0 8px 20px rgba(16,185,129,.3)" }}
            >
              ✓
            </div>
            <div>
              <h2 className="font-semibold text-slate-800" style={{ fontFamily: "Poppins,sans-serif" }}>
                {succes.titre}
              </h2>
              <p className="text-sm text-slate-500 mt-1">{succes.message}</p>
            </div>
            <button
              onClick={() => setSucces(null)}
              className="w-full text-sm font-medium text-white px-4 py-2 rounded-xl shadow-sm transition"
              style={{ background: "linear-gradient(135deg,#34d399,#10b981)" }}
            >
              Fermer
            </button>
          </div>
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
                <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => handleVoirBadge(o)}
                    className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition"
                  >
                    Badge
                  </button>
                  {peutEcrire() && (
                    <button
                      onClick={() => handleToggleActif(o)}
                      className="inline-flex items-center justify-center text-xs font-medium w-[92px] px-2 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100 transition"
                    >
                      {o.actif ? "Désactiver" : "Activer"}
                    </button>
                  )}
                  {peutEcrire() && (
                    <button
                      onClick={() => handleSupprimer(o)}
                      className="text-xs font-medium px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition"
                    >
                      Supprimer
                    </button>
                  )}
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
        label="ouvrier(s)"
      />

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
              {departements.map((d) => (
                <option key={d} value={d} />
              ))}
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
            {badgeOuvrier && (
              <p className="text-xs text-slate-500">{libelleDepartement(badgeOuvrier)}</p>
            )}
            <button
              onClick={() => {
                URL.revokeObjectURL(badgeUrl);
                setBadgeUrl(null);
                setBadgeOuvrier(null);
              }}
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