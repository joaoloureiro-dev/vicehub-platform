import {
    Link,
    Navigate,
    NavLink,
    Outlet,
    Route,
    Routes,
    useLocation,
} from 'react-router';

import { useAuth } from './auth/auth.context.js';
import { logout } from './auth/auth.api.js';
import { useT } from './i18n/i18n.js';
import { LanguagePicker } from './i18n/language-picker.js';
import { LoginPage } from './auth/pages/login.page.js';
import { RegisterPage } from './auth/pages/register.page.js';
import { RecoverPasswordPage } from './auth/pages/recover-password.page.js';
import { VerifyEmailPage } from './auth/pages/verify-email.page.js';
import { PremiumPage } from './billing/pages/premium.page.js';
import { CreateCrewPage } from './crews/pages/create-crew.page.js';
import { CrewDirectoryPage } from './crews/pages/crew-directory.page.js';
import { CrewPage } from './crews/pages/crew.page.js';
import { MyCommunitiesPage } from './pages/my-communities.page.js';
import { CreateServerPage } from './servers/pages/create-server.page.js';
import { ServerDirectoryPage } from './servers/pages/server-directory.page.js';
import { ServerPage } from './servers/pages/server.page.js';
import { EventPage } from './events/pages/event.page.js';
import { EventsPage } from './events/pages/events.page.js';
import { LandingPage } from './pages/landing.page.js';
import { Navegacao } from './components/navegacao.js';
import { PrivacyPage, TermsPage } from './legal/pages/legal.page.js';
import { Rodape } from './components/rodape.js';
import { usePendente } from './pages/pending.context.js';
import { useAvisos } from './notifications/avisos.context.js';
import { AvisosPage } from './notifications/pages/avisos.page.js';
import { MyWalletPage } from './treasury/pages/my-wallet.page.js';
import { TreasuryPage } from './treasury/pages/treasury.page.js';
import { MyProfilePage } from './profile/pages/my-profile.page.js';
import { PublicProfilePage } from './profile/pages/public-profile.page.js';
import { ForumPage } from './forum/pages/forum.page.js';
import { MercadoPage } from './market/pages/mercado.page.js';
import { AnuncioPage } from './market/pages/anuncio.page.js';
import { ConversasPage } from './market/pages/conversas.page.js';
import { ConversaPage } from './market/pages/conversa.page.js';
import { TopicPage } from './forum/pages/topic.page.js';
import { FilaPage } from './moderation/pages/fila.page.js';

/** Um "a carregar" que já sabe falar o idioma escolhido. */
const Carregando = () => {
    const t = useT();

    return <p className="centered">{t.comum.aCarregar}</p>;
};

/**
 * O que está na raiz depende de quem lá chega.
 *
 * Enquanto a sessão é recuperada do cookie não decide nada: mostrar a
 * apresentação a quem já tem conta, mesmo que por um instante, é um
 * salto no ecrã a cada F5.
 */
const Raiz = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <Carregando />;
    }

    return user ? <Navigate to="/eu" replace /> : <LandingPage />;
};


/** Onde o convite a entrar seria uma repetição do que está no ecrã. */
const SEM_CONVITE = new Set(['/entrar', '/registo']);

/**
 * Os destinos principais.
 *
 * No telemóvel vivem numa barra em baixo, ao alcance do polegar — três
 * links no topo não cabem num ecrã de 390px sem cortar o último. A
 * partir dos 640px sobem para o topo, onde há largura.
 */
const DESTINOS = [
    { to: '/crews', chave: 'crews' },
    { to: '/servidores', chave: 'servidores' },
    { to: '/eu/comunidades', chave: 'asMinhas' },
    { to: '/eu', chave: 'perfil' },
] as const;

/**
 * O número que aparece ao lado de "as minhas".
 *
 * Existe para que não seja preciso abrir a página para saber que há
 * qualquer coisa à espera. Só aparece quando há: um zero permanente ao
 * lado de um item de menu deixa de se ler ao fim de dois dias.
 */
const Pendencia = ({ quantos }: { quantos: number }) => {
    const t = useT();

    return quantos === 0 ? null : (
        <span className="pendencia" title={t.pendentes.porResponder(quantos)}>
            {quantos}
        </span>
    );
};

/**
 * O número de avisos por ler.
 *
 * Igual ao das pendências no desenho e diferente em duas coisas: a
 * frase é outra, e tem **tecto**. Quem tem trezentos avisos por ler não
 * precisa de saber que são trezentos — precisa de saber que são muitos
 * —, e um número de três algarismos ao lado de um item de menu empurra
 * o resto da barra para fora do ecrã de um telemóvel.
 */
const AVISOS_A_CONTAR = 99;

const AvisosPorLer = ({ quantos }: { quantos: number }) => {
    const t = useT();

    if (quantos === 0) {
        return null;
    }

    const escrito =
        quantos > AVISOS_A_CONTAR ? `${AVISOS_A_CONTAR}+` : String(quantos);

    return (
        <span className="pendencia" title={t.avisos.porLer(escrito)}>
            {escrito}
        </span>
    );
};

