import { useEffect, useState, useCallback, useRef } from "react";
import { api, ApiError } from "../lib/api";

// Intervalle d'actualisation automatique (le terminal badge en continu pendant
// le service — utile d'avoir une vue "en temps réel" sans recharger la page).
const INTERVALLE_ACTUALISATION_MS = 15000;

function dateDuJour() {
  const d = new Date();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

function formatHeure(iso) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function PointagesJourPage() {
  const [pointages, setPointages] = useState([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [derniereMaj, setDerniereMaj] = useState(null);
  const premierChargement = useRef(true);

  const charger = useCallback(async () => {
    // Pas de flash "Chargement…" lors des rafraîchissements automatiques,
    // seulement au tout premier affichage.
    if (premierChargement.current) setChargement(true);
    setErreur(null);
    try {
      const aujourdhui = dateDuJour();
      const data = await api.getPointages({ du: aujourdhui, au: aujourdhui, limit: 200 });
      setPointages(data.pointages);
      setTotal(data.total);
      setDerniereMaj(new Date());
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
      premierChargement.current = false;
    }
  }, []);

  useEffect(() => {
    charger();
    const intervalle = setInterval(charger, INTERVALLE_ACTUALISATION_MS);
    return () => clearInterval(intervalle);
  }, [charger]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">{total} pointage(s) aujourd'hui</h2>
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
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erreur}</p>
      )}

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
              <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Chargement…</td></tr>
            )}
            {!chargement && pointages.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Aucun pointage aujourd'hui pour le moment</td></tr>
            )}
            {pointages.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{formatHeure(p.dateHeure)}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.ouvrier?.matricule}</td>
                <td className="px-3 py-2">{p.ouvrier?.nom}</td>
                <td className="px-3 py-2">{p.ouvrier?.prenom}</td>
                <td className="px-3 py-2">{p.ouvrier?.departement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
