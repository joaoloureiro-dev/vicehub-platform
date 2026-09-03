import crypto from 'node:crypto';

/**
 * Segredos enviados por email, e a forma como são guardados.
 *
 * O que segue no link é o segredo; o que fica na base de dados é o seu
 * resumo. Quem puser os olhos na tabela encontra tokens que não consegue
 * usar — a mesma razão por que as passwords não se guardam em claro.
 *
 * O resumo é SHA-256 e não argon2, ao contrário das passwords e dos
 * refresh tokens, e a diferença é deliberada. Uma função lenta existe
 * para tornar cara a adivinhação de segredos fracos; um segredo de 32
 * bytes aleatórios não tem nada que se adivinhe, por isso a lentidão não
 * compraria segurança nenhuma. Compraria, isso sim, uma leitura mais
 * complicada: com SHA-256 o token recebido é procurado por índice, numa
 * consulta só.
 */
export class AccountTokenService {
    /**
     * Gera o segredo que segue no email.
     *
     * base64url para caber num endereço sem ser reescrito pelo caminho.
     */
    generateSecret(): string {
        return crypto.randomBytes(32).toString('base64url');
    }

    /**
     * O resumo que fica gravado.
     */
    hashSecret(secret: string): string {
        return crypto.createHash('sha256').update(secret).digest('hex');
    }

    /**
     * Momento em que um token deixa de servir.
     */
    expiresAt(from: Date, ttlSeconds: number): Date {
        return new Date(from.getTime() + ttlSeconds * 1000);
    }
}
