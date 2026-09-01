import { describe, expect, it } from 'vitest';

import {
    NO_APPEARANCE,
    toAppearanceColumns,
    updateAppearanceSchema,
    visibleAppearance,
} from '../../src/shared/appearance.js';

describe('personalização de perfil', () => {
    const gravado = {
        banner_url: 'https://cdn.vicehub.gg/banners/vk.png',
        accent_color: '#1B9AAA',
    };

    describe('o que fica visível', () => {
        it('mostra o que está gravado a quem tem plano ativo', () => {
            expect(visibleAppearance(gravado, true)).toEqual({
                bannerUrl: gravado.banner_url,
                accentColor: gravado.accent_color,
            });
        });

        /**
         * Sem esconder, bastava pagar um mês para ficar com a
         * personalização para sempre: o que se vende é exibi-la, não
         * defini-la uma vez.
         */
        it('esconde o que está gravado quando o plano termina', () => {
            expect(visibleAppearance(gravado, false)).toEqual(NO_APPEARANCE);
        });

        /**
         * Esconder não é apagar. Os valores continuam na base de dados
         * para que quem volte a subscrever reencontre o que tinha.
         */
        it('volta a mostrar o mesmo quando o plano é retomado', () => {
            visibleAppearance(gravado, false);

            expect(visibleAppearance(gravado, true).accentColor).toBe('#1B9AAA');
        });

        it('devolve a estrutura mesmo vazia, para não haver dois caminhos', () => {
            expect(
                Object.keys(visibleAppearance(gravado, false)).sort(),
            ).toEqual(['accentColor', 'bannerUrl']);
        });
    });

    describe('validação do que entra', () => {
        it('aceita uma cor em hexadecimal de seis dígitos', () => {
            expect(
                updateAppearanceSchema.parse({ accentColor: '#1b9aaa' }),
            ).toEqual({ accentColor: '#1b9aaa' });
        });

        it.each(['1B9AAA', '#1B9AA', '#1B9AAAA', '#GGGGGG', 'red', '#abc'])(
            'recusa %s como cor',
            (valor) => {
                expect(
                    updateAppearanceSchema.safeParse({ accentColor: valor })
                        .success,
                ).toBe(false);
            },
        );

        it('recusa um banner que não seja um endereço', () => {
            expect(
                updateAppearanceSchema.safeParse({ bannerUrl: 'nao-e-um-url' })
                    .success,
            ).toBe(false);
        });

        /**
         * Sem esta distinção não haveria forma de tirar um banner depois
         * de o ter posto.
         */
        it('aceita null para limpar um campo', () => {
            expect(updateAppearanceSchema.parse({ bannerUrl: null })).toEqual({
                bannerUrl: null,
            });
        });

        it('recusa um pedido sem nada para alterar', () => {
            expect(updateAppearanceSchema.safeParse({}).success).toBe(false);
        });

        it('recusa um endereço acima do limite da coluna', () => {
            const comprido = `https://cdn.vicehub.gg/${'a'.repeat(2048)}`;

            expect(
                updateAppearanceSchema.safeParse({ bannerUrl: comprido }).success,
            ).toBe(false);
        });
    });

    describe('o que é escrito', () => {
        /**
         * Uma chave ausente deixa o campo como está; uma chave presente
         * a null limpa-o. Se toAppearanceColumns escrevesse undefined,
         * não indicar o banner apagava-o.
         */
        it('não toca no campo que o pedido não indica', () => {
            expect(toAppearanceColumns({ accentColor: '#1B9AAA' })).toEqual({
                accent_color: '#1B9AAA',
            });
            expect('banner_url' in toAppearanceColumns({ accentColor: '#1B9AAA' })).toBe(
                false,
            );
        });

        it('limpa o campo que o pedido indica a null', () => {
            expect(toAppearanceColumns({ bannerUrl: null })).toEqual({
                banner_url: null,
            });
        });

        it('escreve os dois campos quando os dois são indicados', () => {
            expect(
                toAppearanceColumns({
                    bannerUrl: 'https://cdn.vicehub.gg/b.png',
                    accentColor: '#1B9AAA',
                }),
            ).toEqual({
                banner_url: 'https://cdn.vicehub.gg/b.png',
                accent_color: '#1B9AAA',
            });
        });
    });
});
