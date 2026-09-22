import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { Captcha } from '../src/auth/components/captcha.js';
import { montarEcra, t } from './helpers.js';

/**
 * O widget do CAPTCHA, e sobretudo a sua ausência.
 *
 * O que aqui se guarda não é o desenho — é código do Cloudflare e não
 * nosso. É a **promessa da página de privacidade**: numa instalação sem
 * CAPTCHA configurado, nenhum script de terceiros entra na página. Essa
 * frase está escrita num documento legal, e é este ficheiro que a
 * mantém verdadeira quando alguém mexer no componente.
 *
 * Os testes correm por esta ordem de propósito. O script é memorizado
 * uma vez por página — é para isso que a memória existe —, e por isso
 * há um antes e um depois de ele ter carregado. Cada teste diz em qual
 * dos dois está.
 */

const responder = (siteKey: string | null) => {
    const fetchFalso = vi.fn((_url: string) =>
        Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ siteKey }),
        } as Response),
    );

    vi.stubGlobal('fetch', fetchFalso);

    return fetchFalso;
};

const doTurnstile = (): HTMLScriptElement[] =>
    Array.from(document.head.querySelectorAll('script')).filter((etiqueta) =>
        etiqueta.src.includes('challenges.cloudflare.com'),
    );

interface OpcoesDoWidget {
    sitekey: string;
    callback: (cartao: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
}

/**
 * O Cloudflare posto na página, e o registo do que ele desenhou.
 *
 * O jsdom não vai buscar o script, e é melhor assim: o que interessa
 * verificar é o que acontece **depois** de ele chegar, e ir buscá-lo a
 * sério punha a suite a depender da rede de outra pessoa.
 */
const prepararTurnstile = (): OpcoesDoWidget[] => {
    const desenhos: OpcoesDoWidget[] = [];

    vi.stubGlobal('turnstile', {
        render: (_onde: HTMLElement, opcoes: OpcoesDoWidget) => {
            desenhos.push(opcoes);

            return `widget-${desenhos.length}`;
        },
        remove: vi.fn(),
    });

    return desenhos;
};

/**
 * Espera pelo pedido do script e dá-lo por chegado, ou por falhado.
 *
 * O último e não o primeiro: os pedidos de testes anteriores ficam na
 * página, como ficariam numa página a sério, e o que acabou de ser
 * pedido é o que está à espera de resposta.
 */
const oScript = async (como: 'load' | 'error'): Promise<void> => {
    const antes = doTurnstile().length;

    const etiqueta = await waitFor(() => {
        const pedidos = doTurnstile();

        expect(pedidos.length, 'o script do Turnstile não foi pedido').toBeGreaterThan(
            antes,
        );

        return pedidos[pedidos.length - 1] as HTMLScriptElement;
    });

    etiqueta.dispatchEvent(new Event(como));
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('o CAPTCHA no ecrã', () => {
    /**
     * O caso por omissão, e o que a política de privacidade promete.
     */
    it('sem chave, não desenha nada e não pede script nenhum', async () => {
        const chamadas = responder(null);

        const { container } = montarEcra(<Captcha aoResponder={vi.fn()} />);

        await waitFor(() => {
            expect(chamadas).toHaveBeenCalled();
        });

        expect(container.querySelector('.captcha')).toBeNull();
        expect(doTurnstile()).toHaveLength(0);
    });

    /**
     * E uma resposta sem o campo conta como "não há".
     *
     * `undefined` não é `null`, e passaria pela porteira que decide se
     * se desenha o widget: o ecrã mandava buscar um script de terceiros
     * sem ter chave nenhuma para lhe dar. Uma instalação antiga, um
     * proxy que corta campos, ou a rota a mudar de forma bastam.
     */
    it('sem o campo na resposta, trata como se não houvesse chave', async () => {
        const chamadas = vi.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            } as Response),
        );

        vi.stubGlobal('fetch', chamadas);

        const { container } = montarEcra(<Captcha aoResponder={vi.fn()} />);

        await waitFor(() => {
            expect(chamadas).toHaveBeenCalled();
        });

        expect(container.querySelector('.captcha')).toBeNull();
        expect(doTurnstile()).toHaveLength(0);
    });

