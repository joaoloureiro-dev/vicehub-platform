-- A resposta que resolveu a pergunta.
--
-- Um tópico do fórum era uma conversa e ficava uma conversa: quem
-- chegasse a ele seis meses depois tinha de ler as nove respostas para
-- descobrir qual delas servia — e ninguém lê nove respostas, por isso
-- voltava a perguntar. O que faz um fórum valer a pena daqui a um ano é
-- a pergunta antiga responder sozinha.
--
-- O apontador fica **no tópico** e não na resposta. É assim que "há uma
-- resposta aceite, e é uma só" passa a ser uma coisa que a base garante
-- em vez de uma coisa que o código tem de se lembrar de verificar:
-- marcar outra move o apontador, e não há estado em que duas estejam
-- aceites ao mesmo tempo.
--
-- `ON DELETE SET NULL` porque uma resposta apagada a sério deixa de
-- poder ser a aceite. O apagar do produto é brando — põe `is_deleted` —
-- e esse caso é tratado no código, que limpa a marca ao retirar a
-- resposta: uma resposta retirada não é resposta nenhuma.
ALTER TABLE "ForumTopic" ADD COLUMN "accepted_reply_id" TEXT;

CREATE UNIQUE INDEX "ForumTopic_accepted_reply_id_key"
    ON "ForumTopic"("accepted_reply_id");

ALTER TABLE "ForumTopic"
    ADD CONSTRAINT "ForumTopic_accepted_reply_id_fkey"
    FOREIGN KEY ("accepted_reply_id") REFERENCES "ForumReply"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- E quem respondeu fica a saber.
--
-- É o que faz alguém responder outra vez: uma resposta aceite sem aviso
-- é um agradecimento que não chega a ninguém.
ALTER TYPE "NotificationKind" ADD VALUE 'forum_accepted';
