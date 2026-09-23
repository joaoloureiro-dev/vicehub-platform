-- A média de sete dias, ao lado do servidor.
--
-- Vive aqui, e não calculada a cada leitura, porque o diretório precisa
-- de **ordenar** por ela: uma média de uma janela de tempo não se
-- escreve num `orderBy` de Prisma, e a alternativa era reescrever os
-- filtros do diretório em SQL — duas escritas da mesma regra, que é como
-- uma delas acaba a divergir sem ninguém dar por isso.
--
-- Nula enquanto o servidor não tiver passado nenhum, que é diferente de
-- zero: o diretório põe as nulas no fim em vez de as tratar como
-- servidores vazios.
ALTER TABLE "Server" ADD COLUMN "players_average_7d" INTEGER;

-- O índice que a ordenação usa.
--
-- Simples e ascendente, que é o que o schema do Prisma sabe declarar.
-- Onde os nulos ficam é decidido pela consulta — e é no fim, porque um
-- servidor sem passado não é um servidor vazio.
CREATE INDEX "Server_players_average_7d_idx"
    ON "Server" ("players_average_7d");
