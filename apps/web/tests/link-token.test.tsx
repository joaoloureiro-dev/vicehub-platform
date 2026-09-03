import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { useLinkToken } from '../src/auth/use-link-token.js';

const Sonda = () => {
    const token = useLinkToken();

    return <p>token: {token ?? '(nenhum)'}</p>;
};

const irPara = (url: string) => {
    window.history.replaceState(null, '', url);
};

/**
 * O segredo vem na query string, e não pode ficar lá.
 *
 * Um token na barra de endereços fica no histórico, aparece numa
 * captura de ecrã, e segue no `Referer` de qualquer pedido que a página
 * faça para fora.
 */
describe('o segredo que vem no link', () => {
    it('lê o token do endereço', () => {
        irPara('/recuperar-password?token=abc123');

        render(<Sonda />);

        expect(screen.getByText('token: abc123')).toBeDefined();
    });

    it('apaga o token do endereço assim que o lê', () => {
        irPara('/recuperar-password?token=abc123');

        render(<Sonda />);

        expect(window.location.search).toBe('');
        expect(window.location.pathname).toBe('/recuperar-password');
    });

    /**
     * Trocado, não empilhado: carregar em "voltar" não pode devolver o
     * endereço com o segredo lá dentro.
     */
    it('não deixa o endereço antigo no histórico', () => {
        irPara('/confirmar-email?token=xyz');

        const antes = window.history.length;

        render(<Sonda />);

        expect(window.history.length).toBe(antes);
    });

    it('preserva os outros parâmetros', () => {
        irPara('/recuperar-password?token=abc&de=email');

        render(<Sonda />);

        expect(window.location.search).toBe('?de=email');
    });

    it('não inventa um token quando o link não traz nenhum', () => {
        irPara('/recuperar-password');

        render(<Sonda />);

        expect(screen.getByText('token: (nenhum)')).toBeDefined();
    });
});
