import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { getAdmin } from "../lib/auth";
import ConfirmDialog from "../components/ConfirmDialog";
import { C } from "../theme";

const ROLES = [
  { valeur: "SUPER_ADMIN", libelle: "Super admin", couleur: "bg-rose-50 text-rose-700 ring-1 ring-rose-100" },
  { valeur: "ADMIN", libelle: "Admin", couleur: "bg-sky-50 text-sky-700 ring-1 ring-sky-100" },
  { valeur: "LECTEUR", libelle: "Lecteur", couleur: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" },
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
    return <span className="text-xs px-2 py-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-100">Désactivé</span>;
  }
  if (admin.bloqueJusqua) {
    const fin = new Date(admin.bloqueJusqua);
    const texte = fin > new Date()
      ? `Bloqué jusqu'à ${fin.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
      : "Bloqué";
    return <span className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-700 ring-1 ring-orange-100">{texte}</span>;
  }
  return <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">Actif</span>;
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
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="font-semibold">{alerte.titre}</p>
          <p className="mt-0.5">{alerte.message}</p>
          {mdpTemporaire && (
            <div className="mt-3 p-3 rounded-lg bg-white ring-1 ring-red-100">
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
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
                      {moiMeme ? (
                        <span className={`text-xs px-2 py-1 rounded-full ${couleurRole(a.role)}`}>{libelleRole(a.role)}</span>
                      ) : (
                        <select
                          value={a.role}
                          onChange={(e) => changerRole(a, e.target.value)}
                          className="text-xs rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-2"
                          style={{ "--tw-ring-color": "#D4A017" }}
                        >
                          {ROLES.map((r) => (
                            <option key={r.valeur} value={r.valeur}>
                              {r.libelle}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Statut admin={a} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {a.bloqueJusqua && (
                          <button
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100"
                            onClick={() => debloquer(a)}
                          >
                            Débloquer
                          </button>
                        )}
                        {!a.actif && (
                          <button
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                            onClick={() => activer(a)}
                          >
                            Réactiver
                          </button>
                        )}
                        <button
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
                          onClick={() => setConfirm({ type: "reinit", admin: a })}
                        >
                          Réinit. mot de passe
                        </button>
                        {a.actif && (
                          <button
                            className="text-xs px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            disabled={moiMeme}
                            onClick={() => setConfirm({ type: "desactiver", admin: a })}
                            title={moiMeme ? "Impossible sur votre propre compte" : undefined}
                          >
                            Désactiver
                          </button>
                        )}
                        <button
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-40"
                          disabled={moiMeme}
                          onClick={() => setConfirm({ type: "delete", admin: a })}
                          title={moiMeme ? "Impossible sur votre propre compte" : undefined}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": "#D4A017" }}
                placeholder="prenom.nom@exemple.ci"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rôle</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": "#D4A017" }}
              >
                {ROLES.map((r) => (
                  <option key={r.valeur} value={r.valeur}>
                    {r.libelle}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Un mot de passe temporaire sera généré et envoyé par email au compte créé.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOuvert(false)}
                disabled={envoi}
                className="text-sm font-medium text-slate-600 bg-slate-50 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-full px-5 py-2 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={envoi}
                className="text-sm font-medium text-white disabled:opacity-50 rounded-full px-5 py-2 shadow-sm transition"
                style={{ background: C.btn }}
              >
                {envoi ? "Création…" : "Créer le compte"}
              </button>
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