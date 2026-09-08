import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import { listServers } from '../../servers/server.api.js';
import {
    cancelAffiliationRequest,
    getCrewAffiliation,
    leaveServer,
    requestAffiliation,
} from '../affiliation.api.js';

interface CrewAffiliationProps {
    crewId: string;
    /** Se quem está a ver manda na crew. */
    podeGerir: boolean;
}

/**
 * O servidor onde a crew joga.
 *
 * A ligação não é uma declaração da crew: é um pedido que quem manda no
 * servidor tem de aceitar. Por isso este painel mostra três estados
 * diferentes — sem servidor, com pedido por responder, e a jogar — em
 * vez de um campo para escrever.
 */
export const CrewAffiliation = ({ crewId, podeGerir }: CrewAffiliationProps) => {
    const t = useT();

    const filiacao = useAsync(() => getCrewAffiliation(crewId), [crewId]);

    const [procura, setProcura] = useState('');
    const [escolhido, setEscolhido] = useState<string | null>(null);
    const [aAgir, setAAgir] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const resultados = useAsync(
        () =>
            procura.trim().length >= 2
                ? listServers({ search: procura.trim() })
                : Promise.resolve(null),
        [procura],
    );

    const agir = async (acao: () => Promise<void>) => {
        setErro(null);
        setAAgir(true);

        try {
            await acao();

            setProcura('');
            setEscolhido(null);
            filiacao.reload();
        } catch (falha) {
            setErro(
                falha instanceof ApiError ? falha.message : t.comum.naoFoiPossivel,
            );
        } finally {
            setAAgir(false);
        }
    };

    const pedir = (event: FormEvent) => {
        event.preventDefault();

        if (escolhido) {
            void agir(() => requestAffiliation(crewId, escolhido));
        }
    };

    if (filiacao.loading && !filiacao.data) {
        return null;
    }

    const estado = filiacao.data;

    if (!estado) {
        return null;
    }

    return (
        <section className="grupo">
            <h2>{t.filiacao.titulo}</h2>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            {estado.server ? (
                <>
                    <p>
                        {t.filiacao.jogaEm}{' '}
                        <Link to={`/servidores/${estado.server.id}`}>
                            {estado.server.name}
                        </Link>
                    </p>

                    {podeGerir ? (
                        <div className="linha-acoes">
                            <button
                                className="btn-secondary perigo"
                                type="button"
                                disabled={aAgir}
                                onClick={() => void agir(() => leaveServer(crewId))}
                            >
                                {t.filiacao.sair}
                            </button>
                        </div>
                    ) : null}
                </>
            ) : estado.pending ? (
                <>
                    <p>
                        {t.filiacao.pedidoEnviado}{' '}
                        <Link to={`/servidores/${estado.pending.id}`}>
                            {estado.pending.name}
                        </Link>
                    </p>

                    {podeGerir ? (
                        <div className="linha-acoes">
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={aAgir}
                                onClick={() =>
                                    void agir(() => cancelAffiliationRequest(crewId))
                                }
                            >
                                {t.filiacao.desistir}
                            </button>
                        </div>
                    ) : null}
                </>
            ) : (
                <>
                    <p className="hint">{t.filiacao.semServidor}</p>

                    {podeGerir ? (
                        <form onSubmit={pedir}>
                            <div className="field">
                                <label htmlFor="filiacao-procura">
                                    {t.filiacao.procurar}
                                </label>
                                <input
                                    id="filiacao-procura"
                                    type="search"
                                    value={procura}
                                    onChange={(event) => {
                                        setProcura(event.target.value);
                                        setEscolhido(null);
                                    }}
                                />
                            </div>

                            {resultados.data && resultados.data.items.length > 0 ? (
                                <ul className="pessoas">
                                    {resultados.data.items.map((servidor) => (
                                        <li key={servidor.id}>
                                            <label className="filtro">
                                                <input
                                                    type="radio"
                                                    name="filiacao-servidor"
                                                    value={servidor.id}
                                                    checked={escolhido === servidor.id}
                                                    onChange={() => {
                                                        setEscolhido(servidor.id);
                                                    }}
                                                />
                                                {servidor.name}
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}

                            {resultados.data && resultados.data.items.length === 0 ? (
                                <p className="hint">{t.filiacao.semResultados}</p>
                            ) : null}

                            <button
                                className="primary"
                                type="submit"
                                disabled={aAgir || escolhido === null}
                            >
                                {t.filiacao.pedir}
                            </button>
                        </form>
                    ) : null}
                </>
            )}
        </section>
    );
};
