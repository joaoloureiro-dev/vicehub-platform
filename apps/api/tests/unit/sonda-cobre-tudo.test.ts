import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A sonda vê os módulos todos que têm porta.
 *
 * `scripts/sondar.mjs` tenta, com a conta de outra pessoa, tudo o que
 * um dono pode fazer, e exige que a API recuse. Serve de pouco se um
 * módulo novo ficar de fora dela — e um módulo que ninguém sonda é
 * exactamente onde a porta fica encostada.
 *
 * Este teste é a ligação: as rotas que chamam `fastify.authorize(`
 * dizem quais são os módulos com porta, e a sonda tem de falar de cada
 * um. Quem acrescenta um módulo autorizado acrescenta uma sonda, ou
 * escreve aqui porque é que ele não precisa.
 *
 * Não substitui correr a sonda — isso precisa de uma API de pé, e não
 * corre no CI. Garante só que ela não fica para trás do produto.
 */
const RAIZ = join(import.meta.dirname, '../..');

const SONDA = readFileSync(join(RAIZ, 'scripts/sondar.mjs'), 'utf8');

/**
 * Os módulos cujas rotas exigem uma permissão.
 *
 * Lidos do código e não de uma lista à mão, pela mesma razão de
 * sempre: uma lista à mão envelhece no dia em que alguém acrescenta um
 * módulo e se esquece dela.
 */
const comPorta = (): string[] => {
    const modulos = join(RAIZ, 'src/modules');

    return readdirSync(modulos, { withFileTypes: true })
        .filter((entrada) => entrada.isDirectory())
        .filter((entrada) => {
            const pasta = join(modulos, entrada.name);

            return readdirSync(pasta)
                .filter((ficheiro) => ficheiro.endsWith('.routes.ts'))
                .some((ficheiro) =>
                    readFileSync(join(pasta, ficheiro), 'utf8')
                        .includes('fastify.authorize('));
        })
        .map((entrada) => entrada.name);
};

/**
 * O que a sonda escreve nos caminhos de cada módulo.
 *
 * O nome da pasta e o prefixo da rota nem sempre são a mesma palavra —
 * as filiações vivem debaixo de `/servers` e de `/crews`, e o `ingest`
 * debaixo de `/servers/:id/api-keys` —, por isso o que se procura é o
 * que a sonda tem mesmo de pedir para lá chegar.
 */
const PEDACO: Record<string, string> = {
    affiliations: '/affiliations/',
    crews: '/crews/',
    events: '/events/crews/',
    forum: '/forum/topics/',
    ingest: '/api-keys',
    market: '/market/listings/',
    servers: '/servers/',
    subscriptions: '/subscriptions/',
    treasury: '/treasury/crews/',
};

describe('a sonda adversarial', () => {
    it('tenta alguma coisa em cada módulo que tem porta', () => {
        const esquecidos = comPorta().filter((modulo) => {
            const pedaco = PEDACO[modulo];

            return pedaco === undefined || !SONDA.includes(pedaco);
        });

        expect(esquecidos).toEqual([]);
    });

    /**
     * E cada sonda corre duas vezes.
     *
     * É o que a faz valer alguma coisa: a primeira versão disto deu
     * trinta e cinco portas fechadas, e três delas fechavam-se com 404
     * porque eu tinha escrito o caminho mal. Sem o dono a conseguir, um
     * caminho errado passa por porta trancada.
     */
    it('e exige que o dono consiga o que o intruso não consegue', () => {
        expect(SONDA).toMatch(/const permitido = r2\.status < 400/u);
        expect(SONDA).toMatch(/const passa = recusado && permitido/u);
    });

    /**
     * E uma sonda que não prova nada conta como falha, ou o silêncio
     * dela volta a parecer uma casa bem fechada.
     */
    it('e sai com queixa quando alguma não prova nada', () => {
        expect(SONDA).toMatch(/process\.exitCode = 1/u);
    });
});
