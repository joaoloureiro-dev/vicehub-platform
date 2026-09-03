import { Link, useParams } from 'react-router';

import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import { getProfile } from '../profile.api.js';
import { useIdioma, useT } from '../../i18n/i18n.js';

/**
 * O perfil de outra pessoa.
 *
 * Não mostra email, último início de sessão nem datas de faturação — a
 * API nem sequer os envia por aqui. O selo premium é um booleano: dizer
 * que alguém é premium é diferente de expor até quando pagou.
 */
export const PublicProfilePage = () => {
    const t = useT();
    const { idioma } = useIdioma();
    const { username } = useParams<{ username: string }>();

    const { data, loading, error } = useAsync(
        () => getProfile(username as string),
        [username],
    );

    if (loading && !data) {
        return <p className="centered">{t.comum.aCarregar}</p>;
    }

    if (error || !data) {
        return (
            <div className="panel">
                <Alert kind="bad">{t.perfil.naoEncontrado}</Alert>
                <div className="foot">
                    <Link to="/crews">{t.perfil.irParaCrews}</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="panel wide">
            <header
                className="crewhead"
                style={
                    data.appearance.accentColor
                        ? { borderColor: data.appearance.accentColor }
                        : undefined
                }
            >
                {data.appearance.bannerUrl ? (
                    <img className="banner" src={data.appearance.bannerUrl} alt="" />
                ) : null}

                <div className="crewhead-body">
                    {data.isPremium ? <span className="pill">{t.perfil.premium}</span> : null}
                    <h1>{data.username}</h1>
                    {data.bio ? <p>{data.bio}</p> : null}
                </div>
            </header>

            <dl className="stats">
                <div>
                    <dt>{t.perfil.nivel}</dt>
                    <dd>{data.level}</dd>
                </div>
                <div>
                    <dt>{t.crews.xp}</dt>
                    <dd>{data.xp}</dd>
                </div>
                <div>
                    <dt>{t.perfil.reputacao}</dt>
                    <dd>{data.reputation}</dd>
                </div>
                <div>
                    <dt>{t.perfil.desde}</dt>
                    <dd>{new Date(data.createdAt).toLocaleDateString(idioma)}</dd>
                </div>
            </dl>
        </div>
    );
};
