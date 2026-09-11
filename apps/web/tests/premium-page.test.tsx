import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthProvider } from '../src/auth/auth.context.js';
import { PremiumPage } from '../src/billing/pages/premium.page.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const PLANO_CREW = {
    key: 'premium',
    name: 'Crew',
    description: 'A tesouraria da crew.',
    priceCents: 499,
    currency: 'EUR',
    intervalMonths: 1,
    ownerKind: 'crew' as const,
};

/**
 * Os três escalões de servidor, como a API os devolve quando estão
 * todos abertos. O que os separa é quantas crews podem lá jogar.
 */
const ESCALOES = [
    {
        key: 'server_base',
        name: 'Servidor',
        description: 'Para o servidor e para as crews que lá jogam.',
        priceCents: 1_499,
        currency: 'EUR',
        intervalMonths: 1,
        ownerKind: 'server' as const,
        maxCrews: 10,
    },
    {
        key: 'server_plus',
        name: 'Servidor +',
        description: 'Para servidores com muitas crews.',
        priceCents: 1_999,
        currency: 'EUR',
        intervalMonths: 1,
        ownerKind: 'server' as const,
        maxCrews: 50,
    },
    {
        key: 'server_unlimited',
        name: 'Servidor sem limite',
        description: 'Sem limite de crews.',
        priceCents: 9_999,
        currency: 'EUR',
        intervalMonths: 1,
        ownerKind: 'server' as const,
        maxCrews: null,
    },
];

const CATALOGO = {
    available: true,
    plans: [PLANO_CREW, ...ESCALOES],
};

const SEM_PLANO = { isPremium: false, isLifetime: false, activeUntil: null };

const SERVIDOR = {
    id: 'server-1',
    name: 'Vice City RP',
    region: 'EU',
    description: null,
    isOnline: true,
    isPremium: false,
    appearance: { bannerUrl: null, accentColor: null },
    memberCount: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
};

const CREW = {
    id: 'crew-1',
    name: 'Vice Kings',
    tag: 'VICE',
    description: null,
    level: 1,
    xp: '0',
    levelXp: '0',
    nextLevelXp: '100',
    rank: null,
    influence: 0,
    prestige: 0,
    isPremium: false,
    premiumVia: null,
    appearance: { bannerUrl: null, accentColor: null },
    memberCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
};

interface Cenario {
    catalogo?: unknown;
    plano?: unknown;
    /** Quem está a ver, ou ninguém. */
    comSessao?: boolean;
    checkout?: Response;
    crew?: unknown;
    servidor?: unknown;
}

const servidor = (cenario: Cenario) =>
    vi.fn((url: string) => {
        const endereco = String(url);

        /**
         * O AuthProvider troca o cookie por um access token ao arrancar.
         * Um 401 aqui é a forma honesta de dizer "não há sessão" — sem
         * isso, os casos de quem não tem conta passavam por acidente.
         */
        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                cenario.comSessao === false
                    ? json(401, { code: 'INVALID_REFRESH_TOKEN' })
                    : json(200, {
                        accessToken: 'token',
                        user: {
                            id: 'u1',
                            email: 'jogador@vicehub.test',
                            username: 'jogador',
                        },
                    }),
            );
        }

        if (endereco.endsWith('/billing/plans')) {
            return Promise.resolve(json(200, cenario.catalogo ?? CATALOGO));
        }

        if (endereco.endsWith('/subscriptions/me')) {
            return Promise.resolve(json(200, cenario.plano ?? SEM_PLANO));
        }

        if (endereco.includes('/crews/')) {
            return Promise.resolve(json(200, cenario.crew ?? CREW));
        }

        if (endereco.includes('/servers/')) {
            return Promise.resolve(json(200, cenario.servidor ?? SERVIDOR));
        }

        if (endereco.endsWith('/billing/checkout')) {
            return Promise.resolve(
                cenario.checkout ??
                    json(200, { url: 'https://checkout.stripe.com/c/pay/x' }),
            );
        }

        return Promise.resolve(json(404, {}));
    });

const montar = (endereco = '/premium') =>
    montarEcra(
        <AuthProvider>
            <PremiumPage />
        </AuthProvider>,
        endereco,
    );

/** O corpo com que o checkout foi pedido, para ver a quem vai o plano. */
const corpoDoCheckout = (fetchMock: ReturnType<typeof vi.fn>): unknown => {
    const chamada = fetchMock.mock.calls.find((argumentos) =>
        String(argumentos[0]).endsWith('/billing/checkout'),
    );

    return JSON.parse(
        String((chamada?.[1] as { body?: string } | undefined)?.body ?? '{}'),
    );
};

