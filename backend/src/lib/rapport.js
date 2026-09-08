import PDFDocument from "pdfkit";
import prisma from "./prisma.js";

// ==============================
// Rapports de pointage hebdomadaires
//
// Les journées de programme sont : Mercredi, Vendredi, Dimanche.
//   - Mercredi / Vendredi : présent si badge ≤ 21h30
//   - Dimanche           : présent si badge ≤ 12h00
// Un ouvrier ne badge qu'une seule fois par jour (imposé côté badgeage).
// ==============================

// getDay() : 0 = dimanche, 3 = mercredi, 5 = vendredi
export const JOURS_PROGRAMME = {
  3: { label: "Mercredi", seuil: { heures: 21, minutes: 30 } },
  5: { label: "Vendredi", seuil: { heures: 21, minutes: 30 } },
  0: { label: "Dimanche", seuil: { heures: 12, minutes: 0 } },
};

export function estJourDeProgramme(date) {
  return date.getDay() in JOURS_PROGRAMME;
}

/**
 * Seuil de présence (minutes depuis minuit) pour une date.
 * Retourne null sur un jour hors programme (les programmes ne fixent pas de
 * seuil) : dans ce cas, "badgé = présent" (voir construireRapport).
 */
export function seuilPourJour(date) {
  const jour = JOURS_PROGRAMME[date.getDay()];
  if (!jour) return null;
  return jour.seuil.heures * 60 + jour.seuil.minutes;
}

function heureEnMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

