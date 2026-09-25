-- Os avisos.
--
-- A plataforma passou a ter sítios onde outra pessoa fala contigo — uma
-- conversa sobre um anúncio, uma resposta a uma pergunta, uma avaliação
-- — e nenhum deles tinha como te dizer que falou. Sem isto, a conversa
-- do mercado é uma conversa que ninguém sabe que tem, e toda a gente
-- volta ao Discord.
--
-- Cada aviso nasce na mesma transação do que o causou. Escrito a
-- seguir, fora dela, era um aviso que se perde quando a escrita
-- seguinte falha — e o que se perdia era a única coisa que dizia à
-- pessoa que havia ali alguma coisa.

CREATE TYPE "NotificationKind" AS ENUM (
    'market_message',
    'forum_reply',
    'market_review',
    'market_review_reply'
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    -- Quem causou. Nulo quando essa conta sai: o aviso continua a
    -- valer, porque o que ele aponta continua lá.
    "actorId" TEXT,
    "messageId" TEXT,
    "replyId" TEXT,
    "reviewId" TEXT,
    -- Nulo é por ler, e é o que a barra conta.
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Exatamente um alvo, escrito como soma pela razão que a tabela das
-- denúncias já aprendeu: é a forma que continua a dizer o mesmo quando
-- aparecer o quarto.
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_um_alvo_so"
    CHECK (
        ("messageId" IS NOT NULL)::int
        + ("replyId" IS NOT NULL)::int
        + ("reviewId" IS NOT NULL)::int
        = 1
    );

CREATE INDEX "Notification_userId_created_at_idx" ON "Notification"("userId", "created_at" DESC);
CREATE INDEX "Notification_userId_read_at_idx" ON "Notification"("userId", "read_at");
CREATE INDEX "Notification_messageId_idx" ON "Notification"("messageId");
CREATE INDEX "Notification_replyId_idx" ON "Notification"("replyId");
CREATE INDEX "Notification_reviewId_idx" ON "Notification"("reviewId");

-- O aviso vai-se com a conta que o recebeu e com o que ele aponta: um
-- aviso sobre uma mensagem apagada é um aviso para lado nenhum.
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "MarketMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_replyId_fkey"
    FOREIGN KEY ("replyId") REFERENCES "ForumReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "MarketReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
