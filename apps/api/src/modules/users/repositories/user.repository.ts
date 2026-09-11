import type { DatabaseClient } from '@vicehub/database';

import {
    eraseAccount,
    findAccountDeletionBlockers,
} from '../../../shared/account-erasure.js';
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
     * O que impede esta conta de ser apagada.
     *
     * A leitura vive no módulo partilhado e não aqui: é a mesma
     * pergunta feita a três tabelas ao mesmo tempo, e o que interessa é
     * ficar ao lado da eliminação que ela protege.
     */
    findAccountDeletionBlockers(userId: string) {
        return findAccountDeletionBlockers(this.database, userId);
    }

    /**
     * Apaga a conta: leva o que é da pessoa, deixa o que é das
     * comunidades.
     */
    eraseAccount(userId: string) {
        return eraseAccount(this.database, userId);
    }

    /**
     * A credencial de quem tem password.
     *
     * `null` para quem entra só pelo Discord ou pela Google, que é a
     * resposta certa e não um erro: essas contas não têm password
     * nenhuma.
     */
    findCredential(userId: string) {
        return this.database.userCredential.findFirst({
            where: { userId, is_deleted: false },
            select: { password_hash: true },
        });
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
