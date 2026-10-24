import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const TYPES = {
  success: {
    Icone: CheckCircle2,
    icone: "text-emerald-600",
    cadre: "border-emerald-200",
    barre: "bg-emerald-500",
  },
  error: {
    Icone: AlertCircle,
    icone: "text-bordeaux-600",
    cadre: "border-bordeaux-200",
    barre: "bg-bordeaux-600",
  },
  info: {
    Icone: Info,
    icone: "text-gold-700",
    cadre: "border-gold-200",
    barre: "bg-gold-500",
  },
};

let compteur = 0;

export function ToastProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const minuteries = useRef(new Map());

  const retirer = useCallback((id) => {
    const minuterie = minuteries.current.get(id);
    if (minuterie) clearTimeout(minuterie);
    minuteries.current.delete(id);
    setNotifications((liste) => liste.filter((n) => n.id !== id));
  }, []);

  const ajouter = useCallback(
    (type, titre, message, duree = 5000) => {
      const id = ++compteur;
      setNotifications((liste) => [...liste.slice(-3), { id, type, titre, message }]);
      const minuterie = setTimeout(() => retirer(id), duree);
      minuteries.current.set(id, minuterie);
      return id;
    },
    [retirer]
  );

  useEffect(() => {
    const courantes = minuteries.current;
    return () => {
      courantes.forEach((minuterie) => clearTimeout(minuterie));
      courantes.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      toast: ajouter,
      success: (titre, message, duree) => ajouter("success", titre, message, duree),
      error: (titre, message, duree) => ajouter("error", titre, message, duree),
      info: (titre, message, duree) => ajouter("info", titre, message, duree),
    }),
    [ajouter]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {notifications.map((n) => {
          const style = TYPES[n.type] || TYPES.info;
          const Icone = style.Icone;
          return (
            <div
              key={n.id}
              role={n.type === "error" ? "alert" : "status"}
              className={`pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-xl border bg-white px-4 py-3 pl-5 shadow-lg ${style.cadre} page-enter`}
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${style.barre}`} aria-hidden="true" />
              <div className="flex items-start gap-3">
                <Icone className={`mt-0.5 h-5 w-5 flex-shrink-0 ${style.icone}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{n.titre}</p>
                  {n.message ? <p className="mt-0.5 text-sm text-slate-600">{n.message}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => retirer(n.id)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-bordeaux-500"
                  aria-label="Fermer la notification"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const contexte = useContext(ToastContext);
  if (!contexte) {
    throw new Error("useToast doit être utilisé à l'intérieur de ToastProvider.");
  }
  return contexte;
}
