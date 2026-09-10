import { Link, useParams } from 'react-router';

import { useAsync } from '../../lib/use-async.js';
import { useAuth } from '../../auth/auth.context.js';
import { Alert } from '../../auth/components/alert.js';
import { BotaoDeAmizade } from '../components/botao-de-amizade.js';
import { listFriendRequests, listFriends } from '../friends.api.js';
import { getProfile } from '../profile.api.js';
import { Conquistas } from '../../components/conquistas.js';
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

    const { user } = useAuth();

    const { data, loading, error } = useAsync(
        () => getProfile(username as string),
        [username],
    );

    /**
     * O estado da amizade sai das listas que a API já devolve, e não de
     * um campo no perfil: assim o botão mostra sempre o que a API diria
     * se lhe perguntassem outra vez.
     */
    const amigos = useAsync(
        () => (user ? listFriends() : Promise.resolve(null)),
        [user?.id],
    );

    const pedidos = useAsync(
        () => (user ? listFriendRequests() : Promise.resolve(null)),
        [user?.id],
    );

    const recarregar = () => {
        amigos.reload();
        pedidos.reload();
    };

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

            {/*
              As conquistas vêm antes do botão de amizade: quem chega a
              um perfil está a decidir alguma coisa sobre a pessoa, e é
              isto que sustenta a decisão. O botão vem depois de haver
              razão para lhe tocar.
            */}
            <Conquistas conquistas={data.achievements} />

            {/*
              O botão só existe para outra pessoa: no próprio perfil não
              há nada a pedir, e a API recusaria de qualquer maneira.
            */}
            {user && user.id !== data.id ? (
                <BotaoDeAmizade
                    userId={data.id}
                    amigos={amigos.data}
                    pedidos={pedidos.data}
                    aoMudar={recarregar}
                />
            ) : null}
        </div>
    );
};
