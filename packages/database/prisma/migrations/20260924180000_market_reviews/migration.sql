-- A avaliação de uma venda.
--
-- Amarrada a um negócio que existiu: quem avalia tem de ter falado com
-- quem vendeu, sobre aquele anúncio, e o anúncio tem de ter sido
-- marcado como vendido. As duas condições são do serviço; o índice
-- único aqui garante a terceira — uma avaliação por venda e por pessoa.
--
-- Sem isto, avaliações abertas a quem quiser são um sistema de
-- vinganças com outro nome.
--
-- É pública, e por isso é uma superfície como o fórum e o mercado:
-- qualquer pessoa a lê, e denuncia-se como eles.

CREATE TABLE "MarketReview" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "reviewerId" TEXT,
    -- Lido do anúncio na criação e guardado aqui. É a única
    -- desnormalização desta tabela, e existe porque a média de uma
    -- pessoa tem de sobreviver ao anúncio ser retirado.
    "subjectId" TEXT,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    -- Quem vendeu tem uma resposta, e não uma conversa: uma avaliação
    -- injusta sem direito de resposta é um problema a sério, e uma
    -- discussão por baixo de cada estrela é outro.
    "reply" TEXT,
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "MarketReview_pkey" PRIMARY KEY ("id")
);

-- De uma a cinco. O limite está aqui e não só na API: uma escala é uma
-- promessa sobre o que uma média significa, e uma linha de seis
-- estrelas estragava todas as médias que já tivessem sido calculadas.
ALTER TABLE "MarketReview" ADD CONSTRAINT "MarketReview_rating_check"
    CHECK ("rating" >= 1 AND "rating" <= 5);

CREATE UNIQUE INDEX "MarketReview_listingId_reviewerId_key" ON "MarketReview"("listingId", "reviewerId");
CREATE INDEX "MarketReview_subjectId_created_at_idx" ON "MarketReview"("subjectId", "created_at" DESC);
CREATE INDEX "MarketReview_listingId_idx" ON "MarketReview"("listingId");

ALTER TABLE "MarketReview" ADD CONSTRAINT "MarketReview_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketReview" ADD CONSTRAINT "MarketReview_reviewerId_fkey"
    FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketReview" ADD CONSTRAINT "MarketReview_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- O quinto alvo de uma denúncia. Uma avaliação é texto público escrito
-- por uma pessoa sobre outra: se não se pudesse denunciar, era a única
-- superfície da plataforma sem por onde alguém se queixar.
ALTER TABLE "Report" ADD COLUMN "reviewId" TEXT;

ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "MarketReview"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Report_reviewId_idx" ON "Report"("reviewId");
CREATE UNIQUE INDEX "Report_reporterId_reviewId_key" ON "Report"("reporterId", "reviewId");

ALTER TABLE "Report" DROP CONSTRAINT "Report_um_alvo_so";

ALTER TABLE "Report" ADD CONSTRAINT "Report_um_alvo_so"
    CHECK (
        ("topicId" IS NOT NULL)::int
        + ("replyId" IS NOT NULL)::int
        + ("listingId" IS NOT NULL)::int
        + ("messageId" IS NOT NULL)::int
        + ("reviewId" IS NOT NULL)::int
        = 1
    );
