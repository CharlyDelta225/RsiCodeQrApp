import app from "./app.js";
import cron from "node-cron";
import { declencherRapportsProgrammes } from "./lib/planificateur.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✓ API RsiCodeQrApp démarrée sur http://localhost:${PORT}`);
  console.log("  Health : http://localhost:" + PORT + "/api/health");
});

// Envoi programmé des rapports de pointage : chaque matin à 06h00, on envoie
// le rapport du jour de programme précédent (si hier était Mer/Ven/Dim).
// Heure locale du serveur (fuseau de l'église).
cron.schedule("0 6 * * *", async () => {
  console.log("[PLANIFICATEUR] 06h00 — vérification du rapport à envoyer…");
  const resultat = await declencherRapportsProgrammes();
  if (resultat.ok) {
    console.log("[PLANIFICATEUR] ✓", resultat.raisons.join(" ; "));
  } else if (resultat.raisons.length > 0) {
    console.log("[PLANIFICATEUR] rien à faire :", resultat.raisons.join(" ; "));
  }
});