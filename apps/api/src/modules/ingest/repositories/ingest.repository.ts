import { SourceType, type DatabaseClient } from '@vicehub/database';

/**
 * Repositório da ingestão: chaves e o que os servidores reportam.
 */
export class IngestRepository {
    constructor(private readonly database: DatabaseClient) { }

    /**
     * A chave com este prefixo, se existir e ainda servir.
     *
     * A procura é pelo prefixo — que é único — e não pelo segredo: o
     * segredo não está aqui, está o resumo dele, e comparar resumos é
     * coisa que se faz depois de ter a linha.
     */
    findUsableByPrefix(prefix: string) {
        return this.database.serverApiKey.findFirst({
            where: {
                prefix,
                revoked_at: null,
                is_deleted: false,
                server: { is_deleted: false },
            },
            select: {
                id: true,
                key_hash: true,
                serverId: true,
            },
        });
    }

    /**
     * Regista que a chave foi usada agora.
     *
     * Serve para se poder revogar o que já ninguém usa sem medo de
     * partir o que está a trabalhar.
     */
    markUsed(apiKeyId: string) {
        return this.database.serverApiKey.update({
            where: { id: apiKeyId },
            data: { last_used_at: new Date() },
            select: { id: true },
        });
    }

    createKey(input: {
        serverId: string;
        label: string;
        prefix: string;
        keyHash: string;
        createdBy: string;
    }) {
        return this.database.serverApiKey.create({
            data: {
                serverId: input.serverId,
                label: input.label,
                prefix: input.prefix,
                key_hash: input.keyHash,
                created_by: input.createdBy,
                source: SourceType.api,
            },
            select: { id: true, prefix: true, label: true, created_at: true },
        });
    }

    /**
     * As chaves de um servidor — **sem** nada que sirva para as usar.
     */
    listKeys(serverId: string) {
        return this.database.serverApiKey.findMany({
            where: { serverId, is_deleted: false },
            orderBy: { created_at: 'desc' },
            select: {
                id: true,
                label: true,
                prefix: true,
                last_used_at: true,
                revoked_at: true,
                created_at: true,
            },
        });
    }

    countActiveKeys(serverId: string): Promise<number> {
        return this.database.serverApiKey.count({
            where: { serverId, revoked_at: null, is_deleted: false },
        });
    }

    findKeyOfServer(apiKeyId: string, serverId: string) {
        return this.database.serverApiKey.findFirst({
            where: { id: apiKeyId, serverId, is_deleted: false },
            select: { id: true, revoked_at: true },
        });
    }

    /**
     * Revogar não apaga: a linha fica, com a data.
     *
     * Quem for ver porque é que um script deixou de funcionar precisa de
     * encontrar a chave e a data em que deixou de servir — uma linha
     * apagada não responde a nada.
     */
    revokeKey(apiKeyId: string, revokedBy: string) {
        return this.database.serverApiKey.update({
            where: { id: apiKeyId },
            data: { revoked_at: new Date(), updated_by: revokedBy },
            select: { id: true },
        });
    }

    /**
     * Grava o que o servidor acabou de reportar.
     */
    recordHeartbeat(serverId: string, playersOnline: number) {
        return this.database.server.update({
            where: { id: serverId },
            data: {
                last_heartbeat_at: new Date(),
                players_online: playersOnline,
                /**
                 * A marca manual passa a acompanhar o que o servidor
                 * reporta. Deixá-la desligada enquanto o servidor bate à
                 * porta faria o perfil dizer uma coisa e o diretório
                 * outra, conforme quem lê.
                 */
                isOnline: true,
            },
            select: { id: true },
        });
    }

    findServerName(serverId: string) {
        return this.database.server.findFirst({
            where: { id: serverId, is_deleted: false },
            select: { id: true, name: true },
        });
    }
}
