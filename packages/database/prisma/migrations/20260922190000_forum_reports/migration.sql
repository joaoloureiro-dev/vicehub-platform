-- Denúncias do fórum.
--
-- Sem isto, uma publicação só era moderada se alguém calhasse de a ler.
-- Quem lê é quem encontra; isto é o que lhe dá por onde avisar.
--
-- Três garantias vivem aqui e não no código, porque são as três que um
-- erro de programação não pode ter o direito de quebrar.

CREATE TYPE "ForumReportReason" AS ENUM ('spam', 'abuse', 'off_topic', 'other');
CREATE TYPE "ForumReportStatus" AS ENUM ('open', 'acted', 'dismissed');

CREATE TABLE "ForumReport" (
    "id" TEXT NOT NULL,
    "topicId" TEXT,
    "replyId" TEXT,
    "reporterId" TEXT,
    "reason" "ForumReportReason" NOT NULL,
    "note" TEXT,
    "status" "ForumReportStatus" NOT NULL DEFAULT 'open',
    "handled_at" TIMESTAMP(3),
    "handled_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "ForumReport_pkey" PRIMARY KEY ("id")
);

-- Primeira garantia: **um alvo, e um só**.
--
-- Uma denúncia sem alvo, ou com dois, não é uma denúncia: é uma linha
-- que o moderador não sabe abrir. O `<>` entre dois booleanos é um "ou
-- um ou outro, nunca ambos nem nenhum".
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_um_alvo_so"
    CHECK (("topicId" IS NOT NULL) <> ("replyId" IS NOT NULL));

-- Segunda garantia: **uma por pessoa e por publicação**.
--
-- Sem isto, a fila de denúncias passava a ser a maneira mais barata de
-- encher o ecrã de um moderador — que é o contrário do que ela existe
-- para fazer.
--
-- Em Postgres dois NULL não colidem, e é isso que faz os dois índices
-- funcionarem lado a lado: numa denúncia a uma resposta o `topicId` é
-- nulo, e é o outro índice que a guarda.
CREATE UNIQUE INDEX "ForumReport_reporterId_topicId_key"
    ON "ForumReport" ("reporterId", "topicId");
CREATE UNIQUE INDEX "ForumReport_reporterId_replyId_key"
    ON "ForumReport" ("reporterId", "replyId");

-- A fila do moderador: as abertas, as mais velhas primeiro.
CREATE INDEX "ForumReport_status_created_at_idx"
    ON "ForumReport" ("status", "created_at");
CREATE INDEX "ForumReport_topicId_idx" ON "ForumReport" ("topicId");
CREATE INDEX "ForumReport_replyId_idx" ON "ForumReport" ("replyId");

-- Terceira garantia: a denúncia cai com o que ela aponta.
--
-- Cascata, e não `SET NULL`: uma denúncia sobre uma publicação que
-- deixou de existir não tem nada para o moderador ver, e o alvo nulo
-- seria precisamente a linha que o CHECK acima recusa.
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "ForumTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_replyId_fkey"
    FOREIGN KEY ("replyId") REFERENCES "ForumReply" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quem denunciou sai quando a conta sai, e a denúncia fica: o que ela
-- aponta continua lá, e o moderador ainda tem de decidir.
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
