import crypto from "node:crypto";

// ==============================
// Envoi d'emails (nodemailer) + génération de mots de passe
//
// Utilisé par : réinitialisation de mot de passe oublié, création de comptes
// admin, réinitialisation par le SUPER_ADMIN. La configuration SMTP est
// commune aux rapports (voir lib/rapport.js) mais le transport est recréé à
// chaque envoi (pas de connexion persistée à garder ouverte).
// ==============================

export function smtpConfigure() {
  return Boolean(process.env.SMTP_HOST);
}

/**
 * URL publique du dashboard, utilisée pour construire les liens de
 * réinitialisation. En dev : http://localhost:5174 (Vite). À surcharger en
 * production via APP_URL.
 */
export function urlDashboard() {
  return (process.env.APP_URL || "http://localhost:5174").replace(/\/+$/, "");
}

/**
 * Envoie un email texte simple.
 * @returns {Promise<{ messageId: string }>}
 * @throws {Error} avec code SMTP_NON_CONFIGURE si aucun SMTP configuré.
 */
export async function envoyerEmailSimple({ to, sujet, texte }) {
  if (!smtpConfigure()) {
    throw Object.assign(new Error("SMTP non configuré dans .env"), {
      code: "SMTP_NON_CONFIGURE",
    });
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
      to,
      subject: sujet,
      text: texte,
    });
    return { messageId: info.messageId };
  } finally {
    transporteur.close();
  }
}

/**
 * Mot de passe temporaire fort, sans caractères ambigus (0/O, 1/l/I).
 * 16 caractères : minuscules, majuscules et chiffres.
 */
export function genererMotDePasse(longueur = 16) {
  const CHARS =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const octets = crypto.randomBytes(longueur);
  let resultat = "";
  for (let i = 0; i < longueur; i++) {
    // Octet / len(CHARS) → index uniforme (256 divisible 47 = 5,44 tours :
    // biais négligeable pour un mot de passe jetable).
    resultat += CHARS[octets[i] % CHARS.length];
  }
  return resultat;
}