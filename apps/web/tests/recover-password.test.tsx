import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RecoverPasswordPage } from '../src/auth/pages/recover-password.page.js';
import { montarEcra, t } from './helpers.js';

const responde = (status: number, body: unknown = {}): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const montar = () => montarEcra(<RecoverPasswordPage />);

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
                screen.getByLabelText(t.auth.email),
                'ninguem@vicehub.test',
            );
            await utilizadora.click(screen.getByRole('button', { name: t.auth.enviarLink }));

            await waitFor(() => {
                expect(screen.getByText(t.auth.seExistir)).toBeDefined();
            });
        });

        it('mostra essa mesma confirmação quando o pedido corre bem', async () => {
            const utilizadora = userEvent.setup();

            montar();

            await utilizadora.type(
                screen.getByLabelText(t.auth.email),
                'player@vicehub.test',
            );
            await utilizadora.click(screen.getByRole('button', { name: t.auth.enviarLink }));

            await waitFor(() => {
                expect(screen.getByText(t.auth.seExistir)).toBeDefined();
            });
        });

        it('nunca deixa escapar que a conta não existe', async () => {
            const utilizadora = userEvent.setup();

            fetchMock.mockResolvedValue(responde(404, { code: 'USER_NOT_FOUND' }));

            montar();

            await utilizadora.type(
                screen.getByLabelText(t.auth.email),
                'ninguem@vicehub.test',
            );
            await utilizadora.click(screen.getByRole('button', { name: t.auth.enviarLink }));

            await waitFor(() => {
                expect(screen.getByText(t.auth.seExistir)).toBeDefined();
            });

            expect(document.body.textContent).not.toMatch(/not found|does not exist/i);
            expect(screen.queryByRole('alert')).toBeNull();
        });
    });

    describe('com código no link: pede a password nova', () => {
        it('mostra o formulário da password nova', () => {
            irPara('/recuperar-password?token=segredo-do-email');

            montar();

            expect(screen.getByLabelText(t.auth.novaPassword)).toBeDefined();
        });

        it('envia o token que veio no link, e não o endereço', async () => {
            const utilizadora = userEvent.setup();

            irPara('/recuperar-password?token=segredo-do-email');
            fetchMock.mockResolvedValue(responde(204));

            montar();

            await utilizadora.type(
                screen.getByLabelText(t.auth.novaPassword),
                'password-nova-forte',
            );
            await utilizadora.click(screen.getByRole('button', { name: t.auth.guardarPassword }));

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

            await utilizadora.type(screen.getByLabelText(t.auth.novaPassword), 'curta');

            expect(
                screen.getByRole('button', { name: t.auth.guardarPassword }).hasAttribute('disabled'),
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
                screen.getByLabelText(t.auth.novaPassword),
                'password-nova-forte',
            );
            await utilizadora.click(screen.getByRole('button', { name: t.auth.guardarPassword }));

            await waitFor(() => {
                expect(screen.getByRole('alert').textContent).toBe(
                    t.auth.linkNaoServe,
                );
            });
        });
    });
});
