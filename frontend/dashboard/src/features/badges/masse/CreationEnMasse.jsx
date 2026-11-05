import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Camera, Check, Download, Pencil, Printer, Upload } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import { getAdmin } from "../../../lib/auth";
import { useTemple, paramTemple } from "../../../lib/temple";
import { useToast } from "../../../components/Toast";
import { creerZip } from "../../../lib/zip";
import Card from "../../../ui/Card";
import Btn from "../../../ui/Btn";
import Pill from "../../../ui/Pill";
import { Select } from "../../../ui/inputs";
import ChoixDepartement from "../ChoixDepartement";
import { genererCarte, couleurValide } from "../carte";
import { preparerPhoto } from "../carte/photo";
import { associerPhotos } from "./associerPhotos";

// ==============================
// Création des cartes en masse : toutes les cartes d'un département, recto et
// verso, avec dépôt des photos (en lot ou une par une), export ZIP et
// impression du lot. Les cartes sont dessinées par le même gabarit que
// l'onglet « Confectionner ».
// ==============================

const GRIS = "#8F8585";
const LARGEUR_VIGNETTE = 240;

const peutEcrire = () => ["ADMIN", "SUPER_ADMIN"].includes(getAdmin()?.role);
const message = (err, defaut) => (err instanceof ApiError ? err.message : err?.message || defaut);
const dateCourte = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
const sansAccents = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const nomFichier = (o, face) => sansAccents(`${o.matricule}_${o.nom}_${face}`).replace(/[^\w-]+/g, "_") + ".png";

function versBlob(canvas, type = "image/png", qualite) {
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error("Image impossible à produire"))), type, qualite));
}

async function vignette(canvas) {
  const c = document.createElement("canvas");
  c.width = LARGEUR_VIGNETTE;
  c.height = Math.round((LARGEUR_VIGNETTE * canvas.height) / canvas.width);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return URL.createObjectURL(await versBlob(c, "image/jpeg", 0.85));
}

