import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { criarTools } from '../src/i18n/tools.js';
import { useTools } from '../src/i18n/i18n.js';
import { montarEcra } from './helpers.js';

/**
 * Uma data escreve-se de uma maneira só.
 *
 * Havia três. A das ferramentas do idioma, que é a certa. Uma escrita
 * à mão no módulo dos eventos, **presa ao `pt-PT`** — as datas dos
 * eventos apareciam em português a franceses e a espanhóis, e ninguém
 * dava por isso porque o formato continua a parecer uma data. E uma
 * terceira numa conversa do mercado, um `toLocaleString` sem opções,
 * que traz os **segundos**: cada mensagem trazia "9:52:32" ao lado do
 * nome de quem escreveu.
 *
 * Três maneiras de escrever a mesma coisa é a espécie de diferença que
 * ninguém se lembra de ter decidido, e que se descobre quando um
 * utilizador pergunta porque é que a data está noutra língua.
 */
const FONTES = path.resolve(import.meta.dirname, '../src');

const ficheiros = (pasta: string): string[] =>
    readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
        const caminho = path.join(pasta, entrada.name);

        if (entrada.isDirectory()) {
            return ficheiros(caminho);
        }

        return /\.tsx?$/u.test(entrada.name) ? [caminho] : [];
    });

describe('as datas do produto', () => {
    /**
     * `toLocaleString` sem opções traz os segundos, e com opções é a
     * mesma decisão escrita outra vez. Há um sítio onde ela se toma.
     */
    it('escrevem-se num sítio só', () => {
        const fora = ficheiros(FONTES).filter(
            (caminho) =>
                !caminho.endsWith(path.join('i18n', 'tools.ts'))
                && readFileSync(caminho, 'utf8').includes('toLocaleString('),
        );

        expect(fora).toEqual([]);
    });

    /**
     * E nenhum ecrã escolhe um idioma por sua conta. O `pt-PT` escrito
     * à mão nos eventos foi exatamente isto: uma decisão de idioma
     * tomada longe de onde o idioma se decide.
     */
    it('e nenhum ecrã escolhe o idioma por sua conta', () => {
        const presos = ficheiros(FONTES).filter((caminho) =>
            /'(pt|en|es|fr)-[A-Z]{2}'/u.test(readFileSync(caminho, 'utf8')),
        );

        expect(presos).toEqual([]);
    });
});

/** O que um ecrã recebe quando pede as ferramentas do idioma. */
const Sonda = ({ iso }: { iso: string }) => {
    const { quando } = useTools();

    return <span>{quando(iso)}</span>;
};

describe('a data que um ecrã escreve', () => {
    const ISO = '2026-09-26T09:52:32.000Z';

    it('é a mesma que as mensagens escrevem', async () => {
        montarEcra(<Sonda iso={ISO} />);

        await waitFor(() => {
            expect(
                screen.getByText(criarTools('en').quando(ISO)),
            ).toBeTruthy();
        });
    });

    /**
     * E não traz segundos. Numa conversa isso era uma coluna de
     * relógios ao lado de cada linha, a dizer o que ninguém perguntou.
     */
    it('e não conta os segundos', () => {
        for (const idioma of ['en', 'pt', 'es', 'fr']) {
            expect(criarTools(idioma).quando(ISO)).not.toMatch(/:\d\d:\d\d/u);
        }
    });

    /**
     * O caso que dava a cara pelo defeito: a mesma data, em dois
     * idiomas, tem de sair diferente. Com o `pt-PT` escrito à mão, saía
     * igual para toda a gente.
     */
    it('e muda com o idioma', () => {
        expect(criarTools('en').quando(ISO)).not.toBe(
            criarTools('pt').quando(ISO),
        );
    });
});
