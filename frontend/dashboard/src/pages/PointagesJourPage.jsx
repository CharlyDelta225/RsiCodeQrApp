import { useEffect, useState, useCallback, useRef } from "react";
import { api, ApiError } from "../lib/api";
import { libelleDepartement } from "../lib/departement";

const INTERVALLE_ACTUALISATION_MS = 15000;

function dateDuJour(decalageJours = 0) {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

function formatHeure(iso) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function PointagesJourPage() {
  const [pointages, setPointages] = useState([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [derniereMaj, setDerniereMaj] = useState(null);
  const premierChargement = useRef(true);

  const [du, setDu] = useState(dateDuJour(0));
  const [au, setAu] = useState(dateDuJour(0));
  const [ouvrierId, setOuvrierId] = useState("");
  const [ouvriers, setOuvriers] = useState([]);

  useEffect(() => {
    api
      .getOuvriers({ limit: 500 })
      .then((data) => setOuvriers(data.ouvriers))
      .catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    if (premierChargement.current) setChargement(true);
    setErreur(null);
    try {
      const params = { du, au, limit: 200 };
      if (ouvrierId) params.ouvrierId = ouvrierId;
      const data = await api.getPointages(params);
      setPointages(data.pointages);
      setTotal(data.total);
      setDerniereMaj(new Date());
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
      premierChargement.current = false;
    }
  }, [du, au, ouvrierId]);

  useEffect(() => {
    charger();
    const intervalle = setInterval(charger, INTERVALLE_ACTUALISATION_MS);
    return () => clearInterval(intervalle);
  }, [charger]);

  function handleFiltrer(e) {
    e.preventDefault();
    charger();
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">
            {total} pointage(s) sur la période
          </h2>
          {derniereMaj && (
            <p className="text-xs text-slate-400">
              Actualisé à {derniereMaj.toLocaleTimeString("fr-FR")} · rafraîchissement automatique toutes les 15s
            </p>
          )}
        </div>
        <button
          onClick={charger}
          className="text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg px-3 py-2"
        >
          ↻ Actualiser
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
              <th className="px-3 py-2">Heure</th>
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
            {!chargement && pointages.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                  Aucun pointage sur cette période
                </td>
              </tr>
            )}
            {pointages.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{formatHeure(p.dateHeure)}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.ouvrier?.matricule}</td>
                <td className="px-3 py-2">{p.ouvrier?.nom}</td>
                <td className="px-3 py-2">{p.ouvrier?.prenom}</td>
                <td className="px-3 py-2">{libelleDepartement(p.ouvrier)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}