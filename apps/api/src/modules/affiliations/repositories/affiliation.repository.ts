import { MembershipStatus, type DatabaseClient } from '@vicehub/database';

import { getUniqueConstraintFields } from '../../../shared/prisma-errors.js';

/**
 * Os estados em que uma filiação ainda ocupa lugar.
 *
 * Um pedido recusado e uma saída são história: não impedem um pedido
 * novo, e é por isso que os índices únicos da tabela são parciais sobre
 * exatamente estes dois estados.
 */
const ABERTOS = [MembershipStatus.pending, MembershipStatus.active] as const;

/**
 * Repositório das filiações entre crews e servidores.
 */
export class AffiliationRepository {
    constructor(private readonly database: DatabaseClient) { }

    /**
     * A filiação ativa de uma crew, com o nome do servidor.
     */
    findActiveOfCrew(crewId: string) {
        return this.database.affiliation.findFirst({
            where: {
                crewId,
                status: MembershipStatus.active,
                is_deleted: false,
            },
            select: {
                id: true,
                serverId: true,
                server: { select: { name: true } },
            },
        });
    }

    /**
     * O pedido por responder de uma crew, se existir.
     */
    findPendingOfCrew(crewId: string) {
        return this.database.affiliation.findFirst({
            where: {
                crewId,
                status: MembershipStatus.pending,
                is_deleted: false,
            },
            select: {
                id: true,
                serverId: true,
                server: { select: { name: true } },
            },
        });
    }

    /**
     * A filiação aberta entre esta crew e este servidor, se existir.
     */
    findOpenPair(crewId: string, serverId: string) {
        return this.database.affiliation.findFirst({
            where: {
                crewId,
                serverId,
                status: { in: [...ABERTOS] },
                is_deleted: false,
            },
            select: { id: true, status: true },
        });
    }

    findPendingPair(crewId: string, serverId: string) {
        return this.database.affiliation.findFirst({
            where: {
                crewId,
                serverId,
                status: MembershipStatus.pending,
                is_deleted: false,
            },
            select: { id: true },
        });
    }

    request(crewId: string, serverId: string, requestedBy: string) {
        return this.database.affiliation.create({
            data: {
                crewId,
                serverId,
                status: MembershipStatus.pending,
                requested_by: requestedBy,
                created_by: requestedBy,
            },
            select: { id: true },
        });
    }

    /**
     * Responde a um pedido, ou termina uma filiação.
     *
     * O estado novo diz o que aconteceu — aceite, recusado, ou terminado
     * —, e quem respondeu fica gravado para que uma crew posta fora
     * consiga distinguir isso de ter saído.
     */
    setStatus(
        affiliationId: string,
        status: MembershipStatus,
        respondedBy: string,
    ) {
        return this.database.affiliation.update({
            where: { id: affiliationId },
            data: {
                status,
                responded_at: new Date(),
                responded_by: respondedBy,
                updated_by: respondedBy,
            },
            select: { id: true },
        });
    }

    /**
     * Passa uma filiação a ativa, se a crew não estiver já filiada.
     *
     * Devolve false quando o índice único parcial recusa a escrita, que
     * é o que acontece quando dois servidores aceitam a mesma crew ao
     * mesmo tempo: as duas verificações em memória leram "esta crew não
     * joga em lado nenhum" antes de qualquer das duas escrever, e só a
     * base de dados pode decidir quem chega primeiro. Sem isto a segunda
     * saía como 500 — uma avaria, quando o que houve foi uma recusa.
     */
    async activate(affiliationId: string, respondedBy: string): Promise<boolean> {
        try {
            await this.setStatus(
                affiliationId,
                MembershipStatus.active,
                respondedBy,
            );

            return true;
        } catch (erro) {
            if (getUniqueConstraintFields(erro) === null) {
                throw erro;
            }

            return false;
        }
    }

    /**
     * Quantas crews jogam neste servidor agora.
     *
     * Só as ativas: um pedido por responder ainda não ocupa lugar, e
     * contá-lo faria a caixa de entrada encher o próprio limite —
     * bastava a alguém candidatar-se para o servidor deixar de poder
     * aceitar seja quem for.
     */
    countActiveOfServer(serverId: string): Promise<number> {
        return this.database.affiliation.count({
            where: {
                serverId,
                status: MembershipStatus.active,
                is_deleted: false,
            },
        });
    }

    /**
     * As crews de um servidor, filtradas por estado.
     */
    async listOfServer(serverId: string, status: MembershipStatus) {
        const linhas = await this.database.affiliation.findMany({
            where: { serverId, status, is_deleted: false },
            orderBy: { created_at: 'asc' },
            select: {
                crewId: true,
                status: true,
                created_at: true,
                responded_at: true,
                crew: { select: { name: true, tag: true } },
            },
        });

        return linhas.map((linha) => ({
            crewId: linha.crewId,
            crewName: linha.crew.name,
            crewTag: linha.crew.tag,
            status: linha.status,
            requestedAt: linha.created_at,
            respondedAt: linha.responded_at,
        }));
    }

    crewExists(crewId: string) {
        return this.database.crew.findFirst({
            where: { id: crewId, is_deleted: false },
            select: { id: true },
        });
    }

    serverExists(serverId: string) {
        return this.database.server.findFirst({
            where: { id: serverId, is_deleted: false },
            select: { id: true, name: true },
        });
    }
}
