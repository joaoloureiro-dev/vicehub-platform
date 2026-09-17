import { Link } from 'react-router';

import { listMyMemberships } from '../../crews/crew.api.js';
import { listMyServerMemberships } from '../../servers/server.api.js';
import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';

/**
 * O que fazer a seguir, a quem ainda não pertence a nada.
 *
 * Quem acaba de criar conta aterra no perfil. E o perfil, visto por
 * olhos que chegaram há um minuto, é uma página de administração da
 * conta: os dados, a apresentação, levar os dados, terminar sessões,
 * apagar a conta. Nada ali diz o que a página de entrada tinha acabado
 * de prometer — gerir uma crew, mover o que ela ganha.
 *
 * A navegação tem os caminhos, mas a navegação não é o que a pessoa
 * está a olhar. Os diretórios já fazem isto quando estão vazios — "cria
 * a primeira" —, e este é o mesmo gesto um passo antes.
 *
 * Desaparece assim que a pessoa pertence a alguma coisa: a partir daí
 * já sabe o caminho, e um cartão a dizer-lhe o que fazer passa a ser
 * ruído numa página que ela abre por outra razão.
 */
export const PrimeiroPasso = () => {
    const t = useT();

    /**
     * As duas listas que a página das comunidades já pede. Um 403 ou
     * uma falha não é razão para prender ninguém: sem resposta, não se
     * mostra nada — e não se mostra nada é exatamente o que acontecia
     * antes disto existir.
     */
    const crews = useAsync(() => listMyMemberships().catch(() => null), []);
    const servidores = useAsync(
        () => listMyServerMemberships().catch(() => null),
        [],
    );

    if (crews.loading || servidores.loading) {
        return null;
    }

    const pertenceA =
        (crews.data?.length ?? 0) + (servidores.data?.length ?? 0);

    if (pertenceA > 0 || crews.data === null || servidores.data === null) {
        return null;
    }

    return (
        <section className="grupo primeiro-passo">
            <h2>{t.perfil.primeiroPassoTitulo}</h2>

            <p className="hint">{t.perfil.primeiroPassoExplicacao}</p>

            <div className="linha-acoes">
                <Link className="primary" to="/crews/nova">
                    {t.perfil.primeiroPassoCriar}
                </Link>
                {/*
                  Entrar numa que já existe vem a seguir e não antes:
                  quem chega com gente sua cria; quem chega sozinho
                  procura. A ordem é a do caso mais comum, não a do mais
                  fácil.
                */}
                <Link className="btn-secondary" to="/recrutamento">
                    {t.perfil.primeiroPassoProcurar}
                </Link>
            </div>
        </section>
    );
};
