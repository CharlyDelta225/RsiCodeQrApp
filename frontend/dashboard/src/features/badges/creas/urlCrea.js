import { api } from "../../../lib/api";

// Créas déjà téléchargées, par département : departementId -> { maj, url }.
const cache = new Map();

/**
 * URL locale de la créa d'un département, ou null s'il n'en a pas.
 * Une créa illisible ne bloque pas la carte : elle retombe sur la maquette.
 */
export function urlCrea(departementId, creaMaj) {
  if (!departementId || !creaMaj) return Promise.resolve(null);
  const present = cache.get(departementId);
  if (present?.maj === creaMaj) return present.url;
  const url = api
    .getBadgeCreaBlob(departementId, creaMaj)
    .then((blob) => URL.createObjectURL(blob))
    .catch(() => {
      cache.delete(departementId);
      return null;
    });
  cache.set(departementId, { maj: creaMaj, url });
  return url;
}
