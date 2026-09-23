-- O passado dos servidores, hora a hora.
--
-- O heartbeat dizia quantas pessoas estão lá agora e sobrescrevia o
-- anterior: o servidor tinha presente e não tinha passado. "500 pessoas
-- agora" não distingue um servidor cheio todos os dias de um que encheu
-- hoje à tarde, e é essa diferença que um leaderboard ordena.
--
-- Uma linha por servidor e por hora, e não uma por batida: um servidor
-- reporta de minuto a minuto, e guardar cada batida dava mil e
-- quatrocentas linhas por dia e por servidor para responder ao mesmo.

CREATE TABLE "ServerActivityHour" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "hour" TIMESTAMP(3) NOT NULL,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "players_sum" INTEGER NOT NULL DEFAULT 0,
    "players_max" INTEGER NOT NULL DEFAULT 0,
    "players_last" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerActivityHour_pkey" PRIMARY KEY ("id")
);

-- A garantia que faz o balde ser um balde.
--
-- Duas batidas na mesma hora somam-se numa linha; sem este índice, duas
-- batidas ao mesmo tempo criavam duas linhas para a mesma hora e a
-- média passava a depender de quantas vezes o `upsert` perdeu a corrida.
CREATE UNIQUE INDEX "ServerActivityHour_serverId_hour_key"
    ON "ServerActivityHour" ("serverId", "hour");

-- A leitura de um servidor: as horas dele, da mais recente para trás.
CREATE INDEX "ServerActivityHour_serverId_hour_idx"
    ON "ServerActivityHour" ("serverId", "hour" DESC);

-- E a limpeza, que apaga por idade e não por servidor.
CREATE INDEX "ServerActivityHour_hour_idx" ON "ServerActivityHour" ("hour");

-- O histórico cai com o servidor. Não é um registo de auditoria: é o
-- passado de uma coisa que deixou de existir, e não há a quem o mostrar.
ALTER TABLE "ServerActivityHour" ADD CONSTRAINT "ServerActivityHour_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
