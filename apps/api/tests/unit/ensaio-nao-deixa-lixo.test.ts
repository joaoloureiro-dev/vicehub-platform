import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O ensaio de instalação apaga o que cria.
 *
 * `scripts/ensaiar.mjs` corre contra uma instalação nova e faz o que a
 * primeira pessoa faria: conta, crew, servidor, tópico, anúncio. É para
 * se correr no dia do deploy, e às vezes contra uma plataforma que já
 * está aberta — onde uma crew chamada "Crew do ensaio 7075405" é lixo
 * que alguém vai ter de ir apagar à mão.
 *
 * Por isso desfaz o que fez, e acaba por apagar a própria conta. Este
 * teste não corre o ensaio, que precisa de uma API de pé; guarda as
 * partes dele que, se desaparecessem, deixavam o ensaio a passar na
 * mesma e a sujar a base.
 */
const RAIZ = join(import.meta.dirname, '../..');

const ENSAIO = readFileSync(join(RAIZ, 'scripts/ensaiar.mjs'), 'utf8');

describe('o ensaio de instalação nova', () => {
    /**
     * Cada coisa que o ensaio cria tem uma linha que a apaga.
     *
     * A ligação é pelo caminho: quem acrescentar ao ensaio uma coisa
     * nova acrescenta-a aqui, ou o teste não dá por ela — e é por isso
     * que a lista diz o que apaga e não quantas linhas tem.
     */
    const APAGA: Record<string, string> = {
        'o anúncio': '/market/listings/',
        'o tópico': '/forum/topics/',
        'o servidor': '/servers/',
        'a crew': '/crews/',
        'a conta': '/users/me',
    };

    it('apaga tudo o que cria', () => {
        const esquecidos = Object.entries(APAGA).filter(
            ([nome, caminho]) =>
                !ENSAIO.includes(`await limpar('${nome}', \`${caminho}`)
                && !ENSAIO.includes(`await limpar('${nome}', '${caminho}'`),
        );

        expect(esquecidos.map(([nome]) => nome)).toEqual([]);
    });

    /**
     * E a conta apagada tem de deixar de entrar.
     *
     * Apagar a conta é a última coisa que o ensaio faz, e a única que
     * não se pode confirmar a olho depois — a seguir já não há sessão
     * para perguntar nada. Se o 401 deixasse de ser exigido, uma conta
     * que continuasse a entrar depois de apagada passava despercebida.
     */
    it('e confirma que a conta apagada já não entra', () => {
        expect(ENSAIO).toMatch(/a conta apagada já não entra/u);
        expect(ENSAIO).toMatch(/espera: \(status\) => status === 401/u);
    });

    /**
     * E o que ficar por apagar é dito, e conta como falha. Um ensaio
     * que limpa mal e diz que está tudo bem é pior do que um que não
     * limpa: deixa lixo **e** a ideia de que não deixou.
     */
    it('e queixa-se do que ficou para trás', () => {
        expect(ENSAIO).toMatch(/ficou por apagar/u);
        expect(ENSAIO).toMatch(/process\.exitCode = mau \? 1 : 0/u);
    });

    /**
     * O controlo, como na varredura e na sonda: um passo que não pode
     * correr bem, e a exigência de que o ensaio dê por ele. Um ensaio
     * que passa sempre não prova que a instalação está de pé.
     */
    it('e não se acredita nele se o controlo passar', () => {
        expect(ENSAIO).toMatch(/controloApanhado/u);
        expect(ENSAIO).toMatch(/O CONTROLO PASSOU/u);
    });
});
