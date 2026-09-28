import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { getServer } from '../../servers/server.api.js';
import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import { getLeaderboard } from '../affiliation.api.js';

/**
 * O quadro de um servidor: quem joga lá, do mais alto xp ao mais baixo.
 *
 * **É o que dá às crews uma razão para competir dentro de um
 * servidor.** O xp já existia e já subia com os eventos concluídos; o
 * que não havia era o sítio onde ele quer dizer alguma coisa a alguém
 * — até aqui, uma crew via o seu número e mais nada.
 *
 * Sem sessão, como a lista das crews do servidor: quem anda à procura
 * de onde levar a sua crew quer ver contra quem vai jogar antes de
 * criar conta nenhuma.
 */
export const LeaderboardPage = () => {
    const t = useT();
    const { serverId = '' } = useParams();

    const [pagina, setPagina] = useState(1);

    const servidor = useAsync(() => getServer(serverId), [serverId]);
    const quadro = useAsync(
        () => getLeaderboard(serverId, pagina),
        [serverId, pagina],
    );

    if (servidor.error) {
        return (
            <main className="panel wide">
                <Alert kind="bad">{t.servidores.naoEncontrado}</Alert>
            </main>
        );
    }

    if (quadro.error) {
        return (
            <main className="panel wide">
                <Alert kind="bad">{t.quadro.naoCarregou}</Alert>
            </main>
        );
    }

    const linhas = quadro.data?.entries ?? [];

    return (
        <main className="panel wide esticado">
            <p className="hint">
                <Link className="ligacao-solta" to={`/servidores/${serverId}`}>
                    {t.quadro.voltarAoServidor}
                </Link>
            </p>

            <header className="card header">
                <h1>{t.quadro.titulo}</h1>
                <p>
                    {servidor.data
                        ? t.quadro.subtitulo(servidor.data.name)
                        : t.comum.aCarregar}
                </p>
            </header>

            {linhas.length === 0 ? (
                <p className="hint">{t.quadro.aindaSemCrews}</p>
            ) : (
                <>
                    {/*
                      Uma tabela, e não uma lista de cartões.

                      É o que um quadro é: colunas que se comparam de
                      cima a baixo. Em cartões, o lugar de cada crew
                      fica ao lado do nome dela e deixa de se ler como
                      uma ordem — que é a única coisa que este ecrã tem
                      para dizer.
                    */}
                    <table className="quadro">
                        <thead>
                            <tr>
                                <th scope="col">{t.quadro.lugar}</th>
                                <th scope="col">{t.quadro.crew}</th>
                                <th scope="col">{t.quadro.nivel}</th>
                                <th scope="col">{t.quadro.xp}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {linhas.map((linha) => (
                                <tr key={linha.crewId}>
                                    <td className="quadro-lugar">
                                        {linha.position}
                                    </td>
                                    <td>
                                        <Link to={`/crews/${linha.crewId}`}>
                                            {linha.crewName}
                                        </Link>{' '}
                                        <span className="quadro-etiqueta">
                                            {linha.crewTag}
                                        </span>
                                    </td>
                                    <td>{linha.level}</td>
                                    <td className="quadro-xp">{linha.xp}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/*
                      As regras do quadro, por baixo dele.

                      Duas crews com o mesmo xp partilham o lugar, e
                      quem lê um empate sem saber disso lê um erro.
                    */}
                    <p className="hint">{t.quadro.comoSeConta}</p>

                    {(quadro.data?.pages ?? 1) > 1 ? (
                        <div className="paginacao">
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={pagina <= 1}
                                onClick={() => {
                                    setPagina((valor) => valor - 1);
                                }}
                            >
                                {t.crews.anterior}
                            </button>
                            <span>
                                {t.crews.paginaDe(
                                    quadro.data?.page ?? 1,
                                    quadro.data?.pages ?? 1,
                                )}
                            </span>
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={pagina >= (quadro.data?.pages ?? 1)}
                                onClick={() => {
                                    setPagina((valor) => valor + 1);
                                }}
                            >
                                {t.crews.seguinte}
                            </button>
                        </div>
                    ) : null}
                </>
            )}
        </main>
    );
};
