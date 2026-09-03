import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { MyProfilePage } from '../src/profile/pages/my-profile.page.js';

const perfil = (overrides: Record<string, unknown> = {}) => ({
    id: 'u1',
    username: 'player',
    email: 'player@vicehub.test',
    emailVerifiedAt: null,
    lastLoginAt: null,
    avatarUrl: null,
    bio: null,
    level: 3,
    xp: '9007199254740993',
    reputation: 7,
    isPremium: false,
    premiumUntil: null,
    appearance: { bannerUrl: null, accentColor: null },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const montar = () =>
    render(
        <MemoryRouter>
            <MyProfilePage />
        </MemoryRouter>,
    );

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
            expect(screen.getByLabelText('Cor de destaque')).toBeDefined();
        });

        expect(screen.getByLabelText('Banner')).toBeDefined();
    });

    it('diz que a personalização é do plano a quem não o tem', async () => {
        montar();

        await waitFor(() => {
            expect(screen.getByText(/fazem parte do plano premium/i)).toBeDefined();
        });
    });

    it('não repete esse aviso a quem tem plano', async () => {
        servir(perfil({ isPremium: true }));

        montar();

        await waitFor(() => {
            expect(screen.getByLabelText('Banner')).toBeDefined();
        });

        expect(screen.queryByText(/fazem parte do plano premium/i)).toBeNull();
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
            expect(screen.getByLabelText('Cor de destaque')).toBeDefined();
        });

        await utilizadora.type(screen.getByLabelText('Cor de destaque'), '#E93CEF');
        await utilizadora.click(
            screen.getByRole('button', { name: /guardar personalização/i }),
        );

        await waitFor(() => {
            expect(
                screen.getByText('A personalização faz parte do plano premium.'),
            ).toBeDefined();
        });
    });

    it('não deixa guardar uma cor mal escrita', async () => {
        const utilizadora = userEvent.setup();

        montar();

        await waitFor(() => {
            expect(screen.getByLabelText('Cor de destaque')).toBeDefined();
        });

        await utilizadora.type(screen.getByLabelText('Cor de destaque'), '#ABC');

        expect(
            screen
                .getByRole('button', { name: /guardar personalização/i })
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
                expect(screen.getByText('Premium vitalício')).toBeDefined();
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
                expect(screen.getByText(/Premium até/)).toBeDefined();
            });
        });

        it('sem plano, di-lo sem rodeios', async () => {
            montar();

            await waitFor(() => {
                expect(screen.getByText('Sem plano')).toBeDefined();
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
