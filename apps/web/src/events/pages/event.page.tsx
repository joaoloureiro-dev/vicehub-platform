import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/use-async.js';
import { useAuth } from '../../auth/auth.context.js';
import { Alert } from '../../auth/components/alert.js';
import {
    confirmAttendance,
    getEvent,
    listParticipants,
    markNoShow,
    setEventStatus,
    signUp,
    withdraw,
    type Dono,
} from '../event.api.js';
import {
    nomeDaParticipacao,
    nomeDoEstado,
    quando,
    transicoesDe,
} from '../event.types.js';

/**
 * Um evento, e quem lá esteve.
 *
 * **Inscrever-se e ter presença confirmada são coisas diferentes.** Só
 * quem organiza pode afirmar que alguém esteve lá, e é essa afirmação —
 * não a inscrição — que dá direito a receber quando a crew dividir os
 * ganhos por participação. O ecrã separa as duas de propósito.
 */
/**
 * O que dizer quando já há presenças confirmadas.
 *
 * Montado antes de entrar no `Alert`, que recebe texto: é o que o faz
 * ser lido de uma vez por um leitor de ecrã, em vez de aos pedaços.
 */
const convite = (confirmados: number): string =>
    confirmados === 1
        ? '1 presença confirmada. A crew já pode dividir ganhos por participação a partir deste evento.'
        : `${confirmados} presenças confirmadas. A crew já pode dividir ganhos por participação a partir deste evento.`;

