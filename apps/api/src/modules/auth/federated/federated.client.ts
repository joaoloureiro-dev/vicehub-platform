import { AuthError } from '../errors/auth.errors.js';

/**
 * Quanto tempo se espera pelo fornecedor antes de desistir.
 *
 * Sem limite, um fornecedor lento prendia um pedido nosso até o browser
 * desistir, e quem entrasse não ficava a saber porquê.
 */
const ESPERA_MS = 10_000;

/**
 * O que qualquer fornecedor nos tem de dizer sobre quem está a entrar.
 *
 * É de propósito o mínimo: um identificador estável lá deles, um nome
 * de onde partir para o nosso, e o endereço com a indicação de estar
 * confirmado. Nada disto tem de ser guardado para além da conta.
 */
export interface FederatedProfile {
    /** O identificador lá deles. Estável, e é por ele que se reencontra a conta. */
    id: string;
    /** O nome de lá, apenas como ponto de partida para o nosso. */
    username: string;
    email: string | null;
    /**
     * Se o fornecedor confirmou o endereço.
     *
     * É disto que depende ligar esta identidade a uma conta que já
     * existe aqui, e é por isso que nenhum fornecedor entra sem o dizer.
     */
    emailVerified: boolean;
}

/**
 * Falar com um fornecedor de entrada.
 *
 * Separado do serviço para que a decisão — quem entra, quem se liga a
 * que conta — seja testável sem rede, e para que o que cada
 * implementação faça seja apenas HTTP. A decisão é a mesma para todos;
 * o que muda de fornecedor para fornecedor é só o formato dos pedidos.
 */
export interface FederatedClient {
    /** O endereço para onde se manda quem carrega em "entrar com …". */
    buildAuthorizeUrl(state: string): string;
    /** Troca o código de uso único por um token de acesso. */
    exchangeCode(code: string): Promise<string>;
    /** Quem é o dono deste token. */
    fetchUser(accessToken: string): Promise<FederatedProfile>;
}

/**
 * Um pedido ao fornecedor, com prazo e sem deixar escapar erros de rede.
 *
 * Um `fetch` que rebenta lança um erro genérico que subiria como 500 —
 * e não é avaria nossa que o Discord esteja em baixo. Aqui traduz-se
 * para um erro do domínio, que o tratador já sabe mapear para 502.
 */
export const pedirAoFornecedor = async (
    fornecedor: string,
    url: string,
    init: RequestInit,
): Promise<Response> => {
    try {
        return await fetch(url, {
            ...init,
            signal: AbortSignal.timeout(ESPERA_MS),
        });
    } catch {
        throw new AuthError(
            'FEDERATED_UNAVAILABLE',
            `Não foi possível falar com ${fornecedor}.`,
        );
    }
};
