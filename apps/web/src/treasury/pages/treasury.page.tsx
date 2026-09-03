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
import { useIdioma, useT } from '../../i18n/i18n.js';
import {
    formatarMontante,
    separadorDoIdioma,
    tamanhoDoSaldo,
    type MovementCategory,
    type MovementDirection,
} from '../treasury.types.js';
import { MovementRow } from '../components/movement-row.js';

const CATEGORIAS: MovementCategory[] = [
    'contribution',
    'server_costs',
    'marketing',
    'event',
    'prize',
    'service',
    'payout',
    'other',
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
    const t = useT();
    const { idioma } = useIdioma();
    const separador = separadorDoIdioma(idioma);
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
                        : t.tesouraria.naoFoiPossivel,
            });
        } finally {
            setAAgir(false);
        }
    };

    if (tesouraria.loading && !tesouraria.data) {
        return <p className="centered">{t.comum.aCarregar}</p>;
    }

    if (tesouraria.data === null) {
        return (
            <div className="panel">
                <Alert kind="bad">{t.tesouraria.soParaMembros}</Alert>
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
                <h1>{t.tesouraria.titulo}</h1>
                <Link className="btn-secondary" to={`/crews/${crewId}`}>
                    {crew.data ? crew.data.name : t.tesouraria.verCrew}
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
                    <dt>{t.tesouraria.disponivel}</dt>
                    <dd style={{ fontSize: tamanhoDoSaldo(contas.balances.available) }}>
                        {formatarMontante(contas.balances.available, separador)}
                    </dd>
                </div>
                <div>
                    <dt>{t.tesouraria.liquidado}</dt>
                    <dd>{formatarMontante(contas.balances.settled, separador)}</dd>
                </div>
                <div>
                    <dt>{t.tesouraria.aEntrar}</dt>
                    <dd className="credit">
                        {formatarMontante(contas.balances.pendingIn, separador)}
                    </dd>
                </div>
                <div>
                    <dt>{t.tesouraria.aSair}</dt>
                    <dd className="debit">
                        {formatarMontante(contas.balances.pendingOut, separador)}
                    </dd>
                </div>
            </dl>

            <p className="hint">{t.tesouraria.explicacaoDisponivel}</p>

            {mensagem ? (
                <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert>
            ) : null}

            <section className="grupo">
                <h2>{t.tesouraria.proporTitulo}</h2>
                <p className="hint">{t.tesouraria.proporAviso}</p>

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
                            t.tesouraria.proposto,
                        ).then(() => {
                            setMontante('');
                            setDescricao('');
                        });
                    }}
                >
                    <div className="field">
                        <label htmlFor="montante">{t.tesouraria.montante}</label>
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
                            {t.tesouraria.montanteAjuda}
                        </p>
                    </div>

                    <div className="field">
                        <label htmlFor="direcao">{t.tesouraria.direcao}</label>
                        <select
                            id="direcao"
                            value={direcao}
                            onChange={(event) => {
                                setDirecao(event.target.value as MovementDirection);
                            }}
                        >
                            <option value="credit">{t.tesouraria.entrada}</option>
                            <option value="debit">{t.tesouraria.saida}</option>
                        </select>
                    </div>

                    <div className="field">
                        <label htmlFor="categoria">{t.tesouraria.categoria}</label>
                        <select
                            id="categoria"
                            value={categoria}
                            onChange={(event) => {
                                setCategoria(event.target.value as MovementCategory);
                            }}
                        >
                            {CATEGORIAS.map((valor) => (
                                <option key={valor} value={valor}>
                                    {t.categorias[valor]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="field">
                        <label htmlFor="descricao">{t.tesouraria.descricao}</label>
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
                        {aAgir ? t.tesouraria.aPropor : t.tesouraria.propor}
                    </button>
                </form>
            </section>

            <section className="grupo">
                <h2>{t.tesouraria.extrato}</h2>

                {contas.movements.length === 0 ? (
                    <p className="vazio">{t.tesouraria.semMovimentos}</p>
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
                                                        t.tesouraria.aprovado,
                                                    )
                                                }
                                            >
                                                {t.tesouraria.aprovar}
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
                                                        t.tesouraria.recusado,
                                                    )
                                                }
                                            >
                                                {t.tesouraria.recusar}
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
                                                        t.tesouraria.cancelado,
                                                    )
                                                }
                                            >
                                                {t.tesouraria.cancelar}
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
                    <h2>{t.tesouraria.divisoes}</h2>
                    <ul className="movimentos">
                        {divisoes.data.map((divisao) => (
                            <li key={divisao.id} className="divisao">
                                <div className="mov-principal">
                                    <span className="mov-valor credit">
                                        {formatarMontante(divisao.total, separador)}
                                    </span>
                                    <span className="mov-desc">
                                        {t.bases[divisao.basis as keyof typeof t.bases] ?? divisao.basis}
                                    </span>
                                </div>
                                <div className="mov-meta">
                                    <span className={`pill estado-${divisao.status}`}>
                                        {t.estadosMovimento[
                                            divisao.status as keyof typeof t.estadosMovimento
                                        ] ?? divisao.status}
                                    </span>
                                    <span>
                                        {t.tesouraria.pessoas(
                                            divisao.lines.length,
                                        )}
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
