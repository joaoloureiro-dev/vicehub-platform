import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Por onde correm as migrações.
 *
 * Um Postgres gerido dá dois endereços: um através de um pool de
 * ligações, que é o que a API deve usar, e um directo. As migrações
 * precisam do directo — correm num *advisory lock* e em sessões
 * longas, e um pool em modo de transação não garante nem uma coisa nem
 * outra. A migração ou falha, ou fica pendurada, e é sempre a meio de
 * um deploy.
 *
 * É uma linha de configuração que ninguém volta a olhar e cujo efeito
 * só aparece contra um Neon a sério — o género de coisa que uma
 * arrumação distraída desfaz sem ninguém dar por ela.
 */
const carregar = async (directo?: string) => {
    vi.resetModules();

    if (directo === undefined) {
        delete process.env['DIRECT_DATABASE_URL'];
    } else {
        process.env['DIRECT_DATABASE_URL'] = directo;
    }

    process.env['DATABASE_URL'] = 'postgresql://pelo-pool/vicehub';

    const modulo = await import(
        '../../../../packages/database/prisma.config.js'
    );

    return modulo.default as { datasource: { url: string } };
};

afterEach(() => {
    delete process.env['DIRECT_DATABASE_URL'];
    vi.resetModules();
});

describe('as migrações', () => {
    it('correm pelo endereço directo quando ele existe', async () => {
        const config = await carregar('postgresql://directo/vicehub');

        expect(config.datasource.url).toBe('postgresql://directo/vicehub');
    });

    /**
     * Num Postgres normal não há dois endereços, e exigir a variável
     * seria pedir uma coisa que não existe.
     */
    it('e pelo do costume quando não há outro', async () => {
        const config = await carregar();

        expect(config.datasource.url).toBe('postgresql://pelo-pool/vicehub');
    });
});
