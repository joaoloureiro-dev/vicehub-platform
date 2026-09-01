-- Divisões de ganhos pelos membros.
--
-- Uma divisão agrupa as suas linhas para que se aprove a divisão inteira e
-- não cada movimento à parte: aprovar metade das linhas deixaria a
-- tesouraria num estado que ninguém decidiu.

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('pending', 'approved', 'rejected', 'canceled');
CREATE TYPE "DistributionBasis" AS ENUM ('equal', 'manual', 'assisted');

-- CreateTable
CREATE TABLE "Distribution" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "total" BIGINT NOT NULL,
    "basis" "DistributionBasis" NOT NULL,
    "status" "DistributionStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "requested_by" TEXT,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "Distribution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Distribution_walletId_idx" ON "Distribution"("walletId");
CREATE INDEX "Distribution_status_idx" ON "Distribution"("status");
CREATE INDEX "Distribution_walletId_status_idx" ON "Distribution"("walletId", "status");
CREATE INDEX "Distribution_created_at_idx" ON "Distribution"("created_at" DESC);

ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Dividir zero, ou um valor negativo, não é dividir nada.
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_total_positive_check"
    CHECK ("total" > 0);

-- Tal como nos movimentos: uma divisão decidida diz sempre quem a decidiu
-- e quando.
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_decision_complete_check"
    CHECK (
        "status" IN ('pending'::"DistributionStatus", 'canceled'::"DistributionStatus")
        OR ("decided_at" IS NOT NULL AND "decided_by" IS NOT NULL)
    );

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "distributionId" TEXT;

CREATE INDEX "Transaction_distributionId_idx" ON "Transaction"("distributionId");

-- RESTRICT e não CASCADE: apagar uma divisão não pode fazer desaparecer os
-- movimentos que ela já produziu. O histórico financeiro não se apaga.
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_distributionId_fkey"
    FOREIGN KEY ("distributionId") REFERENCES "Distribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
