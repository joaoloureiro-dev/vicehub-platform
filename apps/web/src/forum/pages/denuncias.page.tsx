import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import {
    handleReport,
    listReports,
    type DenunciaNaFila,
} from '../forum.api.js';

/**
 * A fila de quem modera.
 *
 * Uma fila que ninguém consegue abrir é um sítio onde as denúncias vão
 * morrer — que é exactamente o erro que a moderação do fórum já tinha
 * antes de ter botões. Por isso este ecrã existe ao mesmo tempo que a
 * denúncia, e não a seguir.
 *
 * As mais velhas primeiro, ao contrário do resto da plataforma: uma
 * denúncia por abrir é trabalho, e trabalho velho é o que mais urge.
 */
const ESTADOS = ['open', 'acted', 'dismissed'] as const;

type Estado = (typeof ESTADOS)[number];

export const DenunciasPage = () => {
    const t = useT();

    const [estado, setEstado] = useState<Estado>('open');
    const [erro, setErro] = useState<string | null>(null);
    const [aAgir, setAAgir] = useState(false);

    const fila = useAsync(() => listReports(estado), [estado]);

    const decidir = async (
        denuncia: DenunciaNaFila,
        outcome: 'acted' | 'dismissed',
    ) => {
        setErro(null);
        setAAgir(true);

        try {
            await handleReport(denuncia.id, outcome);
            fila.reload();
        } catch {
            setErro(t.forum.naoFoiPossivelDecidir);
        } finally {
            setAAgir(false);
        }
    };

    /**
     * Quem não modera não chega aqui pelo menu, mas pode chegar pelo
     * endereço. A API recusa, e o que se mostra é isso — e não um ecrã
     * vazio que se lê como "não há denúncias".
     */
    if (fila.error) {
        return (
            <main className="panel wide">
                <Alert kind="bad">{t.forum.filaNegada}</Alert>
                <p><Link to="/forum">{t.forum.voltar}</Link></p>
            </main>
        );
    }

    const dados = fila.data;

    return (
        <main className="panel wide">
            <header className="card header">
                <h1>{t.forum.filaTitulo}</h1>
                <p>{t.forum.filaSub}</p>
            </header>

            <nav className="abas">
                {/*
                  * Os rótulos das abas dizem **estados**, e os dos
                  * botões dizem **ações**. Chegaram a ser os mesmos, e
                  * o resultado era um ecrã com dois controlos com o
                  * mesmo nome a fazer coisas diferentes: um filtrava a
                  * lista, o outro decidia uma denúncia.
                  */}
                {ESTADOS.map((um) => (
                    <button
                        key={um}
                        className={um === estado ? 'aba activa' : 'aba'}
                        type="button"
                        onClick={() => {
                            setEstado(um);
                        }}
                    >
                        {t.forum.filaEstados[um]}
                    </button>
                ))}
            </nav>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            {!dados ? (
                <p className="hint">{t.comum.aCarregar}</p>
            ) : dados.reports.length === 0 ? (
                <p className="hint">{t.forum.filaVazia}</p>
            ) : (
                <ul className="lista-denuncias">
                    {dados.reports.map((denuncia) => (
                        <li key={denuncia.id} className="card">
                            <p className="denuncia-cabeca">
                                <span className="razao">
                                    {t.forum.razoes[denuncia.reason]}
                                </span>
                                <span className="quem">
                                    {denuncia.reporter?.username
                                        ?? t.forum.contaApagada}
                                </span>
                                <time dateTime={denuncia.createdAt}>
                                    {new Date(
                                        denuncia.createdAt,
                                    ).toLocaleDateString()}
                                </time>
                            </p>

                            {denuncia.note ? (
                                <p className="texto nota">{denuncia.note}</p>
                            ) : null}

                            <div className="denunciado">
                                <p className="hint">
                                    {denuncia.target.kind === 'topic'
                                        ? t.forum.alvoPergunta
                                        : t.forum.alvoResposta}
                                    {' · '}
                                    {denuncia.target.author?.username
                                        ?? t.forum.contaApagada}
                                </p>

                                {denuncia.target.isRemoved ? (
                                    <p className="texto retirado">
                                        {t.forum.jaRetirado}
                                    </p>
                                ) : (
                                    <p className="texto">
                                        {denuncia.target.title
                                            ?? denuncia.target.body
                                            ?? t.forum.retiradoComAConta}
                                    </p>
                                )}

                                <p className="hint">
                                    <Link to={`/forum/${denuncia.target.topicId}`}>
                                        {t.forum.verNoForum}
                                    </Link>
                                </p>
                            </div>

                            {denuncia.status === 'open' ? (
                                <div className="grupo-botoes">
                                    <button
                                        className="btn-secondary"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void decidir(denuncia, 'acted')
                                        }
                                    >
                                        {t.forum.marcarTratada}
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void decidir(denuncia, 'dismissed')
                                        }
                                    >
                                        {t.forum.marcarSemRazao}
                                    </button>
                                </div>
                            ) : (
                                <p className="hint">
                                    {denuncia.status === 'acted'
                                        ? t.forum.jaTratada
                                        : t.forum.jaDispensada}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
};
