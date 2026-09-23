import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { useAsync } from '../../lib/use-async.js';
import { useAuth } from '../../auth/auth.context.js';
import { useT } from '../../i18n/i18n.js';
import { mensagemDoErro } from '../../lib/erro.js';
import { CartaoDeAnuncio } from '../components/cartao-de-anuncio.js';
import { FormularioDeAnuncio } from '../components/formulario-de-anuncio.js';
import {
    CATEGORIAS,
    createListing,
    listListings,
    type CategoriaDeAnuncio,
    type EstadoDeAnuncio,
} from '../market.api.js';

/**
 * O mercado de um servidor.
 *
 * Ler não pede sessão: quem está a escolher onde jogar ainda não tem
 * conta, e um mercado com gente a vender é a prova mais direta de que a
 * economia daquele servidor está viva.
 *
 * Vender pede — e pede jogar lá, que é uma coisa que este ecrã não sabe
 * de antemão. Por isso o formulário aparece a quem tem sessão e a
 * recusa, quando vier, é dita por palavras em vez de esconder o botão:
 * esconder deixava a pessoa sem saber o que lhe faltava.
 */
const ESTADOS: EstadoDeAnuncio[] = ['open', 'sold', 'withdrawn'];

export const MercadoPage = () => {
    const t = useT();
    const { user } = useAuth();
    const { serverId = '' } = useParams();

    const [categoria, setCategoria] = useState<CategoriaDeAnuncio | null>(null);
    const [estado, setEstado] = useState<EstadoDeAnuncio>('open');
    const [aAnunciar, setAAnunciar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const pagina = useAsync(
        () =>
            listListings(serverId, {
                status: estado,
                ...(categoria === null ? {} : { category: categoria }),
            }),
        [serverId, estado, categoria],
    );

    const anunciar = async (campos: Parameters<typeof createListing>[1]) => {
        setErro(null);

        try {
            await createListing(serverId, campos);

            setAAnunciar(false);
            pagina.reload();
        } catch (falha) {
            setErro(
                mensagemDoErro(falha, t, t.mercado.naoFoiPossivelPublicar),
            );

            throw falha;
        }
    };

    if (pagina.error) {
        return (
            <main className="panel wide">
                <Alert kind="bad">
                    {mensagemDoErro(pagina.error, t, t.mercado.naoCarregou)}
                </Alert>
                <p><Link to="/servidores">{t.servidores.titulo}</Link></p>
            </main>
        );
    }

    const anuncios = pagina.data?.listings ?? [];

    return (
        <main className="panel wide mercado">
            <header className="card header">
                <h1>{t.mercado.titulo}</h1>
                {pagina.data ? (
                    <p>
                        <Link to={`/servidores/${serverId}`}>
                            {t.mercado.sub(pagina.data.server.name)}
                        </Link>
                    </p>
                ) : null}
                {/*
                  A frase da moeda de jogo fica no cabeçalho, e não num
                  rodapé nem nos termos: é aqui que alguém chega a
                  pensar em vender alguma coisa, e é aqui que tem de ler
                  que dinheiro real não entra nisto.
                */}
                <p className="hint">{t.mercado.moedaDeJogo}</p>
            </header>

            {user === null ? (
                <p className="hint">
                    <Link to="/entrar">{t.mercado.entrarParaAnunciar}</Link>
                </p>
            ) : aAnunciar ? (
                <FormularioDeAnuncio
                    rotuloDoBotao={t.mercado.publicar}
                    recursoDoErro={t.mercado.naoFoiPossivelPublicar}
                    aoGravar={anunciar}
                    aoCancelar={() => {
                        setAAnunciar(false);
                        setErro(null);
                    }}
                />
            ) : (
                <button
                    className="primary"
                    type="button"
                    onClick={() => {
                        setAAnunciar(true);
                    }}
                >
                    {t.mercado.anunciar}
                </button>
            )}

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <nav className="abas">
                {ESTADOS.map((um) => (
                    <button
                        key={um}
                        className={um === estado ? 'aba activa' : 'aba'}
                        type="button"
                        onClick={() => {
                            setEstado(um);
                        }}
                    >
                        {t.mercado.estados[um]}
                    </button>
                ))}
            </nav>

            <nav className="abas categorias">
                <button
                    className={categoria === null ? 'aba activa' : 'aba'}
                    type="button"
                    onClick={() => {
                        setCategoria(null);
                    }}
                >
                    {t.mercado.todasAsCategorias}
                </button>
                {CATEGORIAS.map((uma) => (
                    <button
                        key={uma}
                        className={uma === categoria ? 'aba activa' : 'aba'}
                        type="button"
                        onClick={() => {
                            setCategoria(uma);
                        }}
                    >
                        {t.mercado.categorias[uma]}
                    </button>
                ))}
            </nav>

            {!pagina.data ? (
                <p className="hint">{t.comum.aCarregar}</p>
            ) : anuncios.length === 0 ? (
                <p className="hint">
                    {categoria === null && estado === 'open'
                        ? t.mercado.aindaSemAnuncios
                        : t.mercado.nadaNesteFiltro}
                </p>
            ) : (
                <>
                    <p className="hint">
                        {t.mercado.quantos(pagina.data.total)}
                    </p>
                    <ul className="grelha-anuncios">
                        {anuncios.map((anuncio) => (
                            <CartaoDeAnuncio
                                key={anuncio.id}
                                anuncio={anuncio}
                            />
                        ))}
                    </ul>
                </>
            )}
        </main>
    );
};
