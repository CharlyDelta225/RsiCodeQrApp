import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { telechargerBlob } from "../lib/download";
import { getAdmin } from "../lib/auth";

import { usePagination } from "../lib/pagination";
import PaginationBar from "../components/PaginationBar";
import TableShell from "../ui/TableShell";
import Pill from "../ui/Pill";
import Btn from "../ui/Btn";
import { Select, Input } from "../ui/inputs";
import { C } from "../theme";

const ROLE_ECRITURE = ["ADMIN", "SUPER_ADMIN"];

function peutEcrire() {
  return ROLE_ECRITURE.includes(getAdmin()?.role);
}

const ROLES = [
  { valeur: "RESPONSABLE", libelle: "Responsable" },
  { valeur: "ADJOINT", libelle: "Adjoint du responsable" },
  { valeur: "SECRETAIRE", libelle: "Secrétaire" },
  { valeur: "MEMBRE", libelle: "Membre" },
];

function libelleRole(role) {
  return ROLES.find((r) => r.valeur === role)?.libelle || role;
}

function styleRole(role) {
  return (
    {
      RESPONSABLE: "text-gold-800 bg-gold-50 ring-1 ring-gold-200",
      ADJOINT: "text-bordeaux-700 bg-bordeaux-50 ring-1 ring-bordeaux-200",
      SECRETAIRE: "text-sky-700 bg-sky-50 ring-1 ring-sky-200",
      MEMBRE: "text-slate-600 bg-slate-100 ring-1 ring-slate-200",
    }[role] || "text-slate-600 bg-slate-100"
  );
}

