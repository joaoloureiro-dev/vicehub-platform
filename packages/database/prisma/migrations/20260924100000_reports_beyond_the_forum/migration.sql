-- A denúncia deixa de ser só do fórum.
--
-- O mercado abriu, e com ele a plataforma passou a ter uma segunda
-- superfície onde qualquer pessoa registada escreve à vista de toda a
-- gente. Uma tabela chamada "ForumReport" a guardar denúncias de
-- anúncios seria um nome a mentir sobre o que lá está — e o nome é o
-- que a próxima pessoa lê antes de decidir onde escrever a terceira.
--
-- Uma fila só, e não uma por superfície. Duas filas eram duas caixas de
-- entrada para o mesmo trabalho, e a segunda ficava por abrir.

ALTER TABLE "ForumReport" RENAME TO "Report";

ALTER TYPE "ForumReportReason" RENAME TO "ReportReason";
ALTER TYPE "ForumReportStatus" RENAME TO "ReportStatus";

-- Os nomes que o Prisma deriva do modelo. Sem isto, a primeira
-- migração gerada a seguir propunha apagar e recriar tudo isto só por
-- causa do nome.
ALTER INDEX "ForumReport_pkey" RENAME TO "Report_pkey";
ALTER INDEX "ForumReport_replyId_idx" RENAME TO "Report_replyId_idx";
ALTER INDEX "ForumReport_topicId_idx" RENAME TO "Report_topicId_idx";
ALTER INDEX "ForumReport_status_created_at_idx" RENAME TO "Report_status_created_at_idx";
ALTER INDEX "ForumReport_reporterId_replyId_key" RENAME TO "Report_reporterId_replyId_key";
ALTER INDEX "ForumReport_reporterId_topicId_key" RENAME TO "Report_reporterId_topicId_key";

ALTER TABLE "Report" RENAME CONSTRAINT "ForumReport_replyId_fkey" TO "Report_replyId_fkey";
ALTER TABLE "Report" RENAME CONSTRAINT "ForumReport_topicId_fkey" TO "Report_topicId_fkey";
ALTER TABLE "Report" RENAME CONSTRAINT "ForumReport_reporterId_fkey" TO "Report_reporterId_fkey";

-- O terceiro alvo.
ALTER TABLE "Report" ADD COLUMN "listingId" TEXT;

ALTER TABLE "Report" ADD CONSTRAINT "Report_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Report_listingId_idx" ON "Report"("listingId");

-- Uma pessoa denuncia a mesma coisa uma vez. Denunciar duas vezes não
-- torna o aviso mais forte: enche a fila com o mesmo caso, e o segundo
-- moderador a abri-lo perde o tempo que o primeiro já perdeu.
CREATE UNIQUE INDEX "Report_reporterId_listingId_key" ON "Report"("reporterId", "listingId");

-- Exatamente um alvo, agora entre três.
--
-- A forma antiga era um `<>` entre dois booleanos, e essa não cresce:
-- com três, o que diz é "um número ímpar deles está preenchido", o que
-- deixava passar uma linha com os três. A soma é a forma que continua a
-- dizer a mesma coisa quando aparecer o quarto.
ALTER TABLE "Report" DROP CONSTRAINT "ForumReport_um_alvo_so";

ALTER TABLE "Report" ADD CONSTRAINT "Report_um_alvo_so"
    CHECK (
        ("topicId" IS NOT NULL)::int
        + ("replyId" IS NOT NULL)::int
        + ("listingId" IS NOT NULL)::int
        = 1
    );
