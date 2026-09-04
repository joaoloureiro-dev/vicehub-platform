import { Link } from 'react-router';

import { useT } from '../i18n/i18n.js';

/**
 * A porta de entrada.
 *
 * Antes disto, quem recebia o endereço caía numa caixa de início de
 * sessão sem nada que dissesse o que isto é — e a pessoa a quem se pede
 * para experimentar uma coisa é precisamente a que ainda não tem conta.
 *
 * O que aqui se conta é o que a plataforma **já faz**, e não o que há de
 * fazer: a promessa que não se cumpre gasta-se à primeira.
 */
export const LandingPage = () => {
    const t = useT();

    return (
        <div className="landing">
            <header className="landing-hero">
                <img
                    className="landing-marca"
                    src="/vicehub-logo.png"
                    alt=""
                    width={88}
                    height={88}
                />
                <h1>{t.landing.titulo}</h1>
                <p className="landing-sub">{t.landing.subtitulo}</p>

                <div className="landing-acoes">
                    <Link className="primary como-botao" to="/registo">
                        {t.landing.criarConta}
                    </Link>
                    <Link className="btn-secondary" to="/crews">
                        {t.landing.verCrews}
                    </Link>
                </div>

                <Link className="landing-entrar" to="/entrar">
                    {t.landing.jaTenhoConta}
                </Link>
            </header>

            <section className="landing-pontos">
                <article>
                    <h2>{t.landing.crewsTitulo}</h2>
                    <p>{t.landing.crewsTexto}</p>
                </article>
                <article>
                    <h2>{t.landing.tesourariaTitulo}</h2>
                    <p>{t.landing.tesourariaTexto}</p>
                </article>
                <article>
                    <h2>{t.landing.eventosTitulo}</h2>
                    <p>{t.landing.eventosTexto}</p>
                </article>
            </section>

            <aside className="landing-honesto">
                <b>{t.landing.honesto}</b>
                <p>{t.landing.honestoTexto}</p>
            </aside>
        </div>
    );
};
