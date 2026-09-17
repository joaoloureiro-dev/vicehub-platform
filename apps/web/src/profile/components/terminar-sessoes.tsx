import { useState } from 'react';

import { Alert } from '../../auth/components/alert.js';
import { logoutEverywhere } from '../../auth/auth.api.js';
import { useT } from '../../i18n/i18n.js';

/**
 * Terminar a sessão em todo o lado.
 *
 * A rota existia na API desde o princípio e não tinha por onde ser
 * chamada. Quem desconfia que lhe apanharam a conta só podia trocar a
 * password — e trocar a password não põe fora quem já está lá dentro.
 *
 * Não fica ao lado de levar os dados e apagar a conta, apesar de ser a
 * mesma zona da página. Essas duas são o que se faz para sair, e nessa
 * ordem; esta é o contrário — é o que se faz para **ficar** e pôr fora
 * outra pessoa. Misturá-las dava a entender que era mais um passo da
 * despedida.
 *
 * Não pede confirmação escrita como apagar a conta: não se perde nada,
 * volta-se a entrar. O que se diz, e por isso está no texto, é que este
 * dispositivo também vai abaixo — senão quem carrega leva um salto para
 * o ecrã de entrada sem perceber porquê.
 */
export const TerminarSessoes = () => {
    const t = useT();

    const [aTerminar, setATerminar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const terminar = async () => {
        setATerminar(true);
        setErro(null);

        try {
            await logoutEverywhere();

            /**
             * Não se navega para lado nenhum: a memória da sessão foi
             * limpa e o guard das rotas leva daqui para o ecrã de
             * entrada sozinho. Mandar também daqui era a mesma pessoa a
             * ser empurrada duas vezes.
             */
        } catch {
            setErro(t.perfil.terminarSessoesFalhou);
            setATerminar(false);
        }
    };

    return (
        <section className="grupo">
            <h2>{t.perfil.terminarSessoes}</h2>

            <p className="hint">{t.perfil.terminarSessoesExplicacao}</p>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <button
                className="btn-secondary"
                disabled={aTerminar}
                onClick={() => void terminar()}
                type="button"
            >
                {aTerminar
                    ? t.perfil.terminarSessoesATerminar
                    : t.perfil.terminarSessoesConfirmar}
            </button>
        </section>
    );
};
