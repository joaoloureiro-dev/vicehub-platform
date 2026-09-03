import {
    createContext,
    useContext,
    useEffect,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from 'react';

import { sessionStore, type SessionUser } from '../lib/session.js';
import { restoreSession } from './auth.api.js';

interface AuthState {
    user: SessionUser | null;
    /** Enquanto for verdade, ainda não se sabe se há sessão. */
    loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const user = useSyncExternalStore(
        sessionStore.subscribe,
        sessionStore.getUser,
        () => null,
    );

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let ativo = true;

        void restoreSession().finally(() => {
            /**
             * Um `setState` depois de o componente sair do ecrã não faz
             * nada de útil e avisa na consola.
             */
            if (ativo) {
                setLoading(false);
            }
        });

        return () => {
            ativo = false;
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthState => useContext(AuthContext);
