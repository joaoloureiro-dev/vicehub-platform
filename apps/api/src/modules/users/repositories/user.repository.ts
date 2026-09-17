import type { DatabaseClient } from '@vicehub/database';

import {
    eraseAccount,
    findAccountDeletionBlockers,
} from '../../../shared/account-erasure.js';
import { buildAccountExport } from '../../../shared/account-export.js';
import { buildPendingForUser } from '../../../shared/pending-for-user.js';
import { listAchievements } from '../../../shared/list-achievements.js';
import { listReputationAwards } from '../../../shared/reputation-awards.js';

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
     * O que está à espera desta pessoa, em toda a plataforma.
     */
    pendingFor(userId: string) {
        return buildPendingForUser(this.database, userId);
    }

    /**
     * Fica a saber que esta pessoa já viu as respostas às candidaturas.
     *
     * A data é a de agora e não a da resposta mais recente: o que se
     * regista é **quando se olhou**. Com a data da resposta, uma que
     * chegasse entre a leitura da página e esta gravação ficava marcada
     * como vista sem ninguém a ter visto.
     */
    markAnswersSeen(userId: string, agora: Date = new Date()) {
        return this.database.user.updateMany({
            where: { id: userId, is_deleted: false },
            data: { answers_seen_at: agora },
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

    /**
     * De onde veio a reputação desta pessoa.
     *
     * Delega na função partilhada, pela mesma razão das conquistas.
     */
    listReputationAwards(userId: string, take = 20) {
        return listReputationAwards(this.database, userId, take);
    }

}
