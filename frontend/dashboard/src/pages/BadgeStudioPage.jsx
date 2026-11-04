import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowRight, Camera, Check, Download, Palette, Printer, Search, Trash2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { getAdmin } from "../lib/auth";
import { useTemple, paramTemple, TemplePill } from "../lib/temple";
import { useToast } from "../components/Toast";
import Card from "../ui/Card";
import Btn from "../ui/Btn";
import Pill from "../ui/Pill";
import { Field, Input, Select } from "../ui/inputs";
import { genererCarte, couleurValide, nomCarte, COULEUR_MODELE } from "../features/badges/carte";
import { preparerPhoto } from "../features/badges/carte/photo";
import "../features/badges/carte/carte.css";

// ==============================
// Atelier des cartes de badge
//
// On tape le nom de l'ouvrier : sa carte s'affiche remplie (nom, fonction,
// matricule, district, département et sa couleur). On ajoute la photo, puis
// on imprime ou on télécharge. Les couleurs des départements se fixent dans
// l'onglet « Couleurs ».
// ==============================

const peutEcrire = () => ["ADMIN", "SUPER_ADMIN"].includes(getAdmin()?.role);
const message = (err, defaut) => (err instanceof ApiError ? err.message : err?.message || defaut);

function telecharger(canvas, nom) {
  return new Promise((ok) =>
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nom;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      ok();
    }, "image/png")
  );
}

