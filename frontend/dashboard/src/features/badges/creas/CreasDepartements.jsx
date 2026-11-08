import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import { getAdmin } from "../../../lib/auth";
import { useTemple } from "../../../lib/temple";
import { useToast } from "../../../components/Toast";
import Card from "../../../ui/Card";
import Btn from "../../../ui/Btn";
import Pill from "../../../ui/Pill";
import { Field, Select } from "../../../ui/inputs";
import { genererCarte, couleurValide } from "../carte";
import { preparerCrea } from "../carte/photo";
import { urlCrea } from "./urlCrea";

const GRIS = "#8F8585";
const peutEcrire = () => ["ADMIN", "SUPER_ADMIN"].includes(getAdmin()?.role);
const message = (err, defaut) => (err instanceof ApiError ? err.message : err?.message || defaut);
const nomTemple = (nom) => String(nom || "").replace(/^temple\s+(de\s+|du\s+)?/i, "");

/** Tous les départements : l'API rend 100 lignes au plus par page. */
async function tousLesDepartements() {
  const liste = [];
  for (let page = 1; ; page++) {
    const d = await api.getDepartements({ limit: 100, page });
    liste.push(...(d.departements || []));
    if (liste.length >= d.total || !d.departements?.length) return liste;
  }
}

function Vignette({ departement }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let actif = true;
    setUrl(null);
    urlCrea(departement.id, departement.creaMaj).then((u) => actif && setUrl(u));
    return () => {
      actif = false;
    };
  }, [departement.id, departement.creaMaj]);

  if (url) return <img src={url} alt={`Créa de ${departement.nom}`} className="h-full w-full object-cover" />;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
      <span
        className="h-6 w-6 rounded-full border border-black/10"
        style={{ background: couleurValide(departement.couleur) || GRIS }}
      />
      <span className="px-2 text-center text-xs">{departement.creaMaj ? "Chargement…" : "Maquette recolorée"}</span>
    </div>
  );
}

