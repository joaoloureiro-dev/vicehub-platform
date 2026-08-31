import crypto from 'node:crypto';

import argon2 from 'argon2';

/**
 * Parâmetros Argon2id usados em toda a aplicação.
 *
 * Valores equilibrados para produção:
 * - aumentam o custo computacional;
 * - dificultam ataques brute force.
 */
const ARGON2_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
} as const;

/**
 * Serviço responsável pela segurança das passwords.
 *
 * Nunca guardamos passwords em texto simples.
 * Apenas armazenamos hashes Argon2id.
 */
export class PasswordService {
    /**
     * Cria um hash seguro da password.
     *
     * Argon2id é utilizado por ser recomendado
     * para armazenamento de credenciais.
     */
    async hash(password: string): Promise<string> {
        return argon2.hash(password, ARGON2_OPTIONS);
    }

    /**
     * Verifica se uma password corresponde ao hash guardado.
     */
    async verify(hash: string, password: string): Promise<boolean> {
        return argon2.verify(hash, password);
    }

    /**
     * Consome o mesmo custo computacional de uma verificação real.
     *
     * Quando o email não existe não há hash para comparar. Sem este
     * trabalho equivalente, a resposta seria visivelmente mais rápida
     * e permitiria descobrir que emails estão registados.
     */
    async simulateVerification(): Promise<void> {
        await argon2.hash(crypto.randomBytes(32).toString('hex'), ARGON2_OPTIONS);
    }
}
