import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { api } from "./api";
import Pill from "../ui/Pill";

// ==============================
// Temple sélectionné dans le dashboard
//
// Un sélecteur global (barre du haut) filtre toutes les pages : tableau de
// bord, ouvriers, pointages, historique, départements, rapport. "" = tous les
// temples. Le choix est mémorisé par navigateur.
// ==============================

const CLE_STOCKAGE = "rsi:temple";
const TempleContext = createContext(null);

function lireChoix() {
  try {
    return localStorage.getItem(CLE_STOCKAGE) || "";
  } catch {
    return "";
  }
}

export function TempleProvider({ children }) {
  const [eglises, setEglises] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [egliseId, setEgliseIdBrut] = useState(lireChoix);

  const recharger = useCallback(() => {
    setErreur(null);
    return api
      .getEglises()
      .then((data) => setEglises(data.eglises))
      .catch(() => setErreur("La liste des temples n'a pas pu être chargée."));
  }, []);

  useEffect(() => {
    recharger();
  }, [recharger]);

  // Un choix mémorisé qui ne correspond plus à un temple actif est oublié.
  useEffect(() => {
    if (egliseId && eglises.length > 0 && !eglises.some((e) => e.id === egliseId && e.actif)) {
      setEgliseIdBrut("");
    }
  }, [eglises, egliseId]);

  const setEgliseId = useCallback((id) => {
    setEgliseIdBrut(id);
    try {
      if (id) localStorage.setItem(CLE_STOCKAGE, id);
      else localStorage.removeItem(CLE_STOCKAGE);
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
  }, []);

  const valeur = useMemo(() => {
    const actives = eglises.filter((e) => e.actif);
    return {
      eglises,
      actives,
      erreur,
      egliseId,
      setEgliseId,
      recharger,
      egliseCourante: eglises.find((e) => e.id === egliseId) ?? null,
      siege: eglises.find((e) => e.estSiege) ?? null,
    };
  }, [eglises, erreur, egliseId, setEgliseId, recharger]);

  return <TempleContext.Provider value={valeur}>{children}</TempleContext.Provider>;
}

export function useTemple() {
  const ctx = useContext(TempleContext);
  if (!ctx) throw new Error("useTemple doit être utilisé sous <TempleProvider>");
  return ctx;
}

/** Paramètre de requête du temple sélectionné ({} si « Tous les temples »). */
export function paramTemple(egliseId) {
  return egliseId ? { egliseId } : {};
}

const TONALITES = { SHALOM: "rouge", ADJAHUI: "bleu", QUATRE_CROIX: "vert" };

/** Libellé court d'un temple : « Temple de 4 CROIX » → « 4 CROIX ». */
export function nomCourt(eglise) {
  if (!eglise?.nom) return "—";
  return eglise.nom.replace(/^temple\s+(de\s+|du\s+)?/i, "");
}

/** Pastille colorée d'un temple. */
export function TemplePill({ eglise, court = true, suffixe }) {
  if (!eglise) return <span className="text-slate-400">—</span>;
  return (
    <Pill tonalite={TONALITES[eglise.code] || "or"}>
      {court ? nomCourt(eglise) : eglise.nom}
      {suffixe}
    </Pill>
  );
}

/** Pastille du lieu d'un pointage, ambrée et marquée « visiteur » hors du temple de l'ouvrier. */
export function LieuPill({ lieu, visiteur }) {
  if (!lieu) return <span className="text-slate-400">—</span>;
  if (!visiteur) return <span className="text-xs text-slate-600">{nomCourt(lieu)}</span>;
  return (
    <Pill tonalite="orange">
      <MapPin size={11} aria-hidden="true" />
      {nomCourt(lieu)} · visiteur
    </Pill>
  );
}

/** Sélecteur global (barre du haut). */
export function TempleSelector({ className = "" }) {
  const { actives, egliseId, setEgliseId } = useTemple();
  if (actives.length === 0) return null;
  return (
    <label className={`flex items-center gap-1.5 text-xs text-slate-500 ${className}`}>
      <MapPin size={14} aria-hidden="true" className="text-bordeaux-700" />
      <span className="hidden lg:inline">Temple</span>
      <select
        value={egliseId}
        onChange={(e) => setEgliseId(e.target.value)}
        aria-label="Temple affiché"
        className="max-w-[11rem] px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:border-bordeaux-400 focus:ring-2 focus:ring-bordeaux-200"
      >
        <option value="">Tous les temples</option>
        {actives.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nom}
            {e.estSiege ? " (siège)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
