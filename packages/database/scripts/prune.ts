import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { contarParaPrune, prune } from '../src/prune.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.resolve(__dirname, '../../../.env'),
    quiet: true,
});

/**
 * Apaga tokens e sessões expirados.
 *
 * As regras vivem em `src/prune.ts`, que é o que os testes exercitam.
 * Aqui só se abre a ligação e se diz o que aconteceu.
 *
 * Não corre dentro da API de propósito: com mais do que uma instância,
 * um temporizador em processo correria em todas ao mesmo tempo, e o que
 * se quer é uma passagem, não N. Põe-se num cron.
 *
 *     npm run db:prune            # apaga
 *     npm run db:prune -- --seco  # só conta, não apaga
 */

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
    throw new Error('[ViceHub Prune] DATABASE_URL não definida.');
}

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
});

const main = async (): Promise<void> => {
    const seco = process.argv.slice(2).includes('--seco');

    const resultado = seco
        ? await contarParaPrune(prisma)
        : await prune(prisma);

    const verbo = seco ? 'apagaria' : 'apagou';

    console.log(
        `[ViceHub Prune] ${verbo} ${resultado.tokensDeConta} tokens de conta, ` +
            `${resultado.refreshTokens} refresh tokens e ${resultado.sessoes} sessões.`,
    );
};

try {
    await main();
} catch (error: unknown) {
    console.error(
        error instanceof Error ? error.message : '[ViceHub Prune] Falhou:',
        error instanceof Error ? '' : error,
    );
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
