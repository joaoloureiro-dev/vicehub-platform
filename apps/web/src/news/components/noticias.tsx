import { useT } from '../../i18n/i18n.js';
import type { NewsItem } from '../news.api.js';

interface NoticiasProps {
    noticias: NewsItem[];
}

/**
 * O que se passa no jogo, por baixo do hero.
 *
 * É um **agregador**, e a forma diz isso: título, um excerto curto, a
 * fonte à vista e o link para lá. O artigo é de quem o escreveu, e a
 * pessoa que o quiser ler lê-o no sítio dele — que é o que distingue
 * isto de copiar o trabalho de outra pessoa para dentro da nossa página.
 *
 * Por isso cada ligação sai da plataforma e diz que sai: `target` novo,
 * `rel` a fechar a porta ao separador de origem, e o nome da fonte em
 * cada linha em vez de uma vez no topo. Alguém que leia só uma das
 * quatro tem de ficar a saber de onde ela veio.
 *
 * Sem notícias não há secção. A página de entrada não depende do site de
 * terceiros estar de pé — se a recolha nunca correu, ou o feed esteve em
 * baixo, o bloco simplesmente não aparece.
 */
export const Noticias = ({ noticias }: NoticiasProps) => {
    const t = useT();

    if (noticias.length === 0) {
        return null;
    }

    return (
        <section className="landing-vivo noticias">
            <div className="landing-vivo-head">
                <h2>{t.noticias.titulo}</h2>
            </div>

            <ul className="lista-noticias">
                {noticias.map((noticia) => (
                    <li key={noticia.id}>
                        <a
                            href={noticia.url}
                            target="_blank"
                            /*
                              `noopener` fecha o acesso da página aberta
                              à nossa, e `noreferrer` impede que o
                              endereço daqui siga no cabeçalho. As duas,
                              porque são links para fora que não
                              controlamos.
                            */
                            rel="noopener noreferrer"
                        >
                            <span className="noticia-fonte">
                                {noticia.sourceName}
                            </span>

                            <span className="noticia-titulo">
                                {noticia.title}
                            </span>

                            {noticia.excerpt ? (
                                <span className="noticia-excerto">
                                    {noticia.excerpt}
                                </span>
                            ) : null}

                            <time
                                className="noticia-quando"
                                dateTime={noticia.publishedAt}
                            >
                                {new Date(
                                    noticia.publishedAt,
                                ).toLocaleDateString()}
                            </time>
                        </a>
                    </li>
                ))}
            </ul>
        </section>
    );
};