function telechargerBlob(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const FILTRES = [
  { id: "tous", libelle: "Tous", garde: () => true },
  { id: "sans-photo", libelle: "Sans photo", garde: (o) => !o.aPhoto },
  { id: "a-faire", libelle: "À faire", garde: (o) => !o.confectionneLe },
  { id: "faites", libelle: "Faites", garde: (o) => Boolean(o.confectionneLe) },
];

export default function CreationEnMasse({ modifier, allerAuxCouleurs }) {
  const toast = useToast();
  const { egliseId } = useTemple();
  const ecriture = peutEcrire();
  const [departements, setDepartements] = useState([]);
  const [departementId, setDepartementId] = useState("");
  const [donnees, setDonnees] = useState(null); // { departement, ouvriers }
  const [chargement, setChargement] = useState(false);
  const [filtre, setFiltre] = useState("tous");
  const [vignettes, setVignettes] = useState({}); // id -> { recto, verso }
  const [envois, setEnvois] = useState({}); // id -> true pendant l'envoi de la photo
  const [nonReconnues, setNonReconnues] = useState([]); // fichiers sans ouvrier
  const [avecSansPhoto, setAvecSansPhoto] = useState(false);
  const [avecFaites, setAvecFaites] = useState(false);
  const [travail, setTravail] = useState(null); // { libelle, fait, total }
  const [impression, setImpression] = useState(null); // URLs des faces à imprimer
  const [survol, setSurvol] = useState(false);
  const photos = useRef(new Map()); // id -> { maj, url } (photo d'origine en mémoire)
  const champLot = useRef(null);
  const champUn = useRef(null);
  const cibleUn = useRef(null);

  // Départements du temple sélectionné.
  useEffect(() => {
    let actif = true;
    setDepartementId("");
    setDonnees(null);
    api
      .getDepartements({ limit: 100, ...paramTemple(egliseId) })
      .then((d) => actif && setDepartements(d.departements || []))
      .catch(() => actif && toast.error("Création en masse", "La liste des départements n'a pas pu être chargée."));
    return () => {
      actif = false;
    };
  }, [egliseId, toast]);

  const charger = useCallback(
    async (id) => {
      setChargement(true);
      try {
        const d = await api.getBadgesDepartement(id);
        setDonnees({ departement: d.departement, ouvriers: d.ouvriers });
      } catch (err) {
        toast.error("Création en masse", message(err, "Les cartes du département n'ont pas pu être chargées."));
        setDonnees(null);
      } finally {
        setChargement(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    setVignettes((v) => {
      Object.values(v).forEach(({ recto, verso }) => {
        URL.revokeObjectURL(recto);
        URL.revokeObjectURL(verso);
      });
      return {};
    });
    setNonReconnues([]);
    if (departementId) charger(departementId);
    else setDonnees(null);
  }, [departementId, charger]);

  // Libère les photos et vignettes en quittant l'onglet.
  useEffect(
    () => () => {
      photos.current.forEach(({ url }) => URL.revokeObjectURL(url));
      photos.current.clear();
    },
    []
  );

  const dep = donnees?.departement;
  const couleur = couleurValide(dep?.couleur);

  const photoDe = useCallback(async (o) => {
    if (!o.aPhoto) return null;
    const enCache = photos.current.get(o.id);
    if (enCache && enCache.maj === o.photoMaj) return enCache.url;
    const blob = await api.getBadgePhotoBlob(o.id, o.photoMaj);
    const url = URL.createObjectURL(blob);
    if (enCache) URL.revokeObjectURL(enCache.url);
    photos.current.set(o.id, { maj: o.photoMaj, url });
    return url;
  }, []);

  const membreDe = useCallback(
    async (o) => ({
      nom: o.nom,
      prenom: o.prenom,
      matricule: o.matricule,
      fonction: o.fonction,
      district: dep.district,
      departement: dep.nomCarte || dep.nom,
      modele: dep.modeleCarte,
      couleur: couleur || GRIS,
      photo: await photoDe(o).catch(() => null),
    }),
    [dep, couleur, photoDe]
  );

  // Vignettes : une carte à la fois, dans l'ordre de la liste. Une carte déjà
  // dessinée n'est refaite que si sa photo change.
  const dessinees = useRef(new Map()); // id -> photoMaj dessinée
  useEffect(() => {
    if (!donnees) {
      dessinees.current.clear();
      return undefined;
    }
    let annule = false;
    (async () => {
      for (const o of donnees.ouvriers) {
        if (annule) return;
        const cle = `${donnees.departement.id}|${o.photoMaj || ""}|${o.fonction}`;
        if (dessinees.current.get(o.id) === cle) continue;
        try {
          const { recto, verso } = await genererCarte(await membreDe(o));
          const v = { recto: await vignette(recto), verso: await vignette(verso) };
          if (annule) {
            URL.revokeObjectURL(v.recto);
            URL.revokeObjectURL(v.verso);
            return;
          }
          dessinees.current.set(o.id, cle);
          setVignettes((prec) => {
            if (prec[o.id]) {
              URL.revokeObjectURL(prec[o.id].recto);
              URL.revokeObjectURL(prec[o.id].verso);
            }
            return { ...prec, [o.id]: v };
          });
        } catch {
          // Une carte qui échoue n'empêche pas les suivantes.
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, [donnees, membreDe]);

  // ---------- Photos ----------

  async function envoyer(o, fichier) {
    setEnvois((e) => ({ ...e, [o.id]: true }));
    try {
      const blob = await preparerPhoto(fichier);
      await api.envoyerBadgePhoto(o.id, blob);
      const maj = new Date().toISOString();
      const url = URL.createObjectURL(blob);
      const ancienne = photos.current.get(o.id);
      if (ancienne) URL.revokeObjectURL(ancienne.url);
      photos.current.set(o.id, { maj, url });
      setDonnees((d) => ({ ...d, ouvriers: d.ouvriers.map((x) => (x.id === o.id ? { ...x, aPhoto: true, photoMaj: maj } : x)) }));
      return true;
    } catch (err) {
      toast.error("Photo", `${o.nom} ${o.prenom || ""} : ${message(err, "la photo n'a pas pu être enregistrée.")}`);
      return false;
    } finally {
      setEnvois((e) => {
        const { [o.id]: _, ...reste } = e;
        return reste;
      });
    }
  }

  async function deposerLot(fichiers) {
    const images = [...fichiers].filter((f) => /^image\//.test(f.type));
    if (!images.length || !donnees) return;
    const { associees, restantes } = associerPhotos(images, donnees.ouvriers);
    setNonReconnues((r) => [...r, ...restantes]);
    setTravail({ libelle: "Envoi des photos", fait: 0, total: associees.length });
    let ok = 0;
    for (const [i, { ouvrier, fichier }] of associees.entries()) {
      if (await envoyer(ouvrier, fichier)) ok++;
      setTravail({ libelle: "Envoi des photos", fait: i + 1, total: associees.length });
    }
    setTravail(null);
    if (associees.length) toast.success("Photos", `${ok} photo${ok > 1 ? "s" : ""} enregistrée${ok > 1 ? "s" : ""}.`);
    if (restantes.length) {
      toast.error("Photos", `${restantes.length} fichier${restantes.length > 1 ? "s" : ""} sans ouvrier reconnu : attribuez-les ci-dessous.`);
    }
  }

  async function attribuer(fichier, ouvrierId) {
    const o = donnees.ouvriers.find((x) => x.id === ouvrierId);
    if (!o) return;
    if (await envoyer(o, fichier)) setNonReconnues((r) => r.filter((f) => f !== fichier));
  }

  // ---------- Sortie du lot ----------

  const selection = useMemo(
    () =>
      (donnees?.ouvriers || []).filter((o) => (avecSansPhoto || o.aPhoto) && (avecFaites || !o.confectionneLe)),
    [donnees, avecSansPhoto, avecFaites]
  );

  async function rendreLot(libelle, traiter) {
    setTravail({ libelle, fait: 0, total: selection.length });
    for (const [i, o] of selection.entries()) {
      const { recto, verso } = await genererCarte(await membreDe(o));
      await traiter(o, recto, verso);
      setTravail({ libelle, fait: i + 1, total: selection.length });
    }
  }

  async function marquerLot() {
    const r = await api.marquerBadgesLot(dep.id, selection.map((o) => o.id));
    await charger(dep.id);
    return r;
  }

  async function exporter() {
    try {
      const fichiers = [];
      const enc = async (blob) => new Uint8Array(await blob.arrayBuffer());
      await rendreLot("Préparation du ZIP", async (o, recto, verso) => {
        fichiers.push({ nom: nomFichier(o, "recto"), octets: await enc(await versBlob(recto)) });
        fichiers.push({ nom: nomFichier(o, "verso"), octets: await enc(await versBlob(verso)) });
      });
      const jour = new Date().toISOString().slice(0, 10);
      telechargerBlob(creerZip(fichiers), sansAccents(`${dep.nom}_${dep.district}_${jour}`).replace(/[^\w-]+/g, "_") + ".zip");
      const r = await marquerLot();
      toast.success("Export", `${selection.length} carte${selection.length > 1 ? "s" : ""} exportée${selection.length > 1 ? "s" : ""} · ${r.crees} marquée${r.crees > 1 ? "s" : ""} comme faite${r.crees > 1 ? "s" : ""}.`);
    } catch (err) {
      toast.error("Export", message(err, "L'export n'a pas pu être terminé."));
    } finally {
      setTravail(null);
    }
  }

  async function imprimer() {
    const urls = [];
    try {
      await rendreLot("Préparation de l'impression", async (_o, recto, verso) => {
        urls.push(URL.createObjectURL(await versBlob(recto, "image/jpeg", 0.95)));
        urls.push(URL.createObjectURL(await versBlob(verso, "image/jpeg", 0.95)));
      });
      setTravail(null);
      setImpression(urls);
      // Laisse le temps aux images du portail d'impression de se charger.
      await new Promise((ok) => setTimeout(ok, 400));
      window.print();
      const r = await marquerLot();
      toast.success("Impression", `${r.crees} carte${r.crees > 1 ? "s" : ""} marquée${r.crees > 1 ? "s" : ""} comme faite${r.crees > 1 ? "s" : ""}.`);
    } catch (err) {
      toast.error("Impression", message(err, "L'impression n'a pas pu être préparée."));
    } finally {
      setTravail(null);
      setImpression(null);
      urls.forEach((u) => URL.revokeObjectURL(u));
    }
  }

  // ---------- Affichage ----------

  const ouvriers = donnees?.ouvriers || [];
  const garde = FILTRES.find((f) => f.id === filtre)?.garde || (() => true);
  const visibles = ouvriers.filter(garde);
  const avecPhoto = ouvriers.filter((o) => o.aPhoto).length;
  const faites = ouvriers.filter((o) => o.confectionneLe).length;
  const occupe = Boolean(travail);
  const sortiePossible = ecriture && couleur && selection.length > 0 && !occupe;

  return (
    <div className="space-y-4">
      <Card
        title="Création en masse"
        description="Toutes les cartes d'un département, recto et verso. Déposez les photos, puis exportez ou imprimez le département entier."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ChoixDepartement
              departements={departements}
              valeur={departementId}
              onChange={setDepartementId}
              avecTemple={!egliseId}
              className="w-full sm:w-[360px] max-w-full"
            />
            {donnees && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer les cartes">
                {FILTRES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltre(f.id)}
                    aria-pressed={filtre === f.id}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      filtre === f.id
                        ? "border-bordeaux-300 bg-bordeaux-50 text-bordeaux-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {f.libelle} · {ouvriers.filter(f.garde).length}
                  </button>
                ))}
              </div>
            )}
          </div>

          {chargement && !donnees && <p className="text-xs text-slate-500">Chargement des cartes…</p>}

          {donnees && (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                <span>
                  <b className="text-slate-800 tabular-nums">
                    {avecPhoto} / {ouvriers.length}
                  </b>{" "}
                  photos
                </span>
                <span className="h-2 flex-1 min-w-[120px] max-w-[260px] rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                  <span
                    className="block h-full bg-emerald-500"
                    style={{ width: `${ouvriers.length ? (avecPhoto / ouvriers.length) * 100 : 0}%` }}
                  />
                </span>
                <span>
                  <b className="text-slate-800 tabular-nums">{faites}</b> carte{faites > 1 ? "s" : ""} déjà faite{faites > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full border border-black/10" style={{ background: couleur || GRIS }} />
                  {couleur || "Couleur à définir"} · {dep.district}
                </span>
              </div>

              {!couleur && (
                <p className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    La couleur de {dep.nom} n'est pas définie : les cartes sont grises et ne peuvent pas sortir.{" "}
                    <button type="button" className="underline font-semibold" onClick={allerAuxCouleurs}>
                      Définir la couleur
                    </button>
                  </span>
                </p>
              )}

              {ecriture && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setSurvol(true);
                  }}
                  onDragLeave={() => setSurvol(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setSurvol(false);
                    deposerLot(e.dataTransfer.files);
                  }}
                  className={`rounded-xl border-2 border-dashed px-4 py-4 text-center text-xs transition ${
                    survol ? "border-bordeaux-400 bg-bordeaux-50" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <p className="text-slate-600">
                    Glissez ici <b className="text-slate-800">toutes les photos du département</b> en une fois. Chaque fichier est
                    rattaché par le matricule dans son nom (<span className="font-mono">RSI-4A21.jpg</span>), sinon par le nom de
                    l'ouvrier (<span className="font-mono">KOUASSI_Aya.jpg</span>).
                  </p>
                  <Btn
                    size="xs"
                    variant="secondary"
                    className="mt-2"
                    icon={<Upload size={13} />}
                    disabled={occupe}
                    onClick={() => champLot.current?.click()}
                  >
                    Choisir des photos
                  </Btn>
                  <input
                    ref={champLot}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={(e) => {
                      deposerLot(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}

              {nonReconnues.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-2">
                  <p className="text-xs font-semibold text-amber-900">Photos à attribuer ({nonReconnues.length})</p>
                  <ul className="space-y-1.5">
                    {nonReconnues.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono text-slate-700 truncate max-w-[220px]">{f.name}</span>
                        <Select
                          value=""
                          onChange={(e) => e.target.value && attribuer(f, e.target.value)}
                          aria-label={`Ouvrier pour ${f.name}`}
                          className="text-xs py-1 max-w-[260px]"
                        >
                          <option value="">— Attribuer à —</option>
                          {ouvriers.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.nom} {o.prenom} · {o.matricule}
                              {o.aPhoto ? " (a déjà une photo)" : ""}
                            </option>
                          ))}
                        </Select>
                        <button
                          type="button"
                          className="text-slate-500 hover:text-slate-700 underline"
                          onClick={() => setNonReconnues((r) => r.filter((x) => x !== f))}
                        >
                          Ignorer
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={avecSansPhoto} onChange={(e) => setAvecSansPhoto(e.target.checked)} className="h-4 w-4 accent-bordeaux-700" />
                  Inclure les cartes sans photo
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={avecFaites} onChange={(e) => setAvecFaites(e.target.checked)} className="h-4 w-4 accent-bordeaux-700" />
                  Inclure les cartes déjà faites
                </label>
                <span className="text-xs text-slate-500 tabular-nums">
                  {selection.length} carte{selection.length > 1 ? "s" : ""} à sortir
                </span>
                <span className="flex-1" />
                <Btn size="sm" variant="secondary" icon={<Printer size={14} />} disabled={!sortiePossible} onClick={imprimer}>
                  Imprimer le lot
                </Btn>
                <Btn size="sm" icon={<Download size={14} />} disabled={!sortiePossible} onClick={exporter}>
                  Exporter {dep.nom} (ZIP)
                </Btn>
              </div>

              {travail && (
                <div className="space-y-1" role="status" aria-live="polite">
                  <p className="text-xs text-slate-600">
                    {travail.libelle} · {travail.fait} / {travail.total}
                  </p>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-bordeaux-600 transition-all" style={{ width: `${travail.total ? (travail.fait / travail.total) * 100 : 0}%` }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {donnees && (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
          {visibles.map((o) => {
            const v = vignettes[o.id];
            const envoi = envois[o.id];
            return (
              <div
                key={o.id}
                className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-2"
                onDragOver={(e) => ecriture && e.preventDefault()}
                onDrop={(e) => {
                  if (!ecriture) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const f = [...e.dataTransfer.files].find((x) => /^image\//.test(x.type));
                  if (f) envoyer(o, f);
                }}
              >
                <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1.5">
                  {["recto", "verso"].map((face) =>
                    v ? (
                      <img key={face} src={v[face]} alt={`${face} de ${o.nom}`} className="w-full aspect-[54/85.6] rounded shadow-sm" />
                    ) : (
                      <div key={face} className="w-full aspect-[54/85.6] rounded bg-slate-200 animate-pulse" />
                    )
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {o.nom} {o.prenom}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {o.matricule} · {o.fonction}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {o.aPhoto ? (
                    <Pill tonalite="vert">
                      <Camera size={12} aria-hidden="true" /> Photo
                    </Pill>
                  ) : (
                    <Pill tonalite="orange">Sans photo</Pill>
                  )}
                  {o.confectionneLe ? (
                    <Pill tonalite="or">
                      <Check size={12} aria-hidden="true" /> Faite le {dateCourte(o.confectionneLe)}
                    </Pill>
                  ) : (
                    <Pill>À faire</Pill>
                  )}
                  <button
                    type="button"
                    onClick={() => modifier(o.id, dep.id)}
                    className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-bordeaux-700 hover:underline"
                  >
                    <Pencil size={11} aria-hidden="true" /> Modifier
                  </button>
                </div>
                {ecriture && (
                  <button
                    type="button"
                    disabled={envoi || occupe}
                    onClick={() => {
                      cibleUn.current = o;
                      champUn.current?.click();
                    }}
                    className={`w-full rounded-lg border-[1.5px] border-dashed px-2 py-1.5 text-[11px] transition disabled:opacity-60 ${
                      o.aPhoto
                        ? "border-slate-200 text-slate-500 hover:bg-slate-50"
                        : "border-amber-300 text-amber-800 bg-amber-50/60 hover:bg-amber-50"
                    }`}
                  >
                    {envoi ? "Envoi…" : o.aPhoto ? "Changer la photo" : "Déposez sa photo ici ou cliquez"}
                  </button>
                )}
              </div>
            );
          })}
          {visibles.length === 0 && <p className="text-sm text-slate-500 py-6">Aucune carte dans ce filtre.</p>}
        </div>
      )}

      <input
        ref={champUn}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && cibleUn.current) envoyer(cibleUn.current, f);
          e.target.value = "";
        }}
      />

      {impression &&
        createPortal(
          <div id="carte-impression" aria-hidden="true">
            {impression.map((u) => (
              <img key={u} src={u} alt="" />
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
