import type { DatabaseClient } from '@vicehub/database';

interface UpdateProfileInput {
    avatarUrl?: string | null | undefined;
    bio?: string | null | undefined;
}

/**
 * Repositório do módulo de utilizadores.
 */
export class UserRepository {
    constructor(private readonly database: DatabaseClient) { }

    /**
     * Procura um utilizador pelo username.
     *
     * Contas eliminadas por soft delete não são encontradas: para quem
     * consulta, deixaram de existir.
     */
    findByUsername(username: string) {
        return this.database.user.findFirst({
            where: {
                username,
                is_deleted: false,
            },
        });
    }

    findById(userId: string) {
        return this.database.user.findFirst({
            where: {
                id: userId,
                is_deleted: false,
            },
        });
    }

    /**
     * Atualiza os campos de apresentação do perfil.
     *
     * Não toca em email, username nem em qualquer campo de identidade.
     */
    updateProfile(userId: string, input: UpdateProfileInput) {
        /**
         * Uma propriedade ausente é diferente de uma propriedade presente
         * com valor undefined. Omitir a chave garante que não indicar o
         * campo o deixa como está, enquanto indicá-lo a null o limpa.
         */
        const data: {
            version: { increment: number };
            avatarUrl?: string | null;
            bio?: string | null;
        } = {
            version: {
                increment: 1,
            },
        };

        if (input.avatarUrl !== undefined) {
            data.avatarUrl = input.avatarUrl;
        }

        if (input.bio !== undefined) {
            data.bio = input.bio;
        }

        return this.database.user.update({
            where: {
                id: userId,
            },
            data,
        });
    }
}
