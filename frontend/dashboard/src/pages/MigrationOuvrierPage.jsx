import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";
import PaginationBar from "../components/PaginationBar";
import TableShell from "../ui/TableShell";
import Btn from "../ui/Btn";
import { Field, Input, Select } from "../ui/inputs";
import { usePagination } from "../lib/pagination";

const POSTES = [
  { valeur: "RESPONSABLE", libelle: "Responsable" },
  { valeur: "ADJOINT", libelle: "Adjoint du responsable" },
  { valeur: "SECRETAIRE", libelle: "Secrétaire" },
  { valeur: "MEMBRE", libelle: "Membre" },
];

function libellePoste(valeur) {
  return POSTES.find((p) => p.valeur === valeur)?.libelle || valeur || "—";
}

export default function MigrationOuvrierPage() {
  const [ouvriers, setOuvriers] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);

  const [recherche, setRecherche] = useState("");
  const [filtreDepartement, setFiltreDepartement] = useState("tous"); // tous | sans | uuid
  const [enMise, setEnMise] = useState(false);
  const [migration, setMigration] = useState(null); // ouvrier en cours
  const [formMigration, setFormMigration] = useState({ departementId: "", roleDansDepartement: "MEMBRE" });
  const [migrationErreur, setMigrationErreur] = useState(null);
  const [dejaMembre, setDejaMembre] = useState(null); // popup « déjà membre »
  const [retrait, setRetrait] = useState(null); // confirmation retrait d'un département

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [dataOuvriers, dataDepartements] = await Promise.all([
        api.getOuvriers({ limit: 200 }),
        api.getDepartements({ limit: 100 }),
      ]);
      setOuvriers(dataOuvriers.ouvriers || []);
      setDepartements(dataDepartements.departements || []);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const ouvriersFiltres = ouvriers.filter((o) => {
    const q = recherche.trim().toLowerCase();
    if (q && !`${o.matricule} ${o.nom} ${o.prenom}`.toLowerCase().includes(q)) return false;

    if (filtreDepartement === "tous") return true;
    if (filtreDepartement === "sans") return !o.departements || o.departements.length === 0;
    return (o.departements || []).some((l) => l.departementId === filtreDepartement);
  });

  const pagination = usePagination(ouvriersFiltres);

  function afficherMigration(o) {
    setMigrationErreur(null);
    setSucces(null);
    setMigration(o);
    setFormMigration({ departementId: "", roleDansDepartement: "MEMBRE" });
  }

  function fermerMigration() {
    if (enMise) return;
    setMigration(null);
    setMigrationErreur(null);
  }

  function demanderRetrait(o, liaison) {
    const departement = departements.find((d) => d.id === liaison.departementId);
    setErreur(null);
    setSucces(null);
    setRetrait({ ouvrier: o, liaison, departement: departement?.nom ?? "—" });
  }

  async function confirmerRetrait() {
    if (!retrait) return;
    const { ouvrier, liaison, departement } = retrait;
    setEnMise(true);
    setErreur(null);
    try {
      await api.retirerMembre(liaison.departementId, liaison.ouvrierId);
      setSucces(`« ${ouvrier.nom} ${ouvrier.prenom} » retiré du département « ${departement} ».`);
      setRetrait(null);
      await charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur lors du retrait");
      setRetrait(null);
    } finally {
      setEnMise(false);
    }
  }

  async function affecterDepartement(e) {
    e.preventDefault();
    if (!migration || !formMigration.departementId) return;

    // Contrôle d'appartenance : l'ouvrier est-il déjà dans ce département ?
    const dejaRattache = migration.departements?.some(
      (l) => l.departementId === formMigration.departementId
    );
    if (dejaRattache) {
      const departement = departements.find(
        (d) => d.id === formMigration.departementId
      );
      setDejaMembre({
        ouvrier: migration,
        departement: departement?.nom || "ce département",
      });
      return;
    }

    setEnMise(true);
    setMigrationErreur(null);
    try {
      await api.ajouterMembre(
        formMigration.departementId,
        migration.id,
        formMigration.roleDansDepartement
      );
      setSucces(
        `« ${migration.nom} ${migration.prenom} » affecté au département « ${
          departements.find((d) => d.id === formMigration.departementId)?.nom ?? ""
        } ».`
      );
      setMigration(null);
      await charger();
    } catch (err) {
      setMigrationErreur(
        err instanceof ApiError ? err.message : "Erreur lors de l'affectation"
      );
    } finally {
      setEnMise(false);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-6xl mx-auto">
      {/* Bandeau titre */}
      <div
        className="rounded-2xl p-5 md:p-6 shadow-sm"
        style={{
          background: "linear-gradient(135deg,#FFF6F4 0%,#FBE7E3 55%,#F4CFC7 100%)",
          border: "1px solid #F1C4BB",
        }}
      >
        <div>
          <h1 className="text-lg font-semibold text-slate-800" style={{ fontFamily: "Poppins,sans-serif" }}>
            Migration ouvrier
          </h1>
          <p className="text-sm text-slate-500">
            Affecter un ouvrier à un autre département · {ouvriers.length} ouvrier(s) · {departements.length} département(s).
          </p>
        </div>
      </div>

      {(erreur || succes) && (
        <div
          className={`text-sm rounded-xl px-4 py-3 border ${
            erreur
              ? "text-bordeaux-700 bg-bordeaux-50 border-bordeaux-200"
              : "text-emerald-700 bg-emerald-50 border-emerald-200"
          }`}
        >
          {erreur || succes}
        </div>
      )}

      {/* Liste des ouvriers */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Field label="Rechercher" hint="Par matricule, nom ou prénom." className="flex-1">
            <Input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un ouvrier…"
            />
          </Field>
          <Field label="Département" hint="Filtre la liste affichée." className="sm:w-72">
            <Select
              value={filtreDepartement}
              onChange={(e) => setFiltreDepartement(e.target.value)}
            >
              <option value="tous">Tous les départements</option>
              <option value="sans">Sans département</option>
              {departements.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <TableShell
          colonnes={["Matricule", "Nom", "Prénom", "Téléphone", "Département(s) actuel(s)", "Actions"]}
          chargement={chargement}
          vide="Aucun ouvrier ne correspond."
          className="border-slate-100"
        >
          {pagination.elementsPage.map((o) => (
            <tr key={o.id} className="border-t border-slate-100 hover:bg-bordeaux-50/40 transition-colors">
              <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{o.matricule}</td>
              <td className="px-3 py-2.5 text-slate-700">{o.nom}</td>
              <td className="px-3 py-2.5 text-slate-700">{o.prenom}</td>
              <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{o.telephone || "—"}</td>
              <td className="px-3 py-2.5 text-slate-500">
                {o.departements?.length > 0 ? (
                  <span className="inline-flex flex-wrap gap-1">
                    {o.departements.map((l) => (
                      <span
                        key={l.departementId}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 rounded-full pl-2 pr-0.5 py-0.5"
                      >
                        {l.departement?.nom} · {libellePoste(l.roleDansDepartement)}
                        <button
                          type="button"
                          onClick={() => demanderRetrait(o, l)}
                          disabled={enMise}
                          title={`Retirer ${o.nom} ${o.prenom} du département ${l.departement?.nom ?? ""}`}
                          className="w-4 h-4 rounded-full text-slate-400 hover:bg-bordeaux-600 hover:text-white transition disabled:opacity-40"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Aucun département</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                <Btn size="sm" icon="⇄" onClick={() => afficherMigration(o)}>
                  Migrer
                </Btn>
              </td>
            </tr>
          ))}
        </TableShell>

        {!chargement && (
          <PaginationBar
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPage={pagination.setPage}
            total={ouvriersFiltres.length}
            label="ouvrier(s)"
          />
        )}
      </div>

      {/* Popup d'affectation */}
      {migration && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm" style={{ fontFamily: "Poppins,sans-serif" }}>
                  Affecter à un département
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {migration.matricule} · {migration.nom} {migration.prenom}
                </p>
              </div>
              <button
                onClick={fermerMigration}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>
            <form onSubmit={affecterDepartement} className="p-6 space-y-4">
              <Field label="Département de destination *" hint="L'ouvrier sera rattaché à ce département (en plus des départements actuels).">
                <Select
                  required
                  value={formMigration.departementId}
                  onChange={(e) => setFormMigration({ ...formMigration, departementId: e.target.value })}
                >
                  <option value="">Choisir un département…</option>
                  {departements.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nom}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Poste dans le département">
                <Select
                  value={formMigration.roleDansDepartement}
                  onChange={(e) => setFormMigration({ ...formMigration, roleDansDepartement: e.target.value })}
                >
                  {POSTES.map((p) => (
                    <option key={p.valeur} value={p.valeur}>
                      {p.libelle}
                    </option>
                  ))}
                </Select>
              </Field>
              {migrationErreur && (
                <p className="text-xs text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-xl px-3 py-2">
                  {migrationErreur}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Btn variant="ghost" size="sm" onClick={fermerMigration}>
                  Annuler
                </Btn>
                <Btn type="submit" loading={enMise} icon="⇄">
                  {enMise ? "Affectation…" : "Affecter"}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup « déjà membre » */}
      <ConfirmDialog
        ouvert={!!dejaMembre}
        titre={dejaMembre ? `« ${dejaMembre.ouvrier.nom} ${dejaMembre.ouvrier.prenom} »` : ""}
        message={
          dejaMembre
            ? `Cet ouvrier appartient déjà au département « ${dejaMembre.departement} ».`
            : ""
        }
        bouton="OK"
        surAnnuler={() => setDejaMembre(null)}
        surConfirmer={() => setDejaMembre(null)}
      />

      {/* Confirmation de retrait d'un département */}
      <ConfirmDialog
        ouvert={!!retrait}
        titre={retrait ? `Retirer « ${retrait.ouvrier.nom} ${retrait.ouvrier.prenom} » ?` : ""}
        message={
          retrait
            ? `Il sera retiré du département « ${retrait.departement} » (conservé comme ouvrier).`
            : ""
        }
        bouton="Retirer"
        enCours={enMise}
        surAnnuler={() => setRetrait(null)}
        surConfirmer={confirmerRetrait}
      />
    </div>
  );
}