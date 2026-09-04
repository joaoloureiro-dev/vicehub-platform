import { Link } from 'react-router';

import { useAsync } from '../lib/use-async.js';
import { Alert } from '../auth/components/alert.js';
import { listMyMemberships } from '../crews/crew.api.js';
import { listMyServerMemberships } from '../servers/server.api.js';
import { useT } from '../i18n/i18n.js';

/**
 * Onde a pessoa pertence — crews e servidores no mesmo sítio.
 *
 * As candidaturas por responder aparecem primeiro, de propósito: sem
 * isso, quem pede entrada não tem forma de saber se já foi respondido, e
 * é essa pergunta que a faz voltar ao site.
 *
 * Os servidores estavam a faltar aqui. A função que os vai buscar já
 * existia e não era chamada por ninguém — uma função sem quem a use é
 * quase sempre um ecrã que ficou por fazer.
 */
export const MyCommunitiesPage = () => {
    const t = useT();

    const crews = useAsync(() => listMyMemberships(), []);
    const servidores = useAsync(() => listMyServerMemberships(), []);

    const aCarregar =
        (crews.loading && !crews.data) || (servidores.loading && !servidores.data);

    const falhou = crews.error || servidores.error;

    const crewsPendentes =
        crews.data?.filter((adesao) => adesao.status === 'pending') ?? [];
    const crewsAtivas =
        crews.data?.filter((adesao) => adesao.status === 'active') ?? [];

    const servidoresPendentes =
        servidores.data?.filter((adesao) => adesao.status === 'pending') ?? [];
    const servidoresAtivos =
        servidores.data?.filter((adesao) => adesao.status === 'active') ?? [];

    const pendentes = crewsPendentes.length + servidoresPendentes.length;
    const total = (crews.data?.length ?? 0) + (servidores.data?.length ?? 0);

    /** O cargo dito como se diz a uma pessoa, com recurso ao slug. */
    const cargo = (papel: string | null, omissao: keyof typeof t.cargos) =>
        t.cargos[(papel ?? omissao) as keyof typeof t.cargos] ?? papel;

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>{t.crews.asMinhasTitulo}</h1>
            </div>

            {falhou ? (
                <Alert kind="bad">{t.crews.naoCarregouMinhas}</Alert>
            ) : null}

            {aCarregar ? <p className="hint">{t.comum.aCarregar}</p> : null}

            {!aCarregar && !falhou && total === 0 ? (
                <p className="vazio">
                    {t.crews.semComunidades}{' '}
                    <Link to="/crews">{t.crews.procuraUma}</Link>{' '}
                    <Link to="/crews/nova">{t.crews.ouCriaTua}</Link>.
                </p>
            ) : null}

            {pendentes > 0 ? (
                <section className="grupo">
                    <h2>{t.crews.aEsperaResposta}</h2>
                    <ul className="pessoas">
                        {crewsPendentes.map((adesao) => (
                            <li key={adesao.crewId}>
                                <Link className="nome" to={`/crews/${adesao.crewId}`}>
                                    <span className="crewtag">[{adesao.tag}]</span>{' '}
                                    {adesao.name}
                                </Link>
                                <span className="pill aguarda">
                                    {t.crews.candidaturaEnviada}
                                </span>
                            </li>
                        ))}
                        {servidoresPendentes.map((adesao) => (
                            <li key={adesao.serverId}>
                                <Link
                                    className="nome"
                                    to={`/servidores/${adesao.serverId}`}
                                >
                                    {adesao.name}
                                </Link>
                                <span className="pill aguarda">
                                    {t.crews.candidaturaEnviada}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {crewsAtivas.length > 0 ? (
                <section className="grupo">
                    <h2>{t.crews.minhasCrews}</h2>
                    <ul className="pessoas">
                        {crewsAtivas.map((adesao) => (
                            <li key={adesao.crewId}>
                                <Link className="nome" to={`/crews/${adesao.crewId}`}>
                                    <span className="crewtag">[{adesao.tag}]</span>{' '}
                                    {adesao.name}
                                </Link>
                                <span className="cargo">
                                    {cargo(adesao.role, 'crew_member')}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {servidoresAtivos.length > 0 ? (
                <section className="grupo">
                    <h2>{t.crews.meusServidores}</h2>
                    <ul className="pessoas">
                        {servidoresAtivos.map((adesao) => (
                            <li key={adesao.serverId}>
                                <Link
                                    className="nome"
                                    to={`/servidores/${adesao.serverId}`}
                                >
                                    {adesao.name}
                                    {adesao.region ? (
                                        <span className="cargo"> · {adesao.region}</span>
                                    ) : null}
                                </Link>
                                <span className="cargo">
                                    {cargo(adesao.role, 'server_member')}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </div>
    );
};