const Shell = () => {
    const t = useT();
    const { user } = useAuth();
    const { pathname } = useLocation();

    /**
     * Lido do contexto, e não pedido aqui.
     *
     * Antes, este ecrã e a secção do topo de `/eu/comunidades` pediam a
     * mesma coisa cada um por si — três idas à API para desenhar uma
     * página. E, pior, nada podia dizer a este número que ele já não
     * estava certo depois de a pessoa ver as respostas.
     */
    const { pendente } = usePendente();
    const { porLer } = useAvisos();

    const porResponder = pendente?.total ?? 0;

    return (
        <div className="shell">
            <header className="topbar">
                <Link className="brand" to="/">
                    <img src="/vicehub-logo.png" alt="" width={32} height={32} />
                    <strong>ViceHub</strong>
                </Link>

                <nav>
                    {user ? (
                        <>
                            {/*
                              Os destinos repetem-se na barra de baixo,
                              que é a que serve no telemóvel. Aqui ficam
                              escondidos até haver largura para eles.
                            */}
                            <span className="so-largo">
                                {DESTINOS.map((destino) => (
                                    <NavLink key={destino.to} to={destino.to} end>
                                        {t.nav[destino.chave]}
                                        {destino.chave === 'asMinhas' ? (
                                            <Pendencia quantos={porResponder} />
                                        ) : null}
                                    </NavLink>
                                ))}
                            </span>
                            {/*
                              Os avisos vivem no cabeçalho e não na
                              navegação de baixo: são da pessoa, como o
                              nome e o sair, e não uma parte do sítio.
                            */}
                            <NavLink className="avisos-link" to="/avisos">
                                {t.nav.avisos}
                                <AvisosPorLer quantos={porLer} />
                            </NavLink>
                            <span className="who">{user.email}</span>
                            <button
                                className="link"
                                type="button"
                                onClick={() => void logout()}
                            >
                                {t.nav.sair}
                            </button>
                        </>
                    ) : SEM_CONVITE.has(pathname) ? null : (
                        <Link to="/entrar">{t.nav.entrar}</Link>
                    )}
                    <LanguagePicker />
                </nav>
            </header>

            {/*
              A navegação do sítio vive aqui, entre o cabeçalho e o
              conteúdo, e não dentro do cabeçalho: é a planta do sítio, e
              não um apêndice ao lado do logótipo.

              Aparece a toda a gente, com sessão ou sem ela. Antes, quem
              chegasse sem conta via um logótipo e um botão de entrar, e
              mais nada — pedia-se-lhe a conta antes de lhe dar uma razão
              para a criar.
            */}
            <Navegacao />

            <main>
                <Outlet />
            </main>

            <Rodape />

            {user ? (
                <nav className="barra-baixo" aria-label="Navegação principal">
                    {DESTINOS.map((destino) => (
                        <NavLink key={destino.to} to={destino.to} end>
                            {t.nav[destino.chave]}
                            {destino.chave === 'asMinhas' ? (
                                <Pendencia quantos={porResponder} />
                            ) : null}
                        </NavLink>
                    ))}
                </nav>
            ) : null}
        </div>
    );
};

/**
 * Só deixa passar quem tem sessão.
 *
 * Enquanto a sessão está a ser recuperada do cookie não decide nada: um
 * `Navigate` disparado nesse intervalo atirava para o login quem afinal
 * estava autenticado, a cada F5.
 */
const RequireAuth = () => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <Carregando />;
    }

    return user ? (
        <Outlet />
    ) : (
        <Navigate to="/entrar" replace state={{ from: location.pathname }} />
    );
};

/**
 * Quem já tem sessão não tem nada que fazer no login nem no registo.
 */
const RequireAnonymous = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <Carregando />;
    }

    return user ? <Navigate to="/" replace /> : <Outlet />;
};

