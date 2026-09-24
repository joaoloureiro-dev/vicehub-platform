import { Link } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { useAsync } from '../../lib/use-async.js';
import { useT, useIdioma } from '../../i18n/i18n.js';
import { mensagemDoErro } from '../../lib/erro.js';
import {
    formatarMontante,
    separadorDoIdioma,
} from '../../treasury/treasury.types.js';
import { listConversations } from '../conversas.api.js';

/**
 * A caixa de entrada do mercado.
 *
 * Uma lista só para os dois papéis: o que perguntei e o que me
 * perguntaram. Separá-las obrigava quem vende e compra no mesmo
 * servidor — que são quase todos — a olhar para dois sítios para saber
 * se lhe responderam.
 *
 * Cada linha mostra **a outra pessoa**, e não sempre o mesmo nome: uma
 * lista com o próprio nome em todas as linhas obrigava a abri-las uma a
 * uma para saber com quem se estava a falar.
 */
export const ConversasPage = () => {
    const t = useT();
    const { idioma } = useIdioma();

    const caixa = useAsync(() => listConversations(1), []);

    if (caixa.error) {
        return (
            <main className="panel wide">
                <Alert kind="bad">
                    {mensagemDoErro(
                        caixa.error,
                        t,
                        t.mercado.naoCarregouConversas,
                    )}
                </Alert>
            </main>
        );
    }

    const conversas = caixa.data?.conversations ?? [];

    return (
        <main className="panel wide mercado">
            <header className="card header">
                <h1>{t.mercado.conversas}</h1>
                <p className="hint">{t.mercado.conversasPrivadas}</p>
            </header>

            {!caixa.data ? (
                <p className="hint">{t.comum.aCarregar}</p>
            ) : conversas.length === 0 ? (
                <p className="hint">{t.mercado.semConversas}</p>
            ) : (
                <ul className="lista-conversas">
                    {conversas.map((conversa) => (
                        <li key={conversa.id} className="card">
                            <Link to={`/mercado/conversas/${conversa.id}`}>
                                <p className="conversa-cabeca">
                                    <strong>
                                        {conversa.comQuem?.username
                                            ?? t.mercado.contaApagada}
                                    </strong>
                                    <time dateTime={conversa.updatedAt}>
                                        {new Date(
                                            conversa.updatedAt,
                                        ).toLocaleDateString(idioma)}
                                    </time>
                                </p>

                                <p className="hint">
                                    {t.mercado.sobreOAnuncio}
                                    {' '}
                                    {conversa.listing.title}
                                    {' · '}
                                    {formatarMontante(
                                        conversa.listing.price,
                                        separadorDoIdioma(idioma),
                                    )}
                                </p>

                                {conversa.ultima ? (
                                    <p className="texto ultima-mensagem">
                                        {conversa.ultima.body === ''
                                            ? t.mercado.retiradaComAConta
                                            : conversa.ultima.body}
                                    </p>
                                ) : null}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
};
