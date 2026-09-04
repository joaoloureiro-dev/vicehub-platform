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

const CATALOGO = {
    available: true,
    plans: [
        {
            key: 'premium',
            name: 'Premium',
            description: 'Acesso às funcionalidades premium.',
            priceCents: 1_000,
            currency: 'USD',
            intervalMonths: 1,
        },
    ],
};

const SEM_PLANO = { isPremium: false, isLifetime: false, activeUntil: null };

interface Cenario {
    catalogo?: unknown;
    plano?: unknown;
    /** Quem está a ver, ou ninguém. */
    comSessao?: boolean;
    checkout?: Response;
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

        if (endereco.endsWith('/billing/checkout')) {
            return Promise.resolve(
                cenario.checkout ??
                    json(200, { url: 'https://checkout.stripe.com/c/pay/x' }),
            );
        }

        return Promise.resolve(json(404, {}));
    });

const montar = () =>
    montarEcra(
        <AuthProvider>
            <PremiumPage />
        </AuthProvider>,
        '/premium',
    );

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
    it('mostra o preço no formato do idioma', async () => {
        vi.stubGlobal('fetch', servidor({}));

        montar();

        expect(await screen.findByText('$10')).toBeTruthy();
        expect(screen.getByText(t.premium.porMes)).toBeTruthy();
    });

    /**
     * O preço vê-se sem conta de propósito: quem ainda não a tem é
     * precisamente quem precisa de saber quanto custa antes de a criar.
     */
    it('mostra o preço a quem não tem sessão, e convida-a a criar conta', async () => {
        vi.stubGlobal('fetch', servidor({ comSessao: false }));

        montar();

        expect(await screen.findByText('$10')).toBeTruthy();
        expect(screen.getByText(t.premium.criarConta)).toBeTruthy();
        expect(screen.queryByText(t.premium.comprar)).toBeNull();
    });

    it('leva quem clica para o pagamento do Stripe', async () => {
        vi.stubGlobal('fetch', servidor({}));

        montar();

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
            montar();

            expect(await screen.findByText(t.premium.aindaNaoAbriu)).toBeTruthy();
            expect(screen.queryByText(t.premium.comprar)).toBeNull();
        });

        it('continua a mostrar o preço', async () => {
            montar();

            expect(await screen.findByText('$10')).toBeTruthy();
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

            montar();

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

    it('não oferece a compra a quem já tem plano a correr', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                plano: {
                    isPremium: true,
                    isLifetime: false,
                    activeUntil: '2026-10-01T00:00:00.000Z',
                },
            }),
        );

        montar();

        await waitFor(() => {
            expect(screen.queryByText(t.premium.comprar)).toBeNull();
        });

        expect(screen.getByText(/2026/)).toBeTruthy();
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

        montar();

        await userEvent.click(await screen.findByText(t.premium.comprar));

        expect(await screen.findByText(t.premium.aindaNaoAbriu)).toBeTruthy();
        expect(irPara).not.toHaveBeenCalled();
    });
});
