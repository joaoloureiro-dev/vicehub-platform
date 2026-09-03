-- Tokens de conta: recuperar a password e confirmar o email.
--
-- Os dois casos partilham a mesma mecânica — segredo aleatório, guardado
-- em resumo, de uso único e com prazo — e por isso partilham a mesma
-- tabela. O propósito fica na linha para que um token pedido para
-- recuperar a password nunca sirva para confirmar um email.
CREATE TYPE "AccountTokenPurpose" AS ENUM ('password_reset', 'email_verification');

CREATE TABLE "AccountToken" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "purpose"        "AccountTokenPurpose" NOT NULL,
    -- SHA-256 do segredo, em hexadecimal. O que segue para o email é o
    -- segredo; o que fica aqui não serve para entrar em conta nenhuma.
    "token_hash"     TEXT NOT NULL,
    "expires_at"     TIMESTAMP(3) NOT NULL,
    "used_at"        TIMESTAMP(3),
    "invalidated_at" TIMESTAMP(3),
    "requested_ip"   TEXT,
    "requested_via"  TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    "deleted_at"     TIMESTAMP(3),
    "is_deleted"     BOOLEAN NOT NULL DEFAULT false,
    "version"        INTEGER NOT NULL DEFAULT 1,
    "source"         "SourceType" NOT NULL DEFAULT 'api',
    "created_by"     TEXT,
    "updated_by"     TEXT,

    CONSTRAINT "AccountToken_pkey" PRIMARY KEY ("id")
);

-- Um prazo que já passou no momento em que é criado seria um token que
-- nunca serve para nada, e o pedido pareceria ter corrido bem.
ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_expires_after_creation_check"
    CHECK ("expires_at" > "created_at");

-- Um token não pode ter sido usado e invalidado ao mesmo tempo: são dois
-- fins diferentes, e as duas datas juntas não diriam qual aconteceu.
ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_single_outcome_check"
    CHECK ("used_at" IS NULL OR "invalidated_at" IS NULL);

-- É por este índice que o token recebido é encontrado, e é ele que
-- impede dois segredos com o mesmo resumo.
CREATE UNIQUE INDEX "AccountToken_token_hash_key" ON "AccountToken" ("token_hash");

CREATE INDEX "AccountToken_userId_purpose_idx" ON "AccountToken" ("userId", "purpose");
CREATE INDEX "AccountToken_expires_at_idx" ON "AccountToken" ("expires_at");
CREATE INDEX "AccountToken_open_idx"
    ON "AccountToken" ("userId", "purpose", "used_at", "invalidated_at");

ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
