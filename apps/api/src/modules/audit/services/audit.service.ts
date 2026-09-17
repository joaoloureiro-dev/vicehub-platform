import type { FastifyRequest } from 'fastify';

import type { AuditRepository } from '../repositories/audit.repository.js';
import type { AuditEntry, AuditTrailEntry } from '../types/audit.types.js';

/**
 * Serviço de auditoria.
 *
 * Registar nunca pode derrubar a ação que está a ser auditada: se a
 * escrita do rasto falhar, o erro é registado no log e a operação segue.
 * O contrário significaria que uma avaria na auditoria impediria alguém
 * de trabalhar — e a tentação seguinte seria desligá-la.
 */
export class AuditService {
    constructor(private readonly auditRepository: AuditRepository) { }

    async record(entry: AuditEntry): Promise<void> {
        await this.auditRepository.record(entry);
    }

    /**
     * Extrai do pedido os dados de proveniência que interessam ao rasto.
     */
    static contextOf(request: FastifyRequest): {
        ipAddress: string | null;
        userAgent: string | null;
    } {
        const userAgent = request.headers['user-agent'];

        return {
            ipAddress: request.ip ?? null,
            userAgent: typeof userAgent === 'string' ? userAgent : null,
        };
    }

    listForEntity(entityType: string, entityId: string, take = 50) {
        return this.auditRepository.listForEntity(entityType, entityId, take);
    }

    /**
     * O rasto de uma entidade, com o nome de quem fez cada coisa.
     *
     * Os nomes vêm numa consulta só para todos os autores da página, e
     * não um por linha: um rasto de cinquenta entradas de cinco pessoas
     * são duas consultas, e não cinquenta e uma.
     */
    async trailOf(
        entityType: string,
        entityId: string,
        take = 50,
    ): Promise<AuditTrailEntry[]> {
        const linhas = await this.auditRepository.listForEntity(
            entityType,
            entityId,
            take,
        );

        const autores = [
            ...new Set(
                linhas
                    .map((linha) => linha.actor_id)
                    .filter((id): id is string => id !== null),
            ),
        ];

        const nomes = new Map(
            (autores.length === 0
                ? []
                : await this.auditRepository.findActorNames(autores)
            ).map((pessoa) => [pessoa.id, pessoa.username]),
        );

        return linhas.map((linha) => ({
            id: linha.id,
            action: linha.action,
            actorId: linha.actor_id,
            actorUsername:
                linha.actor_id === null
                    ? null
                    : (nomes.get(linha.actor_id) ?? null),
            before: linha.before,
            after: linha.after,
            at: linha.created_at,
        }));
    }
}
