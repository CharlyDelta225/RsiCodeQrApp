import { useEffect, useState, useCallback } from "react";
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

export default function BadgesPage() {
  const [ouvriers, setOuvriers] = useState([]);
  const [total, setTotal] = useState(0);
  const [recherche, setRecherche] = useState("");
  const [filtreActif, setFiltreActif] = useState("tous"); // tous | actifs | desactives
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [telechargementZip, setTelechargementZip] = useState(false);

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
      const data = await api.getOuvriers(params);
      setOuvriers(data.ouvriers);
      setTotal(data.total);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, [recherche, filtreActif]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function handleTelechargerZip() {
    setTelechargementZip(true);
    setErreur(null);
    try {
      const params = {};
      if (filtreActif === "actifs") params.actif = "true";
      if (filtreActif === "desactives") params.actif = "false";
      const blob = await api.getBadgesZipBlob(params);
      const date = new Date().toISOString().slice(0, 10);
      telechargerBlob(blob, `badges-qr-${date}.zip`);
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
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-bordeaux-900">{total} badge(s)</h2>
        {peutEcrire() && (
          <Btn variant="gold" onClick={handleTelechargerZip} loading={telechargementZip} icon="⬇">
            {telechargementZip ? "Préparation du ZIP…" : "Télécharger tous les QR (ZIP)"}
          </Btn>
        )}
      </div>

      {erreur && (
        <p className="text-sm text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-3 py-2">{erreur}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Rechercher par nom, prénom, département, matricule…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <div className="sm:w-56">
          <Select value={filtreActif} onChange={(e) => setFiltreActif(e.target.value)}>
            <option value="tous">Tous les badges</option>
            <option value="actifs">Actifs uniquement</option>
            <option value="desactives">Désactivés uniquement</option>
          </Select>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Le ZIP respecte le filtre sélectionné ci-dessus et nomme chaque fichier
        <span className="font-mono"> matricule_NOM_Prenom.png</span> pour l'attribution précise à chaque ouvrier.
      </p>

      <TableShell
        colonnes={["Matricule", "Nom", "Prénom", "Département", "Statut", "Actions"]}
        chargement={chargement}
        vide="Aucun badge trouvé"
      >
        {pagination.elementsPage.map((o) => (
          <tr key={o.id} className="border-t border-slate-100 hover:bg-bordeaux-50/40 transition-colors">
            <td className="px-3 py-2 font-mono text-xs">{o.matricule}</td>
            <td className="px-3 py-2">{o.nom}</td>
            <td className="px-3 py-2">{o.prenom}</td>
            <td className="px-3 py-2">{libelleDepartement(o)}</td>
            <td className="px-3 py-2">
              <Pill tonalite={o.actif ? "vert" : "gris"}>{o.actif ? "Actif" : "Désactivé"}</Pill>
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap">
              <Btn
                variant="secondary"
                size="xs"
                onClick={() => handleVoirBadge(o)}
                icon="⊛"
              >
                Voir le badge
              </Btn>
            </td>
          </tr>
        ))}
      </TableShell>

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
            <img src={badgeUrl} alt="QR code du badge" className="mx-auto w-64 h-64" />
            <p className="text-xs font-mono text-slate-500">{badgeOuvrier?.matricule}</p>
            {badgeOuvrier && (
              <p className="text-xs text-slate-500">{libelleDepartement(badgeOuvrier)}</p>
            )}
            <div className="flex justify-center gap-3 pt-1">
              {peutEcrire() && (
                <Btn variant="gold" onClick={handleTelechargerUnBadge} loading={telechargementUnite} icon="⬇">
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