const NB_JOURS_FR = [
  "Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi",
];
const NB_MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function dateISO(date) {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function dateLongueur(date) {
  return `${NB_JOURS_FR[date.getDay()]} ${date.getDate()} ${NB_MOIS_FR[date.getMonth()]} ${date.getFullYear()}`;
}

function heureFormat(mm) {
  return `${Math.floor(mm / 60).toString().padStart(2, "0")}:${(mm % 60).toString().padStart(2, "0")}`;
}

/**
 * Construit la structure du rapport d'un jour donné.
 *
 * Règles de présence :
 *   - Jour de programme (Mer/Ven/Dim) : présent si badge ≤ seuil.
 *   - Jour hors programme : présent si un badge a été effectué (peu importe
 *     l'heure).
 *
 * Retour :
 * {
 *   date, dateISO, dateLongueur, jourLabel, seuilTexte, notePresence,
 *   departements: [{ nom, lignes: [{ matricule, nom, prenom, present, heure }],
 *                    presents, absents, effectif }],
 *   recap: { presents, absents, effectif }
 * }
 */
export async function construireRapport(date) {
  const seuil = seuilPourJour(date); // null = hors programme → badgé = présent
  const jour = JOURS_PROGRAMME[date.getDay()];

  const debutJour = new Date(date);
  debutJour.setHours(0, 0, 0, 0);
  const finJour = new Date(date);
  finJour.setHours(23, 59, 59, 999);

  const [departements, pointages] = await Promise.all([
    prisma.departement.findMany({
      orderBy: { nom: "asc" },
      include: {
        membres: {
          include: { ouvrier: true },
          orderBy: [{ ouvrier: { nom: "asc" } }, { ouvrier: { prenom: "asc" } }],
        },
      },
    }),
    prisma.pointage.findMany({
      where: { dateHeure: { gte: debutJour, lte: finJour } },
      select: { ouvrierId: true, dateHeure: true },
    }),
  ]);

  const pointageParOuvrier = new Map(
    pointages.map((p) => [p.ouvrierId, p.dateHeure])
  );

  const recap = { presents: 0, absents: 0, effectif: 0 };

  const rapportDepartements = departements.map((dep) => {
    const lignes = dep.membres
      .filter((m) => m.ouvrier.actif)
      .map((m) => {
        const dateHeure = pointageParOuvrier.get(m.ouvrier.id);
        // Jour de programme : badge ≤ seuil. Hors programme : tout badge compte.
        const present =
          dateHeure !== undefined &&
          (seuil === null || heureEnMinutes(dateHeure) <= seuil);
        return {
          matricule: m.ouvrier.matricule,
          nom: m.ouvrier.nom,
          prenom: m.ouvrier.prenom,
          present,
          heure: dateHeure ? heureFormat(heureEnMinutes(dateHeure)) : null,
        };
      });

    const presents = lignes.filter((l) => l.present).length;
    const absents = lignes.length - presents;
    recap.presents += presents;
    recap.absents += absents;
    recap.effectif += lignes.length;

    return { id: dep.id, nom: dep.nom, lignes, presents, absents, effectif: lignes.length };
  });

  return {
    date,
    programme: jour !== undefined,
    dateISO: dateISO(date),
    dateLongueur: dateLongueur(date),
    jourLabel: jour ? jour.label : dateLongueur(date).split(" ")[0],
    seuilTexte: jour ? heureFormat(seuil) : "— (badgé = présent)",
    notePresence: jour
      ? `Statut : présent si badge ≤ ${heureFormat(seuil)}`
      : "Statut : présent si un badge a été effectué",
    departements: rapportDepartements,
    recap,
  };
}

// ---------- Génération PDF (pdfkit) ----------

function nouveauPdf() {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const fini = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  return { doc, fini };
}

function titrePdf(doc, titre, sousTitre, noteSeuil) {
  doc.fontSize(18).text(titre, { align: "center" });
  doc.moveDown(0.2);
  doc.fontSize(12).text(sousTitre, { align: "center" });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor("#666666").text(noteSeuil, { align: "center" });
  doc.moveDown(0.8);
}

function dessinerTableau(doc, colonnes, lignes, formaterLigne) {
  const largeurs = colonnes.map((c) => c.largeur);
  doc.font("Helvetica-Bold").fontSize(9);
  let x = 40;
  colonnes.forEach((col, i) => {
    doc.text(col.titre, x + 2, doc.y, { width: largeurs[i] - 4 });
    x += largeurs[i];
  });
  doc.moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
  doc.y += 4;

  doc.font("Helvetica").fontSize(9);
  lignes.forEach((ligne) => {
    if (doc.y > 780) doc.addPage();
    doc.fillColor("#000000").font("Helvetica");
    x = 40;
    colonnes.forEach((col, i) => {
      const { texte, couleur, gras } = formaterLigne(ligne, i, doc);
      if (couleur) doc.fillColor(couleur);
      if (gras) doc.font("Helvetica-Bold");
      doc.text(texte, x + 2, doc.y, { width: largeurs[i] - 4 });
      doc.fillColor("#000000").font("Helvetica");
      x += largeurs[i];
    });
    doc.y += 12;
  });
  doc.moveDown(0.4);
}

function textePied(doc, texte) {
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000")
    .text(texte, { align: "center" });
  doc.moveDown(0.2);
}

/**
 * PDF d'un département.
 * Retourne { nomFichier, buffer }.
 */
function pdfDepartement(departement, rapport) {
  const { doc, fini } = nouveauPdf();

  titrePdf(
    doc,
    "Rapport de pointage",
    `Département ${departement.nom} — ${rapport.dateLongueur}`,
    rapport.notePresence
  );

  const colonnes = [
    { titre: "Matricule", largeur: 90 },
    { titre: "Nom", largeur: 125 },
    { titre: "Prénom", largeur: 125 },
    { titre: "Statut", largeur: 85 },
    { titre: "Heure", largeur: 70 },
  ];

  dessinerTableau(
    doc,
    colonnes,
    departement.lignes,
    (ligne, i) => {
      if (i === 3) {
        return {
          texte: ligne.present ? "PRÉSENT" : "ABSENT",
          couleur: ligne.present ? "#10b981" : "#f43f5e",
          gras: true,
        };
      }
      if (i === 4) return { texte: ligne.heure ?? "—" };
      return { texte: ligne[i === 0 ? "matricule" : i === 1 ? "nom" : "prenom"] };
    }
  );

  textePied(
    doc,
    `Présents : ${departement.presents}   Absents : ${departement.absents}   Effectif : ${departement.effectif}`
  );

  doc.end();
  return fini.then((buffer) => ({
    nomFichier: `Rapport_${rapport.dateISO}_${departement.nom.replace(/\s+/g, "_")}.pdf`,
    buffer,
  }));
}

/**
 * PDF récapitulatif (un tableau par département + totaux).
 * Retourne { nomFichier, buffer }.
 */
function pdfRecap(rapport) {
  const { doc, fini } = nouveauPdf();

  titrePdf(
    doc,
    "Rapport de pointage — Récapitulatif",
    `${rapport.jourLabel} ${rapport.dateLongueur}`,
    rapport.notePresence
  );

  const colonnes = [
    { titre: "Département", largeur: 240 },
    { titre: "Présents", largeur: 95 },
    { titre: "Absents", largeur: 95 },
    { titre: "Effectif", largeur: 95 },
  ];

  const lignes = rapport.departements.map((dep) => ({
    texte: [dep.nom, dep.presents, dep.absents, dep.effectif],
  }));

  dessinerTableau(
    doc,
    colonnes,
    lignes,
    (ligne, i) => ({ texte: String(ligne.texte[i]) })
  );

  textePied(
    doc,
    `Total — Présents : ${rapport.recap.presents}   Absents : ${rapport.recap.absents}   Effectif : ${rapport.recap.effectif}`
  );

  doc.end();
  return fini.then((buffer) => ({
    nomFichier: `Recapitulatif_${rapport.dateISO}.pdf`,
    buffer,
  }));
}

/**
 * Génère tous les PDF (un par département + récapitulatif).
 * Retourne [{ nomFichier, buffer }, ...] — le récap en dernier.
 */
export async function genererPdfsRapport(rapportStructure) {
  const deps = await Promise.all(
    rapportStructure.departements.map((d) => pdfDepartement(d, rapportStructure))
  );
  const recap = await pdfRecap(rapportStructure);
  return [...deps, recap];
}

// ---------- Envoi email (nodemailer) ----------

/**
 * Corps en texte simple du mail de rapport, rédigé à l'attention du
 * président fondateur de l'église.
 */
export function corpsRapport(structure) {
  const programme = structure.programme
    ? `rapport du programme du ${structure.dateLongueur}`
    : `rapport du ${structure.dateLongueur}`;
  return [
    `CITOYEN REMARQUABLE PAPA, que notre Seigneur JESUS vous bénisse et vous donne longue vie.`,
    ``,
    `Vous trouverez ici le ${programme} par département, avec les fichiers joints ci-dessus.`,
    ``,
    `Cordialement,`,
    `l'équipe technique.`,
  ].join("\n");
}

export function smtpConfigure() {
  return Boolean(process.env.SMTP_HOST);
}

export async function envoyerRapportEmail({ dests, objet, corps, piecesJointes }) {
  if (!smtpConfigure()) {
    throw Object.assign(new Error("SMTP non configuré dans .env"), { code: "SMTP_NON_CONFIGURE" });
  }

  const { createTransport } = await import("nodemailer");

  const transporteur = createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  const expediteur = process.env.SMTP_EXPEDITEUR || process.env.SMTP_USER;

  try {
    const info = await transporteur.sendMail({
      from: expediteur,
      to: dests.join(", "),
      subject: objet,
      text: corps,
      attachments: piecesJointes.map((p) => ({
        filename: p.nomFichier,
        content: p.buffer,
        contentType: "application/pdf",
      })),
    });
    return { messageId: info.messageId };
  } finally {
    transporteur.close();
  }
}