import { useEffect, useState, useCallback } from "react";
import { Download } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { telechargerBlob } from "../lib/download";
import { libelleDepartement } from "../lib/departement";
import { getAdmin } from "../lib/auth";
import PaginationBar from "../components/PaginationBar";
import TableShell from "../ui/TableShell";
import Btn from "../ui/Btn";
import { Field, Input, Select } from "../ui/inputs";

const LIMIT = 25;
const ROLE_ECRITURE = ["ADMIN", "SUPER_ADMIN"];
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// L'export CSV extrait des données : réservé aux rôles à écriture (un LECTEUR
// consulte l'écran, il n'exporte pas). Le serveur applique la même règle.
function peutEcrire() {
  return ROLE_ECRITURE.includes(getAdmin()?.role);
}

function dateDuJour(decalageJours = 0) {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

function formatDateHeure(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoriquePage() {
  const [pointages, setPointages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [erreurOuvriers, setErreurOuvriers] = useState(null);
  const [exportEnCours, setExportEnCours] = useState(false);

  const [du, setDu] = useState(dateDuJour(-7));
  const [au, setAu] = useState(dateDuJour(0));
  const [ouvrierId, setOuvrierId] = useState("");
  const [ouvriers, setOuvriers] = useState([]);
  const [jourSemaine, setJourSemaine] = useState("");

  const chargerOuvriers = useCallback(() => {
    setErreurOuvriers(null);
    api
      .getOuvriers({ limit: 2000 })
      .then((data) => setOuvriers(data.ouvriers))
      .catch(() => setErreurOuvriers("La liste des ouvriers du filtre n'a pas pu être chargée."));
  }, []);

  useEffect(() => {
    chargerOuvriers();
  }, [chargerOuvriers]);

  // Filtres communs à l'affichage et à l'export. Le jour de la semaine est
  // appliqué en base : il vaut pour toutes les pages, pas seulement la page affichée.
  const filtres = useCallback(() => {
    const params = { du, au };
    if (ouvrierId) params.ouvrierId = ouvrierId;
    if (jourSemaine !== "") params.jourSemaine = jourSemaine;
    return params;
  }, [du, au, ouvrierId, jourSemaine]);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      // Tri chronologique : le plus récent d'abord.
      const data = await api.getPointages({ ...filtres(), page, limit: LIMIT, ordre: "date" });
      setPointages(data.pointages);
      setTotal(data.total);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, [filtres, page]);

  useEffect(() => {
    charger();
  }, [charger]);

  function handleFiltrer(e) {
    e.preventDefault();
    setPage(1);
    charger();
  }

  // Export de TOUTE la période filtrée, généré par le serveur.
  async function handleExporterCsv() {
    setExportEnCours(true);
    setErreur(null);
    try {
      const blob = await api.getPointagesExportBlob(filtres());
      telechargerBlob(blob, `historique-pointages_${du}_a_${au}.csv`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "L'export a échoué. Réessayez.");
    } finally {
      setExportEnCours(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-bordeaux-900">
          {total} pointage(s) sur la période
        </h2>
        {peutEcrire() && (
          <Btn
            variant="secondary"
            onClick={handleExporterCsv}
            disabled={total === 0 || exportEnCours}
            icon={<Download size={16} />}
          >
            {exportEnCours ? "Export en cours…" : "Exporter la période en CSV"}
          </Btn>
        )}
      </div>

      {erreur && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 text-sm text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-3 py-2"
          role="alert"
        >
          <span>{erreur}</span>
          <Btn variant="secondary" size="sm" onClick={charger}>
            Réessayer
          </Btn>
        </div>
      )}
      {erreurOuvriers && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
          role="alert"
        >
          <span>{erreurOuvriers}</span>
          <Btn variant="secondary" size="sm" onClick={chargerOuvriers}>
            Réessayer
          </Btn>
        </div>
      )}

      <form
        onSubmit={handleFiltrer}
        className="flex flex-wrap items-end gap-2 bg-white border border-slate-200 rounded-xl p-3"
      >
        <Field label="Du">
          <Input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
        </Field>
        <Field label="Au">
          <Input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
        </Field>
        <Field label="Ouvrier" className="flex-1 min-w-[180px]">
          <Select value={ouvrierId} onChange={(e) => setOuvrierId(e.target.value)}>
            <option value="">Tous les ouvriers</option>
            {ouvriers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.prenom} {o.nom} — {o.matricule}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Jour de la semaine">
          <Select
            value={jourSemaine}
            onChange={(e) => {
              setJourSemaine(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous les jours</option>
            {JOURS.map((nom, index) => (
              <option key={index} value={index}>
                {nom}
              </option>
            ))}
          </Select>
        </Field>
        <Btn type="submit">Filtrer</Btn>
      </form>

      <TableShell
        colonnes={["Date / heure", "Matricule", "Nom", "Prénom", "Département"]}
        chargement={chargement}
        vide="Aucun pointage sur cette période"
      >
        {pointages.map((p) => (
          <tr key={p.id} className="border-t border-slate-100 hover:bg-bordeaux-50/40 transition-colors">
            <td className="px-3 py-2 text-xs">{formatDateHeure(p.dateHeure)}</td>
            <td className="px-3 py-2 font-mono text-xs">{p.ouvrier?.matricule}</td>
            <td className="px-3 py-2">{p.ouvrier?.nom}</td>
            <td className="px-3 py-2">{p.ouvrier?.prenom}</td>
            <td className="px-3 py-2">{libelleDepartement(p.ouvrier)}</td>
          </tr>
        ))}
      </TableShell>

      <PaginationBar page={page} totalPages={totalPages} onPage={setPage} total={total} label="pointage(s)" />
    </div>
  );
}
