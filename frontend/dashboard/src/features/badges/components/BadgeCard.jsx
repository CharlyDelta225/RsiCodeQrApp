import { useEffect, useState } from "react";
import BadgeLogo from "./BadgeLogo";
import {
  initiales,
  libelleEglises,
  nomComplet,
  urlVerification,
} from "../badgeAdapter";
import {
  BADGE_MENTION_STAFF,
  BADGE_MENTION_VERSO,
  BADGE_ORGANISATION,
  BADGE_SOUS_TITRE,
} from "../badgeTypes";
import "../badge.css";

function valeurOuTiret(valeur) {
  return valeur && String(valeur).trim() ? valeur : "—";
}

function BadgeRecto({ membre, branding }) {
  const photoUrl = membre?.photoUrl || null;
  const [photoCassee, setPhotoCassee] = useState(false);

  useEffect(() => {
    setPhotoCassee(false);
  }, [photoUrl]);

  const nom = nomComplet(membre);
  const afficherPhoto = Boolean(photoUrl) && !photoCassee;
  const departement = valeurOuTiret(membre?.departement);
  const fonction = valeurOuTiret(membre?.fonction);
  const eglises = libelleEglises(membre);
  const matricule = valeurOuTiret(membre?.matricule);

  return (
    <article
      className="rds-badge-card rds-badge-recto"
      aria-label={`Recto du badge de ${nom}`}
    >
      <div className="rds-bg" aria-hidden="true">
        <span className="rds-bg-orb rds-bg-orb-1" />
        <span className="rds-bg-orb rds-bg-orb-2" />
        <span className="rds-bg-swoosh" />
      </div>

      <header className="rds-head">
        <div className="rds-logo-box">
          <BadgeLogo logoUrl={branding?.logoUrl} />
        </div>
        <div className="rds-org">
          <p className="rds-org-name">{BADGE_ORGANISATION}</p>
          <p className="rds-org-sub">{BADGE_SOUS_TITRE}</p>
        </div>
        <span className="rds-staff">{BADGE_MENTION_STAFF}</span>
      </header>

      <main className="rds-main">
        <div className="rds-photo">
          <div className="rds-photo-inner">
            {afficherPhoto ? (
              <img
                src={photoUrl}
                alt={`Photo de ${nom}`}
                className="rds-photo-img"
                onError={() => setPhotoCassee(true)}
              />
            ) : (
              <div className="rds-photo-fallback" aria-hidden="true">
                <span className="rds-photo-initiales">
                  {initiales(membre)}
                </span>
                <span className="rds-photo-label">Photo</span>
              </div>
            )}
          </div>
        </div>

        <div className="rds-info">
          <p className="rds-name" title={nom}>
            {nom}
          </p>
          <p className="rds-fonction" title={fonction}>
            {fonction}
          </p>

          <div className="rds-rule" aria-hidden="true" />

          <dl className="rds-rows">
            <div className="rds-row">
              <dt>Département</dt>
              <dd title={departement}>{departement}</dd>
            </div>
            <div className="rds-row">
              <dt>Église</dt>
              <dd title={eglises}>{eglises}</dd>
            </div>
          </dl>

          <div className="rds-matricule">
            <span className="rds-matricule-label">Matricule</span>
            <strong>{matricule}</strong>
          </div>
        </div>
      </main>

      <footer className="rds-foot">
        <span className="rds-foot-dot" aria-hidden="true" />
        <span>{BADGE_ORGANISATION}</span>
        <span className="rds-foot-sep" aria-hidden="true" />
        <span>Carte de membre</span>
      </footer>
    </article>
  );
}

function BadgeVerso({ membre, branding, qrDataUrl, qrErreur }) {
  const nom = nomComplet(membre);
  const matricule = valeurOuTiret(membre?.matricule);
  const verificationUrl = urlVerification(membre);
  const dataUrl = qrDataUrl || null;
  const erreur = qrErreur || null;

  return (
    <article
      className="rds-badge-card rds-badge-verso"
      aria-label={`Verso du badge de ${nom}`}
    >
      <div className="rds-verso-bg" aria-hidden="true" />

      <header className="rds-verso-head">
        <div className="rds-logo-box">
          <BadgeLogo logoUrl={branding?.logoUrl} />
        </div>
        <div className="rds-org">
          <p className="rds-org-name">{BADGE_ORGANISATION}</p>
          <p className="rds-org-sub">Vérification du membre</p>
        </div>
        <span className="rds-staff">{BADGE_MENTION_STAFF}</span>
      </header>

      <div className="rds-verso-body">
        <div className="rds-qr-frame">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={`QR code de ${nom} (matricule ${matricule})`}
              className="rds-qr-img"
            />
          ) : (
            <div className="rds-qr-placeholder">
              <span>{erreur ? "QR indisponible" : "QR en cours…"}</span>
              <span>{matricule && matricule !== "—" ? "" : "Matricule requis"}</span>
            </div>
          )}
        </div>

        <div className="rds-verso-text">
          <p className="rds-verso-title">{BADGE_MENTION_VERSO}</p>
          <p className="rds-verso-matricule">{matricule}</p>
          <p className="rds-verso-note">QR encodé avec le matricule du membre.</p>
          {verificationUrl && (
            <p className="rds-verso-url">{verificationUrl}</p>
          )}
        </div>
      </div>

      <footer className="rds-verso-foot">
        <span>{BADGE_ORGANISATION}</span>
        <span>Badge personnel — non transférable</span>
      </footer>
    </article>
  );
}

/**
 * Carte complète, face recto ou verso.
 *
 * @param {Object} props
 * @param {"recto"|"verso"} [props.face]
 * @param {import("../badgeTypes").BadgeMember} props.membre
 * @param {import("../badgeTypes").BadgeBranding} [props.branding]
 * @param {string|null} [props.qrDataUrl] QR déjà généré (partagé avec l'impression).
 * @param {Error|null} [props.qrErreur]
 */
export default function BadgeCard({
  face = "recto",
  membre,
  branding,
  qrDataUrl,
  qrErreur,
}) {
  return face === "verso" ? (
    <BadgeVerso
      membre={membre}
      branding={branding}
      qrDataUrl={qrDataUrl}
      qrErreur={qrErreur}
    />
  ) : (
    <BadgeRecto membre={membre} branding={branding} />
  );
}
