import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { C } from "../theme";
import Btn from "../ui/Btn";
import { Input } from "../ui/inputs";
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
      if (err.code === "MOT_DE_PASSE_TROP_COURT") {
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
          <div className="text-sm text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-3 py-2">
            {erreur}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe</label>
          <Input
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            placeholder="8 caractères minimum"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Confirmer le mot de passe</label>
          <Input
            type="password"
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="Retapez le mot de passe"
          />
        </div>

        <Btn type="submit" disabled={loading} loading={loading} className="w-full" size="lg">
          {loading ? "Création…" : "Créer mon compte"}
        </Btn>

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