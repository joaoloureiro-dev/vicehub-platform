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
import { CreateCrewPage } from './crews/pages/create-crew.page.js';
import { CrewDirectoryPage } from './crews/pages/crew-directory.page.js';
import { CrewPage } from './crews/pages/crew.page.js';
import { MyCrewsPage } from './crews/pages/my-crews.page.js';
import { CreateServerPage } from './servers/pages/create-server.page.js';
import { ServerDirectoryPage } from './servers/pages/server-directory.page.js';
import { ServerPage } from './servers/pages/server.page.js';
import { EventPage } from './events/pages/event.page.js';
import { EventsPage } from './events/pages/events.page.js';
import { LandingPage } from './pages/landing.page.js';
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
    { to: '/eu/crews', chave: 'asMinhas' },
    { to: '/eu', chave: 'perfil' },
] as const;

const Shell = () => {
    const t = useT();
    const { user } = useAuth();
    const { pathname } = useLocation();

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

            <main>
                <Outlet />
            </main>

            {user ? (
                <nav className="barra-baixo" aria-label="Navegação principal">
                    {DESTINOS.map((destino) => (
                        <NavLink key={destino.to} to={destino.to} end>
                            {t.nav[destino.chave]}
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
            <Route path="/crews" element={<CrewDirectoryPage />} />
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
                <Route path="/eu/crews" element={<MyCrewsPage />} />
                <Route
                    path="/crews/:crewId/tesouraria"
                    element={<TreasuryPage />}
                />
                <Route path="/crews/:crewId/eventos" element={<EventsPage />} />
                <Route
                    path="/crews/:crewId/eventos/:eventId"
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
