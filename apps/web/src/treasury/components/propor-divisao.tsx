import { useState, type FormEvent } from 'react';

import { mensagemDoErro } from '../../lib/erro.js';
import { Alert } from '../../auth/components/alert.js';
import { listEvents } from '../../events/event.api.js';
import { useT } from '../../i18n/i18n.js';
import { proposeDistribution } from '../treasury.api.js';
import type { DistributionBasis } from '../treasury.types.js';
import type { EventSummary } from '../../events/event.types.js';

/**
 * As bases que este ecrã oferece.
 *
 * A `manual` fica de fora, e não por esquecimento: dar um montante a
 * cada pessoa é outra forma — uma linha por membro — e o cliente desta
 * aplicação nem sequer sabe enviar as partes. Entra quando houver ecrã
 * para ela, e não antes.
 */
const BASES = ['equal', 'by_role', 'participation'] as const;

/**
 * Dividir o que a crew ganhou.
 *
 * Existia tudo menos isto. A API divide por partes iguais, por cargo e
 * **por quem apareceu**; o cliente já sabia pedir as três; o dicionário
 * já tinha nome para as quatro. Não havia era ecrã nenhum a chamá-las —
 * e a página de um evento dizia, a quem confirmasse presenças, que a
 * crew já podia dividir ganhos a partir dali. Dizia uma coisa que o
 * produto não fazia.
 */
export const ProporDivisao = ({
    crewId,
    onDividido,
}: {
    crewId: string;
    onDividido: () => void;
}) => {
    const t = useT();

    const [base, setBase] = useState<DistributionBasis>('equal');
    const [total, setTotal] = useState('');
    const [nota, setNota] = useState('');
    const [eventoId, setEventoId] = useState('');
    const [aAgir, setAAgir] = useState(false);
    const [mensagem, setMensagem] = useState<{
        tipo: 'good' | 'bad';
        texto: string;
    } | null>(null);

    /**
     * Os eventos só se pedem quando fazem falta.
     *
     * A esmagadora maioria das divisões não é por participação, e pedir
     * a lista ao abrir a tesouraria era uma ida à API que quase nunca
     * servia para nada. `null` é "ainda não perguntei".
     */
    const [eventos, setEventos] = useState<EventSummary[] | null>(null);
    const [aCarregarEventos, setACarregarEventos] = useState(false);

    /**
     * Só entram os eventos em que **alguém** tem presença confirmada.
     *
     * A API recusa os outros com `NO_CONFIRMED_PARTICIPANTS`, e por boa
     * razão: não há por onde dividir. Oferecê-los era oferecer uma
     * escolha que só pode falhar — que é diferente de oferecer e deixar
     * a API recusar, porque aqui a recusa é certa.
     */
    const elegiveis = (eventos ?? []).filter(
        (evento) => evento.confirmedCount > 0,
    );

    const escolherBase = (nova: DistributionBasis) => {
        setBase(nova);

        if (nova !== 'participation' || eventos !== null || aCarregarEventos) {
            return;
        }

        setACarregarEventos(true);

        /**
         * `includePast` porque é precisamente o passado que interessa:
         * divide-se o que já se ganhou, e um evento que ainda não
         * aconteceu não tem presenças para confirmar.
         */
        void listEvents({ tipo: 'crews', id: crewId }, { includePast: true })
            .then(setEventos)
            .catch(() => setEventos([]))
            .finally(() => setACarregarEventos(false));
    };

    const montanteMau = total !== '' && !/^\d+$/.test(total.trim());

    const faltaEvento = base === 'participation' && eventoId === '';

    const submeter = (evento: FormEvent) => {
        evento.preventDefault();

        setMensagem(null);
        setAAgir(true);

        void proposeDistribution(crewId, {
            basis: base,
            total: total.trim(),
            /*
             * O evento vai sempre, e é o cliente que decide se o envia.
             * `proposeDistribution` já sabe que campo pertence a que
             * base — repetir essa regra aqui era escrevê-la em dois
             * sítios, e o segundo é sempre o que diverge do primeiro.
             */
            eventId: eventoId,
            note: nota.trim(),
        })
            .then(() => {
                setMensagem({
                    tipo: 'good',
                    texto: t.tesouraria.divisaoProposta,
                });
                setTotal('');
                setNota('');
                onDividido();
            })
            .catch((falha: unknown) => {
                setMensagem({
                    tipo: 'bad',
                    texto:
                        mensagemDoErro(
                                falha,
                                t,
                                t.tesouraria.naoFoiPossivel,
                            ),
                });
            })
            .finally(() => setAAgir(false));
    };

    return (
        <section className="grupo">
            <h2>{t.tesouraria.dividirTitulo}</h2>
            <p className="hint">{t.tesouraria.dividirAviso}</p>

            {mensagem ? (
                <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert>
            ) : null}

            <form onSubmit={submeter}>
                <div className="field">
                    <label htmlFor="divisao-total">{t.tesouraria.totalADividir}</label>
                    <input
                        id="divisao-total"
                        type="text"
                        inputMode="numeric"
                        value={total}
                        aria-invalid={montanteMau}
                        aria-describedby="divisao-total-hint"
                        onChange={(campo) => {
                            setTotal(campo.target.value);
                        }}
                    />
                    <p className="hint" id="divisao-total-hint">
                        {t.tesouraria.montanteAjuda}
                    </p>
                </div>

                <div className="field">
                    <label htmlFor="divisao-base">{t.tesouraria.comoDividir}</label>
                    <select
                        id="divisao-base"
                        value={base}
                        onChange={(campo) => {
                            escolherBase(campo.target.value as DistributionBasis);
                        }}
                    >
                        {BASES.map((valor) => (
                            <option key={valor} value={valor}>
                                {t.bases[valor]}
                            </option>
                        ))}
                    </select>
                </div>

                {base === 'participation' ? (
                    <div className="field">
                        <label htmlFor="divisao-evento">
                            {t.tesouraria.deQueEvento}
                        </label>

                        {aCarregarEventos ? (
                            <p className="hint">{t.comum.aCarregar}</p>
                        ) : elegiveis.length === 0 ? (
                            /*
                              Sem presenças confirmadas em lado nenhum,
                              esta base não tem por onde dividir. Dizer
                              porquê — e o que fazer para a destrancar —
                              vale mais do que um seletor vazio.
                            */
                            <p className="hint">
                                {t.tesouraria.semEventosComPresencas}
                            </p>
                        ) : (
                            <select
                                id="divisao-evento"
                                value={eventoId}
                                onChange={(campo) => {
                                    setEventoId(campo.target.value);
                                }}
                            >
                                <option value="">
                                    {t.tesouraria.escolheEvento}
                                </option>
                                {elegiveis.map((evento) => (
                                    <option key={evento.id} value={evento.id}>
                                        {`${evento.name} — ${t.tesouraria.presencas(
                                            evento.confirmedCount,
                                        )}`}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                ) : null}

                <div className="field">
                    <label htmlFor="divisao-nota">{t.tesouraria.nota}</label>
                    <input
                        id="divisao-nota"
                        type="text"
                        maxLength={280}
                        value={nota}
                        onChange={(campo) => {
                            setNota(campo.target.value);
                        }}
                    />
                </div>

                <button
                    className="primary"
                    type="submit"
                    disabled={aAgir || montanteMau || !total.trim() || faltaEvento}
                >
                    {aAgir ? t.tesouraria.aDividir : t.tesouraria.dividir}
                </button>
            </form>
        </section>
    );
};
