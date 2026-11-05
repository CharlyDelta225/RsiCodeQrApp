// Recherche d'ouvriers dans le navigateur : la liste du temple est chargée une
// fois, puis filtrée à chaque frappe sans appel au serveur.
// Insensible à la casse et aux accents ; chaque mot tapé doit se retrouver
// dans le nom, les prénoms, le matricule, le téléphone ou un département.

export const normaliser = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const texteDe = (o) =>
  normaliser(
    [o.nom, o.prenom, o.matricule, o.telephone, ...(o.departements || []).map((l) => l.departement?.nom || l.nom)].join(" ")
  );

export function filtrerOuvriers(ouvriers, recherche) {
  const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return ouvriers;
  return ouvriers.filter((o) => {
    const texte = texteDe(o);
    return mots.every((m) => texte.includes(m));
  });
}
