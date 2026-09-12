import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { telechargerBlob } from "../lib/download";
import { getAdmin } from "../lib/auth";
import ConfirmDialog from "../components/ConfirmDialog";
import PaginationBar from "../components/PaginationBar";
import TableShell from "../ui/TableShell";
import Btn from "../ui/Btn";
import { Field, Input } from "../ui/inputs";
import { usePagination } from "../lib/pagination";

const ROLE_ECRITURE = ["ADMIN", "SUPER_ADMIN"];

function peutEcrire() {
  return ROLE_ECRITURE.includes(getAdmin()?.role);
}

function csvValeur(v) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function GestionDepartementsPage() {
  const [departements, setDepartements] = useState([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);

  // Créer / renommer / supprimer
  const [filtre, setFiltre] = useState("");
  const [creationOuvert, setCreationOuvert] = useState(false);
  const [formCreation, setFormCreation] = useState({ nom: "", description: "" });
  const [creationErreur, setCreationErreur] = useState(null);
  const [renommage, setRenommage] = useState(null);
  const [formRenommage, setFormRenommage] = useState({ nom: "" });
  const [renommageErreur, setRenommageErreur] = useState(null);
  const [gestionErreur, setGestionErreur] = useState(null);
  const [enGestion, setEnGestion] = useState(false);
  const [suppression, setSuppression] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const data = await api.getDepartements({ limit: 100 });
      setDepartements(data.departements || []);
      setTotal(data.total);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const departementsFiltres = departements.filter((d) =>
    d.nom.toLowerCase().includes(filtre.trim().toLowerCase())
  );
  const nbMembresTotal = departements.reduce((s, d) => s + (d._count?.membres ?? 0), 0);

  const pagination = usePagination(departementsFiltres);

  async function handleCreer(e) {
    e.preventDefault();
    setEnGestion(true);
    setCreationErreur(null);
    try {
      const res = await api.createDepartement({
        nom: formCreation.nom.trim().toUpperCase(),
        description: formCreation.description,
      });
      setCreationOuvert(false);
      setFormCreation({ nom: "", description: "" });
      setSucces(`Département « ${res.departement.nom} » créé.`);
      await charger();
    } catch (err) {
      setCreationErreur(err instanceof ApiError ? err.message : "Erreur lors de la création");
    } finally {
      setEnGestion(false);
    }
  }

  async function handleRenommer(e) {
    e.preventDefault();
    if (!renommage) return;
    setEnGestion(true);
    setRenommageErreur(null);
    try {
      await api.updateDepartement(renommage.id, { nom: formRenommage.nom.trim().toUpperCase() });
      setRenommage(null);
      setSucces("Département renommé.");
      await charger();
    } catch (err) {
      setRenommageErreur(err instanceof ApiError ? err.message : "Erreur lors du renommage");
    } finally {
      setEnGestion(false);
    }
  }

  function demanderSuppression(dep) {
    setGestionErreur(null);
    setSuppression(dep);
  }

  async function supprimerConfirme() {
    if (!suppression) return;
    setEnGestion(true);
    setGestionErreur(null);
    try {
      await api.deleteDepartement(suppression.id);
      setSucces(`Département « ${suppression.nom} » supprimé.`);
      setSuppression(null);
      await charger();
    } catch (err) {
      setGestionErreur(err instanceof ApiError ? err.message : "Erreur lors de la suppression");
      setSuppression(null);
    } finally {
      setEnGestion(false);
    }
  }

  function handleExporterListe() {
    if (departementsFiltres.length === 0) return;
    const entete = ["Nom", "Membres"];
    const lignes = departementsFiltres.map((d) => [d.nom, d._count?.membres ?? 0].map(csvValeur).join(";"));
    const csv = "\uFEFF" + [entete.join(";"), ...lignes].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    telechargerBlob(blob, "departements.csv");
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800" style={{ fontFamily: "Poppins,sans-serif" }}>
              Gestion des départements
            </h1>
            <p className="text-sm text-slate-500">
              {total} département(s) · {nbMembresTotal} membre(s) au total.
            </p>
            <Link
              to="/departements"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-bordeaux-700 bg-white ring-1 ring-bordeaux-200 hover:bg-bordeaux-50 rounded-full px-4 py-2 transition"
            >
              Gérer les membres et postes
              <span className="text-xs">→</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {peutEcrire() && (
              <Btn
                onClick={() => {
                  setGestionErreur(null);
                  setCreationErreur(null);
                  setCreationOuvert(true);
                }}
                icon="+"
              >
                Créer un département
              </Btn>
            )}
            <Btn
              variant="secondary"
              onClick={handleExporterListe}
              disabled={departementsFiltres.length === 0}
              icon="⬇"
            >
              Exporter la liste
            </Btn>
          </div>
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

      {/* Liste des départements */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 space-y-4">
        <Input
          type="search"
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          placeholder="Filtrer les départements par nom…"
          className="w-full md:max-w-md"
        />

        {gestionErreur && (
          <p className="text-xs text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-xl px-3 py-2">{gestionErreur}</p>
        )}

        {chargement ? (
          <div className="text-sm text-slate-400 text-center py-10">Chargement…</div>
        ) : departementsFiltres.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-10">Aucun département.</div>
        ) : (
          <TableShell
            colonnes={["Nom", "Description", "Membres", "Actions"]}
            className="border-slate-100"
          >
            {pagination.elementsPage.map((d) => (
              <tr key={d.id} className="border-t border-slate-100 hover:bg-bordeaux-50/40 transition-colors">
                <td className="px-3 py-2.5 text-slate-700">{d.nom}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs">{d.description || "—"}</td>
                <td className="px-3 py-2.5 text-slate-500">{d._count?.membres ?? 0}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {peutEcrire() ? (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setGestionErreur(null);
                          setRenommageErreur(null);
                          setRenommage(d);
                          setFormRenommage({ nom: d.nom });
                        }}
                        title={`Renommer ${d.nom}`}
                        className="w-8 h-8 rounded-full text-slate-400 bg-slate-50 border border-slate-200 hover:text-bordeaux-700 hover:border-bordeaux-200 transition"
                      >
                        ✏
                      </button>
                      <button
                        onClick={() => demanderSuppression(d)}
                        disabled={enGestion}
                        title={`Supprimer ${d.nom}`}
                        className="w-8 h-8 rounded-full text-slate-400 bg-slate-50 border border-slate-200 hover:text-bordeaux-700 hover:border-bordeaux-200 disabled:opacity-40 transition"
                      >
                        🗑
                      </button>
                    </div>
                  ) : (
                    <span className="inline-block" />
                  )}
                </td>
              </tr>
            ))}
          </TableShell>
        )}

        <PaginationBar
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPage={pagination.setPage}
          total={departementsFiltres.length}
          label="département(s)"
        />
      </div>

      {/* Popup de création d'un département */}
      {creationOuvert && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm" style={{ fontFamily: "Poppins,sans-serif" }}>
                Créer un département
              </h2>
              <button
                onClick={() => setCreationOuvert(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreer} className="p-6 space-y-4">
              <Field label="Nom *">
                <Input
                  required
                  value={formCreation.nom}
                  onChange={(e) => setFormCreation({ ...formCreation, nom: e.target.value })}
                  placeholder="Ex : Sonorisation"
                />
              </Field>
              <Field label="Description (optionnel)">
                <Input
                  value={formCreation.description}
                  onChange={(e) => setFormCreation({ ...formCreation, description: e.target.value })}
                />
              </Field>
              {creationErreur && (
                <p className="text-xs text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-xl px-3 py-2">
                  {creationErreur}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Btn variant="ghost" size="sm" onClick={() => setCreationOuvert(false)}>
                  Annuler
                </Btn>
                <Btn type="submit" loading={enGestion}>
                  {enGestion ? "Création…" : "Créer"}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup de renommage d'un département */}
      {renommage && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm" style={{ fontFamily: "Poppins,sans-serif" }}>
                Renommer le département
              </h2>
              <button
                onClick={() => setRenommage(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRenommer} className="p-6 space-y-4">
              <Field label="Nom *">
                <Input
                  required
                  value={formRenommage.nom}
                  onChange={(e) => setFormRenommage({ ...formRenommage, nom: e.target.value })}
                />
              </Field>
              {renommageErreur && (
                <p className="text-xs text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-xl px-3 py-2">
                  {renommageErreur}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Btn variant="ghost" size="sm" onClick={() => setRenommage(null)}>
                  Annuler
                </Btn>
                <Btn type="submit" loading={enGestion}>
                  {enGestion ? "Renommage…" : "Renommer"}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        ouvert={!!suppression}
        titre={suppression ? `Supprimer le département « ${suppression.nom} » ?` : ""}
        message="Les membres seront retirés de ce département mais conservés comme ouvriers."
        bouton="Supprimer"
        enCours={enGestion}
        surAnnuler={() => setSuppression(null)}
        surConfirmer={supprimerConfirme}
      />
    </div>
  );
}