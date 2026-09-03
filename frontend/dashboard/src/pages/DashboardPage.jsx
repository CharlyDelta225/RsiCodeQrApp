import { useEffect, useState } from "react";
import { api } from "../lib/api";
import KpiCard from "../components/KpiCard";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    api
      .getOuvriers({ limit: 200 })
      .then((data) => {
        const actifs = data.ouvriers.filter((o) => o.actif).length;
        const departements = new Set(data.ouvriers.map((o) => o.departement)).size;
        setStats({ total: data.total, actifs, desactives: data.total - actifs, departements });
      })
      .catch((err) => setErreur(err.message));
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {erreur && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erreur}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon="👥"
          label="Ouvriers enregistrés"
          value={stats ? stats.total : "…"}
        />
        <KpiCard
          icon="✅"
          label="Badges actifs"
          value={stats ? stats.actifs : "…"}
          sub={stats ? "prêts à badger" : undefined}
          color="bg-emerald-50 text-emerald-700"
        />
        <KpiCard
          icon="⛔"
          label="Badges désactivés"
          value={stats ? stats.desactives : "…"}
          color="bg-amber-50 text-amber-700"
        />
        <KpiCard
          icon="🏛"
          label="Départements"
          value={stats ? stats.departements : "…"}
          color="bg-sky-50 text-sky-700"
        />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-red-50">
        <p className="text-sm font-semibold text-gray-800 mb-2" style={{ fontFamily: "Poppins,sans-serif" }}>
          Prochaines étapes
        </p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Historique des pointages (badgeages en temps réel)</li>
          <li>Terminal de badgeage connecté au lecteur physique</li>
          <li>Export Excel de la liste des ouvriers</li>
        </ul>
      </div>
    </div>
  );
}
