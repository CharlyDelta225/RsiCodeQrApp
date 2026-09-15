// Mini-logger sans dépendance.
// - Niveaux filtrés par LOG_LEVEL : debug < info < warn < error (défaut: info).
// - Toujours écrit en sortie console : en prod Vercel, stdout/stderr sont
//   capturés par le dashboard (Functions → Logs).
// - En local (LOG_FILE non désactivé, défaut hors production), les lignes sont
//   aussi ajoutées à backend/logs/app-<AAAA-MM-JJ>.log (rotation quotidienne).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "../../logs"); // backend/logs

const NIVEAUX = { error: 0, warn: 1, info: 2, debug: 3 };
const NOM_NIVEAU = (process.env.LOG_LEVEL || "info").toLowerCase();
const SEUIL = NIVEAUX[NOM_NIVEAU] ?? NIVEAUX.info;

const PRODUCTION = process.env.NODE_ENV === "production";
const envBool = (val, defaut) =>
  val === undefined ? defaut : ["true", "1", "on", "yes"].includes(String(val).toLowerCase());
const FICHIER_ACTIF = envBool(process.env.LOG_FILE, !PRODUCTION);

function ecrireFichier(ligne) {
  if (!FICHIER_ACTIF) return;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const jour = new Date().toISOString().slice(0, 10);
    fs.appendFileSync(path.join(LOG_DIR, `app-${jour}.log`), ligne, "utf8");
  } catch {
    // Un log ne doit jamais faire planter l'application.
  }
}

// Sérialise une donnée (objet, erreur, ou primitif) en un fragment JSON.
function serialiser(data) {
  if (data === undefined) return "";
  try {
    const json = JSON.stringify(data, (_cle, valeur) =>
      valeur instanceof Error
        ? {
            message: valeur.message,
            code: valeur.code,
            statusCode: valeur.statusCode ?? undefined,
            stack: valeur.stack,
          }
        : valeur
    );
    return ` ${json}`;
  } catch {
    return ` ${String(data)}`;
  }
}

function emettre(niveau, message, ...donnees) {
  if (NIVEAUX[niveau] > SEUIL) return;
  const ligne = `${new Date().toISOString()} ${niveau.toUpperCase().padEnd(5)} ${message}${donnees.map(serialiser).join("")}\n`;
  if (niveau === "error") console.error(ligne.trimEnd());
  else console.log(ligne.trimEnd());
  ecrireFichier(ligne);
}

const logger = {
  error: (message, ...donnees) => emettre("error", message, ...donnees),
  warn: (message, ...donnees) => emettre("warn", message, ...donnees),
  info: (message, ...donnees) => emettre("info", message, ...donnees),
  debug: (message, ...donnees) => emettre("debug", message, ...donnees),
};

export default logger;