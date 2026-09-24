import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import {
    enderecoDoAlvo,
    handleReport,
    listReports,
    type DenunciaNaFila,
} from '../moderation.api.js';

/**
 * A fila de quem modera.
 *
 * **Uma só para a plataforma inteira.** Era do fórum, e passou a ser de
 * todos quando o mercado abriu: são duas superfícies onde qualquer
 * pessoa com conta escreve à vista de toda a gente, e duas filas seriam
 * duas caixas de entrada para o mesmo trabalho — com a segunda a ficar
 * por abrir.
 *
 * As mais velhas primeiro, ao contrário do resto da plataforma: uma
 * denúncia por abrir é trabalho, e trabalho velho é o que mais urge.
 */
const ESTADOS = ['open', 'acted', 'dismissed'] as const;

type Estado = (typeof ESTADOS)[number];

export const FilaPage = () => {
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
            setErro(t.moderacao.naoFoiPossivelDecidir);
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
                <Alert kind="bad">{t.moderacao.filaNegada}</Alert>
                <p><Link to="/forum">{t.forum.voltar}</Link></p>
            </main>
        );
    }

    const dados = fila.data;

    return (
        <main className="panel wide">
            <header className="card header">
                <h1>{t.moderacao.filaTitulo}</h1>
                <p>{t.moderacao.filaSub}</p>
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
                        {t.moderacao.filaEstados[um]}
                    </button>
                ))}
            </nav>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            {!dados ? (
                <p className="hint">{t.comum.aCarregar}</p>
            ) : dados.reports.length === 0 ? (
                <p className="hint">{t.moderacao.filaVazia}</p>
            ) : (
                <ul className="lista-denuncias">
                    {dados.reports.map((denuncia) => (
                        <li key={denuncia.id} className="card">
                            <p className="denuncia-cabeca">
                                <span className="razao">
                                    {t.moderacao.razoes[denuncia.reason]}
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
                                    {t.moderacao.alvos[denuncia.target.kind]}
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

                                {/*
                                  O endereço vem do `kind`, e não de
                                  adivinhar qual dos identificadores
                                  veio preenchido: uma pergunta e uma
                                  resposta abrem-se no tópico, um
                                  anúncio abre-se no anúncio.
                                */}
                                <p className="hint">
                                    <Link to={enderecoDoAlvo(denuncia.target)}>
                                        {t.moderacao.verOAlvo}
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
                                        {t.moderacao.marcarTratada}
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void decidir(denuncia, 'dismissed')
                                        }
                                    >
                                        {t.moderacao.marcarSemRazao}
                                    </button>
                                </div>
                            ) : (
                                <p className="hint">
                                    {denuncia.status === 'acted'
                                        ? t.moderacao.jaTratada
                                        : t.moderacao.jaDispensada}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
};
