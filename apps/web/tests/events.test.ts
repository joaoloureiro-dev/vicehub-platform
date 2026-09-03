import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    confirmAttendance,
    listEvents,
    signUp,
} from '../src/events/event.api.js';
import { transicoesDe } from '../src/events/event.types.js';

const responde = (body: unknown = {}): Response =>
    ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response;

describe('cliente dos eventos', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue(responde([]));
        vi.stubGlobal('fetch', fetchMock);
    });

    const endereco = () => String(fetchMock.mock.calls[0]?.[0]);
    const corpo = () =>
        JSON.parse(
            (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
        ) as Record<string, unknown>;

    /**
     * As rotas vivem sob o titular. É o prefixo que diz ao guard de
     * autorização em que âmbito avaliar a permissão — sem ele, o cargo
     * de líder da crew não conta.
     */
    it('vai buscar os eventos sob a crew', async () => {
        await listEvents({ tipo: 'crews', id: 'c1' });

        expect(endereco()).toBe('/api/v1/events/crews/c1');
    });

    it('inscreve-se no caminho do titular', async () => {
        await signUp({ tipo: 'crews', id: 'c1' }, 'e1');

        expect(endereco()).toBe('/api/v1/events/crews/c1/e1/signup');
    });

    /**
     * Por omissão a API mostra o que está para vir, que é o que interessa
     * a quem quer participar. Mandar `includePast=false` faria a API
     * tratar o filtro como pedido de propósito.
     */
    it('não pede o histórico quando ninguém o pediu', async () => {
        await listEvents({ tipo: 'crews', id: 'c1' }, { includePast: false });

        expect(endereco()).toBe('/api/v1/events/crews/c1');
    });

    it('pede o histórico quando o pedem', async () => {
        await listEvents({ tipo: 'crews', id: 'c1' }, { includePast: true });

        expect(endereco()).toBe('/api/v1/events/crews/c1?includePast=true');
    });

    describe('confirmar uma presença', () => {
        /**
         * Sem peso indicado, a API assume um — a participação simples.
         * Mandar um campo vazio seria mandar lixo, e a API recusaria com
         * um erro que se lê como avaria.
         */
        it('não manda peso nenhum quando não foi indicado', async () => {
            await confirmAttendance({ tipo: 'crews', id: 'c1' }, 'e1', 'u1');

            expect(corpo()).toEqual({});
        });

        it('manda o peso quando foi indicado', async () => {
            await confirmAttendance({ tipo: 'crews', id: 'c1' }, 'e1', 'u1', 3);

            expect(corpo()).toEqual({ weight: 3 });
        });

        it('confirma no caminho da pessoa certa', async () => {
            await confirmAttendance({ tipo: 'crews', id: 'c1' }, 'e1', 'u9', 2);

            expect(endereco()).toBe(
                '/api/v1/events/crews/c1/e1/participants/u9/confirm',
            );
        });
    });
});

/**
 * O ecrã não pode oferecer transições que a API vai recusar: um evento
 * terminado não volta a decorrer, e o botão daria um erro que se lê como
 * avaria em vez de como "isso não se faz".
 */
describe('as transições que um evento aceita', () => {
    it('um evento marcado pode começar ou ser cancelado', () => {
        expect(transicoesDe('scheduled').map((t) => t.status)).toEqual([
            'ongoing',
            'canceled',
        ]);
    });

    it('um evento a decorrer pode terminar ou ser cancelado', () => {
        expect(transicoesDe('ongoing').map((t) => t.status)).toEqual([
            'completed',
            'canceled',
        ]);
    });

    it('um evento terminado não vai a lado nenhum', () => {
        expect(transicoesDe('completed')).toEqual([]);
    });

    it('um evento cancelado não volta atrás', () => {
        expect(transicoesDe('canceled')).toEqual([]);
    });

    it('um estado que não conhecemos não inventa botões', () => {
        expect(transicoesDe('qualquer_coisa')).toEqual([]);
    });
});

/**
 * Quem já tem lugar no evento não pode ser convidado a inscrever-se
 * outra vez: o botão daria um erro, e a pessoa não perceberia porquê.
 * Quem desistiu é o único caso em que voltar a entrar é legítimo.
 */
describe('quem pode inscrever-se', () => {
    const podeInscrever = (
        estadoDoEvento: string,
        minhaParticipacao: string | undefined,
    ): boolean =>
        estadoDoEvento === 'scheduled' &&
        (minhaParticipacao === undefined || minhaParticipacao === 'withdrawn');

    it('quem ainda não tem lugar', () => {
        expect(podeInscrever('scheduled', undefined)).toBe(true);
    });

    it('quem desistiu pode voltar', () => {
        expect(podeInscrever('scheduled', 'withdrawn')).toBe(true);
    });

    it('quem está inscrito, não', () => {
        expect(podeInscrever('scheduled', 'signed_up')).toBe(false);
    });

    it('quem já tem presença confirmada, muito menos', () => {
        expect(podeInscrever('scheduled', 'confirmed')).toBe(false);
    });

    it('quem foi marcado como ausente, não', () => {
        expect(podeInscrever('scheduled', 'no_show')).toBe(false);
    });

    it('num evento que já não aceita inscrições, ninguém', () => {
        for (const estado of ['ongoing', 'completed', 'canceled']) {
            expect(podeInscrever(estado, undefined)).toBe(false);
        }
    });
});
