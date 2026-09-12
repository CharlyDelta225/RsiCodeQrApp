import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
} from "recharts";
import { api } from "../lib/api";
import KpiCard from "../components/KpiCard";
import Btn from "../ui/Btn";
import Spinner from "../ui/Spinner";

const JOURS_COURTS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
// Palette harmonisée sur l'identité RSI (bordeaux → or → teintes chaudes),
// répétée si plus de 18 départements.
const COULEURS_PIE = [
  "#8B1A1A", "#C0392B", "#A23A1F", "#B45309", "#D97706", "#D4A017",
  "#0F766E", "#0369A1", "#3B5BDB", "#6D28D9", "#A21CAF", "#BE185D",
  "#15803D", "#4D7C0F", "#7C4A1E", "#92400E", "#831843", "#475569",
];

const INTERVALLE_ACTUALISATION_MS = 60000;
const TIMEOUT_REQUETE_MS = 20000;

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

function formatHeure(iso) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function deptDe(p) {
  return p.ouvrier?.departements?.[0]?.departement?.nom || "Non renseigné";
}

/** Sélecteur segmenté 7 / 30 jours — pastille bordeaux sur l'option active. */
function EchelleSelector({ echelle, onEchelle }) {
  const options = [
    { valeur: "7", label: "7 j" },
    { valeur: "30", label: "30 j" },
  ];
  return (
    <div className="flex rounded-lg border border-slate-200 overflow-hidden flex-shrink-0">
      {options.map((o) => (
        <button
          key={o.valeur}
          type="button"
          onClick={() => onEchelle(o.valeur)}
          className={`px-3 py-1.5 text-xs font-medium transition ${
            echelle === o.valeur
              ? "bg-bordeaux-600 text-white"
              : "bg-white text-slate-500 hover:bg-bordeaux-50 hover:text-bordeaux-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [pointagesPeriode, setPointagesPeriode] = useState([]);
  const [pointagesAuj, setPointagesAuj] = useState([]);
  const [ouvriers, setOuvriers] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [derniereMaj, setDerniereMaj] = useState(null);
  const chargementEnCoursRef = useRef(false);
  const statsRef = useRef(null);

  const [echelle, setEchelle] = useState("7");
  const [deptSelectionne, setDeptSelectionne] = useState(null);

  const charger = useCallback(
    async (calme = false) => {
      const enCours = chargementEnCoursRef.current;
      chargementEnCoursRef.current = true;
      // Le voile de chargement ne s'affiche que tant qu'aucun indicateur n'a
      // jamais été chargé (premier affichage). Toute actualisation ultérieure
      // garde le tableau de bord visible pendant le rafraîchissement.
      if (statsRef.current === null && !calme) setChargement(true);
      setErreur(null);
      try {
        const auj = dateISO(0);
        const duPeriode = echelle === "30" ? dateISO(-29) : dateISO(-6);

        // Garde-fou : si le batch de requêtes dépasse le délai, on lève une
        // erreur claire au lieu de rester bloqué sur "Chargement…" indéfiniment
        // (file d'attente d'instances serverless, réseau lent…).
        const egaliteDuLot = new Promise((resolve, reject) => {
          const timer = setTimeout(
            () =>
              reject(new Error("Délai de chargement dépassé. L'application reste utilisable, réessayez dans un instant.")),
            TIMEOUT_REQUETE_MS
          );
          Promise.all([
            api.getOuvriers({ limit: 500 }),
            api.getPointages({ du: duPeriode, au: auj, limit: 2000 }),
            api.getPointages({ du: auj, au: auj, limit: 500 }),
          ])
            .then((vals) => {
              clearTimeout(timer);
              resolve(vals);
            })
            .catch((e) => {
              clearTimeout(timer);
              reject(e);
            });
        });

        const [dataOuvriers, dataPeriode, dataAuj] = await egaliteDuLot;

        const liste = dataOuvriers.ouvriers || [];
        const actifs = liste.filter((o) => o.actif).length;

        setOuvriers(liste);
        setPointagesPeriode(dataPeriode.pointages || []);
        setPointagesAuj(dataAuj.pointages || []);
        const nouvellesStats = {
          total: dataOuvriers.total ?? liste.length,
          actifs,
          desactives: (dataOuvriers.total ?? liste.length) - actifs,
          departements: new Set(
            liste.flatMap((o) =>
              (o.departements || []).map((l) => l?.departement?.nom).filter(Boolean)
            ) || []
          ).size,
          presentsAuj: (dataAuj.pointages || []).length,
        };
        statsRef.current = nouvellesStats;
        setStats(nouvellesStats);
        setDerniereMaj(new Date());
      } catch (err) {
        setErreur(err.message || "Erreur de chargement");
        if (statsRef.current === null) {
          const vide = { total: "—", actifs: "—", desactives: "—", departements: "—", presentsAuj: "—" };
          statsRef.current = vide;
          setStats(vide);
        }
      } finally {
        chargementEnCoursRef.current = false;
        if (statsRef.current !== null && !calme) setChargement(false);
      }
    },
    [echelle]
  );

  useEffect(() => {
    charger();
  }, [charger]);

  // Actualisation automatique discrète (sans écran de chargement) : on saute
  // un cycle si une mise à jour est déjà en cours pour éviter l'accumulation.
  useEffect(() => {
    const intervalle = setInterval(() => {
      if (!document.hidden && !chargementEnCoursRef.current) charger(true);
    }, INTERVALLE_ACTUALISATION_MS);
    return () => clearInterval(intervalle);
  }, [charger]);

  // Si le département sélectionné disparaît des données (fini les scans),
  // on referme le panneau de détail.
  useEffect(() => {
    if (!deptSelectionne) return;
    const existe = pointagesAuj.some((p) => deptDe(p) === deptSelectionne);
    if (!existe) setDeptSelectionne(null);
  }, [pointagesAuj, deptSelectionne]);

  const nbJours = echelle === "30" ? 30 : 7;

  // Évolution des présences sur la période choisie (7 ou 30 derniers jours)
  const dataParJour = useMemo(() => {
    const map = {};
    for (let i = nbJours - 1; i >= 0; i--) {
      const iso = dateISO(-i);
      map[iso] = { date: iso, label: labelJour(iso), presents: 0 };
    }
    for (const p of pointagesPeriode) {
      const iso = p.dateHeure?.slice(0, 10);
      if (iso && map[iso]) map[iso].presents += 1;
    }
    return Object.values(map);
  }, [pointagesPeriode, nbJours]);

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
    return heures.filter((x) => x.h >= 5 && x.h <= 20);
  }, [pointagesAuj]);

  // Présents par département aujourd'hui
  const dataParDept = useMemo(() => {
    const map = {};
    for (const p of pointagesAuj) {
      const dept = deptDe(p);
      map[dept] = (map[dept] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [pointagesAuj]);

  // Détail du département sélectionné sur le donut
  const membresDept = useMemo(() => {
    if (!deptSelectionne) return [];
    return pointagesAuj
      .filter((p) => deptDe(p) === deptSelectionne)
      .map((p) => ({
        nom: `${p.ouvrier?.prenom || ""} ${p.ouvrier?.nom || ""}`.trim(),
        matricule: p.ouvrier?.matricule || "—",
        heure: formatHeure(p.dateHeure),
      }));
  }, [deptSelectionne, pointagesAuj]);

  const absentsAuj = stats ? Math.max(0, stats.actifs - stats.presentsAuj) : 0;
  const centreValeur = deptSelectionne ? membresDept.length : stats?.presentsAuj;
  const centreLibelle = deptSelectionne ? "présents ici" : "présents";

  const tooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #f1f5f9" };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Bandeau : dernière actualisation + bouton rafraîchir */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-bordeaux-900">Vue d'ensemble</h2>
          <p className="text-xs text-slate-400">
            {derniereMaj
              ? `Actualisé à ${derniereMaj.toLocaleTimeString("fr-FR")} · auto toutes les 45 s`
              : "Chargement des indicateurs…"}
          </p>
        </div>
        <Btn variant="secondary" size="sm" onClick={() => charger(true)} icon="↻">
          Actualiser
        </Btn>
      </div>

      {erreur && (
        <p className="text-sm text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-3 py-2">
          {erreur}
        </p>
      )}

      {/* KPI cliquables */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          icon="👥"
          label="Ouvriers enregistrés"
          value={stats ? stats.total : "…"}
          accent="bordeaux"
          onClick={() => navigate("/ouvriers")}
        />
        <KpiCard
          icon="✅"
          label="Badges actifs"
          value={stats ? stats.actifs : "…"}
          sub={stats ? "prêts à badger" : undefined}
          accent="gold"
          onClick={() => navigate("/badges")}
        />
        <KpiCard
          icon="🟢"
          label="Présents aujourd'hui"
          value={stats ? stats.presentsAuj : "…"}
          accent="vert"
          onClick={() => navigate("/pointages")}
        />
        <KpiCard
          icon="⚪"
          label="Absents aujourd'hui"
          value={stats ? absentsAuj : "…"}
          accent="gris"
          onClick={() => navigate("/historique")}
        />
        <KpiCard
          icon="🏛"
          label="Départements"
          value={stats ? stats.departements : "…"}
          accent="bleu"
          onClick={() => navigate("/departements")}
        />
      </div>

      {chargement && (
        <div className="flex items-center justify-center gap-2 text-slate-400 py-8">
          <Spinner size="sm" />
          <span className="text-sm">Chargement des graphiques…</span>
        </div>
      )}

      {!chargement && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Évolution de la période sélectionnée */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">
                  Présences — {echelle === "30" ? "30" : "7"} derniers jours
                </h3>
                <p className="text-xs text-slate-400 mb-3">Nombre de badgeages par jour</p>
              </div>
              <EchelleSelector echelle={echelle} onEchelle={setEchelle} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataParJour} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: echelle === "30" ? 9 : 11 }}
                    interval={echelle === "30" ? 5 : 0}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => [`${v} présent(s)`, "Badgeages"]}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="presents" fill="#B23A2B" radius={[4, 4, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Répartition horaire du jour */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">
              Arrivées aujourd'hui par heure
            </h3>
            <p className="text-xs text-slate-400 mb-3">Pic d'activité de la journée</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataParHeure} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="heure" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => [`${v} badgeage(s)`, "Volume"]}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="badgeages" fill="#8B6914" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Par département — donut cliquable + détail */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">
              Présents aujourd'hui par département
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              {pointagesAuj.length === 0
                ? "Aucun badgeage pour le moment"
                : `${pointagesAuj.length} badgeage(s) enregistré(s) — cliquez sur un segment pour les détails`}
            </p>
            {dataParDept.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">
                Les données apparaîtront dès les premiers scans de la journée
              </p>
            ) : (
              <>
                <div className="flex flex-col md:flex-row items-center md:items-stretch gap-4">
                  {/* Donut + total au centre */}
                  <div className="relative h-56 w-full md:w-[45%] lg:w-[38%] mx-auto md:mx-0 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dataParDept}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius="88%"
                          innerRadius="62%"
                          paddingAngle={2}
                          cornerRadius={6}
                          stroke="none"
                          startAngle={90}
                          endAngle={-270}
                          cursor="pointer"
                          onClick={(entry) =>
                            setDeptSelectionne(entry.name === deptSelectionne ? null : entry.name)
                          }
                        >
                          {dataParDept.map((d, i) => (
                            <Cell
                              key={d.name}
                              fill={COULEURS_PIE[i % COULEURS_PIE.length]}
                              opacity={
                                deptSelectionne && deptSelectionne !== d.name ? 0.3 : 1
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => [`${v} présent(s)`, "Effectif"]}
                          contentStyle={tooltipStyle}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p
                        className="text-2xl font-extrabold text-bordeaux-900 leading-none tabular-nums"
                        style={{ fontFamily: "Poppins,sans-serif" }}
                      >
                        {centreValeur ?? "…"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">{centreLibelle}</p>
                    </div>
                  </div>

                  {/* Légende classée (cliquable) */}
                  <div className="flex-1 w-full min-w-0 md:overflow-y-auto md:max-h-56 pr-1 space-y-1">
                    {dataParDept.map((d, i) => {
                      const pct = pointagesAuj.length > 0 ? (d.value / pointagesAuj.length) * 100 : 0;
                      const actif = deptSelectionne === d.name;
                      return (
                        <button
                          key={d.name}
                          type="button"
                          onClick={() => setDeptSelectionne(actif ? null : d.name)}
                          className={`w-full flex items-center gap-2 py-1 px-1.5 rounded-lg transition-colors text-left ${
                            actif ? "bg-bordeaux-50 ring-1 ring-bordeaux-200" : "hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{
                              background: COULEURS_PIE[i % COULEURS_PIE.length],
                              opacity: deptSelectionne && !actif ? 0.35 : 1,
                            }}
                          />
                          <span className="text-xs text-slate-700 font-medium truncate flex-1 min-w-0">
                            {d.name}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-800 tabular-nums flex-shrink-0">
                            {d.value}
                          </span>
                          <span className="w-11 text-right text-[11px] text-slate-400 tabular-nums flex-shrink-0">
                            {pct.toFixed(0)}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Détail du département sélectionné */}
                {deptSelectionne && (
                  <div className="border-t border-slate-100 pt-3 mt-3">
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <h4 className="text-xs font-semibold text-bordeaux-900">
                        {deptSelectionne} — {membresDept.length} présent(s)
                      </h4>
                      <button
                        type="button"
                        onClick={() => setDeptSelectionne(null)}
                        className="text-[11px] font-medium text-slate-400 hover:text-bordeaux-700 transition-colors"
                      >
                        ✕ Fermer
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                      {membresDept.map((m, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50"
                        >
                          <span className="text-xs text-slate-700 truncate flex-1 min-w-0">
                            {m.nom}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                            {m.matricule}
                          </span>
                          <span className="text-[10px] font-semibold text-bordeaux-700 tabular-nums flex-shrink-0">
                            {m.heure}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}