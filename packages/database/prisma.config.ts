import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'prisma/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.resolve(__dirname, '../../.env'),
});

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
    throw new Error('DATABASE_URL não definida.');
}

/**
 * Por onde correm as migrações, quando não é por onde corre a API.
 *
 * Um Postgres gerido — o Neon, por exemplo — dá dois endereços: um
 * através de um pool de ligações, que é o que uma API deve usar, e um
 * directo. As migrações precisam do directo: correm num `advisory
 * lock` e em sessões longas, e um pool em modo de transação não
 * garante nem uma coisa nem outra — a migração ou falha, ou fica
 * pendurada, e é sempre a meio de um deploy.
 *
 * Por omissão é o mesmo endereço: num Postgres normal não há dois, e
 * obrigar a defini-la seria pedir uma variável que não existe.
 */
const migrationUrl = process.env['DIRECT_DATABASE_URL'] ?? databaseUrl;

export default defineConfig({
    schema: './prisma/schema.prisma',

    migrations: {
        path: './prisma/migrations',
    },

    datasource: {
        url: migrationUrl,
    },
});