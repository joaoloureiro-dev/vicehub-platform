/**
 * Ação registada no rasto de auditoria.
 *
 * O nome é escrito em minúsculas e separado por pontos, do geral para o
 * particular. Fica como texto e não como enum porque o conjunto de ações
 * cresce com a plataforma, e um enum obrigaria a uma migração por cada
 * ação nova.
 */
export interface AuditEntry {
    action: string;
    entityType: string;
    entityId: string;
    actorId?: string | null | undefined;
    before?: unknown;
    after?: unknown;
    ipAddress?: string | null | undefined;
    userAgent?: string | null | undefined;
}
