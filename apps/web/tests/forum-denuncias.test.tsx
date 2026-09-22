import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { AuthProvider } from '../src/auth/auth.context.js';
import { en } from '../src/i18n/en.js';
import { pt } from '../src/i18n/pt.js';
import { es } from '../src/i18n/es.js';
import { fr } from '../src/i18n/fr.js';
import { criarTools } from '../src/i18n/tools.js';
import { DenunciasPage } from '../src/forum/pages/denuncias.page.js';
import { TopicPage } from '../src/forum/pages/topic.page.js';
import { sessionStore } from '../src/lib/session.js';
import { montarEcra, t } from './helpers.js';

/**
 * Denunciar, e a fila de quem modera.
 *
 * Sem isto a moderação dependia de sorte: alguém tinha de calhar de ler
 * a publicação para ela ser vista. Duas coisas se guardam aqui — que o
 * botão aparece a quem pode avisar e não a quem escreveu, e que a fila
 * existe e se pode fechar. Uma fila que ninguém consegue abrir é o
 * sítio onde as denúncias vão morrer.
 */
const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const EU = { id: 'u1', email: 'quem@vicehub.test', username: 'quem' };

const TOPICO = {
    id: 'topico-1',
    title: 'Como divido os ganhos de um assalto?',
    body: 'Somos cinco e o líder quer levar mais.',
    author: { id: 'u2', username: 'ana', avatarUrl: null },
    isLocked: false,
    createdAt: '2026-09-20T10:00:00.000Z',
    replies: [
        {
            id: 'resposta-1',
            body: 'Confirmas as presenças e divides por participação.',
            author: { id: 'u3', username: 'bruno', avatarUrl: null },
            createdAt: '2026-09-20T11:00:00.000Z',
        },
    ],
};

const DENUNCIA = {
    id: 'denuncia-1',
    reason: 'spam' as const,
    note: 'Isto é publicidade a um servidor.',
    status: 'open' as const,
    createdAt: '2026-09-21T09:00:00.000Z',
    handledAt: null,
    reporter: { id: 'u4', username: 'carla', avatarUrl: null },
    target: {
        kind: 'topic' as const,
        topicId: 'topico-1',
        title: 'Vem para o meu servidor',
        body: null,
        author: { id: 'u2', username: 'ana', avatarUrl: null },
        isRemoved: false,
    },
};

/** Nomeia cada rota que o ecrã usa, e rebenta nas outras. */
const responder = (opcoes: {
    modera?: boolean;
    topico?: typeof TOPICO;
    denuncias?: (typeof DENUNCIA)[];
    aoDenunciar?: Response;
    filaRecusada?: boolean;
    autor?: { id: string; username: string; avatarUrl: null };
}) =>
    vi.fn((url: string, _init?: { method?: string }) => {
        const endereco = String(url);

        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                json(200, { accessToken: 'token', user: EU }),
            );
        }

        if (endereco.endsWith('/forum/moderation')) {
            return Promise.resolve(
                json(200, { canModerate: opcoes.modera === true }),
            );
        }

        if (endereco.includes('/reports') && endereco.includes('/forum/topics/')) {
            return Promise.resolve(opcoes.aoDenunciar ?? json(201, { id: 'd1' }));
        }

        if (endereco.includes('/reports') && endereco.includes('/forum/replies/')) {
            return Promise.resolve(opcoes.aoDenunciar ?? json(201, { id: 'd2' }));
        }

        if (endereco.includes('/forum/reports/')) {
            return Promise.resolve(json(204, null));
        }

        if (endereco.includes('/forum/reports')) {
            if (opcoes.filaRecusada === true) {
                return Promise.resolve(json(403, { code: 'FORBIDDEN' }));
            }

            const lista = opcoes.denuncias ?? [DENUNCIA];

            return Promise.resolve(
                json(200, {
                    reports: lista,
                    page: 1,
                    pages: 1,
                    total: lista.length,
                }),
            );
        }

        if (endereco.endsWith('/forum/topics/topico-1')) {
            const base = opcoes.topico ?? TOPICO;

            return Promise.resolve(
                json(200, {
                    ...base,
                    ...(opcoes.autor ? { author: opcoes.autor } : {}),
                }),
            );
        }

        throw new Error(`rota não prevista no duplo: ${endereco}`);
    });

const montarTopico = () =>
    montarEcra(
        <AuthProvider>
            <Routes>
                <Route path="/forum/:topicId" element={<TopicPage />} />
            </Routes>
        </AuthProvider>,
        '/forum/topico-1',
    );

const montarFila = () =>
    montarEcra(
        <AuthProvider>
            <DenunciasPage />
        </AuthProvider>,
        '/forum/denuncias',
    );

afterEach(() => {
    vi.unstubAllGlobals();
    sessionStore.clear();
});

