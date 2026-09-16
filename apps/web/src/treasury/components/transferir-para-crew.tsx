import { useState, type FormEvent } from 'react';

import { ApiError } from '../../lib/api.js';
import { Alert } from '../../auth/components/alert.js';
import { listServerCrews } from '../../affiliations/affiliation.api.js';
import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import { transferToCrew } from '../treasury.api.js';

/** O que a API aceita: inteiro positivo, até 19 dígitos. */
const MONTANTE_VALIDO = /^[1-9][0-9]{0,18}$/;

/**
 * Passar dinheiro do servidor para uma crew que lá joga.
 *
 * É a razão de um servidor ter tesouraria. O que uma crew ganha
 * reparte-se pelos membros; o que um servidor ganha financia as crews —
 * e por isso o servidor tem transferências onde a crew tem divisões.
 *
 * A rota existia na API desde sempre e não havia por onde lá chegar: um
 * servidor a pagar o escalão mais caro não tinha ecrã nenhum para mexer
 * no dinheiro que o plano lhe abria.
 */
export const TransferirParaCrew = ({
    serverId,
    onTransferido,
}: {
    serverId: string;
    onTransferido: () => void;
}) => {
    const t = useT();

    const [crewEscolhida, setCrewEscolhida] = useState('');
    const [montante, setMontante] = useState('');
    const [descricao, setDescricao] = useState('');
    const [aAgir, setAAgir] = useState(false);
    const [mensagem, setMensagem] = useState<{
        tipo: 'good' | 'bad';
        texto: string;
    } | null>(null);

    /**
     * As crews que lá jogam. Um 403 é a resposta a quem não gere o
     * servidor, e não uma avaria — mas quem não o gere também não vê
     * esta secção, porque ela vive atrás do plano.
     */
    const crews = useAsync(
        () =>
            listServerCrews(serverId).catch((falha: unknown) => {
                if (falha instanceof ApiError && falha.status === 403) {
                    return [];
                }

                throw falha;
            }),
        [serverId],
    );

    /**
     * Só as que estão lá dentro.
     *
     * Uma candidatura por responder, ou uma crew que já saiu, não é
     * destino para dinheiro nenhum — e a API recusa-as. Oferecê-las era
     * oferecer uma escolha que só pode falhar.
     */
    const elegiveis = (crews.data ?? []).filter(
        (afiliacao) => afiliacao.status === 'active',
    );

    const montanteMau = montante !== '' && !MONTANTE_VALIDO.test(montante.trim());

    const submeter = (evento: FormEvent) => {
        evento.preventDefault();

        setMensagem(null);
        setAAgir(true);

        void transferToCrew(serverId, {
            crewId: crewEscolhida,
            amount: montante.trim(),
            description: descricao.trim(),
        })
            .then(() => {
                setMensagem({
                    tipo: 'good',
                    texto: t.tesouraria.transferida,
                });
                setMontante('');
                setDescricao('');
                onTransferido();
            })
            .catch((falha: unknown) => {
                setMensagem({
                    tipo: 'bad',
                    texto:
                        falha instanceof ApiError
                            ? falha.message
                            : t.tesouraria.naoFoiPossivel,
                });
            })
            .finally(() => setAAgir(false));
    };

    return (
        <section className="grupo">
            <h2>{t.tesouraria.transferirTitulo}</h2>
            <p className="hint">{t.tesouraria.transferirAviso}</p>

            {mensagem ? (
                <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert>
            ) : null}

            {crews.loading && !crews.data ? (
                <p className="hint">{t.comum.aCarregar}</p>
            ) : elegiveis.length === 0 ? (
                /*
                  Sem crews lá dentro não há para onde transferir. Dizer
                  o que falta vale mais do que um seletor vazio ao lado
                  de um botão que só pode recusar.
                */
                <p className="hint">{t.tesouraria.semCrewsNoServidor}</p>
            ) : (
                <form onSubmit={submeter}>
                    <div className="field">
                        <label htmlFor="transferir-crew">
                            {t.tesouraria.paraQueCrew}
                        </label>
                        <select
                            id="transferir-crew"
                            value={crewEscolhida}
                            onChange={(campo) => {
                                setCrewEscolhida(campo.target.value);
                            }}
                        >
                            <option value="">{t.tesouraria.escolheCrew}</option>
                            {elegiveis.map((afiliacao) => (
                                <option
                                    key={afiliacao.crewId}
                                    value={afiliacao.crewId}
                                >
                                    {`[${afiliacao.crewTag}] ${afiliacao.crewName}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="field">
                        <label htmlFor="transferir-montante">
                            {t.tesouraria.montanteAEnviar}
                        </label>
                        <input
                            id="transferir-montante"
                            type="text"
                            inputMode="numeric"
                            value={montante}
                            aria-invalid={montanteMau}
                            aria-describedby="transferir-montante-hint"
                            onChange={(campo) => {
                                setMontante(campo.target.value);
                            }}
                        />
                        <p className="hint" id="transferir-montante-hint">
                            {t.tesouraria.montanteAjuda}
                        </p>
                    </div>

                    <div className="field">
                        <label htmlFor="transferir-descricao">
                            {t.tesouraria.nota}
                        </label>
                        <input
                            id="transferir-descricao"
                            type="text"
                            maxLength={280}
                            value={descricao}
                            onChange={(campo) => {
                                setDescricao(campo.target.value);
                            }}
                        />
                    </div>

                    <button
                        className="primary"
                        type="submit"
                        disabled={
                            aAgir
                            || montanteMau
                            || !montante.trim()
                            || crewEscolhida === ''
                        }
                    >
                        {aAgir
                            ? t.tesouraria.aTransferir
                            : t.tesouraria.transferir}
                    </button>
                </form>
            )}
        </section>
    );
};
