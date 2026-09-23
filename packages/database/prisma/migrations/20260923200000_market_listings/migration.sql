-- O mercado de um servidor.
--
-- O preço é moeda de jogo e não dinheiro real: esta tabela não tem, nem
-- vai ter, nada que ligue um anúncio a um pagamento. O que aqui se
-- guarda é o que alguém diz que tem para vender e por quanto; a troca
-- acontece dentro do jogo, entre as duas pessoas.
--
-- Os anúncios pertencem a um servidor porque as economias são
-- separadas. Um carro vendido num servidor não vale nada noutro, e um
-- mercado comum a todos seria uma lista de coisas que ninguém pode
-- comprar — além de deixar quem quer que seja a anunciar em toda a
-- plataforma de uma vez.

CREATE TYPE "MarketCategory" AS ENUM ('vehicle', 'property', 'business', 'service', 'item', 'other');

-- Vendido e retirado são estados diferentes de propósito: um diz por
-- quanto é que a coisa saiu, o outro diz que não saiu. Juntá-los
-- poupava uma coluna e perdia a única série de preços que a plataforma
-- vai ter sobre a economia de um servidor.
CREATE TYPE "MarketListingStatus" AS ENUM ('open', 'sold', 'withdrawn');

CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "sellerId" TEXT,
    "category" "MarketCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "price" BIGINT NOT NULL,
    "imageUrl" TEXT,
    "status" "MarketListingStatus" NOT NULL DEFAULT 'open',
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" "SourceType" NOT NULL DEFAULT 'api',
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- A única listagem que existe: os anúncios de um servidor, num estado,
-- do mais recente para o mais antigo.
CREATE INDEX "MarketListing_serverId_status_updated_at_idx" ON "MarketListing"("serverId", "status", "updated_at" DESC);

CREATE INDEX "MarketListing_serverId_category_idx" ON "MarketListing"("serverId", "category");

CREATE INDEX "MarketListing_sellerId_idx" ON "MarketListing"("sellerId");

-- O anúncio vai-se com o servidor, mas sobrevive a quem o escreveu: o
-- preço por que uma coisa saiu continua a interessar ao mercado depois
-- de a conta desaparecer.
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Um preço fora de alcance não é um anúncio, é uma piada que estraga o
-- alinhamento de toda a lista. O limite é o mesmo que a API valida, e
-- está aqui por ser aqui que ele passa a ser verdade.
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_price_check" CHECK ("price" >= 1 AND "price" <= 999999999999);
