import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import { getCrew } from '../../crews/crew.api.js';
import {
    approveMovement,
    cancelMovement,
    getTreasury,
    listDistributions,
    proposeMovement,
    rejectMovement,
    type Dono,
} from '../treasury.api.js';
import {
    formatarMontante,
    nomeDaBase,
    nomeDoEstado,
    tamanhoDoSaldo,
    type MovementCategory,
    type MovementDirection,
} from '../treasury.types.js';
import { MovementRow } from '../components/movement-row.js';

const CATEGORIAS: { valor: MovementCategory; nome: string }[] = [
    { valor: 'contribution', nome: 'Contribuição' },
    { valor: 'server_costs', nome: 'Custos do servidor' },
    { valor: 'marketing', nome: 'Marketing' },
    { valor: 'event', nome: 'Evento' },
    { valor: 'prize', nome: 'Prémio' },
    { valor: 'service', nome: 'Serviço' },
    { valor: 'payout', nome: 'Pagamento' },
    { valor: 'other', nome: 'Outro' },
];

/** O que a API aceita: inteiro positivo, até 19 dígitos. */
const MONTANTE_VALIDO = /^[1-9][0-9]{0,18}$/;

/**
 * A tesouraria de uma crew.
 *
 * O que aqui se propõe **não move nada**. Fica por decidir até alguém
 * com autoridade aprovar, e é nesse momento que o saldo muda — ou toda a
 * gente é paga, ou não é paga ninguém.
 */
