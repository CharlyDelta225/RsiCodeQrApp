import { Children } from "react";
import Spinner from "./Spinner";

/**
 * Tableau du design system : en-tête sur ton bordeaux-50, états de chargement
 * et liste vide intégrés. `colonnes` = libellés des <th>.
 * L'état vide (`vide`) n'apparaît que si aucune ligne n'est réellement rendue.
 */
export default function TableShell({
  colonnes,
  children,
  chargement = false,
  vide = null,
  className = "",
}) {
  const n = colonnes.length;
  const nbLignes = Children.toArray(children).filter(
    (c) => c !== false && c !== null && c !== undefined && c !== ""
  ).length;
  return (
    <div
      className={`border border-slate-200 rounded-xl overflow-hidden overflow-x-auto ${className}`}
    >
      <table className="w-full text-sm">
        <thead className="bg-bordeaux-50/70 text-bordeaux-900/80 text-left">
          <tr>
            {colonnes.map((c, i) => (
              <th
                key={c + i}
                className={
                  "px-3 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap " +
                  (i === n - 1 ? "text-right" : "")
                }
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chargement ? (
            <tr>
              <td colSpan={n} className="px-3 py-8 text-center">
                <span className="inline-flex items-center gap-2 text-slate-400">
                  <Spinner size="sm" />
                  <span className="text-xs">Chargement…</span>
                </span>
              </td>
            </tr>
          ) : nbLignes === 0 && vide ? (
            <tr>
              <td colSpan={n} className="px-3 py-8 text-center text-sm text-slate-400">
                {vide}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}