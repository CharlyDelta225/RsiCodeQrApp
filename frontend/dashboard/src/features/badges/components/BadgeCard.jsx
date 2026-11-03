import { useEffect, useState } from "react";
import BadgeLogo from "./BadgeLogo";
import {
  initiales,
  libelleEglises,
  nomComplet,
  urlVerification,
} from "../badgeAdapter";
import {
  BADGE_BANDEAU,
  BADGE_DECLARATION,
  BADGE_MENTION_VERSO,
  BADGE_ORGANISATION,
} from "../badgeTypes";
import "../badge.css";

function valeurOuTiret(valeur) {
  return valeur && String(valeur).trim() ? valeur : "—";
}

function BadgeRecto({ membre }) {
  const photoUrl = membre?.photoUrl || null;
  const [photoCassee, setPhotoCassee] = useState(false);

  useEffect(() => {
    setPhotoCassee(false);
  }, [photoUrl]);

  const nom = nomComplet(membre);
  const afficherPhoto = Boolean(photoUrl) && !photoCassee;
  const departement = valeurOuTiret(membre?.departement);
  const fonction = membre?.fonction ? String(membre.fonction).trim() : "";
  const eglises = libelleEglises(membre);
  const aEglise = eglises !== "—";
  const matricule = valeurOuTiret(membre?.matricule);

  return (
    <article
      className="rds-badge-card rds-badge-recto"
      aria-label={`Recto du badge de ${nom}`}
    >
      <div className="rds-recto-bg" aria-hidden="true">
        <span className="rds-recto-halo" />
      </div>

      <header className="rds-recto-head">
        <div className="rds-seal">
          <BadgeLogo />
        </div>
        <div className="rds-recto-org">
          <p className="rds-recto-org-name">
            Royaume de <strong>Stabilité</strong>
          </p>
          <p className="rds-recto-declaration">{BADGE_DECLARATION}</p>
        </div>
      </header>

      <main className="rds-recto-panel">
        {afficherPhoto && (
          <img
            src={photoUrl}
            alt=""
            aria-hidden="true"
            className="rds-recto-ghost"
          />
        )}

        <div className="rds-recto-photo">
          <div className="rds-recto-photo-inner">
            {afficherPhoto ? (
              <img
                src={photoUrl}
                alt={`Photo de ${nom}`}
                className="rds-recto-photo-img"
                onError={() => setPhotoCassee(true)}
              />
            ) : (
              <div className="rds-recto-photo-fallback" aria-hidden="true">
                <span className="rds-recto-photo-initiales">
                  {initiales(membre)}
                </span>
                <span className="rds-recto-photo-label">Photo</span>
              </div>
            )}
          </div>
        </div>

        <div className="rds-recto-info">
          <p className="rds-recto-name" title={nom}>
            {nom}
          </p>
          {fonction && (
            <p className="rds-recto-fonction" title={fonction}>
              {fonction}
            </p>
          )}

          <div className="rds-recto-sep" aria-hidden="true" />

          <dl className="rds-recto-rows">
            <div className="rds-recto-row">
              <dt>Département</dt>
              <dd title={departement}>{departement}</dd>
            </div>
            {aEglise && (
              <div className="rds-recto-row">
                <dt>Église</dt>
                <dd title={eglises}>{eglises}</dd>
              </div>
            )}
          </dl>

          <div className="rds-recto-matricule">
            <span className="rds-recto-matricule-label">
              N° Matricule :
            </span>
            <strong>{matricule}</strong>
          </div>
        </div>
      </main>

      <footer className="rds-recto-foot">
        <span className="rds-recto-foot-line" aria-hidden="true" />
        <span className="rds-recto-foot-label">{BADGE_BANDEAU}</span>
        <span className="rds-recto-foot-line" aria-hidden="true" />
      </footer>
    </article>
  );
}

function BadgeVerso({ membre, qrDataUrl, qrErreur }) {
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
          <BadgeLogo />
        </div>
        <div className="rds-org">
          <p className="rds-org-name">{BADGE_ORGANISATION}</p>
          <p className="rds-org-sub">Vérification du membre</p>
        </div>
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
 * @param {string|null} [props.qrDataUrl] QR déjà généré (partagé avec l'impression).
 * @param {Error|null} [props.qrErreur]
 */
export default function BadgeCard({
  face = "recto",
  membre,
  qrDataUrl,
  qrErreur,
}) {
  return face === "verso" ? (
    <BadgeVerso membre={membre} qrDataUrl={qrDataUrl} qrErreur={qrErreur} />
  ) : (
    <BadgeRecto membre={membre} />
  );
}
