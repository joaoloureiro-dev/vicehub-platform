import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { MyCommunitiesPage } from '../src/pages/my-communities.page.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const adesao = (extra: Record<string, unknown> = {}) => ({
    crewId: 'crew-1',
    name: 'Leonida Boys',
    tag: 'LB',
    status: 'pending',
    role: null,
    since: '2026-09-01T00:00:00.000Z',
    respondedAt: null,
    decisionNote: null,
    ...extra,
});

const adesaoServidor = (extra: Record<string, unknown> = {}) => ({
    serverId: 'srv-1',
    name: 'Leonida Life',
    region: 'EU',
    status: 'pending',
    role: null,
    since: '2026-09-01T00:00:00.000Z',
    respondedAt: null,
    decisionNote: null,
    ...extra,
});

/**
 * Responde a cada diretório com o que o caso quiser.
 *
 * Cada rota é nomeada, e tudo o resto responde lista vazia. A primeira
 * versão disto devolvia os servidores a **qualquer** rota que não fosse
 * de crews — incluindo a do feed, que rebentou com uma forma que não
 * esperava. Um duplo que responde a tudo o mesmo mente ao teste.
 */
const servirAmbos = (crews: unknown[], servidores: unknown[]) =>
    vi.fn((url: string) => {
        const endereco = String(url);

        if (endereco.includes('/crews')) {
            return Promise.resolve(json(200, crews));
        }

        if (endereco.includes('/servers')) {
            return Promise.resolve(json(200, servidores));
        }

        return Promise.resolve(json(200, []));
    });

/** As crews vêm da rota de crews; tudo o resto responde vazio. */
const servir = (crews: unknown[]) =>
    vi.fn((url: string) =>
        Promise.resolve(
            json(200, String(url).includes('/crews') ? crews : []),
        ),
    );

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * O que uma pessoa vê sobre as candidaturas que fez.
 *
 * Isto existe por causa de um buraco que era o pior da plataforma: uma
 * candidatura recusada desaparecia desta lista. Pedia-se entrada,
 * esperava-se, e um dia o pedido já lá não estava — a pessoa nunca
 * chegava a saber que tinha sido recusada, e ficava à espera de uma
 * resposta que já tinha chegado.
 */
describe('as minhas comunidades', () => {
    it('mostra as candidaturas por responder', async () => {
        vi.stubGlobal('fetch', servir([adesao()]));

        montarEcra(<MyCommunitiesPage />);

        expect(await screen.findByText(t.crews.aEsperaResposta)).toBeDefined();
    });

    /**
     * Ninguém é obrigado a responder a uma candidatura — essa é uma
     * decisão de quem gere a crew. Mas esconder há quanto tempo o pedido
     * está lá deixava quem se candidatou sem saber se são três dias ou
     * três meses, e isso é silêncio com passos extra.
     */
    it('diz desde quando se está à espera', async () => {
        vi.stubGlobal('fetch', servir([adesao()]));

        montarEcra(<MyCommunitiesPage />);

        expect(
            await screen.findByText(
                t.crews.enviadaEm(
                    new Date('2026-09-01T00:00:00.000Z').toLocaleDateString('en'),
                ),
            ),
        ).toBeDefined();
    });

    it('mostra as que foram recusadas', async () => {
        vi.stubGlobal(
            'fetch',
            servir([
                adesao({
                    status: 'rejected',
                    respondedAt: '2026-09-05T00:00:00.000Z',
                }),
            ]),
        );

        montarEcra(<MyCommunitiesPage />);

        expect(await screen.findByText(t.crews.responderamQueNao)).toBeDefined();
        expect(screen.getByText(t.crews.candidaturaRecusada)).toBeDefined();
    });

    it('e o motivo, quando quem recusou escreveu um', async () => {
        vi.stubGlobal(
            'fetch',
            servir([
                adesao({
                    status: 'rejected',
                    respondedAt: '2026-09-05T00:00:00.000Z',
                    decisionNote: 'Estamos cheios este mês.',
                }),
            ]),
        );

        montarEcra(<MyCommunitiesPage />);

        expect(
            await screen.findByText('Estamos cheios este mês.'),
        ).toBeDefined();
    });

    /**
     * Uma recusa sem motivo escrito continua a dizer o que interessa —
     * que houve resposta. O que não pode é aparecer uma citação vazia
     * onde ninguém escreveu nada.
     */
    it('sem motivo, não inventa uma citação vazia', async () => {
        vi.stubGlobal(
            'fetch',
            servir([
                adesao({
                    status: 'rejected',
                    respondedAt: '2026-09-05T00:00:00.000Z',
                }),
            ]),
        );

        const { container } = montarEcra(<MyCommunitiesPage />);

        expect(await screen.findByText(t.crews.candidaturaRecusada)).toBeDefined();

        expect(container.querySelector('.carta')).toBeNull();
    });

    /**
     * Uma recusa não é uma candidatura por responder. Juntá-las deixava
     * a pessoa à espera de uma coisa que já aconteceu.
     */
    it('não conta uma recusa como estando à espera', async () => {
        vi.stubGlobal(
            'fetch',
            servir([
                adesao({
                    status: 'rejected',
                    respondedAt: '2026-09-05T00:00:00.000Z',
                }),
            ]),
        );

        montarEcra(<MyCommunitiesPage />);

        await waitFor(() => {
            expect(screen.getByText(t.crews.responderamQueNao)).toBeDefined();
        });

        expect(screen.queryByText(t.crews.aEsperaResposta)).toBeNull();
    });

    /**
     * O mesmo para os servidores.
     *
     * As duas coisas partilham a tabela e o esquema, e uma plataforma
     * onde a recusa de uma crew aparece e a de um servidor não aparece é
     * uma plataforma que se contradiz a si própria.
     */
    it('mostra também as recusas de servidores', async () => {
        vi.stubGlobal(
            'fetch',
            servirAmbos(
                [],
                [
                    adesaoServidor({
                        status: 'rejected',
                        respondedAt: '2026-09-05T00:00:00.000Z',
                        decisionNote: 'Sem vagas de momento.',
                    }),
                ],
            ),
        );

        montarEcra(<MyCommunitiesPage />);

        expect(await screen.findByText(t.crews.responderamQueNao)).toBeDefined();
        expect(screen.getByText('Sem vagas de momento.')).toBeDefined();
    });
});
