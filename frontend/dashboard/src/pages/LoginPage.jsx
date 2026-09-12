import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { setSession } from "../lib/auth";
import { C } from "../theme";
import Btn from "../ui/Btn";
import { Input } from "../ui/inputs";
import rsiLogo from "../assets/rsi-logo.png";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const inscription = Boolean(location.state?.inscription);
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState(null);
  const [loading, setLoading] = useState(false);

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
        setErreur(err.message || "Impossible de se connecter. Vérifiez que le backend tourne.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: C.header }}
    >
      {/* Logo en grand filigrane derrière la carte — purement décoratif */}
      <img
        src={rsiLogo}
        alt=""
        aria-hidden="true"
        className="absolute pointer-events-none select-none"
        style={{
          width: "min(120vw, 900px)",
          opacity: 0.08,
          filter: "grayscale(1) brightness(2)",
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-white/20 p-7 space-y-5 relative z-10"
      >
        <div className="flex flex-col items-center text-center gap-3 pb-1">
          <img src={rsiLogo} alt="RSI" className="w-20 h-20 object-contain drop-shadow-md" />
          <div>
            <h1
              className="text-lg font-bold text-slate-900"
              style={{ fontFamily: "Poppins,sans-serif" }}
            >
              RSI — Dashboard présence
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Connexion administrateur</p>
          </div>
        </div>

        {inscription && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Si votre adresse n'était pas déjà utilisée, votre compte a été créé. Vous pouvez vous
            connecter.
          </div>
        )}

        {erreur && (
          <div className="text-sm text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-3 py-2">
            {erreur}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <Input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe</label>
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Btn type="submit" disabled={loading} loading={loading} className="w-full" size="lg">
          {loading ? "Connexion…" : "Se connecter"}
        </Btn>

        <p className="text-center">
          <Link
            to="/oublie"
            className="text-xs text-slate-500 hover:text-red-700 transition-colors"
          >
            Mot de passe oublié ?
          </Link>
        </p>

        <p className="text-center text-xs text-slate-500">
          Pas encore de compte ?{" "}
          <Link to="/inscription" className="font-medium hover:text-red-700 transition-colors">
            Créer un compte
          </Link>
        </p>
      </form>
    </div>
  );
}