const nomFichier = (o, dep, face) =>
  `${o.matricule}_${o.nom}_${dep}_${face}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_") + ".png";

function dateCourte(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ---------- Recherche ----------

function Recherche({ onChoisir, egliseId }) {
  const [texte, setTexte] = useState("");
  const [resultats, setResultats] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);

  useEffect(() => {
    const t = texte.trim();
    if (t.length < 2) {
      setResultats([]);
      return undefined;
    }
    setChargement(true);
    const minuterie = setTimeout(() => {
      api
        .getOuvriers({ recherche: t, limit: 12, ...paramTemple(egliseId) })
        .then((d) => {
          setResultats(d.ouvriers || []);
          setActif(0);
        })
        .catch(() => setResultats([]))
        .finally(() => setChargement(false));
    }, 220);
    return () => clearTimeout(minuterie);
  }, [texte, egliseId]);

  function choisir(o) {
    onChoisir(o.id);
    setTexte("");
    setOuvert(false);
  }

  return (
    <div className="relative">
      <label htmlFor="recherche-ouvrier" className="sr-only">Rechercher un ouvrier</label>
      <div className="flex items-center gap-2 rounded-xl border-2 border-bordeaux-600 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-bordeaux-200">
        <Search size={18} className="text-bordeaux-700 shrink-0" aria-hidden="true" />
        <input
          id="recherche-ouvrier"
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value);
            setOuvert(true);
          }}
          onFocus={() => setOuvert(true)}
          onBlur={() => setTimeout(() => setOuvert(false), 150)}
          onKeyDown={(e) => {
            if (!resultats.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActif((i) => Math.min(i + 1, resultats.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActif((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); choisir(resultats[actif]); }
          }}
          placeholder="Tapez le nom, le prénom ou le matricule de l'ouvrier…"
          autoComplete="off"
          className="w-full bg-transparent text-[15px] text-slate-800 placeholder:text-slate-500 focus:outline-none"
          role="combobox"
          aria-expanded={ouvert && resultats.length > 0}
          aria-controls="suggestions-ouvriers"
        />
      </div>
      {ouvert && texte.trim().length >= 2 && (
        <ul
          id="suggestions-ouvriers"
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {chargement && resultats.length === 0 && <li className="px-3 py-3 text-xs text-slate-500">Recherche…</li>}
          {!chargement && resultats.length === 0 && (
            <li className="px-3 py-3 text-xs text-slate-500">Aucun ouvrier ne correspond à « {texte.trim()} ».</li>
          )}
          {resultats.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === actif}
              onMouseDown={(e) => {
                e.preventDefault();
                choisir(o);
              }}
              onMouseEnter={() => setActif(i)}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-t border-slate-100 first:border-t-0 ${i === actif ? "bg-bordeaux-50" : ""}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-bordeaux-700 to-gold-600 text-[11px] font-bold text-white">
                {`${(o.prenom || "")[0] || ""}${(o.nom || "")[0] || ""}`.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">{o.nom} {o.prenom}</span>
                <span className="block truncate text-[11px] text-slate-500">
                  {o.matricule} · {(o.departements || []).map((d) => d.departement?.nom || d.nom).filter(Boolean).join(", ") || "sans département"}
                </span>
              </span>
              <TemplePill eglise={o.eglise} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Liste des ouvriers d'un département ----------

function ListeDepartement({ egliseId, ouvrierId, onChoisir, onListe, version }) {
  const toast = useToast();
  const [departements, setDepartements] = useState([]);
  const [departementId, setDepartementId] = useState("");
  const [liste, setListe] = useState(null); // { departement, ouvriers }
  const [chargement, setChargement] = useState(false);

  // Départements du temple sélectionné ; on repart de zéro si le temple change.
  useEffect(() => {
    let actif = true;
    setDepartementId("");
    setListe(null);
    api
      .getDepartements({ limit: 100, ...paramTemple(egliseId) })
      .then((d) => actif && setDepartements(d.departements || []))
      .catch(() => actif && toast.error("Atelier badges", "La liste des départements n'a pas pu être chargée."));
    return () => {
      actif = false;
    };
  }, [egliseId, toast]);

  useEffect(() => {
    if (!departementId) {
      setListe(null);
      return undefined;
    }
    let actif = true;
    setChargement(true);
    api
      .getBadgesDepartement(departementId)
      .then((d) => actif && setListe({ departement: d.departement, ouvriers: d.ouvriers }))
      .catch((err) => actif && toast.error("Atelier badges", message(err, "Les ouvriers du département n'ont pas pu être chargés.")))
      .finally(() => actif && setChargement(false));
    return () => {
      actif = false;
    };
  }, [departementId, version, toast]);

  useEffect(() => {
    onListe(liste);
  }, [liste, onListe]);

  const faites = liste ? liste.ouvriers.filter((o) => o.confectionneLe).length : 0;

  return (
    <Card title="Ouvriers par département" description="Choisissez un département du temple sélectionné, puis un ouvrier.">
      <div className="space-y-3">
        <Select value={departementId} onChange={(e) => setDepartementId(e.target.value)} aria-label="Département">
          <option value="">— Choisir un département —</option>
          {departements.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nom}
              {!egliseId && d.eglise ? ` · ${d.eglise.nom}` : ""}
              {d._count ? ` (${d._count.membres})` : ""}
              {d.couleur ? "" : " · couleur à définir"}
            </option>
          ))}
        </Select>

        {chargement && !liste && <p className="text-xs text-slate-500">Chargement…</p>}
        {liste && (
          <>
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-black/10"
                  style={{ background: liste.departement.couleur || "#8F8585" }}
                  aria-hidden="true"
                />
                {liste.departement.couleur || "Couleur à définir"}
              </span>
              <span className="tabular-nums">
                {faites} / {liste.ouvriers.length} cartes faites
              </span>
            </div>
            {liste.ouvriers.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Aucun ouvrier actif dans ce département.</p>
            ) : (
              <ul className="max-h-[420px] overflow-y-auto -mx-1 divide-y divide-slate-100">
                {liste.ouvriers.map((o) => {
                  const choisi = o.id === ouvrierId;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => onChoisir(o.id, liste.departement.id)}
                        aria-current={choisi ? "true" : undefined}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition ${
                          choisi ? "bg-bordeaux-50 ring-1 ring-bordeaux-200" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-800 truncate">
                            {o.nom} {o.prenom}
                          </span>
                          <span className="block text-[11px] text-slate-500 truncate">
                            {o.matricule} · {o.fonction}
                            {o.aPhoto ? "" : " · sans photo"}
                          </span>
                        </span>
                        {o.confectionneLe ? (
                          <Pill tonalite="vert">
                            <Check size={12} aria-hidden="true" />
                            {dateCourte(o.confectionneLe)}
                          </Pill>
                        ) : (
                          <Pill>À faire</Pill>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

// ---------- Onglet Confectionner ----------

function Confectionner({ ouvrierId, setOuvrierId, aFaire, rechargerAFaire, allerAuxCouleurs }) {
  const toast = useToast();
  const { egliseId } = useTemple();
  const ecriture = peutEcrire();
  const [carte, setCarte] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [departementId, setDepartementId] = useState("");
  const [fonction, setFonction] = useState("");
  const [photoUrl, setPhotoUrl] = useState(null);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [rendu, setRendu] = useState(null); // { recto, verso } canvases
  const [apercus, setApercus] = useState(null); // { recto, verso } data URLs
  const [enCours, setEnCours] = useState("");
  const [glisser, setGlisser] = useState(false);
  const [versionListe, setVersionListe] = useState(0);
  const [listeDep, setListeDep] = useState(null); // liste du département ouvert dans « Ouvriers par département »
  const champPhoto = useRef(null);

  const charger = useCallback(async (id) => {
    setChargement(true);
    try {
      const { carte: c } = await api.getBadgeCarte(id);
      setCarte(c);
      setDepartementId((prec) => (c.departements.some((d) => d.id === prec) ? prec : c.departements[0]?.id || ""));
      let url = null;
      if (c.aPhoto) {
        try {
          url = URL.createObjectURL(await api.getBadgePhotoBlob(id));
        } catch {
          url = null;
        }
      }
      setPhotoUrl((ancienne) => {
        if (ancienne) URL.revokeObjectURL(ancienne);
        return url;
      });
    } catch (err) {
      toast.error("Atelier badges", message(err, "La carte n'a pas pu être chargée."));
      setCarte(null);
    } finally {
      setChargement(false);
    }
  }, [toast]);

  useEffect(() => {
    if (ouvrierId) charger(ouvrierId);
    else setCarte(null);
  }, [ouvrierId, charger]);

  useEffect(() => () => photoUrl && URL.revokeObjectURL(photoUrl), [photoUrl]);

  const dep = carte?.departements.find((d) => d.id === departementId) || null;
  useEffect(() => setFonction(dep?.fonction || ""), [dep?.id, dep?.fonction]);

  const couleur = couleurValide(dep?.couleur);
  const membre = useMemo(
    () =>
      carte && dep
        ? {
            nom: carte.ouvrier.nom,
            prenom: carte.ouvrier.prenom,
            matricule: carte.ouvrier.matricule,
            fonction,
            district: carte.district,
            departement: dep.nom,
            // Sans couleur : carte grise (aperçu seulement, impression bloquée).
            couleur: couleur || "#8F8585",
            photo: photoUrl,
          }
        : null,
    [carte, dep, fonction, photoUrl, couleur]
  );

  useEffect(() => {
    let annule = false;
    if (!membre) {
      setRendu(null);
      setApercus(null);
      return undefined;
    }
    genererCarte(membre)
      .then((r) => {
        if (annule) return;
        setRendu(r);
        setApercus({ recto: r.recto.toDataURL("image/png"), verso: r.verso.toDataURL("image/png") });
      })
      .catch(() => !annule && toast.error("Atelier badges", "La carte n'a pas pu être dessinée."));
    return () => {
      annule = true;
    };
  }, [membre, toast]);

  async function enregistrerFonction() {
    if (!dep || !ecriture) return;
    const texte = fonction.trim().toUpperCase();
    if (texte === dep.fonction) return;
    try {
      await api.majFonctionCarte(carte.ouvrier.id, dep.id, texte === "" ? "" : texte);
      await charger(carte.ouvrier.id);
    } catch (err) {
      toast.error("Fonction", message(err, "La fonction n'a pas pu être enregistrée."));
    }
  }

  async function envoyerPhoto(fichier) {
    if (!fichier || !carte) return;
    setEnvoiPhoto(true);
    try {
      const blob = await preparerPhoto(fichier);
      await api.envoyerBadgePhoto(carte.ouvrier.id, blob);
      await charger(carte.ouvrier.id);
      toast.success("Photo", "Photo enregistrée sur la fiche de l'ouvrier.");
    } catch (err) {
      toast.error("Photo", message(err, "La photo n'a pas pu être envoyée."));
    } finally {
      setEnvoiPhoto(false);
      if (champPhoto.current) champPhoto.current.value = "";
    }
  }

  async function retirerPhoto() {
    try {
      await api.supprimerBadgePhoto(carte.ouvrier.id);
      await charger(carte.ouvrier.id);
    } catch (err) {
      toast.error("Photo", message(err, "La photo n'a pas pu être retirée."));
    }
  }

  async function marquer() {
    try {
      await api.marquerBadgeConfectionne(carte.ouvrier.id, dep.id);
      await Promise.all([charger(carte.ouvrier.id), rechargerAFaire()]);
      setVersionListe((v) => v + 1);
    } catch (err) {
      toast.error("Atelier badges", message(err, "La carte n'a pas pu être marquée comme faite."));
    }
  }

  async function action(nom, fn) {
    setEnCours(nom);
    try {
      await fn();
      await marquer();
    } finally {
      setEnCours("");
    }
  }

  const imprimable = Boolean(rendu && couleur && ecriture);
  // Suivant : d'abord le prochain « à faire » du département parcouru, sinon la liste générale.
  const suivantDep = listeDep?.ouvriers.find((o) => !o.confectionneLe && o.id !== ouvrierId);
  const suivant = suivantDep || aFaire.find((o) => o.id !== ouvrierId);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      <div className="space-y-4 min-w-0">
        <Card title="Ouvrier" description="La carte se remplit avec les informations enregistrées.">
          <div className="space-y-3">
            <Recherche onChoisir={setOuvrierId} egliseId={egliseId} />
            {chargement && <p className="text-xs text-slate-500">Chargement de la carte…</p>}
            {carte && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{nomCarte(carte.ouvrier)}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{carte.ouvrier.matricule}</p>
                  </div>
                  <TemplePill eglise={carte.eglise} />
                </div>

                {carte.departements.length === 0 ? (
                  <p className="text-xs text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-3 py-2">
                    Cet ouvrier n'est dans aucun département : ajoutez-le à un département pour faire sa carte.
                  </p>
                ) : (
                  <>
                    <Field label="Département de la carte">
                      <Select value={departementId} onChange={(e) => setDepartementId(e.target.value)} disabled={carte.departements.length < 2}>
                        {carte.departements.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nom}
                            {d.confectionneLe ? ` · faite le ${dateCourte(d.confectionneLe)}` : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Fonction affichée" hint="Déduite du rôle dans le département. Modifiable, par exemple « RESPONSABLE ADJOINTE ». Videz le champ pour revenir au rôle.">
                      <Input
                        value={fonction}
                        onChange={(e) => setFonction(e.target.value.toUpperCase())}
                        onBlur={enregistrerFonction}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        disabled={!ecriture}
                        maxLength={60}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-slate-200 px-3 py-2">
                        <p className="text-slate-500">District</p>
                        <p className="font-semibold text-slate-800">{carte.district}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 px-3 py-2">
                        <p className="text-slate-500">Couleur</p>
                        {couleur ? (
                          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span className="inline-block h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: couleur }} />
                            {couleur}
                          </p>
                        ) : (
                          <button type="button" onClick={allerAuxCouleurs} className="font-semibold text-amber-700 underline underline-offset-2">
                            À définir
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {ecriture && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setGlisser(true); }}
                    onDragLeave={() => setGlisser(false)}
                    onDrop={(e) => { e.preventDefault(); setGlisser(false); envoyerPhoto(e.dataTransfer.files?.[0]); }}
                    className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-3 py-3 transition ${glisser ? "border-bordeaux-400 bg-bordeaux-50" : "border-slate-300"}`}
                  >
                    <Camera size={22} className="text-bordeaux-700 shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0 text-xs text-slate-600">
                      <p className="font-medium text-slate-800">{carte.aPhoto ? "Photo enregistrée" : "Ajoutez la photo"}</p>
                      <p>Glissez une photo ici, ou choisissez un fichier. Elle est recadrée au format du cadre.</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Btn size="xs" variant="secondary" loading={envoiPhoto} onClick={() => champPhoto.current?.click()}>
                        {carte.aPhoto ? "Changer" : "Choisir"}
                      </Btn>
                      {carte.aPhoto && (
                        <Btn size="xs" variant="ghost" icon={<Trash2 size={12} />} onClick={retirerPhoto}>
                          Retirer
                        </Btn>
                      )}
                    </div>
                    <input
                      ref={champPhoto}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="user"
                      className="hidden"
                      onChange={(e) => envoyerPhoto(e.target.files?.[0])}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {carte && dep && ecriture && (
          <Card title="Imprimer ou télécharger" description="Une face par page, au format carte 54 × 85,6 mm.">
            <div className="space-y-3">
              {!couleur && (
                <p className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    La couleur de {dep.nom} n'est pas encore définie : la carte est grise et ne peut pas être imprimée.{" "}
                    <button type="button" onClick={allerAuxCouleurs} className="font-semibold underline underline-offset-2">
                      Définir la couleur
                    </button>
                  </span>
                </p>
              )}
              <Btn
                variant="gold"
                className="w-full"
                icon={<Printer size={16} />}
                disabled={!imprimable}
                loading={enCours === "impression"}
                onClick={() => action("impression", () => new Promise((ok) => setTimeout(() => { window.print(); ok(); }, 150)))}
              >
                Imprimer recto + verso
              </Btn>
              <div className="grid grid-cols-2 gap-2">
                <Btn
                  variant="secondary"
                  size="sm"
                  icon={<Download size={14} />}
                  disabled={!imprimable}
                  loading={enCours === "recto"}
                  onClick={() => action("recto", () => telecharger(rendu.recto, nomFichier(carte.ouvrier, dep.nom, "recto")))}
                >
                  Recto PNG
                </Btn>
                <Btn
                  variant="secondary"
                  size="sm"
                  icon={<Download size={14} />}
                  disabled={!imprimable}
                  loading={enCours === "verso"}
                  onClick={() => action("verso", () => telecharger(rendu.verso, nomFichier(carte.ouvrier, dep.nom, "verso")))}
                >
                  Verso PNG
                </Btn>
              </div>
              <p className="text-[11px] text-slate-500">
                À l'impression, choisissez l'échelle <strong>100 %</strong> et désactivez « Ajuster à la page ».
              </p>
              {dep.confectionneLe && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-700">
                  <Check size={14} aria-hidden="true" /> Carte {dep.nom} faite le {dateCourte(dep.confectionneLe)}
                </p>
              )}
              {suivant && (
                <Btn variant="primary" className="w-full" icon={<ArrowRight size={16} />} onClick={() => {
                    if (suivantDep) setDepartementId(listeDep.departement.id);
                    setOuvrierId(suivant.id);
                  }}>
                  Ouvrier suivant : {suivant.nom} {suivant.prenom}
                </Btn>
              )}
            </div>
          </Card>
        )}

        <ListeDepartement
          egliseId={egliseId}
          ouvrierId={ouvrierId}
          version={versionListe}
          onListe={setListeDep}
          onChoisir={(id, depId) => {
            setDepartementId(depId);
            setOuvrierId(id);
          }}
        />
      </div>

      <Card title="Aperçu" description="Recto et verso, tels qu'ils seront imprimés." bodyClassName="p-0">
        <div className="carte-scene rounded-b-xl px-4 py-6">
          {apercus ? (
            <div className="flex flex-wrap justify-center gap-6">
              <figure className="flex flex-col items-center gap-2 w-[min(280px,100%)]">
                <img src={apercus.recto} alt={`Recto de la carte de ${nomCarte(carte.ouvrier)}`} className="carte-apercu" />
                <figcaption className="text-[11px] text-slate-500">Recto</figcaption>
              </figure>
              <figure className="flex flex-col items-center gap-2 w-[min(280px,100%)]">
                <img src={apercus.verso} alt="Verso de la carte" className="carte-apercu" />
                <figcaption className="text-[11px] text-slate-500">Verso</figcaption>
              </figure>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <Search size={26} className="text-slate-300" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-700">Cherchez un ouvrier</p>
              <p className="text-xs text-slate-500 max-w-xs">
                Sa carte s'affichera ici, déjà remplie avec son nom, sa fonction, son matricule, son district et son département.
              </p>
            </div>
          )}
        </div>
      </Card>

      {apercus &&
        createPortal(
          <div id="carte-impression" aria-hidden="true">
            <img src={apercus.recto} alt="" />
            <img src={apercus.verso} alt="" />
          </div>,
          document.body
        )}
    </div>
  );
}

