-- O bloco de notícias da página de entrada.
--
-- Guarda o que um agregador guarda: título, excerto curto, fonte e o
-- endereço de lá. O artigo é de quem o escreveu; o que aqui fica serve
-- para decidir se se quer ler, e quem quiser lê no sítio dele.

CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "url" TEXT NOT NULL,
    "image_url" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" "SourceType" NOT NULL DEFAULT 'webhook',

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- A mesma notícia não entra duas vezes.
--
-- É a razão de a recolha poder correr de hora a hora sem pensar: passa
-- pelo feed inteiro de cada vez, e o índice é que decide o que é novo.
--
-- Parcial pelo `is_deleted`, como as outras: uma notícia retirada à mão
-- liberta a chave, e uma recolha seguinte pode voltar a trazê-la.
CREATE UNIQUE INDEX "NewsItem_guid_key"
    ON "NewsItem" ("guid")
    WHERE "is_deleted" = false;

CREATE INDEX "NewsItem_published_at_idx"
    ON "NewsItem" ("published_at" DESC);
