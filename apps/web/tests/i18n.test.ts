import { describe, expect, it } from 'vitest';

import { en } from '../src/i18n/en.js';
import { es } from '../src/i18n/es.js';
import { fr } from '../src/i18n/fr.js';
import { pt } from '../src/i18n/pt.js';
import { criarTools } from '../src/i18n/tools.js';
import { IDIOMAS, idiomaDoBrowser } from '../src/i18n/locales.js';

const dicionarios = {
    en: en(criarTools('en')),
    pt: pt(criarTools('pt')),
    es: es(criarTools('es')),
    fr: fr(criarTools('fr')),
};

describe('plurais', () => {
    /**
     * A razão de existir `Intl.PluralRules` em vez de `n === 1 ? a : b`.
     *
     * **Zero não se comporta da mesma maneira nos quatro idiomas.** Em
     * português e em francês usa a forma singular; em inglês e em
     * espanhol usa a plural. Um ternário escrito à mão acerta em dois e
     * falha nos outros dois, e falha em silêncio.
     *
     * É também por isto que as formas singulares de pt e fr interpolam o
     * número em vez de escreverem "1": nesses idiomas, a forma singular
     * também tem de saber dizer zero.
     */
    it('zero segue a regra de cada idioma, e não a do inglês', () => {
        expect(dicionarios.pt.crews.membros(0)).toBe('0 membro');
        expect(dicionarios.fr.crews.membros(0)).toBe('0 membre');

        expect(dicionarios.en.crews.membros(0)).toBe('0 members');
        expect(dicionarios.es.crews.membros(0)).toBe('0 miembros');
    });

    /**
     * O erro concreto que isto impede: uma forma singular com o "1"
     * escrito à mão anunciaria "1 inscrito" num evento sem ninguém.
     */
    it('nenhuma forma singular finge que zero é um', () => {
        for (const codigo of ['en', 'pt', 'es', 'fr'] as const) {
            expect(dicionarios[codigo].eventos.inscritos(0)).toContain('0');
            expect(dicionarios[codigo].crews.membros(0)).toContain('0');
        }
    });

    it('um é singular em toda a parte', () => {
        expect(dicionarios.en.crews.membros(1)).toBe('1 member');
        expect(dicionarios.pt.crews.membros(1)).toBe('1 membro');
        expect(dicionarios.es.crews.membros(1)).toBe('1 miembro');
        expect(dicionarios.fr.crews.membros(1)).toBe('1 membre');
    });

    it('dois é plural em toda a parte', () => {
        expect(dicionarios.en.crews.membros(2)).toBe('2 members');
        expect(dicionarios.pt.crews.membros(2)).toBe('2 membros');
        expect(dicionarios.es.crews.membros(2)).toBe('2 miembros');
        expect(dicionarios.fr.crews.membros(2)).toBe('2 membres');
    });

    it('a regra aplica-se também às presenças confirmadas', () => {
        expect(dicionarios.fr.eventos.comPresenca(0)).toBe('0 présence confirmée');
        expect(dicionarios.pt.eventos.comPresenca(0)).toBe(
            '0 com presença confirmada',
        );
        expect(dicionarios.en.eventos.comPresenca(0)).toBe(
            '0 attendances confirmed',
        );
    });
});

/**
 * O inglês é a fonte de verdade e os outros são tipados contra ele, por
 * isso uma chave em falta já não compila. O que o TypeScript não vê é
 * uma chave que ficou por traduzir — e para isso serve esta contagem.
 */
describe('os quatro dicionários dizem o mesmo', () => {
    const chaves = (objeto: object, prefixo = ''): string[] =>
        Object.entries(objeto).flatMap(([chave, valor]) =>
            typeof valor === 'object' && valor !== null
                ? chaves(valor as object, `${prefixo}${chave}.`)
                : [`${prefixo}${chave}`],
        );

    const referencia = chaves(dicionarios.en);

    it('têm exatamente as mesmas chaves', () => {
        for (const codigo of ['pt', 'es', 'fr'] as const) {
            expect(chaves(dicionarios[codigo]).sort()).toEqual(
                [...referencia].sort(),
            );
        }
    });

    /**
     * Uma tradução por fazer aparece como texto igual ao inglês. Algumas
     * palavras coincidem de propósito — "Crews", "Premium", "Marketing" —
     * e por isso o que se verifica é que a maior parte mudou, não que
     * mudou tudo.
     */
    it('quase nada ficou por traduzir', () => {
        const ler = (dicionario: object, caminho: string): unknown =>
            caminho
                .split('.')
                .reduce<unknown>(
                    (atual, parte) =>
                        (atual as Record<string, unknown>)[parte],
                    dicionario,
                );

        for (const codigo of ['pt', 'es', 'fr'] as const) {
            const textos = referencia.filter(
                (caminho) => typeof ler(dicionarios.en, caminho) === 'string',
            );

            const iguais = textos.filter(
                (caminho) =>
                    ler(dicionarios[codigo], caminho) ===
                    ler(dicionarios.en, caminho),
            );

            expect(iguais.length / textos.length).toBeLessThan(0.15);
        }
    });
});

describe('que idioma mostrar a quem chega', () => {
    it('segue a preferência do browser quando a conhecemos', () => {
        expect(idiomaDoBrowser(['fr-CA', 'en-US'])).toBe('fr');
        expect(idiomaDoBrowser(['pt-BR'])).toBe('pt');
        expect(idiomaDoBrowser(['es-MX'])).toBe('es');
    });

    it('ignora a região: pt-BR vale tanto como pt', () => {
        expect(idiomaDoBrowser(['pt-PT'])).toBe(
            idiomaDoBrowser(['pt-BR']),
        );
    });

    it('salta o que não sabemos falar e fica no que sabemos', () => {
        expect(idiomaDoBrowser(['de-DE', 'it-IT', 'pt'])).toBe('pt');
    });

    it('sem nada que reconheça, inglês', () => {
        expect(idiomaDoBrowser(['de-DE'])).toBe('en');
        expect(idiomaDoBrowser([])).toBe('en');
    });
});

describe('o seletor', () => {
    /**
     * Cada opção diz o seu nome no seu próprio idioma: quem procura
     * português procura "Português", e não "Portuguese" numa lista que
     * ainda não sabe ler.
     */
    it('nomeia cada idioma na própria língua', () => {
        expect(IDIOMAS.map((idioma) => idioma.nome)).toEqual([
            'English',
            'Português',
            'Español',
            'Français',
        ]);
    });
});
