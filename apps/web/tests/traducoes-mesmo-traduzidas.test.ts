import { describe, expect, it } from 'vitest';

import { en } from '../src/i18n/en.js';
import { es } from '../src/i18n/es.js';
import { fr } from '../src/i18n/fr.js';
import { pt } from '../src/i18n/pt.js';
import { criarTools } from '../src/i18n/tools.js';

/**
 * Uma tradução por fazer não dá erro nenhum.
 *
 * O TypeScript garante que as quatro têm as mesmas chaves, e há um
 * teste que garante que nenhuma sobra. O que nada via é a chave que
 * existe nos quatro idiomas **com a frase inglesa lá dentro** — porque
 * alguém copiou o bloco para começar a traduzir e ficou por ali. Compila,
 * passa em tudo, e só se nota quando já está no ecrã de alguém.
 *
 * Isto apareceu de um mutante: trocar a frase francesa pela inglesa não
 * fazia falhar um único dos seiscentos e oitenta testes.
 *
 * As setecentas e setenta e oito chaves são comparadas com o inglês, e
 * as que são mesmo iguais estão escritas abaixo com a razão.
 */
const IGUAIS_DE_PROPOSITO: Readonly<Record<string, readonly string[]>> = {
    'o vocabulário do produto, que entra como está nos quatro idiomas': [
        'pt:nav.crews',
        'pt:crews.titulo',
        'pt:crews.minhasCrews',
        'pt:crews.tag',
        'pt:crews.xp',
        'pt:planos.premium',
        'pt:perfil.premium',
        'pt:premium.etiqueta',
        'pt:filiacao.crewsDoServidor',
        'es:nav.crews',
        'es:crews.titulo',
        'es:crews.minhasCrews',
        'es:crews.xp',
        'es:planos.premium',
        'es:perfil.premium',
        'es:premium.etiqueta',
        'es:filiacao.crewsDoServidor',
        'fr:nav.crews',
        'fr:crews.titulo',
        'fr:crews.minhasCrews',
        'fr:crews.tag',
        'fr:crews.xp',
        'fr:planos.premium',
        'fr:perfil.premium',
        'fr:premium.etiqueta',
        'fr:filiacao.crewsDoServidor',
    ],

    'a mesma palavra nos dois idiomas, e traduzi-la daria pior': [
        'pt:auth.email',
        'pt:auth.password',
        'pt:servidores.online',
        'pt:servidores.offline',
        'pt:legal.rodape',
        'pt:perfil.avatar',
        'pt:perfil.banner',
        'pt:categorias.marketing',
        'es:auth.email',
        'es:legal.rodape',
        'es:perfil.plano',
        'es:perfil.avatar',
        'es:perfil.banner',
        'es:categorias.marketing',
        'fr:nav.avisos',
        'fr:nav.forum',
        'fr:forum.titulo',
        'fr:crews.descricao',
        'fr:servidores.descricao',
        'fr:tesouraria.descricao',
        'fr:tesouraria.nota',
        'fr:eventos.descricao',
        'fr:eventos.lugares',
        'fr:mercado.categorias.service',
        'fr:mercado.conversas',
        'fr:perfil.avatar',
        'fr:categorias.contribution',
        'fr:categorias.marketing',
        'fr:categorias.service',
        'fr:zonaPerigo.confirmacao',
    ],

    'um exemplo, e não uma frase': ['fr:chaves.nomeExemplo'],
};

const PERMITIDAS = new Set(Object.values(IGUAIS_DE_PROPOSITO).flat());

/** Cada frase do dicionário, com o caminho até ela. */
const achatar = (valor: unknown, prefixo = ''): [string, string][] => {
    if (typeof valor === 'string') {
        return [[prefixo, valor]];
    }

    /*
     * As funções ficam de fora: uma chave que recebe um nome ou um
     * número só existe depois de lhe darem um, e compará-las obrigava a
     * inventar argumentos que não são os que o ecrã lhe dá.
     */
    if (typeof valor !== 'object' || valor === null) {
        return [];
    }

    return Object.entries(valor).flatMap(([chave, dentro]) =>
        achatar(dentro, prefixo === '' ? chave : `${prefixo}.${chave}`));
};

const INGLES = new Map(achatar(en(criarTools('en'))));

describe('as traduções estão mesmo traduzidas', () => {
    it.each([
        ['pt', pt],
        ['es', es],
        ['fr', fr],
    ] as const)('%s não é o inglês copiado', (idioma, dicionario) => {
        const porTraduzir = achatar(dicionario(criarTools(idioma)))
            .filter(([chave, frase]) => INGLES.get(chave) === frase)
            .map(([chave]) => `${idioma}:${chave}`)
            .filter((chave) => !PERMITIDAS.has(chave));

        expect(
            porTraduzir,
            'estas frases estão em inglês num dicionário que não é o inglês',
        ).toEqual([]);
    });

    /**
     * E uma exceção que já não é igual é uma exceção a mais.
     *
     * Fica escrita a dizer que uma frase pode estar por traduzir, muito
     * depois de ela já estar. Lê-se como permissão e deixa passar o caso
     * seguinte — que é o mesmo mal das exceções mortas em qualquer outro
     * sítio.
     */
    it('e não sobra nenhuma exceção', () => {
        const vivas = new Set(
            ([['pt', pt], ['es', es], ['fr', fr]] as const).flatMap(
                ([idioma, dicionario]) =>
                    achatar(dicionario(criarTools(idioma)))
                        .filter(([chave, frase]) => INGLES.get(chave) === frase)
                        .map(([chave]) => `${idioma}:${chave}`),
            ),
        );

        const mortas = [...PERMITIDAS].filter((chave) => !vivas.has(chave));

        expect(mortas, 'estas já não são iguais ao inglês').toEqual([]);
    });
});
