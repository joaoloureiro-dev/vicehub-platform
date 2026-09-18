/*
 * Primeiro de todos, e de propósito.
 *
 * Este módulo carrega o `.env` da raiz do monorepo ao ser importado, e o
 * `@vicehub/database` exige o `DATABASE_URL` no momento em que ele
 * próprio é carregado. Em ESM os imports correm por ordem e todos antes
 * do corpo do ficheiro — trocá-los de sítio parte o guião.
 *
 * E traz de caminho a validação: um cron mal configurado falha aqui,
 * alto, em vez de gravar meia coisa.
 */
import { env } from '../src/config/env.js';

import { NOTICIAS_GUARDADAS, enderecoSeguro, prisma } from '@vicehub/database';

import { lerFeed } from '../src/shared/feed.js';

/**
 * Traz as notícias do feed configurado.
 *
 * As regras de o que se guarda vivem em `@vicehub/database`, e a leitura
 * do XML em `src/shared/feed.ts`, que é o que os testes exercitam. Aqui
 * só se vai buscar, se escreve e se diz o que aconteceu.
 *
 * **Não corre dentro da API**, pela mesma razão que a limpeza não corre:
 * com mais do que uma instância, um temporizador em processo ia buscar o
 * feed em todas ao mesmo tempo — N pedidos ao site de outra pessoa para
 * mostrar a mesma coisa. Põe-se num cron, de hora a hora.
 *
 *     npm run news:fetch
 *
 * Sem `NEWS_FEED_URL` não faz nada e diz porquê. É deliberado: a
 * plataforma arranca e funciona na mesma, e o bloco simplesmente não
 * aparece — uma página de entrada não deve depender do site de terceiros
 * estar de pé.
 */

/** Quanto tempo se espera pelo feed antes de desistir. */
const ESPERA_MAXIMA_MS = 15_000;

const main = async (): Promise<void> => {
    const endereco = env.NEWS_FEED_URL;

    if (!endereco) {
        console.log(
            '[ViceHub News] NEWS_FEED_URL não está definida. Nada a fazer.\n'
            + 'Define-a no .env com o endereço do feed RSS ou Atom da fonte.',
        );

        return;
    }

    if (!enderecoSeguro(endereco)) {
        throw new Error(
            `[ViceHub News] NEWS_FEED_URL não é um endereço http ou https: ${endereco}`,
        );
    }

    const resposta = await fetch(endereco, {
        signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
        headers: {
            /**
             * Quem recebe o pedido tem direito a saber quem o faz, e a
             * poder bloquear-nos se não quiser. Um agregador que se
             * disfarça de browser está a contar com o contrário.
             */
            'user-agent': 'ViceHub/1.0 (+https://vicehub.gg)',
            accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
        },
    });

    if (!resposta.ok) {
        throw new Error(
            `[ViceHub News] O feed respondeu ${resposta.status}. Nada foi escrito.`,
        );
    }

    const lido = lerFeed(await resposta.text());

    if (lido === null) {
        throw new Error(
            '[ViceHub News] O que veio deste endereço não é um feed RSS nem Atom.',
        );
    }

    let novas = 0;

    for (const noticia of lido.noticias) {
        const dados = {
            source_name: lido.sourceName,
            title: noticia.title,
            excerpt: noticia.excerpt,
            url: noticia.url,
            image_url: noticia.imageUrl,
            published_at: noticia.publishedAt,
        };

        const existente = await prisma.newsItem.findFirst({
            where: { guid: noticia.guid, is_deleted: false },
            select: { id: true },
        });

        if (existente) {
            /**
             * Um artigo corrigido depois de sair continua a ser o mesmo
             * artigo. Atualiza-se em vez de entrar outra vez.
             */
            await prisma.newsItem.update({
                where: { id: existente.id },
                data: { ...dados, version: { increment: 1 } },
            });

            continue;
        }

        await prisma.newsItem.create({ data: { ...dados, guid: noticia.guid } });
        novas += 1;
    }

    /**
     * O que passa do teto é apagado. Um feed devolve as recentes e
     * esquece o resto; guardar tudo para sempre faria a tabela crescer
     * sozinha para mostrar quatro.
     */
    const aMais = await prisma.newsItem.findMany({
        where: { is_deleted: false },
        orderBy: [{ published_at: 'desc' }, { id: 'desc' }],
        skip: NOTICIAS_GUARDADAS,
        select: { id: true },
    });

    if (aMais.length > 0) {
        await prisma.newsItem.deleteMany({
            where: { id: { in: aMais.map((linha) => linha.id) } },
        });
    }

    console.log(
        `[ViceHub News] ${lido.sourceName}: ${lido.noticias.length} lidas, `
        + `${novas} novas, ${aMais.length} antigas apagadas.`,
    );
};

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (erro: unknown) => {
        console.error(erro);
        await prisma.$disconnect();
        process.exit(1);
    });
