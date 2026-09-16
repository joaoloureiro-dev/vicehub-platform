import { Link } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { MovementRow } from '../components/movement-row.js';
import { getMyMovements } from '../treasury.api.js';
import { useAsync } from '../../lib/use-async.js';
import { useIdioma, useT } from '../../i18n/i18n.js';
import {
    formatarMontante,
    separadorDoIdioma,
} from '../treasury.types.js';

/**
 * A carteira de quem está a ver.
 *
 * Existia na API desde sempre e não tinha ecrã nenhum. Quem recebia a
 * sua parte de uma divisão de uma crew não via o dinheiro chegar em
 * lado nenhum — e, se tentasse apagar a conta, era recusado com "a tua
 * carteira ainda tem saldo" sem forma de saber quanto nem de onde veio.
 *
 * É só de leitura, e isso é a verdade e não uma simplificação: não há
 * rota nenhuma por onde uma pessoa mova dinheiro da sua carteira. Este
 * ecrã mostra o que lá está; não finge um botão que a API não serve.
 */
export const MyWalletPage = () => {
    const t = useT();
    const { idioma } = useIdioma();
    const separador = separadorDoIdioma(idioma);

    const carteira = useAsync(() => getMyMovements(), []);

    if (carteira.loading && !carteira.data) {
        return <p className="centered">{t.comum.aCarregar}</p>;
    }

    if (!carteira.data) {
        return (
            <div className="panel">
                <Alert kind="bad">{t.comum.naoFoiPossivel}</Alert>
            </div>
        );
    }

    const { balances, movements } = carteira.data;

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>{t.carteira.titulo}</h1>
                <Link className="btn-secondary" to="/eu">
                    {t.premium.irParaPerfil}
                </Link>
            </div>

            {/*
              Os mesmos quatro saldos da tesouraria de uma comunidade, e
              pela mesma razão: o liquidado não desconta o que já foi
              autorizado a sair, e um número só não diz com que se pode
              contar.
            */}
            <dl className="saldos">
                <div className="principal">
                    <dt>{t.tesouraria.disponivel}</dt>
                    <dd>{formatarMontante(balances.available, separador)}</dd>
                </div>
                <div>
                    <dt>{t.tesouraria.liquidado}</dt>
                    <dd>{formatarMontante(balances.settled, separador)}</dd>
                </div>
                <div>
                    <dt>{t.tesouraria.aEntrar}</dt>
                    <dd className="credit">
                        {formatarMontante(balances.pendingIn, separador)}
                    </dd>
                </div>
                <div>
                    <dt>{t.tesouraria.aSair}</dt>
                    <dd className="debit">
                        {formatarMontante(balances.pendingOut, separador)}
                    </dd>
                </div>
            </dl>

            <p className="hint">{t.carteira.dondeVem}</p>

            <section className="grupo">
                <h2>{t.tesouraria.extrato}</h2>

                {movements.length === 0 ? (
                    <p className="hint">{t.carteira.aindaSemNada}</p>
                ) : (
                    <ul className="movimentos">
                        {movements.map((movimento) => (
                            <MovementRow key={movimento.id} movimento={movimento} />
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};
