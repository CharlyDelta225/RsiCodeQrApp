import rsiLogoWebp from "../assets/rsi-logo.webp";
import rsiLogoPng from "../assets/rsi-logo.png";

export default function Logo({ className, style, decoratif = false, hautePriorite = false }) {
  return (
    <picture>
      <source srcSet={rsiLogoWebp} type="image/webp" />
      <img
        src={rsiLogoPng}
        alt={decoratif ? "" : "RSI"}
        aria-hidden={decoratif || undefined}
        className={className}
        style={style}
        {...(hautePriorite ? { fetchPriority: "high", decoding: "sync" } : {})}
      />
    </picture>
  );
}