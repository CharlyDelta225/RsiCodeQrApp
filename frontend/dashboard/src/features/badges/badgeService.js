/**
 * Point d'accès aux données du module Badge.
 *
 * L'atelier travaille exclusivement sur les ouvriers réels de l'application
 * (`GET /api/ouvriers`). Aucune donnée de démonstration n'est conservée.
 *
 * Les composants visuels n'appellent jamais l'API directement.
 */

import { api } from "../../lib/api";
import { mapOuvrierToBadgeMember } from "./badgeAdapter";

/** Charge les membres réels via l'API existante. */
export async function chargerMembresApi() {
  const donnees = await api.getOuvriers({ limit: 2000 });
  const ouvriers = Array.isArray(donnees?.ouvriers) ? donnees.ouvriers : [];
  return ouvriers.map((ouvrier) => mapOuvrierToBadgeMember(ouvrier));
}

/**
 * Charge les membres affichés dans l'atelier.
 * @returns {Promise<import("./badgeTypes").BadgeMember[]>}
 */
export function chargerMembres() {
  return chargerMembresApi();
}
