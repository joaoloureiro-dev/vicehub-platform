-- Fundações da tesouraria.
--
-- Wallet e Transaction existiam no schema desde a migração inicial mas
-- nunca foram usadas por código nenhum e estão vazias, pelo que podem ser
-- corrigidas agora em vez de arrastarem a forma errada para sempre.

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'approved', 'rejected', 'canceled');
CREATE TYPE "TransactionDirection" AS ENUM ('credit', 'debit');
CREATE TYPE "TransactionCategory" AS ENUM ('contribution', 'server_costs', 'marketing', 'event', 'prize', 'service', 'payout', 'other');

-- ---------------------------------------------------------------------
-- Wallet: passa a poder pertencer a um servidor
-- ---------------------------------------------------------------------

ALTER TABLE "Wallet" ADD COLUMN "serverId" TEXT;

CREATE UNIQUE INDEX "Wallet_serverId_key" ON "Wallet"("serverId");
CREATE INDEX "Wallet_serverId_idx" ON "Wallet"("serverId");

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Uma carteira tem exatamente um titular. Sem isto, uma carteira com
-- userId e crewId preenchidos apareceria nas duas tesourarias e o mesmo
-- dinheiro seria contado duas vezes.
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_single_owner_check"
    CHECK (num_nonnulls("userId", "crewId", "serverId") = 1);

-- O saldo liquidado não pode ficar negativo. É uma rede de segurança
-- contra um erro de código esvaziar uma carteira para lá do que tem.
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_balance_non_negative_check"
    CHECK ("balance" >= 0);

-- ---------------------------------------------------------------------
-- Transaction: sentido, rubrica e estado explícitos
-- ---------------------------------------------------------------------

DROP INDEX "Transaction_type_idx";

ALTER TABLE "Transaction" DROP COLUMN "type";

ALTER TABLE "Transaction"
    ADD COLUMN "direction"    "TransactionDirection" NOT NULL,
    ADD COLUMN "category"     "TransactionCategory"  NOT NULL DEFAULT 'other',
    ADD COLUMN "status"       "TransactionStatus"    NOT NULL DEFAULT 'pending',
    ADD COLUMN "requested_by" TEXT,
    ADD COLUMN "decided_by"   TEXT,
    ADD COLUMN "decided_at"   TIMESTAMP(3);

CREATE INDEX "Transaction_category_idx" ON "Transaction"("category");
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");
CREATE INDEX "Transaction_walletId_status_idx" ON "Transaction"("walletId", "status");

-- O montante é sempre positivo: o sentido vive em direction. Um montante
-- negativo com direction 'debit' seria uma entrada disfarçada de saída.
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amount_positive_check"
    CHECK ("amount" > 0);

-- Um movimento aprovado ou recusado tem sempre quem o decidiu e quando.
-- É o que permite auditar uma despesa até a quem a autorizou.
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_decision_complete_check"
    CHECK (
        "status" IN ('pending'::"TransactionStatus", 'canceled'::"TransactionStatus")
        OR ("decided_at" IS NOT NULL AND "decided_by" IS NOT NULL)
    );

-- ---------------------------------------------------------------------
-- AuditLog
-- ---------------------------------------------------------------------

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "SourceType" NOT NULL DEFAULT 'api',

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_actor_id_idx" ON "AuditLog"("actor_id");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_entity_type_entity_id_idx" ON "AuditLog"("entity_type", "entity_id");
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at" DESC);
