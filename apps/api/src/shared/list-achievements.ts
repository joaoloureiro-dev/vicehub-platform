import type { DatabaseClient } from '@vicehub/database';

/**
 * Uma conquista, como o perfil a mostra.
 */
export interface ConquistaVisivel {
    slug: string;
    earnedAt: Date;
}

/**
 * Quantas conquistas o perfil mostra.
 *
 * Um perfil não é uma prateleira de troféus: mostrar cinquenta medalhas
 * transforma as que importam em ruído. As mais recentes são as que dizem
 * o que a pessoa anda a fazer agora, que é o que interessa a quem está a
 * decidir se a aceita.
 */
export const CONQUISTAS_NO_PERFIL = 12;

/**
 * As conquistas de uma pessoa ou de uma crew, das mais recentes para as
 * mais antigas.
 *
 * Uma função para os dois, e não uma em cada módulo: a pergunta é a
 * mesma, e duas cópias acabariam a mostrar coisas diferentes no perfil
 * de uma pessoa e no de uma crew.
 */
export const listAchievements = async (
    database: DatabaseClient,
    dono: { userId: string } | { crewId: string },
): Promise<ConquistaVisivel[]> => {
    const conquistas = await database.achievement.findMany({
        where: { ...dono, is_deleted: false },
        orderBy: { earned_at: 'desc' },
        take: CONQUISTAS_NO_PERFIL,
        select: { slug: true, earned_at: true },
    });

    return conquistas.map((conquista) => ({
        slug: conquista.slug,
        earnedAt: conquista.earned_at,
    }));
};
