import type { CommunityMember } from './membership.js';

/**
 * Se este utilizador manda mesmo na comunidade.
 *
 * A lista de candidaturas responde a "geres membros?" — é o 403 que a
 * API dá a quem não tem `crew:manage_members`. Não serve para tudo: um
 * oficial de crew e um moderador de servidor gerem membros e **não**
 * têm `crew:manage` nem `server:manage`. Mostrar-lhes as definições ou
 * a filiação seria mostrar-lhes botões que respondem 403 ao serem
 * carregados.
 *
 * O cargo vem da lista de membros, que é a resposta da própria API — não
 * é deduzido de outro sítio.
 */
export const mandaNisto = (
    membros: CommunityMember[] | null | undefined,
    userId: string | undefined,
    cargo: 'crew_leader' | 'server_owner',
): boolean => {
    if (!membros || !userId) {
        return false;
    }

    return membros.some(
        (membro) => membro.userId === userId && membro.role === cargo,
    );
};
