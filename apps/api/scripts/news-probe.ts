/*
 * Primeiro de todos, pela mesma razão do `news-fetch.ts`: este módulo
 * carrega o `.env` da raiz, e o `@vicehub/database` — que a leitura do
 * feed importa — exige o `DATABASE_URL` no momento em que é carregado.
 */
import { env } from '../src/config/env.js';

import { enderecoSeguro } from '@vicehub/database';

import { feedsDeclaradosEm, lerFeed } from '../src/shared/feed.js';

/**
 * Procura um feed, em vez de o adivinhar.
 *
 *     npm run news:probe                      # os candidatos por omissão
 *     npm run news:probe -- https://sitio/…   # estes, e mais nenhum
 *
 * Escrito porque a pergunta "qual é o endereço do feed?" não se responde
 * de cabeça: responde-se pedindo. Para cada endereço diz o que chegou, e
 * — quando chegou uma página em vez de um feed — quais os feeds que essa
 * página **declara** ter, que é onde um leitor de RSS iria procurar.
 *
 * No fim diz o que pôr em `NEWS_FEED_URL`, ou que não encontrou nada.
 * Nenhuma das duas respostas é um palpite.
 *
 * Não escreve na base de dados. Só lê, e só de onde lhe mandarem.
 */

/** Quanto tempo se espera por cada candidato. */
const ESPERA_MAXIMA_MS = 15_000;

/**
 * Por onde começar quando ninguém disser por onde.
 *
 * A página do Newswire está cá em primeiro lugar de propósito: se a
 * Rockstar publicar um feed, é lá que ele estará declarado, e essa
 * resposta vale mais do que os endereços habituais que vêm a seguir —
 * que são tentativas, e estão identificadas como tal.
 */
const CANDIDATOS = [
    'https://www.rockstargames.com/newswire',
    'https://www.rockstargames.com/newswire.rss',
    'https://www.rockstargames.com/newswire/rss',
    'https://www.rockstargames.com/newswire/feed',
    'https://www.rockstargames.com/rss',
    'https://www.rockstargames.com/feed',
];

interface Achado {
    endereco: string;
    /** Quantas notícias é que as nossas regras conseguiram aproveitar. */
    noticias: number;
    fonte: string;
}

const linha = (texto: string): void => {
    console.log(texto);
};

/**
 * Vai buscar um endereço e diz o que lá estava.
 *
 * Devolve o feed quando o que chegou é um feed, e os endereços a
 * experimentar a seguir quando o que chegou é uma página que declara
 * ter feeds.
 */
const espreitar = async (
    endereco: string,
): Promise<{ achado: Achado | null; seguintes: string[] }> => {
    if (!enderecoSeguro(endereco)) {
        linha(`  ✗ não é um endereço http ou https`);

        return { achado: null, seguintes: [] };
    }

    let resposta: Response;

    try {
        resposta = await fetch(endereco, {
            signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
            headers: {
                /**
                 * Dito por extenso e com o endereço do projeto, que é o
                 * que se faz quando se vai buscar coisas ao site de
                 * outra pessoa: quem estiver a ler os registos dele fica
                 * a saber quem somos e onde reclamar.
                 */
                'user-agent':
                    'ViceHub/1.0 (+https://github.com/joaoloureiro-dev/vicehub-platform)',
                accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8',
            },
        });
    } catch (erro: unknown) {
        linha(`  ✗ não respondeu: ${erro instanceof Error ? erro.message : 'erro'}`);

        return { achado: null, seguintes: [] };
    }

    const tipo = resposta.headers.get('content-type') ?? 'sem tipo';

    linha(`  ${resposta.status} ${resposta.statusText} · ${tipo}`);

    if (!resposta.ok) {
        return { achado: null, seguintes: [] };
    }

    const corpo = await resposta.text();
    const feed = lerFeed(corpo);

    if (feed) {
        /**
         * Não chega ser XML: o que interessa é quantas notícias é que as
         * **nossas** regras aproveitam. Um feed que exista mas de onde
         * não saia nada aproveitável é a pior das descobertas, porque
         * parece boa na configuração e dá um bloco vazio no ecrã.
         */
        linha(
            `  ✓ é um feed — fonte "${feed.sourceName}", ${feed.noticias.length} notícia(s) aproveitável(eis)`,
        );

        const primeira = feed.noticias[0];

        if (primeira) {
            linha(`     a mais recente: ${primeira.title}`);
            linha(`     ${primeira.publishedAt.toISOString()} · ${primeira.url}`);
        }

        return {
            achado: {
                endereco,
                noticias: feed.noticias.length,
                fonte: feed.sourceName,
            },
            seguintes: [],
        };
    }

    const declarados = feedsDeclaradosEm(corpo, endereco);

    if (declarados.length > 0) {
        linha(`  → a página declara ${declarados.length} feed(s):`);

        for (const candidato of declarados) {
            linha(`     ${candidato}`);
        }

        return { achado: null, seguintes: declarados };
    }

    linha('  ✗ não é um feed, e a página não declara nenhum');

    return { achado: null, seguintes: [] };
};

