-- A amizade entre duas pessoas.
--
-- Uma relação, e não duas linhas. Guardar "A é amigo de B" e "B é amigo
-- de A" em separado é guardar a mesma coisa duas vezes, e duas cópias da
-- mesma coisa divergem sempre: bastava uma escrita falhar a meio para
-- alguém ficar amigo de quem não é amigo dele.

CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,

    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,

    "status" "MembershipStatus" NOT NULL DEFAULT 'pending',

    "requested_by" TEXT NOT NULL,
    "responded_at" TIMESTAMP(3),

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version"    INTEGER NOT NULL DEFAULT 1,

    "source"     "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- O par tem uma ordem só, e é sempre a mesma.
--
-- Com os dois identificadores ordenados, (A,B) e (B,A) são a mesma
-- linha: pedir a alguém que já nos pediu encontra o pedido dele em vez
-- de criar um segundo, e o índice abaixo consegue impedir duplicados —
-- sem a ordem, teria de existir um índice para cada sentido e nenhum
-- deles veria o outro.
--
-- E de graça: ninguém pode ser amigo de si próprio, porque um
-- identificador nunca é menor do que ele mesmo.
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_ordered_pair"
    CHECK ("userAId" < "userBId");

-- Uma relação aberta de cada vez entre as mesmas duas pessoas.
--
-- Recusadas e desfeitas não contam: dizer que não hoje não pode fechar
-- a porta para sempre, e é a mesma decisão que já se tomou nas
-- filiações entre crews e servidores.
CREATE UNIQUE INDEX "Friendship_open_pair_key"
    ON "Friendship" ("userAId", "userBId")
    WHERE "status" IN ('pending', 'active') AND "is_deleted" = false;

CREATE INDEX "Friendship_userAId_status_idx" ON "Friendship" ("userAId", "status");
CREATE INDEX "Friendship_userBId_status_idx" ON "Friendship" ("userBId", "status");

ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userAId_fkey"
    FOREIGN KEY ("userAId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userBId_fkey"
    FOREIGN KEY ("userBId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
