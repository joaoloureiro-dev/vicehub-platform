-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('premium');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('manual', 'stripe');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "crewId" TEXT,
    "serverId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'premium',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "provider" "SubscriptionProvider" NOT NULL DEFAULT 'manual',
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "provider_customer_id" TEXT,
    "provider_subscription_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "Subscription_crewId_status_idx" ON "Subscription"("crewId", "status");

-- CreateIndex
CREATE INDEX "Subscription_serverId_status_idx" ON "Subscription"("serverId", "status");

-- CreateIndex
CREATE INDEX "Subscription_status_current_period_end_idx" ON "Subscription"("status", "current_period_end");

-- CreateIndex
CREATE INDEX "Subscription_is_deleted_idx" ON "Subscription"("is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_provider_provider_subscription_id_key" ON "Subscription"("provider", "provider_subscription_id");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrições de integridade que o Prisma não sabe exprimir no schema.
-- Sem elas, uma subscrição podia ficar sem dono, com dois donos, ou com um
-- período invertido, e nada na base de dados o impediria.

-- Exatamente um dono: utilizador, crew ou servidor.
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_single_owner_check"
CHECK (
    (("userId" IS NOT NULL)::int + ("crewId" IS NOT NULL)::int + ("serverId" IS NOT NULL)::int) = 1
);

-- O fim do período tem de ser posterior ao início.
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_period_order_check"
CHECK ("current_period_end" > "current_period_start");

-- Um preço negativo nunca é válido.
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_price_non_negative_check"
CHECK ("price_cents" >= 0);
