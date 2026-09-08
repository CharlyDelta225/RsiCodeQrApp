import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../lib/api";
import { telechargerBlob } from "../lib/download";
import { getAdmin } from "../lib/auth";

const ROLE_ECRITURE = ["ADMIN", "SUPER_ADMIN"];

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
      "Envoi email non configuré : renseignez SMTP_HOST (et SMTP_USER/SMTP_PASS) dans le .env du backend.",
    SANS_DESTINATAIRE:
      "Aucun destinataire : saisissez des adresses ci-dessus ou renseignez RAPPORT_EMAIL_DESTINATAIRES dans le .env du backend.",
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
  }, [charger]);

  function handleFiltrer(e) {
    e.preventDefault();
    charger();
  }

  // Lignes affichées : toutes les lignes du(des) département(s) de la sélection.
  const departementsAffiches = rapport?.departements ?? [];
  const lignesAffichees = departementsAffiches.flatMap((dep) =>
    dep.lignes.map((ligne) => ({ ligne, nomDepartement: dep.nom }))
  );
  const totaux = rapport?.recap;

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
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700">
          {rapport
            ? `${totaux.effectif} ouvrier(s) · ${totaux.presents} présent(s) · ${totaux.absents} absent(s)`
            : "Rapport de pointage"}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExporterCsv}
            disabled={lignesAffichees.length === 0}
            className="text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-50 rounded-lg px-3 py-2"
          >
            ⬇ Exporter en CSV
          </button>
          {peutEcrire() && (
            <button
              onClick={ouvrirModalEnvoi}
              disabled={chargement || !rapport}
              className="text-sm font-medium text-white rounded-lg px-3 py-2 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#C0392B,#922B21)" }}
            >
              ✉ Envoyer par email
            </button>
          )}
        </div>
      </div>

      {erreur && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {erreur}
        </p>
      )}

      <form
        onSubmit={handleFiltrer}
        className="flex flex-wrap items-end gap-2 bg-white border border-slate-200 rounded-xl p-3"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs text-slate-500">Département</label>
          <select
            value={departementId}
            onChange={(e) => setDepartementId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="">Tous les départements</option>
            {departements.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg px-3 py-2"
        >
          Filtrer
        </button>
      </form>

      {rapport && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
            {rapport.jourLabel} {rapport.dateLongueur}
          </span>
          <span className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
            {rapport.notePresence}
          </span>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
            Présents : {totaux.presents}
          </span>
          <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
            Absents : {totaux.absents}
          </span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2">Matricule</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Prénom</th>
              <th className="px-3 py-2">Département</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Heure</th>
            </tr>
          </thead>
          <tbody>
            {chargement && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                  Chargement…
                </td>
              </tr>
            )}
            {!chargement && rapport && lignesAffichees.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                  Aucun ouvrier rattaché à la sélection
                </td>
              </tr>
            )}
            {!chargement && !rapport && !erreur && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                  Aucune donnée
                </td>
              </tr>
            )}
            {lignesAffichees.map(({ ligne, nomDepartement }, index) => (
              <tr key={`${nomDepartement}-${ligne.matricule}-${index}`} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{ligne.matricule}</td>
                <td className="px-3 py-2">{ligne.nom}</td>
                <td className="px-3 py-2">{ligne.prenom}</td>
                <td className="px-3 py-2">{nomDepartement}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      "text-xs font-bold px-2 py-0.5 rounded-full " +
                      (ligne.present
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700")
                    }
                  >
                    {ligne.present ? "PRÉSENT" : "ABSENT"}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{ligne.heure ?? "—"}</td>
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
              <button
                type="button"
                onClick={() => setEnvoiOuvert(false)}
                disabled={envoiEnCours}
                className="text-sm font-medium text-slate-600 bg-slate-50 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-full px-5 py-2 transition"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleEnvoyerEmail}
                disabled={envoiEnCours}
                className="text-sm font-medium text-white disabled:opacity-50 rounded-full px-5 py-2 shadow-sm transition"
                style={{ background: "linear-gradient(135deg,#C0392B,#922B21)" }}
              >
                {envoiEnCours ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}