// Déclenche le téléchargement d'un Blob côté navigateur avec un nom de fichier
// donné. Utilisé pour le ZIP des badges, le PNG d'un badge individuel et les
// exports CSV — mutualisé pour éviter de dupliquer la mécanique dans chaque page.
export function telechargerBlob(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}
