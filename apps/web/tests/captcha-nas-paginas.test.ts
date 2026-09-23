import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { OPERATOR } from '../src/legal/operator.js';
import { privacyDocument } from '../src/legal/privacy.document.js';

/**
 * Onde é que o anti-robô corre, e onde é que a política diz que corre.
 *
 * A política de privacidade conta as páginas: "corre nessas três e em
 * mais lado nenhum". É uma frase boa de ler e péssima de manter — foi
 * escrita quando o anti-robô estava em duas páginas, ficou a dizer duas
 * depois de entrar na recuperação de password, e ninguém reparou porque
 * nada no projeto ligava uma coisa à outra.
 *
 * É o caso de sempre: **duas grafias da mesma regra**. Uma está nos
 * componentes que montam o `Captcha`, a outra numa frase em inglês num
 * documento legal. Este teste é a ligação que faltava, e falha no dia
 * em que uma quarta página o montar.
 */
const PAGINAS = path.resolve(import.meta.dirname, '../src/auth/pages');

/**
 * Os números por extenso, que é como um documento os escreve.
 *
 * Só até cinco de propósito: uma plataforma com seis formulários de
 * autenticação tem um problema maior do que este teste, e o erro de
 * índice é a forma certa de o dizer.
 */
const POR_EXTENSO = ['no', 'one', 'two', 'three', 'four', 'five'];

/**
 * Como é que o documento chama cada um destes formulários.
 *
 * Contar as páginas não chega: a política nomeia-as, e nomeá-las mal é
 * o mesmo erro com outra cara. O mapa é escrito à mão de propósito —
 * `login.page.tsx` não se traduz sozinho para "sign-in", e uma página
 * nova sem entrada aqui faz o teste falhar, que é como se obriga quem
 * a acrescentar a ir escrevê-la no documento.
 */
const COMO_SE_CHAMAM: Readonly<Record<string, string>> = {
    'login.page.tsx': 'sign-in',
    'register.page.tsx': 'sign-up',
    'request-reset.page.tsx': 'password-recovery',
};

/** O que a política diz, linha a linha. */
const linhasDaPolitica = (): string[] =>
    privacyDocument(OPERATOR).sections.flatMap((seccao) => [
        ...seccao.body,
        ...(seccao.list ?? []),
    ]);

/**
 * Só as frases que falam do anti-robô.
 *
 * Procurar os nomes no documento inteiro não provava nada: a
 * recuperação de password também é nomeada onde se fala do fornecedor
 * de email, e essa frase sozinha bastava para o teste passar com a
 * frase do anti-robô já errada. Foi o que um mutante mostrou.
 */
const ANTI_ROBO = 'anti-robot check';

const frasesDoAntiRobo = (): string =>
    linhasDaPolitica()
        .filter((linha) => linha.includes(ANTI_ROBO))
        .join('\n');

const paginasComCaptcha = (): string[] =>
    readdirSync(PAGINAS)
        .filter((nome) => nome.endsWith('.tsx'))
        .filter((nome) =>
            /<Captcha\b/.test(readFileSync(path.join(PAGINAS, nome), 'utf8')),
        )
        .sort();

describe('o anti-robô e o que a política diz dele', () => {
    it('a política conta as páginas que o montam', () => {
        const quantas = paginasComCaptcha().length;

        expect(POR_EXTENSO[quantas]).toBeDefined();
        expect(frasesDoAntiRobo()).toContain(
            `those ${POR_EXTENSO[quantas]} pages`,
        );
    });

    it('e nomeia cada um dos formulários', () => {
        const frases = frasesDoAntiRobo();

        expect(frases).not.toBe('');

        for (const pagina of paginasComCaptcha()) {
            const nome = COMO_SE_CHAMAM[pagina];

            expect(nome, `falta o nome de ${pagina}`).toBeDefined();
            expect(frases).toContain(nome);
        }
    });

    it('e são estas', () => {
        expect(paginasComCaptcha()).toEqual([
            'login.page.tsx',
            'register.page.tsx',
            'request-reset.page.tsx',
        ]);
    });
});
