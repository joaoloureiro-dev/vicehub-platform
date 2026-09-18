import type { FastifyPluginAsync } from 'fastify';

import { NOTICIAS_NA_ENTRADA } from '@vicehub/database';

/**
 * O que se passa no jogo, para quem chega à página de entrada.
 *
 * Pública e sem sessão, como o resto da página de entrada: quem ainda
 * não tem conta é precisamente quem isto serve.
 *
 * Só **lê**. Nada entra por aqui: as notícias são trazidas pela recolha
 * do feed, que corre num cron e não dentro da API. Uma página que fosse
 * buscar o feed a cada visita punha o site de outra pessoa a aguentar o
 * nosso tráfego, e deixava a nossa página de entrada de pé ou no chão
 * conforme o dia que o deles estivesse a ter.
 */
const newsRoutes: FastifyPluginAsync = async (app) => {
    app.get('/', async () => {
        const noticias = await app.prisma.newsItem.findMany({
            where: { is_deleted: false },
            orderBy: [{ published_at: 'desc' }, { id: 'desc' }],
            take: NOTICIAS_NA_ENTRADA,
            select: {
                id: true,
                source_name: true,
                title: true,
                excerpt: true,
                url: true,
                image_url: true,
                published_at: true,
            },
        });

        return noticias.map((noticia) => ({
            id: noticia.id,
            sourceName: noticia.source_name,
            title: noticia.title,
            excerpt: noticia.excerpt,
            url: noticia.url,
            imageUrl: noticia.image_url,
            publishedAt: noticia.published_at.toISOString(),
        }));
    });
};

export default newsRoutes;
