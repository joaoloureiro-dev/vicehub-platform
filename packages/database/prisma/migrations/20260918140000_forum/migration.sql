-- O fórum: perguntas e respostas entre quem usa a plataforma.
--
-- É o primeiro sítio onde o público escreve texto que outras pessoas
-- leem, e as duas colunas opcionais são por causa disso.
--
-- O autor sai quando a conta sai — `ON DELETE SET NULL` em vez de
-- cascata, para o tópico ficar de pé e as respostas dele não ficarem
-- penduradas no vazio.
--
-- E o corpo é opcional por uma promessa: quem apaga a conta é avisado de
-- que **o seu texto é apagado**, e o que escreveu aqui é texto seu.
-- Vazio quer dizer "retirado com a conta".

ALTER TYPE "PermissionScope" ADD VALUE 'forum';

CREATE TABLE "ForumTopic" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "ForumTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForumReply" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "ForumReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ForumTopic_created_at_idx" ON "ForumTopic" ("created_at" DESC);
CREATE INDEX "ForumTopic_authorId_idx" ON "ForumTopic" ("authorId");

CREATE INDEX "ForumReply_topicId_created_at_idx"
    ON "ForumReply" ("topicId", "created_at");
CREATE INDEX "ForumReply_authorId_idx" ON "ForumReply" ("authorId");

ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A resposta cai com o tópico, e é a única cascata aqui: uma resposta
-- sem a pergunta é uma frase sem contexto nenhum.
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "ForumTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
