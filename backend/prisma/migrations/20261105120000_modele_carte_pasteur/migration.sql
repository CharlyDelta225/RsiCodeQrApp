-- Modèle de carte par département : vide = « Département NOM », 'TITRE' = titre seul (PASTEUR).
ALTER TABLE "Departement" ADD COLUMN "modeleCarte" TEXT;

-- Cartes des pasteurs : titre seul sur bande bleue en dégradé (couleur relevée sur la carte PASTEUR).
UPDATE "Departement" SET "modeleCarte" = 'TITRE' WHERE "nom" = 'PASTEUR';
UPDATE "Departement" SET "couleur" = '#0181B0' WHERE "nom" = 'PASTEUR' AND "couleur" IS NULL;
