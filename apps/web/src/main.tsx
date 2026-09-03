import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { App } from './app.js';
import { AuthProvider } from './auth/auth.context.js';
import { I18nProvider } from './i18n/i18n.js';
import './styles/theme.css';

const root = document.getElementById('root');

if (!root) {
    throw new Error('[ViceHub] Falta o elemento #root no index.html.');
}

createRoot(root).render(
    <StrictMode>
        <I18nProvider>
            <BrowserRouter>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </BrowserRouter>
        </I18nProvider>
    </StrictMode>,
);
