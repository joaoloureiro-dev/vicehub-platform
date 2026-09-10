-- Uma transferência entre duas tesourarias, escrita como duas linhas.
--
-- O dono de um servidor paga às crews que lá jogam. Isso sai da
-- tesouraria dele e entra na tesouraria delas, e as duas coisas têm de
-- acontecer juntas ou nenhuma: dinheiro que saiu de um lado e não entrou
-- no outro é dinheiro desaparecido, e ninguém consegue dizer para onde.
--
-- Não há tabela de transferências, de propósito. Uma linha-resumo a
-- dizer "transferi 5000" ao lado de duas pernas que somam outra coisa é
-- uma terceira versão da verdade, e as três acabam por divergir. As duas
-- pernas **são** a transferência — é o que a contabilidade faz há
-- seiscentos anos —, e o identificador partilhado é o que as junta.
ALTER TABLE "Transaction" ADD COLUMN "transferId" TEXT;

-- Serve as duas perguntas que se fazem sobre uma transferência: "mostra-
-- me as duas pernas desta" e, no ecrã de um movimento, "isto faz parte
-- de alguma?". Parcial porque a esmagadora maioria dos movimentos não é
-- uma transferência e nunca seria devolvida por esta consulta.
CREATE INDEX "Transaction_transferId_idx" ON "Transaction" ("transferId")
    WHERE "transferId" IS NOT NULL;
