import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { PrimeiroPasso } from '../src/profile/components/primeiro-passo.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

/**
 * O que fazer a seguir, a quem ainda não pertence a nada.
 *
 * Quem cria conta aterra no perfil, e o perfil visto por olhos que
 * chegaram há um minuto é uma página de administração da conta: os
 * dados, a apresentação, levar os dados, apagar a conta. Nada ali dizia
 * o que a página de entrada tinha acabado de prometer.
 */
describe('o primeiro passo', () => {
    const servir = (crews: unknown[], servidores: unknown[]) =>
        vi.fn((url: string) => {
            const endereco = String(url);

            if (endereco.endsWith('/crews/me/memberships')) {
                return Promise.resolve(json(200, crews));
            }

            if (endereco.endsWith('/servers/me/memberships')) {
                return Promise.resolve(json(200, servidores));
            }

            throw new Error(`rota não prevista pelo duplo: ${endereco}`);
        });

    const adesao = { crewId: 'c1', name: 'Vice Kings', status: 'active' };

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('diz por onde começar a quem não tem nada', async () => {
        vi.stubGlobal('fetch', servir([], []));

        montarEcra(<PrimeiroPasso />);

        expect(
            await screen.findByText(t.perfil.primeiroPassoTitulo),
        ).toBeDefined();
        expect(screen.getByText(t.perfil.primeiroPassoCriar)).toBeDefined();
        expect(screen.getByText(t.perfil.primeiroPassoProcurar)).toBeDefined();
    });

    /**
     * A quem já pertence a alguma coisa, o cartão passa a ser ruído numa
     * página que essa pessoa abre por outra razão.
     */
    it('desaparece a quem já tem uma crew', async () => {
        const fetchMock = servir([adesao], []);

        vi.stubGlobal('fetch', fetchMock);

        const { container } = montarEcra(
            <>
                <p>vizinho</p>
                <PrimeiroPasso />
            </>,
        );

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(screen.getByText('vizinho')).toBeDefined();
        });

        expect(screen.queryByText(t.perfil.primeiroPassoTitulo)).toBeNull();
        expect(container.textContent).toContain('vizinho');
    });

    it('desaparece também a quem só tem um servidor', async () => {
        vi.stubGlobal(
            'fetch',
            servir([], [{ serverId: 's1', name: 'Vice City RP' }]),
        );

        montarEcra(
            <>
                <p>vizinho</p>
                <PrimeiroPasso />
            </>,
        );

        await waitFor(() => {
            expect(screen.getByText('vizinho')).toBeDefined();
        });

        expect(screen.queryByText(t.perfil.primeiroPassoTitulo)).toBeNull();
    });

    /**
     * Uma falha a perguntar não pode virar um convite a quem já tem
     * crew: sem resposta não se sabe, e não saber não é razão para
     * dizer a alguém que não pertence a nada.
     */
    it('não convida ninguém quando não consegue perguntar', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(json(500, { code: 'INTERNAL' }))),
        );

        montarEcra(
            <>
                <p>vizinho</p>
                <PrimeiroPasso />
            </>,
        );

        await waitFor(() => {
            expect(screen.getByText('vizinho')).toBeDefined();
        });

        expect(screen.queryByText(t.perfil.primeiroPassoTitulo)).toBeNull();
    });
});
