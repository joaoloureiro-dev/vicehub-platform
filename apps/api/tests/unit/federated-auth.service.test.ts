import { AuthProviderType } from '@vicehub/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthError } from '../../src/modules/auth/errors/auth.errors.js';
import {
    FederatedAuthService,
    limparUsername,
} from '../../src/modules/auth/services/federated-auth.service.js';

const createRepositoryMock = () => ({
    findByProviderIdentity: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    linkProvider: vi.fn().mockResolvedValue({ id: 'link-1' }),
    usernameTaken: vi.fn().mockResolvedValue(false),
    createFederatedUser: vi.fn().mockResolvedValue({ id: 'user-novo' }),
    findDefaultRoleId: vi.fn().mockResolvedValue('role-player'),
});

interface Perfil {
    id: string;
    username: string;
    email: string | null;
    emailVerified: boolean;
}

const createClientMock = (perfil: Perfil) => ({
    buildAuthorizeUrl: vi.fn().mockReturnValue('https://fornecedor.test/authorize?x=1'),
    exchangeCode: vi.fn().mockResolvedValue('token-do-fornecedor'),
    fetchUser: vi.fn().mockResolvedValue(perfil),
});

const deFora: Perfil = {
    id: '4242',
    username: 'ViceGuy',
    email: 'vice@fornecedor.test',
    emailVerified: true,
};

const expectAuthError = async (
    promise: Promise<unknown>,
    code: string,
): Promise<void> => {
    await expect(promise).rejects.toBeInstanceOf(AuthError);
    await expect(promise).rejects.toMatchObject({ code });
};

