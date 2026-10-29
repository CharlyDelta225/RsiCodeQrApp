import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Download, Printer, RotateCcw } from "lucide-react";
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
  applyOverrides,
  initiales,
  nomComplet,
  valeurQr,
} from "../features/badges/badgeAdapter";
import {
  chargerBranding,
  chargerOverridesMembre,
  enregistrerBranding,
  enregistrerOverridesMembre,
  reinitialiserOverridesMembre,
} from "../features/badges/badgeLocalStore";
import { BADGE_SOURCES } from "../features/badges/badgeTypes";
import { compresserImage } from "../features/badges/imageUtils";
import { telechargerBadgePng } from "../features/badges/downloadUtils";

const CHAMPS_OVERRIDES = [
  "photoUrl",
  "fonction",
  "departement",
  "egliseOrigine",
  "egliseActuelle",
  "verificationUrl",
];

const SOURCES = [
  { value: BADGE_SOURCES.DEMO, label: "Démo" },
  { value: BADGE_SOURCES.API, label: "Données réelles" },
];

function differences(membreBase, brouillon) {
  const resultat = {};

  for (const champ of CHAMPS_OVERRIDES) {
    const valeur = brouillon[champ] ?? "";
    const origine = membreBase?.[champ] ?? "";

    if (String(valeur).trim() !== String(origine).trim()) {
      resultat[champ] =
        typeof valeur === "string" ? valeur.trim() : valeur;
    }
  }

  return resultat;
}

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

