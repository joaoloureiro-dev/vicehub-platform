import { useState } from 'react';

import { Alert } from '../../auth/components/alert.js';
import { ApiError } from '../../lib/api.js';
import { useT } from '../../i18n/i18n.js';
import {
    acceptFriend,
    removeFriend,
    requestFriend,
    type Friend,
    type FriendRequest,
} from '../friends.api.js';

interface BotaoDeAmizadeProps {
    /** De quem é o perfil que está no ecrã. */
    userId: string;

    amigos: Friend[] | null;
    pedidos: FriendRequest[] | null;

    aoMudar: () => void;
}

/**
 * O que se pode fazer com esta pessoa.
 *
 * O estado sai das listas que a API já devolve — amigos e pedidos por
 * responder — e não de um campo inventado no perfil: assim o botão
 * mostra sempre o que a API diria se lhe perguntassem outra vez.
 *
 * Quatro estados, e cada um oferece uma coisa só:
 * nada → pedir; pedido meu → retirar; pedido dele → aceitar ou recusar;
 * amigos → desfazer.
 */
export const BotaoDeAmizade = ({
    userId,
    amigos,
    pedidos,
    aoMudar,
}: BotaoDeAmizadeProps) => {
    const t = useT();

    const [aAgir, setAAgir] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    /*
      Enquanto as listas não chegam, não se mostra nada: um botão que diz
      a coisa errada por meio segundo é pior do que um botão que aparece
      meio segundo depois.
    */
    if (amigos === null || pedidos === null) {
        return null;
    }

    const jaAmigo = amigos.some((amigo) => amigo.userId === userId);
    const pedido = pedidos.find((cada) => cada.userId === userId);

    const agir = async (acao: () => Promise<unknown>) => {
        setErro(null);
        setAAgir(true);

        try {
            await acao();
            aoMudar();
        } catch (falha) {
            setErro(
                falha instanceof ApiError ? falha.message : t.comum.naoFoiPossivel,
            );
        } finally {
            setAAgir(false);
        }
    };

    return (
        <div className="amizade">
            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <div className="actions">
                {jaAmigo ? (
                    <>
                        <span className="pill">{t.amigos.saoAmigos}</span>
                        <button
                            className="btn-secondary perigo"
                            type="button"
                            disabled={aAgir}
                            onClick={() => void agir(() => removeFriend(userId))}
                        >
                            {t.amigos.desfazer}
                        </button>
                    </>
                ) : pedido?.direction === 'incoming' ? (
                    <>
                        <button
                            className="primary"
                            type="button"
                            disabled={aAgir}
                            onClick={() => void agir(() => acceptFriend(userId))}
                        >
                            {t.amigos.aceitar}
                        </button>
                        <button
                            className="btn-secondary"
                            type="button"
                            disabled={aAgir}
                            onClick={() => void agir(() => removeFriend(userId))}
                        >
                            {t.amigos.recusar}
                        </button>
                    </>
                ) : pedido?.direction === 'outgoing' ? (
                    <>
                        <span className="pill">{t.amigos.pedidoEnviado}</span>
                        <button
                            className="btn-secondary"
                            type="button"
                            disabled={aAgir}
                            onClick={() => void agir(() => removeFriend(userId))}
                        >
                            {t.amigos.retirar}
                        </button>
                    </>
                ) : (
                    <button
                        className="primary"
                        type="button"
                        disabled={aAgir}
                        onClick={() => void agir(() => requestFriend(userId))}
                    >
                        {t.amigos.adicionar}
                    </button>
                )}
            </div>
        </div>
    );
};