const main = async (): Promise<void> => {
    const pedidos = process.argv.slice(2).filter((argumento) => argumento !== '');
    const porExaminar = pedidos.length > 0 ? [...pedidos] : [...CANDIDATOS];

    if (pedidos.length === 0) {
        linha('Sem endereços no comando: a experimentar os candidatos conhecidos.\n');
    }

    const jaVistos = new Set<string>();
    const achados: Achado[] = [];

    while (porExaminar.length > 0) {
        const endereco = porExaminar.shift() as string;

        if (jaVistos.has(endereco)) {
            continue;
        }

        jaVistos.add(endereco);

        linha(endereco);

        const { achado, seguintes } = await espreitar(endereco);

        if (achado) {
            achados.push(achado);
        }

        /**
         * Um nível só. Os feeds que uma página declara vale a pena
         * experimentar; os que esses declararem já é andar às voltas no
         * site de outra pessoa.
         */
        for (const candidato of seguintes) {
            if (!jaVistos.has(candidato)) {
                porExaminar.push(candidato);
            }
        }

        linha('');
    }

    const uteis = achados.filter((achado) => achado.noticias > 0);

    if (uteis.length === 0) {
        linha('Nenhum feed encontrado.');
        linha(
            'Isso é uma resposta, e não uma falha: há sites que não publicam feed nenhum.\n'
            + 'Sem NEWS_FEED_URL a plataforma funciona toda e o bloco de notícias não aparece.',
        );

        /**
         * A confusão que este guião mais facilmente provoca, dita antes
         * de alguém cair nela: uma rede que bloqueia o site responde
         * exactamente como um site que não tem feed. Se **todos** os
         * candidatos falharam da mesma maneira, a pergunta a fazer
         * primeiro é se esta máquina chega lá de todo.
         */
        if (jaVistos.size > 1 && achados.length === 0) {
            linha(
                '\nSe todos falharam da mesma maneira, confirma primeiro que esta máquina\n'
                + 'chega ao site — uma rede que o bloqueia responde igual a um site sem feed.',
            );
        }

        return;
    }

    linha(uteis.length === 1 ? 'Encontrado:' : 'Encontrados:');

    for (const achado of uteis) {
        linha(`  NEWS_FEED_URL=${achado.endereco}`);
        linha(`    "${achado.fonte}", ${achado.noticias} notícia(s)`);
    }

    if (env.NEWS_FEED_URL) {
        linha(`\nO .env já tem NEWS_FEED_URL=${env.NEWS_FEED_URL}`);
    }
};

main()
    .then(() => {
        process.exit(0);
    })
    .catch((erro: unknown) => {
        console.error('[ViceHub News] A procura falhou:', erro);
        process.exit(1);
    });
