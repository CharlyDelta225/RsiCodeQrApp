/** Petit loader aux couleurs de la maison (bordeaux, or si sur fond bordeaux). */
export default function Spinner({ size = "sm", light = false, className = "" }) {
  const tailles = {
    xs: "h-3.5 w-3.5 border-2",
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-[3px]",
    lg: "h-9 w-9 border-4",
  };
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-t-transparent ${
        light ? "border-gold-300" : "border-bordeaux-500"
      } ${tailles[size] || tailles.sm} ${className}`}
    />
  );
}