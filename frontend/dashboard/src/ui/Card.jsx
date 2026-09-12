/** Carte blanche du design system : titre + description + actions + corps. */
export default function Card({
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "",
}) {
  return (
    <section
      className={`bg-white border border-slate-200 rounded-xl shadow-sm ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-2 flex-wrap px-4 md:px-5 pt-4 md:pt-5 pb-2">
          <div className="min-w-0">
            {title && (
              <h3
                className="text-sm font-semibold text-slate-800"
                style={{ fontFamily: "Poppins,sans-serif" }}
              >
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`px-4 md:px-5 pb-4 md:pb-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}