import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditRepository } from '../../src/modules/audit/repositories/audit.repository.js';
import type { DatabaseClient } from '@vicehub/database';

/**
 * Testes à forma da escrita no rasto de auditoria.
 *
 * Um registo de auditoria que perde o autor, ou que guarda "null" como
 * texto em vez de nulo, deixa de servir de prova.
 */
describe('AuditRepository', () => {
    let database: {
        auditLog: {
            create: ReturnType<typeof vi.fn>;
            findMany: ReturnType<typeof vi.fn>;
        };
    };
    let repository: AuditRepository;

    beforeEach(() => {
        database = { auditLog: { create: vi.fn(), findMany: vi.fn() } };
        repository = new AuditRepository(database as unknown as DatabaseClient);
    });

    const dataOf = () =>
        (database.auditLog.create.mock.calls[0]?.[0] as {
            data: Record<string, unknown>;
        }).data;

    const entrada = {
        action: 'subscription.granted',
        entityType: 'Subscription',
        entityId: 'sub-1',
        actorId: 'admin-1',
        after: { priceCents: 1_000 },
        ipAddress: '203.0.113.7',
        userAgent: 'vicehub-tests',
    };

    it('guarda a ação, a entidade e o autor', async () => {
        await repository.record(entrada);

        expect(dataOf()['action']).toBe('subscription.granted');
        expect(dataOf()['entity_type']).toBe('Subscription');
        expect(dataOf()['entity_id']).toBe('sub-1');
        expect(dataOf()['actor_id']).toBe('admin-1');
    });

    it('guarda a proveniência do pedido', async () => {
        await repository.record(entrada);

        expect(dataOf()['ip_address']).toBe('203.0.113.7');
        expect(dataOf()['user_agent']).toBe('vicehub-tests');
    });

    /**
     * Uma ação do próprio sistema não tem autor. Fica nulo, e não uma
     * string vazia que depois se confundiria com um identificador.
     */
    it('aceita uma ação sem autor', async () => {
        await repository.record({
            action: 'system.cleanup',
            entityType: 'AuthSession',
            entityId: 'session-1',
        });

        expect(dataOf()['actor_id']).toBeNull();
    });

    it('um estado ausente fica como nulo de JSON, não como texto', async () => {
        await repository.record({
            action: 'system.cleanup',
            entityType: 'AuthSession',
            entityId: 'session-1',
        });

        expect(dataOf()['before']).not.toBe('null');
        expect(dataOf()['after']).not.toBe('null');
    });

    it('guarda o estado depois quando existe', async () => {
        await repository.record(entrada);

        expect(dataOf()['after']).toEqual({ priceCents: 1_000 });
    });

    /**
     * O repositório só escreve e lê. Alterar ou apagar um registo de
     * auditoria não pode sequer ser possível a partir daqui.
     */
    it('não expõe forma nenhuma de alterar ou apagar', () => {
        const metodos = Object.getOwnPropertyNames(AuditRepository.prototype);

        expect(metodos).not.toContain('update');
        expect(metodos).not.toContain('delete');
        expect(metodos.filter((nome) => nome !== 'constructor')).toEqual([
            'record',
            'listForEntity',
            'toJson',
        ]);
    });

    it('lê o histórico de uma entidade do mais recente para o mais antigo', async () => {
        await repository.listForEntity('Subscription', 'sub-1', 10);

        expect(database.auditLog.findMany).toHaveBeenCalledWith({
            where: { entity_type: 'Subscription', entity_id: 'sub-1' },
            orderBy: { created_at: 'desc' },
            take: 10,
        });
    });
});
