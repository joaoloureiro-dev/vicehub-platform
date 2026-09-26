import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import {
    enderecoDoAlvo,
    getHistory,
    handleReport,
    listReports,
    type Autor,
    type DenunciaNaFila,
    type Historial,
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

/**
 * O que já foi decidido antes, de quem escreveu e de quem denunciou.
 *
 * A denúncia que o moderador tem à frente diz o que aconteceu uma vez.
 * Não diz se é a primeira vez ou a décima, nem se quem a apresentou já
 * apresentou quarenta sem razão — e as duas coisas mudam a decisão.
 *
 * **Pede-se, não se mostra sozinho.** São duas idas à API por denúncia,
 * e uma fila de trinta pedia sessenta para números que, na maior parte
 * das linhas, ninguém precisa de ver. Quem precisa, carrega.
 *
 * E a frase por baixo dos números não é decoração: é a regra de leitura
 * deles. Sem ela, um "3" ao lado de um nome lê-se como três vezes
 * denunciado — que é outra coisa, e é coisa que dez pessoas combinadas
 * conseguem fabricar.
 */
const Historico = ({
    autor,
    denunciante,
}: {
    autor: Autor | null;
    denunciante: Autor | null;
}) => {
    const t = useT();

    const [aberto, setAberto] = useState(false);
    const [aCarregar, setACarregar] = useState(false);
    const [falhou, setFalhou] = useState(false);
    const [doAutor, setDoAutor] = useState<Historial | null>(null);
    const [doDenunciante, setDoDenunciante] = useState<Historial | null>(null);

    const abrir = async () => {
        setAberto(true);
        setACarregar(true);
        setFalhou(false);

        try {
            const [primeiro, segundo] = await Promise.all([
                autor === null ? null : getHistory(autor.id),
                denunciante === null ? null : getHistory(denunciante.id),
            ]);

            setDoAutor(primeiro);
            setDoDenunciante(segundo);
        } catch {
            setFalhou(true);
        } finally {
            setACarregar(false);
        }
    };

    /**
     * Sem nenhum dos dois não há nada a perguntar: as duas contas
     * saíram, e o que resta é uma denúncia sem ninguém de qualquer dos
     * lados.
     */
    if (autor === null && denunciante === null) {
        return null;
    }

    if (!aberto) {
        return (
            <p className="hint">
                <button className="link" type="button" onClick={() => void abrir()}>
                    {t.moderacao.verHistorial}
                </button>
            </p>
        );
    }

    return (
        <div className="historial">
            {aCarregar ? <p className="hint">{t.comum.aCarregar}</p> : null}

            {falhou ? (
                <p className="hint">{t.moderacao.historialFalhou}</p>
            ) : null}

            {doAutor ? (
                <p className="hint">
                    {t.moderacao.escreveu(
                        autor?.username ?? '',
                        doAutor.written.acted,
                        doAutor.written.dismissed,
                    )}
                </p>
            ) : null}

            {doDenunciante ? (
                <p className="hint">
                    {t.moderacao.denunciou(
                        denunciante?.username ?? '',
                        doDenunciante.filed.acted,
                        doDenunciante.filed.dismissed,
                    )}
                </p>
            ) : null}

            {doAutor || doDenunciante ? (
                <p className="hint nota-do-historial">
                    {t.moderacao.historialNota}
                </p>
            ) : null}
        </div>
    );
};

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
                <p><Link className="ligacao-solta" to="/forum">{t.forum.voltar}</Link></p>
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
                                    <Link
                                        className="ligacao-solta"
                                        to={enderecoDoAlvo(denuncia.target)}
                                    >
                                        {t.moderacao.verOAlvo}
                                    </Link>
                                </p>
                            </div>

                            <Historico
                                autor={denuncia.target.author}
                                denunciante={denuncia.reporter}
                            />

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
