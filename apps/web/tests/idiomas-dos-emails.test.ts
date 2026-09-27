import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { IDIOMAS, IDIOMA_POR_OMISSAO } from '../src/i18n/locales.js';

/**
 * A lista de idiomas está escrita duas vezes, e tem de dizer o mesmo.
 *
 * A web e a API não partilham código: a web tem os quatro dicionários e
 * a API tem os dois emails, e cada uma declara a sua lista. Isso é uma
 * regra escrita duas vezes, que é a coisa que este repositório mais
 * persegue — e como aqui não há maneira de a escrever uma vez só, prende-se
 * com um teste. É a mesma amarração que existe entre o `.env.example` e o
 * `env.ts`.
 *
 * O que isto apanha é o dia em que alguém acrescentar um quinto idioma à
 * interface e não aos emails. Nada estoira: a plataforma passa a mostrar
 * o produto em alemão e a escrever os emails em inglês, e ninguém dá por
 * isso até alguém pedir para recuperar a password.
 */
const FONTE = readFileSync(
    path.resolve(
        import.meta.dirname,
        '../../api/src/modules/mail/idiomas.ts',
    ),
    'utf8',
);

/** A lista tal como está declarada do lado da API. */
const daApi = (): string[] => {
    const achado = FONTE.match(/export const IDIOMAS = \[([^\]]+)\]/u);

    expect(achado, 'a API não declara IDIOMAS').not.toBeNull();

    return [...(achado as RegExpMatchArray)[1]!.matchAll(/'([a-z-]+)'/gu)].map(
        (codigo) => codigo[1] as string,
    );
};

describe('os idiomas da interface e os dos emails', () => {
    it('são os mesmos, e pela mesma ordem', () => {
        expect(daApi()).toEqual(IDIOMAS.map((idioma) => idioma.codigo));
    });

    it('e abrem no mesmo', () => {
        const achado = FONTE.match(
            /export const IDIOMA_POR_OMISSAO: Idioma = '([a-z-]+)'/u,
        );

        expect(achado, 'a API não declara um idioma por omissão').not.toBeNull();
        expect((achado as RegExpMatchArray)[1]).toBe(IDIOMA_POR_OMISSAO);
    });
});