function csvValeur(v) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function DepartementsPage() {
  const [departements, setDepartements] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [selection, setSelection] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);

  // Popup d'édition d'un membre
  const [edition, setEdition] = useState(null);
  const [form, setForm] = useState({ nom: "", prenom: "", actif: true, role: "MEMBRE" });
  const [formErreur, setFormErreur] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const chargerDepartements = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const data = await api.getDepartements({ limit: 100 });
      setDepartements(data.departements || []);
      setTotal(data.total);
      setSelectedId((prev) => prev || data.departements?.[0]?.id || "");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerDepartements();
  }, [chargerDepartements]);

  const chargerDetail = useCallback(async () => {
    if (!selectedId) {
      setSelection(null);
      return;
    }
    setChargementDetail(true);
    setErreur(null);
    try {
      const data = await api.getDepartement(selectedId);
      const membres = [...(data.departement.membres || [])];
      membres.sort((a, b) =>
        (a.ouvrier?.nom ?? "").localeCompare(b.ouvrier?.nom ?? "", "fr") ||
        (a.ouvrier?.prenom ?? "").localeCompare(b.ouvrier?.prenom ?? "", "fr")
      );
      setSelection({ ...data.departement, membres });
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible de charger ce département");
      setSelection(null);
    } finally {
      setChargementDetail(false);
    }
  }, [selectedId]);

  useEffect(() => {
    chargerDetail();
  }, [chargerDetail]);

  function ouvrirEdition(liaison) {
    const o = liaison.ouvrier;
    setEdition(liaison);
    setForm({ nom: o.nom, prenom: o.prenom, actif: Boolean(o.actif), role: liaison.roleDansDepartement });
    setFormErreur(null);
  }

  async function handleEnregistrer(e) {
    e.preventDefault();
    if (!edition) return;
    setEnregistrement(true);
    setFormErreur(null);
    try {
      const updates = [];
      const o = edition.ouvrier;
      if (form.nom !== o.nom || form.prenom !== o.prenom || form.actif !== Boolean(o.actif)) {
        updates.push(api.updateOuvrier(o.id, { nom: form.nom, prenom: form.prenom, actif: form.actif }));
      }
      if (form.role !== edition.roleDansDepartement) {
        updates.push(api.changerRoleMembre(selectedId, o.id, form.role));
      }
      await Promise.all(updates);
      setEdition(null);
      setSucces("Membre mis à jour.");
      await chargerDetail();
    } catch (err) {
      setFormErreur(err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setEnregistrement(false);
    }
  }

  async function handleRetirer(liaison) {
    const o = liaison.ouvrier;
    if (!confirm(`Retirer ${o.prenom} ${o.nom} du département « ${selection?.nom} » ?`)) return;
    setEnregistrement(true);
    setFormErreur(null);
    try {
      await api.retirerMembre(selectedId, o.id);
      setEdition(null);
      setSucces("Membre retiré du département.");
      await chargerDetail();
    } catch (err) {
      setFormErreur(err instanceof ApiError ? err.message : "Erreur lors du retrait");
    } finally {
      setEnregistrement(false);
    }
  }

  async function handleSupprimer(liaison) {
    const o = liaison.ouvrier;
    if (!confirm(`Supprimer définitivement ${o.prenom} ${o.nom} (badge et historique compris) ?`)) return;
    setEnregistrement(true);
    setFormErreur(null);
    try {
      await api.deleteOuvrier(o.id);
      setEdition(null);
      setSucces("Ouvrier supprimé.");
      await chargerDetail();
    } catch (err) {
      setFormErreur(err instanceof ApiError ? err.message : "Erreur lors de la suppression");
    } finally {
      setEnregistrement(false);
    }
  }

  function handleExporterCsv() {
    if (!selection || selection.membres.length === 0) return;
    const entete = ["Matricule", "Nom", "Prénom", "Poste"];
    const lignes = selection.membres.map((m) =>
      [m.ouvrier?.matricule, m.ouvrier?.nom, m.ouvrier?.prenom, libelleRole(m.roleDansDepartement)]
        .map(csvValeur)
        .join(";")
    );
    const csv = "\uFEFF" + [entete.join(";"), ...lignes].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const nomFichier = `membres_${selection.nom.replace(/\W+/g, "_")}.csv`;
    telechargerBlob(blob, nomFichier);
  }

  const nbMembres = selection?.membres?.length ?? 0;

  const pagination = usePagination(selection?.membres ?? []);

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
              Départements
            </h1>
            <p className="text-sm text-slate-500">Gérez les membres et leurs postes dans chaque département.</p>
            {peutEcrire() && (
            <Link
              to="/gestion-departements"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-bordeaux-700 bg-white ring-1 ring-bordeaux-200 hover:bg-bordeaux-50 rounded-full px-4 py-2 transition"
            >
              Créer / renommer / exporter les départements
              <span className="text-xs">→</span>
            </Link>
          )}
          </div>
          {peutEcrire() && (
            <button
              onClick={handleExporterCsv}
              disabled={!selection || nbMembres === 0}
              className="text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-50 rounded-xl px-4 py-2 shadow-sm transition"
            >
              ⬇ Exporter en CSV
            </button>
          )}
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

      {/* Sélecteur de département */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
        <label htmlFor="select-departement" className="block text-xs font-medium text-slate-500 mb-1.5">
          Département
        </label>
        {chargement ? (
          <div className="text-sm text-slate-400 py-1.5">Chargement…</div>
        ) : (
          <Select
            id="select-departement"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setSucces(null);
            }}
            className="w-full md:max-w-md"
          >
            {departements.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom} — {d._count?.membres ?? 0} membre(s)
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Membres */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="text-sm font-semibold text-slate-700" style={{ fontFamily: "Poppins,sans-serif" }}>
            {selection ? selection.nom : "Membres"}
          </h2>
          {selection && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
              {nbMembres} membre{nbMembres > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {chargementDetail && (
          <div className="text-sm text-slate-400 text-center py-10">Chargement des membres…</div>
        )}

        {!chargementDetail && selection && nbMembres === 0 && (
          <div className="text-sm text-slate-400 text-center py-10">Aucun membre dans ce département.</div>
        )}

        {!chargementDetail && selection && nbMembres > 0 && (
          <TableShell
            colonnes={["Matricule", "Nom", "Prénom", "Poste", "Actions"]}
            className="border-slate-100"
          >
            {pagination.elementsPage.map((m) => (
              <tr key={m.id} className="border-t border-slate-100 hover:bg-bordeaux-50/40 transition-colors">
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{m.ouvrier?.matricule}</td>
                <td className="px-3 py-2.5 text-slate-700">{m.ouvrier?.nom}</td>
                <td className="px-3 py-2.5 text-slate-700">{m.ouvrier?.prenom}</td>
                <td className="px-3 py-2.5">
                  <Pill tonalite="gris" className={styleRole(m.roleDansDepartement)}>
                    {libelleRole(m.roleDansDepartement)}
                  </Pill>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {peutEcrire() ? (
                    <button
                      onClick={() => ouvrirEdition(m)}
                      title={`Modifier ${m.ouvrier?.prenom} ${m.ouvrier?.nom}`}
                      className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 bg-slate-50 border border-slate-200 hover:text-white hover:border-transparent transition ml-auto"
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.btn)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      ⚙
                    </button>
                  ) : (
                    <span className="inline-block" />
                  )}
                </td>
              </tr>
            ))}
          </TableShell>
        )}

        {!chargementDetail && selection && nbMembres > 0 && (
          <PaginationBar
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPage={pagination.setPage}
            total={nbMembres}
            label="membre(s)"
          />
        )}
      </div>

      {/* Popup d'édition du membre */}
      {edition && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm" style={{ fontFamily: "Poppins,sans-serif" }}>
                  {edition.ouvrier?.prenom} {edition.ouvrier?.nom}
                </h2>
                <p className="text-xs text-slate-400">
                  {edition.ouvrier?.matricule} · {selection?.nom}
                </p>
              </div>
              <button
                onClick={() => setEdition(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEnregistrer} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Nom</label>
                  <Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Prénom</label>
                  <Input required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Poste dans le département</label>
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => (
                    <option key={r.valeur} value={r.valeur}>
                      {r.libelle}
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] text-slate-400">
                  Un seul responsable et un seul adjoint par département.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setForm({ ...form, actif: !form.actif })}
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
              >
                <span className="text-slate-500">Badge actif</span>
                <span
                  className={`w-10 h-6 rounded-full p-0.5 flex items-center transition ${form.actif ? "bg-bordeaux-600 justify-end" : "bg-slate-200 justify-start"}`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow" />
                </span>
              </button>

              {formErreur && (
                <p className="text-xs text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-xl px-3 py-2">{formErreur}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Btn variant="ghost" size="sm" onClick={() => setEdition(null)}>
                  Annuler
                </Btn>
                <div className="flex-1" />
                <Btn variant="secondary" size="sm" onClick={() => handleRetirer(edition)} disabled={enregistrement}>
                  Retirer du département
                </Btn>
                <Btn variant="softDanger" size="sm" onClick={() => handleSupprimer(edition)} disabled={enregistrement}>
                  Supprimer
                </Btn>
                <Btn type="submit" loading={enregistrement}>
                  {enregistrement ? "Enregistrement…" : "Enregistrer"}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}