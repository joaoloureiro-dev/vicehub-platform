import type { DatabaseClient } from '@vicehub/database';

/**
 * Do nome de utilizador para o identificador.
 *
 * Existe porque o perfil público vive num endereço com o nome, e as
 * avaliações de alguém pendem desse perfil. Uma leitura só, e num sítio
 * só: espalhá-la pelos serviços era ter cada um a decidir por sua conta
 * se uma conta apagada ainda conta.
 */
export class UserLookup {
    constructor(private readonly database: DatabaseClient) { }

    findByUsername(username: string) {
        return this.database.user.findFirst({
            where: { username, is_deleted: false },
            select: { id: true, username: true },
        });
    }
}
