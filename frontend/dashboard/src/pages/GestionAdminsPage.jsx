import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { getAdmin } from "../lib/auth";
import ConfirmDialog from "../components/ConfirmDialog";
import Btn from "../ui/Btn";
import { Input, Select } from "../ui/inputs";
import { C } from "../theme";

const ROLES = [
  { valeur: "SUPER_ADMIN", libelle: "Super admin", couleur: "text-gold-800 bg-gold-50 ring-1 ring-gold-200" },
  { valeur: "ADMIN", libelle: "Admin", couleur: "text-sky-700 bg-sky-50 ring-1 ring-sky-200" },
  { valeur: "LECTEUR", libelle: "Lecteur", couleur: "text-slate-600 bg-slate-100 ring-1 ring-slate-200" },
];

const SUJETS = {
  create: { titre: "Créer un compte", message: "Un mot de passe temporaire sera généré et envoyé par email." },
  reinit: { titre: "Réinitialiser le mot de passe", message: "Un nouveau mot de passe temporaire sera généré et envoyé par email." },
  delete: { titre: "Supprimer ce compte", message: "Le compte sera définitivement supprimé. Cette action est irréversible." },
  desactiver: { titre: "Désactiver ce compte", message: "Le compte ne pourra plus se connecter. Vous pourrez le réactiver à tout moment." },
};

function libelleRole(role) {
  return ROLES.find((r) => r.valeur === role)?.libelle || role;
}

function couleurRole(role) {
  return ROLES.find((r) => r.valeur === role)?.couleur || "bg-slate-100 text-slate-600";
}

