-- CreateEnum
CREATE TYPE "RoleAdmin" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'LECTEUR');

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "role" "RoleAdmin" NOT NULL DEFAULT 'ADMIN';
