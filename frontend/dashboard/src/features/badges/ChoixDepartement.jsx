import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Choix d'un département pour l'atelier : liste maison plutôt que <select>
 * natif (sous Windows, la liste native de Chrome rognait le début des noms).
 * Chaque ligne montre la pastille de couleur, le nom et le nombre de membres.
 */
export default function ChoixDepartement({ departements, valeur, onChange, avecTemple = false, className = "" }) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const racine = useRef(null);
  const liste = useRef(null);
  const id = useId();
  const choisi = departements.find((d) => d.id === valeur) || null;

  useEffect(() => {
    if (!ouvert) return undefined;
    const fermer = (e) => racine.current && !racine.current.contains(e.target) && setOuvert(false);
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [ouvert]);

  useEffect(() => {
    if (ouvert && actif >= 0) liste.current?.children[actif]?.scrollIntoView({ block: "nearest" });
  }, [ouvert, actif]);

  function ouvrir() {
    setActif(Math.max(0, departements.findIndex((d) => d.id === valeur)));
    setOuvert(true);
  }

  function choisir(d) {
    onChange(d.id);
    setOuvert(false);
  }

  function clavier(e) {
    if (!ouvert) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        ouvrir();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOuvert(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((i) => Math.min(departements.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (departements[actif]) choisir(departements[actif]);
    } else if (e.key === "Tab") {
      setOuvert(false);
    }
  }

  const ligne = (d) => (
    <>
      <span
        className={`h-3 w-3 shrink-0 rounded-full ${d.couleur ? "border border-black/10" : "border border-dashed border-slate-400"}`}
        style={d.couleur ? { background: d.couleur } : undefined}
        aria-hidden="true"
      />
      <span className="truncate font-medium text-slate-800">{d.nom}</span>
      {avecTemple && d.eglise && <span className="truncate text-slate-500">· {d.eglise.nom}</span>}
      {d._count && <span className="text-slate-500 tabular-nums">({d._count.membres})</span>}
      {!d.couleur && <span className="ml-auto shrink-0 text-[11px] text-amber-700">couleur à définir</span>}
    </>
  );

  return (
    <div ref={racine} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label="Département"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={`${id}-liste`}
        aria-activedescendant={ouvert && actif >= 0 ? `${id}-${actif}` : undefined}
        onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
        onKeyDown={clavier}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm focus:outline-none focus:border-bordeaux-400 focus:ring-2 focus:ring-bordeaux-200"
      >
        {choisi ? ligne(choisi) : <span className="text-slate-500">Choisir un département</span>}
        <ChevronDown size={16} className={`ml-auto shrink-0 text-slate-500 transition ${ouvert ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {ouvert && (
        <ul
          ref={liste}
          id={`${id}-liste`}
          role="listbox"
          aria-label="Départements"
          className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {departements.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Aucun département dans ce temple.</li>}
          {departements.map((d, i) => (
            <li
              key={d.id}
              id={`${id}-${i}`}
              role="option"
              aria-selected={d.id === valeur}
              onMouseEnter={() => setActif(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choisir(d)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                i === actif ? "bg-bordeaux-50" : ""
              } ${d.id === valeur ? "font-semibold" : ""}`}
            >
              {ligne(d)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
