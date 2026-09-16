import { Link } from 'react-router';

import { useT } from '../i18n/i18n.js';

/**
 * O rodapé.
 *
 * Existe por uma razão concreta antes de qualquer razão de desenho: a
 * Stripe não activa uma conta sem termos e privacidade acessíveis a
 * partir do sítio, e "acessíveis" quer dizer com um link em todas as
 * páginas, não uma morada que é preciso adivinhar.
 *
 * Fica fora do `<main>` para que um leitor de ecrã o anuncie como o que
 * é. O aviso da marca fica aqui e não só nos termos porque é onde o
 * jogo é nomeado — a apresentação diz "GTA VI" logo no primeiro ecrã, e
 * a resposta a isso deve estar no mesmo ecrã.
 */
export const Rodape = () => {
    const t = useT();

    return (
        <footer className="rodape">
            <nav aria-label={t.legal.rodape}>
                <Link to="/termos">{t.legal.termos}</Link>
                <Link to="/privacidade">{t.legal.privacidade}</Link>
            </nav>

            <p className="hint">{t.legal.marcas}</p>
        </footer>
    );
};
