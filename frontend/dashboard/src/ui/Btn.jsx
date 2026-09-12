import { C } from "../theme";
import Spinner from "./Spinner";

/**
 * Bouton unique du design system — trois familles visuelles, une seule source :
 *  - primary : dégradé bordeaux identitaire (C.btn) — action principale
 *  - gold    : dégradé or identitaire (C.gold) — action secondaire dorée
 *  - danger  : bordeaux foncé — action destructrice
 *  - secondary / ghost : neutres (fond blanc / transparent)
 * Le chargement affiche un spinner à l'intérieur du bouton.
 */
export default function Btn({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  type = "button",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition select-none disabled:opacity-50 disabled:cursor-not-allowed";
  const tailles = {
    xs: "text-xs px-2.5 py-1.5",
    sm: "text-xs px-3 py-2",
    md: "text-sm px-4 py-2.5",
    lg: "text-sm px-5 py-2.5 rounded-full shadow-sm",
  };

  const solides = {
    primary: C.btn,
    gold: C.gold,
    danger: "linear-gradient(135deg,#932A1F,#7B1515)",
  };
  const neutres = {
    secondary:
      "text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm",
    ghost: "text-slate-600 hover:bg-slate-100",
    softDanger:
      "text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 hover:bg-bordeaux-100",
  };

  const isSolide = variant in solides;
  const cls = isSolide
    ? "text-white shadow-sm hover:opacity-90"
    : neutres[variant] || neutres.ghost;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${tailles[size] || tailles.md} ${cls} ${className}`}
      {...(isSolide ? { style: { background: solides[variant] } } : {})}
      {...props}
    >
      {loading && <Spinner size="xs" light={isSolide} />}
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
}