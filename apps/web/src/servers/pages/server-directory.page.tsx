import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import { listServers } from '../server.api.js';
import { useT } from '../../i18n/i18n.js';
import type { ServerDirectoryEntry } from '../server.types.js';

const ServerCard = ({
    servidor,
    destaque = false,
}: {
    servidor: ServerDirectoryEntry;
    destaque?: boolean;
}) => {
    const t = useT();

    return (
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
            <span>
                {servidor.isOnline ? t.servidores.online : t.servidores.offline}
            </span>
            {servidor.region ? <span>{servidor.region}</span> : null}
            <span>{t.crews.membros(servidor.memberCount)}</span>
            {destaque ? <span className="pill">{t.crews.destaque}</span> : null}
        </div>
    </Link>
    );
};

export const ServerDirectoryPage = () => {
    const t = useT();
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
                <h1>{t.servidores.titulo}</h1>
                <Link className="btn-secondary" to="/servidores/novo">
                    {t.servidores.registar}
                </Link>
            </div>

            <form className="searchbar" onSubmit={submeter} role="search">
                <input
                    type="search"
                    value={termo}
                    aria-label={t.servidores.procurarLabel}
                    placeholder={t.servidores.procurar}
                    onChange={(event) => {
                        setTermo(event.target.value);
                    }}
                />
                <button className="primary" type="submit">
                    {t.crews.botaoProcurar}
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
                {t.servidores.soOnline}
            </label>

            {error ? (
                <Alert kind="bad">{t.servidores.naoCarregou}</Alert>
            ) : null}

            {loading && !data ? <p className="hint">{t.comum.aCarregar}</p> : null}

            {data && data.featured.length > 0 ? (
                <section className="grupo">
                    <h2>{t.crews.emDestaque}</h2>
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
                        {pesquisa ? t.crews.resultados(pesquisa) : t.servidores.todos}
                    </h2>

                    {data.items.length === 0 ? (
                        <p className="vazio">
                            {pesquisa || soOnline
                                ? t.servidores.semResultados
                                : t.servidores.aindaNaoHa}
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
                                {t.crews.anterior}
                            </button>
                            <span>
                                {t.crews.paginaDe(data.page, data.totalPages)}
                            </span>
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={data.page >= data.totalPages}
                                onClick={() => {
                                    setPagina((valor) => valor + 1);
                                }}
                            >
                                {t.crews.seguinte}
                            </button>
                        </div>
                    ) : null}
                </section>
            ) : null}
        </div>
    );
};