export const App = () => (
    <Routes>
        <Route element={<Shell />}>
            {/*
              As páginas dos links do email não exigem sessão nem a
              recusam: quem clica vem do correio, e pode estar noutro
              dispositivo ou já autenticado noutra conta.
            */}
            <Route path="/recuperar-password" element={<RecoverPasswordPage />} />
            <Route path="/confirmar-email" element={<VerifyEmailPage />} />

            <Route element={<RequireAnonymous />}>
                <Route path="/entrar" element={<LoginPage />} />
                <Route path="/registo" element={<RegisterPage />} />
            </Route>

            {/*
              O diretório e o perfil de uma crew são públicos: é assim
              que alguém de fora descobre a plataforma. O que exige
              sessão é agir sobre eles.
            */}
            {/*
              O preço vê-se sem sessão de propósito: quem ainda não tem
              conta é precisamente quem precisa de saber quanto custa
              antes de a criar.
            */}
            <Route path="/premium" element={<PremiumPage />} />

            {/*
              O fórum é público de ler. Uma pergunta respondida vale
              sobretudo para quem chega de uma pesquisa sem conta
              nenhuma, e fechá-la atrás de um registo faria a plataforma
              responder à mesma pergunta vezes sem conta.
            */}
            {/*
              O mercado de um servidor é público como o fórum: quem
              está a escolher onde jogar ainda não tem conta, e um
              mercado com gente a vender é a prova mais directa de que
              a economia daquele servidor está viva.
            */}
            <Route
                path="/servidores/:serverId/mercado"
                element={<MercadoPage />}
            />
            <Route path="/mercado/:listingId" element={<AnuncioPage />} />

            <Route path="/forum" element={<ForumPage />} />
            {/*
              A fila de quem modera não vive debaixo do fórum: é uma só
              para o fórum e para o mercado.
            */}
            <Route path="/moderacao" element={<FilaPage />} />
            <Route path="/forum/:topicId" element={<TopicPage />} />

            {/*
              Públicas e sem sessão, como têm de ser: quem as precisa de
              ler antes de criar conta é precisamente quem ainda não a
              tem — e a Stripe lê-as sem conta nenhuma.
            */}
            <Route path="/termos" element={<TermsPage />} />
            <Route path="/privacidade" element={<PrivacyPage />} />

            <Route path="/crews" element={<CrewDirectoryPage />} />
            {/*
              O quadro de recrutamento é o mesmo diretório com o filtro
              ligado. Rota própria porque é um sítio para onde se manda
              alguém — "vai ver quem está a recrutar" tem de caber num
              link.
            */}
            <Route
                path="/recrutamento"
                element={<CrewDirectoryPage apenasRecrutamento />}
            />
            <Route path="/servidores" element={<ServerDirectoryPage />} />

            <Route path="/u/:username" element={<PublicProfilePage />} />

            {/*
              A raiz é pública: é o endereço que se dá a alguém, e essa
              alguém ainda não tem conta. Quem já entrou não precisa da
              apresentação e vai direto ao perfil.
            */}
            <Route path="/" element={<Raiz />} />

            <Route element={<RequireAuth />}>
                <Route path="/eu" element={<MyProfilePage />} />
                {/*
                  A carteira de quem está a ver, e por isso debaixo de
                  /eu: não leva identificador nenhum no caminho porque
                  não há carteira de outra pessoa para ver.
                */}
                <Route path="/eu/carteira" element={<MyWalletPage />} />

                {/* A caixa de avisos de quem tem sessão, e de mais ninguém. */}
                <Route path="/avisos" element={<AvisosPage />} />

                {/*
                  As conversas do mercado pedem sessão as duas: uma
                  conversa é de duas pessoas, e ler uma pede sessão
                  como escrever nela. É a única parte do mercado que
                  não é pública.
                */}
                <Route
                    path="/mercado/conversas"
                    element={<ConversasPage />}
                />
                <Route
                    path="/mercado/conversas/:conversationId"
                    element={<ConversaPage />}
                />
                <Route path="/crews/nova" element={<CreateCrewPage />} />
                <Route path="/servidores/novo" element={<CreateServerPage />} />
                <Route path="/eu/comunidades" element={<MyCommunitiesPage />} />
                <Route
                    path="/crews/:crewId/tesouraria"
                    element={<TreasuryPage />}
                />
                {/*
                  A tesouraria de um servidor, que não tinha porta.

                  A caixa de entrada já mandava para aqui as decisões de
                  dinheiro de um servidor, e sem esta rota o catch-all
                  despejava quem clicasse na página inicial: o aviso
                  dizia que havia dinheiro à espera e o clique não levava
                  a lado nenhum.
                */}
                <Route
                    path="/servidores/:serverId/tesouraria"
                    element={<TreasuryPage />}
                />
                <Route path="/crews/:crewId/eventos" element={<EventsPage />} />
                <Route
                    path="/crews/:crewId/eventos/:eventId"
                    element={<EventPage />}
                />
                {/*
                  O mesmo ecrã, com o outro titular. A API já tratava os
                  dois há muito; faltava a porta.

                  Registadas antes de /servidores/:serverId não por
                  precedência — o React Router escolhe pela rota mais
                  específica e não pela ordem — mas para ficarem ao pé
                  das de crews, que é onde alguém as vai procurar.
                */}
                <Route
                    path="/servidores/:serverId/eventos"
                    element={<EventsPage />}
                />
                <Route
                    path="/servidores/:serverId/eventos/:eventId"
                    element={<EventPage />}
                />
            </Route>

            {/*
              Depois de /crews/nova, para que "nova" não seja lido como
              o identificador de uma crew.
            */}
            <Route path="/crews/:crewId" element={<CrewPage />} />
            <Route path="/servidores/:serverId" element={<ServerPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
    </Routes>
);
