import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';

import { useAuth } from './auth/auth.context.js';
import { logout } from './auth/auth.api.js';
import { LoginPage } from './auth/pages/login.page.js';
import { RegisterPage } from './auth/pages/register.page.js';
import { RecoverPasswordPage } from './auth/pages/recover-password.page.js';
import { VerifyEmailPage } from './auth/pages/verify-email.page.js';
import { HomePage } from './pages/home.page.js';

/** Onde o convite a entrar seria uma repetição do que está no ecrã. */
const SEM_CONVITE = new Set(['/entrar', '/registo']);

const Shell = () => {
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
                            <span className="who">{user.email}</span>
                            <button
                                className="link"
                                type="button"
                                onClick={() => void logout()}
                            >
                                Sair
                            </button>
                        </>
                    ) : SEM_CONVITE.has(pathname) ? null : (
                        <Link to="/entrar">Entrar</Link>
                    )}
                </nav>
            </header>

            <main>
                <Outlet />
            </main>
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
        return <p className="centered">A carregar…</p>;
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
        return <p className="centered">A carregar…</p>;
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

            <Route element={<RequireAuth />}>
                <Route path="/" element={<HomePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
    </Routes>
);
