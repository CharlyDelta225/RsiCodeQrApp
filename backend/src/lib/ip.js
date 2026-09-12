// ==============================
// IP réelle du client — source de vérité pour les rate-limit
// ==============================
// Sur Vercel, la passerelle renseigne l'IP réelle du client dans
// X-Vercel-Forwarded-For (posé par la bordure, non forgable côté client).
// X-Forwarded-For, lui, peut être forgé par n'importe qui : il ne doit donc
// JAMAIS servir de clé de limite de débit.
export function ipReelle(req) {
  const v = req.headers["x-vercel-forwarded-for"];
  if (typeof v === "string" && v.trim()) return v.trim().split(",")[0].trim();
  return req.ip;
}