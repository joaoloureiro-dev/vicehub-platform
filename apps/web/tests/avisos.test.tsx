import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '../src/app.js';
import { AuthProvider } from '../src/auth/auth.context.js';
import { AvisosProvider, useAvisos } from '../src/notifications/avisos.context.js';
import { AvisosPage } from '../src/notifications/pages/avisos.page.js';
import { PendingProvider } from '../src/pages/pending.context.js';
import { irEVoltar, montarEcra, t } from './helpers.js';

/**
 * A caixa de avisos.
 *
 * O que aqui se guarda é aquilo que faz a diferença entre uma caixa que
 * se lê e uma que se ignora ao fim de dois dias:
 *
 * - **cada aviso abre onde a coisa está** — a conversa, o tópico, o
 *   perfil de quem foi avaliado — e não numa página que diz que
 *   aconteceu alguma coisa;
 * - **abrir a caixa não dá tudo por lido**: quem chega a meio da tarde
 *   tem o direito de ver o que estava por ler;
 * - **o número no cabeçalho tem tecto**, porque trezentos avisos por
 *   ler não são uma informação diferente de "muitos" e empurravam o
 *   resto da barra para fora do ecrã de um telemóvel.
 */
const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const EU = { id: 'u1', email: 'quem@vicehub.test', username: 'quem' };

const ANA = { id: 'u2', username: 'ana', avatarUrl: null };

type Aviso = {
    id: string;
    kind:
        | 'market_message'
        | 'forum_reply'
        | 'market_review'
        | 'market_review_reply';
    actor: typeof ANA | null;
    openId: string;
    about: string | null;
    excerpt: string | null;
    isRead: boolean;
    createdAt: string;
};

const AVISOS: Aviso[] = [
    {
        id: 'aviso-1',
        kind: 'market_message',
        actor: ANA,
        openId: 'conversa-1',
        about: 'Banshee 900R',
        excerpt: 'A que horas entregas?',
        isRead: false,
        createdAt: '2026-09-24T10:00:00.000Z',
    },
    {
        id: 'aviso-2',
        kind: 'forum_reply',
        actor: ANA,
        openId: 'topico-1',
        about: 'Onde se compra munição?',
        excerpt: 'No porto, depois das oito.',
        isRead: false,
        createdAt: '2026-09-24T09:00:00.000Z',
    },
    {
        id: 'aviso-3',
        kind: 'market_review',
        actor: ANA,
        openId: 'quem',
        about: 'Banshee 900R',
        excerpt: null,
        isRead: true,
        createdAt: '2026-09-23T09:00:00.000Z',
    },
    {
        id: 'aviso-4',
        kind: 'market_review_reply',
        actor: null,
        openId: 'ana',
        about: 'Sultan RS',
        excerpt: null,
        isRead: true,
        createdAt: '2026-09-22T09:00:00.000Z',
    },
];

const caixa = (avisos: Aviso[], porLer: number) => ({
    notifications: avisos,
    unread: porLer,
    page: 1,
    pages: 1,
    total: avisos.length,
});

/**
 * Nomeia cada rota que o ecrã usa, e rebenta nas outras.
 *
 * A contagem e a lista respondem a partir do mesmo estado, que o
 * "dar tudo por lido" muda — é isso que prova que o número da barra
 * acompanha o que a pessoa acabou de fazer, e não fica a mentir.
 */
interface Estado {
    avisos: Aviso[];
    porLer: number;
    /** Liga-se a meio de um teste, para simular uma falha de rede. */
    falha?: boolean;
}

