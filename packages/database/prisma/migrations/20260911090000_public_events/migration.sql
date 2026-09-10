-- Um evento que a comunidade quis pôr à porta.
--
-- Até aqui o calendário de uma crew ou de um servidor era só dela: ver
-- os eventos exige `event:read`, que só os membros têm, e isso está
-- certo — quando e onde uma comunidade vai estar é assunto dela.
--
-- Mas quem chega à plataforma pela primeira vez não vê nada a acontecer,
-- e uma plataforma de comunidades que parece vazia diz a quem chega que
-- chegou tarde. A saída não é abrir os calendários; é deixar cada
-- comunidade escolher, evento a evento, o que quer mostrar.
--
-- Por isso o valor por omissão é `false`, e não é detalhe: um calendário
-- que era privado ontem continua privado hoje. Nada passa a público por
-- ter aparecido uma coluna.
ALTER TABLE "Event" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false;

-- A montra pergunta sempre a mesma coisa: os públicos, por ordem de
-- começo. Sem este índice, a página de entrada varria a tabela inteira
-- de eventos para mostrar três.
CREATE INDEX "Event_is_public_starts_at_idx" ON "Event"("is_public", "starts_at");