export default function BadgeStudioPage() {
  const navigate = useNavigate();

  // En production, l'atelier s'ouvre sur les vrais membres ; la démo reste
  // le défaut en développement (prévisualisation sans backend).
  const [source, setSource] = useState(
    import.meta.env.PROD ? BADGE_SOURCES.API : BADGE_SOURCES.DEMO
  );
  const [membres, setMembres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [selectionId, setSelectionId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [modifie, setModifie] = useState(false);
  const [branding, setBranding] = useState({ logoUrl: null });
  const [face, setFace] = useState("recto");
  const [modeImpression, setModeImpression] = useState(
    BADGE_PRINT_MODES.PLANCHE
  );
  const [impression, setImpression] = useState(false);
  const [telechargement, setTelechargement] = useState({ recto: false, verso: false });
  const [message, setMessage] = useState(null);
  const refCaptureRecto = useRef(null);
  const refCaptureVerso = useRef(null);

  useEffect(() => {
    setBranding(chargerBranding());
  }, []);

  useEffect(() => {
    let actif = true;

    setChargement(true);
    setErreur(null);
    setMembres([]);
    setSelectionId(null);

    chargerMembres(source)
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
          err?.message || "Impossible de charger la liste des membres."
        );
      })
      .finally(() => {
        if (actif) setChargement(false);
      });

    return () => {
      actif = false;
    };
  }, [source]);

  useEffect(() => {
    setOverrides(
      selectionId ? chargerOverridesMembre(selectionId) : {}
    );
    setModifie(false);
  }, [selectionId]);

  useEffect(() => {
    if (!message) return undefined;
    const minuteur = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(minuteur);
  }, [message]);

  const membreBase = useMemo(
    () => membres.find((m) => m.id === selectionId) ?? null,
    [membres, selectionId]
  );

  const membre = useMemo(
    () => (membreBase ? applyOverrides(membreBase, overrides) : null),
    [membreBase, overrides]
  );

  const { dataUrl: qrDataUrl, erreur: qrErreur } = useBadgeQr(
    membre ? valeurQr(membre) : ""
  );

  const membresFiltres = useMemo(() => {
    const requete = recherche.trim().toLowerCase();
    if (!requete) return membres;

    return membres.filter((m) =>
      [
        m.nom,
        m.prenom,
        m.matricule,
        m.departement,
        m.fonction,
        m.egliseOrigine,
        m.egliseActuelle,
      ]
        .filter(Boolean)
        .some((valeur) => String(valeur).toLowerCase().includes(requete))
    );
  }, [membres, recherche]);

  function valeurChamp(champ) {
    if (Object.prototype.hasOwnProperty.call(overrides, champ)) {
      return overrides[champ] ?? "";
    }
    return membreBase?.[champ] ?? "";
  }

  function majChamp(champ, valeur) {
    setOverrides((precedent) => ({ ...precedent, [champ]: valeur }));
    setModifie(true);
  }

  function sauvegarderSilencieusement() {
    if (!modifie || !membreBase) return true;

    const ok = enregistrerOverridesMembre(
      membreBase.id,
      differences(membreBase, overrides)
    );

    if (!ok) {
      setMessage({
        type: "erreur",
        texte:
          "Stockage local saturé : les modifications en cours n'ont pas pu être enregistrées.",
      });
    }

    return ok;
  }

  function choisirMembre(id) {
    if (!id || id === selectionId) return;

    sauvegarderSilencieusement();

    setOverrides(chargerOverridesMembre(id));
    setSelectionId(id);
    setModifie(false);
    setFace("recto");
  }

  function changerSource(nouvelleSource) {
    if (nouvelleSource === source) return;

    sauvegarderSilencieusement();

    setSource(nouvelleSource);
    setRecherche("");
    setMessage(null);
  }

  function handleEnregistrer() {
    if (!membreBase) return;

    const diff = differences(membreBase, overrides);
    const ok = enregistrerOverridesMembre(membreBase.id, diff);

    if (!ok) {
      setMessage({
        type: "erreur",
        texte:
          "Le stockage local est saturé. Retirez la photo ou le logo, puis réessayez.",
      });
      return;
    }

    setOverrides(diff);
    setModifie(false);
    setMessage({
      type: "succes",
      texte: "Compléments enregistrés dans ce navigateur.",
    });
  }

  function handleReinitialiser() {
    if (!membreBase) return;

    reinitialiserOverridesMembre(membreBase.id);
    setOverrides({});
    setModifie(false);
    setMessage({
      type: "succes",
      texte: "Compléments du membre réinitialisés.",
    });
  }

  async function handlePhoto(evenement) {
    const fichier = evenement.target.files?.[0];
    evenement.target.value = "";
    if (!fichier) return;

    if (!fichier.type.startsWith("image/")) {
      setMessage({
        type: "erreur",
        texte: "Choisissez un fichier image (JPEG, PNG…).",
      });
      return;
    }

    if (fichier.size > 5 * 1024 * 1024) {
      setMessage({
        type: "erreur",
        texte: "Image trop lourde : 5 Mo maximum.",
      });
      return;
    }

    try {
      const dataUrl = await compresserImage(fichier, {
        maxSize: 640,
        mimeType: "image/jpeg",
        quality: 0.82,
      });

      majChamp("photoUrl", dataUrl);
      setMessage({
        type: "succes",
        texte:
          "Photo ajoutée à l'aperçu. Enregistrez pour la conserver dans ce navigateur.",
      });
    } catch {
      setMessage({
        type: "erreur",
        texte: "Impossible de lire cette image.",
      });
    }
  }

  async function handleLogo(evenement) {
    const fichier = evenement.target.files?.[0];
    evenement.target.value = "";
    if (!fichier) return;

    if (!fichier.type.startsWith("image/")) {
      setMessage({
        type: "erreur",
        texte: "Choisissez un fichier image pour le logo.",
      });
      return;
    }

    if (fichier.size > 3 * 1024 * 1024) {
      setMessage({
        type: "erreur",
        texte: "Logo trop lourd : 3 Mo maximum.",
      });
      return;
    }

    try {
      const dataUrl = await compresserImage(fichier, {
        maxSize: 256,
        mimeType: "image/png",
        quality: 0.92,
      });

      const nouveau = { logoUrl: dataUrl };
      if (!enregistrerBranding(nouveau)) {
        setMessage({
          type: "erreur",
          texte:
            "Le stockage local est saturé : le logo n'a pas pu être enregistré.",
        });
        return;
      }

      setBranding(nouveau);
      setMessage({
        type: "succes",
        texte: "Logo enregistré dans ce navigateur.",
      });
    } catch {
      setMessage({
        type: "erreur",
        texte: "Impossible de lire ce logo.",
      });
    }
  }

  function retirerLogo() {
    const nouveau = { logoUrl: null };
    if (!enregistrerBranding(nouveau)) {
      setMessage({
        type: "erreur",
        texte: "Le stockage local est saturé.",
      });
      return;
    }

    setBranding(nouveau);
    setMessage({
      type: "succes",
      texte: "Logo RSI par défaut rétabli.",
    });
  }

  async function handleImprimer() {
    setMessage(null);

    if (!membre) return;

    if (!valeurQr(membre)) {
      setMessage({
        type: "erreur",
        texte:
          "Ce membre n'a pas de matricule : le QR code ne peut pas être généré.",
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
          "Ce membre n'a pas de matricule : le QR code ne peut pas être généré.",
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

  const sourceActive = SOURCES.find((s) => s.value === source);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-bordeaux-900" style={{ fontFamily: "Poppins,sans-serif" }}>
              Atelier badges
            </h1>
            <Pill tonalite="or">Recto / verso</Pill>
            <Pill tonalite="bleu">STAFF</Pill>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Sélectionnez un membre, complétez les informations manquantes et
            imprimez les deux faces au format carte ID-1. Aucun appel d'écriture
            n'est effectué.
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

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-bordeaux-800">
            Sans modification de l'API
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            Réutilise la route existante <span className="font-mono">GET /api/ouvriers</span>.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-bordeaux-800">
            QR = matricule
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            Le téléphone n'est jamais affiché ni encodé.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-bordeaux-800">
            Format ID-1
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            85,6 × 54 mm · impression recto et verso.
          </p>
        </div>
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
            {source === BADGE_SOURCES.API
              ? "Impossible de charger les données réelles. Vérifiez que l'API est démarrée, ou revenez à la démo."
              : erreur}
          </p>
          {source === BADGE_SOURCES.API && (
            <Btn
              variant="secondary"
              size="xs"
              onClick={() => changerSource(BADGE_SOURCES.DEMO)}
            >
              Revenir à la démo
            </Btn>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card
            title="1. Membre"
            description="Choisissez le titulaire du badge."
            actions={
              <Pill tonalite={source === BADGE_SOURCES.DEMO ? "or" : "bleu"}>
                {sourceActive?.label}
              </Pill>
            }
          >
            <div className="space-y-3">
              <div
                className="inline-flex w-full rounded-lg border border-slate-300 bg-slate-50 p-1 sm:w-auto"
                role="group"
                aria-label="Source des données"
              >
                {SOURCES.map((option) => {
                  const actif = source === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={actif}
                      onClick={() => changerSource(option.value)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition sm:flex-none ${
                        actif
                          ? "bg-white text-bordeaux-800 shadow-sm"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <Input
                placeholder="Rechercher un nom, un matricule, un département…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                autoComplete="off"
              />

              {chargement ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  Chargement des membres…
                </p>
              ) : membresFiltres.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
                  {membres.length === 0
                    ? "Aucun membre disponible."
                    : "Aucun membre ne correspond à la recherche."}
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
                          {m.source === BADGE_SOURCES.DEMO && (
                            <Pill tonalite="or">Démo</Pill>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                {membresFiltres.length} membre(s) affiché(s) sur{" "}
                {membres.length}.
              </p>
            </div>
          </Card>

          <Card
            title="2. Informations"
            description="Les champs absents de l'API restent complétables localement."
            actions={
              modifie ? <Pill tonalite="orange">Non enregistré</Pill> : null
            }
          >
            {membreBase ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Fonction / poste"
                    hint="Non fournie par l'API actuelle."
                  >
                    <Input
                      value={valeurChamp("fonction")}
                      onChange={(e) => majChamp("fonction", e.target.value)}
                      placeholder="Ex. Pasteur, Responsable accueil"
                      maxLength={60}
                      autoComplete="off"
                    />
                  </Field>
                  <Field
                    label="Département"
                    hint="Prérempli depuis l'API si disponible."
                  >
                    <Input
                      value={valeurChamp("departement")}
                      onChange={(e) => majChamp("departement", e.target.value)}
                      placeholder="Ex. Louange"
                      maxLength={80}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Église d'origine" hint="Optionnel.">
                    <Input
                      value={valeurChamp("egliseOrigine")}
                      onChange={(e) =>
                        majChamp("egliseOrigine", e.target.value)
                      }
                      placeholder="Ex. Assemblée Bethel"
                      maxLength={80}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Église actuelle" hint="Optionnel.">
                    <Input
                      value={valeurChamp("egliseActuelle")}
                      onChange={(e) =>
                        majChamp("egliseActuelle", e.target.value)
                      }
                      placeholder="Ex. Assemblée Eben-Ezer"
                      maxLength={80}
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Photo"
                    hint="JPEG/PNG, compressée et conservée uniquement dans ce navigateur."
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhoto}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-bordeaux-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-bordeaux-700 hover:file:bg-bordeaux-100"
                    />
                  </Field>
                  <Field
                    label="Lien imprimé au verso (facultatif)"
                    hint="http(s) uniquement, imprimé en texte. Le QR encode toujours le matricule : c'est le seul format accepté par le terminal de badgeage."
                  >
                    <Input
                      type="url"
                      value={valeurChamp("verificationUrl")}
                      onChange={(e) =>
                        majChamp("verificationUrl", e.target.value)
                      }
                      placeholder="https://…"
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Btn
                    variant="primary"
                    size="sm"
                    icon={<Check size={14} />}
                    onClick={handleEnregistrer}
                  >
                    Enregistrer
                  </Btn>
                  <Btn
                    variant="secondary"
                    size="sm"
                    icon={<RotateCcw size={14} />}
                    onClick={handleReinitialiser}
                  >
                    Réinitialiser ce membre
                  </Btn>
                  {membre?.photoUrl && (
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => majChamp("photoUrl", null)}
                    >
                      Retirer la photo
                    </Btn>
                  )}
                </div>

                <p className="text-[11px] leading-relaxed text-slate-500">
                  Les compléments sont stockés dans le navigateur
                  (<span className="font-mono">localStorage</span>). Aucune
                  donnée n'est envoyée au serveur et l'API n'est pas modifiée.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Sélectionnez un membre pour compléter son badge.
              </p>
            )}
          </Card>

          <Card
            title="3. Logo"
            description="Le logo RSI est utilisé par défaut."
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                {branding.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt="Logo personnalisé"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400">
                    RSI
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogo}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-bordeaux-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-bordeaux-700 hover:file:bg-bordeaux-100"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {branding.logoUrl && (
                    <Btn
                      variant="ghost"
                      size="xs"
                      onClick={retirerLogo}
                    >
                      Retirer le logo
                    </Btn>
                  )}
                  <span className="text-[11px] text-slate-500">
                    PNG/JPEG · conservé dans ce navigateur
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card
            title="Aperçu"
            description="Recto et verso, au format carte ID-1."
            actions={<Pill tonalite="or">STAFF</Pill>}
          >
            {membre ? (
              <BadgePreview
                membre={membre}
                branding={branding}
                face={face}
                onFaceChange={setFace}
                qrDataUrl={qrDataUrl}
                qrErreur={qrErreur}
              />
            ) : (
              <div className="rds-flip-stage">
                <div className="flex aspect-[856/540] items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs text-slate-500">
                  Sélectionnez un membre pour afficher l'aperçu.
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
                  Ce membre n'a pas de matricule : le QR code ne peut pas être
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
          branding={branding}
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
            branding={branding}
            face="recto"
            qrDataUrl={qrDataUrl}
            qrErreur={qrErreur}
          />
          <BadgeCapture
            ref={refCaptureVerso}
            membre={membre}
            branding={branding}
            face="verso"
            qrDataUrl={qrDataUrl}
            qrErreur={qrErreur}
          />
        </div>
      )}
    </div>
  );
}
