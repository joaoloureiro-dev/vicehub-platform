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
/** As ordens que a API conhece. Não há aqui nenhuma que ela não saiba. */
const ORDENS = ['newest', 'level', 'name'] as const;

type Ordem = (typeof ORDENS)[number];

/**
 * @param apenasRecrutamento Mostra só as crews que anunciaram que
 * recrutam. É o mesmo ecrã, e não um segundo diretório: a paginação, a
 * pesquisa, a ordenação e os destaques já existem aqui, e uma cópia
 * deles acabaria a divergir desta em coisas que ninguém repara logo.
 */
export const CrewDirectoryPage = ({
    apenasRecrutamento = false,
}: {
    apenasRecrutamento?: boolean;
} = {}) => {
    const t = useT();
    const [termo, setTermo] = useState('');
    const [pesquisa, setPesquisa] = useState('');
    const [pagina, setPagina] = useState(1);

    /**
     * A API ordena por nível desde sempre, e não havia por onde lá
     * chegar: o diretório mostrava a ordem por omissão e mais nada. Uma
     * crew que subiu de nível não tinha onde isso aparecer.
     */
    const [ordem, setOrdem] = useState<Ordem>('newest');

    const { data, loading, error } = useAsync(
        () =>
            listCrews({
                ...(pesquisa ? { search: pesquisa } : {}),
                ...(apenasRecrutamento ? { recruiting: true } : {}),
                page: pagina,
                sort: ordem,
            }),
        [pesquisa, pagina, ordem, apenasRecrutamento],
    );

    const submeter = (event: FormEvent) => {
        event.preventDefault();
        setPesquisa(termo.trim());
        setPagina(1);
    };

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>
                    {apenasRecrutamento
                        ? t.crews.recrutamentoTitulo
                        : t.crews.titulo}
                </h1>
                <Link className="btn-secondary" to="/crews/nova">
                    {t.crews.criar}
                </Link>
            </div>

            {/*
              A ligação entre os dois é nos dois sentidos.

              Quem chega ao quadro e não encontra crew nenhuma que sirva
              tem de conseguir ver o diretório todo sem voltar atrás — e
              quem anda a ver o diretório todo não descobre o quadro por
              adivinhação.
            */}
            <p className="hint">
                {apenasRecrutamento ? (
                    <>
                        {t.crews.recrutamentoExplica}{' '}
                        <Link to="/crews">{t.crews.verTodas}</Link>
                    </>
                ) : (
                    <Link to="/recrutamento">{t.crews.verQuemRecruta}</Link>
                )}
            </p>

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

            {/*
              Mudar de ordem volta à primeira página: continuar na
              página 4 de outra ordenação é olhar para um sítio que já
              não quer dizer o mesmo.
            */}
            <div className="ordenar">
                <label htmlFor="crew-ordem">{t.crews.ordenarPor}</label>
                <select
                    id="crew-ordem"
                    value={ordem}
                    onChange={(event) => {
                        setOrdem(event.target.value as Ordem);
                        setPagina(1);
                    }}
                >
                    <option value="newest">{t.crews.ordemRecentes}</option>
                    <option value="level">{t.crews.ordemNivel}</option>
                    <option value="name">{t.crews.ordemNome}</option>
                </select>
            </div>

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
                        {pesquisa
                            ? t.crews.resultados(pesquisa)
                            : apenasRecrutamento
                              ? t.crews.aRecrutarAgora
                              : t.crews.todas}
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
