-- Uma crew diz, ela própria, que está a recrutar.
--
-- Podia ser deduzido — ter requisitos escritos, ter lugares livres, ter
-- aceitado alguém há pouco. Não é, e de propósito: uma dedução destas
-- põe no quadro de recrutamento crews que nunca disseram que queriam lá
-- estar, e quem se candidatar a uma delas leva com um silêncio que a
-- plataforma provocou.
--
-- A data existe para o anúncio poder envelhecer à vista.
--
-- O problema conhecido dos quadros de recrutamento é ficarem cheios de
-- anúncios que ninguém desligou. Não se resolve escondendo: resolve-se
-- dizendo há quanto tempo aquilo está lá, e deixando quem lê tirar as
-- suas conclusões. É escrita quando o anúncio é ligado e apagada quando
-- é desligado, para que voltar a ligar comece a contar do zero.
ALTER TABLE "Crew" ADD COLUMN "is_recruiting" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Crew" ADD COLUMN "recruiting_since" TIMESTAMP(3);

-- Uma crew que não recruta nunca aparece no quadro, e o quadro é a única
-- consulta que este índice serve. Parcial para não guardar as linhas que
-- nunca vai devolver: a esmagadora maioria das crews, a toda a hora.
CREATE INDEX "Crew_recruiting_idx" ON "Crew" ("recruiting_since" DESC)
    WHERE "is_recruiting" = true AND "is_deleted" = false;
