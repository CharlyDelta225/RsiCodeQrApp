-- CreateEnum
CREATE TYPE "TypePointage" AS ENUM ('ENTRER', 'SORTIR');

-- CreateTable
CREATE TABLE "Ouvrier" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "departement" TEXT NOT NULL,
    "photoUrl" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ouvrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pointage" (
    "id" TEXT NOT NULL,
    "ouvrierId" TEXT NOT NULL,
    "dateHeure" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "TypePointage" NOT NULL DEFAULT 'ENTRER',

    CONSTRAINT "Pointage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ouvrier_matricule_key" ON "Ouvrier"("matricule");

-- CreateIndex
CREATE INDEX "Pointage_ouvrierId_dateHeure_idx" ON "Pointage"("ouvrierId", "dateHeure");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- AddForeignKey
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_ouvrierId_fkey" FOREIGN KEY ("ouvrierId") REFERENCES "Ouvrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
