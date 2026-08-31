/*
  Warnings:

  - You are about to drop the column `role` on the `Membership` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('pending', 'active', 'rejected', 'left');

-- AlterTable
ALTER TABLE "Membership" DROP COLUMN "role",
ADD COLUMN     "responded_at" TIMESTAMP(3),
ADD COLUMN     "responded_by" TEXT,
ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "Membership_status_idx" ON "Membership"("status");

-- CreateIndex
CREATE INDEX "Membership_crewId_status_idx" ON "Membership"("crewId", "status");

-- Restrições de integridade que o Prisma não sabe exprimir no schema.

-- O tipo de adesão tem de bater certo com a entidade preenchida: uma adesão
-- a uma crew aponta para uma crew e não para um servidor.
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_owner_matches_type_check"
CHECK (
    ("type" = 'crew'::"MembershipType"   AND "crewId" IS NOT NULL AND "serverId" IS NULL) OR
    ("type" = 'server'::"MembershipType" AND "serverId" IS NOT NULL AND "crewId" IS NULL) OR
    ("type" = 'user'::"MembershipType"   AND "crewId" IS NULL AND "serverId" IS NULL)
);

-- Um utilizador não pode ter dois pedidos ou duas adesões em vigor na mesma
-- crew. Os estados terminais ficam de fora do índice, para que sair e voltar
-- a entrar continue a ser possível e o histórico se mantenha.
CREATE UNIQUE INDEX "Membership_one_open_per_crew"
ON "Membership" ("userId", "crewId")
WHERE "crewId" IS NOT NULL
  AND "is_deleted" = false
  AND "status" IN ('pending'::"MembershipStatus", 'active'::"MembershipStatus");

CREATE UNIQUE INDEX "Membership_one_open_per_server"
ON "Membership" ("userId", "serverId")
WHERE "serverId" IS NOT NULL
  AND "is_deleted" = false
  AND "status" IN ('pending'::"MembershipStatus", 'active'::"MembershipStatus");
