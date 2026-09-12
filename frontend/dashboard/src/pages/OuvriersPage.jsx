import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../lib/api";
import { libelleDepartement } from "../lib/departement";
import { getAdmin } from "../lib/auth";
import { usePagination } from "../lib/pagination";
import PaginationBar from "../components/PaginationBar";
import ConfirmDialog from "../components/ConfirmDialog";
import TableShell from "../ui/TableShell";
import Pill from "../ui/Pill";
import Btn from "../ui/Btn";
import { Field, Input } from "../ui/inputs";
import { C } from "../theme";

const ROLE_ECRITURE = ["ADMIN", "SUPER_ADMIN"];

function peutEcrire() {
  return ROLE_ECRITURE.includes(getAdmin()?.role);
}

// Raison courte et compréhensible d'un échec, basée sur le code machine de
// l'API (cf. api-contrat.md : le front se branche sur les codes, pas les messages).
function raisonEchec(err, fallback) {
  const raisons = {
    FICHIER_MANQUANT: "Aucun fichier sélectionné. Choisissez un fichier .csv ou .xlsx.",
    TYPE_FICHIER_NON_SUPPORTE: "Type de fichier non accepté. Seuls les formats .csv et .xlsx sont autorisés.",
    FICHIER_TROP_GROS: "Le fichier dépasse la taille maximale autorisée (5 Mo).",
    FORMAT_INVALIDE: "Le fichier est illisible ou corrompu. Vérifiez le fichier avant de le recharger.",
    FICHIER_VIDE: "Le fichier ne contient aucune donnée. Vérifiez qu'il comporte au moins une ligne.",
    TROP_DE_LIGNES: "Le fichier est trop volumineux : maximum 2000 lignes autorisées.",
    COLONNES_MANQUANTES: "Colonnes attendues manquantes. Le fichier doit contenir : Nom, Prénom, Département.",
    DEPARTEMENT_INCONNU: "Un ou plusieurs départements ne sont pas dans la liste. Veuillez choisir des départements corrects.",
    DOUBLON_DEPARTEMENT: "Un ouvrier avec ce nom et ce prénom existe déjà dans ce département",
    MATRICULE_EXISTANT: "Ce matricule existe déjà",
    CHAMPS_MANQUANTS: "Des champs obligatoires sont manquants",
    ROLE_INVALIDE: "Poste invalide",
    POSTE_DEJA_PRIS: "Ce poste est déjà occupé dans le département",
    ACCES_REFUSE: "Vous n'avez pas les droits pour cette action",
    EMAIL_EXISTANT: "Un compte existe déjà avec cet email",
    ROLE_REQUIS: "Réseau non autorisé à effectuer cette action",
    FICHIER_INVALIDE: "Le fichier fourni est invalide (formats acceptés : .csv ou .xlsx)",
  };
  if (err instanceof ApiError && raisons[err.code]) return raisons[err.code];
  if (err instanceof ApiError && err.message) return err.message;
  return fallback;
}

