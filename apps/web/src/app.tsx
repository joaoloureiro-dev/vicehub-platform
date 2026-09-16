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
import { TreasuryPage } from './treasury/pages/treasury.page.js';
import { MyProfilePage } from './profile/pages/my-profile.page.js';
import { PublicProfilePage } from './profile/pages/public-profile.page.js';

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
