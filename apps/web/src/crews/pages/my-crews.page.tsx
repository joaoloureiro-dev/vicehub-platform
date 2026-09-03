import { Link } from 'react-router';

import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import { listMyMemberships } from '../crew.api.js';
import { useT } from '../../i18n/i18n.js';

/**
 * As minhas crews, candidaturas pendentes incluídas.
 *
 * As pendentes aparecem aqui de propósito: sem isto, quem pede entrada
 * numa crew não tem forma de saber se já foi respondido, e é essa
 * pergunta que faz a pessoa voltar ao site.
 */
export const MyCrewsPage = () => {
    const t = useT();
    const { data, loading, error } = useAsync(() => listMyMemberships(), []);

    const pendentes = data?.filter((adesao) => adesao.status === 'pending') ?? [];
    const ativas = data?.filter((adesao) => adesao.status === 'active') ?? [];

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>{t.crews.asMinhasTitulo}</h1>
                <Link className="btn-secondary" to="/crews">
                    {t.crews.verDiretorio}
                </Link>
            </div>

            {error ? (
                <Alert kind="bad">{t.crews.naoCarregouMinhas}</Alert>
            ) : null}

            {loading && !data ? <p className="hint">{t.comum.aCarregar}</p> : null}

            {data && data.length === 0 ? (
                <p className="vazio">
                    {t.crews.semCrews}{' '}
                    <Link to="/crews">{t.crews.procuraUma}</Link>{' '}
                    <Link to="/crews/nova">{t.crews.ouCriaTua}</Link>.
                </p>
            ) : null}

            {pendentes.length > 0 ? (
                <section className="grupo">
                    <h2>{t.crews.aEsperaResposta}</h2>
                    <ul className="pessoas">
                        {pendentes.map((adesao) => (
                            <li key={adesao.crewId}>
                                <Link className="nome" to={`/crews/${adesao.crewId}`}>
                                    <span className="crewtag">[{adesao.tag}]</span>{' '}
                                    {adesao.name}
                                </Link>
                                <span className="pill aguarda">{t.crews.candidaturaEnviada}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {ativas.length > 0 ? (
                <section className="grupo">
                    <h2>{t.crews.ondeEntrei}</h2>
                    <ul className="pessoas">
                        {ativas.map((adesao) => (
                            <li key={adesao.crewId}>
                                <Link className="nome" to={`/crews/${adesao.crewId}`}>
                                    <span className="crewtag">[{adesao.tag}]</span>{' '}
                                    {adesao.name}
                                </Link>
                                <span className="cargo">
                                    {t.cargos[
                                        (adesao.role ??
                                            'crew_member') as keyof typeof t.cargos
                                    ] ?? adesao.role}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </div>
    );
};
