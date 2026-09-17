import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditService } from '../../src/modules/audit/services/audit.service.js';
import type { AuditRepository } from '../../src/modules/audit/repositories/audit.repository.js';

/**
 * O rasto, lido por uma pessoa.
 *
 * Durante muito tempo isto foi só escrita: meia dúzia de módulos
 * gravavam e não havia por onde ler. O que estes testes fixam é o que
 * torna o rasto legível — quem fez cada coisa, pelo nome — e o que
 * acontece quando essa pessoa já não existe.
 */
describe('AuditService, ao ler o rasto', () => {
    let repository: {
        record: ReturnType<typeof vi.fn>;
        listForEntity: ReturnType<typeof vi.fn>;
        findActorNames: ReturnType<typeof vi.fn>;
    };
    let service: AuditService;

    const linha = (extra: Record<string, unknown> = {}) => ({
        id: 'log-1',
        action: 'crew.member.removed',
        actor_id: 'u1',
        before: { username: 'alvo' },
        after: null,
        created_at: new Date('2026-09-17T10:00:00.000Z'),
        ...extra,
    });

    beforeEach(() => {
        repository = {
            record: vi.fn(),
            listForEntity: vi.fn().mockResolvedValue([]),
            findActorNames: vi.fn().mockResolvedValue([]),
        };

        service = new AuditService(repository as unknown as AuditRepository);
    });

    it('põe o nome de quem fez ao lado do que foi feito', async () => {
        repository.listForEntity.mockResolvedValue([linha()]);
        repository.findActorNames.mockResolvedValue([
            { id: 'u1', username: 'lider' },
        ]);

        const rasto = await service.trailOf('Crew', 'crew-1');

        expect(rasto[0]?.actorUsername).toBe('lider');
        expect(rasto[0]?.action).toBe('crew.member.removed');
    });

    /**
     * A coluna do autor não tem chave estrangeira, de propósito: apagar
     * uma conta não pode apagar o que ela fez. O preço é este caso —
     * rasto sem nome —, e é para ser mostrado e não escondido.
     */
    it('mantém a entrada de quem já apagou a conta, sem nome', async () => {
        repository.listForEntity.mockResolvedValue([linha()]);
        repository.findActorNames.mockResolvedValue([]);

        const rasto = await service.trailOf('Crew', 'crew-1');

        expect(rasto).toHaveLength(1);
        expect(rasto[0]?.actorId).toBe('u1');
        expect(rasto[0]?.actorUsername).toBeNull();
    });

    it('deixa sem autor o que foi o próprio sistema a fazer', async () => {
        repository.listForEntity.mockResolvedValue([linha({ actor_id: null })]);

        const rasto = await service.trailOf('Crew', 'crew-1');

        expect(rasto[0]?.actorId).toBeNull();
        expect(rasto[0]?.actorUsername).toBeNull();
        expect(repository.findActorNames).not.toHaveBeenCalled();
    });

    /**
     * Uma consulta para todos os autores da página, e não uma por linha.
     * Sem isto, um rasto de cinquenta entradas custava cinquenta e uma
     * consultas — e é precisamente o rasto mais movimentado que mais
     * alguém vai querer abrir.
     */
    it('procura os nomes de uma vez só, sem repetir quem se repete', async () => {
        repository.listForEntity.mockResolvedValue([
            linha({ id: 'log-1', actor_id: 'u1' }),
            linha({ id: 'log-2', actor_id: 'u1' }),
            linha({ id: 'log-3', actor_id: 'u2' }),
        ]);
        repository.findActorNames.mockResolvedValue([
            { id: 'u1', username: 'lider' },
            { id: 'u2', username: 'oficial' },
        ]);

        await service.trailOf('Crew', 'crew-1');

        expect(repository.findActorNames).toHaveBeenCalledTimes(1);
        expect(repository.findActorNames).toHaveBeenCalledWith(['u1', 'u2']);
    });

    it('lê o rasto da entidade que lhe foi pedida', async () => {
        await service.trailOf('Server', 'server-9', 10);

        expect(repository.listForEntity).toHaveBeenCalledWith(
            'Server',
            'server-9',
            10,
        );
    });
});