/** Popup résultat (alerte ou succès) — reskiné dans les tons de la maison. */
function PopupResultat({ titre, message, action, surFermer }) {
  const danger = action === "alerte";
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
        <div
          className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl text-white"
          style={{
            background: danger ? C.btn : "linear-gradient(135deg,#10b981,#059669)",
            boxShadow: danger ? "0 8px 20px rgba(178,58,43,.3)" : "0 8px 20px rgba(5,150,105,.3)",
          }}
        >
          {danger ? "!" : "✓"}
        </div>
        <div>
          <h2 className="font-semibold text-slate-800" style={{ fontFamily: "Poppins,sans-serif" }}>
            {titre}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{message}</p>
        </div>
        <button
          onClick={surFermer}
          className="w-full text-sm font-medium text-white px-4 py-2 rounded-xl shadow-sm transition hover:opacity-90"
          style={{ background: danger ? C.btn : "linear-gradient(135deg,#10b981,#059669)" }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
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

  const [confirmation, setConfirmation] = useState(null);
  const [confirmationEnCours, setConfirmationEnCours] = useState(false);

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
      await charger();
      const { creees = 0, erreurs = 0 } = data;
      if (creees > 0 && erreurs > 0) {
        setAlerte({
          titre: "Import avec erreurs",
          message: `${creees} ouvrier(s) ajouté(s), ${erreurs} ligne(s) en erreur (doublon ou données invalides).`,
        });
      } else if (creees > 0) {
        setSucces({ titre: "Import réussi", message: `${creees} nouvel(s) ouvrier(s) ajouté(s).` });
      } else if (erreurs > 0) {
        setAlerte({
          titre: "Import terminé avec erreurs",
          message: `${erreurs} ligne(s) en erreur (doublon ou données invalides). Aucun nouvel ouvrier ajouté.`,
        });
      } else {
        setAlerte({ titre: "Import terminé", message: "Aucun ouvrier ajouté." });
      }
    } catch (err) {
      setAlerte({ titre: "Échec de l'import", message: raisonEchec(err, "L'import du fichier a échoué") });
    } finally {
      setImportEnCours(false);
      e.target.value = "";
    }
  }

  async function demanderConfirmation(type, ouvrier) {
    setConfirmation({ type, ouvrier });
  }

  async function executerConfirmation() {
    if (!confirmation) return;
    const { type, ouvrier } = confirmation;
    setConfirmationEnCours(true);
    try {
      if (type === "supprimer") {
        await api.deleteOuvrier(ouvrier.id);
        setSucces({
          titre: "Ouvrier supprimé",
          message: `${ouvrier.prenom} ${ouvrier.nom} (${ouvrier.matricule}) a été supprimé(e).`,
        });
      } else {
        const actif = type === "activer";
        await api.updateOuvrier(ouvrier.id, { actif });
        setSucces({
          titre: actif ? "Badge activé" : "Badge désactivé",
          message: `Le badge de ${ouvrier.prenom} ${ouvrier.nom} (${ouvrier.matricule}) est ${actif ? "réactivé" : "désactivé"}.`,
        });
      }
      setConfirmation(null);
      charger();
    } catch (err) {
      setAlerte({
        titre: "Une erreur est survenue",
        message: err instanceof ApiError ? err.message : "Erreur lors de l'action",
      });
      setConfirmation(null);
    } finally {
      setConfirmationEnCours(false);
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
        <h2 className="text-sm font-semibold text-bordeaux-900">{total} ouvrier(s)</h2>
        <div className="flex items-center gap-2">
          {peutEcrire() && (
            <label className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg px-3 py-2 cursor-pointer disabled:opacity-50 transition">
              {importEnCours ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-bordeaux-500 border-t-transparent" />
                  Import en cours…
                </span>
              ) : (
                <>Importer (.csv / .xlsx)</>
              )}
              <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImport} disabled={importEnCours} />
            </label>
          )}
          {peutEcrire() && (
            <Btn onClick={() => setModalOuvert(true)} icon="+">
              Ajouter un ouvrier
            </Btn>
          )}
        </div>
      </div>

      {alerte && (
        <PopupResultat
          action="alerte"
          titre={alerte.titre}
          message={alerte.message}
          surFermer={() => setAlerte(null)}
        />
      )}

      {succes && (
        <PopupResultat
          action="succes"
          titre={succes.titre}
          message={succes.message}
          surFermer={() => setSucces(null)}
        />
      )}

      {confirmation && (
        <ConfirmDialog
          ouvert
          titre={
            confirmation.type === "supprimer"
              ? "Supprimer l'ouvrier"
              : confirmation.type === "activer"
              ? "Activer le badge"
              : "Désactiver le badge"
          }
          message={
            confirmation.type === "supprimer"
              ? `Supprimer définitivement ${confirmation.ouvrier.prenom} ${confirmation.ouvrier.nom} (${confirmation.ouvrier.matricule}) ? Son historique de pointages et ses départements seront aussi supprimés. Action irréversible.`
              : confirmation.type === "activer"
              ? `Le badge de ${confirmation.ouvrier.prenom} ${confirmation.ouvrier.nom} (${confirmation.ouvrier.matricule}) redevient valide pour le badgeage.`
              : `Le badge de ${confirmation.ouvrier.prenom} ${confirmation.ouvrier.nom} (${confirmation.ouvrier.matricule}) sera désactivé : le badgeage renverra une erreur jusqu'à réactivation.`
          }
          bouton={
            confirmation.type === "supprimer"
              ? "Supprimer"
              : confirmation.type === "activer"
              ? "Activer"
              : "Désactiver"
          }
          enCours={confirmationEnCours}
          surAnnuler={() => setConfirmation(null)}
          surConfirmer={executerConfirmation}
        />
      )}

      <Input
        placeholder="Rechercher par nom, prénom, département, matricule…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />

      <TableShell
        colonnes={["Matricule", "Nom", "Prénom", "Département", "Statut", "Actions"]}
        chargement={chargement}
        vide="Aucun ouvrier trouvé"
      >
        {pagination.elementsPage.map((o) => (
          <tr key={o.id} className="border-t border-slate-100 hover:bg-bordeaux-50/40 transition-colors">
            <td className="px-3 py-2 font-mono text-xs">{o.matricule}</td>
            <td className="px-3 py-2">{o.nom}</td>
            <td className="px-3 py-2">{o.prenom}</td>
            <td className="px-3 py-2">{libelleDepartement(o)}</td>
            <td className="px-3 py-2">
              <Pill tonalite={o.actif ? "vert" : "gris"}>{o.actif ? "Actif" : "Désactivé"}</Pill>
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap space-x-1.5">
              <Btn variant="secondary" size="xs" onClick={() => handleVoirBadge(o)} icon="⊛">
                Badge
              </Btn>
              {peutEcrire() && (
                <Btn variant="softDanger" size="xs" onClick={() => demanderConfirmation(o.actif ? "desactiver" : "activer", o)}>
                  {o.actif ? "Désactiver" : "Activer"}
                </Btn>
              )}
              {peutEcrire() && (
                <Btn variant="softDanger" size="xs" onClick={() => demanderConfirmation("supprimer", o)}>
                  Supprimer
                </Btn>
              )}
            </td>
          </tr>
        ))}
      </TableShell>

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
            <h2 className="font-bold text-slate-900" style={{ fontFamily: "Poppins,sans-serif" }}>
              Ajouter un ouvrier
            </h2>
            <Field label="Nom">
              <Input required placeholder="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </Field>
            <Field label="Prénom">
              <Input required placeholder="Prénom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </Field>
            <Field label="Département">
              <Input
                required
                list="departements"
                placeholder="Département"
                value={form.departement}
                onChange={(e) => setForm({ ...form, departement: e.target.value })}
              />
            </Field>
            <datalist id="departements">
              {departements.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setModalOuvert(false)}>
                Annuler
              </Btn>
              <Btn type="submit" loading={envoi}>
                {envoi ? "Création…" : "Créer"}
              </Btn>
            </div>
          </form>
        </div>
      )}

      {/* Modal badge */}
      {badgeUrl && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 text-center space-y-3">
            <h2 className="font-bold text-slate-900" style={{ fontFamily: "Poppins,sans-serif" }}>
              Badge — {badgeOuvrier?.prenom} {badgeOuvrier?.nom}
            </h2>
            <img src={badgeUrl} alt="QR code du badge" className="mx-auto w-64 h-64" />
            <p className="text-xs font-mono text-slate-500">{badgeOuvrier?.matricule}</p>
            {badgeOuvrier && (
              <p className="text-xs text-slate-500">{libelleDepartement(badgeOuvrier)}</p>
            )}
            <Btn
              variant="secondary"
              onClick={() => {
                URL.revokeObjectURL(badgeUrl);
                setBadgeUrl(null);
                setBadgeOuvrier(null);
              }}
            >
              Fermer
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}