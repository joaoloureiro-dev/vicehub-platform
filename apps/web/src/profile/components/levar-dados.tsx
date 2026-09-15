import { useState } from 'react';

import { Alert } from '../../auth/components/alert.js';
import { useT } from '../../i18n/i18n.js';
import { exportMyAccount } from '../profile.api.js';

/**
 * Levar os dados consigo.
 *
 * O ficheiro é montado aqui e não pedido como link: a rota exige o
 * token da sessão, e um `<a href>` não o leva — abriria um 401 num
 * separador em branco.
 *
 * Fica ao lado de apagar a conta de propósito, e **antes** dela: quem
 * chega a esta parte da página está a pensar em sair, e a ordem em que
 * as duas aparecem é a ordem por que devem ser feitas.
 */
export const LevarDados = () => {
    const t = useT();

    const [aPreparar, setAPreparar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const levar = async () => {
        setAPreparar(true);
        setErro(null);

        try {
            const dados = await exportMyAccount();

            /**
             * O download é feito com um objeto na memória do browser.
             * O endereço é revogado a seguir: sem isso, o ficheiro
             * ficava preso na memória do separador até ele fechar.
             */
            const url = URL.createObjectURL(
                new Blob([JSON.stringify(dados, null, 2)], {
                    type: 'application/json',
                }),
            );

            const ligacao = document.createElement('a');

            ligacao.href = url;
            ligacao.download = `vicehub-${String(
                (dados.account as { username?: string } | undefined)?.username ??
                    'conta',
            )}-${new Date().toISOString().slice(0, 10)}.json`;

            ligacao.click();

            URL.revokeObjectURL(url);
        } catch {
            setErro(t.perfil.levarDadosFalhou);
        } finally {
            setAPreparar(false);
        }
    };

    return (
        <section className="grupo">
            <h2>{t.perfil.levarDados}</h2>

            <p className="hint">{t.perfil.levarDadosExplicacao}</p>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <button
                className="btn-secondary"
                disabled={aPreparar}
                onClick={() => void levar()}
                type="button"
            >
                {aPreparar
                    ? t.perfil.levarDadosAPreparar
                    : t.perfil.levarDadosBotao}
            </button>
        </section>
    );
};
