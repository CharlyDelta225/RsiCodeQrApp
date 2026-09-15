import { Link } from "react-router-dom";
import { C } from "../theme";
import { usePageMeta } from "../hooks/usePageMeta";
import Logo from "../components/Logo";

const SECTIONS = [
  {
    titre: "1. Responsable du traitement",
    corps: [
      "Les données personnelles traitées dans le cadre de l'application de présence RSI sont gérées par la RSI (organisation en charge des activités de l'église), ci-après « RSI ». Pour toute question relative à vos données, contactez l'un des administrateurs de l'application (depuis le tableau de bord) : toute demande sera transmise au responsable compétent.",
    ],
  },
  {
    titre: "2. Données collectées",
    corps: [
      "Comptes d'administration : adresse e-mail, rôle d'accès et mots de passe (stockés de façon sécurisée).",
      "Ouvriers : nom, prénom, matricule, département d'affectation et badge QR associé.",
      "Pointages : date, heure et ouvrier concerné à chaque badgeage.",
    ],
  },
  {
    titre: "3. Finalités",
    corps: [
      "Permettre le pointage des ouvriers par badgeage QR.",
      "Établir les rapports de présence (envoi automatique aux responsables concernés).",
      "Sécuriser l'accès à l'application (comptes, rôles, limitation des tentatives).",
    ],
  },
  {
    titre: "4. Bases légales",
    corps: [
      "Ces traitements reposent sur l'intérêt légitime de la RSI à organiser et à suivre la présence de ses membres et bénévoles, ainsi que sur la nécessité de faire fonctionner l'application pour ses utilisateurs autorisés.",
    ],
  },
  {
    titre: "5. Destinataires",
    corps: [
      "Les administrateurs de l'application, pour la gestion courante.",
      "L'hébergeur de l'application : Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis (Vercel traite les données pour le compte de la RSI).",
      "Le service d'envoi d'e-mails (Brevo) utilisé pour l'envoi des rapports de pointage et des liens de réinitialisation.",
      "Aucune donnée n'est vendue ni transmise à des tiers à des fins publicitaires.",
    ],
  },
  {
    titre: "6. Durée de conservation",
    corps: [
      "Les comptes d'administration sont conservés tant que le compte est actif.",
      "Les données des ouvriers et les pointages sont conservés pendant la durée nécessaire à la gestion de la présence par la RSI, puis supprimés selon les règles définies par le responsable du traitement.",
    ],
  },
  {
    titre: "7. Sécurité",
    corps: [
      "L'application est accessible en HTTPS (connexion chiffrée).",
      "Les mots de passe sont hachés, les accès sont limités par rôle et les tentatives de connexion sont plafonnées pour limiter les intrusions.",
    ],
  },
  {
    titre: "8. Stockage local sur votre appareil",
    corps: [
      "L'application n'utilise pas de cookies publicitaires ou tiers, ni d'outil de mesure d'audience (analytics). Elle conserve uniquement, dans le stockage local de votre navigateur : votre jeton de session (pour rester connecté) et, sur le terminal de badgeage, la préférence son. Ces informations restent sur votre appareil.",
    ],
  },
  {
    titre: "9. Vos droits",
    corps: [
      "Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, la limitation de leur traitement, leur portabilité et vous opposer à leur traitement. Adressez votre demande à un administrateur de l'application ; elle sera traitée dans un délai raisonnable.",
    ],
  },
  {
    titre: "10. Évolution de la politique",
    corps: [
      "Cette politique peut être mise à jour pour refléter l'évolution de l'application ou la réglementation. La version en ligne fait foi.",
    ],
  },
];

export default function ConfidentialitePage() {
  usePageMeta(
    "Politique de confidentialité — RSI",
    "Politique de confidentialité de l'application de présence par badgeage QR de la RSI."
  );

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: C.header }}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <Logo decoratif className="w-16 h-16 object-contain drop-shadow-md" />
          <div>
            <h1
              className="text-xl font-bold text-white"
              style={{ fontFamily: "Poppins,sans-serif" }}
            >
              Politique de confidentialité
            </h1>
            <p className="text-xs text-white/80 mt-1">RSI — Application de présence par badgeage QR</p>
          </div>
        </div>

        <article className="bg-white rounded-2xl shadow-2xl border border-white/20 p-6 md:p-8 space-y-6">
          <p className="text-sm text-slate-600 leading-relaxed">
            Cette page vous informe sur les données personnelles traitées par l'application et sur
            vos droits. Elle a vocation à être personnalisée (identité et coordonnées du responsable
            du traitement) par la RSI avant diffusion.
          </p>

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

          <div className="pt-2">
            <Link
              to="/login"
              className="inline-block text-sm font-medium text-bordeaux-700 hover:text-bordeaux-800 transition-colors"
            >
              ← Retour à la connexion
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}