// ---------- Onglet À confectionner ----------

function AConfectionner({ aFaire, total, chargement, choisir }) {
  return (
    <Card title={`À confectionner · ${total}`} description="Ouvriers actifs qui n'ont encore aucune carte, dans le temple sélectionné.">
      {chargement ? (
        <p className="text-xs text-slate-500 py-6 text-center">Chargement…</p>
      ) : aFaire.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">Toutes les cartes sont faites.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {aFaire.map((o) => (
            <li key={o.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800 truncate">{o.nom} {o.prenom}</span>
                <span className="block text-[11px] text-slate-500 truncate">
                  {o.matricule} · {o.departements.join(", ") || "sans département"}
                </span>
              </span>
              <Btn size="xs" variant="secondary" onClick={() => choisir(o.id)}>
                Faire la carte
              </Btn>
            </li>
          ))}
        </ul>
      )}
      {total > aFaire.length && <p className="text-[11px] text-slate-500 mt-2">Les {aFaire.length} premiers sont affichés.</p>}
    </Card>
  );
}

// ---------- Onglet Couleurs ----------

function Couleurs() {
  const toast = useToast();
  const { egliseId, actives } = useTemple();
  const ecriture = peutEcrire();
  const [departements, setDepartements] = useState([]);
  const [saisies, setSaisies] = useState({});
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(null);

  const charger = useCallback(() => {
    setChargement(true);
    return api
      .getDepartements({ limit: 200, ...paramTemple(egliseId) })
      .then((d) => {
        const liste = d.departements || [];
        setDepartements(liste);
        setSaisies(Object.fromEntries(liste.map((x) => [x.id, x.couleur || ""])));
      })
      .catch(() => toast.error("Couleurs", "La liste des départements n'a pas pu être chargée."))
      .finally(() => setChargement(false));
  }, [egliseId, toast]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function enregistrer(d, valeur) {
    const couleur = valeur === "" ? null : couleurValide(valeur);
    if (valeur !== "" && !couleur) {
      toast.error("Couleurs", "Saisissez une couleur au format #RRGGBB, par exemple #BD175C.");
      return;
    }
    setEnCours(d.id);
    try {
      await api.updateDepartement(d.id, { couleur });
      await charger();
      toast.success("Couleurs", couleur ? `${d.nom} : ${couleur}` : `Couleur de ${d.nom} retirée.`);
    } catch (err) {
      toast.error("Couleurs", message(err, "La couleur n'a pas pu être enregistrée."));
    } finally {
      setEnCours(null);
    }
  }

  const nomTemple = (id) => actives.find((e) => e.id === id)?.nom?.replace(/^temple\s+(de\s+)?/i, "") || "";

  return (
    <Card
      title="Couleurs des départements"
      description="La couleur teinte le fond et la bande de la carte. Tant qu'elle n'est pas définie, la carte du département ne s'imprime pas."
    >
      {chargement ? (
        <p className="text-xs text-slate-500 py-6 text-center">Chargement…</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {departements.map((d) => {
            const saisie = saisies[d.id] ?? "";
            const valide = couleurValide(saisie);
            const modifie = (valide || "") !== (d.couleur || "") || (saisie === "" && d.couleur);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span
                  className={`h-7 w-7 shrink-0 rounded-full ${d.couleur ? "border border-black/10" : "border-2 border-dashed border-slate-300"}`}
                  style={d.couleur ? { background: d.couleur } : undefined}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800">{d.nom}</span>
                  <span className="block text-[11px] text-slate-500">
                    {!egliseId && nomTemple(d.egliseId) ? `${nomTemple(d.egliseId)} · ` : ""}
                    {d.couleur ? d.couleur : "à définir"}
                  </span>
                </span>
                {ecriture ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`Couleur de ${d.nom}`}
                      value={valide || "#8F8585"}
                      onChange={(e) => setSaisies((s) => ({ ...s, [d.id]: e.target.value.toUpperCase() }))}
                      className="h-9 w-11 cursor-pointer rounded-md border border-slate-300 bg-white p-0.5"
                    />
                    <Input
                      value={saisie}
                      onChange={(e) => setSaisies((s) => ({ ...s, [d.id]: e.target.value.toUpperCase() }))}
                      placeholder="#RRGGBB"
                      aria-label={`Code couleur de ${d.nom}`}
                      className="w-28 font-mono"
                      maxLength={7}
                    />
                    <Btn size="sm" disabled={!modifie} loading={enCours === d.id} onClick={() => enregistrer(d, saisie)}>
                      Enregistrer
                    </Btn>
                  </div>
                ) : (
                  <Pill tonalite={d.couleur ? "vert" : "or"}>{d.couleur ? "définie" : "à définir"}</Pill>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[11px] text-slate-500 mt-3">
        Couleur de la carte d'origine (HUISSIER) : <span className="font-mono">{COULEUR_MODELE}</span>.
      </p>
    </Card>
  );
}

// ---------- Page ----------

const ONGLETS = [
  { id: "confectionner", libelle: "Confectionner", icone: Printer },
  { id: "a-faire", libelle: "À confectionner", icone: Check },
  { id: "couleurs", libelle: "Couleurs des départements", icone: Palette },
];

export default function BadgeStudioPage() {
  const { egliseId } = useTemple();
  const [onglet, setOnglet] = useState("confectionner");
  const [ouvrierId, setOuvrierId] = useState(null);
  const [aFaire, setAFaire] = useState({ ouvriers: [], total: 0, chargement: true });

  const rechargerAFaire = useCallback(
    () =>
      api
        .getBadgesAConfectionner(paramTemple(egliseId))
        .then((d) => setAFaire({ ouvriers: d.ouvriers, total: d.total, chargement: false }))
        .catch(() => setAFaire((a) => ({ ...a, chargement: false }))),
    [egliseId]
  );

  useEffect(() => {
    rechargerAFaire();
  }, [rechargerAFaire]);

  function choisir(id) {
    setOuvrierId(id);
    setOnglet("confectionner");
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "Poppins,sans-serif" }}>
            Atelier badges
          </h1>
          <p className="text-xs text-slate-500">Confectionnez la carte de badge d'un ouvrier pour son département.</p>
        </div>
        <div role="tablist" aria-label="Sections de l'atelier" className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {ONGLETS.map(({ id, libelle, icone: Icone }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={onglet === id}
              onClick={() => setOnglet(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                onglet === id ? "bg-white text-bordeaux-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Icone size={14} aria-hidden="true" />
              {libelle}
              {id === "a-faire" && !aFaire.chargement && (
                <span className="rounded-full bg-bordeaux-700 px-1.5 text-[10px] text-white tabular-nums">{aFaire.total}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {onglet === "confectionner" && (
        <Confectionner
          ouvrierId={ouvrierId}
          setOuvrierId={setOuvrierId}
          aFaire={aFaire.ouvriers}
          rechargerAFaire={rechargerAFaire}
          allerAuxCouleurs={() => setOnglet("couleurs")}
        />
      )}
      {onglet === "a-faire" && (
        <AConfectionner aFaire={aFaire.ouvriers} total={aFaire.total} chargement={aFaire.chargement} choisir={choisir} />
      )}
      {onglet === "couleurs" && <Couleurs />}
    </div>
  );
}
