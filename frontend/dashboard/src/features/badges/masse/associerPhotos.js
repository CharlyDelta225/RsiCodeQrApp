// Rattache des fichiers photo aux ouvriers d'un département :
// 1. par le matricule dans le nom du fichier (RSI-4A21.jpg, rsi_4a21 Kouassi.png) ;
// 2. sinon par le nom : le nom de famille et le premier prénom doivent y figurer,
//    et un seul ouvrier doit correspondre.
// Un même ouvrier ne reçoit qu'un fichier ; les autres restent « à attribuer ».

const mots = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

const matriculeDans = (nomFichier) => {
  const m = String(nomFichier).toUpperCase().match(/RSI[\s_-]?([0-9A-F]{4})(?![0-9A-F])/);
  return m ? `RSI-${m[1]}` : null;
};

export function associerPhotos(fichiers, ouvriers) {
  const parMatricule = new Map(ouvriers.map((o) => [String(o.matricule).toUpperCase(), o]));
  const pris = new Set();
  const associees = [];
  const restantes = [];

  for (const fichier of fichiers) {
    const base = fichier.name.replace(/\.[^.]+$/, "");
    let ouvrier = parMatricule.get(matriculeDans(base) || "");
    if (!ouvrier) {
      const dansFichier = new Set(mots(base));
      const candidats = ouvriers.filter((o) => {
        const nom = mots(o.nom);
        const prenom = mots(o.prenom)[0];
        return nom.length > 0 && nom.every((m) => dansFichier.has(m)) && (!prenom || dansFichier.has(prenom));
      });
      if (candidats.length === 1) ouvrier = candidats[0];
    }
    if (ouvrier && !pris.has(ouvrier.id)) {
      pris.add(ouvrier.id);
      associees.push({ ouvrier, fichier });
    } else {
      restantes.push(fichier);
    }
  }
  return { associees, restantes };
}
