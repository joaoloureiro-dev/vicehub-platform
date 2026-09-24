import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { useAuth } from '../../auth/auth.context.js';
import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import {
    getTopic,
    lockTopic,
    podeModerar,
    removeReply,
    removeTopic,
    replyToTopic,
    unlockTopic,
    type ForumAuthor,
} from '../forum.api.js';
import { Denunciar } from '../../moderation/denunciar.js';
import {
    reportReply,
    reportTopic,
} from '../../moderation/moderation.api.js';

/**
 * O texto de alguém, como o fórum o mostra.
 *
 * `<p>` com o texto dentro, e **nunca** `innerHTML`. É a única razão de
 * o que a pessoa escreveu poder ser guardado letra por letra, sinais de
 * maior e de menor incluídos: quem explica um erro de configuração
 * precisa de os escrever, e quem lê tem de os ver como eles são.
 *
 * O `white-space` no CSS é o que devolve as quebras de linha, que de
 * outra maneira o HTML comeria.
 */
const Texto = ({ corpo }: { corpo: string | null }) => {
    const t = useT();

    if (corpo === null) {
        return <p className="texto retirado">{t.forum.retiradoComAConta}</p>;
    }

    return <p className="texto">{corpo}</p>;
};

const Quem = ({ autor }: { autor: ForumAuthor | null }) => {
    const t = useT();

    if (autor === null) {
        return <span className="quem apagado">{t.forum.contaApagada}</span>;
    }

    return (
        <Link className="quem" to={`/u/${autor.username}`}>
            {autor.username}
        </Link>
    );
};

/**
 * Uma pergunta e as respostas dela.
 *
 * O botão de retirar aparece a quem escreveu e a quem modera. A API
 * decide a sério nos dois casos; o que o ecrã faz é não oferecer o que
 * de certeza vai ser recusado.
 *
 * Quem modera é perguntado, e só a quem tem sessão. Antes não era
 * perguntado a ninguém, e o resultado era que **a moderação não tinha
 * interface nenhuma**: existia na API e a única forma de lá chegar era
 * à mão.
 */
export const TopicPage = () => {
    const t = useT();
    const { topicId } = useParams();
    const { user } = useAuth();

    const [resposta, setResposta] = useState('');
    const [aAgir, setAAgir] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const topico = useAsync(() => getTopic(topicId as string), [topicId]);

    /**
     * Sem sessão não se pergunta: a rota exige uma, e a resposta para
     * quem não a tem já se sabe.
     */
    const moderacao = useAsync(
        () => (user === null
            ? Promise.resolve({ canModerate: false })
            : podeModerar()),
        [user],
    );

    const modero = moderacao.data?.canModerate === true;

    const agir = async (o: () => Promise<unknown>, qualErro: string) => {
        setErro(null);
        setAAgir(true);

        try {
            await o();
            topico.reload();
        } catch {
            setErro(qualErro);
        } finally {
            setAAgir(false);
        }
    };

    if (topico.error) {
        return (
            <main className="panel wide">
                <Alert kind="bad">{t.forum.naoEncontrada}</Alert>
                <p><Link to="/forum">{t.forum.voltar}</Link></p>
            </main>
        );
    }

    const dados = topico.data;

    if (!dados) {
        return (
            <main className="panel wide">
                <p className="hint">{t.comum.aCarregar}</p>
            </main>
        );
    }

    const meu = user !== null && dados.author?.id === user.id;

    return (
        <main className="panel wide">
            <p className="hint">
                <Link to="/forum">{t.forum.voltar}</Link>
            </p>

            <article className="card header forum-topico">
                <h1>{dados.title}</h1>
                <Texto corpo={dados.body} />
                <p className="topico-rodape">
                    <Quem autor={dados.author} />
                    <time dateTime={dados.createdAt}>
                        {new Date(dados.createdAt).toLocaleDateString()}
                    </time>
                    {meu || modero ? (
                        <span className="acoes">
                            <button
                                className="btn-secondary perigo"
                                type="button"
                                disabled={aAgir}
                                onClick={() =>
                                    void agir(
                                        () => removeTopic(dados.id),
                                        t.forum.naoFoiPossivelRetirar,
                                    )
                                }
                            >
                                {t.forum.retirar}
                            </button>
                            {modero ? (
                                <button
                                    className="btn-secondary"
                                    type="button"
                                    disabled={aAgir}
                                    onClick={() =>
                                        void agir(
                                            () => (dados.isLocked
                                                ? unlockTopic(dados.id)
                                                : lockTopic(dados.id)),
                                            t.forum.naoFoiPossivelFechar,
                                        )
                                    }
                                >
                                    {dados.isLocked
                                        ? t.forum.reabrir
                                        : t.forum.fechar}
                                </button>
                            ) : null}
                        </span>
                    ) : null}
                    {user !== null && !meu ? (
                        <span className="acoes">
                            <Denunciar
                                aoDenunciar={(razao, nota) =>
                                    reportTopic(dados.id, razao, nota)
                                }
                            />
                        </span>
                    ) : null}
                </p>
            </article>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            {dados.replies.length === 0 ? (
                <p className="hint">{t.forum.semRespostas}</p>
            ) : (
                <ul className="lista-respostas">
                    {dados.replies.map((umaResposta) => (
                        <li key={umaResposta.id}>
                            <Texto corpo={umaResposta.body} />
                            <p className="topico-rodape">
                                <Quem autor={umaResposta.author} />
                                <time dateTime={umaResposta.createdAt}>
                                    {new Date(
                                        umaResposta.createdAt,
                                    ).toLocaleDateString()}
                                </time>
                                {modero
                                    || (user !== null
                                        && umaResposta.author?.id === user.id) ? (
                                        <span className="acoes">
                                            <button
                                                className="btn-secondary perigo"
                                                type="button"
                                                disabled={aAgir}
                                                onClick={() =>
                                                    void agir(
                                                        () => removeReply(umaResposta.id),
                                                        t.forum.naoFoiPossivelRetirar,
                                                    )
                                                }
                                            >
                                                {t.forum.retirar}
                                            </button>
                                        </span>
                                    ) : null}
                                {user !== null
                                    && umaResposta.author?.id !== user.id ? (
                                        <span className="acoes">
                                            <Denunciar
                                                aoDenunciar={(razao, nota) =>
                                                    reportReply(
                                                        umaResposta.id,
                                                        razao,
                                                        nota,
                                                    )
                                                }
                                            />
                                        </span>
                                    ) : null}
                            </p>
                        </li>
                    ))}
                </ul>
            )}

            {dados.isLocked ? (
                <p className="hint">{t.forum.fechada}</p>
            ) : user ? (
                <form
                    className="grupo"
                    onSubmit={(evento: FormEvent) => {
                        evento.preventDefault();

                        void agir(async () => {
                            await replyToTopic(dados.id, resposta);
                            setResposta('');
                        }, t.forum.naoFoiPossivelResponder);
                    }}
                >
                    <h2>{t.forum.responder}</h2>

                    <label className="field">
                        <span className="sr-only">{t.forum.responder}</span>
                        <textarea
                            rows={5}
                            value={resposta}
                            onChange={(e) => setResposta(e.target.value)}
                            required
                        />
                    </label>

                    <button className="primary" type="submit" disabled={aAgir}>
                        {aAgir ? t.comum.aGuardar : t.forum.enviarResposta}
                    </button>
                </form>
            ) : (
                <p className="hint">
                    <Link to="/entrar">{t.forum.entrarParaPerguntar}</Link>
                </p>
            )}
        </main>
    );
};
