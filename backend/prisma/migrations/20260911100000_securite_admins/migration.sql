-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bloqueJusqua" TIMESTAMP(3),
ADD COLUMN     "resetTokenExpire" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT,
ADD COLUMN     "tentativesEchouees" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Admin_resetTokenHash_key" ON "Admin"("resetTokenHash");