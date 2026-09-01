import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserError } from '../../src/modules/users/errors/user.errors.js';
import { UserService } from '../../src/modules/users/services/user.service.js';
import type { SubscriptionService } from '../../src/modules/subscriptions/services/subscription.service.js';
import type { UserRepository } from '../../src/modules/users/repositories/user.repository.js';

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
    };
    let subscriptions: { getEntitlement: ReturnType<typeof vi.fn> };
    let service: UserService;

    const premiumUntil = new Date('2026-12-31T00:00:00.000Z');

    beforeEach(() => {
        repository = {
            findByUsername: vi.fn().mockResolvedValue(userRow()),
            findById: vi.fn().mockResolvedValue(userRow()),
            updateProfile: vi.fn().mockResolvedValue(undefined),
            updateAppearance: vi.fn().mockResolvedValue(undefined),
        };
        subscriptions = {
            getEntitlement: vi
                .fn()
                .mockResolvedValue({ isPremium: false, activeUntil: null }),
        };
        service = new UserService(
            repository as unknown as UserRepository,
            subscriptions as unknown as SubscriptionService,
        );
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
                'appearance',
                'avatarUrl',
                'bio',
                'createdAt',
                'id',
                'isPremium',
                'level',
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

            expect(profile).toMatchObject({ username: 'player', level: 7 });
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
         * Sem isto, bastava pagar um mês para ficar com a personalização
         * para sempre.
         */
        it('esconde a personalização quando o plano termina', async () => {
            repository.findByUsername.mockResolvedValue(personalizado());

            await expect(
                service.getPublicProfile('player'),
            ).resolves.toMatchObject({
                appearance: { bannerUrl: null, accentColor: null },
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
