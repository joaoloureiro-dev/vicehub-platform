import type { DatabaseClient } from '@vicehub/database';

import { buildAccountExport } from '../../../shared/account-export.js';
import { listAchievements } from '../../../shared/list-achievements.js';

import type { UpdateAppearanceDto } from '../../../shared/appearance.js';
import { toAppearanceColumns } from '../../../shared/appearance.js';

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
     * Tudo o que a plataforma tem sobre esta pessoa.
     *
     * A leitura vive no módulo partilhado e não aqui: o que interessa é
     * a **lista** do que entra e do que não entra, e essa lista tem de
     * se ler de uma vez. Espalhá-la por dez métodos era escondê-la.
     */
    exportAccount(userId: string) {
        return buildAccountExport(this.database, userId);
    }

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

    /**
     * Grava a personalização do perfil.
     *
     * Separada do resto do perfil porque a rota que lhe chega é outra:
     * alterar a bio não exige plano, alterar o banner exige.
     */
    updateAppearance(userId: string, input: UpdateAppearanceDto) {
        return this.database.user.update({
            where: {
                id: userId,
            },
            data: {
                ...toAppearanceColumns(input),
                version: {
                    increment: 1,
                },
            },
        });
    }
    /**
     * As conquistas desta pessoa, para o perfil.
     *
     * Delega na função partilhada, como o histórico de xp: a pergunta é
     * a mesma para pessoas e para crews, e duas cópias acabariam a
     * mostrar coisas diferentes nos dois perfis.
     */
    listAchievements(userId: string) {
        return listAchievements(this.database, { userId });
    }

}