const responder = (
    opcoes: {
        avisos?: Aviso[];
        porLer?: number;
        recusada?: boolean;
        estado?: Estado;
    } = {},
) => {
    const estado: Estado = opcoes.estado ?? {
        avisos: opcoes.avisos ?? AVISOS,
        porLer: opcoes.porLer ?? 2,
    };

    return vi.fn((url: string, init?: { method?: string }) => {
        const endereco = String(url);
        const metodo = init?.method ?? 'GET';

        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                json(200, { accessToken: 'token', user: EU }),
            );
        }

        if (endereco.includes('/users/me/pending')) {
            return Promise.resolve(
                json(200, {
                    items: [],
                    friendRequests: 0,
                    answers: 0,
                    answersSeenAt: null,
                    total: 0,
                }),
            );
        }

        if (endereco.includes('/notifications/unread')) {
            return estado.falha === true
                ? Promise.reject(new Error('sem rede'))
                : Promise.resolve(json(200, { unread: estado.porLer }));
        }

        if (endereco.endsWith('/notifications/read') && metodo === 'POST') {
            estado.avisos = estado.avisos.map((aviso) => ({
                ...aviso,
                isRead: true,
            }));
            estado.porLer = 0;

            return Promise.resolve(json(204, null));
        }

        if (endereco.includes('/read') && metodo === 'POST') {
            return Promise.resolve(json(204, null));
        }

        if (endereco.includes('/notifications?page=')) {
            return Promise.resolve(
                opcoes.recusada === true
                    ? json(500, { code: 'INTERNAL_ERROR' })
                    : json(200, caixa(estado.avisos, estado.porLer)),
            );
        }

        throw new Error(`pedido inesperado a ${endereco}`);
    });
};

const montarPagina = (opcoes: Parameters<typeof responder>[0] = {}) => {
    const fetchMock = responder(opcoes);

    vi.stubGlobal('fetch', fetchMock);

    montarEcra(
        <AuthProvider>
            <AvisosProvider>
                <AvisosPage />
            </AvisosProvider>
        </AuthProvider>,
        '/avisos',
    );

    return fetchMock;
};

/** O cabeçalho inteiro, que é onde o número vive. */
const montarAplicacao = (porLer: number): Estado => {
    const estado: Estado = { avisos: AVISOS, porLer };

    vi.stubGlobal('fetch', responder({ estado }));

    montarEcra(
        <AuthProvider>
            <PendingProvider>
                <AvisosProvider>
                    <App />
                </AvisosProvider>
            </PendingProvider>
        </AuthProvider>,
        '/avisos',
    );

    return estado;
};


/**
 * Só o contexto e um consumidor, sem a página dos avisos.
 *
 * A distinção não é um detalhe do teste: o cabeçalho aparece em **todos
 * os ecrãs**, e é precisamente a quem está noutro sítio qualquer que o
 * número tem de chegar. Montar a página junto escondia isso — ela
 * manda recarregar por sua conta, e um cabeçalho parado passava.
 */
const Contagem = () => {
    const { porLer } = useAvisos();

    return <span>{`por ler:${porLer}`}</span>;
};

const montarContexto = (porLer: number): Estado => {
    const estado: Estado = { avisos: AVISOS, porLer };

    vi.stubGlobal('fetch', responder({ estado }));

    montarEcra(
        <AuthProvider>
            <AvisosProvider>
                <Contagem />
            </AvisosProvider>
        </AuthProvider>,
    );

    return estado;
};

