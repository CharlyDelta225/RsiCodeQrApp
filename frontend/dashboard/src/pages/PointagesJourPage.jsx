import { useEffect, useState, useCallback, useRef } from "react";
import { api, ApiError } from "../lib/api";
import { libelleDepartement } from "../lib/departement";
import { usePagination } from "../lib/pagination";
import PaginationBar from "../components/PaginationBar";
import TableShell from "../ui/TableShell";
import Btn from "../ui/Btn";
import { Field, Input, Select } from "../ui/inputs";

const INTERVALLE_ACTUALISATION_MS = 15000;

function dateDuJour(decalageJours = 0) {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

function formatHeure(iso) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function PointagesJourPage() {
  const [pointages, setPointages] = useState([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [derniereMaj, setDerniereMaj] = useState(null);
  const premierChargement = useRef(true);

  const [du, setDu] = useState(dateDuJour(0));
  const [au, setAu] = useState(dateDuJour(0));
  const [ouvrierId, setOuvrierId] = useState("");
  const [ouvriers, setOuvriers] = useState([]);

  const pagination = usePagination(pointages);

  useEffect(() => {
    api
      .getOuvriers({ limit: 500 })
      .then((data) => setOuvriers(data.ouvriers))
      .catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    if (premierChargement.current) setChargement(true);
    setErreur(null);
    try {
      const params = { du, au, limit: 200 };
      if (ouvrierId) params.ouvrierId = ouvrierId;
      const data = await api.getPointages(params);
      setPointages(data.pointages);
      setTotal(data.total);
      setDerniereMaj(new Date());
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur de chargement");
    } finally {
      setChargement(false);
      premierChargement.current = false;
    }
  }, [du, au, ouvrierId]);

  useEffect(() => {
    charger();
    const intervalle = setInterval(charger, INTERVALLE_ACTUALISATION_MS);
    return () => clearInterval(intervalle);
  }, [charger]);

  function handleFiltrer(e) {
    e.preventDefault();
    charger();
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-bordeaux-900">
            {total} pointage(s) sur la période
          </h2>
          {derniereMaj && (
            <p className="text-xs text-slate-400">
              Actualisé à {derniereMaj.toLocaleTimeString("fr-FR")} · rafraîchissement automatique toutes les 15s
            </p>
          )}
        </div>
        <Btn variant="secondary" onClick={charger} icon="↻">
          Actualiser
        </Btn>
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
        <Btn type="submit">Filtrer</Btn>
      </form>

      <TableShell
        colonnes={["Heure", "Matricule", "Nom", "Prénom", "Département"]}
        chargement={chargement}
        vide="Aucun pointage sur cette période"
      >
        {pagination.elementsPage.map((p) => (
          <tr key={p.id} className="border-t border-slate-100 hover:bg-bordeaux-50/40 transition-colors">
            <td className="px-3 py-2 font-mono text-xs">{formatHeure(p.dateHeure)}</td>
            <td className="px-3 py-2 font-mono text-xs">{p.ouvrier?.matricule}</td>
            <td className="px-3 py-2">{p.ouvrier?.nom}</td>
            <td className="px-3 py-2">{p.ouvrier?.prenom}</td>
            <td className="px-3 py-2">{libelleDepartement(p.ouvrier)}</td>
          </tr>
        ))}
      </TableShell>

      <PaginationBar
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPage={pagination.setPage}
        total={pointages.length}
        label="pointage(s)"
      />
    </div>
  );
}