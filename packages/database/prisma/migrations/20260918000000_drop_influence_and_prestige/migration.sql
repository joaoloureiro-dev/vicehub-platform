-- A influência e o prestígio saem, até haver uma regra que as ganhe.
--
-- Nasceram no primeiro esquema e nunca tiveram quem as escrevesse. A
-- API lia-as, iam nos DTOs e apareciam na página de cada crew — sempre
-- a zero, para toda a gente, desde o primeiro dia.
--
-- Duas colunas a prometer medidas que não existem valem menos do que a
-- sua ausência: quem chega à página de uma crew lê que a plataforma
-- mede duas coisas, e não mede nenhuma. O xp já diz o que a crew tem
-- feito e o nível já o resume; fazer estas duas sair de eventos era ter
-- três números a dizer o mesmo.
--
-- Nada se perde ao apagá-las. Nenhuma linha jamais teve outro valor que
-- não o zero por omissão, porque nenhum caminho do código lhes escrevia.
-- E repô-las é esta migração ao contrário, no dia em que houver regra.
ALTER TABLE "Crew" DROP COLUMN "influence";
ALTER TABLE "Crew" DROP COLUMN "prestige";
