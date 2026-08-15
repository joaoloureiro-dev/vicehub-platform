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

export default defineConfig({
    schema: './prisma/schema.prisma',

    migrations: {
        path: './prisma/migrations',
    },

    datasource: {
        url: databaseUrl,
    },
});