    /**
     * E quando a própria API não responde, também não.
     *
     * Um widget partido a olhar para quem está a entrar é pior do que
     * widget nenhum: se a instalação exigir CAPTCHA, o servidor recusa
     * e a pessoa lê porquê.
     */
    it('sem resposta da API, também não desenha nada', async () => {
        const chamadas = vi.fn(() => Promise.reject(new Error('sem rede')));

        vi.stubGlobal('fetch', chamadas);

        const { container } = montarEcra(<Captcha aoResponder={vi.fn()} />);

        await waitFor(() => {
            expect(chamadas).toHaveBeenCalled();
        });

        expect(container.querySelector('.captcha')).toBeNull();
        expect(doTurnstile()).toHaveLength(0);
    });

    /**
     * O primeiro que carrega o script — e que o vê falhar.
     *
     * Um script que não chega tem de avisar **as duas partes**. Quem
     * está à espera do cartão, para não enviar um cartão velho; e quem
     * está a olhar para o ecrã, que de outra forma via um espaço em
     * branco, carregava em entrar, e lia uma resposta sobre robôs sem
     * nunca ter visto nada a que responder.
     *
     * E a memória do script fica limpa, para que uma rede que voltou
     * não obrigue a recarregar a página.
     */
    it('avisa quando o script não carrega', async () => {
        responder('publica-de-teste');

        const respondeu = vi.fn();

        const { container } = montarEcra(<Captcha aoResponder={respondeu} />);

        await oScript('error');

        await waitFor(() => {
            expect(respondeu).toHaveBeenCalledWith(null);
        });

        await screen.findByText(t.auth.captchaNaoCarregou);

        /** E o espaço reservado ao widget desaparece com ele. */
        expect(container.querySelector('.captcha')).toBeNull();
        expect(doTurnstile()).toHaveLength(1);
    });

    /**
     * Dois widgets, um script.
     *
     * Quem vai do login para o registo não devia pagar o download duas
     * vezes, e dois scripts iguais na mesma página é um erro do
     * Cloudflare à espera de acontecer. Este é o pedido que fica
     * memorizado, e os testes seguintes contam com ele.
     */
    it('carrega o script uma vez só, com dois widgets na página', async () => {
        responder('publica-de-teste');

        const desenhos = prepararTurnstile();

        montarEcra(
            <>
                <Captcha aoResponder={vi.fn()} />
                <Captcha aoResponder={vi.fn()} />
            </>,
        );

        await oScript('load');

        await waitFor(() => {
            expect(desenhos).toHaveLength(2);
        });

        /** O primeiro é o do teste anterior, que falhou. Um novo, e só um. */
        expect(doTurnstile()).toHaveLength(2);
    });

    /**
     * O cartão que o widget devolve sobe para quem submete o
     * formulário — e o script não é pedido outra vez.
     */
    it('entrega o cartão a quem o vai enviar, sem pedir o script de novo', async () => {
        responder('publica-de-teste');

        const desenhos = prepararTurnstile();
        const respondeu = vi.fn();

        montarEcra(<Captcha aoResponder={respondeu} />);

        await waitFor(() => {
            expect(desenhos).toHaveLength(1);
        });

        const opcoes = desenhos[0] as OpcoesDoWidget;

        expect(opcoes.sitekey).toBe('publica-de-teste');

        opcoes.callback('o-cartao');

        expect(respondeu).toHaveBeenCalledWith('o-cartao');
        expect(doTurnstile()).toHaveLength(2);
    });

    /**
     * Um cartão do Turnstile dura minutos.
     *
     * Quem deixa o formulário aberto e volta tem de ter outro: limpar o
     * antigo é o que impede o pedido de sair com um cartão que o
     * servidor vai recusar, e a pessoa de levar com um erro que não
     * percebe.
     */
    it('limpa o cartão quando ele expira', async () => {
        responder('publica-de-teste');

        const desenhos = prepararTurnstile();
        const respondeu = vi.fn();

        montarEcra(<Captcha aoResponder={respondeu} />);

        await waitFor(() => {
            expect(desenhos).toHaveLength(1);
        });

        const opcoes = desenhos[0] as OpcoesDoWidget;

        opcoes.callback('o-cartao');
        opcoes['expired-callback']();

        expect(respondeu).toHaveBeenLastCalledWith(null);
    });

    /** E o mesmo quando o próprio widget falha. */
    it('limpa o cartão quando o widget falha', async () => {
        responder('publica-de-teste');

        const desenhos = prepararTurnstile();
        const respondeu = vi.fn();

        montarEcra(<Captcha aoResponder={respondeu} />);

        await waitFor(() => {
            expect(desenhos).toHaveLength(1);
        });

        const opcoes = desenhos[0] as OpcoesDoWidget;

        opcoes.callback('o-cartao');
        opcoes['error-callback']();

        expect(respondeu).toHaveBeenLastCalledWith(null);
    });
});
