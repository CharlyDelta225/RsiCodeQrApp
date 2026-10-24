import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, Settings2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { telechargerBlob } from "../lib/download";
import { getAdmin } from "../lib/auth";
import { useToast } from "../components/Toast.jsx";

import { usePagination } from "../lib/pagination";
import PaginationBar from "../components/PaginationBar";
import TableShell from "../ui/TableShell";
import Pill from "../ui/Pill";
import Btn from "../ui/Btn";
import Modal from "../ui/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { Field, Select, Input } from "../ui/inputs";
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

const ACCENTS = [
  "linear-gradient(90deg,#7B1515,#B23A2B)",
  "linear-gradient(90deg,#B08612,#DCB23F)",
  "linear-gradient(90deg,#932A1F,#D06E5F)",
  "linear-gradient(90deg,#8B6914,#E4C468)",
  "linear-gradient(90deg,#5A0A0A,#B23A2B)",
  "linear-gradient(90deg,#6B5110,#D4A017)",
];

function libelleRole(role) {
  return ROLES.find((r) => r.valeur === role)?.libelle || role;
}

function styleRole(role) {
  return (
    {
      RESPONSABLE: "text-gold-800 bg-gold-50 ring-1 ring-gold-200",
      ADJOINT: "text-bordeaux-700 bg-bordeaux-50 ring-1 ring-bordeaux-200",
      SECRETAIRE: "text-amber-800 bg-amber-50 ring-1 ring-amber-200",
      MEMBRE: "text-slate-600 bg-slate-100 ring-1 ring-slate-200",
    }[role] || "text-slate-600 bg-slate-100"
  );
}

