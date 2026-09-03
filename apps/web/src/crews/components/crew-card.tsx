import { Link } from 'react-router';

import { useT } from '../../i18n/i18n.js';
import type { CrewDirectoryEntry } from '../crew.types.js';

/**
 * Uma crew no diretório.
 *
 * A cor de realce é a que a crew escolheu — e a API só a devolve a quem
 * tem plano ativo, por isso não é preciso decidir nada aqui: se vier,
 * mostra-se.
 */
export const CrewCard = ({
    crew,
    destaque = false,
}: {
    crew: CrewDirectoryEntry;
    destaque?: boolean;
}) => {
    const t = useT();

    return (
    <Link
        className={`crewcard${destaque ? ' destaque' : ''}`}
        to={`/crews/${crew.id}`}
        style={
            crew.appearance.accentColor
                ? { borderLeftColor: crew.appearance.accentColor }
                : undefined
        }
    >
        <div className="crewcard-top">
            <span className="crewtag">[{crew.tag}]</span>
            <b>{crew.name}</b>
        </div>

        {crew.description ? <p>{crew.description}</p> : null}

        <div className="crewcard-foot">
            <span>{t.crews.nivel(crew.level)}</span>
            <span>{t.crews.membros(crew.memberCount)}</span>
            {destaque ? <span className="pill">{t.crews.destaque}</span> : null}
        </div>
    </Link>
    );
};
