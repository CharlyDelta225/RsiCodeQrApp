import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, Download, Grid3x3, LayoutList, Printer, QrCode, ScanLine, Square } from "lucide-react";
import { useBadgeQr } from "../features/badges/useBadgeQr";
import { api, ApiError } from "../lib/api";
import { telechargerBlob } from "../lib/download";
import { libelleDepartement } from "../lib/departement";
import { getAdmin } from "../lib/auth";
import { usePagination } from "../lib/pagination";
import PaginationBar from "../components/PaginationBar";
import TableShell from "../ui/TableShell";
import Pill from "../ui/Pill";
import Btn from "../ui/Btn";
import { Input, Select } from "../ui/inputs";

const ROLE_ECRITURE = ["ADMIN", "SUPER_ADMIN"];

// Les badges = support d'empreinte : leur export/impression est réservé aux
// rôles à écriture ; un LECTEUR ne fait que consulter (voir le QR).
function peutEcrire() {
  return ROLE_ECRITURE.includes(getAdmin()?.role);
}

function getInitials(nom, prenom) {
  const a = (prenom || nom || "?")[0] || "?";
  const b = prenom && nom ? nom[0] : "";
  return (a + b).toUpperCase().slice(0, 2);
}

function QrBadge({ valeur, size = 56 }) {
  const { dataUrl } = useBadgeQr(valeur);
  if (!dataUrl) {
    return <div className="bg-slate-100 rounded animate-pulse" style={{ width: size, height: size }} />;
  }
  return <img src={dataUrl} alt="" width={size} height={size} className="rounded" />;
}

// Le terminal attend le matricule brut dans le QR (voir badgeAdapter.valeurQr).
function valeurQrOuvrier(o) {
  return o.matricule;
}

function CarteBadgeImpression({ ouvrier }) {
  return (
    <div className="badge-print-carte">
      <div className="badge-print-bande">
        <span>RSI</span>
        <span>Présence</span>
      </div>
      <div className="badge-print-corps">
        <div className="badge-print-infos">
          <p className="badge-print-nom">{ouvrier.prenom} {ouvrier.nom}</p>
          <p className="badge-print-matricule">{ouvrier.matricule}</p>
          <p className="badge-print-dept">{libelleDepartement(ouvrier)}</p>
        </div>
        <QrBadge valeur={valeurQrOuvrier(ouvrier)} size={96} />
      </div>
    </div>
  );
}

