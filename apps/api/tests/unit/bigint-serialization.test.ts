import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import bigIntSerializationPlugin, {
    convertBigIntToString,
} from '../../src/plugins/http/bigint-serialization.plugin.js';

describe('conversão de BigInt', () => {
    describe('função pura', () => {
        it('converte um BigInt em string', () => {
            expect(convertBigIntToString(1_500n)).toBe('1500');
        });

        it('preserva o valor exato acima do limite seguro dos números', () => {
            /**
             * Number(9007199254740993n) devolve 9007199254740992.
             * A conversão para string é o que impede esta perda.
             */
            expect(convertBigIntToString(9_007_199_254_740_993n)).toBe(
                '9007199254740993',
            );
        });

        it('percorre objetos aninhados e arrays', () => {
            expect(
                convertBigIntToString({
                    user: { xp: 1_500n, level: 3 },
                    wallets: [{ balance: 900n }, { balance: 0n }],
                }),
            ).toEqual({
                user: { xp: '1500', level: 3 },
                wallets: [{ balance: '900' }, { balance: '0' }],
            });
        });

        it('não toca em valores que não são BigInt', () => {
            const date = new Date('2026-01-01T00:00:00.000Z');

            expect(
                convertBigIntToString({
                    texto: 'player',
                    numero: 42,
                    booleano: true,
                    nulo: null,
                    indefinido: undefined,
                    data: date,
                }),
            ).toEqual({
                texto: 'player',
                numero: 42,
                booleano: true,
                nulo: null,
                indefinido: undefined,
                data: date,
            });
        });

        it('devolve a mesma referência quando não há nada a converter', () => {
            const payload = { user: { username: 'player' }, itens: [1, 2, 3] };

            /**
             * A resposta habitual não tem BigInt. Reutilizar a referência
             * evita copiar a árvore inteira em cada pedido.
             */
            expect(convertBigIntToString(payload)).toBe(payload);
        });

        it('só copia os ramos afetados', () => {
            const intacto = { username: 'player' };
            const payload = { user: intacto, wallet: { balance: 10n } };

            const result = convertBigIntToString(payload) as typeof payload;

            expect(result).not.toBe(payload);
            expect(result.user).toBe(intacto);
        });

        it('não percorre instâncias com serialização própria', () => {
            const buffer = Buffer.from('vicehub');

            expect(convertBigIntToString(buffer)).toBe(buffer);
        });

        it('não desmonta instâncias de classe que contenham BigInt', () => {
            /**
             * Percorrer uma instância transformá-la-ia num objeto simples,
             * perdendo o prototype e qualquer toJSON próprio. Preferimos
             * deixá-la intacta a alterar a forma da resposta em silêncio.
             */
            class Saldo {
                constructor(public readonly valor: bigint) { }
            }

            const saldo = new Saldo(10n);

            expect(convertBigIntToString(saldo)).toBe(saldo);
        });
    });

    describe('integrado no Fastify', () => {
        const buildTestApp = async () => {
            const app = Fastify();

            await app.register(bigIntSerializationPlugin);

            app.get('/perfil', async () => ({
                username: 'player',
                xp: 1_500n,
                wallet: { balance: 9_007_199_254_740_993n },
                criadoEm: new Date('2026-01-01T00:00:00.000Z'),
            }));

            app.get('/sem-bigint', async () => ({ status: 'ok' }));

            app.get('/sem-conteudo', async (_request, reply) => {
                reply.status(204).send();
            });

            app.get('/texto', async (_request, reply) => {
                reply.type('text/plain').send('vicehub');
            });

            await app.ready();

            return app;
        };

        it('devolve BigInt como string em vez de falhar com 500', async () => {
            const app = await buildTestApp();

            const response = await app.inject({ method: 'GET', url: '/perfil' });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
                username: 'player',
                xp: '1500',
                wallet: { balance: '9007199254740993' },
                criadoEm: '2026-01-01T00:00:00.000Z',
            });

            await app.close();
        });

        it('não altera respostas sem BigInt', async () => {
            const app = await buildTestApp();

            const response = await app.inject({ method: 'GET', url: '/sem-bigint' });

            expect(response.json()).toEqual({ status: 'ok' });

            await app.close();
        });

        it('não interfere com respostas sem corpo', async () => {
            const app = await buildTestApp();

            const response = await app.inject({ method: 'GET', url: '/sem-conteudo' });

            expect(response.statusCode).toBe(204);
            expect(response.body).toBe('');

            await app.close();
        });

        it('não interfere com respostas de texto', async () => {
            const app = await buildTestApp();

            const response = await app.inject({ method: 'GET', url: '/texto' });

            expect(response.body).toBe('vicehub');

            await app.close();
        });
    });
});