export const TreasuryPage = () => {
    const { crewId } = useParams<{ crewId: string }>();
    const dono: Dono = { tipo: 'crews', id: crewId as string };

    const [montante, setMontante] = useState('');
    const [direcao, setDirecao] = useState<MovementDirection>('credit');
    const [categoria, setCategoria] = useState<MovementCategory>('contribution');
    const [descricao, setDescricao] = useState('');

    const [mensagem, setMensagem] = useState<{
        tipo: 'good' | 'bad';
        texto: string;
    } | null>(null);
    const [aAgir, setAAgir] = useState(false);

    const crew = useAsync(() => getCrew(crewId as string), [crewId]);

    /**
     * Ler a tesouraria exige `treasury:read`. Um 403 aqui é a resposta —
     * quem não pertence à crew não vê as contas dela — e não uma avaria.
     */
    const tesouraria = useAsync(
        () =>
            getTreasury(dono).catch((falha: unknown) => {
                if (falha instanceof ApiError && falha.status === 403) {
                    return null;
                }

                throw falha;
            }),
        [crewId],
    );

    const divisoes = useAsync(
        () =>
            listDistributions(crewId as string).catch((falha: unknown) => {
                if (falha instanceof ApiError && falha.status === 403) {
                    return null;
                }

                throw falha;
            }),
        [crewId],
    );

    const montanteMau = montante.length > 0 && !MONTANTE_VALIDO.test(montante);

    const agir = async (acao: () => Promise<unknown>, bom: string) => {
        setMensagem(null);
        setAAgir(true);

        try {
            await acao();

            setMensagem({ tipo: 'good', texto: bom });
            tesouraria.reload();
            divisoes.reload();
        } catch (falha) {
            setMensagem({
                tipo: 'bad',
                texto:
                    falha instanceof ApiError
                        ? falha.message
                        : 'Não foi possível completar a operação.',
            });
        } finally {
            setAAgir(false);
        }
    };

    if (tesouraria.loading && !tesouraria.data) {
        return <p className="centered">A carregar…</p>;
    }

    if (tesouraria.data === null) {
        return (
            <div className="panel">
                <Alert kind="bad">
                    As contas de uma crew só são visíveis a quem pertence a ela.
                </Alert>
                <div className="foot">
                    <Link to={`/crews/${crewId}`}>Ver a crew</Link>
                </div>
            </div>
        );
    }

    const contas = tesouraria.data;

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>Tesouraria</h1>
                <Link className="btn-secondary" to={`/crews/${crewId}`}>
                    {crew.data ? crew.data.name : 'Ver a crew'}
                </Link>
            </div>

            {/*
              Quatro saldos, e não um. Sem os três primeiros ninguém sabe
              quanto pode gastar: o liquidado não desconta o que já foi
              autorizado a sair, e comprometer duas vezes o mesmo dinheiro
              é o erro que se segue.
            */}
            <dl className="saldos">
                <div className="principal">
                    <dt>Disponível</dt>
                    <dd style={{ fontSize: tamanhoDoSaldo(contas.balances.available) }}>
                        {formatarMontante(contas.balances.available)}
                    </dd>
                </div>
                <div>
                    <dt>Liquidado</dt>
                    <dd>{formatarMontante(contas.balances.settled)}</dd>
                </div>
                <div>
                    <dt>A entrar</dt>
                    <dd className="credit">
                        {formatarMontante(contas.balances.pendingIn)}
                    </dd>
                </div>
                <div>
                    <dt>A sair</dt>
                    <dd className="debit">
                        {formatarMontante(contas.balances.pendingOut)}
                    </dd>
                </div>
            </dl>

            <p className="hint">
                O disponível já desconta as saídas por decidir. É esse o número
                que diz quanto se pode comprometer sem contar duas vezes o mesmo
                dinheiro.
            </p>

            {mensagem ? (
                <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert>
            ) : null}

            <section className="grupo">
                <h2>Propor um movimento</h2>
                <p className="hint">
                    Nada se move ao propor. Fica por decidir até alguém com
                    autoridade aprovar.
                </p>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();

                        void agir(
                            () =>
                                proposeMovement(dono, {
                                    amount: montante,
                                    direction: direcao,
                                    category: categoria,
                                    description: descricao.trim(),
                                }),
                            'Movimento proposto. Fica à espera de decisão.',
                        ).then(() => {
                            setMontante('');
                            setDescricao('');
                        });
                    }}
                >
                    <div className="field">
                        <label htmlFor="montante">Montante</label>
                        <input
                            id="montante"
                            type="text"
                            inputMode="numeric"
                            value={montante}
                            aria-invalid={montanteMau}
                            aria-describedby="montante-hint"
                            onChange={(event) => {
                                setMontante(event.target.value);
                            }}
                        />
                        <p className="hint" id="montante-hint">
                            Em unidades inteiras da moeda do jogo.
                        </p>
                    </div>

                    <div className="field">
                        <label htmlFor="direcao">Direção</label>
                        <select
                            id="direcao"
                            value={direcao}
                            onChange={(event) => {
                                setDirecao(event.target.value as MovementDirection);
                            }}
                        >
                            <option value="credit">Entrada</option>
                            <option value="debit">Saída</option>
                        </select>
                    </div>

                    <div className="field">
                        <label htmlFor="categoria">Categoria</label>
                        <select
                            id="categoria"
                            value={categoria}
                            onChange={(event) => {
                                setCategoria(event.target.value as MovementCategory);
                            }}
                        >
                            {CATEGORIAS.map((opcao) => (
                                <option key={opcao.valor} value={opcao.valor}>
                                    {opcao.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="field">
                        <label htmlFor="descricao">Descrição</label>
                        <input
                            id="descricao"
                            type="text"
                            maxLength={280}
                            value={descricao}
                            onChange={(event) => {
                                setDescricao(event.target.value);
                            }}
                        />
                    </div>

                    <button
                        className="primary"
                        type="submit"
                        disabled={
                            aAgir || montanteMau || !montante || !descricao.trim()
                        }
                    >
                        {aAgir ? 'A propor…' : 'Propor o movimento'}
                    </button>
                </form>
            </section>

            <section className="grupo">
                <h2>Extrato</h2>

                {contas.movements.length === 0 ? (
                    <p className="vazio">Ainda não há movimentos.</p>
                ) : (
                    <ul className="movimentos">
                        {contas.movements.map((movimento) => (
                            <MovementRow
                                key={movimento.id}
                                movimento={movimento}
                                acoes={
                                    movimento.status === 'pending' ? (
                                        <>
                                            <button
                                                className="btn-secondary"
                                                type="button"
                                                disabled={aAgir}
                                                onClick={() =>
                                                    void agir(
                                                        () =>
                                                            approveMovement(
                                                                dono,
                                                                movimento.id,
                                                            ),
                                                        'Movimento aprovado.',
                                                    )
                                                }
                                            >
                                                Aprovar
                                            </button>
                                            <button
                                                className="btn-secondary perigo"
                                                type="button"
                                                disabled={aAgir}
                                                onClick={() =>
                                                    void agir(
                                                        () =>
                                                            rejectMovement(
                                                                dono,
                                                                movimento.id,
                                                            ),
                                                        'Movimento recusado.',
                                                    )
                                                }
                                            >
                                                Recusar
                                            </button>
                                            <button
                                                className="btn-secondary"
                                                type="button"
                                                disabled={aAgir}
                                                onClick={() =>
                                                    void agir(
                                                        () =>
                                                            cancelMovement(
                                                                dono,
                                                                movimento.id,
                                                            ),
                                                        'Proposta cancelada.',
                                                    )
                                                }
                                            >
                                                Cancelar
                                            </button>
                                        </>
                                    ) : undefined
                                }
                            />
                        ))}
                    </ul>
                )}
            </section>

            {divisoes.data && divisoes.data.length > 0 ? (
                <section className="grupo">
                    <h2>Divisões de ganhos</h2>
                    <ul className="movimentos">
                        {divisoes.data.map((divisao) => (
                            <li key={divisao.id} className="divisao">
                                <div className="mov-principal">
                                    <span className="mov-valor credit">
                                        {formatarMontante(divisao.total)}
                                    </span>
                                    <span className="mov-desc">
                                        {nomeDaBase(divisao.basis)}
                                    </span>
                                </div>
                                <div className="mov-meta">
                                    <span className={`pill estado-${divisao.status}`}>
                                        {nomeDoEstado(divisao.status)}
                                    </span>
                                    <span>
                                        {divisao.lines.length}{' '}
                                        {divisao.lines.length === 1
                                            ? 'pessoa'
                                            : 'pessoas'}
                                    </span>
                                </div>
                                {divisao.note ? (
                                    <p className="hint">{divisao.note}</p>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </div>
    );
};
