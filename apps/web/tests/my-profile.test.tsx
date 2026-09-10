import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MyProfilePage } from '../src/profile/pages/my-profile.page.js';
import { montarEcra, t } from './helpers.js';

const perfil = (overrides: Record<string, unknown> = {}) => ({
    id: 'u1',
    username: 'player',
    email: 'player@vicehub.test',
    emailVerifiedAt: null,
    lastLoginAt: null,
    avatarUrl: null,
    bio: null,
    level: 100,
    xp: '9007199254740993',
    levelXp: '495000',
    nextLevelXp: null,
    reputation: 7,
    isPremium: false,
    premiumUntil: null,
    appearance: { bannerUrl: null, accentColor: null },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

/** Os amigos e os pedidos que a API devolve, por omissão. */
const amigos = [
    {
        userId: 'u-2',
        username: 'bruno',
        avatarUrl: null,
        level: 3,
        since: '2026-02-01T00:00:00.000Z',
    },
];

const pedidos = [
    {
        userId: 'u-3',
        username: 'carla',
        avatarUrl: null,
        level: 1,
        since: '2026-02-02T00:00:00.000Z',
        direction: 'incoming' as const,
    },
];

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const montar = () => montarEcra(<MyProfilePage />);

describe('o meu perfil', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    const servir = (
        eu: ReturnType<typeof perfil>,
        aoGuardarAparencia: Response = json(200, {}),
    ) => {
        fetchMock = vi.fn((url: string, opcoes?: RequestInit) => {
            if (String(url).endsWith('/appearance')) {
                return Promise.resolve(aoGuardarAparencia);
            }

            /*
              O perfil pede também os amigos e os pedidos por responder.
              Sem estas rotas, a lista recebia o perfil onde esperava um
              array — e o ecrã ia abaixo por uma razão que não é a do
              teste.
            */
            if (String(url).endsWith('/friends')) {
                return Promise.resolve(json(200, amigos));
            }

            if (String(url).endsWith('/friends/requests')) {
                return Promise.resolve(json(200, pedidos));
            }

            if (opcoes?.method === 'PATCH') {
                return Promise.resolve(json(200, eu));
            }

            return Promise.resolve(json(200, eu));
        });

        vi.stubGlobal('fetch', fetchMock);
    };

    beforeEach(() => {
        servir(perfil());
    });

    /**
     * A razão de a personalização aparecer a quem não tem plano.
     *
     * Escondê-la faria com que quem recebesse o premium não soubesse que
     * ganhou alguma coisa — e é precisamente isso que os primeiros
     * utilizadores vão receber.
     */
    it('mostra a personalização mesmo sem plano', async () => {
        montar();

        await waitFor(() => {
            expect(screen.getByLabelText(t.perfil.cor)).toBeDefined();
        });

        expect(screen.getByLabelText(t.perfil.banner)).toBeDefined();
    });

    /**
     * O contrário do que esta secção já dizia.
     *
     * Personalizar o perfil era pago, e quem não tinha plano via um
     * aviso e um link para comprar por cima do formulário. Deixou de
     * ser: a cara e o banner de quem joga não se vendem.
     *
     * Tirar a parede sem tirar o aviso seria meia alteração — um
     * formulário que grava debaixo de "precisas de plano" continua a
     * dizer à pessoa que não é bem-vinda. Por isso o que se prova aqui
     * é a ausência: nem etiqueta de plano, nem convite a comprar.
     */
    it('não vende nada a quem vem personalizar o perfil', async () => {
        montar();

        await waitFor(() => {
            expect(screen.getByLabelText(t.perfil.banner)).toBeDefined();
        });

        expect(screen.queryByText(t.perfil.premium)).toBeNull();
        expect(screen.queryByText(t.landing.verPremium)).toBeNull();
    });

    it('e também não muda nada a quem tem plano', async () => {
        servir(perfil({ isPremium: true }));

        montar();

        await waitFor(() => {
            expect(screen.getByLabelText(t.perfil.banner)).toBeDefined();
        });

        expect(screen.queryByText(t.perfil.premium)).toBeNull();
    });

    /**
     * O 402 é a API a dizer que falta o pagamento, e não que algo
     * correu mal. Mostrá-lo como avaria deixaria a pessoa sem saber o
     * que fazer.
     */
    it('lê o 402 como "isto é premium", e não como avaria', async () => {
        const utilizadora = userEvent.setup();

        servir(
            perfil(),
            json(402, {
                code: 'SUBSCRIPTION_REQUIRED',
                message: 'Esta funcionalidade requer uma subscrição premium ativa.',
            }),
        );

        montar();

        await waitFor(() => {
            expect(screen.getByLabelText(t.perfil.cor)).toBeDefined();
        });

        await utilizadora.type(screen.getByLabelText(t.perfil.cor), '#E93CEF');
        await utilizadora.click(
            screen.getByRole('button', { name: t.perfil.guardarPersonalizacao }),
        );

        await waitFor(() => {
            expect(
                screen.getByText(t.perfil.ehPremium),
            ).toBeDefined();
        });
    });

    it('não deixa guardar uma cor mal escrita', async () => {
        const utilizadora = userEvent.setup();

        montar();

        await waitFor(() => {
            expect(screen.getByLabelText(t.perfil.cor)).toBeDefined();
        });

        await utilizadora.type(screen.getByLabelText(t.perfil.cor), '#ABC');

        expect(
            screen
                .getByRole('button', { name: t.perfil.guardarPersonalizacao })
                .hasAttribute('disabled'),
        ).toBe(true);
    });

    /**
     * Um plano sem data de fim é vitalício — é a ausência da data que os
     * distingue, e não uma data no ano 9999.
     */
    describe('como o plano é descrito', () => {
        it('sem data de fim, é vitalício', async () => {
            servir(perfil({ isPremium: true, premiumUntil: null }));

            montar();

            await waitFor(() => {
                expect(screen.getByText(t.perfil.premiumVitalicio)).toBeDefined();
            });
        });

        it('com data de fim, mostra a data', async () => {
            servir(
                perfil({
                    isPremium: true,
                    premiumUntil: '2026-12-31T00:00:00.000Z',
                }),
            );

            montar();

            await waitFor(() => {
                expect(screen.getByText(/Premium until/)).toBeDefined();
            });
        });

        it('sem plano, di-lo sem rodeios', async () => {
            montar();

            await waitFor(() => {
                expect(screen.getByText(t.perfil.semPlano)).toBeDefined();
            });
        });
    });

    it('mostra o xp tal como veio, sem o converter', async () => {
        montar();

        await waitFor(() => {
            expect(screen.getByText('9007199254740993')).toBeDefined();
        });
    });
});
