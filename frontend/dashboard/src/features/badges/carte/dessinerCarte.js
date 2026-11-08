import QRCode from "qrcode";
import {
  COULEUR_FOND_MAQUETTE,
  COULEUR_MODELE,
  FORMAT_MM,
  HAUTEUR,
  LARGEUR,
  MENTIONS_CREA,
  OR_DEPARTEMENT,
  PHOTO,
  POLICE,
  TEXTES,
  TEXTES_MAQUETTE,
  TITRE_SEUL,
  VARIANTES_POLICE,
  VERSO,
  ZONES_PROTEGEES,
} from "./gabarit.js";

/**
 * Génération des cartes de badge (recto + verso) sur <canvas>.
 *
 * Utilisation :
 *   await chargerPolices(urlDuFichier);           // une fois
 *   const fond = await chargerImage(urlFondRecto); // une fois
 *   const recto = await dessinerRecto({ fond, membre });
 *   const verso = await dessinerVerso({ membre });
 *
 * `membre` = { nom, prenom, matricule, fonction, district, departement,
 *              couleur, photo } — photo : URL, data URL ou HTMLImageElement.
 * Aucune autre donnée n'est lue : le téléphone n'apparaît jamais.
 */

// ---------- Ressources ----------

let policesPretes = null;

/** Charge les variantes de Poppins utilisées. `url(fichier)` donne l'URL de chaque woff2. */
export function chargerPolices(url) {
  if (!policesPretes) {
    policesPretes = Promise.all(
      VARIANTES_POLICE.map(async (v) => {
        const face = new FontFace("Poppins RSI", `url(${url(v.fichier)}) format("woff2")`, {
          weight: String(v.poids),
          style: v.style,
        });
        document.fonts.add(await face.load());
      })
    ).catch((err) => {
      policesPretes = null;
      throw err;
    });
  }
  return policesPretes;
}

export function chargerImage(src) {
  if (src instanceof HTMLImageElement) {
    return src.complete ? Promise.resolve(src) : new Promise((ok, ko) => { src.onload = () => ok(src); src.onerror = ko; });
  }
  return new Promise((ok, ko) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error("Image illisible"));
    img.src = src;
  });
}

function nouveauCanvas() {
  const c = document.createElement("canvas");
  c.width = LARGEUR;
  c.height = HAUTEUR;
  return c;
}

// ---------- Couleur du département ----------