function csvValeur(v) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function DepartementsPage() {
  const toast = useToast();
  const [departements, setDepartements] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [selection, setSelection] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);

  useEffect(() => {
    if (!succes) return;
    toast.success("Membres", succes);
    setSucces(null);
  }, [succes, toast]);

  useEffect(() => {
    if (!erreur) return;
    toast.error("Erreur", erreur);
    setErreur(null);
  }, [erreur, toast]);

  // Popup d'édition d'un membre
  const [edition, setEdition] = useState(null);
  const [form, setForm] = useState({ nom: "", prenom: "", telephone: "", actif: true, role: "MEMBRE" });
  const [formErreur, setFormErreur] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmation, setConfirmation] = useState(null); // { type: retirer|supprimer, liaison, titre, message, bouton }

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
    setForm({ nom: o.nom, prenom: o.prenom, telephone: o.telephone || "", actif: Boolean(o.actif), role: liaison.roleDansDepartement });
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
      if (form.nom !== o.nom || form.prenom !== o.prenom || form.telephone !== (o.telephone || "") || form.actif !== Boolean(o.actif)) {
        updates.push(api.updateOuvrier(o.id, { nom: form.nom, prenom: form.prenom, telephone: form.telephone, actif: form.actif }));
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

  async function demanderRetirer(liaison) {
    const o = liaison.ouvrier;
    setFormErreur(null);
    setSucces(null);
    setConfirmation({
      type: "retirer",
      liaison,
      titre: `Retirer « ${o.prenom} ${o.nom} » ?`,
      message: `Il sera retiré du département « ${selection?.nom} » (conservé comme ouvrier).`,
      bouton: "Retirer",
    });
  }

  function demanderSupprimer(liaison) {
    const o = liaison.ouvrier;
    setFormErreur(null);
    setSucces(null);
    setConfirmation({
      type: "supprimer",
      liaison,
      titre: `Supprimer définitivement « ${o.prenom} ${o.nom} » ?`,
      message:
        "Le badge, l'historique de pointages et les liaisons aux départements seront aussi supprimés. Action irréversible.",
      bouton: "Supprimer",
    });
  }

  async function executerConfirmation() {
    if (!confirmation) return;
    const { type, liaison } = confirmation;
    setEnregistrement(true);
    setFormErreur(null);
    try {
      if (type === "retirer") {
        await api.retirerMembre(selectedId, liaison.ouvrier.id);
        setEdition(null);
        setSucces("Membre retiré du département.");
      } else {
        await api.deleteOuvrier(liaison.ouvrier.id);
        setEdition(null);
        setSucces("Ouvrier supprimé.");
      }
      await chargerDetail();
    } catch (err) {
      setFormErreur(
        err instanceof ApiError
          ? err.message
          : type === "retirer"
          ? "Erreur lors du retrait"
          : "Erreur lors de la suppression"
      );
    } finally {
      setEnregistrement(false);
      setConfirmation(null);
    }
  }

  function handleExporterCsv() {
    if (!selection || selection.membres.length === 0) return;
    const entete = ["Matricule", "Nom", "Prénom", "Téléphone", "Poste"];
    const lignes = selection.membres.map((m) =>
      [m.ouvrier?.matricule, m.ouvrier?.nom, m.ouvrier?.prenom, m.ouvrier?.telephone || "", libelleRole(m.roleDansDepartement)]
        .map(csvValeur)
        .join(";")
    );
    const csv = "﻿" + [entete.join(";"), ...lignes].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const nomFichier = `membres_${selection.nom.replace(/\W+/g, "_")}.csv`;
    telechargerBlob(blob, nomFichier);
  }

  const nbMembres = selection?.membres?.length ?? 0;

  const repartitionRoles = ROLES.map((role) => ({
    ...role,
    nombre: (selection?.membres ?? []).filter((m) => m.roleDansDepartement === role.valeur).length,
  })).filter((role) => role.nombre > 0);

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
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          )}
          </div>
          {peutEcrire() && (
            <button
              onClick={handleExporterCsv}
              disabled={!selection || nbMembres === 0}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-50 rounded-xl px-4 py-2 shadow-sm transition"
            >
              <Download size={16} aria-hidden="true" /> Exporter en CSV
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

      {/* Cartes de départements */}
      <div>
        <div className="flex items-end justify-between flex-wrap gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Poppins,sans-serif" }}>
              Départements
            </h2>
            <p className="text-xs text-slate-500">Cliquez sur une carte pour afficher ses membres.</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-500">
            {departements.length} département{departements.length > 1 ? "s" : ""}
          </span>
        </div>

        {chargement ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : departements.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            Aucun département disponible.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departements.map((d, index) => {
              const actif = selectedId === d.id;
              const nb = d._count?.membres ?? 0;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(d.id);
                    setSucces(null);
                  }}
                  aria-pressed={actif}
                  className={`text-left rounded-2xl border bg-white p-4 transition-all ${
                    actif
                      ? "border-bordeaux-300 ring-2 ring-bordeaux-200 shadow-md"
                      : "border-slate-200 hover:border-bordeaux-200 hover:shadow-sm"
                  }`}
                >
                  <div
                    className="h-1.5 w-14 rounded-full mb-3"
                    style={{ background: ACCENTS[index % ACCENTS.length] }}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{d.nom}</p>
                      {d.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{d.description}</p>
                      )}
                    </div>
                    <span
                      className={`flex-shrink-0 inline-flex items-center justify-center min-w-9 h-9 rounded-xl text-sm font-semibold ${
                        actif ? "bg-bordeaux-700 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                      title={`${nb} membre(s)`}
                    >
                      {nb}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-3">
                    {nb} membre{nb > 1 ? "s" : ""}
                  </p>
                  {actif && repartitionRoles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {repartitionRoles.map((role) => (
                        <Pill key={role.valeur} className={styleRole(role.valeur)}>
                          {role.nombre} {role.libelle}
                        </Pill>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
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
          <div className="text-sm text-slate-500 text-center py-10">Chargement des membres…</div>
        )}

        {!chargementDetail && selection && nbMembres === 0 && (
          <div className="text-sm text-slate-500 text-center py-10">Aucun membre dans ce département.</div>
        )}

        {!chargementDetail && selection && nbMembres > 0 && (
          <TableShell
            colonnes={["Matricule", "Nom", "Prénom", "Téléphone", "Poste", "Actions"]}
            className="border-slate-100"
          >
            {pagination.elementsPage.map((m) => (
              <tr key={m.id} className="border-t border-slate-100 hover:bg-bordeaux-50/40 transition-colors">
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{m.ouvrier?.matricule}</td>
                <td className="px-3 py-2.5 text-slate-700">{m.ouvrier?.nom}</td>
                <td className="px-3 py-2.5 text-slate-700">{m.ouvrier?.prenom}</td>
                <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{m.ouvrier?.telephone || "—"}</td>
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
                      aria-label={`Modifier ${m.ouvrier?.prenom} ${m.ouvrier?.nom}`}
                      className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 bg-slate-50 border border-slate-200 hover:text-white hover:border-transparent transition ml-auto"
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.btn)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <Settings2 size={16} aria-hidden="true" />
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

      {/* Fenêtre d'édition du membre */}
      {edition && (
        <Modal
          titre={`${edition.ouvrier?.prenom} ${edition.ouvrier?.nom}`}
          onClose={() => setEdition(null)}
          bloquee={enregistrement}
        >
          <form onSubmit={handleEnregistrer} className="p-6 space-y-4">
            <p className="text-xs text-slate-500 -mt-1">
              {edition.ouvrier?.matricule} · {selection?.nom}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom">
                <Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              </Field>
              <Field label="Prénom">
                <Input required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
              </Field>
            </div>

            <Field label="Téléphone">
              <Input type="tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </Field>

            <Field label="Poste dans le département" hint="Un seul responsable et un seul adjoint par département.">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r.valeur} value={r.valeur}>
                    {r.libelle}
                  </option>
                ))}
              </Select>
            </Field>

            <button
              type="button"
              role="switch"
              aria-checked={form.actif}
              onClick={() => setForm({ ...form, actif: !form.actif })}
              className="flex items-center justify-between w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <span className="text-slate-500">Badge actif</span>
              <span
                aria-hidden="true"
                className={`w-10 h-6 rounded-full p-0.5 flex items-center transition ${form.actif ? "bg-bordeaux-600 justify-end" : "bg-slate-200 justify-start"}`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow" />
              </span>
            </button>

            {formErreur && (
              <p role="alert" className="text-xs text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-xl px-3 py-2">{formErreur}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Btn variant="ghost" size="sm" onClick={() => setEdition(null)}>
                Annuler
              </Btn>
              <div className="flex-1" />
              <Btn variant="secondary" size="sm" onClick={() => demanderRetirer(edition)} disabled={enregistrement}>
                Retirer du département
              </Btn>
              <Btn variant="softDanger" size="sm" onClick={() => demanderSupprimer(edition)} disabled={enregistrement}>
                Supprimer
              </Btn>
              <Btn type="submit" loading={enregistrement}>
                {enregistrement ? "Enregistrement…" : "Enregistrer"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmation retirer / supprimer */}
      <ConfirmDialog
        ouvert={!!confirmation}
        titre={confirmation?.titre ?? ""}
        message={confirmation?.message ?? ""}
        bouton={confirmation?.bouton ?? "Confirmer"}
        enCours={enregistrement}
        surAnnuler={() => setConfirmation(null)}
        surConfirmer={executerConfirmation}
      />
    </div>
  );
}