import {
  construireRapport,
  genererPdfsRapport,
  envoyerRapportEmail,
  smtpConfigure,
  estJourDeProgramme,
  corpsRapport,
} from "./rapport.js";

// ==============================
// Envoi programmé des rapports
//
// Tous les matins à 06h00, on vérifie si HIER était un jour de programme :
//   - jeudi 06h00 → rapport du mercredi
//   - samedi 06h00 → rapport du vendredi
//   - lundi 06h00 → rapport du dimanche
// Les autres jours, on ne fait rien.
// ==============================

export function hier() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

// Garde anti-double-envoi : un même jour de programme ne doit donner lieu qu'à
// UN envoi automatique par session serveur (un redémarrage à 06h00 pile ne
// doit pas renvoyer deux fois le même rapport). Indexé par dateISO du jour
// de programme concerné.
const dejaEnvoye = new Set();

function dateISO(date) {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * Déclenche l'envoi du rapport du jour de programme précédent.
 * Retourne { ok, raisons } pour le log.
 */
export async function declencherRapportsProgrammes(dateHier = hier()) {
  const raisons = [];

  if (!estJourDeProgramme(dateHier)) {
    raisons.push("hier n'était pas un jour de programme");
    return { ok: false, raisons };
  }

  if (!smtpConfigure()) {
    raisons.push("SMTP non configuré (SMTP_HOST absent du .env)");
    return { ok: false, raisons };
  }

  const iso = dateISO(dateHier);
  if (dejaEnvoye.has(iso)) {
    raisons.push(`rapport du ${iso} déjà envoyé lors de cette session`);
    return { ok: false, raisons };
  }

  const dests = (process.env.RAPPORT_EMAIL_DESTINATAIRES || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  if (dests.length === 0) {
    raisons.push("aucun destinataire (RAPPORT_EMAIL_DESTINATAIRES vide)");
    return { ok: false, raisons };
  }

  try {
    const structure = await construireRapport(dateHier);
    const piecesJointes = await genererPdfsRapport(structure);
    const { messageId } = await envoyerRapportEmail({
      dests,
      objet: `Rapport de pointage — ${structure.jourLabel} ${structure.dateLongueur}`,
      corps: corpsRapport(structure),
      piecesJointes,
    });
    dejaEnvoye.add(iso);
    return {
      ok: true,
      raisons: [
        `rapport ${structure.dateISO} envoyé à ${dests.join(", ")} (messageId ${messageId})`,
      ],
    };
  } catch (err) {
    raisons.push(
      `échec : ${err?.code || "ERREUR"} — ${err?.message || "erreur inconnue"}`
    );
    return { ok: false, raisons };
  }
}