function hexVersRvb(hex) {
  const v = String(hex || "").trim().replace(/^#/, "");
  const plein = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  if (!/^[0-9a-f]{6}$/i.test(plein)) return null;
  return [0, 2, 4].map((i) => parseInt(plein.slice(i, i + 2), 16));
}

/** Couleur valide (#RRGGBB) ou null. */
export function couleurValide(hex) {
  const rvb = hexVersRvb(hex);
  return rvb ? "#" + rvb.map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase() : null;
}

function rvbVersTsl(r, v, b) {
  r /= 255; v /= 255; b /= 255;
  const max = Math.max(r, v, b), min = Math.min(r, v, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let t;
  if (max === r) t = (v - b) / d + (v < b ? 6 : 0);
  else if (max === v) t = (b - r) / d + 2;
  else t = (r - v) / d + 4;
  return [t * 60, s, l];
}

function tslVersRvb(t, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (x) => {
    x = ((x % 360) + 360) % 360 / 360;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [f(t + 120) * 255, f(t) * 255, f(t - 120) * 255];
}

const ecartTeinte = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const borne = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Recolore le fond. Chaque pixel est vu comme « le même pixel dans la teinte
 * de base » + un écart de couleur (le rose, le jaune, le cyan de l'emblème en
 * filigrane). La partie de base prend la teinte, la saturation et la
 * luminosité du département ; l'écart est gardé tel quel. Aucun seuil de
 * teinte : les bords de l'emblème restent nets, ses couleurs d'origine aussi.
 * Le logo, le liseré du cadre photo et les dorés ne bougent pas.
 */
function teinterFond(ctx, couleur, base) {
  const cible = hexVersRvb(couleur);
  if (!cible || couleurValide(couleur) === couleurValide(base)) return;
  const [tB, sB, lB] = rvbVersTsl(...hexVersRvb(base));
  const [tC, sC, lC] = rvbVersTsl(...cible);
  const image = ctx.getImageData(0, 0, LARGEUR, HAUTEUR);
  const px = image.data;
  const protege = new Uint8Array(LARGEUR * HAUTEUR);
  const { logo, cadre, traitDore, titreDore } = ZONES_PROTEGEES;
  for (let y = Math.floor(logo.cy - logo.r); y <= logo.cy + logo.r; y++) {
    const demi = Math.sqrt(Math.max(0, logo.r * logo.r - (y - logo.cy) ** 2));
    protege.fill(1, y * LARGEUR + Math.floor(logo.cx - demi), y * LARGEUR + Math.ceil(logo.cx + demi));
  }
  // Autour du cadre : seul le fond est recoloré, pas le liseré.
  for (let y = cadre.y; y < cadre.y + cadre.h; y++) protege.fill(2, y * LARGEUR + cadre.x, y * LARGEUR + cadre.x + cadre.l);
  for (const z of [traitDore, titreDore]) {
    for (let y = z.y; y < z.y + z.h; y++) protege.fill(3, y * LARGEUR + z.x, y * LARGEUR + z.x + z.l);
  }
  // Luminosité : la bande (lB) devient lC ; le noir et le blanc restent en place.
  const lum = (l) => (l <= lB ? (l * lC) / lB : lC + ((l - lB) * (1 - lC)) / (1 - lB));
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const zone = protege[p];
    const r0 = px[i], v0 = px[i + 1], b0 = px[i + 2];
    const [t, s, l] = rvbVersTsl(r0, v0, b0);
    // Gris, noir et blanc : intacts (fondu progressif, pas de seuil net).
    let poids = borne((s - 0.04) / 0.08);
    if (poids === 0) continue;
    if (zone === 1 || zone === 2) {
      // Logo et liseré du cadre : seul le fond bleu qui les borde est recoloré.
      if (ecartTeinte(t, tB) > 22) continue;
    } else if (zone === 3) {
      // Trait doré, « STABILITE » : l'or reste or.
      const orange = borne((s - 0.3) / 0.15) * borne(1 - Math.max(0, ecartTeinte(t, 45) - 25) / 12);
      poids *= 1 - orange;
      if (poids === 0) continue;
    }
    const [rB, vB, bB] = tslVersRvb(tB, s, l); // ce pixel dans la teinte de base
    const [rC, vC, bC] = tslVersRvb(tC, Math.min(1, (s * sC) / sB), lum(l));
    // Nouveau = recoloré + écart d'origine (couleurs de l'emblème).
    px[i] = r0 + (rC + (r0 - rB) - r0) * poids;
    px[i + 1] = v0 + (vC + (v0 - vB) - v0) * poids;
    px[i + 2] = b0 + (bC + (b0 - bB) - b0) * poids;
  }
  ctx.putImageData(image, 0, 0);
}

/** Ombre du nom du département : très sombre, dans la teinte du département. */
function ombreDepartement(couleur) {
  const rvb = hexVersRvb(couleur);
  if (!rvb || couleurValide(couleur) === couleurValide(COULEUR_MODELE)) return "rgba(70, 0, 20, 0.55)";
  const [t, s] = rvbVersTsl(...rvb);
  const [r, v, b] = tslVersRvb(t, Math.min(1, s), 0.14);
  return `rgba(${Math.round(r)}, ${Math.round(v)}, ${Math.round(b)}, 0.55)`;
}

// ---------- Texte ----------

function police(spec, taille) {
  return `${spec.style || "normal"} ${spec.poids} ${taille}px ${POLICE}`;
}

/** Taille de police dont les capitales mesurent `hauteurCap` px. */
function tailleDepuisCap(ctx, spec) {
  ctx.font = police(spec, 100);
  const cap = ctx.measureText("H").actualBoundingBoxAscent || 69.8;
  return (spec.hauteurCap * 100) / cap;
}

/** Écrit un texte centré, réduit si besoin pour tenir dans `largeurMax`. */
function ecrire(ctx, texte, spec, remplissage) {
  if (!texte) return;
  let taille = tailleDepuisCap(ctx, spec);
  ctx.font = police(spec, taille);
  ctx.letterSpacing = `${spec.espacement || 0}px`;
  const largeur = ctx.measureText(texte).width;
  if (largeur > spec.largeurMax) {
    taille *= spec.largeurMax / largeur;
    ctx.font = police(spec, taille);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = remplissage ?? spec.couleur;
  // L'espacement s'ajoute aussi après la dernière lettre : on recentre.
  ctx.fillText(texte, spec.x + (spec.espacement || 0) / 2, spec.base);
  ctx.letterSpacing = "0px";
  return { taille, largeur: Math.min(largeur, spec.largeurMax) };
}

function ecrireLigneDoree(ctx, texte, spec, hauteurCap, base) {
  let taille = tailleDepuisCap(ctx, { ...spec, hauteurCap });
  ctx.font = police(spec, taille);
  ctx.letterSpacing = `${spec.espacement || 0}px`;
  let largeur = ctx.measureText(texte).width;
  if (largeur > spec.largeurMax) {
    taille *= spec.largeurMax / largeur;
    largeur = spec.largeurMax;
    ctx.font = police(spec, taille);
  }
  // Dégradé calé sur la largeur réelle du mot (reflets métalliques).
  const x0 = spec.x - largeur / 2;
  const degrade = ctx.createLinearGradient(x0, base - taille * 0.75, x0 + largeur, base);
  for (const [pos, c] of OR_DEPARTEMENT) degrade.addColorStop(pos, c);
  ctx.fillStyle = degrade;
  ctx.fillText(texte, spec.x + (spec.espacement || 0) / 2, base);
  ctx.letterSpacing = "0px";
}

/** Coupe un nom en deux lignes de longueurs proches. */
function couperEnDeux(texte) {
  const mots = texte.split(" ");
  let meilleur = [texte, ""];
  let ecart = Infinity;
  for (let i = 1; i < mots.length; i++) {
    const a = mots.slice(0, i).join(" "), b = mots.slice(i).join(" ");
    const e = Math.abs(a.length - b.length);
    if (e < ecart) { ecart = e; meilleur = [a, b]; }
  }
  return meilleur;
}

function ecrireDepartement(ctx, texte, couleur, textes = TEXTES) {
  if (!texte) return;
  const spec = textes.departement;
  ctx.save();
  ctx.shadowColor = ombreDepartement(couleur);
  ctx.shadowBlur = 7;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = police(spec, tailleDepuisCap(ctx, spec));
  const reduction = spec.largeurMax / ctx.measureText(texte).width;
  const { deuxLignes } = spec;
  if (reduction < deuxLignes.seuil && texte.includes(" ")) {
    // Resserrement proportionnel à la taille réduite (sinon les mots se collent).
    const petit = { ...spec, espacement: ((spec.espacement || 0) * deuxLignes.hauteurCap) / spec.hauteurCap };
    couperEnDeux(texte).forEach((ligne, i) => ecrireLigneDoree(ctx, ligne, petit, deuxLignes.hauteurCap, deuxLignes.bases[i]));
  } else {
    ecrireLigneDoree(ctx, texte, spec, spec.hauteurCap, spec.base);
  }
  ctx.restore();
}

/**
 * Variante « titre seul » (PASTEUR) : la bande descend un peu, devient un
 * dégradé de la couleur du département et ne porte que le titre.
 */
function dessinerBandeTitreSeul(ctx, couleur) {
  const { bandeOrigine, ligneFond, lisere, bande, degrade } = TITRE_SEUL;
  // 1. Le fond descend jusqu'à la nouvelle bande, liseré clair compris.
  const filet = ctx.getImageData(0, bandeOrigine, LARGEUR, lisere);
  for (let y = bandeOrigine; y < bande - lisere + 4; y++) {
    ctx.drawImage(ctx.canvas, 0, ligneFond, LARGEUR, 1, 0, y, LARGEUR, 1);
  }
  ctx.putImageData(filet, 0, bande - lisere + 4);
  // 2. Bande en dégradé (recouvre le mot « Département » du modèle).
  const rvb = hexVersRvb(couleur) || hexVersRvb("#8F8585");
  const [t, s, l] = rvbVersTsl(...rvb);
  const haut = bande + 2;
  const grad = ctx.createLinearGradient(0, haut, 0, HAUTEUR);
  for (const [pos, dt, dl] of degrade) {
    const [r, v, b] = tslVersRvb((t + dt + 360) % 360, s, Math.min(0.92, l + dl));
    grad.addColorStop(pos, `rgb(${Math.round(r)}, ${Math.round(v)}, ${Math.round(b)})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, haut, LARGEUR, HAUTEUR - haut);
}

function ecrireTitreSeul(ctx, texte) {
  if (!texte) return;
  const spec = TITRE_SEUL.titre;
  ctx.save();
  ctx.shadowColor = "rgba(0, 20, 40, 0.5)";
  ctx.shadowBlur = 7;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ecrireLigneDoree(ctx, texte, spec, spec.hauteurCap, spec.base);
  ctx.restore();
}

// ---------- Photo ----------

function dessinerPhoto(ctx, img) {
  const { x, y, l, h } = PHOTO;
  // Recadrage « cover », centré horizontalement, calé un peu vers le haut (visage).
  const echelle = Math.max(l / img.naturalWidth, h / img.naturalHeight);
  const sl = l / echelle, sh = h / echelle;
  const sx = (img.naturalWidth - sl) / 2;
  const sy = Math.max(0, (img.naturalHeight - sh) * 0.3);
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sl, sh, x, y, l, h);
  ctx.restore();
}

function dessinerSansPhoto(ctx, membre) {
  const { x, y, l, h } = PHOTO;
  ctx.save();
  ctx.fillStyle = "#E9E4E2";
  ctx.fillRect(x, y, l, h);
  ctx.fillStyle = "#B9AAA5";
  ctx.font = `600 120px ${POLICE}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const initiales = `${(membre.prenom || "")[0] || ""}${(membre.nom || "")[0] || ""}`.toUpperCase() || "?";
  ctx.fillText(initiales, x + l / 2, y + h / 2 - 10);
  ctx.font = `500 26px ${POLICE}`;
  ctx.fillText("PHOTO", x + l / 2, y + h - 40);
  ctx.restore();
}

// ---------- Données ----------

/** Nom affiché : NOM + prénoms, en majuscules, comme sur la maquette. */
export function nomCarte(membre) {
  return [membre.nom, membre.prenom].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().toUpperCase();
}

// ---------- Recto / verso ----------

/**
 * `fondMaquette` : maquette de référence (ACCUEIL, bande bleue), recolorée
 * pour chaque département (HUISSIER compris) — seule la couleur change.
 * `fond` : ancien fond (HUISSIER), utilisé seulement si la maquette manque.
 * `membre.crea` : créa importée du département, utilisée telle quelle à la place.
 */
export async function dessinerRecto({ fond, fondMaquette, membre }) {
  const canvas = nouveauCanvas();
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // Créa importée pour ce département : elle remplace le fond, sans recoloriage.
  const crea = membre.crea ? await chargerImage(membre.crea).catch(() => null) : null;
  const base = fondMaquette ? COULEUR_FOND_MAQUETTE : COULEUR_MODELE;
  // La créa porte déjà sa bande : la variante « titre seul » ne la concerne pas.
  const titreSeul = !crea && membre.modele === "TITRE";
  if (crea) {
    ctx.drawImage(crea, 0, 0, LARGEUR, HAUTEUR);
  } else {
    ctx.drawImage(fondMaquette || fond, 0, 0, LARGEUR, HAUTEUR);
    teinterFond(ctx, membre.couleur, base);
    if (titreSeul) dessinerBandeTitreSeul(ctx, membre.couleur);
  }

  if (membre.photo) {
    try {
      dessinerPhoto(ctx, await chargerImage(membre.photo));
    } catch {
      dessinerSansPhoto(ctx, membre);
    }
  } else {
    dessinerSansPhoto(ctx, membre);
  }

  const textes = crea || base === COULEUR_FOND_MAQUETTE ? TEXTES_MAQUETTE : TEXTES;
  if (crea) ecrire(ctx, MENTIONS_CREA.matricule.texte, MENTIONS_CREA.matricule);
  ecrire(ctx, nomCarte(membre), textes.nom);
  ecrire(ctx, String(membre.fonction || "").toUpperCase(), textes.fonction);
  const decale = (cle) => (titreSeul ? { ...textes[cle], base: textes[cle].base + TITRE_SEUL.decalages[cle] } : textes[cle]);
  ecrire(ctx, String(membre.matricule || "").toUpperCase(), decale("matricule"));
  ecrire(ctx, String(membre.district || "").toUpperCase(), decale("district"));
  // Sur une créa, « Département » et le nom du département sont déjà dans l'image.
  if (crea) return canvas;
  const departement = String(membre.departement || "").toUpperCase();
  if (titreSeul) ecrireTitreSeul(ctx, departement);
  else ecrireDepartement(ctx, departement, membre.couleur, textes);
  return canvas;
}

export async function dessinerVerso({ membre }) {
  const canvas = nouveauCanvas();
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  // QR : modules dessinés un à un (net à toute taille), sans marge blanche ajoutée.
  const qr = QRCode.create(String(membre.matricule || ""), { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const { x, y, taille } = VERSO.qr;
  const pas = taille / n;
  ctx.fillStyle = "#000000";
  for (let lig = 0; lig < n; lig++) {
    for (let col = 0; col < n; col++) {
      if (qr.modules.get(lig, col)) {
        ctx.fillRect(Math.floor(x + col * pas), Math.floor(y + lig * pas), Math.ceil(pas), Math.ceil(pas));
      }
    }
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const { nom, matricule } = VERSO;
  ctx.fillStyle = nom.couleur;
  ctx.font = `${nom.poids} ${nom.taille}px ${POLICE}`;
  ctx.fillText(nomCarte(membre), nom.x, nom.base);
  ctx.fillStyle = matricule.couleur;
  ctx.font = `${matricule.poids} ${matricule.taille}px ${POLICE}`;
  ctx.fillText(String(membre.matricule || "").toUpperCase(), matricule.x, matricule.base);

  const { cadre, texte, lignes } = VERSO;
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = cadre.trait;
  ctx.strokeRect(cadre.x, cadre.y, cadre.l, cadre.h);
  ctx.textAlign = "left";
  ctx.fillStyle = texte.couleur;
  ctx.font = `${texte.poids} 100px ${POLICE}`;
  const tailleTexte = (100 * texte.largeurLigne1) / ctx.measureText(lignes[0]).width;
  ctx.font = `${texte.poids} ${tailleTexte}px ${POLICE}`;
  lignes.forEach((ligne, i) => ctx.fillText(ligne, texte.x, texte.base + i * texte.interligne));
  return canvas;
}

/** Dimensions d'impression (CR80 portrait). */
export const DIMENSIONS_IMPRESSION = FORMAT_MM;
