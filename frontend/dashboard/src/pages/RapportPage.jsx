import { useEffect, useState, useCallback } from "react";
import { Download, FileDown, Mail } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { telechargerBlob } from "../lib/download";
import { getAdmin } from "../lib/auth";
import PaginationBar from "../components/PaginationBar";
import TableShell from "../ui/TableShell";
import Card from "../ui/Card";
import Pill from "../ui/Pill";
import Btn from "../ui/Btn";
import { Field, Input, Select } from "../ui/inputs";

const ROLE_ECRITURE = ["ADMIN", "SUPER_ADMIN"];
const LIMIT = 17;

function peutEcrire() {
  return ROLE_ECRITURE.includes(getAdmin()?.role);
}

function dateDuJour() {
  const d = new Date();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

function csvValeur(v) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Message clair d'un échec d'envoi email, basé sur le code machine renvoyé par
// l'API (cf. docs/api-contrat.md : le front se branche sur les codes).
function messageEchecEnvoi(code, messageApi) {
  const dict = {
    SMTP_NON_CONFIGURE:
      "L'envoi par email n'est pas configuré.",
    SANS_DESTINATAIRE:
      "Aucun destinataire : saisissez au moins une adresse ou configurez des destinataires par défaut.",
  };
  return dict[code] || messageApi || "L'envoi a échoué";
}

export default function RapportPage() {
  const [date, setDate] = useState(dateDuJour());
  const [departementId, setDepartementId] = useState("");
  const [departements, setDepartements] = useState([]);

  const [rapport, setRapport] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [page, setPage] = useState(1);
  const [exportEnCours, setExportEnCours] = useState(false);

  // Dialoque d'envoi email manuel
  const [envoiOuvert, setEnvoiOuvert] = useState(false);
  const [destinatairesTxt, setDestinatairesTxt] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [retourEnvoi, setRetourEnvoi] = useState(null); // { ok, message }

  useEffect(() => {
    api
      .getDepartements({ limit: 100 })
      .then((data) => setDepartements(data.departements))
      .catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const params = { date };
      if (departementId) params.departementId = departementId;
      const data = await api.getRapportJournalier(params);
      setRapport(data.rapport);
    } catch (err) {
      setRapport(null);
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, [date, departementId]);

  useEffect(() => {
    charger();
    setPage(1); // un changement de filtre repart de la page 1
  }, [charger]);

  function handleFiltrer(e) {
    e.preventDefault();
    setPage(1);
    charger();
  }

  // Lignes affichées : toutes les lignes du(des) département(s) de la sélection.
  const departementsAffiches = rapport?.departements ?? [];
  const lignesAffichees = departementsAffiches.flatMap((dep) =>
    dep.lignes.map((ligne) => ({ ligne, nomDepartement: dep.nom }))
  );
  const totaux = rapport?.recap;

  // Pagination (page éventuellement au-delà de la dernière après un filtre si
  // on ne repassait pas par la page 1 : on la borne au maximum).
  const totalPages = Math.max(1, Math.ceil(lignesAffichees.length / LIMIT));
  const pageCourante = Math.min(page, totalPages);
  const lignesPage = lignesAffichees.slice(
    (pageCourante - 1) * LIMIT,
    pageCourante * LIMIT
  );

  function handleExporterCsv() {
    const dateRapport = rapport?.dateISO ?? date;
    const entete = ["Date", "Matricule", "Nom", "Prénom", "Département", "Statut", "Heure"];
    const lignes = lignesAffichees.map(({ ligne, nomDepartement }) =>
      [
        dateRapport,
        ligne.matricule,
        ligne.nom,
        ligne.prenom,
        nomDepartement,
        ligne.present ? "PRÉSENT" : "ABSENT",
        ligne.heure ?? "",
      ]
        .map(csvValeur)
        .join(";")
    );
    const csv = "\uFEFF" + [entete.join(";"), ...lignes].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const depAbrege =
      departements.find((d) => d.id === departementId)?.nom.replace(/\s+/g, "_") || "tous";
    telechargerBlob(blob, `rapport-pointage_${dateRapport}_${depAbrege}.csv`);
  }

  function handleExporterPdf() {
    setExportEnCours(true);
    setTimeout(() => {
      window.print();
      setExportEnCours(false);
    }, 150);
  }

  function ouvrirModalEnvoi() {
    setDestinatairesTxt("");
    setRetourEnvoi(null);
    setEnvoiOuvert(true);
  }

  async function handleEnvoyerEmail() {
    setEnvoiEnCours(true);
    setRetourEnvoi(null);
    try {
      const destinataires = destinatairesTxt
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      const body = { date };
      if (destinataires.length > 0) body.destinataires = destinataires;

      const data = await api.envoyerRapportJournalier(body);
      const liste = data.email?.destinataires?.join(", ") || "";
      setRetourEnvoi({
        ok: true,
        message: `Email envoyé à : ${liste}`,
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? messageEchecEnvoi(err.code, err.message)
          : "Une erreur interne est survenue";
      setRetourEnvoi({ ok: false, message });
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="rapport-page p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="no-print flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "Poppins,sans-serif" }}>
            Rapports de pointage
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Consultez, exportez ou envoyez le rapport d’une journée.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {peutEcrire() && (
            <Btn
              variant="secondary"
              onClick={handleExporterPdf}
              loading={exportEnCours}
              disabled={chargement || !rapport}
              icon={<FileDown size={16} />}
            >
              {exportEnCours ? "Préparation…" : "Exporter en PDF"}
            </Btn>
          )}
          {peutEcrire() && (
            <Btn variant="primary" onClick={ouvrirModalEnvoi} disabled={chargement || !rapport} icon={<Mail size={16} />}>
              Envoyer par email
            </Btn>
          )}
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "Poppins,sans-serif" }}>
          Rapport de pointage — {rapport?.dateLongueur || date}
        </h1>
      </div>

      {erreur && (
        <p className="text-sm text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-3 py-2">
          {erreur}
        </p>
      )}

      <Card
        title="Filtrer le rapport"
        description="Choisissez une date et, si besoin, un département."
        className="no-print"
      >
        <form onSubmit={handleFiltrer} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-end">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Département">
            <Select value={departementId} onChange={(e) => setDepartementId(e.target.value)}>
              <option value="">Tous les départements</option>
              {departements.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Btn type="submit" disabled={chargement} loading={chargement}>
            {chargement ? "Chargement…" : "Afficher"}
          </Btn>
        </form>
      </Card>

      {rapport && (
        <Card
          title={`${rapport.jourLabel} ${rapport.dateLongueur}`}
          description={rapport.notePresence}
          actions={
            <div className="flex items-center gap-2">
              <Pill tonalite="vert">Présents : {totaux?.presents ?? 0}</Pill>
              <Pill tonalite="rouge">Absents : {totaux?.absents ?? 0}</Pill>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Effectif</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1" style={{ fontFamily: "Poppins,sans-serif" }}>
                {totaux?.effectif ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-emerald-700">Présents</p>
              <p className="text-2xl font-semibold text-emerald-800 mt-1" style={{ fontFamily: "Poppins,sans-serif" }}>
                {totaux?.presents ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-bordeaux-200 bg-bordeaux-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-bordeaux-700">Absents</p>
              <p className="text-2xl font-semibold text-bordeaux-800 mt-1" style={{ fontFamily: "Poppins,sans-serif" }}>
                {totaux?.absents ?? 0}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card
        title="Détail des pointages"
        description={`${lignesAffichees.length} ligne(s) affichée(s)`}
        className="no-print"
        actions={
          peutEcrire() ? (
            <Btn
              variant="ghost"
              size="xs"
              onClick={handleExporterCsv}
              disabled={lignesAffichees.length === 0}
              icon={<Download size={14} />}
              title="Exporter en CSV"
            >
              CSV
            </Btn>
          ) : null
        }
      >
        <TableShell
          colonnes={["Matricule", "Nom", "Prénom", "Département", "Statut", "Heure"]}
          chargement={chargement}
          vide={
            !chargement && rapport && lignesAffichees.length === 0
              ? "Aucun ouvrier rattaché à la sélection"
              : "Aucune donnée"
          }
        >
          {lignesPage.map(({ ligne, nomDepartement }, index) => (
            <tr key={`${nomDepartement}-${ligne.matricule}-${index}`} className="border-t border-slate-100 hover:bg-bordeaux-50/40 transition-colors">
              <td className="px-3 py-2 font-mono text-xs">{ligne.matricule}</td>
              <td className="px-3 py-2">{ligne.nom}</td>
              <td className="px-3 py-2">{ligne.prenom}</td>
              <td className="px-3 py-2">{nomDepartement}</td>
              <td className="px-3 py-2">
                <Pill tonalite={ligne.present ? "vert" : "rouge"}>
                  {ligne.present ? "Présent" : "Absent"}
                </Pill>
              </td>
              <td className="px-3 py-2 text-xs">{ligne.heure ?? "—"}</td>
            </tr>
          ))}
        </TableShell>

        <div className="no-print">
          <PaginationBar
            page={pageCourante}
            totalPages={totalPages}
            onPage={setPage}
            total={lignesAffichees.length}
            label="ouvrier(s)"
          />
        </div>
      </Card>

      <div className="rapport-print-only hidden print:block">
        <h2 className="text-sm font-semibold text-slate-800 mb-2" style={{ fontFamily: "Poppins,sans-serif" }}>
          Détail des pointages ({lignesAffichees.length})
        </h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-bordeaux-50 text-bordeaux-900">
              {["Matricule", "Nom", "Prénom", "Département", "Statut", "Heure"].map((c) => (
                <th key={c} className="text-left px-2 py-1.5 border border-slate-300 text-[10px] uppercase tracking-wide">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignesAffichees.map(({ ligne, nomDepartement }, index) => (
              <tr key={`print-${nomDepartement}-${ligne.matricule}-${index}`} className="border-b border-slate-200">
                <td className="px-2 py-1.5 border border-slate-200 font-mono text-[10px]">{ligne.matricule}</td>
                <td className="px-2 py-1.5 border border-slate-200">{ligne.nom}</td>
                <td className="px-2 py-1.5 border border-slate-200">{ligne.prenom}</td>
                <td className="px-2 py-1.5 border border-slate-200">{nomDepartement}</td>
                <td className="px-2 py-1.5 border border-slate-200">{ligne.present ? "Présent" : "Absent"}</td>
                <td className="px-2 py-1.5 border border-slate-200 text-xs">{ligne.heure ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {envoiOuvert && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="font-semibold text-slate-800 text-sm" style={{ fontFamily: "Poppins,sans-serif" }}>
                Envoyer le rapport par email
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Un PDF par département + le récapitulatif seront joints au mail
                du <span className="font-medium text-slate-700">{rapport?.dateLongueur}</span>.
              </p>
              <label className="block text-xs text-slate-500 mt-4 mb-1">
                Destinataires (séparés par des virgules) — vide = destinataires par défaut
              </label>
              <input
                type="text"
                value={destinatairesTxt}
                onChange={(e) => setDestinatairesTxt(e.target.value)}
                placeholder="ex : pasteur@eglise.org, secretaire@eglise.org"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                disabled={envoiEnCours}
              />
              {retourEnvoi && (
                <p
                  className={
                    "mt-3 text-xs rounded-lg px-3 py-2 " +
                    (retourEnvoi.ok
                      ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                      : "text-red-700 bg-red-50 border border-red-200")
                  }
                >
                  {retourEnvoi.message}
                </p>
              )}
            </div>
            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <Btn variant="secondary" onClick={() => setEnvoiOuvert(false)} disabled={envoiEnCours}>
                Fermer
              </Btn>
              <Btn type="button" onClick={handleEnvoyerEmail} disabled={envoiEnCours} loading={envoiEnCours}>
                {envoiEnCours ? "Envoi…" : "Envoyer"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}