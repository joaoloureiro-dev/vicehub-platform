import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Que versão de Node é preciso, dita uma vez.
 *
 * São quatro sítios a responder à mesma pergunta: os `engines` da raiz,
 * os `engines` de cada workspace, o `.nvmrc` e o `node-version` da CI.
 * Nenhum deles é lido pelos outros, e por isso divergem em silêncio.
 *
 * Divergiram: a raiz dizia `>=22.0.0` e os três workspaces `>=24.0.0`.
 * A raiz é a que se lê primeiro, e prometia que o 22 servia — e depois
 * um `npm ci` numa máquina com 22 rebentava com `EBADENGINE` a apontar
 * para um workspace, sem dizer qual é a versão certa nem onde a
 * procurar. Foi encontrado a tentar reconstruir o ambiente de raiz.
 *
 * O `.nvmrc` existe para que ninguém tenha de descobrir isto: quem usa
 * nvm, fnm ou asdf recebe a versão certa ao entrar na pasta.
 */
const RAIZ = path.resolve(import.meta.dirname, '../../../..');

const ler = (relativo: string): string =>
    readFileSync(path.join(RAIZ, relativo), 'utf8');

/** O mínimo que um `engines` exige, como número maior. */
const minimoDe = (intervalo: string): number => {
    const achado = /(\d+)/u.exec(intervalo)?.[1];

    expect(achado, `não consegui ler a versão de "${intervalo}"`).toBeDefined();

    return Number(achado);
};

const engines = (relativo: string): { node: number; npm: number } => {
    const pacote = JSON.parse(ler(relativo)) as {
        engines?: { node?: string; npm?: string };
    };

    expect(
        pacote.engines,
        `${relativo} não declara engines`,
    ).toBeDefined();

    return {
        node: minimoDe(pacote.engines?.node ?? ''),
        npm: minimoDe(pacote.engines?.npm ?? ''),
    };
};

const WORKSPACES = [
    'apps/api/package.json',
    'apps/web/package.json',
    'packages/database/package.json',
];

describe('que Node é preciso', () => {
    const daRaiz = engines('package.json');

    it('a raiz exige o mesmo que os workspaces', () => {
        for (const relativo of WORKSPACES) {
            expect(engines(relativo), relativo).toEqual(daRaiz);
        }
    });

    /**
     * E o `.nvmrc` diz a mesma versão, porque é o único destes quatro
     * que uma ferramenta lê sozinha.
     */
    it('e o .nvmrc diz a mesma versão', () => {
        expect(Number(ler('.nvmrc').trim())).toBe(daRaiz.node);
    });

    /**
     * E a CI corre nessa versão. Uma CI verde numa versão que ninguém
     * usa localmente é uma CI que não prova nada sobre o que sai daqui.
     */
    it('e a CI corre nessa versão', () => {
        const fluxo = ler('.github/workflows/ci.yml');

        const achado = /node-version:\s*(\d+)/u.exec(fluxo)?.[1];

        expect(achado, 'o ci.yml não fixa uma versão de Node').toBeDefined();
        expect(Number(achado)).toBe(daRaiz.node);
    });
});
