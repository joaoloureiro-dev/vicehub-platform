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

/**
 * Utilizador autenticado, já validado contra a base de dados.
 *
 * Diferente do payload do JWT: este objeto só existe depois de
 * confirmarmos que o utilizador e a sessão continuam válidos.
 */
export interface AuthenticatedUser {
    id: string;
    email: string;
    username: string;
    tokenVersion: number;
}

/**
 * Contexto de autenticação associado ao pedido.
 *
 * É preenchido pelo middleware de autenticação e fica disponível
 * em request.authContext para os handlers protegidos.
 */
export interface AuthContext {
    user: AuthenticatedUser;
    sessionId: string;
}
