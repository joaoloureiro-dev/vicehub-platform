import { Link } from 'react-router';

import { useAsync } from '../lib/use-async.js';
import { Alert } from '../auth/components/alert.js';
import { useIdioma, useT } from '../i18n/i18n.js';
import { listActivity, type ActivityItem } from './feed.api.js';

/**
 * O que aconteceu enquanto estive fora.
 *
 * Sem nada para mostrar, a secção diz o que fazer para passar a haver —
 * um feed vazio sem explicação parece uma coisa avariada, e o que se
 * passa é apenas que ainda não aconteceu nada.
 */
export const Feed = () => {
    const t = useT();
    const { idioma } = useIdioma();

    const { data, loading, error } = useAsync(() => listActivity(), []);

    if (error) {
        return (
            <section className="grupo">
                <h2>{t.feed.titulo}</h2>
                <Alert kind="bad">{t.feed.naoCarregou}</Alert>
            </section>
        );
    }

    if (loading && !data) {
        return (
            <section className="grupo">
                <h2>{t.feed.titulo}</h2>
                <p className="hint">{t.comum.aCarregar}</p>
            </section>
        );
    }

    return (
        <section className="grupo">
            <h2>{t.feed.titulo}</h2>

            {data && data.length === 0 ? (
                <p className="hint">{t.feed.aindaNada}</p>
            ) : (
                <ul className="feed">
                    {(data ?? []).map((item) => (
                        <li key={item.id}>
                            <span className="feed-quando">
                                {new Date(item.at).toLocaleDateString(idioma)}
                            </span>
                            <span className="feed-texto">{descrever(item, t)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

/**
 * O que cada linha diz.
 *
 * A crew é sempre um link, porque a pergunta seguinte é sempre "qual?".
 * O evento também, quando ainda existe: apagar um evento não apaga o que
 * ele deu, mas deixa de haver para onde apontar.
 */
const descrever = (item: ActivityItem, t: ReturnType<typeof useT>) => {
    const crew = <Link to={`/crews/${item.crew.id}`}>{item.crew.name}</Link>;

    if (item.kind === 'crew_event') {
        return item.event ? (
            <>
                {t.feed.eventoFeito(item.amount)} {crew}{' '}
                <Link to={`/crews/${item.crew.id}/eventos/${item.event.id}`}>
                    {item.event.name}
                </Link>
            </>
        ) : (
            <>
                {t.feed.eventoFeito(item.amount)} {crew}
            </>
        );
    }

    const pessoa = (
        <Link to={`/u/${item.person.username}`}>{item.person.username}</Link>
    );

    return (
        <>
            {pessoa} {t.feed.entrouEm} {crew}
        </>
    );
};
