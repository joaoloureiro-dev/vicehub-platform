import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { useAsync } from '../../lib/use-async.js';
import { useT, useIdioma } from '../../i18n/i18n.js';
import { mensagemDoErro } from '../../lib/erro.js';
import { useAvisos } from '../avisos.context.js';
import {
    enderecoDoAviso,
    listNotifications,
    markAllRead,
    markRead,
    type Aviso,
} from '../avisos.api.js';

/**
 * A caixa de avisos.
 *
 * Existe porque a plataforma passou a ter sítios onde outra pessoa fala
 * contigo — uma conversa sobre um anúncio, uma resposta a uma pergunta,
 * uma avaliação — e nenhum deles tinha como te dizer que falou. Sem
 * isto, a conversa do mercado é uma conversa que ninguém sabe que tem.
 *
 * **Abrir a caixa não dá tudo por lido.** Quem chega aqui a meio de uma
 * tarde tem o direito de ver o que estava por ler, e uma caixa que se
 * limpa ao ser aberta perde precisamente isso. Dá-se por lido o que se
 * abre, e há um botão para dar tudo de uma vez.
 */
const Linha = ({
    aviso,
    aoAbrir,
}: {
    aviso: Aviso;
    aoAbrir: (id: string) => void;
}) => {
    const t = useT();
    const { idioma } = useIdioma();

    const quem = aviso.actor?.username ?? t.avisos.alguem;

    return (
        <li className={aviso.isRead ? 'aviso' : 'aviso por-ler'}>
            <Link
                to={enderecoDoAviso(aviso)}
                onClick={() => {
                    aoAbrir(aviso.id);
                }}
            >
                <p className="aviso-cabeca">
                    <span>
                        {t.avisos.oQueAconteceu[aviso.kind](quem)}
                        {aviso.about ? ` ${aviso.about}` : ''}
                    </span>
                    <time dateTime={aviso.createdAt}>
                        {new Date(aviso.createdAt).toLocaleDateString(idioma)}
                    </time>
                </p>

                {aviso.excerpt ? (
                    <p className="texto excerto">{aviso.excerpt}</p>
                ) : null}
            </Link>
        </li>
    );
};

export const AvisosPage = () => {
    const t = useT();
    const { recarregar } = useAvisos();

    const [erro, setErro] = useState<string | null>(null);

    const caixa = useAsync(() => listNotifications(1), []);

    if (caixa.error) {
        return (
            <main className="panel wide">
                <Alert kind="bad">
                    {mensagemDoErro(caixa.error, t, t.avisos.naoCarregou)}
                </Alert>
            </main>
        );
    }

    const dados = caixa.data;

    const darPorLido = (id: string) => {
        /**
         * Não se espera pela resposta: a pessoa está a navegar para
         * outro sítio, e segurar-lhe o clique por causa de um número
         * numa barra era pagar com a única coisa que ela queria.
         */
        void markRead(id)
            .then(recarregar)
            .catch(() => undefined);
    };

    const darTudoPorLido = async () => {
        setErro(null);

        try {
            await markAllRead();
            caixa.reload();
            recarregar();
        } catch (falha) {
            setErro(mensagemDoErro(falha, t, t.avisos.naoFoiPossivelLer));
        }
    };

    return (
        <main className="panel wide mercado">
            <header className="card header">
                <h1>{t.avisos.titulo}</h1>
                <p className="hint">{t.avisos.sub}</p>
            </header>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            {!dados ? (
                <p className="hint">{t.comum.aCarregar}</p>
            ) : dados.notifications.length === 0 ? (
                <p className="hint">{t.avisos.vazio}</p>
            ) : (
                <>
                    {dados.unread > 0 ? (
                        <div className="grupo-botoes">
                            <button
                                className="btn-secondary"
                                type="button"
                                onClick={() => void darTudoPorLido()}
                            >
                                {t.avisos.darTodosPorLidos}
                            </button>
                        </div>
                    ) : null}

                    <ul className="lista-avisos">
                        {dados.notifications.map((aviso) => (
                            <Linha
                                key={aviso.id}
                                aviso={aviso}
                                aoAbrir={darPorLido}
                            />
                        ))}
                    </ul>
                </>
            )}
        </main>
    );
};