export default function BadgesPage() {
  const navigate = useNavigate();
  const [ouvriers, setOuvriers] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [total, setTotal] = useState(0);
  const [recherche, setRecherche] = useState("");
  const [filtreActif, setFiltreActif] = useState("tous"); // tous | actifs | desactives
  const [filtreDepartement, setFiltreDepartement] = useState("tous"); // "tous" | uuid
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [vue, setVue] = useState("grille");
  const [selection, setSelection] = useState([]);

  const [telechargementZip, setTelechargementZip] = useState(false);
  const [telechargementSelection, setTelechargementSelection] = useState(false);

  const [badgeUrl, setBadgeUrl] = useState(null);
  const [badgeOuvrier, setBadgeOuvrier] = useState(null);
  const [telechargementUnite, setTelechargementUnite] = useState(false);

  const pagination = usePagination(ouvriers);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const params = { limit: 200 };
      if (recherche) params.recherche = recherche;
      if (filtreActif === "actifs") params.actif = "true";
      if (filtreActif === "desactives") params.actif = "false";
      if (filtreDepartement !== "tous") params.departementId = filtreDepartement;
      const data = await api.getOuvriers(params);
      setOuvriers(data.ouvriers);
      setTotal(data.total);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, [recherche, filtreActif, filtreDepartement]);

  useEffect(() => {
    api
      .getDepartements({ limit: 100 })
      .then((d) => setDepartements(d.departements || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    setSelection([]);
  }, [recherche, filtreActif, filtreDepartement]);

  function toggleSelection(id) {
    setSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toutSelectionner() {
    const ids = pagination.elementsPage.map((o) => o.id);
    if (ids.length === 0) return;
    const tous = ids.every((id) => selection.includes(id));
    if (tous) {
      setSelection((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelection((prev) => Array.from(new Set([...prev, ...ids])));
    }
  }

  const selectionPageTout = useMemo(() => {
    const ids = pagination.elementsPage.map((o) => o.id);
    if (ids.length === 0) return false;
    return ids.every((id) => selection.includes(id));
  }, [pagination.elementsPage, selection]);

  function handleImprimerSelection() {
    setTimeout(() => window.print(), 250);
  }

  async function handleTelechargerSelection() {
    if (selection.length === 0) return;
    setTelechargementSelection(true);
    setErreur(null);
    try {
      for (const id of selection) {
        const o = ouvriers.find((x) => x.id === id);
        if (!o) continue;
        const blob = await api.getOuvrierBadgeBlob(id);
        const nom = `${o.matricule}_${o.nom}_${o.prenom}`.replace(/[^\w-]+/g, "_");
        telechargerBlob(blob, `${nom}.png`);
      }
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur lors du téléchargement des badges");
    } finally {
      setTelechargementSelection(false);
    }
  }

  const departementChoisi = departements.find((d) => d.id === filtreDepartement)?.nom;

  async function handleTelechargerZip() {
    setTelechargementZip(true);
    setErreur(null);
    try {
      const params = {};
      if (filtreActif === "actifs") params.actif = "true";
      if (filtreActif === "desactives") params.actif = "false";
      if (filtreDepartement !== "tous") params.departementId = filtreDepartement;
      const blob = await api.getBadgesZipBlob(params);
      const date = new Date().toISOString().slice(0, 10);
      const base = departementChoisi
        ? departementChoisi.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-")
        : "tous";
      telechargerBlob(blob, `badges-qr-${base}-${date}.zip`);
    } catch (err) {
      setErreur(
        err instanceof ApiError
          ? err.code === "AUCUN_OUVRIER"
            ? "Aucun ouvrier ne correspond au filtre sélectionné."
            : err.message
          : "Erreur lors du téléchargement du ZIP"
      );
    } finally {
      setTelechargementZip(false);
    }
  }

  async function handleVoirBadge(ouvrier) {
    setErreur(null);
    try {
      const blob = await api.getOuvrierBadgeBlob(ouvrier.id);
      setBadgeUrl(URL.createObjectURL(blob));
      setBadgeOuvrier(ouvrier);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur lors du chargement du badge");
    }
  }

  async function handleTelechargerUnBadge() {
    if (!badgeOuvrier) return;
    setTelechargementUnite(true);
    try {
      const blob = await api.getOuvrierBadgeBlob(badgeOuvrier.id);
      telechargerBlob(blob, `${badgeOuvrier.matricule}_${badgeOuvrier.nom}_${badgeOuvrier.prenom}.png`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur lors du téléchargement du badge");
    } finally {
      setTelechargementUnite(false);
    }
  }

  function fermerModal() {
    if (badgeUrl) URL.revokeObjectURL(badgeUrl);
    setBadgeUrl(null);
    setBadgeOuvrier(null);
  }

  return (
    <div className={`badges-page p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto${selection.length > 0 ? " badges-page--selection" : ""}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "Poppins,sans-serif" }}>
            Badges QR
          </h1>
          <p className="text-xs text-slate-500">{total} badge(s)</p>
        </div>
        {peutEcrire() && (
          <div className="flex flex-wrap items-center gap-2">
            <Btn
              variant="secondary"
              onClick={() => navigate("/badges/atelier")}
              icon={<ScanLine size={16} />}
            >
              Atelier recto / verso
            </Btn>
            <Btn variant="gold" onClick={handleTelechargerZip} loading={telechargementZip} icon={<Download size={16} />}>
              {telechargementZip
                ? "Préparation du ZIP…"
                : departementChoisi
                ? `Télécharger les QR ${departementChoisi} (ZIP)`
                : "Télécharger tous les QR (ZIP)"}
            </Btn>
          </div>
        )}
      </div>

      {erreur && (
        <p className="text-sm text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-3 py-2">{erreur}</p>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Rechercher par nom, prénom, département, matricule…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="sm:w-64">
            <Select value={filtreDepartement} onChange={(e) => setFiltreDepartement(e.target.value)}>
              <option value="tous">Tous les départements</option>
              {departements.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:w-48">
            <Select value={filtreActif} onChange={(e) => setFiltreActif(e.target.value)}>
              <option value="tous">Tous les badges</option>
              <option value="actifs">Actifs uniquement</option>
              <option value="desactives">Désactivés uniquement</option>
            </Select>
          </div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setVue("grille")}
              className={`px-2.5 py-2 text-slate-500 ${vue === "grille" ? "bg-bordeaux-50 text-bordeaux-700" : "bg-white hover:bg-slate-50"}`}
              title="Vue grille"
            >
              <Grid3x3 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setVue("liste")}
              className={`px-2.5 py-2 text-slate-500 ${vue === "liste" ? "bg-bordeaux-50 text-bordeaux-700" : "bg-white hover:bg-slate-50"}`}
              title="Vue liste"
            >
              <LayoutList size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Le ZIP respecte les filtres de département et de statut ci-dessus et nomme chaque fichier
        <span className="font-mono"> matricule_NOM_Prenom.png</span> pour l'attribution précise à chaque ouvrier.
      </p>

      {vue === "liste" ? (
        <TableShell
          colonnes={["", "Matricule", "Nom", "Prénom", "Téléphone", "Département", "Statut", "Actions"]}
          chargement={chargement}
          vide="Aucun badge trouvé"
        >
          {pagination.elementsPage.map((o) => (
            <tr key={o.id} className="border-t border-slate-100 hover:bg-bordeaux-50/40 transition-colors">
              <td className="px-3 py-2">
                <button type="button" onClick={() => toggleSelection(o.id)} aria-label="Sélectionner" className="text-slate-400 hover:text-bordeaux-700">
                  {selection.includes(o.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{o.matricule}</td>
              <td className="px-3 py-2">{o.nom}</td>
              <td className="px-3 py-2">{o.prenom}</td>
              <td className="px-3 py-2 whitespace-nowrap">{o.telephone || "—"}</td>
              <td className="px-3 py-2">{libelleDepartement(o)}</td>
              <td className="px-3 py-2">
                <Pill tonalite={o.actif ? "vert" : "gris"}>{o.actif ? "Actif" : "Désactivé"}</Pill>
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <Btn
                  variant="secondary"
                  size="xs"
                  onClick={() => handleVoirBadge(o)}
                  icon={<QrCode size={14} />}
                >
                  Voir le badge
                </Btn>
              </td>
            </tr>
          ))}
        </TableShell>
      ) : chargement ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : pagination.elementsPage.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center bg-white border border-slate-200 rounded-2xl">
          <QrCode size={28} className="text-slate-300" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700">Aucun badge trouvé</p>
          <p className="text-xs text-slate-500">Ajustez les filtres pour afficher des badges.</p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {pagination.elementsPage.map((o) => {
            const actif = selection.includes(o.id);
            return (
              <div
                key={o.id}
                className={`group relative rounded-2xl border bg-white p-4 transition-all ${
                  actif ? "border-bordeaux-400 ring-2 ring-bordeaux-200 shadow-md" : "border-slate-200 hover:border-bordeaux-200 hover:shadow-sm"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSelection(o.id)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-bordeaux-700"
                  aria-label={actif ? "Désélectionner le badge" : "Sélectionner le badge"}
                >
                  {actif ? <CheckSquare size={18} className="text-bordeaux-600" /> : <Square size={18} />}
                </button>
                <div className="flex items-start gap-3">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#B23A2B,#7B1515)" }}
                  >
                    {getInitials(o.nom, o.prenom)}
                  </div>
                  <div className="min-w-0 flex-1 pr-6">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {o.prenom} {o.nom}
                    </p>
                    <p className="text-xs font-mono text-slate-500">{o.matricule}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{libelleDepartement(o)}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <Pill tonalite={o.actif ? "vert" : "gris"}>{o.actif ? "Actif" : "Désactivé"}</Pill>
                  <Btn
                    variant="secondary"
                    size="xs"
                    onClick={() => handleVoirBadge(o)}
                    icon={<QrCode size={12} />}
                  >
                    Aperçu
                  </Btn>
                </div>

                <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-3">
                  <div className="bg-white rounded border border-slate-200 p-1 flex-shrink-0">
                    <QrBadge valeur={valeurQrOuvrier(o)} size={44} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Badge RSI</p>
                    <p className="text-[11px] text-slate-600 truncate">QR · {o.matricule}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selection.length > 0 && (
        <div className="sticky bottom-3 z-30 rounded-2xl border border-bordeaux-200 bg-white/95 backdrop-blur shadow-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <CheckSquare size={16} className="text-bordeaux-700" aria-hidden="true" />
            <span><strong>{selection.length}</strong> badge(s) sélectionné(s)</span>
            <button type="button" onClick={toutSelectionner} className="text-xs text-slate-500 hover:text-bordeaux-700 underline">
              {selectionPageTout ? "Désélectionner la page" : "Sélectionner la page"}
            </button>
            <button type="button" onClick={() => setSelection([])} className="text-xs text-slate-500 hover:text-bordeaux-700 underline">
              Tout désélectionner
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Btn
              variant="secondary"
              size="sm"
              onClick={handleImprimerSelection}
              disabled={!peutEcrire()}
              icon={<Printer size={14} />}
            >
              Imprimer
            </Btn>
            <Btn
              variant="gold"
              size="sm"
              onClick={handleTelechargerSelection}
              loading={telechargementSelection}
              disabled={!peutEcrire()}
              icon={<Download size={14} />}
            >
              {telechargementSelection ? "Téléchargement…" : "Télécharger"}
            </Btn>
          </div>
        </div>
      )}

      <div className="badges-print-zone hidden print:grid">
        {ouvriers
          .filter((o) => selection.includes(o.id))
          .map((o) => (
            <CarteBadgeImpression key={o.id} ouvrier={o} />
          ))}
      </div>

      <PaginationBar
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPage={pagination.setPage}
        total={ouvriers.length}
        label="badge(s)"
      />

      {/* Modal badge individuel */}
      {badgeUrl && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 text-center space-y-3">
            <h2 className="font-bold text-slate-900">
              Badge — {badgeOuvrier?.prenom} {badgeOuvrier?.nom}
            </h2>
            <img src={badgeUrl} alt="QR code du badge" className="mx-auto w-64 h-auto" />
            <p className="text-xs font-mono text-slate-500">{badgeOuvrier?.matricule}</p>
            {badgeOuvrier && (
              <>
                <p className="text-xs text-slate-500">{libelleDepartement(badgeOuvrier)}</p>
                {badgeOuvrier.telephone && <p className="text-xs text-slate-500">Tél. {badgeOuvrier.telephone}</p>}
              </>
            )}
            <div className="flex justify-center gap-3 pt-1">
              {peutEcrire() && (
                <Btn variant="gold" onClick={handleTelechargerUnBadge} loading={telechargementUnite} icon={<Download size={16} />}>
                  {telechargementUnite ? "Téléchargement…" : "Télécharger ce badge"}
                </Btn>
              )}
              <Btn variant="secondary" onClick={fermerModal}>
                Fermer
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}