describe('denunciar uma publicação', () => {
    it('manda a razão escolhida e a nota', async () => {
        const chamadas = responder({});

        vi.stubGlobal('fetch', chamadas);

        montarTopico();

        /** Um botão para a pergunta e outro para a resposta. */
        const botoes = await screen.findAllByText(t.forum.denunciar);

        expect(botoes).toHaveLength(2);

        await userEvent.click(botoes[0] as HTMLElement);
        await userEvent.click(screen.getByLabelText(t.forum.razoes.abuse));
        await userEvent.type(
            screen.getByLabelText(t.forum.notaDaDenuncia),
            'O terceiro parágrafo é uma ameaça.',
        );
        await userEvent.click(screen.getByText(t.forum.enviarDenuncia));

        await waitFor(() => {
            const pedido = chamadas.mock.calls.find(([endereco]) =>
                String(endereco).includes('/reports'),
            );

            expect(pedido).toBeDefined();

            const corpo = JSON.parse(
                String((pedido?.[1] as { body?: string }).body),
            ) as { reason: string; note: string };

            expect(corpo.reason).toBe('abuse');
            expect(corpo.note).toBe('O terceiro parágrafo é uma ameaça.');
        });
    });

    it('diz que recebeu, e não deixa denunciar outra vez', async () => {
        vi.stubGlobal('fetch', responder({}));

        montarTopico();

        await userEvent.click(
            (await screen.findAllByText(t.forum.denunciar))[0] as HTMLElement,
        );
        await userEvent.click(screen.getByText(t.forum.enviarDenuncia));

        await screen.findByText(t.forum.denunciaRecebida);

        /** O da resposta continua lá; o da pergunta é que se foi. */
        expect(screen.queryAllByText(t.forum.denunciar)).toHaveLength(1);
    });

    /**
     * "Já denunciaste isto" não é uma falha para quem carregou no
     * botão: o aviso chegou na mesma, da primeira vez.
     */
    it('trata uma denúncia repetida como recebida', async () => {
        vi.stubGlobal(
            'fetch',
            responder({
                aoDenunciar: json(409, { code: 'ALREADY_REPORTED' }),
            }),
        );

        montarTopico();

        await userEvent.click(
            (await screen.findAllByText(t.forum.denunciar))[0] as HTMLElement,
        );
        await userEvent.click(screen.getByText(t.forum.enviarDenuncia));

        await screen.findByText(t.forum.denunciaRecebida);
    });

    /**
     * Quem escreveu não denuncia o que é seu: tem o botão de retirar, e
     * uma denúncia a si próprio só punha trabalho na fila de outra
     * pessoa.
     */
    it('não oferece denunciar a quem escreveu a pergunta', async () => {
        vi.stubGlobal(
            'fetch',
            responder({ autor: { id: EU.id, username: EU.username, avatarUrl: null } }),
        );

        montarTopico();

        await screen.findByText(TOPICO.title);

        /** Só o da resposta, que é de outra pessoa. */
        expect(screen.queryAllByText(t.forum.denunciar)).toHaveLength(1);
    });
});

describe('a fila de quem modera', () => {
    it('mostra a denúncia, a razão, a nota e o que foi denunciado', async () => {
        vi.stubGlobal('fetch', responder({ modera: true }));

        montarFila();

        expect(await screen.findByText(t.forum.razoes.spam)).toBeDefined();
        expect(screen.getByText(DENUNCIA.note)).toBeDefined();
        expect(screen.getByText(DENUNCIA.target.title)).toBeDefined();
        expect(screen.getByText('carla')).toBeDefined();
    });

    it('fecha a denúncia com a conclusão de quem a viu', async () => {
        const chamadas = responder({ modera: true });

        vi.stubGlobal('fetch', chamadas);

        montarFila();

        await userEvent.click(await screen.findByText(t.forum.marcarSemRazao));

        await waitFor(() => {
            const pedido = chamadas.mock.calls.find(([endereco]) =>
                String(endereco).includes('/forum/reports/denuncia-1'),
            );

            expect(pedido).toBeDefined();

            const corpo = JSON.parse(
                String((pedido?.[1] as { body?: string }).body),
            ) as { outcome: string };

            expect(corpo.outcome).toBe('dismissed');
        });
    });

    /**
     * Quem não modera pode chegar aqui pelo endereço. O que se mostra é
     * a recusa — e não um ecrã vazio, que se lê como "não há
     * denúncias".
     */
    it('diz que é para moderadores quando a API recusa', async () => {
        vi.stubGlobal('fetch', responder({ filaRecusada: true }));

        montarFila();

        expect(await screen.findByText(t.forum.filaNegada)).toBeDefined();
    });

    it('diz que não há nada quando a fila está vazia', async () => {
        vi.stubGlobal('fetch', responder({ modera: true, denuncias: [] }));

        montarFila();

        expect(await screen.findByText(t.forum.filaVazia)).toBeDefined();
    });
});

/**
 * Um ecrã, um nome por controlo.
 *
 * As abas dizem **estados** e os botões dizem **ações**, e chegaram a
 * dizer o mesmo: "Nothing wrong" era ao mesmo tempo o filtro das
 * denúncias sem razão e o botão que dispensava uma. Um moderador com
 * dois controlos do mesmo nome a fazer coisas diferentes carrega no
 * errado, e o errado aqui decide uma denúncia.
 *
 * Foi um teste a tropeçar nisto — clicou no filtro julgando ser o
 * botão. Fica fixado nos quatro idiomas, porque a colisão aparece na
 * tradução e não no código.
 */
describe('os rótulos da fila não se repetem', () => {
    it.each([
        ['en', en],
        ['pt', pt],
        ['es', es],
        ['fr', fr],
    ])('em %s, nenhuma aba tem o nome de um botão', (idioma, dicionario) => {
        const d = dicionario(criarTools(idioma as 'en')).forum;

        const abas = Object.values(d.filaEstados);
        const botoes = [d.marcarTratada, d.marcarSemRazao];

        for (const botao of botoes) {
            expect(abas, `"${botao}" também é uma aba`).not.toContain(botao);
        }
    });
});
