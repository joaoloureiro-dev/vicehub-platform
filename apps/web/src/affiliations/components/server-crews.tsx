import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import {
    acceptAffiliation,
    getCrewAllowance,
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

    /**
     * A folga do plano só existe para quem gere: a API recusa-a a mais
     * alguém, e o escalão que um servidor paga não é assunto de quem
     * passa por lá.
     */
    const folga = useAsync(
        () =>
            podeGerir
                ? getCrewAllowance(serverId)
                : Promise.resolve(null),
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
            folga.reload();
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

            {/*
              A conta do plano fica **acima** da lista e dos pedidos,
              onde quem gere olha antes de responder a alguém. Dizer-lhe
              que está cheio depois de carregar em aceitar, num erro,
              seria dizer-lho tarde.

              Um servidor pode estar acima do limite sem que nada esteja
              errado — o plano acabou, ou desceu de escalão, e as crews
              que já lá jogavam ficaram. Por isso a frase conta o que
              tem, e o aviso só aparece quando não pode aceitar mais.
            */}
            {folga.data ? (
                <p className="hint">
                    {folga.data.limit === null
                        ? t.filiacao.crewsSemLimite(folga.data.used)
                        : t.filiacao.crewsDoPlano(
                              folga.data.used,
                              folga.data.limit,
                          )}
                </p>
            ) : null}

            {folga.data && !folga.data.canAcceptMore ? (
                <>
                    <Alert kind="bad">{t.filiacao.planoCheio}</Alert>
                    {/*
                      O escalão é **do servidor**, e não de quem o gere:
                      daí o link levar o identificador dele. Sem isso,
                      quem carregasse comprava para si próprio e o
                      servidor continuava cheio.
                    */}
                    <Link
                        className="link-premium"
                        to={`/premium?servidor=${encodeURIComponent(serverId)}`}
                    >
                        {t.filiacao.verEscaloes}
                    </Link>
                </>
            ) : null}

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
                                    {/*
                                      Sem lugar no plano, o botão fica
                                      desligado: a API responde 402 e o
                                      aviso está logo acima, mas deixar
                                      carregar num botão que só pode
                                      recusar é fazer alguém descobrir
                                      pela via difícil o que já lhe
                                      estava escrito.
                                    */}
                                    <button
                                        className="btn-secondary"
                                        type="button"
                                        disabled={
                                            aAgir
                                            || folga.data?.canAcceptMore === false
                                        }
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
