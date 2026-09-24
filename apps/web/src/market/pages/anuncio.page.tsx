import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { useAsync } from '../../lib/use-async.js';
import { useAuth } from '../../auth/auth.context.js';
import { useT, useIdioma } from '../../i18n/i18n.js';
import { mensagemDoErro } from '../../lib/erro.js';
import {
    formatarMontante,
    separadorDoIdioma,
} from '../../treasury/treasury.types.js';
import { FormularioDeAnuncio } from '../components/formulario-de-anuncio.js';
import {
    closeListing,
    getListing,
    removeListing,
    updateListing,
} from '../market.api.js';
import { Denunciar } from '../../moderation/denunciar.js';
import { reportListing } from '../../moderation/moderation.api.js';
import { openConversation } from '../conversas.api.js';
import { FormularioDeAvaliacao } from '../components/formulario-de-avaliacao.js';

/**
 * Um anúncio.
 *
 * Quem o escreveu vê os botões de mexer; quem não o escreveu vê o de
 * denunciar. As duas coisas não coexistem de propósito — denunciar o
 * que é nosso é trabalho posto na fila de outra pessoa por nada, e a
 * API recusa-o na mesma.
 */
export const AnuncioPage = () => {
    const t = useT();
    const { idioma } = useIdioma();
    const { user } = useAuth();
    const { listingId = '' } = useParams();
    const navegar = useNavigate();

    const [aEditar, setAEditar] = useState(false);
    const [aPerguntar, setAPerguntar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [aAgir, setAAgir] = useState(false);

    const anuncio = useAsync(() => getListing(listingId), [listingId]);

    if (anuncio.error) {
        return (
            <main className="panel">
                <Alert kind="bad">
                    {mensagemDoErro(anuncio.error, t, t.mercado.naoEncontrado)}
                </Alert>
            </main>
        );
    }

    const dados = anuncio.data;

    if (!dados) {
        return (
            <main className="panel">
                <p className="hint">{t.comum.aCarregar}</p>
            </main>
        );
    }

    /**
     * De quem é isto.
     *
     * `sellerId` é nulo quando a conta foi apagada, e comparar dois
     * nulos dava o anúncio a quem quer que estivesse a ver. A sessão
     * também pode não existir — daí as duas condições, e não uma.
     */
    const eMeu = user !== null && dados.sellerId === user.id;
    const aberto = dados.status === 'open';

    const agir = async (acto: () => Promise<unknown>, recurso: string) => {
        setErro(null);
        setAAgir(true);

        try {
            await acto();
            anuncio.reload();
        } catch (falha) {
            setErro(mensagemDoErro(falha, t, recurso));
        } finally {
            setAAgir(false);
        }
    };

    return (
        <main className="panel">
            <p className="hint">
                <Link to={`/servidores/${dados.serverId}/mercado`}>
                    {t.mercado.voltar}
                </Link>
            </p>

            <article className="card anuncio-inteiro">
                {dados.imageUrl ? (
                    <img
                        className="anuncio-imagem grande"
                        src={dados.imageUrl}
                        alt=""
                    />
                ) : null}

                <p className="anuncio-preco grande">
                    {formatarMontante(dados.price, separadorDoIdioma(idioma))}
                </p>

                <h1>{dados.title}</h1>

                <p className="hint">
                    {t.mercado.categorias[dados.category]}
                    {' · '}
                    {t.mercado.porQuem}{' '}
                    {dados.seller ? (
                        <Link to={`/u/${dados.seller.username}`}>
                            {dados.seller.username}
                        </Link>
                    ) : (
                        t.mercado.contaApagada
                    )}
                </p>

                {/*
                  O estado só se diz quando não é o normal. Escrever "à
                  venda" em cima de um anúncio que está à venda é ruído;
                  "vendido" muda tudo o que se lê a seguir.
                */}
                {!aberto && dados.closedAt !== null ? (
                    <p className="estado-do-anuncio">
                        {dados.status === 'sold'
                            ? t.mercado.vendidoEm(
                                new Date(dados.closedAt).toLocaleDateString(
                                    idioma,
                                ),
                            )
                            : t.mercado.retiradoEm(
                                new Date(dados.closedAt).toLocaleDateString(
                                    idioma,
                                ),
                            )}
                    </p>
                ) : null}

                <p className="texto pre-linha">{dados.body}</p>

                <p className="hint">{t.mercado.moedaDeJogo}</p>
            </article>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            {/*
              Avaliar aparece depois de a venda ter acontecido, e só a
              quem não vendeu. Quem pode mesmo avaliar decide-se na
              API — é preciso ter falado com quem vendeu —, e a recusa
              é dita por palavras em vez de esconder o botão: esconder
              deixava a pessoa sem saber o que lhe faltava.
            */}
            {!eMeu && dados.status === 'sold' && user !== null ? (
                <FormularioDeAvaliacao
                    listingId={dados.id}
                    aoAvaliar={() => {
                        anuncio.reload();
                    }}
                />
            ) : null}

            {/*
              Perguntar é o que faltava para o mercado servir para
              alguma coisa: o anúncio diz "entrego no parque do porto"
              e alguém tem de poder perguntar a que horas.
            */}
            {!eMeu && aberto ? (
                user === null ? (
                    <p className="hint">
                        <Link to="/entrar">
                            {t.mercado.entrarParaPerguntar}
                        </Link>
                    </p>
                ) : (
                    <div className="grupo-botoes">
                        <button
                            className="primary"
                            type="button"
                            disabled={aPerguntar}
                            onClick={() => {
                                setAPerguntar(true);

                                void (async () => {
                                    try {
                                        const conversa =
                                            await openConversation(dados.id);

                                        await navegar(
                                            `/mercado/conversas/${conversa.id}`,
                                        );
                                    } catch (falha) {
                                        setErro(
                                            mensagemDoErro(
                                                falha,
                                                t,
                                                t.mercado.naoFoiPossivelEnviar,
                                            ),
                                        );
                                        setAPerguntar(false);
                                    }
                                })();
                            }}
                        >
                            {t.mercado.perguntar}
                        </button>
                    </div>
                )
            ) : null}

            {/*
              Denunciar é para quem não escreveu isto, e só com sessão
              aberta: sem conta não há a quem responder, e a API pede-a.
            */}
            {user !== null && !eMeu ? (
                <Denunciar
                    aoDenunciar={(razao, nota) =>
                        reportListing(dados.id, razao, nota)
                    }
                />
            ) : null}

            {eMeu && aEditar ? (
                <FormularioDeAnuncio
                    inicial={{
                        category: dados.category,
                        title: dados.title,
                        body: dados.body,
                        price: dados.price,
                        imageUrl: dados.imageUrl,
                    }}
                    rotuloDoBotao={t.mercado.guardar}
                    recursoDoErro={t.mercado.naoFoiPossivelGuardar}
                    aoGravar={async (campos) => {
                        await updateListing(dados.id, campos);
                        setAEditar(false);
                        anuncio.reload();
                    }}
                    aoCancelar={() => {
                        setAEditar(false);
                    }}
                />
            ) : null}

            {eMeu && !aEditar ? (
                <div className="grupo-botoes">
                    {aberto ? (
                        <>
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={aAgir}
                                onClick={() => {
                                    setAEditar(true);
                                }}
                            >
                                {t.mercado.editar}
                            </button>
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={aAgir}
                                onClick={() =>
                                    void agir(
                                        () => closeListing(dados.id, 'sold'),
                                        t.mercado.naoFoiPossivelFechar,
                                    )
                                }
                            >
                                {t.mercado.marcarVendido}
                            </button>
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={aAgir}
                                onClick={() =>
                                    void agir(
                                        () =>
                                            closeListing(
                                                dados.id,
                                                'withdrawn',
                                            ),
                                        t.mercado.naoFoiPossivelFechar,
                                    )
                                }
                            >
                                {t.mercado.marcarRetirado}
                            </button>
                        </>
                    ) : null}

                    {/*
                      Apagar existe mesmo depois de fechado: quem vendeu
                      uma coisa continua a poder tirar do mercado o que
                      escreveu sobre ela. E leva confirmação, porque é a
                      única acção daqui que não se desfaz.
                    */}
                    <button
                        className="btn-secondary perigo"
                        type="button"
                        disabled={aAgir}
                        onClick={() => {
                            if (!window.confirm(t.mercado.confirmarRetirar)) {
                                return;
                            }

                            void agir(async () => {
                                await removeListing(dados.id);
                                await navegar(
                                    `/servidores/${dados.serverId}/mercado`,
                                );
                            }, t.mercado.naoFoiPossivelRetirar);
                        }}
                    >
                        {t.mercado.retirar}
                    </button>
                </div>
            ) : null}
        </main>
    );
};
