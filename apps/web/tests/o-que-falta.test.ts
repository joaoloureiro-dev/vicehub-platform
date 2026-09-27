import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { OPERATOR, operatorIsComplete } from '../src/legal/operator.js';

/**
 * O que o readme diz que falta, e o que falta mesmo.
 *
 * A secção de estado do readme é a resposta do projeto à pergunta "o
 * que falta para isto abrir?". Esteve meses a dizer que o mercado não
 * tinha código nenhum e que não havia histórico de servidores para
 * ordenar nada — as duas coisas construídas entretanto. Um documento de
 * estado errado é pior do que nenhum: quem o lê toma decisões por ele.
 *
 * Isto liga a parte mecanizável: **enquanto a identificação de quem
 * opera estiver por preencher, o readme tem de o dizer; no dia em que
 * for preenchida, este teste falha até alguém o ir riscar de lá.** É o
 * mesmo princípio dos testes que prendem os termos e a política ao
 * código que descrevem.
 */
const README = readFileSync(
    path.resolve(import.meta.dirname, '../../../readme.md'),
    'utf8',
);

const oQueFalta = (): string => {
    const inicio = README.indexOf('### O que falta para abrir ao público');

    expect(inicio, 'o readme não tem a secção do que falta').toBeGreaterThan(-1);

    return README.slice(inicio, README.indexOf('---', inicio));
};

describe('a secção de estado do readme', () => {
    it('diz o que falta, e não só o que está feito', () => {
        expect(oQueFalta().length).toBeGreaterThan(200);
    });

    /**
     * Os documentos legais anunciam-se como não definitivos enquanto
     * faltar um campo da identificação. Enquanto for assim, o readme
     * tem de o dizer também: é a coisa que impede a plataforma de
     * cobrar a alguém.
     */
    it('nomeia a identificação legal enquanto ela faltar', () => {
        if (operatorIsComplete(OPERATOR)) {
            expect(
                oQueFalta(),
                'a identificação legal já está preenchida: risca-a do readme',
            ).not.toContain('operator.ts');

            return;
        }

        expect(oQueFalta()).toContain('operator.ts');
    });

    /**
     * E o `db:seed`, que é o primeiro erro que aparece numa base de
     * dados vazia e não se lê como configuração em falta: o registo
     * responde 500 porque o cargo base não existe.
     */
    it('e lembra o db:seed, que ninguém adivinha', () => {
        expect(oQueFalta()).toContain('db:seed');
    });
});
