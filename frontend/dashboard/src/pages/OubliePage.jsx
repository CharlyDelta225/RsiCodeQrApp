import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { C } from "../theme";
import Btn from "../ui/Btn";
import { Input } from "../ui/inputs";
import rsiLogo from "../assets/rsi-logo.png";

/**
 * Page publique "Mot de passe oublié ?".
 * Demande un lien de réinitialisation : il est envoyé par email SI un compte
 * porte cet email (l'API répond toujours la même chose pour ne pas révéler
 * quels comptes existent).
 */
export default function OubliePage() {
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur(null);
    setLoading(true);
    try {
      await api.demanderResetEmail(email.trim());
      setEnvoye(true);
    } catch (err) {
      setErreur(err.message || "Impossible de contacter le serveur.");
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
        style={{ width: "min(120vw, 900px)", opacity: 0.08, filter: "grayscale(1) brightness(2)" }}
      />

      <div className="w-full max-w-sm bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-white/20 p-7 space-y-5 relative z-10">
        <div className="flex flex-col items-center text-center gap-3 pb-1">
          <img src={rsiLogo} alt="RSI" className="w-16 h-16 object-contain drop-shadow-md" />
          <div>
            <h1 className="text-lg font-bold text-slate-900" style={{ fontFamily: "Poppins,sans-serif" }}>
              Mot de passe oublié
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {envoye
                ? "Vérifiez votre boîte mail"
                : "Un lien de réinitialisation sera envoyé par email"}
            </p>
          </div>
        </div>

        {envoye ? (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3 leading-relaxed">
            Si un compte existe avec cet email, un lien de réinitialisation (valable 1 heure) vient
            d'être envoyé. Consultez votre boîte mail (pensez au dossier spam).
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {erreur && (
              <div className="text-sm text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-3 py-2">
                {erreur}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email du compte</label>
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>

            <Btn type="submit" disabled={loading} loading={loading} className="w-full" size="lg">
              {loading ? "Envoi…" : "Envoyer le lien"}
            </Btn>
          </form>
        )}

        <p className="text-center">
          <Link to="/login" className="text-xs text-slate-500 hover:text-red-700 transition-colors">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}