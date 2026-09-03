import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { RecoverPasswordPage } from '../src/auth/pages/recover-password.page.js';

const responde = (status: number, body: unknown = {}): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const montar = () =>
    render(
        <MemoryRouter>
            <RecoverPasswordPage />
        </MemoryRouter>,
    );

const irPara = (url: string) => {
    window.history.replaceState(null, '', url);
};

describe('recuperar a password', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue(responde(202));
        vi.stubGlobal('fetch', fetchMock);
        irPara('/recuperar-password');
    });

    describe('sem código no link: pede o email', () => {
        /**
         * A garantia que o servidor dá e que a interface não pode
         * desfazer.
         *
         * A API responde igual exista ou não a conta, de propósito. Se o
         * ecrã distinguisse os dois casos, bastava experimentar
         * endereços e ler o que aparece — e a lista de quem está
         * registado vale dinheiro a quem faz phishing.
         */
        it('mostra a mesma confirmação quando o pedido falha', async () => {
            const utilizadora = userEvent.setup();

            fetchMock.mockResolvedValue(responde(404, { code: 'USER_NOT_FOUND' }));

            montar();

            await utilizadora.type(
                screen.getByLabelText('Email'),
                'ninguem@vicehub.test',
            );
            await utilizadora.click(screen.getByRole('button', { name: /enviar/i }));

            await waitFor(() => {
                expect(screen.getByText(/se existir uma conta/i)).toBeDefined();
            });
        });

        it('mostra essa mesma confirmação quando o pedido corre bem', async () => {
            const utilizadora = userEvent.setup();

            montar();

            await utilizadora.type(
                screen.getByLabelText('Email'),
                'player@vicehub.test',
            );
            await utilizadora.click(screen.getByRole('button', { name: /enviar/i }));

            await waitFor(() => {
                expect(screen.getByText(/se existir uma conta/i)).toBeDefined();
            });
        });

        it('nunca deixa escapar que a conta não existe', async () => {
            const utilizadora = userEvent.setup();

            fetchMock.mockResolvedValue(responde(404, { code: 'USER_NOT_FOUND' }));

            montar();

            await utilizadora.type(
                screen.getByLabelText('Email'),
                'ninguem@vicehub.test',
            );
            await utilizadora.click(screen.getByRole('button', { name: /enviar/i }));

            await waitFor(() => {
                expect(screen.getByText(/se existir uma conta/i)).toBeDefined();
            });

            expect(document.body.textContent).not.toMatch(/não existe|não encontr/i);
            expect(screen.queryByRole('alert')).toBeNull();
        });
    });

    describe('com código no link: pede a password nova', () => {
        it('mostra o formulário da password nova', () => {
            irPara('/recuperar-password?token=segredo-do-email');

            montar();

            expect(screen.getByLabelText('Password nova')).toBeDefined();
        });

        it('envia o token que veio no link, e não o endereço', async () => {
            const utilizadora = userEvent.setup();

            irPara('/recuperar-password?token=segredo-do-email');
            fetchMock.mockResolvedValue(responde(204));

            montar();

            await utilizadora.type(
                screen.getByLabelText('Password nova'),
                'password-nova-forte',
            );
            await utilizadora.click(screen.getByRole('button', { name: /guardar/i }));

            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalled();
            });

            const corpo = JSON.parse(
                (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
            ) as { token: string; password: string };

            expect(corpo.token).toBe('segredo-do-email');
            expect(corpo.password).toBe('password-nova-forte');
        });

        /**
         * Uma password curta é recusada aqui pelas mesmas regras do
         * registo: uma conta recuperada não deve ficar mais fraca do que
         * era.
         */
        it('não deixa submeter uma password curta', async () => {
            const utilizadora = userEvent.setup();

            irPara('/recuperar-password?token=segredo');

            montar();

            await utilizadora.type(screen.getByLabelText('Password nova'), 'curta');

            expect(
                screen.getByRole('button', { name: /guardar/i }).hasAttribute('disabled'),
            ).toBe(true);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('diz para pedir outro link quando o token já não serve', async () => {
            const utilizadora = userEvent.setup();

            irPara('/recuperar-password?token=gasto');
            fetchMock.mockResolvedValue(
                responde(400, { code: 'INVALID_ACCOUNT_TOKEN' }),
            );

            montar();

            await utilizadora.type(
                screen.getByLabelText('Password nova'),
                'password-nova-forte',
            );
            await utilizadora.click(screen.getByRole('button', { name: /guardar/i }));

            await waitFor(() => {
                expect(screen.getByRole('alert').textContent).toMatch(
                    /já não serve/i,
                );
            });
        });
    });
});
