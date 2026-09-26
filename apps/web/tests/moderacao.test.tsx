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
import { FilaPage } from '../src/moderation/pages/fila.page.js';
import type { Historial } from '../src/moderation/moderation.api.js';
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
    reason: 'spam' as 'spam' | 'abuse' | 'off_topic' | 'other',
    note: 'Isto é publicidade a um servidor.',
    status: 'open' as const,
    createdAt: '2026-09-21T09:00:00.000Z',
    handledAt: null,
    reporter: { id: 'u4', username: 'carla', avatarUrl: null },
    target: {
        kind: 'topic' as 'topic' | 'reply' | 'listing',
        openId: 'topico-1',
        title: 'Vem para o meu servidor' as string | null,
        body: null as string | null,
        author: { id: 'u2', username: 'ana', avatarUrl: null } as
            | { id: string; username: string; avatarUrl: null }
            | null,
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
    historialDoAutor?: Historial;
    historialDoDenunciante?: Historial;
    historialRecusado?: boolean;
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

        if (endereco.includes('/moderation/users/')) {
            if (opcoes.historialRecusado === true) {
                return Promise.resolve(json(500, { code: 'INTERNAL_ERROR' }));
            }

            const deQuem = endereco.includes('/u2/')
                ? opcoes.historialDoAutor
                : opcoes.historialDoDenunciante;

            return Promise.resolve(
                json(200, deQuem ?? {
                    written: { acted: 0, dismissed: 0 },
                    filed: { acted: 0, dismissed: 0 },
                }),
            );
        }

        if (endereco.includes('/moderation/reports/')) {
            return Promise.resolve(json(204, null));
        }

        if (endereco.includes('/moderation/reports')) {
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
            <FilaPage />
        </AuthProvider>,
        '/moderacao',
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
        const botoes = await screen.findAllByText(t.moderacao.denunciar);

        expect(botoes).toHaveLength(2);

        await userEvent.click(botoes[0] as HTMLElement);
        await userEvent.click(screen.getByLabelText(t.moderacao.razoes.abuse));
        await userEvent.type(
            screen.getByLabelText(t.moderacao.notaDaDenuncia),
            'O terceiro parágrafo é uma ameaça.',
        );
        await userEvent.click(screen.getByText(t.moderacao.enviarDenuncia));

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
            (await screen.findAllByText(t.moderacao.denunciar))[0] as HTMLElement,
        );
        await userEvent.click(screen.getByText(t.moderacao.enviarDenuncia));

        await screen.findByText(t.moderacao.denunciaRecebida);

        /** O da resposta continua lá; o da pergunta é que se foi. */
        expect(screen.queryAllByText(t.moderacao.denunciar)).toHaveLength(1);
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
            (await screen.findAllByText(t.moderacao.denunciar))[0] as HTMLElement,
        );
        await userEvent.click(screen.getByText(t.moderacao.enviarDenuncia));

        await screen.findByText(t.moderacao.denunciaRecebida);
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
        expect(screen.queryAllByText(t.moderacao.denunciar)).toHaveLength(1);
    });
});

