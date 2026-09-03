import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

import { I18nProvider } from '../src/i18n/i18n.js';
import { en } from '../src/i18n/en.js';
import { criarTools } from '../src/i18n/tools.js';

/**
 * As mensagens tal como o ecrã as vai mostrar por omissão.
 *
 * Os testes assertam através daqui e não com o texto escrito à mão: o
 * que interessa provar é o **comportamento** — que a confirmação é a
 * mesma nos dois casos, que o aviso do plano aparece — e não a redação
 * exata, que muda sem que nada se parta.
 */
export const t = en(criarTools('en'));

/**
 * Monta um ecrã com o que a aplicação lhe dá: rotas e idioma.
 *
 * Sem o `I18nProvider` o componente lia o contexto por omissão, e os
 * testes passavam a provar outra coisa que não o que está no ecrã.
 */
export const montarEcra = (
    conteudo: ReactNode,
    entrada = '/',
): RenderResult =>
    render(
        <MemoryRouter initialEntries={[entrada]}>
            <I18nProvider>{conteudo}</I18nProvider>
        </MemoryRouter>,
    );
