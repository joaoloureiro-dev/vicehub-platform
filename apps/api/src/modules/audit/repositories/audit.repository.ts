import { Prisma, SourceType, type DatabaseClient } from '@vicehub/database';

import type { AuditEntry } from '../types/audit.types.js';

/**
 * Escritas no rasto de auditoria.
 *
 * Só escreve e lê: não existe alteração nem remoção, de propósito. Um
 * registo de auditoria que se pode reescrever não serve de prova.
 */
export class AuditRepository {
    constructor(private readonly database: DatabaseClient) { }

    record(entry: AuditEntry) {
        return this.database.auditLog.create({
            data: {
                action: entry.action,
                entity_type: entry.entityType,
                entity_id: entry.entityId,
                actor_id: entry.actorId ?? null,
                before: this.toJson(entry.before),
                after: this.toJson(entry.after),
                ip_address: entry.ipAddress ?? null,
                user_agent: entry.userAgent ?? null,
                source: SourceType.api,
            },
        });
    }

    listForEntity(entityType: string, entityId: string, take: number) {
        return this.database.auditLog.findMany({
            where: { entity_type: entityType, entity_id: entityId },
            orderBy: { created_at: 'desc' },
            take,
        });
    }

    /**
     * Os nomes de quem fez cada coisa.
     *
     * Consulta à parte, e não um `include`, porque a coluna do autor não
     * tem chave estrangeira: é essa ausência que faz o rasto sobreviver
     * a uma conta apagada, e o preço é procurar os nomes aqui. Quem já
     * não existe simplesmente não vem nesta lista.
     */
    findActorNames(ids: string[]) {
        return this.database.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, username: true },
        });
    }

    /**
     * Um valor ausente fica como JSON nulo da base de dados, e não como a
     * string "null": são coisas diferentes ao consultar.
     */
    private toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
        if (value === undefined || value === null) {
            return Prisma.JsonNull;
        }

        return value as Prisma.InputJsonValue;
    }
}
