-- Divisão de ganhos pelo peso de quem participou num evento.
--
-- É a base que os eventos existem para permitir: quem apareceu ao
-- assalto recebe, quem não apareceu não, e quem liderou pode receber
-- mais. Os pesos vêm de presenças confirmadas por quem organiza, e não
-- do que quem propõe a divisão diz que aconteceu.
ALTER TYPE "DistributionBasis" ADD VALUE 'participation' BEFORE 'assisted';

-- O evento fica gravado na divisão para que se saiba porque é que
-- aquelas pessoas em concreto foram pagas. Sem isto, uma divisão por
-- participação seria indistinguível de uma lista escolhida à mão.
ALTER TABLE "Distribution" ADD COLUMN "eventId" TEXT;

CREATE INDEX "Distribution_eventId_idx" ON "Distribution" ("eventId");

-- SET NULL e não RESTRICT: apagar uma crew leva os eventos dela por
-- arrasto, e uma divisão já paga não pode passar a impedir isso. O que
-- foi pago fica pago, ainda que se perca de onde veio.
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
