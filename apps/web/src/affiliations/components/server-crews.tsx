import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import {
    acceptAffiliation,
    listAffiliationRequests,
    listServerCrews,
    rejectAffiliation,
    removeAffiliation,
} from '../affiliation.api.js';

interface ServerCrewsProps {
    serverId: string;
    /** Se quem está a ver manda no servidor. */
    podeGerir: boolean;
}

/**
 * As crews que jogam no servidor, e as que pediram para jogar.
 *
 * A lista das que jogam é pública — faz parte do que o servidor mostra
 * de si. Os pedidos por responder só existem para quem gere o servidor,
 * e a API recusa-os a mais alguém: o painel não os pede sequer.
 */
export const ServerCrews = ({ serverId, podeGerir }: ServerCrewsProps) => {
    const t = useT();

    const crews = useAsync(() => listServerCrews(serverId), [serverId]);
    const pedidos = useAsync(
        () =>
            podeGerir
                ? listAffiliationRequests(serverId)
                : Promise.resolve([]),
        [serverId, podeGerir],
    );

    const [aAgir, setAAgir] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const agir = async (acao: () => Promise<void>) => {
        setErro(null);
        setAAgir(true);

        try {
            await acao();

            crews.reload();
            pedidos.reload();
        } catch (falha) {
            setErro(
                falha instanceof ApiError ? falha.message : t.comum.naoFoiPossivel,
            );
        } finally {
            setAAgir(false);
        }
    };

    return (
        <section className="grupo">
            <h2>{t.filiacao.crewsDoServidor}</h2>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            {crews.data && crews.data.length > 0 ? (
                <ul className="pessoas">
                    {crews.data.map((crew) => (
                        <li key={crew.crewId}>
                            <span className="nome">
                                <Link to={`/crews/${crew.crewId}`}>
                                    <span className="crewtag">[{crew.crewTag}]</span>{' '}
                                    {crew.crewName}
                                </Link>
                            </span>

                            {podeGerir ? (
                                <div className="linha-acoes">
                                    <button
                                        className="btn-secondary perigo"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void agir(() =>
                                                removeAffiliation(
                                                    serverId,
                                                    crew.crewId,
                                                ),
                                            )
                                        }
                                    >
                                        {t.filiacao.remover}
                                    </button>
                                </div>
                            ) : null}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="hint">{t.filiacao.semCrews}</p>
            )}

            {podeGerir && pedidos.data && pedidos.data.length > 0 ? (
                <>
                    <h3>{t.filiacao.pedidos}</h3>

                    <ul className="pessoas">
                        {pedidos.data.map((pedido) => (
                            <li key={pedido.crewId}>
                                <span className="nome">
                                    <Link to={`/crews/${pedido.crewId}`}>
                                        <span className="crewtag">
                                            [{pedido.crewTag}]
                                        </span>{' '}
                                        {pedido.crewName}
                                    </Link>
                                </span>

                                <div className="linha-acoes">
                                    <button
                                        className="btn-secondary"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void agir(() =>
                                                acceptAffiliation(
                                                    serverId,
                                                    pedido.crewId,
                                                ),
                                            )
                                        }
                                    >
                                        {t.filiacao.aceitar}
                                    </button>

                                    <button
                                        className="btn-secondary perigo"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void agir(() =>
                                                rejectAffiliation(
                                                    serverId,
                                                    pedido.crewId,
                                                ),
                                            )
                                        }
                                    >
                                        {t.filiacao.recusar}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            ) : null}
        </section>
    );
};
