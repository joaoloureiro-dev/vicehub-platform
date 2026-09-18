import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { en } from '../src/i18n/en.js';
import { pt } from '../src/i18n/pt.js';
import { es } from '../src/i18n/es.js';
import { fr } from '../src/i18n/fr.js';
import { criarTools } from '../src/i18n/tools.js';

/**
 * Um ecrã fala um idioma só.
 *
 * A API responde em português — todas as mensagens dela estão escritas
 * nessa língua, e estão bem assim: servem quem lê registos e quem
 * escreve código. O que não pode acontecer é chegarem ao ecrã.
 *
 * Chegavam. Cada página tratava os dois ou três códigos que conhecia e,
 * para todos os outros, mostrava `falha.message` — a frase da API. Uma
 * pessoa a usar a plataforma em inglês via português a meio do seu
 * idioma, exatamente no momento em que alguma coisa lhe correu mal e
 * mais precisava de perceber.
 *
 * O teste existe porque a regra é invisível: escrever `falha.message`
 * parece a coisa óbvia a fazer, compila, funciona em português, e só se
 * nota quando já não é a nossa língua que está no ecrã.
 */
const raiz = join(import.meta.dirname, '..', 'src');

const ficheiros = (pasta: string): { caminho: string; fonte: string }[] =>
    readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
        const caminho = join(pasta, entrada.name);

        if (entrada.isDirectory()) {
            return ficheiros(caminho);
        }

        return /\.tsx?$/.test(entrada.name)
            ? [{ caminho, fonte: readFileSync(caminho, 'utf8') }]
            : [];
    });

describe('um ecrã fala um idioma só', () => {
    /**
     * O ajudante é o único sítio que lê a mensagem da API, e lê-a para a
     * deitar fora: o que sai de lá vem sempre do dicionário.
     */
    const PODE_LER = ['lib/erro.ts', 'lib/api.ts'];

    it('nenhum ecrã mostra a mensagem que a API escreveu', () => {
        const infratores = ficheiros(raiz)
            .filter(({ caminho }) =>
                !PODE_LER.some((permitido) => caminho.endsWith(permitido)))
            .filter(({ fonte }) => /\b\w*[eE]rro\w*\.message\b|falha\.message/.test(fonte))
            .map(({ caminho }) => caminho.replace(raiz, 'src'));

        expect(
            infratores,
            'usa mensagemDoErro(falha, t): a frase da API está em português',
        ).toEqual([]);
    });

    /**
     * E os quatro dicionários dizem o mesmo conjunto de erros.
     *
     * O TypeScript já garante que nenhum tem chaves a menos — o inglês é
     * a fonte e os outros são tipados contra ele. O que ele não vê é uma
     * tradução deixada por fazer com o texto inglês lá dentro, que é
     * exatamente o mesmo problema visto do outro lado: quem lê francês a
     * apanhar uma frase em inglês.
     */
    it('traduz mesmo os erros, e não deixa o inglês nos outros', () => {
        const p = criarTools('en');
        const ingles = en(p).erros as Record<string, string>;

        for (const [nome, dicionario] of [
            ['pt', pt(criarTools('pt')).erros],
            ['es', es(criarTools('es')).erros],
            ['fr', fr(criarTools('fr')).erros],
        ] as const) {
            const porTraduzir = Object.entries(
                dicionario as Record<string, string>,
            ).filter(([codigo, texto]) => ingles[codigo] === texto);

            expect(
                porTraduzir.map(([codigo]) => `${nome}: ${codigo}`),
                'ficou com o texto inglês',
            ).toEqual([]);
        }
    });

    /** E toda a gente tem os mesmos códigos. */
    it('os quatro dicionários cobrem os mesmos códigos', () => {
        const codigos = (d: Record<string, string>) => Object.keys(d).sort();
        const doIngles = codigos(en(criarTools('en')).erros as Record<string, string>);

        expect(codigos(pt(criarTools('pt')).erros as Record<string, string>)).toEqual(doIngles);
        expect(codigos(es(criarTools('es')).erros as Record<string, string>)).toEqual(doIngles);
        expect(codigos(fr(criarTools('fr')).erros as Record<string, string>)).toEqual(doIngles);
    });

    /** Uma salvaguarda: se não lesse ficheiro nenhum, passava sempre. */
    it('lê mesmo os ficheiros que diz verificar', () => {
        expect(ficheiros(raiz).length).toBeGreaterThan(50);
    });
});
