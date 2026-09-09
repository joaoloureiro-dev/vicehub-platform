-- Um nome está ocupado enquanto a crew existir, e não para sempre.
--
-- Até aqui a unicidade era total: uma crew apagada continuava a ocupar o
-- nome e a tag que ninguém mais podia usar, incluindo quem a apagou por
-- se ter enganado a escrevê-los. Como nada se apaga a sério — tudo o que
-- as pessoas criam leva is_deleted — o índice tem de saber disso, senão
-- apagar não devolve nada a ninguém.
--
-- Fica em SQL à mão porque o Prisma não sabe exprimir um índice parcial;
-- é a mesma razão pela qual os índices das filiações também vivem aqui.

DROP INDEX "Crew_name_key";
DROP INDEX "Crew_tag_key";
DROP INDEX "Server_name_key";

CREATE UNIQUE INDEX "Crew_active_name_key"
    ON "Crew" ("name")
    WHERE "is_deleted" = false;

CREATE UNIQUE INDEX "Crew_active_tag_key"
    ON "Crew" ("tag")
    WHERE "is_deleted" = false;

CREATE UNIQUE INDEX "Server_active_name_key"
    ON "Server" ("name")
    WHERE "is_deleted" = false;