/**
 * O `window.location.assign` não existe no jsdom como coisa que se possa
 * espiar sem o substituir.
 */
const irPara = vi.fn();

beforeEach(() => {
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, assign: irPara },
    });

    irPara.mockClear();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('o ecrã do premium', () => {
    /**
     * Sem comunidade no caminho, este ecrã é a lista de preços pública:
     * mostra a escada toda. Quem vem ver quanto custa quer ver quanto
     * custa tudo, e não só a linha mais barata — e um servidor que só
     * visse 4,99 € ficava a achar que o plano dele custava isso.
     */
    it('mostra a escada de preços toda, no formato do idioma', async () => {
        vi.stubGlobal('fetch', servidor({}));

        montar();

        expect(await screen.findByText('\u20ac4.99')).toBeTruthy();
        expect(screen.getByText('\u20ac14.99')).toBeTruthy();
        expect(screen.getByText('\u20ac19.99')).toBeTruthy();
        expect(screen.getByText('\u20ac99.99')).toBeTruthy();
        expect(screen.getByText(t.premium.todosPorMes)).toBeTruthy();
    });

    /**
     * O preço vê-se sem conta de propósito: quem ainda não a tem é
     * precisamente quem precisa de saber quanto custa antes de a criar.
     */
    it('mostra o preço a quem não tem sessão, e convida-a a criar conta', async () => {
        vi.stubGlobal('fetch', servidor({ comSessao: false }));

        montar();

        expect(await screen.findByText('\u20ac4.99')).toBeTruthy();
        expect(screen.getByText(t.premium.criarConta)).toBeTruthy();
        expect(screen.queryByText(t.premium.comprar)).toBeNull();
    });

    it('leva quem clica para o pagamento do Stripe', async () => {
        vi.stubGlobal('fetch', servidor({}));

        /** De uma crew: o plano é de uma comunidade, e só aí se compra. */
        montar('/premium?crew=crew-1');

        await userEvent.click(await screen.findByText(t.premium.comprar));

        await waitFor(() => {
            expect(irPara).toHaveBeenCalledWith(
                'https://checkout.stripe.com/c/pay/x',
            );
        });
    });

    /**
     * O caso de hoje: sem chaves configuradas. O aviso aparece **antes**
     * do clique — um 503 depois de alguém decidir pagar lê-se como
     * avaria, e é a pior altura para parecer avariado.
     */
    describe('quando a compra ainda não está aberta', () => {
        beforeEach(() => {
            vi.stubGlobal(
                'fetch',
                servidor({ catalogo: { ...CATALOGO, available: false } }),
            );
        });

        it('não oferece um botão que não funciona', async () => {
            montar('/premium?crew=crew-1');

            expect(await screen.findByText(t.premium.aindaNaoAbriu)).toBeTruthy();
            expect(screen.queryByText(t.premium.comprar)).toBeNull();
        });

        it('continua a mostrar o preço', async () => {
            montar('/premium?crew=crew-1');

            expect(await screen.findByText('\u20ac4.99')).toBeTruthy();
        });

        /**
         * Não estar aberta é um facto da instalação, e não da pessoa.
         * Convidar quem chega de fora a criar conta para comprar uma
         * coisa que ainda não se vende é fazê-la descobrir isso depois
         * de já ter dado o email.
         */
        it('não convida a criar conta para comprar o que não se vende', async () => {
            vi.stubGlobal(
                'fetch',
                servidor({
                    catalogo: { ...CATALOGO, available: false },
                    comSessao: false,
                }),
            );

            montar('/premium?crew=crew-1');

            expect(await screen.findByText(t.premium.aindaNaoAbriu)).toBeTruthy();
            expect(screen.queryByText(t.premium.criarConta)).toBeNull();
        });
    });

    /**
     * Pedir dinheiro a quem já recebeu o vitalício é a espécie de erro
     * que ninguém repara e toda a gente acha mal.
     */
    it('não oferece a compra a quem tem vitalício', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                plano: { isPremium: true, isLifetime: true, activeUntil: null },
            }),
        );

        montar();

        expect(await screen.findByText(t.premium.tensVitalicio)).toBeTruthy();
        expect(screen.queryByText(t.premium.comprar)).toBeNull();
    });

    it('não oferece a compra a uma comunidade que já tem plano a correr', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                plano: {
                    isPremium: true,
                    isLifetime: false,
                    activeUntil: '2026-10-01T00:00:00.000Z',
                },
                crew: { ...CREW, isPremium: true },
            }),
        );

        montar('/premium?crew=crew-1');

        await waitFor(() => {
            expect(screen.queryByText(t.premium.comprar)).toBeNull();
        });
    });

    /**
     * O vitalício aparece a toda a gente, e não só a quem o tem: é o que
     * os primeiros a chegar vão receber, e uma coisa que ninguém sabe
     * que existe não é um gesto.
     */
    it('diz que o vitalício existe e não se compra', async () => {
        vi.stubGlobal('fetch', servidor({}));

        montar();

        expect(await screen.findByText(t.premium.notaVitalicio)).toBeTruthy();
    });

    /**
     * Um 503 no clique diz a mesma coisa que o aviso antes dele. Duas
     * redações para o mesmo facto fariam a segunda parecer outra coisa.
     */
    it('lê um 503 no clique como "ainda não abriu"', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                checkout: json(503, { code: 'BILLING_NOT_CONFIGURED' }),
            }),
        );

        montar('/premium?crew=crew-1');

        await userEvent.click(await screen.findByText(t.premium.comprar));

        expect(await screen.findByText(t.premium.aindaNaoAbriu)).toBeTruthy();
        expect(irPara).not.toHaveBeenCalled();
    });
});

