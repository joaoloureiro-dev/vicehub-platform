import { NavLink } from 'react-router';

import { useT } from '../i18n/i18n.js';

/**
 * Os sítios onde se pode ir, e que existem mesmo.
 *
 * `News` e `Fórum` não estão aqui de propósito. Um item de menu que leva
 * a "em breve" não faz a plataforma parecer mais completa — faz-lhe uma
 * promessa por cumprir em cima do ecrã, e quem clica fica a saber que
 * não há nada. Entram quando houver o que mostrar.
 */
const DESTINOS = [
    { to: '/crews', chave: 'crews' },
    { to: '/recrutamento', chave: 'recrutamento' },
    { to: '/servidores', chave: 'servidores' },
    { to: '/premium', chave: 'premium' },
] as const;

/**
 * A barra de navegação do sítio, por baixo do cabeçalho.
 *
 * Fora do cabeçalho, e a toda a largura, porque é isso que ela é: a
 * planta do sítio, e não um apêndice ao lado do logótipo.
 *
 * E — o que mais importa — **aparece a quem não tem sessão**. Antes
 * disto, quem chegasse sem conta via um logótipo e um botão de entrar:
 * não havia por onde ver as crews, os servidores ou quem está a
 * recrutar sem primeiro se registar. Pedia-se a conta antes de dar uma
 * razão para a criar.
 */
export const Navegacao = () => {
    const t = useT();

    return (
        <nav className="navegacao" aria-label={t.nav.principal}>
            {DESTINOS.map((destino) => (
                <NavLink key={destino.to} to={destino.to}>
                    {t.nav[destino.chave]}
                </NavLink>
            ))}
        </nav>
    );
};
