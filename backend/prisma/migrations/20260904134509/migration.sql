/*
  Warnings:

  - You are about to drop the column `departement` on the `Ouvrier` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RoleDepartement" AS ENUM ('RESPONSABLE', 'ADJOINT', 'SECRETAIRE', 'MEMBRE');

-- AlterTable
ALTER TABLE "Ouvrier" DROP COLUMN "departement";

-- CreateTable
CREATE TABLE "Departement" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Departement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OuvrierDepartement" (
    "id" TEXT NOT NULL,
    "ouvrierId" TEXT NOT NULL,
    "departementId" TEXT NOT NULL,
    "roleDansDepartement" "RoleDepartement" NOT NULL DEFAULT 'MEMBRE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OuvrierDepartement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Departement_nom_key" ON "Departement"("nom");

-- CreateIndex
CREATE INDEX "OuvrierDepartement_departementId_idx" ON "OuvrierDepartement"("departementId");

-- CreateIndex
CREATE UNIQUE INDEX "OuvrierDepartement_ouvrierId_departementId_key" ON "OuvrierDepartement"("ouvrierId", "departementId");

-- AddForeignKey
ALTER TABLE "OuvrierDepartement" ADD CONSTRAINT "OuvrierDepartement_ouvrierId_fkey" FOREIGN KEY ("ouvrierId") REFERENCES "Ouvrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OuvrierDepartement" ADD CONSTRAINT "OuvrierDepartement_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
