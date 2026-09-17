-- A reputação passa a ter registo, e deixa de ser um número que só se
-- pode acreditar.
--
-- A coluna `User.reputation` já existia e sempre esteve a zero para toda
-- a gente: nada a somava. O que faltava não era a coluna, era o facto
-- por trás de cada ponto.

CREATE TYPE "ReputationReason" AS ENUM ('event_attended', 'event_missed');

CREATE TABLE "ReputationAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "ReputationReason" NOT NULL,
    "eventId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "ReputationAward_pkey" PRIMARY KEY ("id")
);

-- O mesmo evento não mexe duas vezes na reputação da mesma pessoa.
--
-- Um índice e não dois, ao contrário do xp: aqui o dono é sempre uma
-- pessoa, e por isso não há linhas com o utilizador vazio a escapar por
-- entre nulos.
--
-- Sem a razão na chave, de propósito. Um evento tem um desfecho por
-- pessoa: ou apareceu, ou faltou. Deixar a razão de fora é o que impede
-- que o mesmo evento chegue a somar e a tirar à mesma pessoa.
CREATE UNIQUE INDEX "ReputationAward_user_event_key"
    ON "ReputationAward" ("userId", "eventId")
    WHERE "eventId" IS NOT NULL AND "is_deleted" = false;

CREATE INDEX "ReputationAward_userId_created_at_idx"
    ON "ReputationAward" ("userId", "created_at" DESC);

CREATE INDEX "ReputationAward_eventId_idx" ON "ReputationAward" ("eventId");

ALTER TABLE "ReputationAward" ADD CONSTRAINT "ReputationAward_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReputationAward" ADD CONSTRAINT "ReputationAward_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
