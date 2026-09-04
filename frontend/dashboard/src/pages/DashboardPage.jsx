import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { api } from "../lib/api";
import KpiCard from "../components/KpiCard";

const JOURS_COURTS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const COULEURS_PIE = ["#b91c1c", "#0f766e", "#0369a1", "#a16207", "#7c3aed", "#be185d", "#15803d"];

function dateISO(decalageJours = 0) {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${j}`;
}

function labelJour(iso) {
  const d = new Date(iso + "T12:00:00");
  return JOURS_COURTS[d.getDay()] + " " + d.getDate();
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [pointages7j, setPointages7j] = useState([]);
  const [pointagesAuj, setPointagesAuj] = useState([]);
  const [ouvriers, setOuvriers] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;

    async function charger() {
      setChargement(true);
      setErreur(null);
      try {
        const du7 = dateISO(-6);
        const auj = dateISO(0);

        const [dataOuvriers, data7j, dataAuj] = await Promise.all([
          api.getOuvriers({ limit: 500 }),
          api.getPointages({ du: du7, au: auj, limit: 1000 }),
          api.getPointages({ du: auj, au: auj, limit: 500 }),
        ]);

        if (annule) return;

        const liste = dataOuvriers.ouvriers || [];
        const actifs = liste.filter((o) => o.actif).length;

        setOuvriers(liste);
        setPointages7j(data7j.pointages || []);
        setPointagesAuj(dataAuj.pointages || []);
        setStats({
          total: dataOuvriers.total ?? liste.length,
          actifs,
          desactives: (dataOuvriers.total ?? liste.length) - actifs,
          departements: new Set(liste.map((o) => o.departement).filter(Boolean)).size,
          presentsAuj: (dataAuj.pointages || []).length,
        });
      } catch (err) {
        if (!annule) setErreur(err.message || "Erreur de chargement");
      } finally {
        if (!annule) setChargement(false);
      }
    }

    charger();
    return () => {
      annule = true;
    };
  }, []);

  // Présences par jour (7 derniers jours)
  const dataParJour = useMemo(() => {
    const map = {};
    for (let i = 6; i >= 0; i--) {
      const iso = dateISO(-i);
      map[iso] = { date: iso, label: labelJour(iso), presents: 0 };
    }
    for (const p of pointages7j) {
      const iso = p.dateHeure?.slice(0, 10);
      if (iso && map[iso]) map[iso].presents += 1;
    }
    return Object.values(map);
  }, [pointages7j]);

  // Répartition horaire du jour
  const dataParHeure = useMemo(() => {
    const heures = Array.from({ length: 24 }, (_, h) => ({
      heure: `${String(h).padStart(2, "0")}h`,
      h,
      badgeages: 0,
    }));
    for (const p of pointagesAuj) {
      const h = new Date(p.dateHeure).getHours();
      if (h >= 0 && h < 24) heures[h].badgeages += 1;
    }
    // On n'affiche que la plage utile (5h → 20h) pour la lisibilité
    return heures.filter((x) => x.h >= 5 && x.h <= 20);
  }, [pointagesAuj]);

  // Présents par département aujourd'hui
  const dataParDept = useMemo(() => {
    const map = {};
    for (const p of pointagesAuj) {
      const dept = p.ouvrier?.departement || "Non renseigné";
      map[dept] = (map[dept] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [pointagesAuj]);

  const absentsAuj = stats ? Math.max(0, stats.actifs - stats.presentsAuj) : 0;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {erreur && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {erreur}
        </p>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
          icon="🟢"
          label="Présents aujourd'hui"
          value={stats ? stats.presentsAuj : "…"}
          sub={stats ? `sur ${stats.actifs} actifs` : undefined}
          color="bg-green-50 text-green-700"
        />
        <KpiCard
          icon="⚪"
          label="Absents aujourd'hui"
          value={stats ? absentsAuj : "…"}
          color="bg-slate-50 text-slate-600"
        />
        <KpiCard
          icon="🏛"
          label="Départements"
          value={stats ? stats.departements : "…"}
          color="bg-sky-50 text-sky-700"
        />
      </div>

      {chargement && (
        <p className="text-sm text-slate-400 text-center py-8">Chargement des graphiques…</p>
      )}

      {!chargement && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Évolution 7 jours */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">
              Présences — 7 derniers jours
            </h3>
            <p className="text-xs text-slate-400 mb-3">Nombre de badgeages par jour</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataParJour} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => [`${v} présent(s)`, "Badgeages"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="presents" fill="#b91c1c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Répartition horaire du jour */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">
              Arrivées aujourd'hui par heure
            </h3>
            <p className="text-xs text-slate-400 mb-3">Pic d’activité de la journée</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataParHeure} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="heure" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => [`${v} badgeage(s)`, "Volume"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="badgeages" fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Par département */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">
              Présents aujourd'hui par département
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              {pointagesAuj.length === 0
                ? "Aucun badgeage pour le moment"
                : `${pointagesAuj.length} badgeage(s) enregistré(s)`}
            </p>
            {dataParDept.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">
                Les données apparaîtront dès les premiers scans de la journée
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataParDept}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={45}
                      paddingAngle={2}
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                    >
                      {dataParDept.map((_, i) => (
                        <Cell key={i} fill={COULEURS_PIE[i % COULEURS_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [`${v} présent(s)`, "Effectif"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}