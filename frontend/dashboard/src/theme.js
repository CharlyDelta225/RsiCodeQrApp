// ─── IDENTITÉ VISUELLE ────────────────────────────────────────────────────
// Gradients et polices repris du projet "Church Activity Reporting Platform"
// (même organisation RSI). On ne reprend QUE la structure/style visuel —
// aucune donnée mockée de cette maquette n'entre dans notre code.

export const C = {
  sidebar: "linear-gradient(180deg,#5A0A0A 0%,#7B1515 60%,#8B1A1A 100%)",
  sidebarFooter: "linear-gradient(180deg,#6B0C0C,#5A0A0A)",
  header: "linear-gradient(135deg,#5A0A0A 0%,#8B1A1A 100%)",
  btn: "linear-gradient(135deg,#C0392B,#922B21)",
  gold: "linear-gradient(135deg,#D4A017 0%,#8B6914 100%)",
  avatar: "linear-gradient(135deg,#D4A017,#C0392B)",
};

// Navigation adaptée à nos vraies entités (ouvriers/pointages/badges),
// pas aux écrans de la maquette (rapports de cellules, départements, etc.)
export const navItems = [
  { path: "/", label: "Tableau de bord", icon: "⊞", short: "Accueil" },
  { path: "/ouvriers", label: "Ouvriers", icon: "◎", short: "Ouvriers" },
  { path: "/badges", label: "Badges QR", icon: "⊛", short: "Badges" },
  { path: "/pointages", label: "Pointages du jour", icon: "⊕", short: "Pointages" },
  { path: "/historique", label: "Historique", icon: "⊡", short: "Historique" },
];

// Titre/sous-titre de la TopBar selon la route active
export const pageTitles = {
  "/": { title: "Tableau de bord", subtitle: "RsiCodeQrApp · Présence" },
  "/ouvriers": { title: "Ouvriers", subtitle: "Gestion du personnel" },
  "/badges": { title: "Badges QR", subtitle: "Génération et impression" },
  "/pointages": { title: "Pointages du jour", subtitle: "Suivi en temps réel" },
  "/historique": { title: "Historique", subtitle: "Filtrable · Exportable" },
};
