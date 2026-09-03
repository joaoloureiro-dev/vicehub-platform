import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { carregarCandidaturas } from '../../lib/membership.js';
import { useAsync } from '../../lib/use-async.js';
import { useAuth } from '../../auth/auth.context.js';
import { Alert } from '../../auth/components/alert.js';
import {
    acceptServerJoinRequest,
    getServer,
    leaveServer,
    listMyServerMemberships,
    listServerJoinRequests,
    listServerMembers,
    rejectServerJoinRequest,
    removeServerMember,
    requestToJoinServer,
    withdrawServerJoinRequest,
} from '../server.api.js';
import { nomeDoCargo } from '../server.types.js';

/**
 * O perfil de um servidor.
 *
 * Segue o ecrã de uma crew, incluindo a forma de descobrir quem gere
 * membros: pergunta-se à API e o 403 é a resposta. A mecânica vive em
 * `lib/membership.ts` para que as duas não possam divergir.
 */
export const ServerPage = () => {
    const { serverId } = useParams<{ serverId: string }>();
    const { user } = useAuth();

    const [aAgir, setAAgir] = useState(false);
    const [erroAcao, setErroAcao] = useState<string | null>(null);

    const servidor = useAsync(() => getServer(serverId as string), [serverId]);
    const membros = useAsync(() => listServerMembers(serverId as string), [serverId]);

    const adesoes = useAsync(
        () => (user ? listMyServerMemberships() : Promise.resolve([])),
        [serverId, user?.id],
    );

    const candidaturas = useAsync(
        () =>
            user
                ? carregarCandidaturas(() =>
                      listServerJoinRequests(serverId as string),
                  )
                : Promise.resolve(null),
        [serverId, user?.id],
    );

    const minhaAdesao = adesoes.data?.find(
        (adesao) => adesao.serverId === serverId,
    );
    const souMembro = minhaAdesao?.status === 'active';
    const souCandidato = minhaAdesao?.status === 'pending';
    const giroCandidaturas = candidaturas.data !== null;

    const agir = async (acao: () => Promise<void>) => {
        setErroAcao(null);
        setAAgir(true);

        try {
            await acao();

            servidor.reload();
            membros.reload();
            adesoes.reload();
            candidaturas.reload();
        } catch (falha) {
            setErroAcao(
                falha instanceof ApiError
                    ? falha.message
                    : 'Não foi possível completar a ação.',
            );
        } finally {
            setAAgir(false);
        }
    };

    if (servidor.loading && !servidor.data) {
        return <p className="centered">A carregar…</p>;
    }

    if (servidor.error || !servidor.data) {
        return (
            <div className="panel">
                <Alert kind="bad">Não encontrámos este servidor.</Alert>
                <div className="foot">
                    <Link to="/servidores">Voltar ao diretório</Link>
                </div>
            </div>
        );
    }

    const perfil = servidor.data;

    return (
        <div className="panel wide">
            <header
                className="crewhead"
                style={
                    perfil.appearance.accentColor
                        ? { borderColor: perfil.appearance.accentColor }
                        : undefined
                }
            >
                {perfil.appearance.bannerUrl ? (
                    <img className="banner" src={perfil.appearance.bannerUrl} alt="" />
                ) : null}

                <div className="crewhead-body">
                    <span className={`estadotexto ${perfil.isOnline ? 'online' : ''}`}>
                        <span
                            className={`estado ${perfil.isOnline ? 'online' : 'offline'}`}
                            aria-hidden="true"
                        />
                        {perfil.isOnline ? 'Online' : 'Offline'}
                        {perfil.region ? ` · ${perfil.region}` : ''}
                    </span>
                    <h1>{perfil.name}</h1>
                    {perfil.description ? <p>{perfil.description}</p> : null}
                </div>
            </header>

            {erroAcao ? <Alert kind="bad">{erroAcao}</Alert> : null}

            {user ? (
                <div className="actions">
                    {!minhaAdesao ? (
                        <button
                            className="primary"
                            type="button"
                            disabled={aAgir}
                            onClick={() =>
                                void agir(() => requestToJoinServer(perfil.id))
                            }
                        >
                            Pedir para entrar
                        </button>
                    ) : null}

                    {souCandidato ? (
                        <>
                            <span className="pill aguarda">Candidatura enviada</span>
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={aAgir}
                                onClick={() =>
                                    void agir(() =>
                                        withdrawServerJoinRequest(perfil.id),
                                    )
                                }
                            >
                                Retirar candidatura
                            </button>
                        </>
                    ) : null}

                    {souMembro ? (
                        <>
                            <span className="pill">{nomeDoCargo(minhaAdesao.role)}</span>
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={aAgir}
                                onClick={() => void agir(() => leaveServer(perfil.id))}
                            >
                                Sair do servidor
                            </button>
                        </>
                    ) : null}
                </div>
            ) : (
                <p className="hint">
                    <Link to="/entrar">Entra</Link> para te candidatares a este
                    servidor.
                </p>
            )}

            {giroCandidaturas && candidaturas.data && candidaturas.data.length > 0 ? (
                <section className="grupo">
                    <h2>Candidaturas por responder</h2>
                    <ul className="pessoas">
                        {candidaturas.data.map((pedido) => (
                            <li key={pedido.userId}>
                                <span className="nome">{pedido.username}</span>
                                <div className="linha-acoes">
                                    <button
                                        className="btn-secondary"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void agir(() =>
                                                acceptServerJoinRequest(
                                                    perfil.id,
                                                    pedido.userId,
                                                ),
                                            )
                                        }
                                    >
                                        Aceitar
                                    </button>
                                    <button
                                        className="btn-secondary perigo"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void agir(() =>
                                                rejectServerJoinRequest(
                                                    perfil.id,
                                                    pedido.userId,
                                                ),
                                            )
                                        }
                                    >
                                        Recusar
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <section className="grupo">
                <h2>Membros ({perfil.memberCount})</h2>

                {membros.loading && !membros.data ? (
                    <p className="hint">A carregar…</p>
                ) : null}

                <ul className="pessoas">
                    {membros.data?.map((membro) => (
                        <li key={membro.userId}>
                            <span className="nome">{membro.username}</span>
                            <span className="cargo">{nomeDoCargo(membro.role)}</span>

                            {giroCandidaturas && membro.userId !== user?.id ? (
                                <div className="linha-acoes">
                                    <button
                                        className="btn-secondary perigo"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void agir(() =>
                                                removeServerMember(
                                                    perfil.id,
                                                    membro.userId,
                                                ),
                                            )
                                        }
                                    >
                                        Remover
                                    </button>
                                </div>
                            ) : null}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
};
