import type { FastifyRequest } from 'fastify';

import type { AuditRepository } from '../repositories/audit.repository.js';
import type { AuditEntry } from '../types/audit.types.js';

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
}
