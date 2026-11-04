-- Temples (églises locales) : SHALOM (siège), ADJAHUI, 4 CROIX.
-- Toutes les données existantes appartiennent au siège SHALOM : les colonnes
-- egliseId reçoivent "eglise-shalom" par défaut, y compris pour les lignes
-- déjà présentes (ADD COLUMN ... DEFAULT remplit l'existant).

CREATE TABLE "Eglise" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "estSiege" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Eglise_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Eglise_code_key" ON "Eglise"("code");
CREATE UNIQUE INDEX "Eglise_nom_key" ON "Eglise"("nom");

INSERT INTO "Eglise" ("id", "code", "nom", "estSiege") VALUES
    ('eglise-shalom', 'SHALOM', 'Temple SHALOM', true),
    ('eglise-adjahui', 'ADJAHUI', 'Temple ADJAHUI', false),
    ('eglise-quatre-croix', 'QUATRE_CROIX', 'Temple de 4 CROIX', false);

-- Départements : rattachés au siège ; le nom devient unique PAR temple.
ALTER TABLE "Departement" ADD COLUMN "egliseId" TEXT NOT NULL DEFAULT 'eglise-shalom';
DROP INDEX "Departement_nom_key";
CREATE UNIQUE INDEX "Departement_egliseId_nom_key" ON "Departement"("egliseId", "nom");
CREATE INDEX "Departement_egliseId_idx" ON "Departement"("egliseId");
ALTER TABLE "Departement" ADD CONSTRAINT "Departement_egliseId_fkey" FOREIGN KEY ("egliseId") REFERENCES "Eglise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ouvriers : tous du siège SHALOM.
ALTER TABLE "Ouvrier" ADD COLUMN "egliseId" TEXT NOT NULL DEFAULT 'eglise-shalom';
CREATE INDEX "Ouvrier_egliseId_idx" ON "Ouvrier"("egliseId");
ALTER TABLE "Ouvrier" ADD CONSTRAINT "Ouvrier_egliseId_fkey" FOREIGN KEY ("egliseId") REFERENCES "Eglise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Pointages : lieu du badgeage. Le seul terminal existant était au siège.
ALTER TABLE "Pointage" ADD COLUMN "egliseId" TEXT;
UPDATE "Pointage" SET "egliseId" = 'eglise-shalom';
CREATE INDEX "Pointage_egliseId_jour_idx" ON "Pointage"("egliseId", "jour");
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_egliseId_fkey" FOREIGN KEY ("egliseId") REFERENCES "Eglise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
