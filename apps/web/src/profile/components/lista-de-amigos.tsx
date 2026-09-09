import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/use-async.js';
import { useIdioma, useT } from '../../i18n/i18n.js';
import {
    acceptFriend,
    listFriendRequests,
    listFriends,
    removeFriend,
} from '../friends.api.js';

/**
 * Os amigos, e quem está à espera de resposta.
 *
 * Os pedidos por responder vêm primeiro e só os que **me** foram feitos
 * têm botões: um pedido meu está à espera da outra pessoa, e pôr-lhe um
 * botão de aceitar seria deixar-me aceitar-me a mim próprio — coisa que
 * a API recusa e que o ecrã não deve sequer oferecer.
 */
export const ListaDeAmigos = () => {
    const t = useT();
    const { idioma } = useIdioma();

    const [erro, setErro] = useState<string | null>(null);
    const [aAgir, setAAgir] = useState(false);

    const amigos = useAsync(() => listFriends(), []);
    const pedidos = useAsync(() => listFriendRequests(), []);

    const agir = async (acao: () => Promise<unknown>) => {
        setErro(null);
        setAAgir(true);

        try {
            await acao();
            amigos.reload();
            pedidos.reload();
        } catch (falha) {
            setErro(
                falha instanceof ApiError ? falha.message : t.comum.naoFoiPossivel,
            );
        } finally {
            setAAgir(false);
        }
    };

    if (amigos.error || pedidos.error) {
        return (
            <section className="grupo">
                <h2>{t.amigos.titulo}</h2>
                <Alert kind="bad">{t.amigos.naoCarregou}</Alert>
            </section>
        );
    }

    const porResponder
        = pedidos.data?.filter((pedido) => pedido.direction === 'incoming') ?? [];

    return (
        <section className="grupo">
            <h2>{t.amigos.titulo}</h2>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            {porResponder.length > 0 ? (
                <>
                    <h3 className="subtitulo">{t.amigos.pedidos}</h3>
                    <ul className="amigos">
                        {porResponder.map((pedido) => (
                            <li key={pedido.userId}>
                                <Link to={`/u/${pedido.username}`}>
                                    {pedido.username}
                                </Link>
                                <span className="actions">
                                    <button
                                        className="primary"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void agir(() => acceptFriend(pedido.userId))
                                        }
                                    >
                                        {t.amigos.aceitar}
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void agir(() => removeFriend(pedido.userId))
                                        }
                                    >
                                        {t.amigos.recusar}
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            ) : null}

            {amigos.data && amigos.data.length === 0 ? (
                <p className="hint">{t.amigos.aindaNenhum}</p>
            ) : (
                <ul className="amigos">
                    {(amigos.data ?? []).map((amigo) => (
                        <li key={amigo.userId}>
                            <Link to={`/u/${amigo.username}`}>{amigo.username}</Link>
                            <span className="amigo-desde">
                                {t.amigos.desde(
                                    new Date(amigo.since).toLocaleDateString(idioma),
                                )}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};
