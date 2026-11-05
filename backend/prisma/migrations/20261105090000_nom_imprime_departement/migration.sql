-- Nom imprimé sur la carte de badge, quand il diffère du nom du département.
ALTER TABLE "Departement" ADD COLUMN "libelleCarte" TEXT;

-- Les cartes du département TROMPETTE portent « CHANTRE » ; SÉCURITÉ s'écrit avec ses accents.
UPDATE "Departement" SET "libelleCarte" = 'CHANTRE' WHERE "nom" = 'TROMPETTE';
UPDATE "Departement" SET "libelleCarte" = 'SÉCURITÉ' WHERE "nom" = 'SECURITE';
