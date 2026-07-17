/**
 * Dados guardados dentro do JWT.
 *
 * Não colocamos informação sensível.
 * Apenas identificadores necessários
 * para autenticação e autorização.
 */
export interface AccessTokenPayload {
    sub: string;
    sessionId: string;
    tokenVersion: number;
}