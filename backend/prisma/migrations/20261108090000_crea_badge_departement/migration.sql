-- Créa importée par département : fond de ses cartes de badge.
CREATE TABLE "CreaBadge" (
    "departementId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "donnees" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreaBadge_pkey" PRIMARY KEY ("departementId")
);

ALTER TABLE "CreaBadge" ADD CONSTRAINT "CreaBadge_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
