import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { useAsync } from '../../lib/use-async.js';
import { useAuth } from '../../auth/auth.context.js';
import { useT, useIdioma } from '../../i18n/i18n.js';
import { mensagemDoErro } from '../../lib/erro.js';
import { Denunciar } from '../../moderation/denunciar.js';
import { reportReview } from '../../moderation/moderation.api.js';
import {
    AVALIACAO_TEXTO_MAXIMO,
    listReviews,
    removeReview,
    replyToReview,
    type Avaliacao,
} from '../avaliacoes.api.js';

/**
 * As avaliações de uma pessoa, no perfil dela.
 *
 * É aqui que vivem, e não na página do anúncio: quem as lê está a
 * decidir se compra **àquela pessoa**, e não se compra àquele anúncio.
 * Uma média espalhada por trinta anúncios não é uma média.
 *
 * **Públicas**, e sem sessão: quem está a decidir se compra a alguém
 * pode nem ter conta. Os botões — responder, retirar, denunciar — é que
 * pedem sessão, e cada um a quem lhe pertence.
 */
interface AvaliacoesProps {
    /** O perfil em que isto está. */
    username: string;
    /** Quem é o dono do perfil, para lhe dar o direito de resposta. */
    userId: string;
}

/**
 * As estrelas, desenhadas com texto.
 *
 * Cheias e vazias, e o número por extenso ao lado para quem lê com um
 * leitor de ecrã — cinco símbolos iguais não dizem nada a quem não os
 * vê.
 */
const Estrelas = ({ nota }: { nota: number }) => {
    const t = useT();

    return (
        <span className="estrelas" title={t.mercado.estrelas(nota)}>
            <span aria-hidden="true">
                {'★'.repeat(nota)}
                {'☆'.repeat(5 - nota)}
            </span>
            <span className="visually-hidden">{t.mercado.estrelas(nota)}</span>
        </span>
    );
};

const Resposta = ({
    avaliacao,
    aoResponder,
}: {
    avaliacao: Avaliacao;
    aoResponder: (texto: string) => Promise<unknown>;
}) => {
    const t = useT();

    const [aberto, setAberto] = useState(false);
    const [texto, setTexto] = useState('');
    const [aEnviar, setAEnviar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    if (avaliacao.reply !== null) {
        return null;
    }

    if (!aberto) {
        return (
            <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                    setAberto(true);
                }}
            >
                {t.mercado.responderAvaliacao}
            </button>
        );
    }

    const enviar = async (evento: FormEvent) => {
        evento.preventDefault();
        setErro(null);
        setAEnviar(true);

        try {
            await aoResponder(texto);
        } catch (falha) {
            setErro(
                mensagemDoErro(falha, t, t.mercado.naoFoiPossivelResponder),
            );
        } finally {
            setAEnviar(false);
        }
    };

    return (
        <form className="resposta-avaliacao" onSubmit={enviar}>
            <div className="field">
                <label htmlFor={`resposta-${avaliacao.id}`}>
                    {t.mercado.aResposta}
                </label>
                <textarea
                    id={`resposta-${avaliacao.id}`}
                    rows={3}
                    maxLength={AVALIACAO_TEXTO_MAXIMO}
                    value={texto}
                    onChange={(evento) => {
                        setTexto(evento.target.value);
                    }}
                />
            </div>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <button
                className="primary"
                type="submit"
                disabled={aEnviar || texto.trim() === ''}
            >
                {aEnviar ? t.comum.aGuardar : t.mercado.enviarResposta}
            </button>
        </form>
    );
};

