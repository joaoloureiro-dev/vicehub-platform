-- A conversa sobre um anúncio.
--
-- A peça que faltava para o mercado servir para alguma coisa: um
-- anúncio dizia "entrego no parque do porto" e não havia por onde
-- combinar nada. Sem isto, a conversa acontecia toda no Discord e o
-- mercado era um placard.
--
-- Uma conversa por anúncio e por interessado, garantida por um índice
-- único e não por uma leitura antes da escrita: dois cliques seguidos
-- no mesmo botão não abrem duas conversas.
--
-- Quem vende não está guardado aqui. É lido do anúncio, que tem um
-- vendedor: guardá-lo outra vez era a mesma verdade em dois sítios à
-- espera de divergir.

CREATE TABLE "MarketConversation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "MarketConversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketConversation_listingId_buyerId_key" ON "MarketConversation"("listingId", "buyerId");
CREATE INDEX "MarketConversation_buyerId_updated_at_idx" ON "MarketConversation"("buyerId", "updated_at" DESC);
CREATE INDEX "MarketConversation_listingId_idx" ON "MarketConversation"("listingId");

ALTER TABLE "MarketConversation" ADD CONSTRAINT "MarketConversation_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketConversation" ADD CONSTRAINT "MarketConversation_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- As mensagens são **privadas**: só as duas pessoas da conversa as
-- leem, e um moderador só a que for denunciada. A política de
-- privacidade diz isto por palavras.
CREATE TABLE "MarketMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "MarketMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketMessage_conversationId_created_at_idx" ON "MarketMessage"("conversationId", "created_at");
CREATE INDEX "MarketMessage_senderId_idx" ON "MarketMessage"("senderId");

ALTER TABLE "MarketMessage" ADD CONSTRAINT "MarketMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "MarketConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketMessage" ADD CONSTRAINT "MarketMessage_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- O quarto alvo de uma denúncia.
--
-- Uma conversa é privada, mas denunciável: é onde uma proposta de
-- pagamento por fora, ou um insulto, vai acontecer primeiro. O que o
-- moderador passa a ver é **a mensagem denunciada**, e não a conversa.
ALTER TABLE "Report" ADD COLUMN "messageId" TEXT;

ALTER TABLE "Report" ADD CONSTRAINT "Report_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "MarketMessage"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Report_messageId_idx" ON "Report"("messageId");
CREATE UNIQUE INDEX "Report_reporterId_messageId_key" ON "Report"("reporterId", "messageId");

-- A soma continua a dizer o mesmo com quatro. Era por isto que ela
-- substituiu o `<>` entre dois booleanos.
ALTER TABLE "Report" DROP CONSTRAINT "Report_um_alvo_so";

ALTER TABLE "Report" ADD CONSTRAINT "Report_um_alvo_so"
    CHECK (
        ("topicId" IS NOT NULL)::int
        + ("replyId" IS NOT NULL)::int
        + ("listingId" IS NOT NULL)::int
        + ("messageId" IS NOT NULL)::int
        = 1
    );
