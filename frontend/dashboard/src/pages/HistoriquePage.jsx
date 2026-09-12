import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../lib/api";
import { telechargerBlob } from "../lib/download";
import { libelleDepartement } from "../lib/departement";
import { getAdmin } from "../lib/auth";
import PaginationBar from "../components/PaginationBar";
import TableShell from "../ui/TableShell";
import Btn from "../ui/Btn";
import { Field, Input, Select } from "../ui/inputs";

const LIMIT = 17;
const ROLE_ECRITURE = ["ADMIN", "SUPER_ADMIN"];
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// L'export CSV extrait des données : réservé aux rôles à écriture (un LECTEUR
// consulte l'écran, il n'exporte pas).
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

function csvValeur(v) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function HistoriquePage() {
  const [pointages, setPointages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [du, setDu] = useState(dateDuJour(-7));
  const [au, setAu] = useState(dateDuJour(0));
  const [ouvrierId, setOuvrierId] = useState("");
  const [ouvriers, setOuvriers] = useState([]);
  const [jourSemaine, setJourSemaine] = useState("");

  useEffect(() => {
    api
      .getOuvriers({ limit: 500 })
      .then((data) => setOuvriers(data.ouvriers))
      .catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const params = { du, au, page, limit: LIMIT };
      if (ouvrierId) params.ouvrierId = ouvrierId;
      const data = await api.getPointages(params);
      setPointages(data.pointages);
      setTotal(data.total);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, [du, au, ouvrierId, page]);

  useEffect(() => {
    charger();
  }, [charger]);

  function handleFiltrer(e) {
    e.preventDefault();
    setPage(1);
    charger();
  }

  function handleExporterCsv() {
    const entete = ["Date/heure", "Matricule", "Nom", "Prénom", "Département"];
    const lignes = pointages.map((p) =>
      [
        formatDateHeure(p.dateHeure),
        p.ouvrier?.matricule,
        p.ouvrier?.nom,
        p.ouvrier?.prenom,
        libelleDepartement(p.ouvrier),
      ]
        .map(csvValeur)
        .join(";")
    );
    const csv = "\uFEFF" + [entete.join(";"), ...lignes].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    telechargerBlob(blob, `historique-pointages_${du}_a_${au}_page${page}.csv`);
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const pointagesAffiches =
    jourSemaine === ""
      ? pointages
      : pointages.filter((p) => new Date(p.dateHeure).getDay() === Number(jourSemaine));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-bordeaux-900">
          {pointagesAffiches.length} pointage(s) affiché(s) sur {total}
        </h2>
        {peutEcrire() && (
          <Btn
            variant="secondary"
            onClick={handleExporterCsv}
            disabled={pointages.length === 0}
            icon="⬇"
          >
            Exporter cette page en CSV
          </Btn>
        )}
      </div>

      {erreur && (
        <p className="text-sm text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-3 py-2">
          {erreur}
        </p>
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
          <Select value={jourSemaine} onChange={(e) => setJourSemaine(e.target.value)}>
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
        {pointagesAffiches.map((p) => (
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