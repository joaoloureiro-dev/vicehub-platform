import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthError } from '../../src/modules/auth/errors/auth.errors.js';
import { AccountRecoveryService } from '../../src/modules/auth/services/account-recovery.service.js';
import { AccountTokenService } from '../../src/modules/auth/services/account-token.service.js';
import type { AuthRepository } from '../../src/modules/auth/repositories/auth.repository.js';
import type { PasswordService } from '../../src/modules/auth/services/password.service.js';
import type { Mailer } from '../../src/modules/mail/mailer.js';

const utilizador = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'player@vicehub.test',
    username: 'player',
    email_verified_at: null,
    credentials: { id: 'cred-1', is_deleted: false },
    ...overrides,
});

const createRepositoryMock = () => ({
    findUserForRecovery: vi.fn().mockResolvedValue(utilizador()),
    findUserById: vi.fn().mockResolvedValue(utilizador()),
    createAccountToken: vi.fn().mockResolvedValue({ id: 'token-1' }),
    findUsableAccountToken: vi
        .fn()
        .mockResolvedValue({ id: 'token-1', userId: 'user-1' }),
    consumeAccountToken: vi.fn().mockResolvedValue(true),
    invalidateOpenAccountTokens: vi.fn().mockResolvedValue({ count: 0 }),
    updatePasswordHash: vi.fn().mockResolvedValue(undefined),
    markEmailVerified: vi.fn().mockResolvedValue(undefined),
    incrementUserTokenVersion: vi.fn().mockResolvedValue(undefined),
    revokeAllUserSessions: vi.fn().mockResolvedValue({ count: 0 }),
});

