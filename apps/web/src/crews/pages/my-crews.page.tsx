import { Link } from 'react-router';

import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import { listMyMemberships } from '../crew.api.js';
import { nomeDoCargo } from '../crew.types.js';

/**
 * As minhas crews, candidaturas pendentes incluídas.
 *
 * As pendentes aparecem aqui de propósito: sem isto, quem pede entrada
 * numa crew não tem forma de saber se já foi respondido, e é essa
 * pergunta que faz a pessoa voltar ao site.
 */
export const MyCrewsPage = () => {
    const { data, loading, error } = useAsync(() => listMyMemberships(), []);

    const pendentes = data?.filter((adesao) => adesao.status === 'pending') ?? [];
    const ativas = data?.filter((adesao) => adesao.status === 'active') ?? [];

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>As minhas crews</h1>
                <Link className="btn-secondary" to="/crews">
                    Ver o diretório
                </Link>
            </div>

            {error ? (
                <Alert kind="bad">Não foi possível carregar as tuas crews.</Alert>
            ) : null}

            {loading && !data ? <p className="hint">A carregar…</p> : null}

            {data && data.length === 0 ? (
                <p className="vazio">
                    Ainda não pertences a nenhuma crew.{' '}
                    <Link to="/crews">Procura uma</Link> ou{' '}
                    <Link to="/crews/nova">cria a tua</Link>.
                </p>
            ) : null}

            {pendentes.length > 0 ? (
                <section className="grupo">
                    <h2>À espera de resposta</h2>
                    <ul className="pessoas">
                        {pendentes.map((adesao) => (
                            <li key={adesao.crewId}>
                                <Link className="nome" to={`/crews/${adesao.crewId}`}>
                                    <span className="crewtag">[{adesao.tag}]</span>{' '}
                                    {adesao.name}
                                </Link>
                                <span className="pill aguarda">Candidatura enviada</span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {ativas.length > 0 ? (
                <section className="grupo">
                    <h2>Onde já entrei</h2>
                    <ul className="pessoas">
                        {ativas.map((adesao) => (
                            <li key={adesao.crewId}>
                                <Link className="nome" to={`/crews/${adesao.crewId}`}>
                                    <span className="crewtag">[{adesao.tag}]</span>{' '}
                                    {adesao.name}
                                </Link>
                                <span className="cargo">{nomeDoCargo(adesao.role)}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </div>
    );
};