/**
 * Comprar para uma crew é o caso que sustenta o negócio: um líder paga
 * uma vez pela comunidade toda, em vez de vinte pessoas pagarem cada uma
 * a sua. O titular vem do endereço — sem isso, quem viesse da página de
 * uma crew comprava para si próprio e a crew continuava sem nada.
 */
describe('comprar para uma crew', () => {
    it('diz o nome da crew, e não o identificador', async () => {
        vi.stubGlobal('fetch', servidor({}));

        montar('/premium?crew=crew-1');

        expect(
            await screen.findByText(t.premium.tituloComunidade('Vice Kings')),
        ).toBeTruthy();
    });

    it('compra para a crew, e não para quem clica', async () => {
        const fetchMock = servidor({});
        vi.stubGlobal('fetch', fetchMock);

        montar('/premium?crew=crew-1');

        await userEvent.click(await screen.findByText(t.premium.comprar));

        await waitFor(() => {
            expect(irPara).toHaveBeenCalled();
        });

        expect(corpoDoCheckout(fetchMock)).toEqual({
            ownerKind: 'crew',
            ownerId: 'crew-1',
            plan: 'premium',
        });
    });

    /**
     * Sem comunidade no endereço não há nada a vender.
     *
     * Durante um tempo este ecrã comprava para quem clicava — e o que
     * essa pessoa levava era a personalização do perfil, que passou a
     * ser de graça para toda a gente. Hoje o que se paga é gerir uma
     * comunidade, e isso não é de ninguém em particular: a API recusa a
     * compra pessoal, por isso um botão aqui seria um botão que só pode
     * falhar.
     */
    it('sem comunidade no endereço, não vende nada a ninguém', async () => {
        const fetchMock = servidor({});
        vi.stubGlobal('fetch', fetchMock);

        montar();

        expect(
            await screen.findByText(t.premium.planoEDeComunidade),
        ).toBeTruthy();

        expect(screen.queryByText(t.premium.comprar)).toBeNull();

        expect(
            screen
                .getByText(t.premium.asMinhasComunidades)
                .getAttribute('href'),
        ).toBe('/eu/comunidades');
    });

    /**
     * Quem ainda não tem conta continua a poder ler quanto custa — é
     * precisamente quem precisa de o saber antes de a criar — mas o que
     * lhe é oferecido é criar a conta, e não uma compra que não existe.
     */
    it('a quem não tem sessão, oferece criar conta e não comprar', async () => {
        vi.stubGlobal('fetch', servidor({ comSessao: false }));

        montar();

        expect(
            await screen.findByText(t.premium.planoEDeComunidade),
        ).toBeTruthy();
        expect(screen.getByText(t.premium.criarConta)).toBeTruthy();
        expect(screen.queryByText(t.premium.comprar)).toBeNull();
    });

    /**
     * O plano que conta é o da crew. Sem isto, quem já fosse premium não
     * conseguia comprar para a crew: o ecrã via o plano *dele* e dizia
     * que já estava tratado.
     */
    it('olha para o plano da crew, e não para o de quem está a ver', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                plano: { isPremium: true, isLifetime: true, activeUntil: null },
                crew: { ...CREW, isPremium: false },
            }),
        );

        montar('/premium?crew=crew-1');

        expect(await screen.findByText(t.premium.comprar)).toBeTruthy();
        expect(screen.queryByText(t.premium.tensVitalicio)).toBeNull();
    });

    /**
     * O que o plano dá muda com o titular. "Personaliza o teu perfil" a
     * quem compra para uma crew, e "pode ser comprado para uma crew, e
     * não só para ti" na própria página da crew, era falar do produto
     * errado à pessoa certa.
     */
    it('fala da crew, e não do perfil de quem está a ver', async () => {
        vi.stubGlobal('fetch', servidor({}));

        montar('/premium?crew=crew-1');

        expect(
            await screen.findByText(t.premium.crewDaPersonalizacao),
        ).toBeTruthy();
        expect(screen.getByText(t.premium.crewDaEquipa)).toBeTruthy();
        expect(screen.queryByText(t.premium.oQueDaPersonalizacao)).toBeNull();
        expect(screen.queryByText(t.premium.oQueDaCrew)).toBeNull();
    });

    it('não oferece a compra a uma crew que já tem plano', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({ crew: { ...CREW, isPremium: true } }),
        );

        montar('/premium?crew=crew-1');

        expect(await screen.findByText(t.premium.crewTemPlano)).toBeTruthy();
        expect(screen.queryByText(t.premium.comprar)).toBeNull();
    });
});

