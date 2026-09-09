import { describe, expect, it } from 'vitest';

import { ApiKeyService } from '../../src/modules/ingest/services/api-key.service.js';

/**
 * As chaves que deixam um servidor de FiveM falar connosco.
 *
 * O que aqui interessa é o que a chave **não** deixa acontecer: o
 * segredo não volta a existir depois de gerado, uma chave mal formada
 * não chega à base de dados, e a comparação é entre resumos.
 */
describe('ApiKeyService', () => {
    const service = new ApiKeyService();

    describe('gerar', () => {
        it('devolve a chave inteira, o prefixo e o resumo', () => {
            const chave = service.generate();

            expect(chave.completa.startsWith(`vh_${chave.prefix}_`)).toBe(true);
            expect(chave.hash).toHaveLength(64);
        });

        /**
         * O resumo é o que fica gravado. Se a chave inteira aparecesse
         * lá dentro, guardá-lo era guardar a chave.
         */
        it('o resumo não contém o segredo', () => {
            const chave = service.generate();
            const segredo = service.parse(chave.completa)?.segredo as string;

            expect(chave.hash).not.toContain(segredo);
            expect(chave.hash).toBe(service.hash(segredo));
        });

        it('duas chaves nunca saem iguais', () => {
            const primeira = service.generate();
            const segunda = service.generate();

            expect(primeira.completa).not.toBe(segunda.completa);
            expect(primeira.prefix).not.toBe(segunda.prefix);
        });

        /**
         * A marca à frente serve para uma chave encontrada solta ser
         * reconhecível — por quem a deve revogar e pelos varredores de
         * segredos.
         */
        it('leva a marca da plataforma à frente', () => {
            expect(service.generate().completa.startsWith('vh_')).toBe(true);
        });
    });

    describe('ler uma chave apresentada', () => {
        it('separa o prefixo do segredo', () => {
            const chave = service.generate();
            const partes = service.parse(chave.completa);

            expect(partes?.prefix).toBe(chave.prefix);
            expect(service.hash(partes?.segredo as string)).toBe(chave.hash);
        });

        /**
         * O segredo é base64url, e esse alfabeto inclui `_`. Partir a
         * chave por **todos** os underscores desfazia o segredo e
         * recusava chaves boas — foi o que este teste apanhou.
         */
        it('aceita um segredo que traz underscores dentro', () => {
            const partes = service.parse('vh_abc123_seg_re_do');

            expect(partes).toEqual({ prefix: 'abc123', segredo: 'seg_re_do' });
        });

        /**
         * Tudo o que não tenha a forma esperada é recusado aqui, e não
         * deixado passar meio lido para a consulta seguinte.
         */
        it.each([
            ['vazia', ''],
            ['sem marca', 'abc_def'],
            ['com a marca errada', 'xx_abc_def'],
            ['sem segredo', 'vh_abc_'],
            ['sem prefixo', 'vh__def'],
            ['só a marca', 'vh'],
        ])('recusa uma chave %s', (_nome, apresentada) => {
            expect(service.parse(apresentada)).toBeNull();
        });
    });

    describe('comparar', () => {
        it('aceita dois resumos iguais', () => {
            const chave = service.generate();

            expect(service.matches(chave.hash, chave.hash)).toBe(true);
        });

        it('recusa resumos diferentes', () => {
            expect(
                service.matches(service.generate().hash, service.generate().hash),
            ).toBe(false);
        });

        /**
         * Comprimentos diferentes rebentariam o timingSafeEqual. Vale
         * mais responder que não do que deixar cair o pedido.
         */
        it('recusa comprimentos diferentes sem rebentar', () => {
            expect(service.matches('abc', 'abcdef')).toBe(false);
        });
    });
});
