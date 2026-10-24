import { Children, cloneElement, isValidElement, useId } from "react";

/** Classe partagée de tous les champs de saisie (input / select / textarea). */
export const inputCls = (extra = "") =>
  `w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder:text-slate-500 bg-white focus:outline-none focus:border-bordeaux-400 focus:ring-2 focus:ring-bordeaux-200 transition ${extra}`;

/** Libellé + aide, wrapper des champs (label associé au contrôle). */
export function Field({ label, hint, children, className = "" }) {
  const idGenere = useId();
  const idAide = `${idGenere}-aide`;
  const premier = Children.toArray(children)[0];
  const controle = isValidElement(premier)
    ? cloneElement(premier, {
        id: premier.props.id || idGenere,
        "aria-describedby":
          [premier.props["aria-describedby"], hint ? idAide : null].filter(Boolean).join(" ") || undefined,
      })
    : children;
  const idControle = isValidElement(controle) ? controle.props.id : undefined;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={idControle} className="text-xs font-medium text-slate-600">
          {label}
        </label>
      )}
      {controle}
      {hint && (
        <p id={idAide} className="text-[11px] text-slate-500 leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Input({ className = "", ...props }) {
  return <input className={inputCls(className)} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <select className={inputCls(className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...props }) {
  return <textarea className={inputCls(className)} {...props} />;
}
