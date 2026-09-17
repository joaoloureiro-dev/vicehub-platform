import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { RastoDaComunidade } from '../src/components/rasto-da-comunidade.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const entrada = (extra: Record<string, unknown> = {}) => ({
    id: 'log-1',
    action: 'crew.member.removed',
    actorId: 'u1',
    actorUsername: 'lider',
    before: { userId: 'u2', username: 'outro', role: 'crew_officer' },
    after: null,
    at: '2026-09-17T10:00:00.000Z',
    ...extra,
});

/**
 * O que se decidiu nesta comunidade sobre pessoas.
 *
 * O rasto era escrito desde sempre por meia dúzia de módulos e não havia
 * por onde o ler. A pergunta que o traz aqui — quem é que o pôs fora,
 * quem é que o fez oficial — não tinha resposta em lado nenhum.
 */
describe('o rasto de uma comunidade', () => {
    const servir = (resposta: Response) =>
        vi.fn((url: string) => {
            if (String(url).endsWith('/history')) {
                return Promise.resolve(resposta);
            }

            throw new Error(`rota não prevista pelo duplo: ${String(url)}`);
        });

    const montar = (base: '/crews' | '/servers' = '/crews') =>
        montarEcra(<RastoDaComunidade base={base} id="crew-1" />, '/');

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('diz quem removeu quem, e com que cargo', async () => {
        vi.stubGlobal('fetch', servir(json(200, [entrada()])));

        montar();

        expect(
            await screen.findByText(
                t.rasto.removeu('lider', 'outro', t.cargos.crew_officer),
            ),
        ).toBeDefined();
    });

    /**
     * De onde veio e para onde foi. Sem o "de onde", a frase não
     * distingue uma promoção de uma despromoção.
     */
    it('diz de que cargo para que cargo alguém passou', async () => {
        vi.stubGlobal(
            'fetch',
            servir(
                json(200, [
                    entrada({
                        action: 'crew.member.role_changed',
                        before: { role: 'crew_member' },
                        after: {
                            userId: 'u2',
                            username: 'outro',
                            role: 'crew_officer',
                        },
                    }),
                ]),
            ),
        );

        montar();

        expect(
            await screen.findByText(
                t.rasto.mudouCargo(
                    'lider',
                    'outro',
                    t.cargos.crew_member,
                    t.cargos.crew_officer,
                ),
            ),
        ).toBeDefined();
    });

    /**
     * A mesma frase serve as duas comunidades: o prefixo da ação diz
     * onde foi, e quem está a ler já sabe onde está.
     */
    it('diz o mesmo para um servidor', async () => {
        vi.stubGlobal(
            'fetch',
            servir(
                json(200, [
                    entrada({
                        action: 'server.member.admitted',
                        before: null,
                        after: { userId: 'u2', username: 'outro' },
                    }),
                ]),
            ),
        );

        montar('/servers');

        expect(
            await screen.findByText(t.rasto.admitiu('lider', 'outro')),
        ).toBeDefined();
    });

    /**
     * A coluna do autor não tem chave estrangeira, para que apagar uma
     * conta não apague o que ela fez. O rasto fica, sem nome — e isso
     * mostra-se, em vez de se esconder a entrada.
     */
    it('mostra a entrada de quem já apagou a conta', async () => {
        vi.stubGlobal(
            'fetch',
            servir(json(200, [entrada({ actorUsername: null })])),
        );

        montar();

        expect(
            await screen.findByText(
                t.rasto.removeu(
                    t.rasto.contaApagada,
                    'outro',
                    t.cargos.crew_officer,
                ),
            ),
        ).toBeDefined();
    });

    /**
     * Uma ação que esta versão do ecrã não sabe dizer continua a ser uma
     * decisão que alguém tomou. Escondê-la era mentir por omissão a quem
     * veio ver o que se passou.
     */
    it('mostra em bruto a ação que ainda não sabe dizer', async () => {
        vi.stubGlobal(
            'fetch',
            servir(json(200, [entrada({ action: 'crew.banner.changed' })])),
        );

        montar();

        expect(
            await screen.findByText(t.rasto.fez('lider', 'crew.banner.changed')),
        ).toBeDefined();
    });

    it('diz que ainda não se decidiu nada quando não há nada', async () => {
        vi.stubGlobal('fetch', servir(json(200, [])));

        montar();

        expect(await screen.findByText(t.rasto.aindaNada)).toBeDefined();
    });

    /**
     * Um 403 é a resposta e não uma avaria: quer dizer "não é teu para
     * veres". A secção não aparece, em vez de mostrar um erro a quem não
     * pediu nada.
     */
    it('desaparece para quem não o pode ver', async () => {
        const fetchMock = servir(json(403, { code: 'INSUFFICIENT_PERMISSIONS' }));

        vi.stubGlobal('fetch', fetchMock);

        /**
         * O vizinho é o que torna este teste capaz de falhar.
         *
         * Duas versões anteriores passavam por razão nenhuma. A primeira
         * afirmava a ausência antes de o pedido acabar — e a carregar o
         * componente também não mostra nada. A segunda esperava que o
         * ecrã ficasse vazio, o que acontece tanto quando o componente
         * se esconde de propósito como quando rebenta a desenhar e o
         * React desmonta a árvore.
         *
         * Com um vizinho ao lado, as duas coisas deixam de ser iguais:
         * esconder-se deixa-o de pé, rebentar leva-o com ele.
         */
        montarEcra(
            <>
                <p>vizinho</p>
                <RastoDaComunidade base="/crews" id="crew-1" />
            </>,
            '/',
        );

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(screen.getByText('vizinho')).toBeDefined();
        });

        expect(screen.queryByText(t.rasto.titulo)).toBeNull();
        expect(screen.queryByText(t.rasto.aindaNada)).toBeNull();
    });
});
