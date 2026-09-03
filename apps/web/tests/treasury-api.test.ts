import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getTreasury,
    proposeDistribution,
    proposeMovement,
} from '../src/treasury/treasury.api.js';

const responde = (body: unknown = {}): Response =>
    ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response;

describe('cliente da tesouraria', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue(responde());
        vi.stubGlobal('fetch', fetchMock);
    });

    const endereco = () => String(fetchMock.mock.calls[0]?.[0]);
    const corpo = () =>
        JSON.parse(
            (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
        ) as Record<string, unknown>;

    it('lê a tesouraria de uma crew', async () => {
        await getTreasury({ tipo: 'crews', id: 'c1' });

        expect(endereco()).toBe('/api/v1/treasury/crews/c1');
    });

    it('lê a de um servidor pelo mesmo caminho, com outro prefixo', async () => {
        await getTreasury({ tipo: 'servers', id: 's1' });

        expect(endereco()).toBe('/api/v1/treasury/servers/s1');
    });

    /**
     * O montante é texto do princípio ao fim. Se em algum ponto passasse
     * por `Number`, um valor grande chegaria à API alterado — e a API
     * aceitá-lo-ia, porque continua a parecer um inteiro válido.
     */
    it('envia o montante tal e qual, sem lhe tocar', async () => {
        const enorme = '9007199254740993';

        await proposeMovement(
            { tipo: 'crews', id: 'c1' },
            {
                amount: enorme,
                direction: 'credit',
                category: 'contribution',
                description: 'ganhos da missão',
            },
        );

        expect(corpo()['amount']).toBe(enorme);
        expect(typeof corpo()['amount']).toBe('string');
    });

    /**
     * A API recusa campos que não pertencem à base escolhida — e faz bem:
     * quem os enviasse ficaria a achar que contaram para alguma coisa.
     * O cliente não os envia, para que a recusa nunca chegue a acontecer
     * e apareça como avaria.
     */
    describe('as divisões só levam o que a base aceita', () => {
        it('a divisão por participação leva o evento', async () => {
            await proposeDistribution('c1', {
                basis: 'participation',
                total: '1000',
                eventId: 'e1',
            });

            expect(corpo()).toEqual({
                basis: 'participation',
                total: '1000',
                eventId: 'e1',
            });
        });

        it('as outras bases não levam evento nenhum', async () => {
            await proposeDistribution('c1', {
                basis: 'equal',
                total: '1000',
                eventId: 'e1',
            });

            expect(corpo()).not.toHaveProperty('eventId');
        });

        /**
         * A base manual recebe as partes uma a uma, e por isso não leva
         * total: mandá-lo seria dizer duas coisas sobre o mesmo dinheiro.
         */
        it('a base manual não leva total', async () => {
            await proposeDistribution('c1', { basis: 'manual', total: '1000' });

            expect(corpo()).not.toHaveProperty('total');
            expect(corpo()['basis']).toBe('manual');
        });

        it('as bases calculadas levam o total', async () => {
            await proposeDistribution('c1', { basis: 'by_role', total: '5000' });

            expect(corpo()['total']).toBe('5000');
        });

        it('a nota só vai quando existe', async () => {
            await proposeDistribution('c1', { basis: 'equal', total: '10' });

            expect(corpo()).not.toHaveProperty('note');
        });
    });
});
