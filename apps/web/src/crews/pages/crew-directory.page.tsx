import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import { listCrews } from '../crew.api.js';
import { CrewCard } from '../components/crew-card.js';

/**
 * O diretório.
 *
 * Os destaques só aparecem sem pesquisa — é o que a API faz, e por boas
 * razões: uma pesquisa é uma intenção concreta, e responder-lhe com
 * colocação paga tornaria os resultados pouco fiáveis. O ecrã segue essa
 * decisão em vez de a contrariar.
 */
export const CrewDirectoryPage = () => {
    const [termo, setTermo] = useState('');
    const [pesquisa, setPesquisa] = useState('');
    const [pagina, setPagina] = useState(1);

    const { data, loading, error } = useAsync(
        () => listCrews({ ...(pesquisa ? { search: pesquisa } : {}), page: pagina }),
        [pesquisa, pagina],
    );

    const submeter = (event: FormEvent) => {
        event.preventDefault();
        setPesquisa(termo.trim());
        setPagina(1);
    };

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>Crews</h1>
                <Link className="btn-secondary" to="/crews/nova">
                    Criar crew
                </Link>
            </div>

            <form className="searchbar" onSubmit={submeter} role="search">
                <input
                    type="search"
                    value={termo}
                    aria-label="Pesquisar crews"
                    placeholder="Procurar pelo nome ou pela tag"
                    onChange={(event) => {
                        setTermo(event.target.value);
                    }}
                />
                <button className="primary" type="submit">
                    Procurar
                </button>
            </form>

            {error ? (
                <Alert kind="bad">Não foi possível carregar o diretório.</Alert>
            ) : null}

            {loading && !data ? <p className="hint">A carregar…</p> : null}

            {data && data.featured.length > 0 ? (
                <section className="grupo">
                    <h2>Em destaque</h2>
                    <div className="crewgrid">
                        {data.featured.map((crew) => (
                            <CrewCard key={crew.id} crew={crew} destaque />
                        ))}
                    </div>
                </section>
            ) : null}

            {data ? (
                <section className="grupo">
                    <h2>
                        {pesquisa ? `Resultados para "${pesquisa}"` : 'Todas as crews'}
                    </h2>

                    {data.items.length === 0 ? (
                        <p className="vazio">
                            {pesquisa
                                ? 'Nenhuma crew com esse nome. Experimenta outro termo.'
                                : 'Ainda não há crews. Cria a primeira.'}
                        </p>
                    ) : (
                        <div className="crewgrid">
                            {data.items.map((crew) => (
                                <CrewCard key={crew.id} crew={crew} />
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