describe('a fila de quem modera', () => {
    it('mostra a denúncia, a razão, a nota e o que foi denunciado', async () => {
        vi.stubGlobal('fetch', responder({ modera: true }));

        montarFila();

        expect(await screen.findByText(t.moderacao.razoes.spam)).toBeDefined();
        expect(screen.getByText(DENUNCIA.note)).toBeDefined();
        expect(
            screen.getByText(DENUNCIA.target.title as string),
        ).toBeDefined();
        expect(screen.getByText('carla')).toBeDefined();
    });

    it('fecha a denúncia com a conclusão de quem a viu', async () => {
        const chamadas = responder({ modera: true });

        vi.stubGlobal('fetch', chamadas);

        montarFila();

        await userEvent.click(await screen.findByText(t.moderacao.marcarSemRazao));

        await waitFor(() => {
            const pedido = chamadas.mock.calls.find(([endereco]) =>
                String(endereco).includes('/moderation/reports/denuncia-1'),
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

        expect(await screen.findByText(t.moderacao.filaNegada)).toBeDefined();
    });

    it('diz que não há nada quando a fila está vazia', async () => {
        vi.stubGlobal('fetch', responder({ modera: true, denuncias: [] }));

        montarFila();

        expect(await screen.findByText(t.moderacao.filaVazia)).toBeDefined();
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
/**
 * A fila é uma só para as duas superfícies, e o ecrã tem de mostrar
 * um anúncio tão bem como uma pergunta — incluindo a ligação para o
 * sítio certo, que sai do `kind` e não de adivinhar qual dos
 * identificadores veio preenchido.
 */
describe('a fila mostra anúncios ao lado de perguntas', () => {
    /**
     * O nome da espécie está no meio de um parágrafo com o autor ao
     * lado, por isso procura-se pelo texto do parágrafo inteiro.
     */
    const noParagrafo = (procurado: string) =>
        screen.findByText(
            (_, elemento) =>
                elemento?.tagName === 'P'
                && (elemento.textContent ?? '').includes(procurado),
        );

    const ANUNCIO_DENUNCIADO = {
        ...DENUNCIA,
        id: 'denuncia-2',
        reason: 'spam' as const,
        target: {
            kind: 'listing' as const,
            openId: 'anuncio-1',
            title: 'Vem para o meu servidor',
            body: 'Nada a ver com este sítio.',
            author: { id: 'u5', username: 'diogo', avatarUrl: null },
            isRemoved: false,
        },
    };

    it('nomeia a espécie do alvo e abre-o no sítio certo', async () => {
        vi.stubGlobal(
            'fetch',
            responder({ modera: true, denuncias: [ANUNCIO_DENUNCIADO] }),
        );

        montarFila();

        expect(await noParagrafo(t.moderacao.alvos.listing)).toBeDefined();

        const abrir = screen.getByText(t.moderacao.verOAlvo);

        expect(abrir.getAttribute('href')).toBe('/mercado/anuncio-1');
    });

    it('e uma pergunta continua a abrir no fórum', async () => {
        vi.stubGlobal('fetch', responder({ modera: true }));

        montarFila();

        expect(await noParagrafo(t.moderacao.alvos.topic)).toBeDefined();

        expect(
            screen.getByText(t.moderacao.verOAlvo).getAttribute('href'),
        ).toBe('/forum/topico-1');
    });
});

describe('os rótulos da fila não se repetem', () => {
    it.each([
        ['en', en],
        ['pt', pt],
        ['es', es],
        ['fr', fr],
    ])('em %s, nenhuma aba tem o nome de um botão', (idioma, dicionario) => {
        const d = dicionario(criarTools(idioma as 'en')).moderacao;

        const abas = Object.values(d.filaEstados);
        const botoes = [d.marcarTratada, d.marcarSemRazao];

        for (const botao of botoes) {
            expect(abas, `"${botao}" também é uma aba`).not.toContain(botao);
        }
    });
});

/**
 * O que já foi decidido antes, ao lado da denúncia.
 *
 * A denúncia que o moderador tem à frente diz o que aconteceu uma vez.
 * Não diz se é a primeira vez ou a décima, nem se quem a apresentou já
 * apresentou quarenta sem razão — e as duas coisas mudam a decisão.
 *
 * O que aqui se guarda, acima de tudo, é a **regra de leitura** dos
 * números. Sem a frase que os acompanha, um "3" ao lado de um nome
 * lê-se como três vezes denunciado — que é outra coisa, e é coisa que
 * dez pessoas combinadas conseguem fabricar.
 */
describe('o historial ao lado da denúncia', () => {
    it('não vai à API sem alguém carregar', async () => {
        const chamadas = responder({ modera: true });

        vi.stubGlobal('fetch', chamadas);

        montarFila();

        await screen.findByText(t.moderacao.verHistorial);

        expect(
            chamadas.mock.calls.filter(([endereco]) =>
                String(endereco).includes('/moderation/users/'),
            ),
        ).toHaveLength(0);
    });

    it('mostra os dois lados, de quem escreveu e de quem denunciou', async () => {
        vi.stubGlobal(
            'fetch',
            responder({
                modera: true,
                historialDoAutor: {
                    written: { acted: 3, dismissed: 1 },
                    filed: { acted: 0, dismissed: 0 },
                },
                historialDoDenunciante: {
                    written: { acted: 0, dismissed: 0 },
                    filed: { acted: 2, dismissed: 40 },
                },
            }),
        );

        montarFila();

        await userEvent.click(
            await screen.findByText(t.moderacao.verHistorial),
        );

        await waitFor(() => {
            expect(
                screen.getByText(t.moderacao.escreveu('ana', 3, 1)),
            ).toBeTruthy();
        });

        expect(
            screen.getByText(t.moderacao.denunciou('carla', 2, 40)),
        ).toBeTruthy();
    });

    /**
     * A frase que diz como se lêem os números vai com eles, e não num
     * sítio onde alguém tenha de a ir procurar.
     */
    it('e diz que conta decisões, e não denúncias recebidas', async () => {
        vi.stubGlobal('fetch', responder({ modera: true }));

        montarFila();

        await userEvent.click(
            await screen.findByText(t.moderacao.verHistorial),
        );

        await waitFor(() => {
            expect(screen.getByText(t.moderacao.historialNota)).toBeTruthy();
        });
    });

    /**
     * Uma falha a carregar isto não pode levar a fila com ela: o
     * moderador está a meio de uma decisão, e o historial é o que ele
     * consultou a mais.
     */
    it('e uma falha não leva a fila atrás', async () => {
        vi.stubGlobal(
            'fetch',
            responder({ modera: true, historialRecusado: true }),
        );

        montarFila();

        await userEvent.click(
            await screen.findByText(t.moderacao.verHistorial),
        );

        await waitFor(() => {
            expect(
                screen.getByText(t.moderacao.historialFalhou),
            ).toBeTruthy();
        });

        /** A denúncia continua lá, e os botões de decidir também. */
        expect(screen.getByText(t.moderacao.marcarTratada)).toBeTruthy();
    });
});