const pedidos = (fetchMock: ReturnType<typeof responder>, parte: string) =>
    fetchMock.mock.calls.filter((argumentos) =>
        String(argumentos[0]).includes(parte),
    );

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('a caixa de avisos', () => {
    it('diz o que aconteceu, uma frase por espécie', async () => {
        montarPagina();

        await waitFor(() => {
            expect(
                screen.getByText(
                    `${t.avisos.oQueAconteceu.market_message('ana')} Banshee 900R`,
                ),
            ).toBeTruthy();
        });

        expect(
            screen.getByText(
                `${t.avisos.oQueAconteceu.forum_reply('ana')} Onde se compra munição?`,
            ),
        ).toBeTruthy();
        expect(
            screen.getByText(
                `${t.avisos.oQueAconteceu.market_review('ana')} Banshee 900R`,
            ),
        ).toBeTruthy();
        expect(screen.getByText('A que horas entregas?')).toBeTruthy();
    });

    /**
     * Um aviso que leva a uma página a dizer que aconteceu alguma coisa
     * não serve para nada: quem o abre quer a conversa, o tópico ou o
     * perfil onde a avaliação está.
     */
    it('abre cada espécie onde a coisa está', async () => {
        montarPagina();

        await waitFor(() => {
            expect(screen.getAllByRole('link').length).toBe(4);
        });

        const enderecos = screen
            .getAllByRole('link')
            .map((ligacao) => ligacao.getAttribute('href'));

        expect(enderecos).toEqual([
            '/mercado/conversas/conversa-1',
            '/forum/topico-1',
            '/u/quem',
            '/u/ana',
        ]);
    });

    /**
     * O que está por ler distingue-se do que já se leu, e não só pela
     * ordem: quem abre a caixa a meio da tarde quer ver **o que é
     * novo** sem ter de se lembrar de onde ficou.
     */
    it('marca no ecrã o que ainda está por ler', async () => {
        montarPagina();

        await waitFor(() => {
            expect(screen.getAllByRole('listitem').length).toBe(4);
        });

        expect(
            screen
                .getAllByRole('listitem')
                .map((linha) => linha.className.includes('por-ler')),
        ).toEqual([true, true, false, false]);
    });

    /**
     * A conta de quem escreveu pode ter saído entretanto, e o aviso
     * continua a ser verdade — só deixa de ter nome.
     */
    it('não deixa um buraco onde estava o nome de quem saiu', async () => {
        montarPagina();

        await waitFor(() => {
            expect(
                screen.getByText(
                    `${t.avisos.oQueAconteceu.market_review_reply(t.avisos.alguem)} Sultan RS`,
                ),
            ).toBeTruthy();
        });
    });

    it('dá por lido o aviso que se abre, e só esse', async () => {
        const fetchMock = montarPagina();

        await waitFor(() => {
            expect(screen.getAllByRole('link').length).toBe(4);
        });

        const ligacao = screen.getAllByRole('link')[0];

        expect(ligacao).toBeTruthy();
        await userEvent.click(ligacao as HTMLElement);

        await waitFor(() => {
            expect(pedidos(fetchMock, '/notifications/aviso-1/read').length)
                .toBe(1);
        });

        expect(pedidos(fetchMock, '/notifications/aviso-2/read').length).toBe(0);
    });

    /**
     * Abrir a caixa **não** dá tudo por lido: quem chega a meio da
     * tarde tem o direito de ver o que estava por ler. Por isso há um
     * botão, e é ele que limpa o número da barra.
     */
    it('não dá nada por lido só por se abrir a caixa', async () => {
        const fetchMock = montarPagina();

        await waitFor(() => {
            expect(screen.getAllByRole('link').length).toBe(4);
        });

        expect(
            pedidos(fetchMock, '/read').filter(
                (argumentos) =>
                    (argumentos[1] as { method?: string } | undefined)
                        ?.method === 'POST',
            ).length,
        ).toBe(0);
    });

    it('dá tudo por lido, e o número deixa de estar lá', async () => {
        const fetchMock = montarPagina();

        const botao = await screen.findByRole('button', {
            name: t.avisos.darTodosPorLidos,
        });

        await userEvent.click(botao);

        await waitFor(() => {
            expect(
                screen.queryByRole('button', {
                    name: t.avisos.darTodosPorLidos,
                }),
            ).toBeNull();
        });

        /** Voltou a pedir a caixa e a contagem, e não ficou a adivinhar. */
        expect(pedidos(fetchMock, '/notifications?page=').length).toBe(2);
        expect(pedidos(fetchMock, '/notifications/unread').length).toBe(2);
    });

    it('não oferece o botão a quem não tem nada por ler', async () => {
        montarPagina({ porLer: 0 });

        await waitFor(() => {
            expect(screen.getAllByRole('link').length).toBe(4);
        });

        expect(
            screen.queryByRole('button', { name: t.avisos.darTodosPorLidos }),
        ).toBeNull();
    });

    /**
     * E a lista acompanha quem está **nesta** página: é precisamente
     * quem está à espera de ver aparecer alguma coisa.
     */
    it('e a lista vai buscar o que chegou entretanto', async () => {
        const estado: Estado = { avisos: AVISOS, porLer: 2 };

        vi.stubGlobal('fetch', responder({ estado }));

        montarEcra(
            <AuthProvider>
                <AvisosProvider>
                    <AvisosPage />
                </AvisosProvider>
            </AuthProvider>,
            '/avisos',
        );

        await waitFor(() => {
            expect(screen.getAllByRole('listitem').length).toBe(4);
        });

        estado.avisos = [
            {
                id: 'aviso-5',
                kind: 'forum_reply',
                actor: ANA,
                openId: 'topico-2',
                about: 'Uma pergunta que chegou agora',
                excerpt: null,
                isRead: false,
                createdAt: '2026-09-24T12:00:00.000Z',
            },
            ...AVISOS,
        ];

        irEVoltar();

        await waitFor(() => {
            expect(screen.getAllByRole('listitem').length).toBe(5);
        });
    });

    it('diz que não há nada em vez de mostrar uma lista vazia', async () => {
        montarPagina({ avisos: [], porLer: 0 });

        await waitFor(() => {
            expect(screen.getByText(t.avisos.vazio)).toBeTruthy();
        });
    });

    it('diz que não conseguiu, em vez de uma caixa vazia que mente', async () => {
        montarPagina({ recusada: true });

        await waitFor(() => {
            expect(screen.getByText(t.avisos.naoCarregou)).toBeTruthy();
        });
    });
});

