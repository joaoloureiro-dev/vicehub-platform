import { Link } from 'react-router';

import { useT } from '../i18n/i18n.js';
import { LanguagePicker } from '../i18n/language-picker.js';

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
 *
 * **E o idioma escolhe-se aqui**, que é onde estas coisas se escolhem
 * na maior parte dos sítios. Estava na barra de cima e não cabia: em
 * francês, "Notifications" e "Déconnexion" com o selector ao lado
 * davam 400 pixéis numa janela de 390, e **todos** os ecrãs de quem
 * tem sessão arrastavam-se de lado. Não é um item de navegação — é uma
 * preferência que se toca uma vez na vida, e estava a disputar a
 * largura com o que se usa todos os dias.
 */
export const Rodape = () => {
    const t = useT();

    return (
        <footer className="rodape">
            <nav aria-label={t.legal.rodape}>
                <Link to="/termos">{t.legal.termos}</Link>
                <Link to="/privacidade">{t.legal.privacidade}</Link>
            </nav>

            <LanguagePicker />

            <p className="hint">{t.legal.marcas}</p>
        </footer>
    );
};