describe('AccountRecoveryService', () => {
    let repository: ReturnType<typeof createRepositoryMock>;
    let passwordService: { hash: ReturnType<typeof vi.fn> };
    let mailer: { send: ReturnType<typeof vi.fn> };
    let service: AccountRecoveryService;

    beforeEach(() => {
        repository = createRepositoryMock();
        passwordService = { hash: vi.fn().mockResolvedValue('hash-novo') };
        mailer = { send: vi.fn().mockResolvedValue(undefined) };

        service = new AccountRecoveryService(
            repository as unknown as AuthRepository,
            passwordService as unknown as PasswordService,
            new AccountTokenService(),
            mailer as unknown as Mailer,
        );
    });

    const expectAuthError = async (promise: Promise<unknown>, code: string) => {
        const error = await promise.catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe(code);
    };

    /**
     * A propriedade mais importante do pedido: não pode servir para
     * descobrir quem está registado. Basta experimentar endereços, e essa
     * lista vale dinheiro a quem faz phishing.
     */
    describe('não revela quem tem conta', () => {
        it('não falha quando a conta não existe', async () => {
            repository.findUserForRecovery.mockResolvedValue(null);

            await expect(
                service.requestPasswordReset('ninguem@vicehub.test'),
            ).resolves.toBeUndefined();
        });

        it('não manda email nenhum quando a conta não existe', async () => {
            repository.findUserForRecovery.mockResolvedValue(null);

            await service.requestPasswordReset('ninguem@vicehub.test');

            expect(mailer.send).not.toHaveBeenCalled();
            expect(repository.createAccountToken).not.toHaveBeenCalled();
        });

        /**
         * Uma conta cuja credencial local foi eliminada não tem password
         * para recuperar; mesmo assim, o pedido responde como qualquer
         * outro.
         */
        it('não falha quando a credencial local foi eliminada', async () => {
            repository.findUserForRecovery.mockResolvedValue(
                utilizador({ credentials: { id: 'cred-1', is_deleted: true } }),
            );

            await expect(
                service.requestPasswordReset('player@vicehub.test'),
            ).resolves.toBeUndefined();

            expect(mailer.send).not.toHaveBeenCalled();
        });

        it('procura a conta com o email normalizado', async () => {
            await service.requestPasswordReset('  PLAYER@ViceHub.test ');

            expect(repository.findUserForRecovery).toHaveBeenCalledWith(
                'player@vicehub.test',
            );
        });
    });

    describe('o que é enviado e o que é guardado', () => {
        it('manda o email para o endereço da conta', async () => {
            await service.requestPasswordReset('player@vicehub.test');

            expect(mailer.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: 'player@vicehub.test' }),
            );
        });

        /**
         * O que segue no email é o segredo; o que fica gravado é o
         * resumo. Se o que está na base de dados aparecesse no email, ou
         * o contrário, quem lesse a tabela entrava em qualquer conta.
         */
        it('guarda o resumo, e envia o segredo', async () => {
            await service.requestPasswordReset('player@vicehub.test');

            const gravado = repository.createAccountToken.mock.calls[0]?.[0] as {
                tokenHash: string;
            };

            const enviado = mailer.send.mock.calls[0]?.[0] as { text: string };

            expect(enviado.text).not.toContain(gravado.tokenHash);

            const link = enviado.text
                .split('\n')
                .find((linha) => linha.startsWith('http')) as string;

            const segredo = new URL(link).searchParams.get('token') as string;

            expect(segredo).toBeTruthy();
            expect(
                new AccountTokenService().hashSecret(segredo),
            ).toBe(gravado.tokenHash);
        });

        it('grava o token com o propósito certo', async () => {
            await service.requestPasswordReset('player@vicehub.test');

            expect(repository.createAccountToken).toHaveBeenCalledWith(
                expect.objectContaining({ purpose: 'password_reset' }),
            );
        });

        it('grava um prazo no futuro', async () => {
            await service.requestPasswordReset('player@vicehub.test');

            const gravado = repository.createAccountToken.mock.calls[0]?.[0] as {
                expiresAt: Date;
            };

            expect(gravado.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });

        /**
         * Pedir um link novo mata o anterior. De outra forma, um email
         * antigo continuaria a abrir a conta muito depois de a pessoa ter
         * pedido outro por desconfiar do primeiro.
         */
        it('invalida os links anteriores antes de criar outro', async () => {
            await service.requestPasswordReset('player@vicehub.test');

            const ordemInvalidar = repository.invalidateOpenAccountTokens.mock
                .invocationCallOrder[0] as number;
            const ordemCriar = repository.createAccountToken.mock
                .invocationCallOrder[0] as number;

            expect(ordemInvalidar).toBeLessThan(ordemCriar);
        });

        /**
         * Dois segredos gerados de seguida não podem coincidir, ou o
         * link de uma pessoa abriria a conta de outra.
         */
        it('gera um segredo diferente de cada vez', async () => {
            const tokens = new AccountTokenService();

            const segredos = new Set(
                Array.from({ length: 200 }, () => tokens.generateSecret()),
            );

            expect(segredos.size).toBe(200);
        });
    });

    describe('definir a password nova', () => {
        it('grava a password e gasta o token', async () => {
            await service.resetPassword('segredo', 'password-nova-forte');

            expect(passwordService.hash).toHaveBeenCalledWith(
                'password-nova-forte',
            );
            expect(repository.updatePasswordHash).toHaveBeenCalledWith(
                'user-1',
                'hash-novo',
            );
            expect(repository.consumeAccountToken).toHaveBeenCalledWith('token-1');
        });

        /**
         * A garantia central. Quem recupera uma conta costuma fazê-lo
         * por desconfiar de que outra pessoa lá entrou: trocar a
         * password sem expulsar essa pessoa resolveria a metade errada
         * do problema.
         */
        it('derruba todas as sessões abertas', async () => {
            await service.resetPassword('segredo', 'password-nova-forte');

            expect(repository.incrementUserTokenVersion).toHaveBeenCalledWith(
                'user-1',
            );
            expect(repository.revokeAllUserSessions).toHaveBeenCalledWith(
                'user-1',
                expect.any(Date),
            );
        });

        /**
         * O token é gasto antes de a password mudar: se dois pedidos
         * usarem o mesmo link ao mesmo tempo, o segundo não chega a
         * escrever uma password que ninguém pediu.
         */
        it('gasta o token antes de escrever a password', async () => {
            await service.resetPassword('segredo', 'password-nova-forte');

            const ordemGastar = repository.consumeAccountToken.mock
                .invocationCallOrder[0] as number;
            const ordemEscrever = repository.updatePasswordHash.mock
                .invocationCallOrder[0] as number;

            expect(ordemGastar).toBeLessThan(ordemEscrever);
        });

        it('recusa um link que já não serve', async () => {
            repository.findUsableAccountToken.mockResolvedValue(null);

            await expectAuthError(
                service.resetPassword('segredo', 'password-nova-forte'),
                'INVALID_ACCOUNT_TOKEN',
            );

            expect(repository.updatePasswordHash).not.toHaveBeenCalled();
        });

        it('recusa quando outro pedido gastou o token primeiro', async () => {
            repository.consumeAccountToken.mockResolvedValue(false);

            await expectAuthError(
                service.resetPassword('segredo', 'password-nova-forte'),
                'INVALID_ACCOUNT_TOKEN',
            );

            expect(repository.updatePasswordHash).not.toHaveBeenCalled();
        });

        /**
         * Um token de confirmação de email não pode servir para trocar
         * uma password: são poderes diferentes, e a consulta filtra pelo
         * propósito.
         */
        it('só aceita um token pedido para isto', async () => {
            await service.resetPassword('segredo', 'password-nova-forte');

            expect(repository.findUsableAccountToken).toHaveBeenCalledWith(
                expect.any(String),
                'password_reset',
            );
        });

        it('procura o token pelo resumo, nunca pelo segredo', async () => {
            await service.resetPassword('segredo', 'password-nova-forte');

            const procurado = repository.findUsableAccountToken.mock
                .calls[0]?.[0] as string;

            expect(procurado).not.toBe('segredo');
            expect(procurado).toBe(new AccountTokenService().hashSecret('segredo'));
        });
    });

    describe('confirmar o email', () => {
        it('marca o email como confirmado', async () => {
            await service.verifyEmail('segredo');

            expect(repository.markEmailVerified).toHaveBeenCalledWith('user-1');
        });

        /**
         * Confirmar um endereço não abre a conta a ninguém, por isso não
         * derruba sessões nem mexe na password.
         */
        it('não mexe em sessões nem na password', async () => {
            await service.verifyEmail('segredo');

            expect(repository.incrementUserTokenVersion).not.toHaveBeenCalled();
            expect(repository.revokeAllUserSessions).not.toHaveBeenCalled();
            expect(repository.updatePasswordHash).not.toHaveBeenCalled();
        });

        it('só aceita um token pedido para isto', async () => {
            await service.verifyEmail('segredo');

            expect(repository.findUsableAccountToken).toHaveBeenCalledWith(
                expect.any(String),
                'email_verification',
            );
        });

        it('recusa um link que já não serve', async () => {
            repository.findUsableAccountToken.mockResolvedValue(null);

            await expectAuthError(
                service.verifyEmail('segredo'),
                'INVALID_ACCOUNT_TOKEN',
            );

            expect(repository.markEmailVerified).not.toHaveBeenCalled();
        });

        it('recusa pedir confirmação de um email já confirmado', async () => {
            repository.findUserById.mockResolvedValue(
                utilizador({ email_verified_at: new Date() }),
            );

            await expectAuthError(
                service.requestEmailVerification('user-1'),
                'EMAIL_ALREADY_VERIFIED',
            );

            expect(mailer.send).not.toHaveBeenCalled();
        });

        it('recusa pedir confirmação para uma conta que não existe', async () => {
            repository.findUserById.mockResolvedValue(null);

            await expectAuthError(
                service.requestEmailVerification('inexistente'),
                'USER_NOT_FOUND',
            );
        });
    });
});
