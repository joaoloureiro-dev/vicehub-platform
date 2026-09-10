import { Link } from 'react-router';

import { CrewCard } from '../crews/components/crew-card.js';
import { listCrews } from '../crews/crew.api.js';
import { listServers } from '../servers/server.api.js';
import { useAsync } from '../lib/use-async.js';
import { useT } from '../i18n/i18n.js';

/** Quantos se mostram de cada coisa. Chega para dar sinal de vida. */
const AMOSTRA = 3;

/**
 * A porta de entrada.
 *
 * A primeira versão desta página dizia o que a plataforma faz e não
 * mostrava nada a acontecer. Quem chegava via três parágrafos e dois
 * botões, e não tinha maneira de saber se do outro lado havia alguém —
 * e uma plataforma de comunidades que parece vazia está a dizer a quem
 * chega que chegou tarde.
 *
 * Agora mostra crews a recrutar e servidores online, lidos ao vivo dos
 * mesmos diretórios públicos que qualquer visitante pode abrir. Não há
 * aqui nada inventado para encher: se não houver ninguém a recrutar, a
 * secção não aparece, e a página diz o que faz em vez de fingir
 * movimento.
 */
export const LandingPage = () => {
    const t = useT();

    const recrutamento = useAsync(
        () => listCrews({ recruiting: true, page: 1 }),
        [],
    );

    const servidores = useAsync(() => listServers({ page: 1 }), []);

    /**
     * Só os que estão mesmo online. Um servidor apagado da lista por
     * estar em baixo é melhor do que um servidor na montra a dizer que
     * está fechado.
     */
    const online = (servidores.data?.items ?? [])
        .filter((servidor) => servidor.isOnline)
        .slice(0, AMOSTRA);

    const aRecrutar = (recrutamento.data?.items ?? []).slice(0, AMOSTRA);

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
                    <Link className="btn-secondary" to="/recrutamento">
                        {t.landing.verRecrutamento}
                    </Link>
                </div>

                <Link className="landing-entrar" to="/entrar">
                    {t.landing.jaTenhoConta}
                </Link>
            </header>

            {/*
              Quem está a recrutar vem primeiro porque é a única coisa
              nesta página em que um visitante pode agir já: encontrar
              uma crew e pedir entrada. Tudo o resto é leitura.
            */}
            {aRecrutar.length > 0 ? (
                <section className="landing-vivo">
                    <div className="landing-vivo-head">
                        <h2>{t.landing.quemRecruta}</h2>
                        <Link to="/recrutamento">{t.landing.verTudo}</Link>
                    </div>

                    <div className="crewgrid">
                        {aRecrutar.map((crew) => (
                            <CrewCard key={crew.id} crew={crew} />
                        ))}
                    </div>
                </section>
            ) : null}

            {online.length > 0 ? (
                <section className="landing-vivo">
                    <div className="landing-vivo-head">
                        <h2>{t.landing.agoraOnline}</h2>
                        <Link to="/servidores">{t.landing.verTudo}</Link>
                    </div>

                    <ul className="landing-servidores">
                        {online.map((servidor) => (
                            <li key={servidor.id}>
                                <Link to={`/servidores/${servidor.id}`}>
                                    <span className="ponto-online" aria-hidden="true" />
                                    <b>{servidor.name}</b>
                                    {/*
                                      A contagem só aparece a quem a
                                      reportou. Null quer dizer "ninguém
                                      instalou o recurso ainda", e mostrar
                                      zero seria dizer que o servidor está
                                      vazio — que é outra coisa.
                                    */}
                                    {servidor.playersOnline !== null ? (
                                        <span className="landing-jogadores">
                                            {t.landing.jogadores(servidor.playersOnline)}
                                        </span>
                                    ) : null}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

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

            {/*
              O que o plano dá, na própria página.

              Estava atrás de um link, e um link é a pior forma de
              responder à pergunta que toda a gente faz antes de criar
              conta. Quem tem de clicar para saber o que custa parte do
              princípio de que custa muito.
            */}
            <section className="landing-planos">
                <h2>{t.landing.planosTitulo}</h2>
                <p className="hint">{t.landing.planosGratis}</p>

                <div className="planos">
                    <article>
                        <h3>{t.landing.planoCrew}</h3>
                        <p className="preco">{t.landing.planoCrewPreco}</p>
                        <p>{t.landing.planoCrewTexto}</p>
                    </article>
                    <article className="destaque">
                        <h3>{t.landing.planoServidor}</h3>
                        <p className="preco">{t.landing.planoServidorPreco}</p>
                        <p>{t.landing.planoServidorTexto}</p>
                    </article>
                </div>

                <Link className="btn-secondary" to="/premium">
                    {t.landing.verPremium}
                </Link>
            </section>

            <aside className="landing-honesto">
                <b>{t.landing.honesto}</b>
                <p>{t.landing.honestoTexto}</p>
            </aside>
        </div>
    );
};
