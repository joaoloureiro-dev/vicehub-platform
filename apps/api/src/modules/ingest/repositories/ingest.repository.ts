import {
    RECALCULAR_MEDIA_SQL,
    SourceType,
    inicioDaHora,
    inicioDaMedia,
    type DatabaseClient,
} from '@vicehub/database';

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
     * Grava o que o servidor acabou de reportar — o agora e o passado.
     *
     * Na mesma transação de propósito. O presente sobrescreve-se e o
     * passado acumula-se, e são a mesma batida: gravar um sem o outro
     * deixava o gráfico a divergir do número que o perfil mostra, e a
     * divergência seria pior do que qualquer dos dois estar errado.
     */
    recordHeartbeat(serverId: string, playersOnline: number) {
        const agora = new Date();

        return this.database.$transaction(async (tx) => {
            const servidor = await tx.server.update({
                where: { id: serverId },
                data: {
                    last_heartbeat_at: agora,
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

            const hora = inicioDaHora(agora);

            /**
             * Uma instrução só, e em SQL — a única da plataforma.
             *
             * O balde soma o que lá estava com o que acabou de chegar, e
             * isso não se escreve com uma leitura seguida de uma
             * escrita: entre as duas cabe outra batida, e o `upsert` do
             * Prisma obrigaria a ler o pico antes para o poder comparar.
             * Lido antes, duas batidas simultâneas deixam o pico na
             * menor das duas.
             *
             * `GREATEST` decide-o dentro da própria escrita, com o
             * índice único a arbitrar quem chegou primeiro. É exacto,
             * cabe numa instrução, e é a razão de aqui se sair do Prisma.
             */
            await tx.$executeRaw`
                INSERT INTO "ServerActivityHour" (
                    "id", "serverId", "hour",
                    "samples", "players_sum", "players_max", "players_last",
                    "created_at", "updated_at"
                )
                VALUES (
                    gen_random_uuid(), ${serverId}, ${hora},
                    1, ${playersOnline}, ${playersOnline}, ${playersOnline},
                    ${agora}, ${agora}
                )
                ON CONFLICT ("serverId", "hour") DO UPDATE SET
                    "samples" = "ServerActivityHour"."samples" + 1,
                    "players_sum" = "ServerActivityHour"."players_sum"
                        + EXCLUDED."players_sum",
                    "players_max" = GREATEST(
                        "ServerActivityHour"."players_max",
                        EXCLUDED."players_max"
                    ),
                    "players_last" = EXCLUDED."players_last",
                    "updated_at" = EXCLUDED."updated_at"
            `;

            /**
             * E a média de sete dias, que é por onde o diretório
             * ordena.
             *
             * Aqui e não só na limpeza: um servidor novo que acabou de
             * reportar tem de aparecer ordenado já, e não daqui a uma
             * hora. É uma agregação sobre as horas deste servidor
             * dentro da janela — no máximo cento e sessenta e oito
             * linhas, por um índice.
             *
             * Ainda assim **não chega sozinha**: um servidor que deixe
             * de reportar deixa de passar por aqui, e ficaria para
             * sempre com a média do dia em que morreu. É a limpeza que
             * o faz descer.
             */
            await tx.$executeRawUnsafe(
                RECALCULAR_MEDIA_SQL,
                inicioDaMedia(agora),
                serverId,
            );

            return servidor;
        });
    }

    findServerName(serverId: string) {
        return this.database.server.findFirst({
            where: { id: serverId, is_deleted: false },
            select: { id: true, name: true },
        });
    }
}
