import { describe, expect, it } from 'vitest';

import {
    descreverProblemas,
    verificarBaseDeDados,
} from '../../src/config/startup-checks.js';

/**
 * O caso que isto existe para apanhar: migrações aplicadas, seed
 * esquecido.
 *
 * A base de dados fica com todas as tabelas e nenhum cargo. Tudo
 * arranca, tudo parece bem, e o primeiro registo devolve 500 sem
 * explicação — porque criar conta precisa do cargo base.
 */
const base = (encontrado: unknown) =>
    ({
        role: { findFirst: () => Promise.resolve(encontrado) },
    }) as never;

describe('a verificação de arranque', () => {
    it('não se queixa quando o cargo base existe', async () => {
        expect(await verificarBaseDeDados(base({ id: 'papel-1' }))).toEqual([]);
    });

    it('acusa a falta do cargo base', async () => {
        const problemas = await verificarBaseDeDados(base(null));

        expect(problemas).toHaveLength(1);
    });

    /**
     * A mensagem é para quem está a arrancar o projeto pela primeira vez
     * e não conhece o código. Tem de dizer o comando, não o nome de uma
     * tabela.
     */
    it('diz o comando que resolve, e não só o que falta', async () => {
        const problemas = await verificarBaseDeDados(base(null));

        expect(descreverProblemas(problemas)).toContain('npm run db:seed');
    });

    /**
     * Perguntar pelo cargo base, e não contar cargos: uma contagem maior
     * que zero passaria com um seed antigo a que faltasse precisamente
     * este — e é este que o registo precisa.
     */
    it('pergunta pelo cargo base, e não por um cargo qualquer', async () => {
        let perguntado: unknown = null;

        await verificarBaseDeDados({
            role: {
                findFirst: (argumentos: unknown) => {
                    perguntado = argumentos;
                    return Promise.resolve({ id: 'papel-1' });
                },
            },
        } as never);

        expect(perguntado).toMatchObject({
            where: { slug: 'player', is_deleted: false },
        });
    });
});
