-- Carte de badge : couleur des départements, district des temples, fonction
-- imprimée, photo des ouvriers et suivi des cartes confectionnées.

ALTER TABLE "Eglise" ADD COLUMN "libelleCarte" TEXT;
ALTER TABLE "Departement" ADD COLUMN "couleur" TEXT;
ALTER TABLE "OuvrierDepartement" ADD COLUMN "fonctionCarte" TEXT;

CREATE TABLE "PhotoOuvrier" (
    "ouvrierId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "donnees" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PhotoOuvrier_pkey" PRIMARY KEY ("ouvrierId")
);

CREATE TABLE "BadgeConfectionne" (
    "id" TEXT NOT NULL,
    "ouvrierId" TEXT NOT NULL,
    "departementId" TEXT NOT NULL,
    "adminEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BadgeConfectionne_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BadgeConfectionne_ouvrierId_idx" ON "BadgeConfectionne"("ouvrierId");
CREATE INDEX "BadgeConfectionne_departementId_idx" ON "BadgeConfectionne"("departementId");

ALTER TABLE "PhotoOuvrier" ADD CONSTRAINT "PhotoOuvrier_ouvrierId_fkey"
    FOREIGN KEY ("ouvrierId") REFERENCES "Ouvrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BadgeConfectionne" ADD CONSTRAINT "BadgeConfectionne_ouvrierId_fkey"
    FOREIGN KEY ("ouvrierId") REFERENCES "Ouvrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BadgeConfectionne" ADD CONSTRAINT "BadgeConfectionne_departementId_fkey"
    FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- District imprimé sur la carte, modifiable ensuite par un SUPER_ADMIN.
UPDATE "Eglise" SET "libelleCarte" = 'DISTRICT-SIÈGE' WHERE "id" = 'eglise-shalom';
UPDATE "Eglise" SET "libelleCarte" = 'DISTRICT ADJAHUI' WHERE "id" = 'eglise-adjahui';
UPDATE "Eglise" SET "libelleCarte" = 'DISTRICT 4 CROIX' WHERE "id" = 'eglise-quatre-croix';

-- Premier département de la maquette : HUISSIER (couleur relevée sur la carte d'origine).
-- Les autres départements restent sans couleur : un admin les fixe lui-même.
UPDATE "Departement" SET "couleur" = '#BD175C' WHERE "nom" = 'HUISSIER';
