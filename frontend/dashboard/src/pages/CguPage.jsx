import { Link } from "react-router-dom";
import { C } from "../theme";
import { usePageMeta } from "../hooks/usePageMeta";
import rsiLogo from "../assets/rsi-logo.png";

const SECTIONS = [
  {
    titre: "1. Objet",
    corps: [
      "Les présentes conditions générales d'utilisation (« CGU ») encadrent l'accès et l'usage de l'application de présence par badgeage QR de la RSI (le « Service »), accessible à l'adresse officielle mise en ligne par la RSI. En utilisant le Service, vous acceptez les présentes CGU.",
    ],
  },
  {
    titre: "2. Accès au Service",
    corps: [
      "Le Service est réservé aux membres, bénévoles et responsables autorisés de la RSI. L'accès suppose la possession d'un compte administrateur ou, pour le terminal de badgeage, une connexion au réseau de l'église.",
    ],
  },
  {
    titre: "3. Comptes et identifiants",
    corps: [
      "Chaque compte est personnel : ne communiquez vos identifiants à personne et choisissez un mot de passe robuste. Vous êtes responsable de toute utilisation de votre compte.",
    ],
  },
  {
    titre: "4. Utilisation du Service",
    corps: [
      "Le Service permet de badger les ouvriers, de consulter les pointages, de gérer les badges et départements, et de générer des rapports de présence. Il doit être utilisé uniquement à ces fins, dans le respect de la loi et des règles de la RSI.",
    ],
  },
  {
    titre: "5. Utilisations interdites",
    corps: [
      "Il est notamment interdit de : tenter d'accéder à des comptes ou données sans autorisation ; contourner les mécanismes de sécurité ; modifier, voler ou diffuser des données personnelles ; utiliser le Service à des fins commerciales ou frauduleuses.",
    ],
  },
  {
    titre: "6. Responsabilité",
    corps: [
      "L'utilisateur est responsable de l'usage conforme qu'il fait du Service et de son compte. La RSI met le Service à disposition sans garantie de disponibilité permanente, mais s'efforce d'assurer un fonctionnement continu.",
    ],
  },
  {
    titre: "7. Suspension des comptes",
    corps: [
      "La RSI peut suspendre ou supprimer un compte en cas de violation des présentes CGU, sans préjudice des autres droits.",
    ],
  },
  {
    titre: "8. Données personnelles",
    corps: [
      "Le traitement des données personnelles est décrit dans la politique de confidentialité, consultable depuis le Service et accessible aux pages publiques.",
    ],
  },
  {
    titre: "9. Propriété intellectuelle",
    corps: [
      "Le logo RSI, la charte graphique et l'application elle-même appartiennent à la RSI. Toute reproduction ou réutilisation sans autorisation est interdite.",
    ],
  },
  {
    titre: "10. Hébergement",
    corps: [
      "Le Service est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.",
    ],
  },
  {
    titre: "11. Droit applicable",
    corps: [
      "Les présentes CGU sont régies par le droit applicable au siège de la RSI. Toute difficulté sera traitée à l'amiable en priorité.",
    ],
  },
  {
    titre: "12. Contact",
    corps: [
      "Pour toute question relative aux CGU, contactez un administrateur de l'application.",
    ],
  },
];

export default function CguPage() {
  usePageMeta(
    "Conditions d'utilisation — RSI",
    "Conditions générales d'utilisation de l'application de présence par badgeage QR de la RSI."
  );

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: C.header }}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <img src={rsiLogo} alt="" aria-hidden="true" className="w-16 h-16 object-contain drop-shadow-md" />
          <div>
            <h1
              className="text-xl font-bold text-white"
              style={{ fontFamily: "Poppins,sans-serif" }}
            >
              Conditions d'utilisation
            </h1>
            <p className="text-xs text-white/80 mt-1">RSI — Application de présence par badgeage QR</p>
          </div>
        </div>

        <article className="bg-white rounded-2xl shadow-2xl border border-white/20 p-6 md:p-8 space-y-6">
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ fontFamily: "Poppins,sans-serif" }}>
              Mentions légales
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed mb-1.5">
              <strong>Éditeur :</strong> RSI (organisation de l'église en charge des activités),
              contact via les administrateurs de l'application.
            </p>
            <p className="text-sm text-slate-700 leading-relaxed mb-1.5">
              <strong>Directeur de publication :</strong> la personne désignée par la RSI.
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              <strong>Hébergeur :</strong> Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789,
              États-Unis.
            </p>
          </section>

          {SECTIONS.map((s) => (
            <section key={s.titre}>
              <h2 className="text-base font-bold text-slate-900 mb-2" style={{ fontFamily: "Poppins,sans-serif" }}>
                {s.titre}
              </h2>
              {s.corps.map((par, i) => (
                <p key={i} className="text-sm text-slate-700 leading-relaxed mb-1.5">
                  {par}
                </p>
              ))}
            </section>
          ))}

          <div className="pt-2 flex flex-wrap gap-4">
            <Link
              to="/login"
              className="inline-block text-sm font-medium text-bordeaux-700 hover:text-bordeaux-800 transition-colors"
            >
              ← Retour à la connexion
            </Link>
            <Link
              to="/confidentialite"
              className="inline-block text-sm font-medium text-bordeaux-700 hover:text-bordeaux-800 transition-colors"
            >
              Politique de confidentialité →
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}