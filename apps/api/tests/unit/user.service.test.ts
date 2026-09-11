import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserError } from '../../src/modules/users/errors/user.errors.js';
import { UserService } from '../../src/modules/users/services/user.service.js';
import type { PasswordService } from '../../src/modules/auth/services/password.service.js';
import type { SubscriptionService } from '../../src/modules/subscriptions/services/subscription.service.js';
import type { UserRepository } from '../../src/modules/users/repositories/user.repository.js';
import { NIVEL_MAXIMO } from '@vicehub/database';

const userRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'player@vicehub.com',
    username: 'player',
    avatarUrl: null,
    bio: null,
    banner_url: null,
    accent_color: null,
    level: 7,
    xp: 9_007_199_254_740_993n,
    reputation: 42,
    email_verified_at: null,
    last_login_at: new Date('2026-08-01T00:00:00.000Z'),
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
});

describe('UserService', () => {
    let repository: {
        findByUsername: ReturnType<typeof vi.fn>;
        findById: ReturnType<typeof vi.fn>;
        updateProfile: ReturnType<typeof vi.fn>;
        updateAppearance: ReturnType<typeof vi.fn>;
        listAchievements: ReturnType<typeof vi.fn>;
        findCredential: ReturnType<typeof vi.fn>;
        findAccountDeletionBlockers: ReturnType<typeof vi.fn>;
        eraseAccount: ReturnType<typeof vi.fn>;
    };
    let subscriptions: { getEntitlement: ReturnType<typeof vi.fn> };
    let passwords: { verify: ReturnType<typeof vi.fn> };
    let service: UserService;

    /** Nada preso atrás: a conta pode sair. */
    const SEM_IMPEDIMENTOS = {
        funds: 0n,
        orphanedCommunities: [],
        hasActivePaidPlan: false,
    };

    const premiumUntil = new Date('2026-12-31T00:00:00.000Z');

    beforeEach(() => {
        repository = {
            findByUsername: vi.fn().mockResolvedValue(userRow()),
            findById: vi.fn().mockResolvedValue(userRow()),
            updateProfile: vi.fn().mockResolvedValue(undefined),
            updateAppearance: vi.fn().mockResolvedValue(undefined),
            listAchievements: vi.fn().mockResolvedValue([]),
            findCredential: vi
                .fn()
                .mockResolvedValue({ password_hash: 'hash-argon2' }),
            findAccountDeletionBlockers: vi
                .fn()
                .mockResolvedValue(SEM_IMPEDIMENTOS),
            eraseAccount: vi.fn().mockResolvedValue(undefined),
        };
        subscriptions = {
            getEntitlement: vi
                .fn()
                .mockResolvedValue({ isPremium: false, activeUntil: null }),
        };
        passwords = { verify: vi.fn().mockResolvedValue(true) };

        service = new UserService(
            repository as unknown as UserRepository,
            subscriptions as unknown as SubscriptionService,
            passwords as unknown as PasswordService,
        );
    });

    /**
     * Apagar a conta.
     *
     * Duas garantias, e as duas existem por razões diferentes: **não se
     * apaga por engano nem por sessão roubada**, e **não fica nada
     * preso atrás** — dinheiro sem dono, uma crew sem quem a possa
     * gerir, uma cobrança a sair de um cartão.
     */
    describe('apagar a própria conta', () => {
        const pedido = {
            userId: 'user-1',
            confirmation: 'player',
            password: 'Sup3rS3cret!Pass',
        };

        const esperarErro = async (promessa: Promise<unknown>, code: string) => {
            const erro = await promessa.catch((apanhado: unknown) => apanhado);

            expect(erro).toBeInstanceOf(UserError);
            expect((erro as UserError).code).toBe(code);
        };

        it('apaga quando a confirmação bate certo e nada fica preso', async () => {
            await service.deleteOwnAccount(pedido);

            expect(repository.eraseAccount).toHaveBeenCalledWith('user-1');
        });

        /**
         * **O que impede uma sessão roubada de apagar a conta.** Sem
         * isto, quem apanhasse um token tinha o nome de utilizador à
         * vista no perfil e mais nada a fazer.
         */
        it('recusa com a password errada', async () => {
            passwords.verify.mockResolvedValue(false);

            await esperarErro(
                service.deleteOwnAccount(pedido),
                'ACCOUNT_DELETION_NOT_CONFIRMED',
            );

            expect(repository.eraseAccount).not.toHaveBeenCalled();
        });

        it('recusa sem password nenhuma quando a conta tem uma', async () => {
            await esperarErro(
                service.deleteOwnAccount({
                    userId: 'user-1',
                    confirmation: 'player',
                }),
                'ACCOUNT_DELETION_NOT_CONFIRMED',
            );

            expect(passwords.verify).not.toHaveBeenCalled();
            expect(repository.eraseAccount).not.toHaveBeenCalled();
        });

        /** O nome escrito ao lado é um clique errado, e não uma decisão. */
        it('recusa quando o nome não corresponde', async () => {
            await esperarErro(
                service.deleteOwnAccount({ ...pedido, confirmation: 'outro' }),
                'ACCOUNT_DELETION_NOT_CONFIRMED',
            );

            expect(repository.eraseAccount).not.toHaveBeenCalled();
        });

        /**
         * Quem entra pelo Discord ou pela Google não tem password
         * nenhuma. Exigi-la a essas contas era fechar-lhes a saída para
         * sempre.
         */
        it('não exige password a quem não tem nenhuma', async () => {
            repository.findCredential.mockResolvedValue(null);

            await service.deleteOwnAccount({
                userId: 'user-1',
                confirmation: 'player',
            });

            expect(repository.eraseAccount).toHaveBeenCalledWith('user-1');
        });

        /**
         * E continua a exigir o nome: é a única defesa contra o clique
         * errado que essas contas têm.
         */
        it('exige o nome mesmo a quem não tem password', async () => {
            repository.findCredential.mockResolvedValue(null);

            await esperarErro(
                service.deleteOwnAccount({
                    userId: 'user-1',
                    confirmation: 'outro',
                }),
                'ACCOUNT_DELETION_NOT_CONFIRMED',
            );
        });

        /**
         * **A confirmação vem antes dos impedimentos.**
         *
         * A lista de comunidades onde alguém manda diz alguma coisa
         * sobre essa pessoa. Responder com ela a quem não provou ser ela
         * era contá-lo a quem apanhou a sessão.
         */
        it('não diz o que está preso a quem não confirmou', async () => {
            passwords.verify.mockResolvedValue(false);

            await esperarErro(
                service.deleteOwnAccount(pedido),
                'ACCOUNT_DELETION_NOT_CONFIRMED',
            );

            expect(
                repository.findAccountDeletionBlockers,
            ).not.toHaveBeenCalled();
        });

        it('recusa com saldo na carteira', async () => {
            repository.findAccountDeletionBlockers.mockResolvedValue({
                ...SEM_IMPEDIMENTOS,
                funds: 500n,
            });

            await esperarErro(
                service.deleteOwnAccount(pedido),
                'ACCOUNT_HAS_FUNDS',
            );

            expect(repository.eraseAccount).not.toHaveBeenCalled();
        });

        /**
         * Uma crew sem ninguém que a possa gerir deixa presas as
         * pessoas que lá estão. A mensagem nomeia-as: "tens comunidades"
         * sem dizer quais obrigava a procurá-las uma a uma.
         */
        it('recusa e nomeia as comunidades que ficariam sem dono', async () => {
            repository.findAccountDeletionBlockers.mockResolvedValue({
                ...SEM_IMPEDIMENTOS,
                orphanedCommunities: [
                    { kind: 'crew', id: 'c1', name: 'Vice Kings' },
                    { kind: 'server', id: 's1', name: 'Vice City RP' },
                ],
            });

            const erro = (await service
                .deleteOwnAccount(pedido)
                .catch((apanhado: unknown) => apanhado)) as UserError;

            expect(erro.code).toBe('ACCOUNT_LEADS_COMMUNITIES');
            expect(erro.message).toContain('Vice Kings');
            expect(erro.message).toContain('Vice City RP');
        });

        /**
         * Apagar a conta não cancela nada no Stripe: a cobrança
         * continuava a sair de um cartão cujo dono já não tem como a
         * parar aqui.
         */
        it('recusa com um plano pago em nome da conta', async () => {
            repository.findAccountDeletionBlockers.mockResolvedValue({
                ...SEM_IMPEDIMENTOS,
                hasActivePaidPlan: true,
            });

            await esperarErro(
                service.deleteOwnAccount(pedido),
                'ACCOUNT_HAS_ACTIVE_PLAN',
            );

            expect(repository.eraseAccount).not.toHaveBeenCalled();
        });

        it('recusa apagar uma conta que já não existe', async () => {
            repository.findById.mockResolvedValue(null);

            await esperarErro(
                service.deleteOwnAccount(pedido),
                'USER_NOT_FOUND',
            );
        });
    });

    describe('perfil público', () => {
        it('não revela o email', async () => {
            const profile = await service.getPublicProfile('player');

            expect(profile).not.toHaveProperty('email');
        });

        it('não revela o último início de sessão nem a validade do plano', async () => {
            subscriptions.getEntitlement.mockResolvedValue({
                isPremium: true,
                activeUntil: premiumUntil,
            });

            const profile = await service.getPublicProfile('player');

            /**
             * Dizer que alguém é premium é diferente de expor até quando
             * pagou, que é informação de faturação.
             */
            expect(profile).not.toHaveProperty('lastLoginAt');
            expect(profile).not.toHaveProperty('premiumUntil');
        });

        it('expõe exatamente os campos previstos', async () => {
            const profile = await service.getPublicProfile('player');

            expect(Object.keys(profile).sort()).toEqual([
                /*
                  As conquistas são públicas de propósito.

                  Não revelam nada que o perfil já não revelasse — saem
                  das mesmas presenças confirmadas que dão o xp, e o xp
                  já está aqui. O que acrescentam é crédito: um perfil
                  que diz "50 eventos" e não o consegue provar não vale
                  nada a quem está a decidir se aceita esta pessoa.
                */
                'achievements',
                'appearance',
                'avatarUrl',
                'bio',
                'createdAt',
                'id',
                'isPremium',
                'level',
                /*
                  O chão do nível atual e o teto do seguinte. São função
                  do xp, que já é público: dizem onde a barra começa e
                  acaba, e não revelam nada que o xp não revelasse.
                */
                'levelXp',
                'nextLevelXp',
                'reputation',
                'username',
                'xp',
            ]);
        });

        it('mostra o selo premium de quem tem plano', async () => {
            subscriptions.getEntitlement.mockResolvedValue({
                isPremium: true,
                activeUntil: premiumUntil,
            });

            await expect(service.getPublicProfile('player')).resolves.toMatchObject({
                isPremium: true,
            });
        });

        it('não mostra o selo a quem não tem', async () => {
            await expect(service.getPublicProfile('player')).resolves.toMatchObject({
                isPremium: false,
            });
        });

        it('avalia o plano do utilizador do perfil, não de outro', async () => {
            await service.getPublicProfile('player');

            expect(subscriptions.getEntitlement).toHaveBeenCalledWith({
                userId: 'user-1',
            });
        });

        it('devolve 404 de domínio quando não existe', async () => {
            repository.findByUsername.mockResolvedValue(null);

            const error = await service
                .getPublicProfile('inexistente')
                .catch((caught: unknown) => caught);

            expect(error).toBeInstanceOf(UserError);
            expect((error as UserError).code).toBe('USER_NOT_FOUND');
        });
    });

    describe('perfil do próprio', () => {
        it('inclui email, último início de sessão e validade do plano', async () => {
            subscriptions.getEntitlement.mockResolvedValue({
                isPremium: true,
                activeUntil: premiumUntil,
            });

            await expect(service.getPrivateProfile('user-1')).resolves.toMatchObject({
                email: 'player@vicehub.com',
                lastLoginAt: new Date('2026-08-01T00:00:00.000Z'),
                premiumUntil,
            });
        });

        it('mantém tudo o que o perfil público já mostrava', async () => {
            const profile = await service.getPrivateProfile('user-1');

            expect(profile).toMatchObject({ username: 'player' });
        });

        /**
         * O nível vem do xp, e não da coluna.
         *
         * A fixture tem 7 guardado e um xp de quem já está no topo — e o
         * que sai é o topo. Uma coluna que discorde do xp é uma coluna
         * errada, não uma segunda opinião: a coluna existe para o
         * diretório poder ordenar, e é escrita na mesma transação que
         * soma o xp.
         */
        it('lê o nível do xp e não da coluna guardada', async () => {
            const profile = await service.getPrivateProfile('user-1');

            expect(profile.level).toBe(NIVEL_MAXIMO);
            expect(profile.nextLevelXp).toBeNull();
        });
    });

    describe('alteração do perfil', () => {
        it('altera apenas os campos indicados', async () => {
            await service.updateProfile('user-1', { bio: 'nova bio' });

            expect(repository.updateProfile).toHaveBeenCalledWith('user-1', {
                bio: 'nova bio',
            });
        });

        it('recusa alterar um utilizador que não existe', async () => {
            repository.findById.mockResolvedValue(null);

            await expect(
                service.updateProfile('inexistente', { bio: 'x' }),
            ).rejects.toBeInstanceOf(UserError);

            expect(repository.updateProfile).not.toHaveBeenCalled();
        });

        it('devolve o perfil já atualizado', async () => {
            repository.findById
                .mockResolvedValueOnce(userRow())
                .mockResolvedValueOnce(userRow({ bio: 'nova bio' }));

            await expect(
                service.updateProfile('user-1', { bio: 'nova bio' }),
            ).resolves.toMatchObject({ bio: 'nova bio' });
        });
    });

    describe('personalização, que é funcionalidade do plano', () => {
        const personalizado = () =>
            userRow({
                banner_url: 'https://cdn.vicehub.gg/p.png',
                accent_color: '#1B9AAA',
            });

        it('mostra a personalização a quem tem plano ativo', async () => {
            repository.findByUsername.mockResolvedValue(personalizado());
            subscriptions.getEntitlement.mockResolvedValue({
                isPremium: true,
                activeUntil: new Date('2027-01-01T00:00:00.000Z'),
            });

            await expect(
                service.getPublicProfile('player'),
            ).resolves.toMatchObject({
                appearance: {
                    bannerUrl: 'https://cdn.vicehub.gg/p.png',
                    accentColor: '#1B9AAA',
                },
            });
        });

        /**
         * O contrário do que esta regra já foi.
         *
         * A personalização de uma pessoa era mostrada só com plano
         * ativo, e apagava-se do ecrã quando ele acabava. Deixou de ser:
         * a cara e o banner de quem joga não se vendem, e um perfil que
         * fica cinzento por alguém ter deixado de pagar castiga a pessoa
         * à frente de toda a gente. O que se vende é gerir uma
         * comunidade — a personalização de crews e servidores continua
         * atrás do plano.
         */
        it('mostra a personalização mesmo sem plano nenhum', async () => {
            repository.findByUsername.mockResolvedValue(personalizado());

            await expect(
                service.getPublicProfile('player'),
            ).resolves.toMatchObject({
                isPremium: false,
                appearance: {
                    bannerUrl: 'https://cdn.vicehub.gg/p.png',
                    accentColor: '#1B9AAA',
                },
            });
        });

        it('grava apenas os campos indicados', async () => {
            await service.updateAppearance('user-1', { accentColor: '#1B9AAA' });

            expect(repository.updateAppearance).toHaveBeenCalledWith('user-1', {
                accentColor: '#1B9AAA',
            });
        });

        it('recusa personalizar um utilizador que não existe', async () => {
            repository.findById.mockResolvedValue(null);

            await expect(
                service.updateAppearance('inexistente', { accentColor: '#1B9AAA' }),
            ).rejects.toBeInstanceOf(UserError);

            expect(repository.updateAppearance).not.toHaveBeenCalled();
        });

        /**
         * Alterar a personalização não toca na bio nem no avatar: são
         * rotas diferentes porque uma é paga e a outra não.
         */
        it('não mexe nos campos gratuitos do perfil', async () => {
            await service.updateAppearance('user-1', { bannerUrl: null });

            expect(repository.updateProfile).not.toHaveBeenCalled();
        });
    });
});
