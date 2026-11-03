import prisma from "./prisma.js";

/**
 * Compatibilité « base non encore migrée » pour Admin.nom / Admin.prenom.
 *
 * Contexte : le client Prisma généré sélectionne TOUTES les colonnes scalaires
 * d'un modèle quand aucun `select` n'est fourni. Si la migration
 * `20261102120000_admin_nom_prenom` n'a pas encore été appliquée sur la base
 * (Supabase de production), toute requête Admin échoue avec P2022
 * (« The column `Admin.nom` does not exist »), y compris le login.
 *
 * Or nom/prénom ne servent QU'À l'affichage : leur absence ne doit jamais
 * empêcher de se connecter. Les helpers ci-dessous retentent donc la requête
 * sans ces deux colonnes et renvoient `null` à la place.
 *
 * La cause racine est traitée séparément : `scripts/vercel-build.mjs` applique
 * `prisma migrate deploy` à chaque déploiement.
 */

/** Vrai si l'erreur Prisma vient d'une colonne Admin.nom/prenom absente. */
export function estColonneIdentiteManquante(err) {
  if (!err) return false;
  if (err.code === "P2022") return true;
  return /column .*Admin["']?\.(nom|prenom).* does not exist/i.test(
    String(err.message || "")
  );
}

/** Garantit la présence de nom/prenom (null si la colonne n'existe pas). */
export function avecIdentiteNulle(admin) {
  if (!admin) return admin;
  return {
    ...admin,
    nom: admin.nom ?? null,
    prenom: admin.prenom ?? null,
  };
}

/** Colonnes d'affichage complètes (échoue si les colonnes n'existent pas). */
export const SELECT_ADMIN_IDENTITE = Object.freeze({
  id: true,
  email: true,
  nom: true,
  prenom: true,
  role: true,
  actif: true,
  tentativesEchouees: true,
  bloqueJusqua: true,
  createdAt: true,
});

/** Mêmes colonnes SANS nom/prenom : fonctionne sur une base non migrée. */
export const SELECT_ADMIN_BASE = Object.freeze({
  id: true,
  email: true,
  role: true,
  actif: true,
  tentativesEchouees: true,
  bloqueJusqua: true,
  createdAt: true,
});

/** Colonnes nécessaires au login (mot de passe + verrouillage). */
export const SELECT_ADMIN_AUTH = Object.freeze({
  id: true,
  email: true,
  motDePasse: true,
  role: true,
  actif: true,
  tentativesEchouees: true,
  bloqueJusqua: true,
});

/** Colonnes suffisantes pour les contrôles d'autorisation. */
export const SELECT_ADMIN_CONTROLE = Object.freeze({
  id: true,
  email: true,
  role: true,
  actif: true,
});

/**
 * Retrouve un admin par email (login, inscription, reset).
 * En cas de colonnes nom/prenom absentes, renvoie l'admin sans ces champs.
 */
export async function trouverAdminParEmail(email) {
  try {
    return await prisma.admin.findUnique({ where: { email } });
  } catch (err) {
    if (!estColonneIdentiteManquante(err)) throw err;
    const admin = await prisma.admin.findUnique({
      where: { email },
      select: { ...SELECT_ADMIN_AUTH, createdAt: true },
    });
    return avecIdentiteNulle(admin);
  }
}

/**
 * Retrouve un admin par id pour les contrôles d'autorisation.
 * Ne sélectionne jamais nom/prenom → insensible à la migration.
 */
export function trouverAdminParId(id) {
  return prisma.admin.findUnique({
    where: { id },
    select: SELECT_ADMIN_CONTROLE,
  });
}

/**
 * Exécute une opération Prisma « avec nom/prenom » ; si les colonnes manquent,
 * rejoue l'opération de secours (sans ces colonnes) et complète avec null.
 *
 * @template T
 * @param {() => Promise<T>} operation
 * @param {() => Promise<T>} operationSansIdentite
 * @returns {Promise<T>}
 */
export async function executerAdmin(operation, operationSansIdentite) {
  try {
    return await operation();
  } catch (err) {
    if (!estColonneIdentiteManquante(err)) throw err;
    const resultat = await operationSansIdentite();
    if (Array.isArray(resultat)) return resultat.map(avecIdentiteNulle);
    return avecIdentiteNulle(resultat);
  }
}

/**
 * Crée un admin. Si les colonnes nom/prenom n'existent pas, les retire des
 * données (elles resteraient de toute façon inutilisables) et renvoie null.
 */
export async function creerAdmin(data, selectComplet = SELECT_ADMIN_IDENTITE) {
  try {
    return await prisma.admin.create({ data, select: selectComplet });
  } catch (err) {
    if (!estColonneIdentiteManquante(err)) throw err;
    const { nom, prenom, ...reste } = data;
    const admin = await prisma.admin.create({
      data: reste,
      select: SELECT_ADMIN_BASE,
    });
    return avecIdentiteNulle(admin);
  }
}

/**
 * Met à jour un admin. Si les colonnes nom/prenom n'existent pas, ignore ces
 * deux champs pour ne pas faire échouer l'opération (rôle, activation…).
 */
export async function mettreAJourAdmin(
  id,
  data,
  selectComplet = SELECT_ADMIN_IDENTITE
) {
  try {
    return await prisma.admin.update({
      where: { id },
      data,
      select: selectComplet,
    });
  } catch (err) {
    if (!estColonneIdentiteManquante(err)) throw err;
    const { nom, prenom, ...reste } = data;
    const admin = await prisma.admin.update({
      where: { id },
      data: reste,
      select: SELECT_ADMIN_BASE,
    });
    return avecIdentiteNulle(admin);
  }
}
