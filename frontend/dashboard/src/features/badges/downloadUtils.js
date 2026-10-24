/**
 * Téléchargement direct côté navigateur (PNG/JPG).
 * Utilise html2canvas sur le composant rendu pour exporter une carte
 * à l'échelle visuelle, sans passer par window.print().
 */

import html2canvas from "html2canvas";

function attendreImages() {
  const images = Array.from(document.images);
  return Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      });
    })
  );
}

function attendrePolices() {
  if (document.fonts?.ready) {
    return document.fonts.ready;
  }
  return Promise.resolve();
}

function declencherTelechargement(dataUrl, nomFichier) {
  const lien = document.createElement("a");
  lien.href = dataUrl;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
}

function nettoyerNom(nom) {
  return String(nom || "badge")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

/**
 * Capture un élément DOM en PNG (haute résolution).
 * @param {HTMLElement} element
 * @param {{scale?: number, backgroundColor?: string|null}} options
 */
export async function elementToPngDataUrl(
  element,
  { scale = 2.5, backgroundColor = null } = {}
) {
  if (!element) throw new Error("Élément à capturer introuvable.");

  await attendreImages();
  await attendrePolices();
  // Petit délai pour laisser le flip/animations se figer.
  await new Promise((resolve) => setTimeout(resolve, 50));

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor,
    logging: false,
  });

  return canvas.toDataURL("image/png");
}

/**
 * Télécharge recto ou verso en PNG.
 */
export async function telechargerBadgePng(element, membre, face = "recto") {
  const dataUrl = await elementToPngDataUrl(element);
  const base = `${nettoyerNom(membre?.matricule)}_${nettoyerNom(
    membre?.prenom
  )}_${nettoyerNom(membre?.nom)}`;
  declencherTelechargement(dataUrl, `${base}_${face}.png`);
}
