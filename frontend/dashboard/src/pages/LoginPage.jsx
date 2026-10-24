import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, BadgeCheck, BarChart3, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { api } from "../lib/api";
import { setSession } from "../lib/auth";
import { C } from "../theme";
import { usePageMeta } from "../hooks/usePageMeta";
import Btn from "../ui/Btn";
import { Input } from "../ui/inputs";
import Logo from "../components/Logo";

export default function LoginPage() {
  usePageMeta(
    "Connexion — RSI",
    "Espace d'administration de l'application de présence par badgeage QR de la RSI."
  );
  const navigate = useNavigate();
  const location = useLocation();
  const inscription = Boolean(location.state?.inscription);
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur(null);
    setLoading(true);
    try {
      const data = await api.login(email.trim(), motDePasse);
      setSession(data.token, data.admin);
      navigate("/", { replace: true });
    } catch (err) {
      // On distingue les cas par le code machine (cf. docs/api-contrat.md).
      if (err.code === "IDENTIFIANTS_INVALIDES") {
        // Après un mot de passe erroné, l'API renvoie le nombre de tentatives
        // restantes (reste). Au-delà de 3 échecs, code COMPTE_BLOQUE.
        const reste = err.data?.reste;
        setErreur(
          reste > 0
            ? `Email ou mot de passe incorrect. Il vous reste ${reste} tentative(s) avant blocage.`
            : "Email ou mot de passe incorrect."
        );
      } else if (err.code === "CHAMPS_MANQUANTS") {
        setErreur("Merci de renseigner l'email et le mot de passe.");
      } else {
        // COMPTE_BLOQUE / COMPTE_DESACTIVE / autres : on montre le message réel.
        setErreur(err.message || "Impossible de se connecter.");
      }
    } finally {
      setLoading(false);
    }
  }

  const pointsForts = [
    {
      icon: BadgeCheck,
      titre: "Badgeage QR en une seconde",
      description: "Scan fluide au terminal kiosque.",
    },
    {
      icon: BarChart3,
      titre: "Suivi en temps réel",
      description: "Présences, départements et effectifs à jour.",
    },
    {
      icon: Mail,
      titre: "Rapports PDF automatiques",
      description: "Export et envoi par email simplifiés.",
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: C.header }}>
      <Logo
        decoratif
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
        style={{
          width: "min(140vw, 1100px)",
          opacity: 0.06,
          filter: "grayscale(1) brightness(2)",
        }}
      />

      <div className="w-full max-w-5xl relative z-10 grid grid-cols-1 lg:grid-cols-2 rounded-3xl shadow-[0_40px_80px_-40px_rgba(15,10,10,0.9)] overflow-hidden border border-white/10">
        <div className="hidden lg:flex flex-col justify-between p-10 text-white relative" style={{ background: C.header }}>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Logo hautePriorite className="w-16 h-16 object-contain drop-shadow-lg" />
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-white/70">RSI</p>
                <h1 className="text-xl font-semibold" style={{ fontFamily: "Poppins,sans-serif" }}>
                  Royaume de Stabilité Internationale
                </h1>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold" style={{ fontFamily: "Poppins,sans-serif" }}>
                Présence des ouvriers, simplement.
              </p>
              <p className="text-sm text-white/80 max-w-sm">
                Un accès clair et sécurisé pour piloter les badges, les pointages et les rapports au quotidien.
              </p>
            </div>
            <div className="space-y-3 pt-4">
              {pointsForts.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.titre} className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 ring-1 ring-white/20">
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.titre}</p>
                      <p className="text-xs text-white/70">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-white/50">© {new Date().getFullYear()} Royaume de Stabilité Internationale</p>
        </div>

        <div className="bg-white/98 backdrop-blur flex flex-col">
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-center p-6 sm:p-8 lg:p-10 space-y-5">
            <div className="flex flex-col items-center text-center gap-3 lg:items-start lg:text-left">
              <div className="flex items-center gap-3">
                <Logo hautePriorite className="w-14 h-14 object-contain" />
                <div>
                  <h1 className="text-lg font-bold text-slate-900" style={{ fontFamily: "Poppins,sans-serif" }}>
                    Connexion au dashboard
                  </h1>
                  <p className="text-xs text-slate-500">Espace d'administration — RSI</p>
                </div>
              </div>
            </div>

            {inscription && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Si votre adresse n'était pas déjà utilisée, votre compte a été créé. Vous pouvez vous connecter.
              </div>
            )}

            {erreur && (
              <div
                className="flex items-start gap-2 text-sm text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-3 py-2"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{erreur}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <Btn type="submit" disabled={loading} loading={loading} className="w-full" size="lg">
              {loading ? "Connexion…" : "Se connecter"}
            </Btn>

            <div className="text-center">
              <Link to="/oublie" className="text-xs text-slate-500 hover:text-bordeaux-700 transition-colors">
                Mot de passe oublié ?
              </Link>
            </div>

            <p className="text-center text-[10px] leading-relaxed text-slate-500 border-t border-slate-100 pt-4">
              En vous connectant, vous acceptez les{" "}
              <Link to="/cgv-cgu" className="underline hover:text-bordeaux-700 transition-colors">
                conditions d'utilisation
              </Link>{" "}
              et notre{" "}
              <Link to="/confidentialite" className="underline hover:text-bordeaux-700 transition-colors">
                politique de confidentialité
              </Link>
              .
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