/** Aperçu d'une carte fictive sur la créa choisie, avant de l'enregistrer. */
function ApercuImport({ apercu, enCours, onAnnuler, onValider }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="Aperçu de la créa">
      <div className="flex max-h-full w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div>
          <h3 className="font-semibold text-slate-800">Aperçu · {apercu.departement.nom}</h3>
          <p className="text-sm text-slate-500">{apercu.temple} · carte d'exemple, les vraies données se placeront de la même façon.</p>
        </div>
        <img src={apercu.image} alt="Carte d'exemple sur la créa" className="mx-auto w-64 rounded-lg shadow" />
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={onAnnuler} disabled={enCours}>Annuler</Btn>
          <Btn onClick={onValider} loading={enCours}>Enregistrer la créa</Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function CreasDepartements() {
  const toast = useToast();
  const { actives, egliseId: templeGlobal } = useTemple();
  const ecriture = peutEcrire();
  const [departements, setDepartements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [egliseId, setEgliseId] = useState(templeGlobal);
  const [nom, setNom] = useState("");
  const [apercu, setApercu] = useState(null); // { departement, temple, blob, image }
  const [enCours, setEnCours] = useState(null); // id du département en cours d'envoi ou de retrait
  const [aRetirer, setARetirer] = useState(null); // id en attente de confirmation
  const champ = useRef(null);
  const cible = useRef(null);

  async function charger() {
    try {
      setDepartements(await tousLesDepartements());
    } catch {
      toast.error("Créas", "La liste des départements n'a pas pu être chargée.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
    // Une seule fois à l'ouverture de l'onglet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setEgliseId(templeGlobal), [templeGlobal]);

  const duTemple = useMemo(
    () => (egliseId ? departements.filter((d) => d.egliseId === egliseId) : departements),
    [departements, egliseId]
  );
  // Un même nom existe dans plusieurs temples : le filtre porte sur le nom.
  const noms = useMemo(() => [...new Set(duTemple.map((d) => d.nom))].sort((a, b) => a.localeCompare(b, "fr")), [duTemple]);
  useEffect(() => {
    if (nom && !noms.includes(nom)) setNom("");
  }, [nom, noms]);
  const visibles = useMemo(() => (nom ? duTemple.filter((d) => d.nom === nom) : duTemple), [duTemple, nom]);
  const avecCrea = visibles.filter((d) => d.creaMaj).length;

  function choisirFichier(d) {
    cible.current = d;
    champ.current.value = "";
    champ.current.click();
  }

  async function fichierChoisi(e) {
    const fichier = e.target.files?.[0];
    const d = cible.current;
    if (!fichier || !d) return;
    setEnCours(d.id);
    let url = null;
    try {
      const blob = await preparerCrea(fichier);
      url = URL.createObjectURL(blob);
      const temple = nomTemple(d.eglise?.nom);
      const { recto } = await genererCarte({
        nom: "NOM",
        prenom: "PRÉNOMS",
        matricule: "RSI-0000",
        fonction: "MEMBRE",
        district: `DISTRICT-${temple}`.toUpperCase(),
        departement: d.libelleCarte || d.nom,
        modele: d.modeleCarte,
        couleur: couleurValide(d.couleur) || GRIS,
        crea: url,
      });
      setApercu({ departement: d, temple, blob, image: recto.toDataURL("image/png") });
    } catch (err) {
      toast.error("Créas", message(err, "Cette créa n'a pas pu être préparée."));
    } finally {
      if (url) URL.revokeObjectURL(url);
      setEnCours(null);
    }
  }

  async function enregistrer() {
    const { departement: d, blob } = apercu;
    setEnCours(d.id);
    try {
      await api.envoyerBadgeCrea(d.id, blob);
      await charger();
      setApercu(null);
      toast.success("Créas", `La créa de ${d.nom} est enregistrée : ses cartes l'utilisent maintenant.`);
    } catch (err) {
      toast.error("Créas", message(err, "La créa n'a pas pu être enregistrée."));
    } finally {
      setEnCours(null);
    }
  }

  async function retirer(d) {
    setEnCours(d.id);
    try {
      await api.supprimerBadgeCrea(d.id);
      await charger();
      toast.success("Créas", `${d.nom} revient à la maquette recolorée.`);
    } catch (err) {
      toast.error("Créas", message(err, "La créa n'a pas pu être retirée."));
    } finally {
      setEnCours(null);
      setARetirer(null);
    }
  }

  return (
    <Card
      title="Créas des départements"
      description="Importez la créa du badge d'un département, au format de la carte, avec « Département » et le nom du département déjà dans l'image, et le cadre photo vide. Sans nom du membre ni « N° Matricule: » : la photo, le nom, la fonction, le matricule et le district se placent par-dessus."
    >
      <input ref={champ} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={fichierChoisi} />

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Field label="Église">
          <Select value={egliseId} onChange={(e) => setEgliseId(e.target.value)} aria-label="Filtrer par église">
            <option value="">Toutes les églises</option>
            {actives.map((e) => (
              <option key={e.id} value={e.id}>{e.nom}</option>
            ))}
          </Select>
        </Field>
        <Field label="Département">
          <Select value={nom} onChange={(e) => setNom(e.target.value)} aria-label="Filtrer par département">
            <option value="">Tous les départements</option>
            {noms.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </Field>
      </div>

      {chargement ? (
        <p className="mt-6 text-sm text-slate-500">Chargement des départements…</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-slate-600">
            <span className="font-semibold">{avecCrea}</span> créa{avecCrea > 1 ? "s" : ""} importée{avecCrea > 1 ? "s" : ""} sur {visibles.length} département{visibles.length > 1 ? "s" : ""}
          </p>
          {visibles.length === 0 && <p className="mt-4 text-sm text-slate-500">Aucun département pour ce filtre.</p>}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibles.map((d) => (
              <div key={d.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-3">
                <div className="mx-auto aspect-[915/1456] w-40 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-black/5">
                  <Vignette departement={d} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800" title={d.nom}>{d.nom}</p>
                  <p className="truncate text-sm text-slate-500">{nomTemple(d.eglise?.nom)}</p>
                </div>
                <div>
                  <Pill tonalite={d.creaMaj ? "vert" : "gris"}>{d.creaMaj ? "Créa importée" : "Pas de créa"}</Pill>
                </div>
                {ecriture && (
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Btn
                      variant="secondary"
                      size="sm"
                      icon={d.creaMaj ? <Upload size={14} /> : <ImagePlus size={14} />}
                      loading={enCours === d.id && !aRetirer}
                      disabled={Boolean(enCours)}
                      onClick={() => choisirFichier(d)}
                    >
                      {d.creaMaj ? "Remplacer" : "Importer"}
                    </Btn>
                    {d.creaMaj &&
                      (aRetirer === d.id ? (
                        <>
                          <Btn variant="danger" size="sm" loading={enCours === d.id} onClick={() => retirer(d)}>Confirmer</Btn>
                          <Btn variant="ghost" size="sm" disabled={Boolean(enCours)} onClick={() => setARetirer(null)}>Annuler</Btn>
                        </>
                      ) : (
                        <Btn variant="ghost" size="sm" icon={<Trash2 size={14} />} disabled={Boolean(enCours)} onClick={() => setARetirer(d.id)}>
                          Retirer
                        </Btn>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {apercu && (
        <ApercuImport apercu={apercu} enCours={enCours === apercu.departement.id} onAnnuler={() => setApercu(null)} onValider={enregistrer} />
      )}
    </Card>
  );
}
