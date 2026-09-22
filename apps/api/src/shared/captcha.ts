import { env } from '../config/env.js';

/**
 * O CAPTCHA à entrada, e onde ele vale alguma coisa.
 *
 * O widget no browser não protege nada: é código que corre na máquina de
 * quem o quiser contornar, e contorná-lo é não o desenhar. O que protege
 * é **esta pergunta**, feita do servidor ao Cloudflare, com um segredo
 * que nunca saiu daqui: "este cartão é verdadeiro, e foi emitido para
 * nós?"
 *
 * Por isso a verificação corre **antes de a conta ser tocada**. Um
 * CAPTCHA conferido depois de a password ser procurada já deixou um
 * guião gastar a contagem de tentativas falhadas de outra pessoa — e
 * bloquear a conta de alguém é precisamente uma das coisas que isto
 * existe para impedir.
 */

/** O endereço onde o Cloudflare confirma um cartão. */
const CONFIRMACAO = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Quanto tempo se espera pela confirmação.
 *
 * Curto de propósito: isto está no caminho de quem está a entrar, e uma
 * pessoa parada num formulário desiste antes de qualquer timeout
 * generoso. O que acontece ao fim deste tempo está decidido abaixo.
 */
const ESPERA_MAXIMA_MS = 5_000;

/** Se o CAPTCHA está ligado nesta instalação. */
export const captchaLigado = (): boolean =>
    env.TURNSTILE_SECRET_KEY !== undefined;

/**
 * A chave pública, para o browser poder desenhar o widget.
 *
 * `null` quando não há CAPTCHA — e é assim que o ecrã sabe que não deve
 * ir buscar script nenhum ao Cloudflare. **Nenhum script de terceiros
 * entra numa instalação que não tenha isto configurado**, que é o que
 * mantém verdadeira a promessa da página de privacidade.
 */
export const chavePublicaDoCaptcha = (): string | null =>
    env.TURNSTILE_SITE_KEY ?? null;

export interface ResultadoDoCaptcha {
    passou: boolean;
    /** O que o Cloudflare disse, para o registo. Nunca vai para o ecrã. */
    porque?: string;
}

/**
 * Confirma um cartão com o Cloudflare.
 *
 * Com o CAPTCHA desligado devolve sempre que passou: não há nada a
 * confirmar, e fazer as rotas decidirem isso caso a caso espalhava a
 * mesma condição por todo o lado.
 */
export const confirmarCaptcha = async (
    cartao: string | undefined,
    ip: string | undefined,
): Promise<ResultadoDoCaptcha> => {
    const segredo = env.TURNSTILE_SECRET_KEY;

    if (segredo === undefined) {
        return { passou: true };
    }

    if (cartao === undefined || cartao === '') {
        return { passou: false, porque: 'sem cartão' };
    }

    const corpo = new URLSearchParams({ secret: segredo, response: cartao });

    /**
     * O endereço de quem pediu, quando se sabe. É opcional para o
     * Cloudflare e ajuda-o a decidir — mas a API corre com `trustProxy`
     * desligado, por isso atrás de um proxy isto é o endereço do proxy.
     * Mandá-lo na mesma não estraga nada; confiar nele para outra coisa
     * estragaria.
     */
    if (ip !== undefined) {
        corpo.set('remoteip', ip);
    }

    try {
        const resposta = await fetch(CONFIRMACAO, {
            method: 'POST',
            body: corpo,
            signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
        });

        if (!resposta.ok) {
            return { passou: false, porque: `resposta ${resposta.status}` };
        }

        const dados = (await resposta.json()) as {
            success?: boolean;
            'error-codes'?: string[];
        };

        if (dados.success === true) {
            return { passou: true };
        }

        return {
            passou: false,
            porque: (dados['error-codes'] ?? ['sem motivo']).join(', '),
        };
    } catch (erro: unknown) {
        /**
         * O Cloudflare não respondeu, e a pergunta é o que fazer a
         * seguir. **Recusa-se.**
         *
         * Deixar passar seria transformar cada indisponibilidade deles
         * numa janela com o CAPTCHA desligado — e quem quisesse abusar
         * disto não tinha de esperar por ela, bastava-lhe provocá-la.
         * Quem administra escolheu ter CAPTCHA; um CAPTCHA que se
         * desliga sozinho quando é preciso não é o que foi escolhido.
         *
         * O preço é real e é o certo: numa avaria deles, ninguém entra
         * nem se regista durante esse tempo. Quem já tem sessão continua
         * a usar a plataforma.
         */
        return {
            passou: false,
            porque: erro instanceof Error ? erro.message : 'não respondeu',
        };
    }
};
