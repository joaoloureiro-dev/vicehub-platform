import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import { listServers } from '../server.api.js';
import type { ServerDirectoryEntry } from '../server.types.js';

const ServerCard = ({
    servidor,
    destaque = false,
}: {
    servidor: ServerDirectoryEntry;
    destaque?: boolean;
}) => (
    <Link
        className={`crewcard${destaque ? ' destaque' : ''}`}
        to={`/servidores/${servidor.id}`}
        style={
            servidor.appearance.accentColor
                ? { borderLeftColor: servidor.appearance.accentColor }
                : undefined
        }
    >
        <div className="crewcard-top">
            <span
                className={`estado ${servidor.isOnline ? 'online' : 'offline'}`}
                /* O ponto é decorativo; o estado vai no texto ao lado. */
                aria-hidden="true"
            />
            <b>{servidor.name}</b>
        </div>

        {servidor.description ? <p>{servidor.description}</p> : null}

        <div className="crewcard-foot">
            <span>{servidor.isOnline ? 'Online' : 'Offline'}</span>
            {servidor.region ? <span>{servidor.region}</span> : null}
            <span>
                {servidor.memberCount}{' '}
                {servidor.memberCount === 1 ? 'membro' : 'membros'}
            </span>
            {destaque ? <span className="pill">Destaque</span> : null}
        </div>
    </Link>
);

export const ServerDirectoryPage = () => {
    const [termo, setTermo] = useState('');
    const [pesquisa, setPesquisa] = useState('');
    const [soOnline, setSoOnline] = useState(false);
    const [pagina, setPagina] = useState(1);

    const { data, loading, error } = useAsync(
        () =>
            listServers({
                ...(pesquisa ? { search: pesquisa } : {}),
                ...(soOnline ? { onlineOnly: true } : {}),
                page: pagina,
            }),
        [pesquisa, soOnline, pagina],
    );

    const submeter = (event: FormEvent) => {
        event.preventDefault();
        setPesquisa(termo.trim());
        setPagina(1);
    };

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>Servidores</h1>
                <Link className="btn-secondary" to="/servidores/novo">
                    Registar servidor
                </Link>
            </div>

            <form className="searchbar" onSubmit={submeter} role="search">
                <input
                    type="search"
                    value={termo}
                    aria-label="Pesquisar servidores"
                    placeholder="Procurar pelo nome"
                    onChange={(event) => {
                        setTermo(event.target.value);
                    }}
                />
                <button className="primary" type="submit">
                    Procurar
                </button>
            </form>

            <label className="filtro">
                <input
                    type="checkbox"
                    checked={soOnline}
                    onChange={(event) => {
                        setSoOnline(event.target.checked);
                        setPagina(1);
                    }}
                />
                Mostrar apenas os que estão online
            </label>

            {error ? (
                <Alert kind="bad">Não foi possível carregar os servidores.</Alert>
            ) : null}

            {loading && !data ? <p className="hint">A carregar…</p> : null}

            {data && data.featured.length > 0 ? (
                <section className="grupo">
                    <h2>Em destaque</h2>
                    <div className="crewgrid">
                        {data.featured.map((servidor) => (
                            <ServerCard key={servidor.id} servidor={servidor} destaque />
                        ))}
                    </div>
                </section>
            ) : null}

            {data ? (
                <section className="grupo">
                    <h2>
                        {pesquisa
                            ? `Resultados para "${pesquisa}"`
                            : 'Todos os servidores'}
                    </h2>

                    {data.items.length === 0 ? (
                        <p className="vazio">
                            {pesquisa || soOnline
                                ? 'Nenhum servidor com estes filtros.'
                                : 'Ainda não há servidores. Regista o primeiro.'}
                        </p>
                    ) : (
                        <div className="crewgrid">
                            {data.items.map((servidor) => (
                                <ServerCard key={servidor.id} servidor={servidor} />
                            ))}
                        </div>
                    )}

                    {data.totalPages > 1 ? (
                        <div className="paginacao">
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={data.page <= 1}
                                onClick={() => {
                                    setPagina((valor) => valor - 1);
                                }}
                            >
                                Anterior
                            </button>
                            <span>
                                Página {data.page} de {data.totalPages}
                            </span>
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={data.page >= data.totalPages}
                                onClick={() => {
                                    setPagina((valor) => valor + 1);
                                }}
                            >
                                Seguinte
                            </button>
                        </div>
                    ) : null}
                </section>
            ) : null}
        </div>
    );
};
