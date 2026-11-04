/**
 * Adaptateur API → BadgeMember.
 *
 * Point d'intégration principal du back-end : c'est ICI qu'on branche les
 * nouveaux champs (église d'origine/actuelle, fonction, photo, URL de
 * vérification…). Les composants visuels ne connaissent que `BadgeMember`.
 *
 * IMPORTANT : ne jamais mapper ni encoder le téléphone dans le badge.
 */

function texte(valeur) {
  if (valeur === undefined || valeur === null) return null;
  const s = String(valeur).trim();
  return s || null;
}

function nomEglise(valeur) {
  if (!valeur) return null;
  if (typeof valeur === "string") return texte(valeur);
  return texte(valeur.nom ?? valeur.libelle ?? valeur.label);
}

function nomDepartement(liaison) {
  return texte(liaison?.departement?.nom ?? liaison?.nom ?? liaison);
}

function nomsDepartements(ouvrier) {
  const liste = Array.isArray(ouvrier?.departements)
    ? ouvrier.departements.map(nomDepartement).filter(Boolean)
    : [];

  if (liste.length > 0) return liste.join(", ");
  return texte(ouvrier?.departement);
}

/**
 * Convertit un ouvrier renvoyé par l'API existante (`GET /api/ouvriers`) en
 * `BadgeMember`. Aucun champ n'est supposé exister : tout est optionnel.
 *
 * Champs déjà disponibles côté API : id, matricule, nom, prenom, photoUrl,
 * actif, departements[].departement.nom.
 * Champs à brancher plus tard (déjà supportés par l'adaptateur) :
 * fonction/poste, egliseOrigine, egliseActuelle, verificationUrl.
 *
 * @param {object} ouvrier
 * @returns {import("./badgeTypes").BadgeMember}
 */
export function mapOuvrierToBadgeMember(ouvrier = {}) {
  return {
    id: String(ouvrier.id ?? ""),
    matricule: texte(ouvrier.matricule) ?? "",
    nom: texte(ouvrier.nom) ?? "",
    prenom: texte(ouvrier.prenom) ?? "",
    photoUrl: texte(ouvrier.photoUrl),
    fonction: texte(ouvrier.fonction ?? ouvrier.poste),
    departement: nomsDepartements(ouvrier),
    egliseOrigine: nomEglise(
      ouvrier.egliseOrigine ?? ouvrier.eglise?.origine ?? ouvrier.eglise
    ),
    egliseActuelle: nomEglise(
      // Temple d'appartenance en base ({ id, code, nom }).
      ouvrier.egliseActuelle ?? ouvrier.eglise?.actuelle ?? ouvrier.eglise
    ),
    verificationUrl: texte(ouvrier.verificationUrl),
    actif: ouvrier.actif !== false,
  };
}

/** « Prénom NOM » avec repli propre si les champs sont vides. */
export function nomComplet(membre) {
  const complet = [texte(membre?.prenom), texte(membre?.nom)]
    .filter(Boolean)
    .join(" ")
    .trim();
  return complet || "Membre";
}

/** Initiales pour la vignette photo de secours. */
export function initiales(membre) {
  const prenom = texte(membre?.prenom) ?? "";
  const nom = texte(membre?.nom) ?? "";
  const lettres = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  return lettres || "?";
}

/** Église affichée : « origine → actuelle » quand elles diffèrent. */
export function libelleEglises(membre) {
  const origine = texte(membre?.egliseOrigine);
  const actuelle = texte(membre?.egliseActuelle);

  if (origine && actuelle && origine !== actuelle) {
    return `${origine} → ${actuelle}`;
  }
  return actuelle || origine || "—";
}

/**
 * URL de vérification utilisable (http/https uniquement).
 * Toute autre valeur est ignorée pour ne pas encoder un lien inattendu.
 */
export function urlVerification(membre) {
  const url = texte(membre?.verificationUrl);
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/**
 * Valeur encodée dans le QR code : TOUJOURS le matricule.
 * Le terminal de badgeage envoie le contenu brut du QR comme matricule
 * (POST /api/badgeage) : un QR contenant une URL serait refusé (« Badge
 * inconnu »). L'URL de vérification, si elle est renseignée, est seulement
 * imprimée en texte au verso.
 * Jamais le téléphone, jamais un champ sensible.
 */
export function valeurQr(membre) {
  return texte(membre?.matricule) || "";
}
