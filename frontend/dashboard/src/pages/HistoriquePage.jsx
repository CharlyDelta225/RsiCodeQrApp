import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../lib/api";
import { telechargerBlob } from "../lib/download";

const LIMIT = 50;

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

// Échappe une valeur pour l'insérer dans un CSV (guillemets doublés si présents).
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

  // Charge la liste des ouvriers une seule fois pour peupler le filtre.
  useEffect(() => {
    api
      .getOuvriers({ limit: 200 })
      .then((data) => setOuvriers(data.ouvriers))
      .catch(() => {
        /* le filtre par ouvrier reste juste vide en cas d'échec, non bloquant */
      });
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
      [formatDateHeure(p.dateHeure), p.ouvrier?.matricule, p.ouvrier?.nom, p.ouvrier?.prenom, p.ouvrier?.departement]
        .map(csvValeur)
        .join(";")
    );
    // BOM UTF-8 pour qu'Excel affiche correctement les accents
    const csv = "\uFEFF" + [entete.join(";"), ...lignes].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    telechargerBlob(blob, `historique-pointages_${du}_a_${au}_page${page}.csv`);
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700">{total} pointage(s) sur la période</h2>
        <button
          onClick={handleExporterCsv}
          disabled={pointages.length === 0}
          className="text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-50 rounded-lg px-3 py-2"
        >
          ⬇ Exporter cette page en CSV
        </button>
      </div>

      {erreur && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erreur}</p>
      )}

      <form onSubmit={handleFiltrer} className="flex flex-wrap items-end gap-2 bg-white border border-slate-200 rounded-xl p-3">
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
              <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Chargement…</td></tr>
            )}
            {!chargement && pointages.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Aucun pointage sur cette période</td></tr>
            )}
            {pointages.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-xs">{formatDateHeure(p.dateHeure)}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.ouvrier?.matricule}</td>
                <td className="px-3 py-2">{p.ouvrier?.nom}</td>
                <td className="px-3 py-2">{p.ouvrier?.prenom}</td>
                <td className="px-3 py-2">{p.ouvrier?.departement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40"
          >
            ← Précédent
          </button>
          <span className="text-slate-500">Page {page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
