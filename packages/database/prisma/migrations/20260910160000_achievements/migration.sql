-- As conquistas de uma pessoa ou de uma crew.
--
-- Uma linha por conquista ganha, com a data em que foi ganha. Podiam ser
-- calculadas em cada leitura a partir das contagens — e seriam sempre
-- coerentes — mas perdia-se a única coisa que quem olha para um perfil
-- quer saber além do "tem": **quando**. Uma conquista sem data é uma
-- etiqueta; com data é uma história.
--
-- Exatamente um titular, como na Subscription e na Wallet. O CHECK está
-- aqui porque o Prisma não o sabe exprimir.
CREATE TABLE "Achievement" (
    "id"     TEXT NOT NULL,
    "userId" TEXT,
    "crewId" TEXT,

    "slug"      TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version"    INTEGER NOT NULL DEFAULT 1,

    "source"     "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Achievement_one_owner" CHECK (("userId" IS NULL) <> ("crewId" IS NULL))
);

ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_crewId_fkey"
    FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ganhar duas vezes a mesma conquista não é ganhar duas vezes: é um erro
-- que se vê no perfil. São dois índices e não um porque o SQL trata
-- NULLs como distintos entre si — um índice sobre (userId, crewId, slug)
-- deixaria passar duas linhas de crew com o mesmo slug, já que o userId
-- é NULL nas duas e NULL nunca é igual a NULL.
CREATE UNIQUE INDEX "Achievement_user_slug_key" ON "Achievement" ("userId", "slug")
    WHERE "userId" IS NOT NULL AND "is_deleted" = false;

CREATE UNIQUE INDEX "Achievement_crew_slug_key" ON "Achievement" ("crewId", "slug")
    WHERE "crewId" IS NOT NULL AND "is_deleted" = false;

-- O perfil pede-as por ordem de quando foram ganhas.
CREATE INDEX "Achievement_user_earned_idx" ON "Achievement" ("userId", "earned_at" DESC)
    WHERE "userId" IS NOT NULL AND "is_deleted" = false;

CREATE INDEX "Achievement_crew_earned_idx" ON "Achievement" ("crewId", "earned_at" DESC)
    WHERE "crewId" IS NOT NULL AND "is_deleted" = false;
