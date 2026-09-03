import { useIdioma, useT } from '../../i18n/i18n.js';
import {
    formatarMontante,
    separadorDoIdioma,
    sinalDoMovimento,
    type TreasuryMovement,
} from '../treasury.types.js';

/**
 * Um movimento no extrato.
 *
 * O sinal e a cor dizem a direção, mas o montante nunca é convertido
 * para número: chega em texto e assim se mostra.
 */
export const MovementRow = ({
    movimento,
    acoes,
}: {
    movimento: TreasuryMovement;
    acoes?: React.ReactNode;
}) => {
    const t = useT();
    const { idioma } = useIdioma();

    return (
    <li className={`movimento ${movimento.status}`}>
        <div className="mov-principal">
            <span className={`mov-valor ${movimento.direction}`}>
                {sinalDoMovimento(movimento.direction)}
                {formatarMontante(movimento.amount, separadorDoIdioma(idioma))}
            </span>
            <span className="mov-desc">
                {movimento.description ??
                    (t.categorias[
                        movimento.category as keyof typeof t.categorias
                    ] ?? movimento.category)}
            </span>
        </div>

        <div className="mov-meta">
            <span className={`pill estado-${movimento.status}`}>
                {t.estadosMovimento[
                    movimento.status as keyof typeof t.estadosMovimento
                ] ?? movimento.status}
            </span>
            <span>
                {t.categorias[
                    movimento.category as keyof typeof t.categorias
                ] ?? movimento.category}
            </span>
            <span>
                {new Date(movimento.createdAt).toLocaleDateString(idioma)}
            </span>
        </div>

        {acoes ? <div className="linha-acoes">{acoes}</div> : null}
    </li>
    );
};
