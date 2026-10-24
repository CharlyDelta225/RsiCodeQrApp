/**
 * Point d'accès aux données du module Badge.
 *
 * Aujourd'hui :
 *  - `chargerMembresApi()` utilise l'API EXISTANTE `GET /api/ouvriers`
 *    (aucune nouvelle route, aucun nouveau modèle) ;
 *  - `chargerMembresDemo()` renvoie les données de démonstration isolées.
 *
 * Demain, pour brancher le back-end :
 *  - soit adapter le mapping dans `badgeAdapter.js` ;
 *  - soit remplacer `chargerMembresApi()` par l'appel de la nouvelle route
 *    (ex. `/api/badges/membres`) et mapper vers `BadgeMember`.
 *
 * Les composants visuels n'appellent jamais l'API directement.
 */

import { api } from "../../lib/api";
import { mapOuvrierToBadgeMember } from "./badgeAdapter";
import { DEMO_MEMBERS } from "./demoMembers";
import { BADGE_SOURCES } from "./badgeTypes";

/** Charge les membres réels via l'API existante. */
export async function chargerMembresApi() {
  const donnees = await api.getOuvriers({ limit: 200 });
  const ouvriers = Array.isArray(donnees?.ouvriers) ? donnees.ouvriers : [];
  return ouvriers.map((ouvrier) => mapOuvrierToBadgeMember(ouvrier));
}

/** Charge les données de démonstration (copie défensive). */
export function chargerMembresDemo() {
  return DEMO_MEMBERS.map((membre) => ({
    ...membre,
    source: BADGE_SOURCES.DEMO,
  }));
}

/**
 * Charge les membres selon la source choisie dans l'atelier.
 * @param {"demo"|"api"} source
 * @returns {Promise<import("./badgeTypes").BadgeMember[]>}
 */
export async function chargerMembres(source) {
  return source === BADGE_SOURCES.API
    ? chargerMembresApi()
    : chargerMembresDemo();
}
