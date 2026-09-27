import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { App } from './app.js';
import { AuthProvider } from './auth/auth.context.js';
import { I18nProvider } from './i18n/i18n.js';
import { LimiteDeErro } from './components/limite-de-erro.js';
import { PendingProvider } from './pages/pending.context.js';
import { AvisosProvider } from './notifications/avisos.context.js';
import './styles/theme.css';

const root = document.getElementById('root');

if (!root) {
    throw new Error('[ViceHub] Falta o elemento #root no index.html.');
}

createRoot(root).render(
    <StrictMode>
        <I18nProvider>
            {/*
              Dentro do idioma e à volta de tudo o resto.

              Dentro, para o ecrã de avaria falar a língua de quem o
              está a ler — é o único texto que essa pessoa tem para
              perceber o que aconteceu. À volta de tudo o resto, porque
              um erro a desenhar numa página qualquer desmontava a
              árvore inteira e deixava branco: o que não é uma avaria a
              mais, é a que se confunde com a rede em baixo, com o
              telemóvel lento, ou com o produto não existir.
            */}
            <LimiteDeErro>
                <BrowserRouter>
                    <AuthProvider>
                        {/*
                          Dentro do AuthProvider porque depende de haver
                          sessão, e à volta do App porque tanto a
                          navegação como a página das comunidades leem
                          daqui.
                        */}
                        <PendingProvider>
                            <AvisosProvider>
                                <App />
                            </AvisosProvider>
                        </PendingProvider>
                    </AuthProvider>
                </BrowserRouter>
            </LimiteDeErro>
        </I18nProvider>
    </StrictMode>,
);