function Statut({ admin }) {
  if (!admin.actif) {
    return <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">Désactivé</span>;
  }
  if (admin.bloqueJusqua) {
    const fin = new Date(admin.bloqueJusqua);
    const texte = fin > new Date()
      ? `Bloqué jusqu'à ${fin.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
      : "Bloqué";
    return <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">{texte}</span>;
  }
  return <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Actif</span>;
}

function initials(email) {
  if (!email) return "?";
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

/** Boutons d'action d'un compte — partagés entre tableau (desktop) et cartes (mobile). */
function ActionsCompte({ admin, moiMeme, onAction }) {
  const boutons = [];
  if (admin.bloqueJusqua) {
    boutons.push(
      <button
        key="debloquer"
        onClick={() => onAction("debloquer", admin)}
        className="text-xs px-2 py-1 rounded-lg bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100 transition-colors"
      >
        Débloquer
      </button>
    );
  }
  if (!admin.actif) {
    boutons.push(
      <button
        key="activer"
        onClick={() => onAction("activer", admin)}
        className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-colors"
      >
        Réactiver
      </button>
    );
  }
  boutons.push(
    <button
      key="reinit"
      onClick={() => onAction("reinit", admin)}
      className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors"
    >
      Réinit. mot de passe
    </button>
  );
  if (admin.actif) {
    boutons.push(
      <button
        key="desactiver"
        disabled={moiMeme}
        title={moiMeme ? "Impossible sur votre propre compte" : undefined}
        onClick={() => onAction("desactiver", admin)}
        className="text-xs px-2 py-1 rounded-lg ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
      >
        Désactiver
      </button>
    );
  }
  boutons.push(
    <button
      key="delete"
      disabled={moiMeme}
      title={moiMeme ? "Impossible sur votre propre compte" : undefined}
      onClick={() => onAction("delete", admin)}
      className="text-xs px-2 py-1 rounded-lg bg-bordeaux-50 text-bordeaux-700 ring-1 ring-bordeaux-200 hover:bg-bordeaux-100 disabled:opacity-40 transition-colors"
    >
      Supprimer
    </button>
  );
  return boutons;
}

/** Selecteur de rôle — remplace par une pastille quand c'est le compte connecté. */
function SelecteurRole({ admin, moiMeme, surChangement }) {
  if (moiMeme) {
    return <span className={`text-xs px-2 py-1 rounded-full ${couleurRole(admin.role)}`}>{libelleRole(admin.role)}</span>;
  }
  return (
    <select
      value={admin.role}
      onChange={(e) => surChangement(admin, e.target.value)}
      className="text-xs rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-2"
      style={{ "--tw-ring-color": "#D4A017" }}
    >
      {ROLES.map((r) => (
        <option key={r.valeur} value={r.valeur}>
          {r.libelle}
        </option>
      ))}
    </select>
  );
}

export default function GestionAdminsPage() {
  const moi = getAdmin();

  const [admins, setAdmins] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [alerte, setAlerte] = useState(null);
  const [succes, setSucces] = useState(null);

  const [modalOuvert, setModalOuvert] = useState(false);
  const [form, setForm] = useState({ email: "", role: "ADMIN" });
  const [envoi, setEnvoi] = useState(false);

  const [confirm, setConfirm] = useState(null); // { type, admin }
  const [mdpTemporaire, setMdpTemporaire] = useState(null); // { email, motDePasse }

  const charger = async () => {
    setChargement(true);
    setAlerte(null);
    try {
      const data = await api.getAdmins();
      setAdmins(data.admins || []);
    } catch (err) {
      setAlerte({ titre: "Erreur de chargement", message: err instanceof ApiError ? err.message : "Impossible de charger les comptes" });
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  async function handleCreer(e) {
    e.preventDefault();
    setEnvoi(true);
    setAlerte(null);
    setMdpTemporaire(null);
    try {
      const data = await api.creerAdmin(form.email.trim(), form.role);
      setModalOuvert(false);
      setForm({ email: "", role: "ADMIN" });
      await charger();
      if (data.emailEnvoye === false) {
        setMdpTemporaire({ email: data.admin.email, motDePasse: data.motDePasseTemporaire });
        setAlerte({
          titre: "Email non envoyé",
          message: "L'email n'a pas pu partir. Transmettez le mot de passe temporaire ci-dessous.",
        });
      } else {
        setSucces({ titre: "Compte créé", message: `Le mot de passe a été envoyé à ${data.admin.email}.` });
      }
    } catch (err) {
      setAlerte({ titre: "Échec de la création", message: err.message || "La création du compte a échoué" });
    } finally {
      setEnvoi(false);
    }
  }

  async function changerRole(admin, role) {
    setAlerte(null);
    try {
      await api.changerRoleAdmin(admin.id, role);
      setSucces({ titre: "Rôle modifié", message: `${admin.email} est désormais ${libelleRole(role)}.` });
      await charger();
    } catch (err) {
      setAlerte({ titre: "Échec", message: err.message || "Impossible de changer le rôle" });
    }
  }

  async function executerConfirm() {
    if (!confirm) return;
    const { type, admin } = confirm;

    const actions = {
      desactiver: () => api.desactiverAdmin(admin.id),
      reinit: () => api.reinitialiserMdpAdmin(admin.id),
      delete: () => api.supprimerAdmin(admin.id),
    };

    setAlerte(null);
    setMdpTemporaire(null);
    try {
      const data = await actions[type]();
      if (type === "delete") {
        setSucces({ titre: "Compte supprimé", message: `${admin.email} a bien été supprimé.` });
      } else {
        setSucces({ titre: "Action effectuée", message: `Opération réussie sur ${admin.email}.` });
        if (type === "reinit" && data.emailEnvoye === false) {
          setMdpTemporaire({ email: admin.email, motDePasse: data.motDePasseTemporaire });
          setAlerte({ titre: "Email non envoyé", message: "Transmettez le nouveau mot de passe temporaire ci-dessous." });
        }
      }
      await charger();
    } catch (err) {
      setAlerte({ titre: "Échec", message: err.message || "L'opération a échoué" });
    } finally {
      setConfirm(null);
    }
  }

  // Centralise : action directe (débloquer/activer) ou ouverture d'un confirm.
  function lancerAction(type, admin) {
    setAlerte(null);
    setMdpTemporaire(null);
    if (type === "debloquer") {
      debloquer(admin);
      return;
    }
    if (type === "activer") {
      activer(admin);
      return;
    }
    setConfirm({ type, admin });
  }

  async function debloquer(admin) {
    setAlerte(null);
    try {
      await api.debloquerAdmin(admin.id);
      setSucces({ titre: "Compte débloqué", message: `${admin.email} peut de nouveau se connecter.` });
      await charger();
    } catch (err) {
      setAlerte({ titre: "Échec", message: err.message || "Impossible de débloquer le compte" });
    }
  }

  async function activer(admin) {
    setAlerte(null);
    try {
      await api.activerAdmin(admin.id);
      setSucces({ titre: "Compte réactivé", message: `${admin.email} peut de nouveau se connecter.` });
      await charger();
    } catch (err) {
      setAlerte({ titre: "Échec", message: err.message || "Impossible de réactiver le compte" });
    }
  }

  const estMoi = (a) => a.id === moi?.id;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-slate-600">
            Création et gestion des comptes. Un mot de passe temporaire est envoyé par email à chaque création.
          </p>
        </div>
        <button
          className="text-sm font-semibold text-white px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ background: C.btn }}
          onClick={() => {
            setMdpTemporaire(null);
            setAlerte(null);
            setModalOuvert(true);
          }}
        >
          + Nouveau compte
        </button>
      </div>

      {alerte && (
        <div className="text-sm text-bordeaux-700 bg-bordeaux-50 border border-bordeaux-200 rounded-lg px-4 py-3">
          <p className="font-semibold">{alerte.titre}</p>
          <p className="mt-0.5">{alerte.message}</p>
          {mdpTemporaire && (
            <div className="mt-3 p-3 rounded-lg bg-white ring-1 ring-bordeaux-200">
              <p className="text-xs text-slate-500 mb-1">Mot de passe temporaire pour {mdpTemporaire.email} :</p>
              <code className="text-sm font-mono font-semibold break-all">{mdpTemporaire.motDePasse}</code>
            </div>
          )}
        </div>
      )}

      {succes && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <p className="font-semibold">{succes.titre}</p>
          <p className="mt-0.5">{succes.message}</p>
        </div>
      )}

      {chargement ? (
        <p className="text-sm text-slate-400 text-center py-8">Chargement…</p>
      ) : (
        <>
          {/* ─── CARTES MOBILE (<md) ─── */}
          <div className="md:hidden space-y-3">
            {admins.map((a) => {
              const moiMeme = estMoi(a);
              return (
                <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: C.avatar }}
                    >
                      {initials(a.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {a.email} {moiMeme && <span className="text-[10px] uppercase text-slate-400">(vous)</span>}
                      </p>
                      {a.tentativesEchouees > 0 && !a.bloqueJusqua && (
                        <p className="text-[11px] text-orange-600">
                          {a.tentativesEchouees}/3 tentative(s) échouée(s)
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <SelecteurRole admin={a} moiMeme={moiMeme} surChangement={changerRole} />
                    <Statut admin={a} />
                    <span className="text-[11px] text-slate-400">
                      Créé le {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                    <ActionsCompte admin={a} moiMeme={moiMeme} onAction={lancerAction} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── TABLEAU DESKTOP (≥md) ─── */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Compte</th>
                  <th className="px-4 py-3 font-medium">Rôle</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Créé le</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => {
                  const moiMeme = estMoi(a);
                  return (
                    <tr key={a.id} className="border-b border-slate-100 last:border-b-0 align-middle">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">
                          {a.email} {moiMeme && <span className="text-[10px] uppercase text-slate-400">(vous)</span>}
                        </p>
                        {a.tentativesEchouees > 0 && !a.bloqueJusqua && (
                          <p className="text-[11px] text-orange-600">
                            {a.tentativesEchouees}/3 tentative(s) échouée(s)
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SelecteurRole admin={a} moiMeme={moiMeme} surChangement={changerRole} />
                      </td>
                      <td className="px-4 py-3">
                        <Statut admin={a} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <ActionsCompte admin={a} moiMeme={moiMeme} onAction={lancerAction} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalOuvert && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreer}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
          >
            <h2 className="font-semibold text-slate-800 text-sm" style={{ fontFamily: "Poppins,sans-serif" }}>
              Nouveau compte admin
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="prenom.nom@exemple.ci"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rôle</label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r.valeur} value={r.valeur}>
                    {r.libelle}
                  </option>
                ))}
              </Select>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Un mot de passe temporaire sera généré et envoyé par email au compte créé.
            </p>

            <div className="flex items-center justify-end gap-3">
              <Btn variant="secondary" onClick={() => setModalOuvert(false)} disabled={envoi}>
                Annuler
              </Btn>
              <Btn type="submit" loading={envoi}>
                {envoi ? "Création…" : "Créer le compte"}
              </Btn>
            </div>
          </form>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          ouvert
          titre={SUJETS[confirm.type].titre}
          message={`${SUJETS[confirm.type].message} (${confirm.admin.email})`}
          bouton={confirm.type === "delete" ? "Supprimer" : confirm.type === "desactiver" ? "Désactiver" : "Réinitialiser"}
          surAnnuler={() => setConfirm(null)}
          surConfirmer={executerConfirm}
        />
      )}
    </div>
  );
}