describe('FederatedAuthService', () => {
    let repository: ReturnType<typeof createRepositoryMock>;

    const construir = (
        perfil = deFora,
        provider: AuthProviderType = AuthProviderType.discord,
    ) => {
        const client = createClientMock(perfil);

        return {
            client,
            service: new FederatedAuthService(
                repository as never,
                client as never,
                provider,
                'O fornecedor',
            ),
        };
    };

    beforeEach(() => {
        repository = createRepositoryMock();
    });

    /**
     * A decisão sobre a conta é a mesma para todos os fornecedores, mas
     * **com que valor a identidade fica gravada** não é: uma identidade
     * de Google guardada como `discord` faria a entrada seguinte pela
     * Google não encontrar nada e abrir uma segunda conta com o mesmo
     * email — que é o conflito que a base de dados recusa.
     *
     * Por isso as três respostas correm contra os dois fornecedores.
     */
    describe.each([AuthProviderType.discord, AuthProviderType.google])(
        'a que conta pertence esta identidade (%s)',
        (provider) => {
            it('entra na conta já ligada, sem criar nada', async () => {
                repository.findByProviderIdentity.mockResolvedValue({
                    user: { id: 'user-1' },
                });

                const { service } = construir(deFora, provider);

                expect(await service.resolveAccount('code')).toEqual({
                    userId: 'user-1',
                    criada: false,
                });
                expect(repository.findByProviderIdentity).toHaveBeenCalledWith(
                    provider,
                    '4242',
                );
                expect(repository.createFederatedUser).not.toHaveBeenCalled();
                expect(repository.linkProvider).not.toHaveBeenCalled();
            });

            it('cria conta quando não há identidade nem email conhecido', async () => {
                const { service } = construir(deFora, provider);

                expect(await service.resolveAccount('code')).toEqual({
                    userId: 'user-novo',
                    criada: true,
                });
                expect(repository.createFederatedUser).toHaveBeenCalledWith(
                    expect.objectContaining({
                        email: 'vice@fornecedor.test',
                        provider,
                        providerUserId: '4242',
                        emailVerified: true,
                    }),
                );
            });

            it('liga-se à conta que já usa esse email, em vez de abrir uma segunda', async () => {
                repository.findByEmail.mockResolvedValue({ id: 'user-antigo' });

                const { service } = construir(deFora, provider);

                expect(await service.resolveAccount('code')).toEqual({
                    userId: 'user-antigo',
                    criada: false,
                });
                expect(repository.linkProvider).toHaveBeenCalledWith({
                    userId: 'user-antigo',
                    provider,
                    providerUserId: '4242',
                    providerEmail: 'vice@fornecedor.test',
                });
                expect(repository.createFederatedUser).not.toHaveBeenCalled();
            });
        },
    );

    describe('o email tem de estar confirmado', () => {
        /**
         * **O buraco que esta regra tapa.** O Discord deixa mudar de
         * email sem confirmar, e há contas de Google de domínio próprio
         * onde o endereço nunca foi confirmado. Sem exigir a
         * confirmação, qualquer pessoa punha lá o email de outra e
         * entrava na conta dela aqui, com um clique e sem password
         * nenhuma.
         */
        it('recusa ligar-se a uma conta quando o email não está confirmado', async () => {
            repository.findByEmail.mockResolvedValue({ id: 'user-antigo' });

            const { service } = construir({ ...deFora, emailVerified: false });

            await expectAuthError(
                service.resolveAccount('code'),
                'FEDERATED_EMAIL_UNUSABLE',
            );

            expect(repository.linkProvider).not.toHaveBeenCalled();
            expect(repository.createFederatedUser).not.toHaveBeenCalled();
        });

        /**
         * Sem email não se cria conta: ficaria uma conta sem forma
         * nenhuma de recuperação no dia em que o fornecedor se perdesse.
         */
        it('recusa criar conta sem email', async () => {
            const { service } = construir({ ...deFora, email: null });

            await expectAuthError(
                service.resolveAccount('code'),
                'FEDERATED_EMAIL_UNUSABLE',
            );
        });

        /**
         * Quem já se ligou uma vez entra pela identidade, e aí o email
         * deixa de ser a pergunta — nem sequer se lhe olha.
         */
        it('uma identidade já ligada entra mesmo com o email por confirmar', async () => {
            repository.findByProviderIdentity.mockResolvedValue({
                user: { id: 'user-1' },
            });

            const { service } = construir({ ...deFora, emailVerified: false });

            expect(await service.resolveAccount('code')).toEqual({
                userId: 'user-1',
                criada: false,
            });
        });

        it('normaliza o email antes de procurar a conta', async () => {
            const { service } = construir({
                ...deFora,
                email: 'VICE@Fornecedor.TEST',
            });

            await service.resolveAccount('code');

            expect(repository.findByEmail).toHaveBeenCalledWith(
                'vice@fornecedor.test',
            );
        });
    });

    describe('o state', () => {
        /**
         * Sem isto, bastava mandar-te o endereço de regresso com o
         * código de outra pessoa para te deixar a usar a plataforma na
         * conta dela sem dares por nada.
         */
        it('recusa um regresso cujo state não corresponde', () => {
            const { service } = construir();

            expect(() => service.assertState('a', 'b')).toThrow(AuthError);
        });

        it('recusa um regresso sem state', () => {
            const { service } = construir();

            expect(() => service.assertState(undefined, 'b')).toThrow(AuthError);
            expect(() => service.assertState('a', undefined)).toThrow(AuthError);
        });

        it('aceita quando corresponde', () => {
            const { service } = construir();

            expect(() => service.assertState('igual', 'igual')).not.toThrow();
        });

        it('gera um state diferente de cada vez', () => {
            const { service } = construir();

            expect(service.generateState()).not.toBe(service.generateState());
        });
    });

    describe('o nome de utilizador', () => {
        it('usa o que veio de fora quando está livre', async () => {
            const { service } = construir();

            await service.resolveAccount('code');

            expect(repository.createFederatedUser).toHaveBeenCalledWith(
                expect.objectContaining({ username: 'viceguy' }),
            );
        });

        /**
         * O nome de fora repete-se e o nosso é único. Sem procurar um
         * livre, a segunda pessoa com o mesmo nome não conseguia entrar
         * — e o erro que via era um conflito de base de dados.
         */
        it('procura um livre quando o primeiro está ocupado', async () => {
            repository.usernameTaken
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false);

            const { service } = construir();

            await service.resolveAccount('code');

            expect(repository.createFederatedUser).toHaveBeenCalledWith(
                expect.objectContaining({ username: 'viceguy2' }),
            );
        });

        it('desiste do sufixo e vai a aleatório quando nada está livre', async () => {
            repository.usernameTaken.mockResolvedValue(true);

            const { service } = construir();

            await service.resolveAccount('code');

            const nome = (
                repository.createFederatedUser.mock.calls[0]?.[0] as {
                    username: string;
                }
            ).username;

            expect(nome.startsWith('viceguy')).toBe(true);
            expect(nome).not.toBe('viceguy');
        });
    });

    describe('limparUsername', () => {
        it('baixa a caixa e deixa cair o que não é aceite', () => {
            expect(limparUsername('Vice.Guy-99')).toBe('viceguy99');
        });

        it('mantém o underscore, que é aceite', () => {
            expect(limparUsername('vice_guy')).toBe('vice_guy');
        });

        it('corta nomes demasiado longos', () => {
            expect(limparUsername('a'.repeat(40))).toHaveLength(20);
        });

        /**
         * Quem se chama "★" no Discord não tem culpa nenhuma, e recusar
         * a entrada por causa disso seria um não sem explicação possível.
         */
        it('dá um nome inventado a quem fica sem nada', () => {
            const nome = limparUsername('★★★');

            expect(nome.startsWith('vice')).toBe(true);
            expect(nome.length).toBeGreaterThanOrEqual(3);
        });

        it('dá um nome inventado a quem fica com menos de três letras', () => {
            expect(limparUsername('ab').startsWith('vice')).toBe(true);
        });
    });
});
