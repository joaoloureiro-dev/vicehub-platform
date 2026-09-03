import {
    formatarMontante,
    nomeDaCategoria,
    nomeDoEstado,
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
}) => (
    <li className={`movimento ${movimento.status}`}>
        <div className="mov-principal">
            <span className={`mov-valor ${movimento.direction}`}>
                {sinalDoMovimento(movimento.direction)}
                {formatarMontante(movimento.amount)}
            </span>
            <span className="mov-desc">
                {movimento.description ?? nomeDaCategoria(movimento.category)}
            </span>
        </div>

        <div className="mov-meta">
            <span className={`pill estado-${movimento.status}`}>
                {nomeDoEstado(movimento.status)}
            </span>
            <span>{nomeDaCategoria(movimento.category)}</span>
            <span>
                {new Date(movimento.createdAt).toLocaleDateString('pt-PT')}
            </span>
        </div>

        {acoes ? <div className="linha-acoes">{acoes}</div> : null}
    </li>
);
