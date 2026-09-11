import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { C } from "../theme";
import rsiLogo from "../assets/rsi-logo.png";

export default function InscriptionPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur(null);

    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      await api.register(email.trim(), motDePasse);
      navigate("/login", {
        replace: true,
        state: { inscription: true },
      });
    } catch (err) {
      if (err.code === "EMAIL_EXISTANT") {
        setErreur("Un compte existe déjà avec cet email.");
      } else if (err.code === "MOT_DE_PASSE_TROP_COURT") {
        setErreur("Le mot de passe doit faire au moins 8 caractères.");
      } else {
        setErreur(err.message || "Impossible de contacter le serveur.");
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
              Créer un compte
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Un administrateur définira ensuite vos droits d'accès.
            </p>
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
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow"
            style={{ "--tw-ring-color": "#D4A017" }}
            onFocus={(e) => (e.target.style.borderColor = "#C0392B")}
            onBlur={(e) => (e.target.style.borderColor = "")}
            placeholder="votre@email.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow"
            style={{ "--tw-ring-color": "#D4A017" }}
            onFocus={(e) => (e.target.style.borderColor = "#C0392B")}
            onBlur={(e) => (e.target.style.borderColor = "")}
            placeholder="8 caractères minimum"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Confirmer le mot de passe</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow"
            style={{ "--tw-ring-color": "#D4A017" }}
            onFocus={(e) => (e.target.style.borderColor = "#C0392B")}
            onBlur={(e) => (e.target.style.borderColor = "")}
            placeholder="Retapez le mot de passe"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ background: C.btn }}
        >
          {loading ? "Création…" : "Créer mon compte"}
        </button>

        <p className="text-center">
          <Link
            to="/login"
            className="text-xs text-slate-500 hover:text-red-700 transition-colors"
          >
            ← Retour à la connexion
          </Link>
        </p>
      </form>
    </div>
  );
}