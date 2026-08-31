import { Prisma } from '@vicehub/database';

/**
 * Identifica violações de restrição de unicidade.
 *
 * Verificar antes de inserir não é suficiente: entre a verificação e a
 * inserção pode entrar outro pedido com os mesmos dados. Sem tratar o
 * erro da base de dados, essa corrida devolveria 500.
 *
 * Devolve os campos em conflito, ou null se o erro for outro.
 */
export const getUniqueConstraintFields = (error: unknown): string[] | null => {
    if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
    ) {
        return null;
    }

    const target: unknown = error.meta?.['target'];

    if (Array.isArray(target)) {
        return target.filter(
            (field: unknown): field is string => typeof field === 'string',
        );
    }

    return typeof target === 'string' ? [target] : [];
};
