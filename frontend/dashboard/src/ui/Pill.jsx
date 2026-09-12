/**
 * Pastille de statut — sémantique bornée mais déclinée, quand il le faut, sur
 * les tons de la maison : « present » et « danger » utilisent le bordeaux RSI.
 */
const PALETTES = {
  vert: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  rouge: "bg-bordeaux-50 text-bordeaux-700 ring-1 ring-bordeaux-200",
  orange: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  or: "bg-gold-50 text-gold-800 ring-1 ring-gold-200",
  bleu: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  gris: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

export default function Pill({ tonalite = "gris", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
        PALETTES[tonalite] || PALETTES.gris
      } ${className}`}
    >
      {children}
    </span>
  );
}