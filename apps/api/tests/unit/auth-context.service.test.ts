import { beforeEach, describe, expect, it } from 'vitest';

import { AuthError } from '../../src/modules/auth/errors/auth.errors.js';
import { AuthContextService } from '../../src/modules/auth/services/auth-context.service.js';
import type { AccessTokenPayload } from '../../src/modules/auth/types/auth.types.js';
import {
    asAuthRepository,
    buildSessionWithUser,
    buildUserRow,
    createAuthRepositoryMock,
    type AuthRepositoryMock,
} from '../helpers/auth.fixtures.js';

/**
 * Estas asserções são o coração da autenticação.
 *
 * Um JWT com assinatura válida não chega: é aqui que confirmamos que a
 * sessão continua viva na base de dados e que o token não foi
 * invalidado por um logout global.
 */
describe('AuthContextService', () => {
    let repository: AuthRepositoryMock;
    let service: AuthContextService;

    const payload: AccessTokenPayload = {
        sub: 'user-1',
        sessionId: 'session-1',
        tokenVersion: 1,
    };

    beforeEach(() => {
        repository = createAuthRepositoryMock();
        service = new AuthContextService(asAuthRepository(repository));
    });

    const expectRejection = async () => {
        const error = await service.resolve(payload).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe('INVALID_ACCESS_TOKEN');
    };

    it('devolve o contexto quando a sessão e o utilizador são válidos', async () => {
        repository.findActiveSessionWithUser.mockResolvedValue(buildSessionWithUser());

        await expect(service.resolve(payload)).resolves.toEqual({
            sessionId: 'session-1',
            user: {
                id: 'user-1',
                email: 'player@vicehub.com',
                username: 'player',
                tokenVersion: 1,
            },
        });
    });

    it('rejeita quando a sessão já não está ativa', async () => {
        repository.findActiveSessionWithUser.mockResolvedValue(null);

        await expectRejection();
    });

    it('rejeita quando a sessão pertence a outro utilizador', async () => {
        repository.findActiveSessionWithUser.mockResolvedValue({
            ...buildSessionWithUser(),
            userId: 'outro-utilizador',
        });

        await expectRejection();
    });

    it('rejeita quando o utilizador foi eliminado', async () => {
        repository.findActiveSessionWithUser.mockResolvedValue(
            buildSessionWithUser({ user: buildUserRow({ is_deleted: true }) }),
        );

        await expectRejection();
    });

    it('rejeita quando a tokenVersion do token já não corresponde', async () => {
        repository.findActiveSessionWithUser.mockResolvedValue(
            buildSessionWithUser({ user: buildUserRow({ token_version: 2 }) }),
        );

        await expectRejection();
    });
});
