-- A ligação entre uma crew e o servidor onde ela joga.
--
-- Até aqui as duas coisas não se conheciam: o diretório mostrava crews e
-- servidores lado a lado sem nada a dizer que uma joga no outro. É essa
-- ligação que a plataforma precisa de ter para ser vendida a um servidor
-- em vez de a um jogador — mas só serve se for **verificada**. Uma crew
-- a declarar sozinha "eu jogo no servidor X" não pode valer nada: seria
-- a forma trivial de ficar pendurado no que o X paga.
--
-- Por isso a ligação nasce como um pedido e só existe a sério quando
-- alguém que manda no servidor a aceita. As duas pontas consentem.
CREATE TABLE "Affiliation" (
    "id"           TEXT NOT NULL,

    "crewId"       TEXT NOT NULL,
    "serverId"     TEXT NOT NULL,

    -- Os mesmos estados de uma adesão de pessoa, porque é a mesma
    -- mecânica: pede-se, responde-se, e sai-se.
    "status"       "MembershipStatus" NOT NULL DEFAULT 'pending',

    -- Quem pediu e quem respondeu. Sem isto, uma crew expulsa não teria
    -- como saber se saiu ou se foi posta fora.
    "requested_by" TEXT NOT NULL,
    "responded_at" TIMESTAMP(3),
    "responded_by" TEXT,

    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    "deleted_at"   TIMESTAMP(3),
    "is_deleted"   BOOLEAN NOT NULL DEFAULT false,
    "version"      INTEGER NOT NULL DEFAULT 1,
    "source"       "SourceType" NOT NULL DEFAULT 'api',
    "created_by"   TEXT,
    "updated_by"   TEXT,

    CONSTRAINT "Affiliation_pkey" PRIMARY KEY ("id")
);

-- Uma crew joga num servidor, não em dois.
--
-- É este índice que faz disso um facto da base de dados em vez de uma
-- esperança sobre o serviço: dois servidores a aceitarem a mesma crew ao
-- mesmo tempo passam os dois pela verificação em memória, e sem esta
-- linha ficavam os dois aceites. Importa porque é daqui que vai sair o
-- direito ao plano — duas filiações ativas seriam duas origens de plano
-- para a mesma crew.
CREATE UNIQUE INDEX "Affiliation_active_crew_key"
    ON "Affiliation" ("crewId")
    WHERE "status" = 'active' AND "is_deleted" = false;

-- Um pedido de cada vez ao mesmo servidor. Um pedido recusado não conta:
-- ser recusado hoje não pode fechar a porta para sempre.
CREATE UNIQUE INDEX "Affiliation_open_pair_key"
    ON "Affiliation" ("crewId", "serverId")
    WHERE "status" IN ('pending', 'active') AND "is_deleted" = false;

CREATE INDEX "Affiliation_serverId_status_idx"
    ON "Affiliation" ("serverId", "status");

CREATE INDEX "Affiliation_crewId_status_idx"
    ON "Affiliation" ("crewId", "status");

ALTER TABLE "Affiliation" ADD CONSTRAINT "Affiliation_crewId_fkey"
    FOREIGN KEY ("crewId") REFERENCES "Crew" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Affiliation" ADD CONSTRAINT "Affiliation_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