export const EventPage = () => {
    const { crewId, eventId } = useParams<{ crewId: string; eventId: string }>();
    const dono: Dono = { tipo: 'crews', id: crewId as string };
    const { user } = useAuth();

    const [pesos, setPesos] = useState<Record<string, string>>({});
    const [aAgir, setAAgir] = useState(false);
    const [mensagem, setMensagem] = useState<{
        tipo: 'good' | 'bad';
        texto: string;
    } | null>(null);

    const evento = useAsync(
        () => getEvent(dono, eventId as string),
        [crewId, eventId],
    );

    const participantes = useAsync(
        () => listParticipants(dono, eventId as string),
        [crewId, eventId],
    );

    const agir = async (acao: () => Promise<unknown>, bom: string) => {
        setMensagem(null);
        setAAgir(true);

        try {
            await acao();

            setMensagem({ tipo: 'good', texto: bom });
            evento.reload();
            participantes.reload();
        } catch (falha) {
            setMensagem({
                tipo: 'bad',
                texto:
                    falha instanceof ApiError && falha.status === 403
                        ? 'Isso é de quem organiza o evento.'
                        : falha instanceof ApiError
                          ? falha.message
                          : 'Não foi possível completar a ação.',
            });
        } finally {
            setAAgir(false);
        }
    };

    if (evento.loading && !evento.data) {
        return <p className="centered">A carregar…</p>;
    }

    if (evento.error || !evento.data) {
        return (
            <div className="panel">
                <Alert kind="bad">Não encontrámos este evento.</Alert>
                <div className="foot">
                    <Link to={`/crews/${crewId}/eventos`}>Voltar aos eventos</Link>
                </div>
            </div>
        );
    }

    const detalhe = evento.data;
    const eu = participantes.data?.find((pessoa) => pessoa.userId === user?.id);
    const inscrito = eu?.status === 'signed_up';

    /**
     * Convidar a inscrever-se só faz sentido a quem não tem lugar.
     *
     * Sem a lista completa de estados, o convite reaparecia a quem já
     * tem a presença confirmada — e clicá-lo dava um erro. Quem desistiu
     * é o único caso em que voltar a entrar é legítimo.
     */
    const podeInscrever =
        detalhe.status === 'scheduled' &&
        (eu === undefined || eu.status === 'withdrawn');

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>{detalhe.name}</h1>
                <Link className="btn-secondary" to={`/crews/${crewId}/eventos`}>
                    Todos os eventos
                </Link>
            </div>

            <dl className="stats">
                <div>
                    <dt>Estado</dt>
                    <dd className="pequeno">{nomeDoEstado(detalhe.status)}</dd>
                </div>
                <div>
                    <dt>Começa</dt>
                    <dd className="pequeno">{quando(detalhe.startsAt)}</dd>
                </div>
                <div>
                    <dt>Inscritos</dt>
                    <dd>
                        {detalhe.signedUpCount}
                        {detalhe.capacity ? ` / ${detalhe.capacity}` : ''}
                    </dd>
                </div>
                <div>
                    <dt>Confirmados</dt>
                    <dd>{detalhe.confirmedCount}</dd>
                </div>
            </dl>

            {detalhe.description ? (
                <p className="lede">{detalhe.description}</p>
            ) : null}

            {mensagem ? <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert> : null}

            <div className="actions">
                {podeInscrever ? (
                    <button
                        className="primary"
                        type="button"
                        disabled={aAgir}
                        onClick={() =>
                            void agir(
                                () => signUp(dono, detalhe.id),
                                'Inscrição feita. A presença é confirmada por quem organiza.',
                            )
                        }
                    >
                        Inscrever-me
                    </button>
                ) : null}

                {inscrito ? (
                    <>
                        <span className="pill aguarda">Inscrito</span>
                        <button
                            className="btn-secondary"
                            type="button"
                            disabled={aAgir}
                            onClick={() =>
                                void agir(
                                    () => withdraw(dono, detalhe.id),
                                    'Inscrição retirada.',
                                )
                            }
                        >
                            Retirar inscrição
                        </button>
                    </>
                ) : null}

                {eu?.status === 'confirmed' ? (
                    <span className="pill confirmado">
                        Presença confirmada · peso {eu.weight}
                    </span>
                ) : null}

                {/*
                  Só as transições que o estado atual aceita. Um evento
                  terminado não volta a decorrer, e oferecer o botão daria
                  um 400 que se lê como avaria.
                */}
                {transicoesDe(detalhe.status).map((transicao) => (
                    <button
                        key={transicao.status}
                        className={`btn-secondary${
                            transicao.status === 'canceled' ? ' perigo' : ''
                        }`}
                        type="button"
                        disabled={aAgir}
                        onClick={() =>
                            void agir(
                                () =>
                                    setEventStatus(
                                        dono,
                                        detalhe.id,
                                        transicao.status,
                                    ),
                                `Evento: ${nomeDoEstado(transicao.status).toLowerCase()}.`,
                            )
                        }
                    >
                        {transicao.nome}
                    </button>
                ))}
            </div>

            <section className="grupo">
                <h2>Quem se inscreveu</h2>
                <p className="hint">
                    Inscrever-se e ter presença confirmada são coisas diferentes.
                    Só quem organiza pode afirmar que alguém esteve lá, e é essa
                    afirmação — não a inscrição — que dá direito a receber na
                    divisão por participação.
                </p>

                {participantes.data && participantes.data.length === 0 ? (
                    <p className="vazio">Ainda não há inscrições.</p>
                ) : null}

                <ul className="pessoas">
                    {participantes.data?.map((pessoa) => (
                        <li key={pessoa.userId}>
                            <span className="nome">{pessoa.username}</span>
                            <span className="cargo">
                                {nomeDaParticipacao(pessoa.status)}
                                {pessoa.status === 'confirmed'
                                    ? ` · peso ${pessoa.weight}`
                                    : ''}
                            </span>

                            {pessoa.status === 'signed_up' ? (
                                <div className="linha-acoes">
                                    <label className="peso">
                                        <span className="sr-only">
                                            Peso de {pessoa.username}
                                        </span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={100}
                                            placeholder="1"
                                            value={pesos[pessoa.userId] ?? ''}
                                            aria-label={`Peso de ${pessoa.username}`}
                                            onChange={(event) => {
                                                setPesos((anterior) => ({
                                                    ...anterior,
                                                    [pessoa.userId]:
                                                        event.target.value,
                                                }));
                                            }}
                                        />
                                    </label>
                                    <button
                                        className="btn-secondary"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() => {
                                            const escrito = pesos[pessoa.userId];

                                            void agir(
                                                () =>
                                                    confirmAttendance(
                                                        dono,
                                                        detalhe.id,
                                                        pessoa.userId,
                                                        /*
                                                         * Sem valor, a API
                                                         * assume um. Mandar
                                                         * um peso vazio seria
                                                         * mandar lixo.
                                                         */
                                                        escrito
                                                            ? Number(escrito)
                                                            : undefined,
                                                    ),
                                                `Presença de ${pessoa.username} confirmada.`,
                                            );
                                        }}
                                    >
                                        Confirmar presença
                                    </button>
                                    <button
                                        className="btn-secondary perigo"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void agir(
                                                () =>
                                                    markNoShow(
                                                        dono,
                                                        detalhe.id,
                                                        pessoa.userId,
                                                    ),
                                                `${pessoa.username} marcado como ausente.`,
                                            )
                                        }
                                    >
                                        Não apareceu
                                    </button>
                                </div>
                            ) : null}
                        </li>
                    ))}
                </ul>
            </section>

            {detalhe.confirmedCount > 0 ? (
                <Alert kind="good">{convite(detalhe.confirmedCount)}</Alert>
            ) : null}
        </div>
    );
};
