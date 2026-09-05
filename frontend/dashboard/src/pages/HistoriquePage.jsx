import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../lib/api";
import { telechargerBlob } from "../lib/download";
import { libelleDepartement } from "../lib/departement";
import PaginationBar from "../components/PaginationBar";

const LIMIT = 17;
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function dateDuJour(decalageJours = 0) {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

function formatDateHeure(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function csvValeur(v) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function HistoriquePage() {
  const [pointages, setPointages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [du, setDu] = useState(dateDuJour(-7));
  const [au, setAu] = useState(dateDuJour(0));
  const [ouvrierId, setOuvrierId] = useState("");
  const [ouvriers, setOuvriers] = useState([]);
  const [jourSemaine, setJourSemaine] = useState("");

  useEffect(() => {
    api
      .getOuvriers({ limit: 500 })
      .then((data) => setOuvriers(data.ouvriers))
      .catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const params = { du, au, page, limit: LIMIT };
      if (ouvrierId) params.ouvrierId = ouvrierId;
      const data = await api.getPointages(params);
      setPointages(data.pointages);
      setTotal(data.total);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, [du, au, ouvrierId, page]);

  useEffect(() => {
    charger();
  }, [charger]);

  function handleFiltrer(e) {
    e.preventDefault();
    setPage(1);
    charger();
  }

  function handleExporterCsv() {
    const entete = ["Date/heure", "Matricule", "Nom", "Prénom", "Département"];
    const lignes = pointages.map((p) =>
      [
        formatDateHeure(p.dateHeure),
        p.ouvrier?.matricule,
        p.ouvrier?.nom,
        p.ouvrier?.prenom,
        libelleDepartement(p.ouvrier),
      ]
        .map(csvValeur)
        .join(";")
    );
    const csv = "\uFEFF" + [entete.join(";"), ...lignes].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    telechargerBlob(blob, `historique-pointages_${du}_a_${au}_page${page}.csv`);
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const pointagesAffiches =
    jourSemaine === ""
      ? pointages
      : pointages.filter((p) => new Date(p.dateHeure).getDay() === Number(jourSemaine));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700">
          {pointagesAffiches.length} pointage(s) affiché(s) sur {total}
        </h2>
        <button
          onClick={handleExporterCsv}
          disabled={pointages.length === 0}
          className="text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-50 rounded-lg px-3 py-2"
        >
          ⬇ Exporter cette page en CSV
        </button>
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
          <label className="text-xs text-slate-500">Du</label>
          <input
            type="date"
            value={du}
            onChange={(e) => setDu(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Au</label>
          <input
            type="date"
            value={au}
            onChange={(e) => setAu(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-xs text-slate-500">Ouvrier</label>
          <select
            value={ouvrierId}
            onChange={(e) => setOuvrierId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="">Tous les ouvriers</option>
            {ouvriers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.prenom} {o.nom} — {o.matricule}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Jour de la semaine</label>
          <select
            value={jourSemaine}
            onChange={(e) => setJourSemaine(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="">Tous les jours</option>
            {JOURS.map((nom, index) => (
              <option key={index} value={index}>
                {nom}
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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2">Date / heure</th>
              <th className="px-3 py-2">Matricule</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Prénom</th>
              <th className="px-3 py-2">Département</th>
            </tr>
          </thead>
          <tbody>
            {chargement && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                  Chargement…
                </td>
              </tr>
            )}
            {!chargement && pointagesAffiches.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                  Aucun pointage sur cette période
                </td>
              </tr>
            )}
            {pointagesAffiches.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-xs">{formatDateHeure(p.dateHeure)}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.ouvrier?.matricule}</td>
                <td className="px-3 py-2">{p.ouvrier?.nom}</td>
                <td className="px-3 py-2">{p.ouvrier?.prenom}</td>
                <td className="px-3 py-2">{libelleDepartement(p.ouvrier)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationBar page={page} totalPages={totalPages} onPage={setPage} total={total} label="pointage(s)" />
    </div>
  );
}