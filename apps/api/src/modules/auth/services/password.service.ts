import argon2 from 'argon2';

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
    return argon2.hash(password, {
      type: argon2.argon2id,

      /**
       * Valores equilibrados para produção:
       * - aumenta custo computacional;
       * - dificulta ataques brute force.
       */
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  /**
   * Verifica se uma password corresponde ao hash guardado.
   */
  async verify(
    hash: string,
    password: string,
  ): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}