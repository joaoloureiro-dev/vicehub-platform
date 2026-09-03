import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { carregarCandidaturas } from '../../lib/membership.js';
import { useAsync } from '../../lib/use-async.js';
import { useAuth } from '../../auth/auth.context.js';
import { Alert } from '../../auth/components/alert.js';
import {
    acceptJoinRequest,
    getCrew,
    leaveCrew,
    listCrewMembers,
    listJoinRequests,
    listMyMemberships,
    rejectJoinRequest,
    removeMember,
    requestToJoin,
    withdrawJoinRequest,
} from '../crew.api.js';
import { nomeDoCargo } from '../crew.types.js';

/**
 * O perfil de uma crew.
 *
 * O que se pode fazer aqui depende de duas coisas: se pertences, e com
 * que cargo. A API é que decide de verdade — este ecrã limita-se a não
 * mostrar botões que iriam levar 403.
 *
 * **A lista de candidaturas é o teste.** Só quem gere membros a
 * consegue ler, e é a própria API que o diz com um 403. Em vez de
 * adivinhar o cargo a partir de outra coisa, o ecrã pede a lista e trata
 * o 403 como "não és tu que geres isto" — assim, a permissão mostrada é
 * sempre a permissão real.
 */
export const CrewPage = () => {
    const { crewId } = useParams<{ crewId: string }>();
    const { user } = useAuth();

    const [aAgir, setAAgir] = useState(false);
    const [erroAcao, setErroAcao] = useState<string | null>(null);

    const crew = useAsync(() => getCrew(crewId as string), [crewId]);
    const membros = useAsync(() => listCrewMembers(crewId as string), [crewId]);

    /**
     * A minha relação com esta crew: membro, candidato, ou nada. Só é
     * pedida quando há sessão — a quem não entrou, esta pergunta não se
     * aplica.
     */
    const adesoes = useAsync(
        () => (user ? listMyMemberships() : Promise.resolve([])),
        [crewId, user?.id],
    );

    const candidaturas = useAsync(
        () =>
            user
                ? carregarCandidaturas(() => listJoinRequests(crewId as string))
                : Promise.resolve(null),
        [crewId, user?.id],
    );

    const minhaAdesao = adesoes.data?.find((adesao) => adesao.crewId === crewId);
    const souMembro = minhaAdesao?.status === 'active';
    const souCandidato = minhaAdesao?.status === 'pending';
    const giroCandidaturas = candidaturas.data !== null;

    const agir = async (acao: () => Promise<void>) => {
        setErroAcao(null);
        setAAgir(true);

        try {
            await acao();

            crew.reload();
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

    if (crew.loading && !crew.data) {
        return <p className="centered">A carregar…</p>;
    }

    if (crew.error || !crew.data) {
        return (
            <div className="panel">
                <Alert kind="bad">Não encontrámos esta crew.</Alert>
                <div className="foot">
                    <Link to="/crews">Voltar ao diretório</Link>
                </div>
            </div>
        );
    }

    const perfil = crew.data;

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
                    <span className="crewtag grande">[{perfil.tag}]</span>
                    <h1>{perfil.name}</h1>
                    {perfil.description ? <p>{perfil.description}</p> : null}
                </div>
            </header>

            <dl className="stats">
                <div>
                    <dt>Nível</dt>
                    <dd>{perfil.level}</dd>
                </div>
                <div>
                    <dt>XP</dt>
                    <dd>{perfil.xp}</dd>
                </div>
                <div>
                    <dt>Influência</dt>
                    <dd>{perfil.influence}</dd>
                </div>
                <div>
                    <dt>Prestígio</dt>
                    <dd>{perfil.prestige}</dd>
                </div>
                <div>
                    <dt>Membros</dt>
                    <dd>{perfil.memberCount}</dd>
                </div>
            </dl>

            {erroAcao ? <Alert kind="bad">{erroAcao}</Alert> : null}

            {user ? (
                <div className="actions">
                    {!minhaAdesao ? (
                        <button
                            className="primary"
                            type="button"
                            disabled={aAgir}
                            onClick={() => void agir(() => requestToJoin(perfil.id))}
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
                                    void agir(() => withdrawJoinRequest(perfil.id))
                                }
                            >
                                Retirar candidatura
                            </button>
                        </>
                    ) : null}

                    {souMembro ? (
                        <>
                            <span className="pill">
                                {nomeDoCargo(minhaAdesao.role)}
                            </span>
                            <Link
                                className="btn-secondary"
                                to={`/crews/${perfil.id}/tesouraria`}
                            >
                                Tesouraria
                            </Link>
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={aAgir}
                                onClick={() => void agir(() => leaveCrew(perfil.id))}
                            >
                                Sair da crew
                            </button>
                        </>
                    ) : null}
                </div>
            ) : (
                <p className="hint">
                    <Link to="/entrar">Entra</Link> para te candidatares a esta crew.
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
                                                acceptJoinRequest(
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
                                                rejectJoinRequest(
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
                <h2>Membros</h2>

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
                                                removeMember(perfil.id, membro.userId),
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
