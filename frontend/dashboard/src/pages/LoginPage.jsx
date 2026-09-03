import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setSession } from "../lib/auth";

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4"
      >
        <div>
          <h1 className="text-lg font-bold text-slate-900">RSI — Dashboard présence</h1>
          <p className="text-sm text-slate-500">Connexion administrateur</p>
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
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
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
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-60 transition-colors"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
