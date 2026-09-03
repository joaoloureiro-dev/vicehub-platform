import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import { listCrews } from '../crew.api.js';
import { CrewCard } from '../components/crew-card.js';
import { useT } from '../../i18n/i18n.js';

/**
 * O diretório.
 *
 * Os destaques só aparecem sem pesquisa — é o que a API faz, e por boas
 * razões: uma pesquisa é uma intenção concreta, e responder-lhe com
 * colocação paga tornaria os resultados pouco fiáveis. O ecrã segue essa
 * decisão em vez de a contrariar.
 */
export const CrewDirectoryPage = () => {
    const t = useT();
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
                <h1>{t.crews.titulo}</h1>
                <Link className="btn-secondary" to="/crews/nova">
                    {t.crews.criar}
                </Link>
            </div>

            <form className="searchbar" onSubmit={submeter} role="search">
                <input
                    type="search"
                    value={termo}
                    aria-label={t.crews.procurarLabel}
                    placeholder={t.crews.procurar}
                    onChange={(event) => {
                        setTermo(event.target.value);
                    }}
                />
                <button className="primary" type="submit">
                    {t.crews.botaoProcurar}
                </button>
            </form>

            {error ? (
                <Alert kind="bad">{t.crews.naoCarregou}</Alert>
            ) : null}

            {loading && !data ? <p className="hint">{t.comum.aCarregar}</p> : null}

            {data && data.featured.length > 0 ? (
                <section className="grupo">
                    <h2>{t.crews.emDestaque}</h2>
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
                        {pesquisa ? t.crews.resultados(pesquisa) : t.crews.todas}
                    </h2>

                    {data.items.length === 0 ? (
                        <p className="vazio">
                            {pesquisa ? t.crews.semResultados : t.crews.aindaNaoHa}
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
