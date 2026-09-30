import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Quem corre código nosso gera o cliente do Prisma primeiro.
 *
 * O cliente é gerado a partir do esquema e não está no repositório, e é
 * dele que saem os enums que o `rbac.ts` importa. Num clone acabado de
 * fazer ele não existe — e um comando que carregue o nosso código sem o
 * gerar morre a carregar o módulo, antes de qualquer linha nossa poder
 * dizer o que falta:
 *
 *     SyntaxError: The requested module '@prisma/client' does not
 *     provide an export named 'PermissionScope'
 *
 * Aconteceu a preparar uma instalação nova: `npm run db:seed` foi o
 * primeiro comando depois do `npm ci`, e essa é a ordem natural —
 * preparar a base de dados antes de arrancar a aplicação. O `npm run dev`
 * gera o cliente sozinho, mas quem prepara a base primeiro nunca chega
 * lá.
 *
 * Por isso o `prisma generate` está dentro de cada um destes comandos, e
 * não apenas escrito no readme: um passo que vive só na documentação é um
 * passo que alguém vai saltar, e o erro que recebe não diz qual era.
 *
 * Este teste existe para o dia em que alguém acrescentar o sexto comando.
 */
const PACOTE = path.resolve(
    import.meta.dirname,
    '../../../../packages/database/package.json',
);

const scripts = (
    JSON.parse(readFileSync(PACOTE, 'utf8')) as {
        scripts: Record<string, string>;
    }
).scripts;

/**
 * Os que correm `tsx` correm código nosso.
 *
 * Os outros são o CLI do Prisma a falar com a base de dados — esses não
 * carregam nada nosso e não precisam do cliente gerado.
 */
const comCodigoNosso = Object.entries(scripts).filter(([, comando]) =>
    comando.includes('tsx '));

describe('os comandos que carregam o nosso código', () => {
    it('existem, e este teste não está a olhar para uma lista vazia', () => {
        expect(comCodigoNosso.length).toBeGreaterThan(0);
    });

    it('e cada um gera o cliente do Prisma antes de arrancar', () => {
        const semGerar = comCodigoNosso
            .filter(([, comando]) => !comando.includes('prisma generate'))
            .map(([nome]) => nome);

        expect(semGerar).toEqual([]);
    });

    /**
     * E gera **antes**, não depois: `tsx … && prisma generate` passava a
     * verificação de cima e falhava exactamente da mesma maneira.
     */
    it('e gera antes, não depois', () => {
        const foraDeOrdem = comCodigoNosso
            .filter(
                ([, comando]) =>
                    comando.indexOf('prisma generate')
                    > comando.indexOf('tsx '),
            )
            .map(([nome]) => nome);

        expect(foraDeOrdem).toEqual([]);
    });
});
