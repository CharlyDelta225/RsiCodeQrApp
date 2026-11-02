import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Pencil, Printer } from "lucide-react";
import Card from "../ui/Card";
import Btn from "../ui/Btn";
import Pill from "../ui/Pill";
import { Field, Input, Select } from "../ui/inputs";
import BadgePreview from "../features/badges/components/BadgePreview";
import BadgeCapture from "../features/badges/components/BadgeCapture";
import BadgePrintSheet, {
  BADGE_PRINT_MODES,
} from "../features/badges/components/BadgePrintSheet";
import { useBadgeQr } from "../features/badges/useBadgeQr";
import { chargerMembres } from "../features/badges/badgeService";
import {
  initiales,
  nomComplet,
  valeurQr,
} from "../features/badges/badgeAdapter";
import { telechargerBadgePng } from "../features/badges/downloadUtils";

async function attendreImages() {
  const images = Array.from(
    document.querySelectorAll("#badge-print-root img")
  );

  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      });
    })
  );

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
}

/** Ligne de la fiche en lecture seule (aucune donnée inventée). */
function LigneInfo({ label, valeur }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-slate-800" title={valeur || undefined}>
        {valeur || "—"}
      </dd>
    </div>
  );
}

export default function BadgeStudioPage() {
  const navigate = useNavigate();

  const [membres, setMembres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [rechargement, setRechargement] = useState(0);
  const [recherche, setRecherche] = useState("");
  const [selectionId, setSelectionId] = useState(null);
  const [face, setFace] = useState("recto");
  const [modeImpression, setModeImpression] = useState(
    BADGE_PRINT_MODES.PLANCHE
  );
  const [impression, setImpression] = useState(false);
  const [telechargement, setTelechargement] = useState({ recto: false, verso: false });
  const [message, setMessage] = useState(null);
  const refCaptureRecto = useRef(null);
  const refCaptureVerso = useRef(null);

  // L'atelier travaille uniquement sur les ouvriers réels de l'API.
  useEffect(() => {
    let actif = true;

    setChargement(true);
    setErreur(null);
    setMembres([]);
    setSelectionId(null);

    chargerMembres()
      .then((liste) => {
        if (!actif) return;
        setMembres(liste);
        setSelectionId((precedent) => {
          if (precedent && liste.some((m) => m.id === precedent)) {
            return precedent;
          }
          return liste[0]?.id ?? null;
        });
      })
      .catch((err) => {
        if (!actif) return;
        setErreur(
          err?.message || "Impossible de charger la liste des ouvriers."
        );
      })
      .finally(() => {
        if (actif) setChargement(false);
      });

    return () => {
      actif = false;
    };
  }, [rechargement]);

  useEffect(() => {
    if (!message) return undefined;
    const minuteur = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(minuteur);
  }, [message]);

  const membre = useMemo(
    () => membres.find((m) => m.id === selectionId) ?? null,
    [membres, selectionId]
  );

  const { dataUrl: qrDataUrl, erreur: qrErreur } = useBadgeQr(
    membre ? valeurQr(membre) : ""
  );

  const membresFiltres = useMemo(() => {
    const requete = recherche.trim().toLowerCase();
    if (!requete) return membres;

    return membres.filter((m) =>
      [m.nom, m.prenom, m.matricule, m.departement, m.fonction]
        .filter(Boolean)
        .some((valeur) => String(valeur).toLowerCase().includes(requete))
    );
  }, [membres, recherche]);

  function choisirMembre(id) {
    if (!id || id === selectionId) return;
    setSelectionId(id);
    setFace("recto");
  }

  async function handleImprimer() {
    setMessage(null);

    if (!membre) return;

    if (!valeurQr(membre)) {
      setMessage({
        type: "erreur",
        texte:
          "Cet ouvrier n'a pas de matricule : le QR code ne peut pas être généré.",
      });
      return;
    }

    if (!qrDataUrl) {
      setMessage({
        type: "erreur",
        texte:
          "Le QR code est encore en préparation. Réessayez dans un instant.",
      });
      return;
    }

    setImpression(true);
    try {
      await attendreImages();
      window.print();
    } finally {
      setImpression(false);
    }
  }

  async function handleTelechargerFace(cible) {
    setMessage(null);

    if (!membre) return;

    if (!valeurQr(membre)) {
      setMessage({
        type: "erreur",
        texte:
          "Cet ouvrier n'a pas de matricule : le QR code ne peut pas être généré.",
      });
      return;
    }

    if (!qrDataUrl) {
      setMessage({
        type: "erreur",
        texte:
          "Le QR code est encore en préparation. Réessayez dans un instant.",
      });
      return;
    }

    const ref =
      cible === "verso" ? refCaptureVerso.current : refCaptureRecto.current;

    if (!ref) {
      setMessage({
        type: "erreur",
        texte: "Élément à capturer introuvable.",
      });
      return;
    }

    setTelechargement((precedent) => ({ ...precedent, [cible]: true }));
    try {
      await telechargerBadgePng(ref, membre, cible);
      setMessage({
        type: "succes",
        texte: `Badge ${cible} téléchargé en PNG.`,
      });
    } catch {
      setMessage({
        type: "erreur",
        texte: "Échec du téléchargement. Réessayez.",
      });
    } finally {
      setTelechargement((precedent) => ({ ...precedent, [cible]: false }));
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-bordeaux-900" style={{ fontFamily: "Poppins,sans-serif" }}>
              Atelier badges
            </h1>
            <Pill tonalite="or">Recto / verso</Pill>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Sélectionnez un ouvrier puis imprimez les deux faces au format carte
            ID-1. Les informations affichées proviennent directement de sa fiche.
          </p>
        </div>
        <Btn
          variant="secondary"
          size="sm"
          icon={<ArrowLeft size={14} />}
          onClick={() => navigate("/badges")}
        >
          Retour aux badges
        </Btn>
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-lg border px-3 py-2 text-xs ${
            message.type === "succes"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-bordeaux-200 bg-bordeaux-50 text-bordeaux-800"
          }`}
        >
          {message.texte}
        </p>
      )}

      {erreur && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bordeaux-200 bg-bordeaux-50 px-3 py-2">
          <p className="text-xs text-bordeaux-800" title={erreur}>
            Impossible de charger les ouvriers. Vérifiez la connexion puis
            réessayez.
          </p>
          <Btn
            variant="secondary"
            size="xs"
            onClick={() => setRechargement((n) => n + 1)}
          >
            Réessayer
          </Btn>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card
            title="1. Ouvrier"
            description="Choisissez le titulaire du badge."
          >
            <div className="space-y-3">
              <Input
                placeholder="Rechercher un nom, un matricule, un département…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                autoComplete="off"
              />

              {chargement ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  Chargement des ouvriers…
                </p>
              ) : membresFiltres.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
                  {membres.length === 0
                    ? "Aucun ouvrier disponible."
                    : "Aucun ouvrier ne correspond à la recherche."}
                </p>
              ) : (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {membresFiltres.map((m) => {
                    const actif = m.id === selectionId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => choisirMembre(m.id)}
                        aria-pressed={actif}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                          actif
                            ? "border-bordeaux-300 bg-bordeaux-50 ring-1 ring-bordeaux-200"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-bordeaux-700 to-gold-600 text-xs font-bold text-white">
                            {initiales(m)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-800">
                              {nomComplet(m)}
                            </span>
                            <span className="block truncate text-[11px] text-slate-500">
                              {m.matricule || "Sans matricule"}
                              {m.departement ? ` · ${m.departement}` : ""}
                            </span>
                          </span>
                          {m.actif === false && (
                            <Pill tonalite="neutre">Inactif</Pill>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                {membresFiltres.length} ouvrier(s) affiché(s) sur{" "}
                {membres.length}.
              </p>
            </div>
          </Card>

          <Card
            title="2. Fiche de l'ouvrier"
            description="Données réelles enregistrées dans l'application."
            actions={
              <Btn
                variant="ghost"
                size="xs"
                icon={<Pencil size={13} />}
                onClick={() => navigate("/ouvriers")}
              >
                Modifier la fiche
              </Btn>
            }
          >
            {membre ? (
              <div className="space-y-3">
                <dl className="grid gap-2 sm:grid-cols-2">
                  <LigneInfo label="Prénom" valeur={membre.prenom} />
                  <LigneInfo label="Nom" valeur={membre.nom} />
                  <LigneInfo label="Matricule" valeur={membre.matricule} />
                  <LigneInfo label="Département" valeur={membre.departement} />
                  <LigneInfo
                    label="Photo"
                    valeur={
                      membre.photoUrl
                        ? "Photo enregistrée"
                        : "Aucune photo — initiales affichées"
                    }
                  />
                  <LigneInfo
                    label="Statut"
                    valeur={membre.actif === false ? "Inactif" : "Actif"}
                  />
                </dl>

                <p className="text-[11px] leading-relaxed text-slate-500">
                  Le badge reprend uniquement ces données : nom, prénom,
                  matricule, département et photo. Le téléphone n'est jamais
                  affiché ni encodé dans le QR code.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Sélectionnez un ouvrier pour afficher sa fiche.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card
            title="Aperçu"
            description="Recto et verso, au format carte ID-1."
          >
            {membre ? (
              <BadgePreview
                membre={membre}
                face={face}
                onFaceChange={setFace}
                qrDataUrl={qrDataUrl}
                qrErreur={qrErreur}
              />
            ) : (
              <div className="rds-flip-stage">
                <div className="flex aspect-[856/540] items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs text-slate-500">
                  Sélectionnez un ouvrier pour afficher l'aperçu.
                </div>
              </div>
            )}
          </Card>

          <Card
            title="Télécharger / Imprimer"
            description="Télécharge recto ou verso en PNG, ou imprime les deux faces."
          >
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Btn
                  variant="secondary"
                  size="sm"
                  icon={<Download size={14} />}
                  onClick={() => handleTelechargerFace("recto")}
                  loading={telechargement.recto}
                  disabled={!membre || !valeurQr(membre) || !qrDataUrl}
                >
                  Télécharger recto (PNG)
                </Btn>
                <Btn
                  variant="secondary"
                  size="sm"
                  icon={<Download size={14} />}
                  onClick={() => handleTelechargerFace("verso")}
                  loading={telechargement.verso}
                  disabled={!membre || !valeurQr(membre) || !qrDataUrl}
                >
                  Télécharger verso (PNG)
                </Btn>
              </div>

              <Field
                label="Disposition d'impression"
                hint="Planche : les deux faces côte à côte sur une page A4. Deux pages : chaque face à l'échelle réelle."
              >
                <Select
                  value={modeImpression}
                  onChange={(e) => setModeImpression(e.target.value)}
                >
                  <option value={BADGE_PRINT_MODES.PLANCHE}>
                    Planche A4 — recto + verso
                  </option>
                  <option value={BADGE_PRINT_MODES.CARTE}>
                    Deux pages — échelle réelle
                  </option>
                </Select>
              </Field>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                <strong className="font-semibold">Réglage important :</strong>{" "}
                dans la boîte d'impression, choisissez{" "}
                <strong>100 %</strong> (ou « Taille réelle »), désactivez
                « Ajuster à la page » et les en-têtes/pieds de page. Le format
                ID-1 (85,6 × 54 mm) est respecté.
              </div>

              <Btn
                variant="gold"
                size="md"
                icon={<Printer size={16} />}
                onClick={handleImprimer}
                loading={impression}
                disabled={!membre || !valeurQr(membre)}
              >
                Imprimer recto + verso
              </Btn>

              {membre && !valeurQr(membre) && (
                <p className="text-[11px] text-bordeaux-700">
                  Cet ouvrier n'a pas de matricule : le QR code ne peut pas être
                  généré.
                </p>
              )}
              {membre && valeurQr(membre) && !qrDataUrl && !qrErreur && (
                <p className="text-[11px] text-slate-500">
                  Préparation du QR code…
                </p>
              )}
              {qrErreur && (
                <p className="text-[11px] text-bordeaux-700">
                  Erreur lors de la génération du QR code.
                </p>
              )}

              <p className="text-[11px] leading-relaxed text-slate-500">
                Le QR est généré dans le navigateur. Il encode toujours le
                matricule (format lu par le terminal de badgeage), jamais le
                téléphone.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {membre && (
        <BadgePrintSheet
          membre={membre}
          mode={modeImpression}
          qrDataUrl={qrDataUrl}
          qrErreur={qrErreur}
        />
      )}

      {membre && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-20000px",
            top: 0,
            pointerEvents: "none",
            opacity: 0,
          }}
        >
          <BadgeCapture
            ref={refCaptureRecto}
            membre={membre}
            face="recto"
            qrDataUrl={qrDataUrl}
            qrErreur={qrErreur}
          />
          <BadgeCapture
            ref={refCaptureVerso}
            membre={membre}
            face="verso"
            qrDataUrl={qrDataUrl}
            qrErreur={qrErreur}
          />
        </div>
      )}
    </div>
  );
}
