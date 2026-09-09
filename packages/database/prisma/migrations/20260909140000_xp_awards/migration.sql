-- O xp deixa de ser um número que alguém soma e passa a ser uma lista
-- de ganhos.
--
-- A coluna `xp` da crew e do utilizador já existia e continua a ser a
-- soma. O que faltava era saber de onde é que ela veio — e, sobretudo,
-- impedir que o mesmo facto pagasse duas vezes.

CREATE TYPE "XpReason" AS ENUM ('event_completed', 'event_attended');

CREATE TABLE "XpAward" (
    "id"      TEXT NOT NULL,

    "userId"  TEXT,
    "crewId"  TEXT,

    "amount"  INTEGER NOT NULL,
    "reason"  "XpReason" NOT NULL,
    "eventId" TEXT,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version"    INTEGER NOT NULL DEFAULT 1,

    "source"     "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "XpAward_pkey" PRIMARY KEY ("id")
);

-- Um ganho tem um dono, e só um.
--
-- Sem isto, uma linha com os dois vazios era xp que ninguém recebia, e
-- uma com os dois preenchidos era xp contado a dobrar na próxima soma
-- que alguém escrevesse.
ALTER TABLE "XpAward" ADD CONSTRAINT "XpAward_one_owner"
    CHECK (("userId" IS NULL) <> ("crewId" IS NULL));

-- O mesmo evento não paga duas vezes ao mesmo dono.
--
-- É a razão de esta tabela existir. A transição para concluído já é
-- condicional e só um pedido a ganha, mas isso é uma garantia do
-- serviço: sobrevive enquanto ninguém mexer no serviço. Isto é uma
-- garantia da base de dados, e sobrevive a qualquer código.
--
-- Vão dois índices e não um porque em SQL dois nulos não são iguais:
-- um índice único sobre ("userId", "eventId", "reason") deixaria passar
-- todas as linhas de crew, que têm o utilizador vazio.
CREATE UNIQUE INDEX "XpAward_user_event_key"
    ON "XpAward" ("userId", "eventId", "reason")
    WHERE "userId" IS NOT NULL AND "eventId" IS NOT NULL AND "is_deleted" = false;

CREATE UNIQUE INDEX "XpAward_crew_event_key"
    ON "XpAward" ("crewId", "eventId", "reason")
    WHERE "crewId" IS NOT NULL AND "eventId" IS NOT NULL AND "is_deleted" = false;

CREATE INDEX "XpAward_crewId_created_at_idx"
    ON "XpAward" ("crewId", "created_at" DESC);

CREATE INDEX "XpAward_userId_created_at_idx"
    ON "XpAward" ("userId", "created_at" DESC);

CREATE INDEX "XpAward_eventId_idx" ON "XpAward" ("eventId");

ALTER TABLE "XpAward" ADD CONSTRAINT "XpAward_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "XpAward" ADD CONSTRAINT "XpAward_crewId_fkey"
    FOREIGN KEY ("crewId") REFERENCES "Crew" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "XpAward" ADD CONSTRAINT "XpAward_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
