import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A porta por onde um XSS voltaria a entrar.
 *
 * A aplicação é servida com uma política de conteúdo sem
 * `'unsafe-inline'`, e a linha dela não passa onde parece: o `style` do
 * React é aplicado pelo CSSOM, que a política não governa, e por isso a
 * cor de destaque de uma crew — dado de quem a criou — funciona. O que
 * ela recusa é o atributo `style` que chega como markup.
 *
 * `dangerouslySetInnerHTML` é a única forma de a aplicação passar a
 * injetar markup, e com ele voltaria tudo: o `style` bloqueado seria o
 * menor dos problemas ao lado do resto que se injeta com HTML. Sem este
 * teste, um componente novo que o usasse não seria travado por nada.
 */
const RAIZ = path.resolve(import.meta.dirname, '../src');

const ficheiros = (pasta: string): string[] =>
    readdirSync(pasta).flatMap((nome) => {
        const caminho = path.join(pasta, nome);

        if (statSync(caminho).isDirectory()) {
            return ficheiros(caminho);
        }

        return /\.tsx?$/.test(nome) ? [caminho] : [];
    });

describe('o que a política de conteúdo protege', () => {
    it('nenhum componente injeta markup', () => {
        const culpados = ficheiros(RAIZ).filter((caminho) =>
            /dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML/.test(
                readFileSync(caminho, 'utf8'),
            ),
        );

        expect(culpados.map((caminho) => path.relative(RAIZ, caminho))).toEqual(
            [],
        );
    });

    /**
     * O `index.html` é a única página servida como markup, e é onde um
     * `style` inline seria mesmo recusado — ao contrário do que o React
     * escreve depois de a página arrancar.
     */
    it('a página que arranca não traz estilos nem scripts dentro de si', () => {
        const html = readFileSync(
            path.resolve(import.meta.dirname, '../index.html'),
            'utf8',
        );

        expect(html).not.toMatch(/\sstyle\s*=/);
        expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/);
    });
});
