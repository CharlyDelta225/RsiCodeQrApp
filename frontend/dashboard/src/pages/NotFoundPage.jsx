import { Link } from "react-router-dom";
import { C } from "../theme";
import { usePageMeta } from "../hooks/usePageMeta";

export default function NotFoundPage() {
  usePageMeta(
    "Page introuvable — RSI",
    "La page demandée est introuvable sur l'application de présence RSI."
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: C.header }}
    >
      <div className="w-full max-w-sm bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-white/20 p-7 text-center space-y-4 relative z-10">
        <p
          className="text-6xl font-bold"
          style={{ fontFamily: "Poppins,sans-serif", color: C.btn }}
        >
          404
        </p>
        <div>
          <h1 className="text-lg font-bold text-slate-900" style={{ fontFamily: "Poppins,sans-serif" }}>
            Page introuvable
          </h1>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">
            Cette adresse n'existe pas ou a été déplacée.
          </p>
        </div>
        <Link
          to="/"
          className="inline-block w-full py-2.5 rounded-full text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ background: C.btn }}
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}