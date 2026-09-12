-- Anti double-badgeage : un ouvrier ne peut badger qu'une fois par jour civil (UTC).
-- La règle devient atomique en base : deux requêtes simultanées ne peuvent pas
-- créer deux pointages (la seconde reçoit une erreur P2002 côté Prisma).

ALTER TABLE "Pointage" ADD COLUMN "jour" DATE;

-- Backfill : le jour (UTC) tel qu'enregistré dans dateHeure.
UPDATE "Pointage" SET "jour" = ("dateHeure" AT TIME ZONE 'UTC')::date;

ALTER TABLE "Pointage" ALTER COLUMN "jour" SET NOT NULL;

ALTER TABLE "Pointage"
  ADD CONSTRAINT "Pointage_ouvrierId_jour_key" UNIQUE ("ouvrierId", "jour");