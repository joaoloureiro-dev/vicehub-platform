import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import { createEvent, listEvents, type Dono } from '../event.api.js';
import { nomeDoEstado, quando } from '../event.types.js';

/**
 * O calendário de uma crew.
 *
 * Ler exige `event:read`, criar exige `event:manage`. Como em toda a
 * aplicação, quem pode o quê descobre-se perguntando à API: um 403 na
 * leitura é a resposta, e não uma avaria.
 */
export const EventsPage = () => {
    const { crewId } = useParams<{ crewId: string }>();
    const dono: Dono = { tipo: 'crews', id: crewId as string };

    const [passados, setPassados] = useState(false);
    const [nome, setNome] = useState('');
    const [quandoComeca, setQuandoComeca] = useState('');
    const [lugares, setLugares] = useState('');
    const [descricao, setDescricao] = useState('');
    const [mensagem, setMensagem] = useState<{
        tipo: 'good' | 'bad';
        texto: string;
    } | null>(null);
    const [aCriar, setACriar] = useState(false);

    const eventos = useAsync(
        () =>
            listEvents(dono, passados ? { includePast: true } : {}).catch(
                (falha: unknown) => {
                    if (falha instanceof ApiError && falha.status === 403) {
                        return null;
                    }

                    throw falha;
                },
            ),
        [crewId, passados],
    );

    if (eventos.loading && !eventos.data) {
        return <p className="centered">A carregar…</p>;
    }

    if (eventos.data === null) {
        return (
            <div className="panel">
                <Alert kind="bad">
                    O calendário de uma crew só é visível a quem pertence a ela.
                </Alert>
                <div className="foot">
                    <Link to={`/crews/${crewId}`}>Ver a crew</Link>
                </div>
            </div>
        );
    }

    const criar = async (event: FormEvent) => {
        event.preventDefault();
        setMensagem(null);
        setACriar(true);

        try {
            await createEvent(dono, {
                name: nome.trim(),
                description: descricao.trim() || null,
                /**
                 * O campo do browser dá hora local sem fuso; convertê-la
                 * aqui evita que o servidor a leia como UTC e o evento
                 * apareça a horas erradas para quem o marcou.
                 */
                startsAt: new Date(quandoComeca).toISOString(),
                capacity: lugares ? Number(lugares) : null,
            });

            setMensagem({ tipo: 'good', texto: 'Evento marcado.' });
            setNome('');
            setQuandoComeca('');
            setLugares('');
            setDescricao('');
            eventos.reload();
        } catch (falha) {
            setMensagem({
                tipo: 'bad',
                texto:
                    falha instanceof ApiError && falha.status === 403
                        ? 'Marcar eventos é de quem gere a crew.'
                        : falha instanceof ApiError
                          ? falha.message
                          : 'Não foi possível marcar o evento.',
            });
        } finally {
            setACriar(false);
        }
    };

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>Eventos</h1>
                <Link className="btn-secondary" to={`/crews/${crewId}`}>
                    Ver a crew
                </Link>
            </div>

            <label className="filtro">
                <input
                    type="checkbox"
                    checked={passados}
                    onChange={(event) => {
                        setPassados(event.target.checked);
                    }}
                />
                Mostrar também os que já passaram
            </label>

            {mensagem ? <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert> : null}

            <section className="grupo">
                <h2>
                    {passados ? 'Todos os eventos' : 'O que está para vir'}
                </h2>

                {eventos.data.length === 0 ? (
                    <p className="vazio">
                        {passados
                            ? 'Esta crew ainda não teve eventos.'
                            : 'Nada marcado. Marca o primeiro aqui em baixo.'}
                    </p>
                ) : (
                    <ul className="movimentos">
                        {eventos.data.map((evento) => (
                            <li key={evento.id}>
                                <div className="mov-principal">
                                    <Link
                                        className="mov-desc forte"
                                        to={`/crews/${crewId}/eventos/${evento.id}`}
                                    >
                                        {evento.name}
                                    </Link>
                                </div>
                                <div className="mov-meta">
                                    <span className={`pill evento-${evento.status}`}>
                                        {nomeDoEstado(evento.status)}
                                    </span>
                                    <span>{quando(evento.startsAt)}</span>
                                    <span>
                                        {evento.signedUpCount} inscrito
                                        {evento.signedUpCount === 1 ? '' : 's'}
                                        {evento.capacity
                                            ? ` de ${evento.capacity}`
                                            : ''}
                                    </span>
                                    {evento.confirmedCount > 0 ? (
                                        <span className="confirmados">
                                            {evento.confirmedCount} com presença
                                            confirmada
                                        </span>
                                    ) : null}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="grupo">
                <h2>Marcar um evento</h2>

                <form onSubmit={criar}>
                    <div className="field">
                        <label htmlFor="nome">Nome</label>
                        <input
                            id="nome"
                            type="text"
                            value={nome}
                            onChange={(event) => {
                                setNome(event.target.value);
                            }}
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="comeca">Começa</label>
                        <input
                            id="comeca"
                            type="datetime-local"
                            value={quandoComeca}
                            onChange={(event) => {
                                setQuandoComeca(event.target.value);
                            }}
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="lugares">Lugares</label>
                        <input
                            id="lugares"
                            type="number"
                            min={1}
                            max={10000}
                            value={lugares}
                            aria-describedby="lugares-hint"
                            onChange={(event) => {
                                setLugares(event.target.value);
                            }}
                        />
                        <p className="hint" id="lugares-hint">
                            Deixa vazio para não haver limite.
                        </p>
                    </div>

                    <div className="field">
                        <label htmlFor="descricao">Descrição</label>
                        <textarea
                            id="descricao"
                            rows={3}
                            maxLength={2000}
                            value={descricao}
                            onChange={(event) => {
                                setDescricao(event.target.value);
                            }}
                        />
                    </div>

                    <button
                        className="primary"
                        type="submit"
                        disabled={aCriar || !nome.trim() || !quandoComeca}
                    >
                        {aCriar ? 'A marcar…' : 'Marcar o evento'}
                    </button>
                </form>
            </section>
        </div>
    );
};