describe('o número por ler no cabeçalho', () => {
    it('conta os que estão por ler', async () => {
        montarAplicacao(7);

        await waitFor(() => {
            expect(screen.getByTitle(t.avisos.porLer('7'))).toBeTruthy();
        });
    });

    /**
     * Trezentos não é uma informação diferente de "muitos", e três
     * algarismos ao lado de um item de menu empurravam o resto da barra
     * para fora do ecrã de um telemóvel.
     */
    it('põe tecto ao número em vez de empurrar a barra', async () => {
        montarAplicacao(300);

        await waitFor(() => {
            expect(screen.getByTitle(t.avisos.porLer('99+'))).toBeTruthy();
        });

        expect(screen.getByText('99+')).toBeTruthy();
    });

    /**
     * E o tecto é um tecto, não um arredondamento: noventa e nove
     * avisos por ler são noventa e nove, e escrever "99+" a quem os
     * tem é dizer-lhe que há mais do que aquilo que há.
     */
    it('e noventa e nove ainda são noventa e nove', async () => {
        montarAplicacao(99);

        await waitFor(() => {
            expect(screen.getByTitle(t.avisos.porLer('99'))).toBeTruthy();
        });

        expect(screen.queryByText('99+')).toBeNull();
    });

    /**
     * E acompanha quem não recarrega a página.
     *
     * O número era pedido **uma vez**, no arranque. Numa aplicação de
     * uma página só, quem entra de manhã e navega a tarde inteira
     * nunca mais via um número novo — e um aviso que só aparece a quem
     * carrega em F5 não avisa ninguém.
     */
    it('e acerta sozinho quando a pessoa volta ao separador', async () => {
        const estado = montarContexto(1);

        await waitFor(() => {
            expect(screen.getByText('por ler:1')).toBeTruthy();
        });

        /** Chegaram mais quatro enquanto ela estava noutro lado. */
        estado.porLer = 5;

        irEVoltar();

        await waitFor(() => {
            expect(screen.getByText('por ler:5')).toBeTruthy();
        });
    });

    /**
     * E uma falha de rede não apaga um número que estava certo.
     *
     * Isto passou a correr sozinho de minuto a minuto. Pôr zero a cada
     * resposta que não chega fazia o número desaparecer à frente de
     * quem tem cinco avisos por ler, e voltar um minuto depois — e um
     * número que pisca é um número que se deixa de ler.
     */
    it('e não apaga o número quando a rede falha', async () => {
        const estado = montarContexto(5);

        await waitFor(() => {
            expect(screen.getByText('por ler:5')).toBeTruthy();
        });

        estado.falha = true;

        irEVoltar();

        /**
         * Esperar que o pedido tenha mesmo ido e falhado: sem isto, a
         * asserção corria antes da resposta e passava com o defeito
         * lá dentro. Um mutante mostrou-o.
         */
        await waitFor(() => {
            expect(
                pedidos(
                    global.fetch as ReturnType<typeof responder>,
                    '/notifications/unread',
                ).length,
            ).toBe(2);
        });

        expect(screen.getByText('por ler:5')).toBeTruthy();
    });

    it('não desenha algarismo nenhum a quem não tem avisos', async () => {
        montarAplicacao(0);

        await waitFor(() => {
            expect(screen.getAllByText(t.nav.avisos).length).toBeGreaterThan(0);
        });

        expect(screen.queryByTitle(t.avisos.porLer('0'))).toBeNull();
    });
});
