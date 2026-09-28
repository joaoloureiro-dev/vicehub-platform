-- Em que parte do fórum vive cada pergunta.
--
-- Escrita à mão, como as outras: `prisma migrate dev` não corre aqui.
CREATE TYPE "ForumCategory" AS ENUM ('general', 'crews', 'servers', 'roleplay', 'support');

-- Com omissão, e não obrigatória: as perguntas que já cá estavam são
-- todas da conversa geral, e sem omissão esta coluna não podia nascer
-- sobre elas.
ALTER TABLE "ForumTopic" ADD COLUMN "category" "ForumCategory" NOT NULL DEFAULT 'general';

-- A lista de uma categoria sai pela última atividade, como a lista
-- inteira. Sem este índice, filtrar por categoria lia a tabela toda.
CREATE INDEX "ForumTopic_category_updated_at_idx" ON "ForumTopic"("category", "updated_at" DESC);
