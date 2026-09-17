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

/**
 * Uma entrada do rasto, pronta a ser lida por uma pessoa.
 *
 * O autor sai com o nome e não só com o identificador: um rasto que
 * diga `a3f1…` obriga quem o lê a ir procurar quem é, e a pergunta que
 * o traz ali é precisamente essa.
 *
 * O nome pode vir a null, e isso não é um defeito: a coluna do autor
 * não tem chave estrangeira de propósito, para que apagar uma conta não
 * apague o que ela fez. Quem já não existe deixa de ter nome e continua
 * a ter rasto.
 */
export interface AuditTrailEntry {
    id: string;
    action: string;
    actorId: string | null;
    actorUsername: string | null;
    before: unknown;
    after: unknown;
    at: Date;
}
