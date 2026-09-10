-- O que quem decide escreve ao decidir.
--
-- Uma candidatura recusada sem uma palavra é a queixa que se ouve em
-- todo o lado sobre comunidades: pediste entrada, esperaste, e um dia o
-- pedido tinha desaparecido. Quem foi recusado nunca soube porquê, e
-- muitas vezes nem soube que tinha sido recusado.
--
-- Opcional, porque obrigar quem decide a escrever uma justificação a
-- cada recusa faz com que se deixe de recusar — e uma candidatura sem
-- resposta é pior do que um "não" seco.
ALTER TABLE "Membership" ADD COLUMN "decision_note" TEXT;

-- Serve a pergunta de quem se candidatou: "o que é que me responderam
-- ultimamente?". Parcial porque só as recusadas interessam a essa
-- consulta — as pendentes e as ativas já são devolvidas por outro
-- caminho, e são a esmagadora maioria das linhas.
CREATE INDEX "Membership_rejected_idx"
    ON "Membership" ("userId", "responded_at" DESC)
    WHERE "status" = 'rejected' AND "is_deleted" = false;
