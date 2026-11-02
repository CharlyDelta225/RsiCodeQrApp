-- Nom et prénom (optionnels) sur la table Admin : permettent d'afficher un
-- libellé lisible dans le dashboard au lieu de dériver un nom depuis l'email.
ALTER TABLE "Admin" ADD COLUMN "nom" TEXT;
ALTER TABLE "Admin" ADD COLUMN "prenom" TEXT;
