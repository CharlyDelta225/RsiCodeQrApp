import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setSession } from "../lib/auth";
import { C } from "../theme";
import rsiLogo from "../assets/rsi-logo.png";

export default function LoginPage() {
  const navigate = useNavigate();
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
      // On distingue le cas "identifiants invalides" du reste — le contrat
      // garantit ce code précis (cf. docs/api-contrat.md).
      if (err.code === "IDENTIFIANTS_INVALIDES") {
        setErreur("Email ou mot de passe incorrect.");
      } else if (err.code === "CHAMPS_MANQUANTS") {
        setErreur("Merci de renseigner l'email et le mot de passe.");
      } else {
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

        {erreur && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {erreur}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow"
            style={{ "--tw-ring-color": "#D4A017" }}
            onFocus={(e) => (e.target.style.borderColor = "#C0392B")}
            onBlur={(e) => (e.target.style.borderColor = "")}
            placeholder="admin@example.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow"
            style={{ "--tw-ring-color": "#D4A017" }}
            onFocus={(e) => (e.target.style.borderColor = "#C0392B")}
            onBlur={(e) => (e.target.style.borderColor = "")}
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ background: C.btn }}
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