/**
 * O mesmo caminho da crew, para o outro titular. O que muda é o
 * substantivo — e é por isso que as frases são escritas por inteiro em
 * cada idioma em vez de interpoladas: "o plano é **da** crew" e "**do**
 * servidor" não se resolvem com uma palavra trocada.
 */
describe('comprar para um servidor', () => {
    it('diz o nome do servidor', async () => {
        vi.stubGlobal('fetch', servidor({}));

        montar('/premium?servidor=server-1');

        expect(
            await screen.findByText(t.premium.tituloComunidade('Vice City RP')),
        ).toBeTruthy();
    });

    it('compra para o servidor, e não para quem clica', async () => {
        const fetchMock = servidor({});
        vi.stubGlobal('fetch', fetchMock);

        montar('/premium?servidor=server-1');

        await userEvent.click(await screen.findByText(t.premium.comprar));

        await waitFor(() => {
            expect(irPara).toHaveBeenCalled();
        });

        expect(corpoDoCheckout(fetchMock)).toEqual({
            ownerKind: 'server',
            ownerId: 'server-1',
            /** Por omissão, o escalão mais barato dos que servem. */
            plan: 'server_base',
        });
    });

    /**
     * **O que este ecrã tem de acertar.**
     *
     * Antes havia um preço configurado só, e o checkout vendia esse
     * fosse qual fosse o botão em que se carregou: um servidor que
     * escolhesse o escalão sem limite pagava 4,99 € e ficava com três
     * lugares. O que aqui se prova é que o escalão escolhido é o
     * escalão comprado.
     */
    it('compra o escalão que foi escolhido, e não o primeiro', async () => {
        const fetchMock = servidor({});
        vi.stubGlobal('fetch', fetchMock);

        montar('/premium?servidor=server-1');

        await userEvent.click(
            await screen.findByText('Servidor sem limite'),
        );
        await userEvent.click(screen.getByText(t.premium.comprar));

        await waitFor(() => {
            expect(irPara).toHaveBeenCalled();
        });

        expect(corpoDoCheckout(fetchMock)).toMatchObject({
            plan: 'server_unlimited',
        });
    });

    /**
     * A um servidor que já paga — ou que está nos trinta dias de
     * avaliação — os escalões continuam à vista, e a escolha não: por
     * baixo não há botão nenhum onde a usar, e uma escolha que não leva
     * a lado nenhum é pior do que escolha nenhuma.
     */
    it('mostra os preços mas não a escolha a quem já tem plano', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({ servidor: { ...SERVIDOR, isPremium: true } }),
        );

        montar('/premium?servidor=server-1');

        expect(await screen.findByText('\u20ac99.99')).toBeTruthy();
        expect(screen.queryByText(t.premium.escolheEscalao)).toBeNull();
        expect(screen.queryByText(t.premium.comprar)).toBeNull();
        expect(screen.getByText(t.premium.servidorTemPlano)).toBeTruthy();
    });

    /**
     * O que separa os três escalões é quantas crews podem lá jogar.
     * Sem isso, são três preços a subir sem dizer porquê — e um preço
     * que sobe sem razão visível lê-se como arbitrário.
     */
    it('diz quantas crews cada escalão dá', async () => {
        vi.stubGlobal('fetch', servidor({}));

        montar('/premium?servidor=server-1');

        expect(await screen.findByText(t.premium.ateCrews(10))).toBeTruthy();
        expect(screen.getByText(t.premium.ateCrews(50))).toBeTruthy();
        expect(screen.getByText(t.premium.semLimiteDeCrews)).toBeTruthy();
    });

    /**
     * Um servidor não compra o plano de uma crew: o que ele vende são
     * lugares para crews, e o da crew abre a tesouraria de uma crew.
     * Oferecê-lo aqui era oferecer um botão que a API recusa.
     */
    it('não oferece o plano da crew a um servidor', async () => {
        vi.stubGlobal('fetch', servidor({}));

        montar('/premium?servidor=server-1');

        await screen.findByText(t.premium.escolheEscalao);

        expect(screen.queryByText('\u20ac4.99')).toBeNull();
    });

    /**
     * E ao contrário. Uma crew com três escalões de servidor para
     * escolher compraria lugares que não tem onde pôr.
     */
    it('não oferece escalões de servidor a uma crew', async () => {
        vi.stubGlobal('fetch', servidor({}));

        montar('/premium?crew=crew-1');

        expect(await screen.findByText('\u20ac4.99')).toBeTruthy();
        expect(screen.queryByText(t.premium.escolheEscalao)).toBeNull();
        expect(screen.queryByText('\u20ac99.99')).toBeNull();
    });

    /**
     * Uma instalação que só abriu o preço da crew não tem nada a vender
     * a um servidor. Dizer-lhe "ainda não abriu" é a verdade — ao
     * contrário de um botão que a API recusa depois do clique.
     */
    it('diz que ainda não abriu quando não há escalão para este titular', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({ catalogo: { available: true, plans: [PLANO_CREW] } }),
        );

        montar('/premium?servidor=server-1');

        expect(await screen.findByText(t.premium.aindaNaoAbriu)).toBeTruthy();
        expect(screen.queryByText(t.premium.comprar)).toBeNull();
    });

    it('fala do servidor, e não da crew nem do perfil', async () => {
        vi.stubGlobal('fetch', servidor({}));

        montar('/premium?servidor=server-1');

        expect(
            await screen.findByText(t.premium.servidorDaPersonalizacao),
        ).toBeTruthy();
        expect(screen.getByText(t.premium.servidorDaEquipa)).toBeTruthy();
        expect(screen.queryByText(t.premium.crewDaPersonalizacao)).toBeNull();
        expect(screen.queryByText(t.premium.oQueDaPersonalizacao)).toBeNull();
    });

    it('não oferece a compra a um servidor que já tem plano', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({ servidor: { ...SERVIDOR, isPremium: true } }),
        );

        montar('/premium?servidor=server-1');

        expect(await screen.findByText(t.premium.servidorTemPlano)).toBeTruthy();
        expect(screen.queryByText(t.premium.comprar)).toBeNull();
    });
    /**
     * Uma crew coberta pelo servidor onde joga já tem o que este ecrã
     * vende. Dizer-lhe apenas "já tens plano" escondia de quem é o plano
     * — e o dia em que a crew saísse do servidor perdia-o sem explicação.
     */
    it('diz a uma crew coberta pelo servidor de onde lhe vem o plano', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                crew: {
                    ...CREW,
                    isPremium: true,
                    premiumVia: {
                        kind: 'server',
                        id: 'server-1',
                        name: 'Vice City RP',
                    },
                },
            }),
        );

        montar('/premium?crew=crew-1');

        expect(
            await screen.findByText(
                t.premium.crewCobertaPeloServidor('Vice City RP'),
            ),
        ).toBeTruthy();
        expect(screen.queryByText(t.premium.comprar)).toBeNull();
        expect(screen.queryByText(t.premium.crewTemPlano)).toBeNull();
    });

    /**
     * O plano próprio não vem de lado nenhum, e a frase tem de o dizer:
     * uma crew que paga o seu não o perde ao sair de um servidor.
     */
    it('a uma crew com plano próprio não fala de servidor nenhum', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({ crew: { ...CREW, isPremium: true, premiumVia: null } }),
        );

        montar('/premium?crew=crew-1');

        expect(await screen.findByText(t.premium.crewTemPlano)).toBeTruthy();
    });
});