export const Avaliacoes = ({ username, userId }: AvaliacoesProps) => {
    const t = useT();
    const { idioma } = useIdioma();
    const { user } = useAuth();

    const [erro, setErro] = useState<string | null>(null);

    const pagina = useAsync(() => listReviews(username, 1), [username]);

    if (pagina.error) {
        return (
            <section className="grupo">
                <h2>{t.mercado.avaliacoes}</h2>
                <Alert kind="bad">
                    {mensagemDoErro(
                        pagina.error,
                        t,
                        t.mercado.naoCarregouAvaliacoes,
                    )}
                </Alert>
            </section>
        );
    }

    const dados = pagina.data;

    if (!dados) {
        return (
            <section className="grupo">
                <h2>{t.mercado.avaliacoes}</h2>
                <p className="hint">{t.comum.aCarregar}</p>
            </section>
        );
    }

    const euSouODono = user !== null && user.id === userId;

    /**
     * Retirar o que eu escrevi.
     *
     * Fora do JSX de propósito: lá dentro, aninhado a seis níveis, nem
     * o nome da chave de tradução cabia numa linha — e uma chave
     * partida ao meio é uma chave que o teste das órfãs não encontra.
     */
    const retirar = async (reviewId: string) => {
        setErro(null);

        try {
            await removeReview(reviewId);
            pagina.reload();
        } catch (falha) {
            const recurso = t.mercado.naoFoiPossivelRetirarAvaliacao;

            setErro(mensagemDoErro(falha, t, recurso));
        }
    };

    return (
        <section className="grupo avaliacoes">
            <h2>{t.mercado.avaliacoes}</h2>

            {/*
              A média em cima, porque é o que se lê de relance. Sem
              avaliações não há média nenhuma — e não um zero, que é uma
              nota péssima e não é o que quem ainda não vendeu merece.
            */}
            {dados.summary.average === null ? (
                <p className="hint">{t.mercado.semAvaliacoes}</p>
            ) : (
                <p className="media-avaliacoes">
                    <Estrelas nota={Math.round(dados.summary.average)} />
                    <span>
                        {t.mercado.media(
                            dados.summary.average,
                            dados.summary.count,
                        )}
                    </span>
                </p>
            )}

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <ul className="lista-avaliacoes">
                {dados.reviews.map((avaliacao) => (
                    <li key={avaliacao.id} className="card">
                        <p className="avaliacao-cabeca">
                            <Estrelas nota={avaliacao.rating} />
                            <span className="quem">
                                {avaliacao.reviewer?.username
                                    ?? t.mercado.contaApagada}
                            </span>
                            <time dateTime={avaliacao.createdAt}>
                                {new Date(
                                    avaliacao.createdAt,
                                ).toLocaleDateString(idioma)}
                            </time>
                        </p>

                        <p className="hint">
                            {t.mercado.sobreAVenda}
                            {' '}
                            <Link to={`/mercado/${avaliacao.listing.id}`}>
                                {avaliacao.listing.title}
                            </Link>
                        </p>

                        {avaliacao.body ? (
                            <p className="texto pre-linha">{avaliacao.body}</p>
                        ) : null}

                        {/*
                          A resposta de quem foi avaliado, quando existe.
                          Recuada, para se ler como o que é: a outra
                          versão da mesma história.
                        */}
                        {avaliacao.reply ? (
                            <blockquote className="resposta">
                                <p className="texto pre-linha">
                                    {avaliacao.reply}
                                </p>
                            </blockquote>
                        ) : null}

                        <div className="grupo-botoes">
                            {euSouODono ? (
                                <Resposta
                                    avaliacao={avaliacao}
                                    aoResponder={async (texto) => {
                                        await replyToReview(
                                            avaliacao.id,
                                            texto,
                                        );
                                        pagina.reload();
                                    }}
                                />
                            ) : null}

                            {/*
                              Retirar é de quem escreveu — nunca de quem
                              foi avaliado. Uma média que o dono limpa
                              não diz nada a ninguém.
                            */}
                            {user !== null
                                && avaliacao.reviewer?.id === user.id ? (
                                    <button
                                        className="btn-secondary"
                                        type="button"
                                        onClick={() =>
                                            void retirar(avaliacao.id)
                                        }
                                    >
                                        {t.mercado.retirarAvaliacao}
                                    </button>
                                ) : null}

                            {user !== null
                                && avaliacao.reviewer?.id !== user.id ? (
                                    <Denunciar
                                        aoDenunciar={(razao, nota) =>
                                            reportReview(
                                                avaliacao.id,
                                                razao,
                                                nota,
                                            )
                                        }
                                    />
                                ) : null}
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
};
