import { AuthError } from '../errors/auth.errors.js';
import type { AuthRepository } from '../repositories/auth.repository.js';
import type {
    AccessTokenPayload,
    AuthContext,
} from '../types/auth.types.js';

/**
 * Serviço que transforma um access token válido
 * num contexto de autenticação confiável.
 *
 * Um JWT com assinatura válida não é suficiente.
 * Antes de aceitar o pedido confirmamos que:
 *
 * - a sessão continua ativa e não expirou;
 * - a sessão pertence ao utilizador indicado no token;
 * - o utilizador continua a existir e não foi eliminado;
 * - a tokenVersion do token corresponde à do utilizador.
 *
 * É esta última verificação que faz o logout global ter efeito
 * imediato sobre access tokens já emitidos.
 */
export class AuthContextService {
    constructor(private readonly authRepository: AuthRepository) { }

    async resolve(payload: AccessTokenPayload): Promise<AuthContext> {
        const user = await this.authRepository.findUserOfActiveSession(
            payload.sessionId,
        );

        if (!user) {
            throw new AuthError(
                'INVALID_ACCESS_TOKEN',
                'A sessão associada a este token já não está ativa.',
            );
        }

        /**
         * Impede que um token emitido para outro utilizador
         * seja aceite com um sessionId que não lhe pertence.
         *
         * Quem vem da base é o dono da sessão que o token nomeia. Se
         * não é quem o token diz ser, o token não é desta sessão.
         */
        if (user.id !== payload.sub) {
            throw new AuthError(
                'INVALID_ACCESS_TOKEN',
                'O token não corresponde à sessão indicada.',
            );
        }

        if (user.is_deleted) {
            throw new AuthError(
                'INVALID_ACCESS_TOKEN',
                'O utilizador associado a este token já não está disponível.',
            );
        }

        /**
         * Após logout global, token_version é incrementado.
         * Todos os access tokens anteriores deixam de corresponder.
         */
        if (user.token_version !== payload.tokenVersion) {
            throw new AuthError(
                'INVALID_ACCESS_TOKEN',
                'Este token foi invalidado. Inicia sessão novamente.',
            );
        }

        return {
            /*
             * O da sessão que se procurou, que é a que a base
             * confirmou estar viva — não há aqui outra.
             */
            sessionId: payload.sessionId,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                tokenVersion: user.token_version,
            },
        };
    }
}
