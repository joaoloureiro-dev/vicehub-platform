import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import {
    getCrewSubscription,
    getServerSubscription,
} from '../../billing/billing.api.js';
import { getCrew } from '../../crews/crew.api.js';
import { getServer } from '../../servers/server.api.js';
import { ProporDivisao } from '../components/propor-divisao.js';
import { TransferirParaCrew } from '../components/transferir-para-crew.js';
import {
    approveDistribution,
    approveMovement,
    cancelMovement,
    getTreasury,
    listDistributions,
    proposeMovement,
    rejectDistribution,
    rejectMovement,
    type Dono,
} from '../treasury.api.js';
import { useIdioma, useT } from '../../i18n/i18n.js';
import {
    formatarMontante,
    separadorDoIdioma,
    classeDoSaldo,
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
 * O que esta página precisa de saber sobre o titular da tesouraria.
 *
 * Deliberadamente estreito: o perfil de uma crew e o de um servidor são
 * muito diferentes, e o que os dois têm em comum — e o que aqui se usa
 * — são duas coisas. Escrevê-las em vez de aceitar um dos dois perfis
 * inteiros diz a quem vier a seguir o que pode mudar sem partir isto.
 */
interface TitularDaTesouraria {
    name: string;
    isPremium: boolean;
}

/**
 * A tesouraria de uma crew ou de um servidor.
 *
 * O que aqui se propõe **não move nada**. Fica por decidir até alguém
 * com autoridade aprovar, e é nesse momento que o saldo muda — ou toda a
 * gente é paga, ou não é paga ninguém.
 *
 * Um ecrã para os dois, e não dois ecrãs. A API trata as duas
 * tesourarias com as mesmas rotas há muito, e o cliente desta aplicação
 * já sabia pedir as duas — só o servidor é que não tinha por onde lá
 * chegar. Duas páginas quase iguais divergiam: a correção de um saldo
 * ou de um aviso entrava numa e ficava esquecida na outra.
 *
 * O que muda entre elas é pouco e está marcado: uma crew divide o que
 * ganha pelos membros, um servidor transfere para as crews que lá
 * jogam.
 */
export const TreasuryPage = () => {
    const t = useT();
    const { idioma } = useIdioma();
    const separador = separadorDoIdioma(idioma);

    /**
     * De quem é esta tesouraria, lido do endereço.
     *
     * As duas rotas montam este mesmo componente, e é o parâmetro que
     * lá vem que decide tudo o resto.
     */
    const { crewId, serverId } = useParams<{
        crewId?: string;
        serverId?: string;
    }>();

    const eCrew = crewId !== undefined;
    const id = (eCrew ? crewId : serverId) as string;

    const dono: Dono = eCrew
        ? { tipo: 'crews', id }
        : { tipo: 'servers', id };

    /** Para onde se volta, e onde se compra o plano desta tesouraria. */
    const paginaDoDono = eCrew ? `/crews/${id}` : `/servidores/${id}`;
    const comprarPlano = eCrew
        ? `/premium?crew=${encodeURIComponent(id)}`
        : `/premium?servidor=${encodeURIComponent(id)}`;

    const [montante, setMontante] = useState('');
    const [direcao, setDirecao] = useState<MovementDirection>('credit');
    const [categoria, setCategoria] = useState<MovementCategory>('contribution');
    const [descricao, setDescricao] = useState('');

    const [mensagem, setMensagem] = useState<{
        tipo: 'good' | 'bad';
        texto: string;
    } | null>(null);
    const [aAgir, setAAgir] = useState(false);

    /**
     * O perfil do titular. Os dois trazem `name` e `isPremium`, que é
     * tudo o que esta página lhe pede.
     */
    const perfil = useAsync<TitularDaTesouraria>(
        () => (eCrew ? getCrew(id) : getServer(id)),
        [id, eCrew],
    );

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
        [id],
    );

    /**
     * O plano do titular, só para quem o gere.
     *
     * Serve uma coisa só: avisar de que a avaliação acaba. Um 403 é a
     * resposta a quem não decide sobre isto, e não uma avaria — quem
     * apenas pertence à crew continua a ver a tesouraria na mesma.
     */
    const plano = useAsync(
        () =>
            (eCrew ? getCrewSubscription(id) : getServerSubscription(id)).catch(
                (falha: unknown) => {
                    if (falha instanceof ApiError && falha.status === 403) {
                        return null;
                    }

                    throw falha;
                },
            ),
        [id, eCrew],
    );

    /**
     * As divisões são das crews e só delas.
     *
     * Um servidor não reparte o que ganha pelos seus membros: financia
     * as crews que lá jogam, e isso é uma transferência. A API nem
     * sequer tem a rota para o outro caso, por isso aqui nem se
     * pergunta.
     */
    const divisoes = useAsync(
        () =>
            !eCrew
                ? Promise.resolve(null)
                : listDistributions(id).catch((falha: unknown) => {
                    if (falha instanceof ApiError && falha.status === 403) {
                        return null;
                    }

                    throw falha;
                }),
        [id, eCrew],
    );

    const montanteMau = montante.length > 0 && !MONTANTE_VALIDO.test(montante);

    /**
     * Se esta crew pode mexer no dinheiro.
     *
     * O plano é **da crew**, e já vem no perfil que a página carregou —
     * não é preciso perguntar outra vez. Ler continua de graça: o saldo,
     * o extrato e as divisões passadas ficam à vista de qualquer membro,
     * com plano ou sem ele. O que o plano fecha é propor e decidir.
     *
     * `undefined` enquanto o perfil não chegou: aí não se decide nada,
     * porque mostrar o aviso e tirá-lo a seguir era pior do que esperar.
     */
    const podeMexer = perfil.data?.isPremium;

    /**
     * Quantos dias faltam à avaliação, quando é uma avaliação que está
     * a dar direito.
     *
     * Arredondado para cima: com dezoito horas por passar, o que falta é
     * um dia e não zero — e "zero dias" num ecrã que ainda funciona
     * lê-se como avaria.
     */
    const diasDeAvaliacao =
        plano.data?.isTrial && plano.data.activeUntil
            ? Math.max(
                  0,
                  Math.ceil(
                      (new Date(plano.data.activeUntil).getTime() - Date.now())
                      / 86_400_000,
                  ),
              )
            : null;

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
                    <Link to={paginaDoDono}>{t.tesouraria.verCrew}</Link>
                </div>
            </div>
        );
    }

    const contas = tesouraria.data;

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>{t.tesouraria.titulo}</h1>
                <Link className="btn-secondary" to={paginaDoDono}>
                    {perfil.data ? perfil.data.name : t.tesouraria.verCrew}
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
                    <dd className={classeDoSaldo(contas.balances.available)}>
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

            {/*
              O aviso fica onde estaria o formulário, e não no topo da
              página: quem abre a tesouraria para ver o saldo não tem de
              levar com uma venda; quem a abre para propor um movimento
              encontra a explicação exatamente onde procurava o campo.
            */}
            {podeMexer === false ? (
                <section className="grupo">
                    <h2>{t.tesouraria.proporTitulo}</h2>
                    <Alert kind="bad">{t.tesouraria.precisaDePlano}</Alert>
                    {/*
                      O plano é da crew e não de quem o compra: sem o
                      identificador, quem carregasse comprava para si
                      próprio e a tesouraria continuava fechada.
                    */}
                    <Link
                        className="link-premium"
                        to={comprarPlano}
                    >
                        {t.tesouraria.verPlano}
                    </Link>
                </section>
            ) : null}

            {podeMexer === false ? null : (
            <section className="grupo">
                <h2>{t.tesouraria.proporTitulo}</h2>

                {/*
                  A avaliação acaba, e acabar em silêncio — com a
                  tesouraria a fechar-se sem aviso — era a pior maneira
                  de vender. Fica aqui, por cima do formulário que
                  deixará de existir.
                */}
                {diasDeAvaliacao !== null ? (
                    <p className="hint">
                        {t.tesouraria.avaliacaoAcaba(diasDeAvaliacao)}{' '}
                        <Link
                            to={comprarPlano}
                        >
                            {t.tesouraria.verPlano}
                        </Link>
                    </p>
                ) : null}
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
            )}

            {/*
              Dividir vive ao lado de propor, e debaixo do mesmo plano:
              mexer no dinheiro é o que o plano paga, e dividir é mexer
              no dinheiro de toda a gente de uma vez.
            */}
            {/*
              O que um servidor faz com o que ganha: financiar as crews
              que lá jogam. Onde a crew tem divisões, o servidor tem
              isto — e atrás do mesmo plano, porque é mexer no dinheiro.
            */}
            {podeMexer === false || eCrew ? null : (
                <TransferirParaCrew
                    serverId={id}
                    onTransferido={() => {
                        tesouraria.reload();
                    }}
                />
            )}

            {podeMexer === false || !eCrew ? null : (
                <ProporDivisao
                    crewId={id}
                    onDividido={() => {
                        tesouraria.reload();
                        divisoes.reload();
                    }}
                />
            )}

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
                                    /**
                                     * Sem plano, os botões não aparecem:
                                     * todos eles respondem 402, e um
                                     * botão que só pode recusar é pior
                                     * do que botão nenhum. O movimento
                                     * fica à vista, pendente, à espera
                                     * de que o plano volte.
                                     */
                                    movimento.status === 'pending'
                                    && podeMexer !== false ? (
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
                                            /*
                                              Só as entradas. A saída da
                                              tesouraria é uma linha
                                              como as outras, e contá-la
                                              dizia que uma divisão de
                                              quatro pagou a cinco.
                                            */
                                            divisao.lines.filter(
                                                (linha) =>
                                                    linha.direction
                                                    === 'credit',
                                            ).length,
                                        )}
                                    </span>
                                </div>
                                {divisao.note ? (
                                    <p className="hint">{divisao.note}</p>
                                ) : null}

                                {/*
                                  Uma divisão proposta não move dinheiro
                                  nenhum até ser aprovada, e até aqui não
                                  havia por onde a aprovar: ficava na
                                  lista para sempre, a dizer "pendente",
                                  com o dinheiro parado na tesouraria.

                                  O mesmo portão dos movimentos: sem
                                  plano os botões não aparecem, porque
                                  todos respondem 402 e um botão que só
                                  pode recusar é pior do que botão
                                  nenhum. Só as crews dividem, e é por
                                  isso que `eCrew` também conta.
                                */}
                                {divisao.status === 'pending'
                                && eCrew
                                && podeMexer !== false ? (
                                    <div className="linha-acoes">
                                        <button
                                            className="btn-secondary"
                                            type="button"
                                            disabled={aAgir}
                                            onClick={() =>
                                                void agir(
                                                    () =>
                                                        approveDistribution(
                                                            id,
                                                            divisao.id,
                                                        ),
                                                    t.tesouraria.divisaoPaga,
                                                )
                                            }
                                        >
                                            {t.tesouraria.pagar}
                                        </button>
                                        <button
                                            className="btn-secondary perigo"
                                            type="button"
                                            disabled={aAgir}
                                            onClick={() =>
                                                void agir(
                                                    () =>
                                                        rejectDistribution(
                                                            id,
                                                            divisao.id,
                                                        ),
                                                    t.tesouraria.recusado,
                                                )
                                            }
                                        >
                                            {t.tesouraria.recusar}
                                        </button>
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </div>
    );
};
