import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { C } from "../theme";
import rsiLogo from "../assets/rsi-logo.png";

/**
 * Page publique /reinitialisation?token=...&email=...
 * Arrive via le lien envoyé par email (POST /api/auth/reset-demand).
 * Pose un nouveau mot de passe ; le lien est à usage unique et expire au bout d'une heure.
 */
export default function ReinitialisationPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const email = params.get("email") || "";

  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setErreur("Ce lien est invalide ou incomplet.");
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur(null);

    if (motDePasse.length < 8) {
      setErreur("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      await api.effectuerReset(token, motDePasse);
      setSucces(true);
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
              Nouveau mot de passe
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {email ? `Compte : ${email}` : "Choisissez un nouveau mot de passe"}
            </p>
          </div>
        </div>

        {succes ? (
          <div className="text-center space-y-4">
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3">
              Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.
            </div>
            <Link
              to="/login"
              className="inline-block w-full py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: C.btn }}
            >
              Aller à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {erreur && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {erreur}
              </div>
            )}

            {token && !succes && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nouveau mot de passe</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                    style={{ "--tw-ring-color": "#D4A017" }}
                    placeholder="8 caractères minimum"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Confirmation</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                    style={{ "--tw-ring-color": "#D4A017" }}
                    placeholder="Répétez le mot de passe"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
                  style={{ background: C.btn }}
                >
                  {loading ? "Enregistrement…" : "Enregistrer le mot de passe"}
                </button>
              </>
            )}

            {!token && (
              <p className="text-sm text-slate-500 text-center">
                Ce lien est invalide ou a expiré.{" "}
                <Link to="/oublie" className="text-red-700 font-medium hover:underline">
                  Faire une nouvelle demande
                </Link>
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}