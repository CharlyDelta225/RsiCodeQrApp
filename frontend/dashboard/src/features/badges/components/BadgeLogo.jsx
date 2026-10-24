import { useEffect, useState } from "react";
import Logo from "../../../components/Logo";

/**
 * Logo affiché sur le badge :
 *  - logo personnalisé fourni par l'utilisateur (stocké localement), sinon
 *  - logo RSI déjà présent dans le dashboard.
 *
 * Si le logo personnalisé ne charge pas, on retombe proprement sur le logo RSI.
 */
export default function BadgeLogo({ logoUrl }) {
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    setErreur(false);
  }, [logoUrl]);

  if (logoUrl && !erreur) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="rds-logo-img"
        onError={() => setErreur(true)}
      />
    );
  }

  return <Logo className="rds-logo-img" decoratif />;
}
