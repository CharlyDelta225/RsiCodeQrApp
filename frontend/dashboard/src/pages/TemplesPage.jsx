import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useTemple, TemplePill } from "../lib/temple";
import { useToast } from "../components/Toast";
import Card from "../ui/Card";
import TableShell from "../ui/TableShell";
import Btn from "../ui/Btn";
import Pill from "../ui/Pill";
import { Field, Input } from "../ui/inputs";

// Lien d'installation d'un terminal : la tablette ouverte sur ce lien badge
// pour ce temple (le choix est ensuite mémorisé sur l'appareil).
function lienTerminal(code) {
  return `${window.location.origin}/terminal/?temple=${encodeURIComponent(code)}`;
}

export default function TemplesPage() {
  const { eglises, erreur, recharger } = useTemple();
  const toast = useToast();
  const [nom, setNom] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [edition, setEdition] = useState(null); // { id, nom }

  async function copier(code) {
    const lien = lienTerminal(code);
    try {
      await navigator.clipboard.writeText(lien);
      toast.success("Lien copié", lien);
    } catch {
      toast.error("Copie impossible", `Copiez ce lien à la main : ${lien}`);
    }
  }

  async function executer(action, succes) {
    setEnCours(true);
    try {
      await action();
      await recharger();
      toast.success("Temples", succes);
      return true;
    } catch (err) {
      toast.error("Temples", err instanceof ApiError ? err.message : "L'opération a échoué. Réessayez.");
      return false;
    } finally {
      setEnCours(false);
    }
  }

  async function ajouter(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    if (await executer(() => api.createEglise({ nom: nom.trim() }), `${nom.trim()} ajouté.`)) setNom("");
  }

  async function renommer(e) {
    e.preventDefault();
    if (!edition?.nom.trim()) return;
    if (await executer(() => api.updateEglise(edition.id, { nom: edition.nom.trim() }), "Temple renommé.")) setEdition(null);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {erreur && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-3 py-2" role="alert">
          <span>{erreur}</span>
          <Btn variant="secondary" size="sm" onClick={recharger}>Réessayer</Btn>
        </div>
      )}

      <Card
        title="Temples"
        description="Chaque ouvrier et chaque département appartiennent à un temple. Ouvrez chaque tablette de badgeage sur le lien de son temple."
      >
        <TableShell
          colonnes={["Temple", "Code", "Ouvriers", "Départements", "Présents aujourd'hui", "Terminal"]}
          chargement={eglises.length === 0 && !erreur}
          vide="Aucun temple"
        >
          {eglises.map((e) => (
            <tr key={e.id} className="border-t border-slate-100">
              <td className="px-3 py-2">
                {edition?.id === e.id ? (
                  <form onSubmit={renommer} className="flex items-center gap-2">
                    <Input
                      value={edition.nom}
                      onChange={(ev) => setEdition({ ...edition, nom: ev.target.value })}
                      aria-label="Nouveau nom du temple"
                      autoFocus
                    />
                    <Btn type="submit" size="xs" loading={enCours}>Enregistrer</Btn>
                    <Btn variant="ghost" size="xs" onClick={() => setEdition(null)}>Annuler</Btn>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <TemplePill eglise={e} court={false} />
                    {e.estSiege && <Pill tonalite="or">siège</Pill>}
                    {!e.actif && <Pill tonalite="gris">désactivé</Pill>}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{e.code}</td>
              <td className="px-3 py-2 tabular-nums">{e.ouvriers}</td>
              <td className="px-3 py-2 tabular-nums">{e.departements}</td>
              <td className="px-3 py-2 tabular-nums">
                {e.presentsAuj} / {e.ouvriersActifs}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                  <Btn variant="secondary" size="xs" icon={<Copy size={13} />} onClick={() => copier(e.code)} disabled={!e.actif}>
                    Copier le lien
                  </Btn>
                  {edition?.id !== e.id && (
                    <Btn variant="ghost" size="xs" onClick={() => setEdition({ id: e.id, nom: e.nom })}>
                      Renommer
                    </Btn>
                  )}
                  {!e.estSiege && (
                    <Btn
                      variant="ghost"
                      size="xs"
                      disabled={enCours}
                      onClick={() =>
                        executer(
                          () => api.updateEglise(e.id, { actif: !e.actif }),
                          e.actif ? `${e.nom} désactivé.` : `${e.nom} réactivé.`
                        )
                      }
                    >
                      {e.actif ? "Désactiver" : "Réactiver"}
                    </Btn>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
        <p className="text-[11px] text-slate-500 mt-3">
          Le code du temple figure dans le lien des terminaux : il ne change pas quand le temple est renommé. Un temple
          désactivé n'est plus proposé aux terminaux ni dans les formulaires.
        </p>
      </Card>

      <Card title="Ajouter un temple">
        <form onSubmit={ajouter} className="flex flex-wrap items-end gap-2">
          <Field label="Nom" className="flex-1 min-w-[220px]">
            <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Temple de …" />
          </Field>
          <Btn type="submit" icon={<Plus size={16} />} loading={enCours} disabled={!nom.trim()}>
            Ajouter
          </Btn>
        </form>
      </Card>
    </div>
  );
}
