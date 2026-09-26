import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { useAsync } from '../../lib/use-async.js';
import { useAuth } from '../../auth/auth.context.js';
import { useT, useIdioma, useTools } from '../../i18n/i18n.js';
import { mensagemDoErro } from '../../lib/erro.js';
import {
    formatarMontante,
    separadorDoIdioma,
} from '../../treasury/treasury.types.js';
import { Denunciar } from '../../moderation/denunciar.js';
import { reportMessage } from '../../moderation/moderation.api.js';
import {
    MENSAGEM_MAXIMA,
    getConversation,
    removeMessage,
    sendMessage,
} from '../conversas.api.js';

/**
 * Uma conversa sobre um anúncio.
 *
 * **É de duas pessoas.** Quem não está nela recebe da API a mesma
 * resposta de uma conversa que não existe, e este ecrã mostra isso tal
 * e qual — não há aqui nenhum caminho que diga a um estranho que a
 * conversa existe.
 *
 * O aviso de que é privada fica em cima, antes da primeira mensagem: é
 * a espécie de coisa que se tem o direito de saber **antes** de
 * escrever, e não depois.
 */
export const ConversaPage = () => {
    const t = useT();
    const { idioma } = useIdioma();
    const { quando } = useTools();
    const { user } = useAuth();
    const { conversationId = '' } = useParams();

    const [texto, setTexto] = useState('');
    const [aEnviar, setAEnviar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const conversa = useAsync(
        () => getConversation(conversationId),
        [conversationId],
    );

    if (conversa.error) {
        return (
            <main className="panel">
                <Alert kind="bad">
                    {mensagemDoErro(
                        conversa.error,
                        t,
                        t.mercado.conversaNaoEncontrada,
                    )}
                </Alert>
                <p><Link to="/mercado/conversas">{t.mercado.conversas}</Link></p>
            </main>
        );
    }

    const dados = conversa.data;

    if (!dados) {
        return (
            <main className="panel">
                <p className="hint">{t.comum.aCarregar}</p>
            </main>
        );
    }

    const enviar = async (evento: FormEvent) => {
        evento.preventDefault();
        setErro(null);
        setAEnviar(true);

        try {
            await sendMessage(conversationId, texto);
            setTexto('');
            conversa.reload();
        } catch (falha) {
            setErro(mensagemDoErro(falha, t, t.mercado.naoFoiPossivelEnviar));
        } finally {
            setAEnviar(false);
        }
    };

    const retirar = async (messageId: string) => {
        setErro(null);

        try {
            await removeMessage(messageId);
            conversa.reload();
        } catch (falha) {
            setErro(
                mensagemDoErro(
                    falha,
                    t,
                    t.mercado.naoFoiPossivelRetirarMensagem,
                ),
            );
        }
    };

    return (
        <main className="panel wide mercado">
            <p className="hint">
                <Link className="ligacao-solta" to="/mercado/conversas">
                    {t.mercado.voltarAsConversas}
                </Link>
            </p>

            <header className="card header">
                <h1>
                    {dados.listing.isRemoved ? (
                        dados.listing.title
                    ) : (
                        <Link to={`/mercado/${dados.listing.id}`}>
                            {dados.listing.title}
                        </Link>
                    )}
                </h1>
                <p className="anuncio-preco">
                    {formatarMontante(
                        dados.listing.price,
                        separadorDoIdioma(idioma),
                    )}
                </p>
                <p className="hint">{t.mercado.conversaPrivada}</p>
            </header>

            {dados.listing.isRemoved ? (
                <Alert kind="bad">{t.mercado.anuncioRetirado}</Alert>
            ) : null}

            <ul className="fio-de-mensagens">
                {dados.messages.map((mensagem) => (
                    <li
                        key={mensagem.id}
                        className={mensagem.isMine ? 'minha' : 'dela'}
                    >
                        <p className="mensagem-cabeca hint">
                            <span>
                                {mensagem.sender?.username
                                    ?? t.mercado.contaApagada}
                            </span>
                            {/*
                              A data pela mesma regra do resto do
                              produto, e não por uma chamada escrita
                              aqui: `toLocaleString` sem opções traz os
                              **segundos**, e uma conversa com
                              "9:52:32" em cada linha conta o que
                              ninguém perguntou.
                            */}
                            <time dateTime={mensagem.createdAt}>
                                {quando(mensagem.createdAt)}
                            </time>
                        </p>

                        {/*
                          Uma mensagem vazia é o texto de quem apagou a
                          conta. A linha fica para a conversa não abrir
                          buracos: do outro lado houve alguém que a leu
                          e que respondeu a seguir.
                        */}
                        <p className="texto pre-linha">
                            {mensagem.body === ''
                                ? t.mercado.retiradaComAConta
                                : mensagem.body}
                        </p>

                        <div className="grupo-botoes">
                            {mensagem.isMine ? (
                                <button
                                    className="btn-secondary"
                                    type="button"
                                    onClick={() => void retirar(mensagem.id)}
                                >
                                    {t.mercado.retirarMensagem}
                                </button>
                            ) : (
                                <Denunciar
                                    aoDenunciar={(razao, nota) =>
                                        reportMessage(mensagem.id, razao, nota)
                                    }
                                />
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            {/*
              Sem sessão não se chega aqui — a rota pede-a —, mas o
              formulário desaparece quando o anúncio foi retirado: a API
              recusa, e um campo que aceita texto para depois o perder é
              pior do que um campo que não está lá.
            */}
            {user !== null && !dados.listing.isRemoved ? (
                <form className="anuncio-form" onSubmit={enviar}>
                    <div className="field">
                        <label htmlFor="mensagem">
                            {t.mercado.escreverMensagem}
                        </label>
                        <textarea
                            id="mensagem"
                            rows={4}
                            maxLength={MENSAGEM_MAXIMA}
                            value={texto}
                            onChange={(evento) => {
                                setTexto(evento.target.value);
                            }}
                        />
                    </div>

                    <div className="grupo-botoes">
                        <button
                            className="primary"
                            type="submit"
                            disabled={aEnviar || texto.trim() === ''}
                        >
                            {aEnviar
                                ? t.comum.aGuardar
                                : t.mercado.enviarMensagem}
                        </button>
                    </div>
                </form>
            ) : null}
        </main>
    );
};
