-- A ligação entre um servidor de FiveM e a plataforma.
--
-- Até aqui, tudo o que a plataforma sabia de um servidor era o que
-- alguém escrevia num formulário — incluindo se estava online, que é o
-- que o diretório filtra. Um servidor a dizer de si próprio "estou de
-- pé" é uma afirmação sem prova; um servidor a bater à porta de minuto
-- a minuto é um facto.
--
-- É por aqui que os scripts Lua falam connosco.

-- Chaves de API por servidor.
--
-- O segredo **não** é guardado: guarda-se o seu resumo, como nos tokens
-- de conta. Quem perder a chave gera outra — a alternativa era a
-- plataforma poder ler as chaves de toda a gente, e uma base de dados
-- lida é uma base de dados que entrega os servidores todos.
CREATE TABLE "ServerApiKey" (
    "id"         TEXT NOT NULL,

    "serverId"   TEXT NOT NULL,

    -- Nome dado por quem a criou, para distinguir "produção" de "teste".
    "label"      TEXT NOT NULL,

    -- A parte visível da chave. Fica em claro de propósito: é o que
    -- permite mostrar uma lista de chaves sem revelar nenhuma, e é por
    -- ela que se encontra a linha sem percorrer a tabela toda.
    "prefix"     TEXT NOT NULL,

    -- SHA-256 do segredo, em hexadecimal.
    "key_hash"   TEXT NOT NULL,

    -- Quando foi usada pela última vez. Serve para se poder revogar o
    -- que já ninguém usa sem medo de partir o que está a trabalhar.
    "last_used_at" TIMESTAMP(3),
    "revoked_at"   TIMESTAMP(3),

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version"    INTEGER NOT NULL DEFAULT 1,
    "source"     "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "ServerApiKey_pkey" PRIMARY KEY ("id")
);

-- É por aqui que uma chave apresentada é encontrada, e é isto que
-- impede dois prefixos iguais — sem unicidade, a procura por prefixo
-- devolvia a chave errada.
CREATE UNIQUE INDEX "ServerApiKey_prefix_key" ON "ServerApiKey" ("prefix");

CREATE INDEX "ServerApiKey_serverId_idx" ON "ServerApiKey" ("serverId");

ALTER TABLE "ServerApiKey" ADD CONSTRAINT "ServerApiKey_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O que o servidor reporta de si próprio.
--
-- `last_heartbeat_at` é o que torna o "online" verificável: a partir do
-- momento em que um servidor reporta, deixa de ser uma marca que alguém
-- liga à mão e passa a ser uma coisa que expira sozinha.
ALTER TABLE "Server" ADD COLUMN "last_heartbeat_at" TIMESTAMP(3);
ALTER TABLE "Server" ADD COLUMN "players_online" INTEGER;

-- O diretório filtra por estar online, e passa a filtrar por isto.
CREATE INDEX "Server_last_heartbeat_at_idx" ON "Server" ("last_heartbeat_at");
