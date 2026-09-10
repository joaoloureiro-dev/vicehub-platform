import { Link } from 'react-router';

import { CrewCard } from '../crews/components/crew-card.js';
import { listCrews } from '../crews/crew.api.js';
import { listPublicEvents } from '../events/event.api.js';
import { listServers } from '../servers/server.api.js';
import { useAsync } from '../lib/use-async.js';
import { useIdioma, useT } from '../i18n/i18n.js';
import { criarTools } from '../i18n/tools.js';

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
 * Agora mostra o que está a acontecer, quem está a recrutar e que
 * servidores estão de pé, lido ao vivo das rotas públicas que qualquer
 * visitante pode abrir. Não há aqui nada inventado para encher: cada
 * secção desaparece quando não tem o que mostrar, e a página diz o que
 * faz em vez de fingir movimento.
 *
 * Os eventos são o caso em que isso mais importa. Não vêm todos: vêm os
 * que cada comunidade marcou como públicos, um a um. O calendário de
 * uma crew continua a ser dela.
 */
export const LandingPage = () => {
    const t = useT();
    const { idioma } = useIdioma();
    const { quando } = criarTools(idioma);

    /**
     * A montra vem da rota pública de eventos, que não pede sessão. É a
     * única leitura de eventos assim, e traz apenas o que cada
     * comunidade decidiu mostrar: nome, hora e de quem. Quem se
     * inscreveu não vem, e não vinha nem que esta página o pedisse.
     */
    const aAcontecer = useAsync(() => listPublicEvents(AMOSTRA), []);

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

    const eventos = aAcontecer.data ?? [];

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
              O que está a acontecer vem primeiro porque é a resposta à
              pergunta que quem chega faz sem a dizer: isto tem gente?
              Uma plataforma de comunidades que parece vazia está a
              dizer a quem chega que chegou tarde.

              Sem eventos públicos não há secção nenhuma. Nada aqui é
              inventado para encher: se ninguém abriu nada, a página
              passa direta ao que faz.
            */}
            {eventos.length > 0 ? (
                <section className="landing-vivo">
                    <div className="landing-vivo-head">
                        <h2>{t.landing.aAcontecer}</h2>
                    </div>

                    <ul className="landing-eventos">
                        {eventos.map((evento) => (
                            <li key={evento.id}>
                                <Link
                                    to={
                                        evento.owner.kind === 'crew'
                                            ? `/crews/${evento.owner.id}`
                                            : `/servidores/${evento.owner.id}`
                                    }
                                >
                                    <b>{evento.name}</b>
                                    <span className="landing-evento-meta">
                                        {/*
                                          "A decorrer agora" e uma hora
                                          de início são leituras
                                          diferentes da mesma linha, e
                                          quem chega quer saber qual
                                          delas é: uma dá para ir já.
                                        */}
                                        {evento.status === 'ongoing' ? (
                                            <span className="agora">
                                                {t.landing.aDecorrerAgora}
                                            </span>
                                        ) : (
                                            <span>
                                                {t.landing.comecaEm(
                                                    quando(evento.startsAt),
                                                )}
                                            </span>
                                        )}
                                        <span>
                                            {t.landing.naCrew(evento.owner.name)}
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {/*
              Quem está a recrutar vem a seguir porque é a única coisa
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
